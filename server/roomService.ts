export interface RoomQuestion {
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

export interface RoomParticipant {
  id: string;
  name: string;
  heroId: string;
  score: number;
  correctCount: number;
  answeredCount: number;
  answeredIds: string[];
  assignedQuestionIds: string[];
  joinedOrder: number;
  connected: boolean;
}

export interface BattleRoomMeta {
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
}

export interface RoomStore {
  getRoomMeta(code: string): Promise<BattleRoomMeta | null>;
  setRoomMeta(meta: BattleRoomMeta): Promise<void>;
  hasRoom(code: string): Promise<boolean>;
  getParticipant(code: string, participantId: string): Promise<RoomParticipant | null>;
  setParticipant(code: string, participant: RoomParticipant): Promise<void>;
  listParticipants(code: string): Promise<RoomParticipant[]>;
}

export class RoomHttpError extends Error {
  statusCode: number;

  constructor(statusCode: number, message: string) {
    super(message);
    this.name = 'RoomHttpError';
    this.statusCode = statusCode;
  }
}

export interface CreateRoomInput {
  title?: string;
  areaName?: string;
  topicFilter?: string;
  difficulty?: string;
  questionCount?: number;
  durationPerQuestionSec?: number;
  allowHints?: boolean;
  showPublicLeaderboard?: boolean;
  questionPool?: RoomQuestion[];
}

export function normalizeRoomCode(raw: string): string {
  return String(raw || '').toUpperCase().trim();
}

async function generateUniqueRoomCode(store: RoomStore): Promise<string> {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  for (let attempt = 0; attempt < 15; attempt++) {
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
    if (!(await store.hasRoom(code))) return code;
  }
  throw new RoomHttpError(500, 'Gagal menghasilkan kode kelas unik. Silakan coba lagi.');
}

export function assignParallelQuestions(room: BattleRoomMeta, participantIndex: number): string[] {
  const pool = [...room.questionPool];
  const n = pool.length;
  if (n === 0) return [];
  const count = Math.min(room.questionCount, n);
  const offset = (participantIndex * Math.max(1, Math.floor(n / 3))) % n;
  const chosen: string[] = [];
  for (let i = 0; i < count; i++) {
    chosen.push(pool[(offset + i) % n].id);
  }
  return chosen;
}

export function checkServerAnswer(q: RoomQuestion, answerRaw: string): boolean {
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

function sanitizeQuestionPool(pool: RoomQuestion[]): RoomQuestion[] {
  return pool.slice(0, 60).map((q, idx) => ({
    id: String(q.id || `rq-${idx}`),
    topic: String(q.topic || 'Matematika'),
    indicator: String(q.indicator || ''),
    difficulty: (['mudah', 'sedang', 'sulit'].includes(String(q.difficulty))
      ? q.difficulty
      : 'sedang') as RoomQuestion['difficulty'],
    type: (['pilihan_ganda', 'benar_salah', 'isian', 'uraian'].includes(String(q.type))
      ? q.type
      : 'pilihan_ganda') as RoomQuestion['type'],
    prompt: String(q.prompt || ''),
    options: Array.isArray(q.options) ? q.options.map(String) : undefined,
    correctAnswer: String(q.correctAnswer || ''),
    acceptedAlternatives: Array.isArray(q.acceptedAlternatives)
      ? q.acceptedAlternatives.map(String)
      : undefined,
    numericValue: typeof q.numericValue === 'number' && Number.isFinite(q.numericValue) ? q.numericValue : undefined,
    unit: typeof q.unit === 'string' && q.unit ? q.unit : undefined,
    explanation: String(q.explanation || ''),
  }));
}

export function serializeRoomSnapshot(
  room: BattleRoomMeta,
  participants: RoomParticipant[],
  targetParticipant?: RoomParticipant | null
) {
  const participantsList = participants
    .map((p) => ({
      id: p.id,
      name: p.name,
      heroId: p.heroId,
      score: p.score,
      correctCount: p.correctCount,
      answeredCount: p.answeredCount,
      connected: p.connected,
    }))
    .sort((a, b) => b.score - a.score);

  let myQuestions: Array<Omit<RoomQuestion, 'correctAnswer' | 'acceptedAlternatives' | 'numericValue'>> = [];
  if (targetParticipant) {
    const ids =
      targetParticipant.assignedQuestionIds.length > 0
        ? targetParticipant.assignedQuestionIds
        : room.status === 'ACTIVE'
        ? assignParallelQuestions(room, targetParticipant.joinedOrder)
        : [];
    myQuestions = ids
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
    participants: participantsList,
    myQuestions,
  };
}

export async function createRoomSession(store: RoomStore, input: CreateRoomInput) {
  const rawPool = Array.isArray(input?.questionPool) ? input.questionPool : [];
  if (rawPool.length === 0) {
    throw new RoomHttpError(400, 'Paket soal untuk sesi kelas kosong.');
  }

  const questionPool = sanitizeQuestionPool(rawPool);
  const code = await generateUniqueRoomCode(store);
  const meta: BattleRoomMeta = {
    code,
    title: input.title || 'Pertarungan Kelas Matematika',
    areaName: input.areaName || 'Arena Kelas',
    topicFilter: input.topicFilter || 'ALL',
    difficulty: input.difficulty || 'campuran',
    questionCount: Math.min(Math.max(Number(input.questionCount) || 5, 1), questionPool.length),
    durationPerQuestionSec: Math.max(Number(input.durationPerQuestionSec) || 45, 10),
    allowHints: Boolean(input.allowHints),
    showPublicLeaderboard: input.showPublicLeaderboard !== false,
    status: 'LOBBY',
    createdAt: new Date().toISOString(),
    startedAtMs: null,
    questionPool,
  };

  await store.setRoomMeta(meta);
  return serializeRoomSnapshot(meta, []);
}

export async function getRoomSessionSnapshot(
  store: RoomStore,
  rawCode: string,
  participantId?: string
) {
  const code = normalizeRoomCode(rawCode);
  const meta = await store.getRoomMeta(code);
  if (!meta) {
    throw new RoomHttpError(404, 'Kode kelas tidak ditemukan atau sesi sudah berakhir.');
  }

  const participants = await store.listParticipants(code);
  let targetParticipant: RoomParticipant | null = participantId
    ? participants.find((p) => p.id === participantId) || (await store.getParticipant(code, participantId))
    : null;

  if (targetParticipant && meta.status === 'ACTIVE' && targetParticipant.assignedQuestionIds.length === 0) {
    targetParticipant = {
      ...targetParticipant,
      assignedQuestionIds: assignParallelQuestions(meta, targetParticipant.joinedOrder),
    };
    await store.setParticipant(code, targetParticipant);
  }

  return serializeRoomSnapshot(meta, participants, targetParticipant);
}

export async function joinRoomSession(
  store: RoomStore,
  rawCode: string,
  body: { name?: string; heroId?: string }
) {
  const code = normalizeRoomCode(rawCode);
  const meta = await store.getRoomMeta(code);
  if (!meta) {
    throw new RoomHttpError(404, 'Kode kelas tidak ditemukan.');
  }
  if (meta.status === 'ENDED') {
    throw new RoomHttpError(400, 'Sesi kelas ini sudah selesai.');
  }

  const cleanName = String(body?.name || '').trim().slice(0, 32);
  if (!cleanName) {
    throw new RoomHttpError(400, 'Masukkan nama panggilan terlebih dahulu.');
  }

  const existingParticipants = await store.listParticipants(code);
  const pIndex = existingParticipants.length;
  const pid = `p-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const assignedQuestionIds = meta.status === 'ACTIVE' ? assignParallelQuestions(meta, pIndex) : [];

  const participant: RoomParticipant = {
    id: pid,
    name: cleanName,
    heroId: body?.heroId || 'ksatria',
    score: 0,
    correctCount: 0,
    answeredCount: 0,
    answeredIds: [],
    assignedQuestionIds,
    joinedOrder: pIndex,
    connected: true,
  };

  await store.setParticipant(code, participant);
  const allParticipants = [...existingParticipants, participant];

  return {
    participantId: pid,
    room: serializeRoomSnapshot(meta, allParticipants, participant),
  };
}

export async function startRoomSession(store: RoomStore, rawCode: string) {
  const code = normalizeRoomCode(rawCode);
  const meta = await store.getRoomMeta(code);
  if (!meta) {
    throw new RoomHttpError(404, 'Ruang kelas tidak ditemukan.');
  }

  const updatedMeta: BattleRoomMeta = {
    ...meta,
    status: 'ACTIVE',
    startedAtMs: meta.startedAtMs ?? Date.now(),
  };
  await store.setRoomMeta(updatedMeta);

  const participants = await store.listParticipants(code);
  const updatedParticipants = await Promise.all(
    participants.map(async (p, idx) => {
      if (p.assignedQuestionIds.length > 0) return p;
      const nextP: RoomParticipant = {
        ...p,
        assignedQuestionIds: assignParallelQuestions(updatedMeta, p.joinedOrder ?? idx),
      };
      await store.setParticipant(code, nextP);
      return nextP;
    })
  );

  return serializeRoomSnapshot(updatedMeta, updatedParticipants);
}

export async function submitRoomAnswer(
  store: RoomStore,
  rawCode: string,
  body: { participantId?: string; questionId?: string; answer?: string }
) {
  const code = normalizeRoomCode(rawCode);
  const meta = await store.getRoomMeta(code);
  if (!meta) {
    throw new RoomHttpError(404, 'Ruang kelas tidak ditemukan.');
  }
  if (meta.status !== 'ACTIVE') {
    throw new RoomHttpError(400, 'Pertandingan belum dimulai atau sudah selesai.');
  }

  const participantId = String(body?.participantId || '').trim();
  const questionId = String(body?.questionId || '').trim();
  const participant = await store.getParticipant(code, participantId);
  if (!participant) {
    throw new RoomHttpError(404, 'Peserta tidak ditemukan.');
  }

  if (participant.answeredIds.includes(questionId)) {
    throw new RoomHttpError(409, 'Soal ini sudah dijawab sebelumnya.');
  }

  const question = meta.questionPool.find((q) => q.id === questionId);
  if (!question) {
    throw new RoomHttpError(404, 'Soal tidak ditemukan.');
  }

  const isCorrect = checkServerAnswer(question, body?.answer || '');
  const diffMult = question.difficulty === 'sulit' ? 1.5 : question.difficulty === 'sedang' ? 1.2 : 1;
  const nextParticipant: RoomParticipant = {
    ...participant,
    answeredIds: [...participant.answeredIds, questionId],
    answeredCount: participant.answeredCount + 1,
    score: isCorrect ? participant.score + Math.round(100 * diffMult) : participant.score,
    correctCount: isCorrect ? participant.correctCount + 1 : participant.correctCount,
  };

  await store.setParticipant(code, nextParticipant);

  return {
    isCorrect,
    correctAnswer: question.correctAnswer,
    explanation: question.explanation,
    score: nextParticipant.score,
    correctCount: nextParticipant.correctCount,
  };
}

export async function endRoomSession(store: RoomStore, rawCode: string) {
  const code = normalizeRoomCode(rawCode);
  const meta = await store.getRoomMeta(code);
  if (!meta) {
    throw new RoomHttpError(404, 'Ruang kelas tidak ditemukan.');
  }

  const updatedMeta: BattleRoomMeta = {
    ...meta,
    status: 'ENDED',
  };
  await store.setRoomMeta(updatedMeta);
  const participants = await store.listParticipants(code);
  return serializeRoomSnapshot(updatedMeta, participants);
}
