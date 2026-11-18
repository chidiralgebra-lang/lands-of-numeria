import { User } from 'firebase/auth';
import {
  Unsubscribe,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import {
  OperationType,
  db,
  handleFirestoreError,
  isTeacherAdminUser,
} from '../firebase';
import {
  AreaDef,
  AttemptRecord,
  Difficulty,
  GameSettings,
  HeroDef,
  HeroId,
  MonsterDef,
  OnlineRoomSummary,
  Question,
} from '../types/game';
import { SiteConfigPayload, SiteConfigResponse } from './siteSync';

const GLOBAL_CONFIG_PATH = 'gameConfig/global';

function stripUndefined<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => stripUndefined(item)) as unknown as T;
  }
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (v !== undefined) {
        out[k] = stripUndefined(v);
      }
    }
    return out as T;
  }
  return value;
}

function sanitizeDocId(raw: string, fallbackPrefix: string): string {
  const cleaned = String(raw || '')
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, '')
    .slice(0, 128);
  return cleaned || `${fallbackPrefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export async function ensureUserProfile(user: User): Promise<void> {
  if (!user || !user.emailVerified) return;
  const uid = sanitizeDocId(user.uid, 'user');
  const path = `users/${uid}`;
  const ref = doc(db, 'users', uid);

  try {
    const snap = await getDoc(ref);
    const email = String(user.email || 'user@example.com').slice(0, 200);
    const displayName = String(user.displayName || email.split('@')[0] || 'Pengguna')
      .trim()
      .slice(0, 100) || 'Pengguna';
    const role = isTeacherAdminUser(user) ? 'teacher' : 'student';

    if (!snap.exists()) {
      await setDoc(ref, {
        uid,
        email,
        displayName,
        role,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      const existing = snap.data();
      if (existing.displayName !== displayName || existing.email !== email) {
        await updateDoc(ref, {
          displayName,
          email,
          updatedAt: serverTimestamp(),
        });
      }
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function fetchTeacherPrivatePin(user: User): Promise<string | null> {
  if (!isTeacherAdminUser(user)) return null;
  const uid = sanitizeDocId(user.uid, 'user');
  const path = `teacherPrivate/${uid}`;
  try {
    const snap = await getDoc(doc(db, 'teacherPrivate', uid));
    if (!snap.exists()) return null;
    const data = snap.data();
    return typeof data.teacherPin === 'string' ? data.teacherPin : null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export async function fetchFirebaseConfig(): Promise<SiteConfigResponse> {
  const ref = doc(db, 'gameConfig', 'global');
  try {
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      return { hasConfig: false, config: null };
    }
    const data = snap.data();
    return {
      hasConfig: true,
      config: {
        version: typeof data.version === 'number' ? data.version : 1,
        updatedAt: typeof data.updatedAt === 'string' ? data.updatedAt : new Date().toISOString(),
        questions: Array.isArray(data.questions) ? (data.questions as Question[]) : [],
        areas: Array.isArray(data.areas) ? (data.areas as AreaDef[]) : [],
        heroes: Array.isArray(data.heroes) ? (data.heroes as HeroDef[]) : [],
        monsters:
          data.monsters && typeof data.monsters === 'object'
            ? (data.monsters as Record<string, MonsterDef>)
            : {},
        settings: (data.settings || {}) as GameSettings,
      },
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, GLOBAL_CONFIG_PATH);
  }
}

export function subscribeFirebaseConfig(
  onConfig: (res: SiteConfigResponse) => void,
  onError?: (err: unknown) => void
): Unsubscribe {
  const ref = doc(db, 'gameConfig', 'global');
  return onSnapshot(
    ref,
    (snap) => {
      if (!snap.exists()) {
        onConfig({ hasConfig: false, config: null });
        return;
      }
      const data = snap.data();
      onConfig({
        hasConfig: true,
        config: {
          version: typeof data.version === 'number' ? data.version : 1,
          updatedAt: typeof data.updatedAt === 'string' ? data.updatedAt : new Date().toISOString(),
          questions: Array.isArray(data.questions) ? (data.questions as Question[]) : [],
          areas: Array.isArray(data.areas) ? (data.areas as AreaDef[]) : [],
          heroes: Array.isArray(data.heroes) ? (data.heroes as HeroDef[]) : [],
          monsters:
            data.monsters && typeof data.monsters === 'object'
              ? (data.monsters as Record<string, MonsterDef>)
              : {},
          settings: (data.settings || {}) as GameSettings,
        },
      });
    },
    (error) => {
      if (onError) {
        onError(error);
      } else {
        handleFirestoreError(error, OperationType.GET, GLOBAL_CONFIG_PATH);
      }
    }
  );
}

export async function publishFirebaseConfig(
  payload: Omit<SiteConfigPayload, 'version' | 'updatedAt'>,
  user: User
): Promise<SiteConfigResponse> {
  if (!isTeacherAdminUser(user)) {
    throw new Error('Hanya akun Google Guru Pemilik yang dapat mempublikasikan konfigurasi ke cloud.');
  }

  const uid = sanitizeDocId(user.uid, 'admin');
  const ref = doc(db, 'gameConfig', 'global');

  let currentVersion = 0;
  try {
    const existing = await getDoc(ref);
    if (existing.exists()) {
      const v = existing.data().version;
      if (typeof v === 'number' && Number.isFinite(v)) {
        currentVersion = Math.trunc(v);
      }
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, GLOBAL_CONFIG_PATH);
  }

  const { teacherPin, ...publicSettings } = payload.settings;
  const nowIso = new Date().toISOString().slice(0, 40);
  const nextVersion = Math.max(1, currentVersion + 1);

  const sanitizedQuestions = stripUndefined(payload.questions).slice(0, 500);
  const sanitizedAreas = stripUndefined(payload.areas).slice(0, 50);
  const sanitizedHeroes = stripUndefined(payload.heroes).slice(0, 20);
  const sanitizedMonsters = stripUndefined(payload.monsters);
  const sanitizedPublicSettings = stripUndefined(publicSettings);

  try {
    await setDoc(ref, {
      version: nextVersion,
      updatedAt: nowIso,
      serverUpdatedAt: serverTimestamp(),
      updatedByUid: uid,
      questions: sanitizedQuestions,
      areas: sanitizedAreas,
      heroes: sanitizedHeroes,
      monsters: sanitizedMonsters,
      settings: sanitizedPublicSettings,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, GLOBAL_CONFIG_PATH);
  }

  const privatePath = `teacherPrivate/${uid}`;
  try {
    await setDoc(doc(db, 'teacherPrivate', uid), {
      ownerUid: uid,
      teacherPin: String(teacherPin || '').slice(0, 8),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, privatePath);
  }

  return {
    hasConfig: true,
    config: {
      version: nextVersion,
      updatedAt: nowIso,
      questions: sanitizedQuestions,
      areas: sanitizedAreas,
      heroes: sanitizedHeroes,
      monsters: sanitizedMonsters,
      settings: payload.settings,
    },
  };
}

export async function pushFirebaseAttempt(attempt: AttemptRecord, user: User): Promise<void> {
  if (!user || !user.emailVerified) {
    throw new Error('Akun Google belum terverifikasi untuk menyimpan hasil ke cloud.');
  }

  const id = sanitizeDocId(attempt.id, 'att');
  const ownerUid = sanitizeDocId(user.uid, 'user');
  const path = `attempts/${id}`;

  const docPayload = {
    id,
    ownerUid,
    studentName: String(attempt.studentName || 'Petualang').trim().slice(0, 100) || 'Petualang',
    className: String(attempt.className || 'Umum').trim().slice(0, 80) || 'Umum',
    mode:
      attempt.mode === 'solo' || attempt.mode === 'local_team' || attempt.mode === 'online_class'
        ? attempt.mode
        : 'solo',
    areaId: String(attempt.areaId || '').slice(0, 100),
    areaName: String(attempt.areaName || 'Pulau Numeria').trim().slice(0, 120) || 'Pulau Numeria',
    levelId: String(attempt.levelId || '').slice(0, 100),
    levelName: String(attempt.levelName || 'Misi Matematika').trim().slice(0, 140) || 'Misi Matematika',
    heroId: String(attempt.heroId || 'ksatria').slice(0, 60) || 'ksatria',
    dateIso: String(attempt.dateIso || new Date().toISOString()).slice(0, 40),
    durationSec: Math.min(86400, Math.max(0, Number(attempt.durationSec) || 0)),
    totalQuestions: Math.min(200, Math.max(0, Math.trunc(Number(attempt.totalQuestions) || 0))),
    correctCount: Math.min(200, Math.max(0, Math.trunc(Number(attempt.correctCount) || 0))),
    wrongCount: Math.min(200, Math.max(0, Math.trunc(Number(attempt.wrongCount) || 0))),
    unansweredCount: Math.min(200, Math.max(0, Math.trunc(Number(attempt.unansweredCount) || 0))),
    gameScore: Math.min(1000000, Math.max(0, Number(attempt.gameScore) || 0)),
    academicMasteryPct: Math.min(100, Math.max(0, Number(attempt.academicMasteryPct) || 0)),
    xpEarned: Math.min(100000, Math.max(0, Number(attempt.xpEarned) || 0)),
    coinsEarned: Math.min(100000, Math.max(0, Number(attempt.coinsEarned) || 0)),
    wonBattle: Boolean(attempt.wonBattle),
    indicatorStats: stripUndefined(attempt.indicatorStats || []).slice(0, 100),
    questionLogs: stripUndefined(attempt.questionLogs || []).slice(0, 200),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  try {
    await setDoc(doc(db, 'attempts', id), docPayload);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

function docToAttemptRecord(data: Record<string, unknown>): AttemptRecord {
  return {
    id: String(data.id || ''),
    studentName: String(data.studentName || 'Petualang'),
    className: String(data.className || 'Umum'),
    mode:
      data.mode === 'solo' || data.mode === 'local_team' || data.mode === 'online_class'
        ? data.mode
        : 'solo',
    areaId: String(data.areaId || ''),
    areaName: String(data.areaName || 'Pulau Numeria'),
    levelId: String(data.levelId || ''),
    levelName: String(data.levelName || 'Misi Matematika'),
    heroId: (String(data.heroId || 'ksatria') as HeroId),
    dateIso: String(data.dateIso || new Date().toISOString()),
    durationSec: Number(data.durationSec) || 0,
    totalQuestions: Number(data.totalQuestions) || 0,
    correctCount: Number(data.correctCount) || 0,
    wrongCount: Number(data.wrongCount) || 0,
    unansweredCount: Number(data.unansweredCount) || 0,
    gameScore: Number(data.gameScore) || 0,
    academicMasteryPct: Number(data.academicMasteryPct) || 0,
    xpEarned: Number(data.xpEarned) || 0,
    coinsEarned: Number(data.coinsEarned) || 0,
    wonBattle: Boolean(data.wonBattle),
    indicatorStats: Array.isArray(data.indicatorStats)
      ? (data.indicatorStats as AttemptRecord['indicatorStats'])
      : [],
    questionLogs: Array.isArray(data.questionLogs)
      ? (data.questionLogs as AttemptRecord['questionLogs'])
      : [],
  };
}

export async function fetchFirebaseAttempts(user: User): Promise<AttemptRecord[]> {
  if (!user || !user.emailVerified) return [];
  const admin = isTeacherAdminUser(user);
  const colRef = collection(db, 'attempts');
  const q = admin
    ? query(colRef, orderBy('dateIso', 'desc'), limit(250))
    : query(colRef, where('ownerUid', '==', sanitizeDocId(user.uid, 'user')));

  try {
    const snap = await getDocs(q);
    return snap.docs
      .map((d) => docToAttemptRecord(d.data()))
      .sort((a, b) => (Date.parse(b.dateIso || '') || 0) - (Date.parse(a.dateIso || '') || 0));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'attempts');
  }
}

export function subscribeFirebaseAttempts(
  user: User,
  onData: (attempts: AttemptRecord[]) => void,
  onError?: (err: unknown) => void
): Unsubscribe {
  const admin = isTeacherAdminUser(user);
  const colRef = collection(db, 'attempts');
  const q = admin
    ? query(colRef, orderBy('dateIso', 'desc'), limit(250))
    : query(colRef, where('ownerUid', '==', sanitizeDocId(user.uid, 'user')));

  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs
        .map((d) => docToAttemptRecord(d.data()))
        .sort((a, b) => (Date.parse(b.dateIso || '') || 0) - (Date.parse(a.dateIso || '') || 0));
      onData(list);
    },
    (error) => {
      if (onError) {
        onError(error);
      } else {
        handleFirestoreError(error, OperationType.LIST, 'attempts');
      }
    }
  );
}

export async function updateFirebaseAttemptReview(
  attempt: AttemptRecord,
  user: User
): Promise<void> {
  if (!isTeacherAdminUser(user)) return;
  const id = sanitizeDocId(attempt.id, 'att');
  const path = `attempts/${id}`;
  try {
    await updateDoc(doc(db, 'attempts', id), {
      questionLogs: stripUndefined(attempt.questionLogs || []).slice(0, 200),
      correctCount: Math.min(200, Math.max(0, Math.trunc(Number(attempt.correctCount) || 0))),
      academicMasteryPct: Math.min(100, Math.max(0, Number(attempt.academicMasteryPct) || 0)),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteFirebaseAttempt(attemptId: string, user: User): Promise<void> {
  if (!isTeacherAdminUser(user)) return;
  const id = sanitizeDocId(attemptId, 'att');
  const path = `attempts/${id}`;
  try {
    await deleteDoc(doc(db, 'attempts', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function clearAllFirebaseAttempts(user: User): Promise<void> {
  if (!isTeacherAdminUser(user)) return;
  try {
    const snap = await getDocs(collection(db, 'attempts'));
    const docs = snap.docs;
    for (let i = 0; i < docs.length; i += 400) {
      const batch = writeBatch(db);
      docs.slice(i, i + 400).forEach((d) => batch.delete(d.ref));
      await batch.commit();
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, 'attempts');
  }
}

// ==================== ONLINE CLASSROOM FIRESTORE SYNC ====================

export interface FirestoreRoomQuestion {
  id: string;
  topic: string;
  indicator: string;
  difficulty: 'mudah' | 'sedang' | 'sulit';
  type: Question['type'];
  prompt: string;
  options?: string[];
  correctAnswer: string;
  acceptedAlternatives?: string[];
  numericValue?: number;
  unit?: string;
  explanation: string;
}

export interface FirestoreRoomDoc {
  code: string;
  ownerUid: string;
  title: string;
  areaName: string;
  topicFilter: string;
  difficulty: Difficulty | 'campuran';
  questionCount: number;
  durationPerQuestionSec: number;
  allowHints: boolean;
  showPublicLeaderboard: boolean;
  status: 'LOBBY' | 'ACTIVE' | 'ENDED';
  createdAt: string;
  startedAtMs: number | null;
  questionPool: FirestoreRoomQuestion[];
}

export interface FirestoreParticipantDoc {
  id: string;
  ownerUid: string;
  name: string;
  heroId: HeroId;
  score: number;
  correctCount: number;
  answeredCount: number;
  answeredIds: string[];
  assignedQuestionIds: string[];
  joinedOrder: number;
  connected: boolean;
  roomPublic: boolean;
}

export function assignParallelQuestions(
  pool: FirestoreRoomQuestion[],
  questionCount: number,
  joinedOrder: number
): string[] {
  const n = pool.length;
  if (n === 0) return [];
  const count = Math.min(questionCount, n);
  const offset = (joinedOrder * Math.max(1, Math.floor(n / 3))) % n;
  const chosen: string[] = [];
  for (let i = 0; i < count; i++) {
    chosen.push(pool[(offset + i) % n].id);
  }
  return chosen;
}

export function checkRoomAnswer(q: FirestoreRoomQuestion, answerRaw: string): boolean {
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

export async function createFirestoreClassroom(
  input: {
    title: string;
    areaName: string;
    topicFilter: string;
    difficulty: Difficulty | 'campuran';
    questionCount: number;
    durationPerQuestionSec: number;
    allowHints: boolean;
    showPublicLeaderboard: boolean;
    questionPool: Question[];
  },
  user: User
): Promise<OnlineRoomSummary> {
  if (!isTeacherAdminUser(user)) {
    throw new Error('Hanya akun Google Guru Pemilik yang dapat membuat ruang kelas di cloud.');
  }
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let attempt = 0; attempt < 10; attempt++) {
    let candidate = '';
    for (let i = 0; i < 6; i++) {
      candidate += chars[Math.floor(Math.random() * chars.length)];
    }
    const existing = await getDoc(doc(db, 'classRooms', candidate));
    if (!existing.exists()) {
      code = candidate;
      break;
    }
  }
  if (!code) {
    throw new Error('Gagal menghasilkan kode sesi kelas unik. Silakan coba lagi.');
  }

  const sanitizedPool: FirestoreRoomQuestion[] = stripUndefined(
    input.questionPool.slice(0, 60).map((q, idx) => ({
      id: String(q.id || `rq-${idx}`),
      topic: String(q.topic || 'Matematika'),
      indicator: String(q.indicator || ''),
      difficulty: q.difficulty,
      type: q.type,
      prompt: String(q.prompt || ''),
      ...(Array.isArray(q.options) ? { options: q.options.map(String) } : {}),
      correctAnswer: String(q.correctAnswer || ''),
      ...(Array.isArray(q.acceptedAlternatives)
        ? { acceptedAlternatives: q.acceptedAlternatives.map(String) }
        : {}),
      ...(typeof q.numericValue === 'number' && Number.isFinite(q.numericValue)
        ? { numericValue: q.numericValue }
        : {}),
      ...(typeof q.unit === 'string' && q.unit ? { unit: q.unit } : {}),
      explanation: String(q.explanation || ''),
    }))
  );

  const createdAt = new Date().toISOString().slice(0, 40);
  const ownerUid = sanitizeDocId(user.uid, 'admin');
  const qCount = Math.min(Math.max(Math.trunc(input.questionCount) || 5, 1), sanitizedPool.length);
  const durationSec = Math.min(300, Math.max(10, Math.trunc(input.durationPerQuestionSec) || 45));

  const payload = {
    code,
    ownerUid,
    title: String(input.title || 'Kuis Matematika Kelas').trim().slice(0, 120) || 'Kuis Matematika Kelas',
    areaName: String(input.areaName || 'Semua Topik').trim().slice(0, 120) || 'Semua Topik',
    topicFilter: String(input.topicFilter || 'ALL').trim().slice(0, 120) || 'ALL',
    difficulty: String(input.difficulty || 'campuran').slice(0, 30),
    questionCount: qCount,
    durationPerQuestionSec: durationSec,
    allowHints: Boolean(input.allowHints),
    showPublicLeaderboard: input.showPublicLeaderboard !== false,
    status: 'LOBBY' as const,
    createdAt,
    startedAtMs: null,
    questionPool: sanitizedPool,
    serverCreatedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  try {
    await setDoc(doc(db, 'classRooms', code), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `classRooms/${code}`);
  }

  return {
    code,
    title: payload.title,
    areaName: payload.areaName,
    topicFilter: payload.topicFilter,
    difficulty: input.difficulty,
    questionCount: qCount,
    durationPerQuestionSec: durationSec,
    allowHints: payload.allowHints,
    showPublicLeaderboard: payload.showPublicLeaderboard,
    status: 'LOBBY',
    createdAt,
    participants: [],
  };
}

export function subscribeFirestoreRoomTeacher(
  code: string,
  onUpdate: (summary: OnlineRoomSummary) => void,
  onError?: (err: unknown) => void
): Unsubscribe {
  let latestRoom: FirestoreRoomDoc | null = null;
  let latestParticipants: FirestoreParticipantDoc[] = [];

  const emit = () => {
    if (!latestRoom) return;
    onUpdate({
      code: latestRoom.code,
      title: latestRoom.title,
      areaName: latestRoom.areaName,
      topicFilter: latestRoom.topicFilter,
      difficulty: latestRoom.difficulty,
      questionCount: latestRoom.questionCount,
      durationPerQuestionSec: latestRoom.durationPerQuestionSec,
      allowHints: latestRoom.allowHints,
      showPublicLeaderboard: latestRoom.showPublicLeaderboard,
      status: latestRoom.status,
      createdAt: latestRoom.createdAt,
      participants: [...latestParticipants]
        .sort((a, b) => b.score - a.score)
        .map((p) => ({
          id: p.id,
          name: p.name,
          heroId: p.heroId,
          score: p.score,
          correctCount: p.correctCount,
          answeredCount: p.answeredCount,
          connected: p.connected,
        })),
    });
  };

  const unsubRoom = onSnapshot(
    doc(db, 'classRooms', code),
    (snap) => {
      if (snap.exists()) {
        latestRoom = snap.data() as FirestoreRoomDoc;
        emit();
      }
    },
    (err) => onError?.(err)
  );

  const unsubPart = onSnapshot(
    collection(db, 'classRooms', code, 'participants'),
    (snap) => {
      latestParticipants = snap.docs.map((d) => d.data() as FirestoreParticipantDoc);
      emit();
    },
    (err) => onError?.(err)
  );

  return () => {
    unsubRoom();
    unsubPart();
  };
}

export async function startFirestoreClassroom(code: string): Promise<void> {
  const path = `classRooms/${code}`;
  try {
    await updateDoc(doc(db, 'classRooms', code), {
      status: 'ACTIVE',
      startedAtMs: Date.now(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function endFirestoreClassroom(code: string): Promise<void> {
  const path = `classRooms/${code}`;
  try {
    await updateDoc(doc(db, 'classRooms', code), {
      status: 'ENDED',
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function joinFirestoreClassroom(
  rawCode: string,
  name: string,
  heroId: HeroId,
  user: User
): Promise<{ room: FirestoreRoomDoc; participant: FirestoreParticipantDoc }> {
  if (!user || !user.emailVerified) {
    throw new Error('Silakan masuk dengan akun Google Anda untuk bergabung ke kelas.');
  }
  const code = rawCode.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!code || code.length < 4 || code.length > 12) {
    throw new Error('Format kode kelas tidak valid.');
  }

  const roomRef = doc(db, 'classRooms', code);
  let roomSnap;
  try {
    roomSnap = await getDoc(roomRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, `classRooms/${code}`);
  }
  if (!roomSnap.exists()) {
    throw new Error('Kode kelas tidak ditemukan. Periksa kembali kode dari guru Anda.');
  }

  const room = roomSnap.data() as FirestoreRoomDoc;
  if (room.status === 'ENDED') {
    throw new Error('Sesi kelas ini sudah selesai.');
  }

  const uid = sanitizeDocId(user.uid, 'student');
  const partRef = doc(db, 'classRooms', code, 'participants', uid);
  const existingPart = await getDoc(partRef);
  if (existingPart.exists()) {
    return {
      room,
      participant: existingPart.data() as FirestoreParticipantDoc,
    };
  }

  const cleanName = name.trim().slice(0, 32) || 'Siswa';
  const joinedOrder = Math.floor(Math.random() * 100);
  const assignedQuestionIds = assignParallelQuestions(
    room.questionPool || [],
    room.questionCount,
    joinedOrder
  );

  const partPayload = {
    id: uid,
    ownerUid: uid,
    name: cleanName,
    heroId,
    score: 0,
    correctCount: 0,
    answeredCount: 0,
    answeredIds: [] as string[],
    assignedQuestionIds,
    joinedOrder,
    connected: true,
    roomPublic: Boolean(room.showPublicLeaderboard),
    joinedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  try {
    await setDoc(partRef, partPayload);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `classRooms/${code}/participants/${uid}`);
  }

  return {
    room,
    participant: {
      id: uid,
      ownerUid: uid,
      name: cleanName,
      heroId,
      score: 0,
      correctCount: 0,
      answeredCount: 0,
      answeredIds: [],
      assignedQuestionIds,
      joinedOrder,
      connected: true,
      roomPublic: Boolean(room.showPublicLeaderboard),
    },
  };
}

export function subscribeFirestoreRoomStudent(
  code: string,
  participantUid: string,
  showPublicLeaderboard: boolean,
  onUpdate: (data: {
    room: FirestoreRoomDoc;
    me: FirestoreParticipantDoc | null;
    participants: FirestoreParticipantDoc[];
  }) => void,
  onError?: (err: unknown) => void
): Unsubscribe {
  let latestRoom: FirestoreRoomDoc | null = null;
  let latestMe: FirestoreParticipantDoc | null = null;
  let latestParticipants: FirestoreParticipantDoc[] = [];

  const emit = () => {
    if (!latestRoom) return;
    const list =
      latestParticipants.length > 0
        ? latestParticipants
        : latestMe
        ? [latestMe]
        : [];
    onUpdate({
      room: latestRoom,
      me: latestMe || list.find((p) => p.id === participantUid) || null,
      participants: [...list].sort((a, b) => b.score - a.score),
    });
  };

  const unsubRoom = onSnapshot(
    doc(db, 'classRooms', code),
    (snap) => {
      if (snap.exists()) {
        latestRoom = snap.data() as FirestoreRoomDoc;
        emit();
      }
    },
    (err) => onError?.(err)
  );

  const unsubMeOrList = showPublicLeaderboard
    ? onSnapshot(
        collection(db, 'classRooms', code, 'participants'),
        (snap) => {
          latestParticipants = snap.docs.map((d) => d.data() as FirestoreParticipantDoc);
          latestMe = latestParticipants.find((p) => p.id === participantUid) || null;
          emit();
        },
        (err) => onError?.(err)
      )
    : onSnapshot(
        doc(db, 'classRooms', code, 'participants', participantUid),
        (snap) => {
          if (snap.exists()) {
            latestMe = snap.data() as FirestoreParticipantDoc;
            latestParticipants = [latestMe];
            emit();
          }
        },
        (err) => onError?.(err)
      );

  return () => {
    unsubRoom();
    unsubMeOrList();
  };
}

export async function submitFirestoreRoomAnswer(
  code: string,
  participant: FirestoreParticipantDoc,
  question: FirestoreRoomQuestion,
  answerRaw: string
): Promise<{
  isCorrect: boolean;
  correctAnswer: string;
  explanation: string;
  updatedParticipant: FirestoreParticipantDoc;
}> {
  if (participant.answeredIds.includes(question.id)) {
    throw new Error('Soal ini sudah dijawab sebelumnya.');
  }
  const isCorrect = checkRoomAnswer(question, answerRaw);
  const diffMult =
    question.difficulty === 'sulit' ? 1.5 : question.difficulty === 'sedang' ? 1.2 : 1;
  const nextScore = isCorrect
    ? participant.score + Math.round(100 * diffMult)
    : participant.score;
  const nextCorrectCount = isCorrect ? participant.correctCount + 1 : participant.correctCount;
  const nextAnsweredCount = participant.answeredCount + 1;
  const nextAnsweredIds = [...participant.answeredIds, question.id];

  const path = `classRooms/${code}/participants/${participant.id}`;
  try {
    await updateDoc(doc(db, 'classRooms', code, 'participants', participant.id), {
      score: nextScore,
      correctCount: nextCorrectCount,
      answeredCount: nextAnsweredCount,
      answeredIds: nextAnsweredIds,
      assignedQuestionIds: participant.assignedQuestionIds,
      connected: true,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }

  return {
    isCorrect,
    correctAnswer: question.correctAnswer,
    explanation: question.explanation,
    updatedParticipant: {
      ...participant,
      score: nextScore,
      correctCount: nextCorrectCount,
      answeredCount: nextAnsweredCount,
      answeredIds: nextAnsweredIds,
    },
  };
}
