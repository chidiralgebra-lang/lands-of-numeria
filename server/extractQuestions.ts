import { GoogleGenAI, Type } from '@google/genai';

export interface ExtractQuestionsPayload {
  textContent?: string;
  fileBase64?: string;
  fileMimeType?: string;
  fileName?: string;
  gradeLevel?: string;
  targetTopic?: string;
  questionCount?: number;
  instructions?: string;
}

export interface ExtractQuestionsResult {
  detectedSummary: string;
  unreadableWarning: string;
  questions: Array<Record<string, unknown>>;
}

export class ExtractHttpError extends Error {
  statusCode: number;

  constructor(statusCode: number, message: string) {
    super(message);
    this.name = 'ExtractHttpError';
    this.statusCode = statusCode;
  }
}

export function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY?.trim() || process.env.GOOGLE_API_KEY?.trim();
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

function isRetryableError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err || '');
  return /\b(429|500|502|503|504)\b|rate limit|ECONNRESET|ETIMEDOUT|fetch failed/i.test(msg);
}

function isModelUnavailableError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err || '');
  return /\b404\b|not found|not_found|is not supported for generatecontent|unknown model/i.test(msg);
}

function parseJsonResponseText(rawText: string | undefined): Record<string, unknown> {
  const trimmed = (rawText ?? '{}').trim();
  const stripped = trimmed.startsWith('```')
    ? trimmed.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
    : trimmed;
  return JSON.parse(stripped || '{}') as Record<string, unknown>;
}

export async function extractQuestionsWithGemini(
  payload: ExtractQuestionsPayload
): Promise<ExtractQuestionsResult> {
  const ai = getGeminiClient();
  if (!ai) {
    throw new ExtractHttpError(
      503,
      'GEMINI_API_KEY belum terkonfigurasi di server hosting. Tambahkan Environment Variable GEMINI_API_KEY di Netlify (Site configuration → Environment variables) lalu Trigger deploy.'
    );
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
  } = payload || {};

  if (!textContent?.trim() && !fileBase64) {
    throw new ExtractHttpError(
      400,
      'Unggah dokumen atau masukkan teks materi/kisi-kisi terlebih dahulu.'
    );
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

  const generationConfig = {
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
  };

  // Try AI Studio primary model first; fall back to public Gemini model if an external API key does not expose gemini-4-hydrogen
  const candidateModels = ['gemini-4-hydrogen', 'gemini-2.5-flash'];
  let lastError: unknown;

  for (let mIdx = 0; mIdx < candidateModels.length; mIdx++) {
    const model = candidateModels[mIdx];
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents: { parts },
          config: generationConfig,
        });
        const parsed = parseJsonResponseText(response.text);
        return {
          detectedSummary:
            typeof parsed.detectedSummary === 'string' && parsed.detectedSummary.trim()
              ? parsed.detectedSummary
              : 'Dokumen berhasil dianalisis.',
          unreadableWarning: typeof parsed.unreadableWarning === 'string' ? parsed.unreadableWarning : '',
          questions: Array.isArray(parsed.questions)
            ? (parsed.questions as Array<Record<string, unknown>>)
            : [],
        };
      } catch (err: unknown) {
        lastError = err;
        if (mIdx < candidateModels.length - 1 && isModelUnavailableError(err)) {
          break; // Immediately try fallback public model
        }
        if (attempt === 0 && isRetryableError(err)) {
          await new Promise((resolve) => setTimeout(resolve, 350));
          continue;
        }
        throw new ExtractHttpError(
          500,
          err instanceof Error ? err.message : 'Gagal mengekstrak soal dari dokumen.'
        );
      }
    }
  }

  const message = lastError instanceof Error ? lastError.message : 'Gagal mengekstrak soal dari dokumen.';
  throw new ExtractHttpError(500, message);
}
