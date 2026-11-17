import express, { Request, Response } from 'express';
import http from 'http';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json({ limit: '16mb' }));

// ==========================================
// 1. Gemini Server-Side Question Extraction
// ==========================================
function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') return null;
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

app.post('/api/extract-questions', async (req: Request, res: Response) => {
  try {
    const ai = getGeminiClient();
    if (!ai) {
      res.status(503).json({
        error:
          'GEMINI_API_KEY belum terkonfigurasi di server. Gunakan impor CSV/JSON atau pastikan API key aktif di Settings > Secrets.',
      });
      return;
    }

    const {
      textContent,
      fileBase64,
      fileMimeType,
      fileName,
      gradeLevel,
      targetTopic,
      questionCount = 6,
      instructions,
    } = req.body as {
      textContent?: string;
      fileBase64?: string;
      fileMimeType?: string;
      fileName?: string;
      gradeLevel?: string;
      targetTopic?: string;
      questionCount?: number;
      instructions?: string;
    };

    if (!textContent && !fileBase64) {
      res.status(400).json({ error: 'Unggah dokumen atau masukkan teks materi/kisi-kisi terlebih dahulu.' });
      return;
    }

    const systemInstruction = `Anda adalah Guru Matematika senior dan Instructional Designer.
Tugas Anda adalah membaca dokumen/teks bahan ajar, kisi-kisi, modul, atau kumpulan soal yang diberikan oleh guru, lalu mengekstrak atau menyusun soal matematika yang AKURAT dalam Bahasa Indonesia.

ATURAN KETAT:
1. Jangan mengarang fakta atau rumus di luar materi dokumen. Jika dokumen sudah berisi soal, pertahankan konteks, data, dan tingkat kesulitan soal asli.
2. Jika dokumen berupa kisi-kisi atau materi ajar, susun soal sesuai indikator, tingkat kelas (${gradeLevel || 'sesuai dokumen'}), dan topik (${targetTopic || 'sesuai dokumen'}).
3. Periksa ulang setiap perhitungan matematika, satuan, pecahan, desimal, dan kunci jawaban secara independen sebelum mengeluarkannya.
4. Untuk pilihan ganda, pastikan tepat 4 opsi yang masuk akal dan HANYA SATU kunci jawaban benar yang persis sama dengan salah satu opsi.
5. Tandai 'isAiGenerated': true jika soal disusun/dikembangkan dari kisi-kisi atau materi, dan false jika diekstrak langsung dari soal yang sudah ada di dokumen.
6. Sertakan pembahasan langkah demi langkah yang ramah siswa pada 'explanation' dan sebutkan bagian/halaman sumber jika terbaca pada 'sourcePage'.`;

    const promptText = `Analisislah sumber pembelajaran berikut (Nama berkas: ${fileName || 'Teks Materi Guru'}).
Target jumlah soal: maksimal ${Math.min(Math.max(Number(questionCount) || 6, 1), 20)} soal.
Jenjang/Kelas: ${gradeLevel || 'Sesuaikan dengan isi dokumen'}.
Topik prioritas: ${targetTopic || 'Sesuaikan dengan isi dokumen'}.
Catatan tambahan guru: ${instructions || 'Tidak ada'}.

${textContent ? `--- ISI TEKS / KISI-KISI ---\n${textContent}\n--- AKHIR TEKS ---` : ''}`;

    const parts: Array<Record<string, unknown>> = [];
    if (fileBase64 && fileMimeType) {
      parts.push({
        inlineData: {
          mimeType: fileMimeType,
          data: fileBase64,
        },
      });
    }
    parts.push({ text: promptText });

    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: { parts },
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            detectedSummary: {
              type: Type.STRING,
              description: 'Ringkasan singkat materi, jenjang, dan topik yang terdeteksi dari dokumen.',
            },
            unreadableWarning: {
              type: Type.STRING,
              description: 'Peringatan jika ada bagian dokumen yang kurang jelas/ambigu (kosongkan jika jelas semua).',
            },
            questions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  subject: { type: Type.STRING },
                  gradeLevel: { type: Type.STRING },
                  topic: { type: Type.STRING },
                  subtopic: { type: Type.STRING },
                  indicator: { type: Type.STRING },
                  sourcePage: { type: Type.STRING },
                  difficulty: { type: Type.STRING, description: 'Harus salah satu: mudah, sedang, sulit' },
                  type: {
                    type: Type.STRING,
                    description: 'Harus salah satu: pilihan_ganda, benar_salah, isian, uraian',
                  },
                  prompt: { type: Type.STRING },
                  options: { type: Type.ARRAY, items: { type: Type.STRING } },
                  correctAnswer: { type: Type.STRING },
                  acceptedAlternatives: { type: Type.ARRAY, items: { type: Type.STRING } },
                  numericValue: { type: Type.NUMBER },
                  unit: { type: Type.STRING },
                  explanation: { type: Type.STRING },
                  rubric: { type: Type.STRING },
                  isAiGenerated: { type: Type.BOOLEAN },
                },
                required: ['topic', 'indicator', 'difficulty', 'type', 'prompt', 'correctAnswer', 'explanation'],
              },
            },
          },
          required: ['detectedSummary', 'questions'],
        },
      },
    });

    const parsed = JSON.parse((response.text ?? '{}').trim());
    res.json({
      detectedSummary: parsed.detectedSummary || 'Dokumen berhasil dianalisis.',
      unreadableWarning: parsed.unreadableWarning || '',
      questions: Array.isArray(parsed.questions) ? parsed.questions : [],
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Gagal mengekstrak soal dari dokumen.';
    console.error('Extract questions error:', message);
    res.status(500).json({ error: message });
  }
});

// ==========================================
// 2. Online Class Battle (Server-Authoritative Rooms + SSE)
// ==========================================
interface RoomQuestion {
  id: string;
  topic: string;
  indicator: string;
  difficulty: 'mudah' | 'sedang' | 'sulit';
  type: 'pilihan_ganda' | 'benar_salah' | 'isian' | 'uraian';
  prompt: string;
  options?: string[];
  correctAnswer: string;
  acceptedAlternatives?: string[];
  numericValue?: number;
  unit?: string;
  explanation: string;
}

interface RoomParticipant {
  id: string;
  name: string;
  heroId: string;
  score: number;
  correctCount: number;
  answeredCount: number;
  answeredIds: string[];
  assignedQuestionIds: string[];
  connected: boolean;
}

interface BattleRoom {
  code: string;
  title: string;
  areaName: string;
  topicFilter: string;
  difficulty: string;
  questionCount: number;
  durationPerQuestionSec: number;
  allowHints: boolean;
  showPublicLeaderboard: boolean;
  status: 'LOBBY' | 'ACTIVE' | 'ENDED';
  createdAt: string;
  startedAtMs: number | null;
  questionPool: RoomQuestion[];
  participants: Record<string, RoomParticipant>;
  sseClients: Set<Response>;
}

const rooms = new Map<string, BattleRoom>();

function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return rooms.has(code) ? generateRoomCode() : code;
}

function serializeRoomForClient(room: BattleRoom, participantId?: string) {
  const participantsList = Object.values(room.participants).map((p) => ({
    id: p.id,
    name: p.name,
    heroId: p.heroId,
    score: p.score,
    correctCount: p.correctCount,
    answeredCount: p.answeredCount,
    connected: p.connected,
  }));

  let myQuestions: Array<Omit<RoomQuestion, 'correctAnswer' | 'acceptedAlternatives' | 'numericValue'>> = [];
  if (participantId && room.participants[participantId]) {
    const p = room.participants[participantId];
    myQuestions = p.assignedQuestionIds
      .map((qid) => room.questionPool.find((q) => q.id === qid))
      .filter((q): q is RoomQuestion => Boolean(q))
      .map(({ correctAnswer: _c, acceptedAlternatives: _a, numericValue: _n, ...safeQ }) => safeQ);
  }

  return {
    code: room.code,
    title: room.title,
    areaName: room.areaName,
    topicFilter: room.topicFilter,
    difficulty: room.difficulty,
    questionCount: room.questionCount,
    durationPerQuestionSec: room.durationPerQuestionSec,
    allowHints: room.allowHints,
    showPublicLeaderboard: room.showPublicLeaderboard,
    status: room.status,
    createdAt: room.createdAt,
    startedAtMs: room.startedAtMs,
    serverTimeMs: Date.now(),
    participants: participantsList.sort((a, b) => b.score - a.score),
    myQuestions,
  };
}

function broadcastRoom(room: BattleRoom) {
  const payload = JSON.stringify(serializeRoomForClient(room));
  for (const client of room.sseClients) {
    client.write(`data: ${payload}\n\n`);
  }
}

app.post('/api/rooms', (req: Request, res: Response) => {
  const {
    title,
    areaName,
    topicFilter,
    difficulty,
    questionCount,
    durationPerQuestionSec,
    allowHints,
    showPublicLeaderboard,
    questionPool,
  } = req.body as {
    title: string;
    areaName: string;
    topicFilter: string;
    difficulty: string;
    questionCount: number;
    durationPerQuestionSec: number;
    allowHints: boolean;
    showPublicLeaderboard: boolean;
    questionPool: RoomQuestion[];
  };

  if (!Array.isArray(questionPool) || questionPool.length === 0) {
    res.status(400).json({ error: 'Paket soal untuk sesi kelas kosong.' });
    return;
  }

  const code = generateRoomCode();
  const room: BattleRoom = {
    code,
    title: title || 'Pertarungan Kelas Matematika',
    areaName: areaName || 'Arena Kelas',
    topicFilter: topicFilter || 'ALL',
    difficulty: difficulty || 'campuran',
    questionCount: Math.min(Number(questionCount) || 5, questionPool.length),
    durationPerQuestionSec: Number(durationPerQuestionSec) || 45,
    allowHints: Boolean(allowHints),
    showPublicLeaderboard: showPublicLeaderboard !== false,
    status: 'LOBBY',
    createdAt: new Date().toISOString(),
    startedAtMs: null,
    questionPool,
    participants: {},
    sseClients: new Set(),
  };

  rooms.set(code, room);
  res.json(serializeRoomForClient(room));
});

app.get('/api/rooms/:code', (req: Request, res: Response) => {
  const code = String(req.params.code || '').toUpperCase().trim();
  const room = rooms.get(code);
  if (!room) {
    res.status(404).json({ error: 'Kode kelas tidak ditemukan atau sesi sudah berakhir.' });
    return;
  }
  const participantId = typeof req.query.participantId === 'string' ? req.query.participantId : undefined;
  res.json(serializeRoomForClient(room, participantId));
});

app.get('/api/rooms/:code/stream', (req: Request, res: Response) => {
  const code = String(req.params.code || '').toUpperCase().trim();
  const room = rooms.get(code);
  if (!room) {
    res.status(404).end();
    return;
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  room.sseClients.add(res);
  res.write(`data: ${JSON.stringify(serializeRoomForClient(room))}\n\n`);

  req.on('close', () => {
    room.sseClients.delete(res);
  });
});

function assignParallelQuestions(room: BattleRoom, participantIndex: number): string[] {
  // Deal equivalent parallel question subsets rotated per participant so neighbors don't get identical sequences
  const pool = [...room.questionPool];
  const n = pool.length;
  const count = Math.min(room.questionCount, n);
  const offset = (participantIndex * Math.max(1, Math.floor(n / 3))) % n;
  const chosen: string[] = [];
  for (let i = 0; i < count; i++) {
    chosen.push(pool[(offset + i) % n].id);
  }
  return chosen;
}

app.post('/api/rooms/:code/join', (req: Request, res: Response) => {
  const code = String(req.params.code || '').toUpperCase().trim();
  const room = rooms.get(code);
  if (!room) {
    res.status(404).json({ error: 'Kode kelas tidak ditemukan.' });
    return;
  }
  if (room.status === 'ENDED') {
    res.status(400).json({ error: 'Sesi kelas ini sudah selesai.' });
    return;
  }

  const { name, heroId } = req.body as { name?: string; heroId?: string };
  const cleanName = (name || '').trim().slice(0, 32);
  if (!cleanName) {
    res.status(400).json({ error: 'Masukkan nama panggilan terlebih dahulu.' });
    return;
  }

  const pid = `p-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const pIndex = Object.keys(room.participants).length;
  const assignedQuestionIds =
    room.status === 'ACTIVE' ? assignParallelQuestions(room, pIndex) : [];

  room.participants[pid] = {
    id: pid,
    name: cleanName,
    heroId: heroId || 'ksatria',
    score: 0,
    correctCount: 0,
    answeredCount: 0,
    answeredIds: [],
    assignedQuestionIds,
    connected: true,
  };

  broadcastRoom(room);
  res.json({
    participantId: pid,
    room: serializeRoomForClient(room, pid),
  });
});

app.post('/api/rooms/:code/start', (req: Request, res: Response) => {
  const code = String(req.params.code || '').toUpperCase().trim();
  const room = rooms.get(code);
  if (!room) {
    res.status(404).json({ error: 'Ruang kelas tidak ditemukan.' });
    return;
  }
  room.status = 'ACTIVE';
  room.startedAtMs = Date.now();
  const pKeys = Object.keys(room.participants);
  pKeys.forEach((pid, idx) => {
    if (room.participants[pid].assignedQuestionIds.length === 0) {
      room.participants[pid].assignedQuestionIds = assignParallelQuestions(room, idx);
    }
  });
  broadcastRoom(room);
  res.json(serializeRoomForClient(room));
});

function checkServerAnswer(q: RoomQuestion, answerRaw: string): boolean {
  const norm = (s: string) => s.trim().toLowerCase().replace(/,/g, '.').replace(/\s+/g, ' ');
  const a = norm(answerRaw);
  if (!a) return false;
  if (q.type === 'uraian') return true;
  if (a === norm(q.correctAnswer)) return true;
  if (q.acceptedAlternatives?.some((alt) => norm(alt) === a)) return true;
  if (typeof q.numericValue === 'number') {
    const cleaned = a.replace(/[^\d.,/-]/g, '');
    const frac = cleaned.match(/^(-?\d+)\/(-?\d+)$/);
    const num = frac ? parseFloat(frac[1]) / parseFloat(frac[2]) : parseFloat(cleaned);
    if (Number.isFinite(num) && Math.abs(num - q.numericValue) <= 1e-4) return true;
  }
  return false;
}

app.post('/api/rooms/:code/answer', (req: Request, res: Response) => {
  const code = String(req.params.code || '').toUpperCase().trim();
  const room = rooms.get(code);
  if (!room) {
    res.status(404).json({ error: 'Ruang kelas tidak ditemukan.' });
    return;
  }
  if (room.status !== 'ACTIVE') {
    res.status(400).json({ error: 'Pertandingan belum dimulai atau sudah selesai.' });
    return;
  }

  const { participantId, questionId, answer } = req.body as {
    participantId: string;
    questionId: string;
    answer: string;
  };
  const participant = room.participants[participantId];
  if (!participant) {
    res.status(404).json({ error: 'Peserta tidak ditemukan.' });
    return;
  }

  // Prevent double submission
  if (participant.answeredIds.includes(questionId)) {
    res.status(409).json({ error: 'Soal ini sudah dijawab sebelumnya.' });
    return;
  }

  const question = room.questionPool.find((q) => q.id === questionId);
  if (!question) {
    res.status(404).json({ error: 'Soal tidak ditemukan.' });
    return;
  }

  const isCorrect = checkServerAnswer(question, answer || '');
  participant.answeredIds.push(questionId);
  participant.answeredCount += 1;
  if (isCorrect) {
    const diffMult = question.difficulty === 'sulit' ? 1.5 : question.difficulty === 'sedang' ? 1.2 : 1;
    participant.score += Math.round(100 * diffMult);
    participant.correctCount += 1;
  }

  broadcastRoom(room);
  res.json({
    isCorrect,
    correctAnswer: question.correctAnswer,
    explanation: question.explanation,
    score: participant.score,
    correctCount: participant.correctCount,
  });
});

app.post('/api/rooms/:code/end', (req: Request, res: Response) => {
  const code = String(req.params.code || '').toUpperCase().trim();
  const room = rooms.get(code);
  if (!room) {
    res.status(404).json({ error: 'Ruang kelas tidak ditemukan.' });
    return;
  }
  room.status = 'ENDED';
  broadcastRoom(room);
  res.json(serializeRoomForClient(room));
});

// ==========================================
// 3. Vite Dev Middleware / Static Prod Server
// ==========================================
async function startServer() {
  const PORT = 3000;
  const server = http.createServer(app);

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        ws: { server },
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`LANDS of NUMERIA server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
