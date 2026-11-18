export interface SiteConfigRecord {
  version: number;
  updatedAt: string;
  questions: unknown[];
  areas: unknown[];
  heroes: unknown[];
  monsters: Record<string, unknown>;
  settings: Record<string, unknown>;
}

export interface SiteAttemptRecord {
  id: string;
  studentName: string;
  className: string;
  mode: 'solo' | 'local_team' | 'online_class';
  areaId: string;
  areaName: string;
  levelId: string;
  levelName: string;
  heroId: string;
  dateIso: string;
  durationSec: number;
  totalQuestions: number;
  correctCount: number;
  wrongCount: number;
  unansweredCount: number;
  gameScore: number;
  academicMasteryPct: number;
  xpEarned: number;
  coinsEarned: number;
  wonBattle: boolean;
  indicatorStats: unknown[];
  questionLogs: unknown[];
}

export interface SiteDataStore {
  getConfig(): Promise<SiteConfigRecord | null>;
  setConfig(config: SiteConfigRecord): Promise<void>;
  deleteConfig(): Promise<void>;
  getAttempt(id: string): Promise<SiteAttemptRecord | null>;
  setAttempt(attempt: SiteAttemptRecord): Promise<void>;
  listAttempts(): Promise<SiteAttemptRecord[]>;
  deleteAttempt(id: string): Promise<void>;
  clearAttempts(): Promise<void>;
}

export class SiteHttpError extends Error {
  statusCode: number;

  constructor(statusCode: number, message: string) {
    super(message);
    this.name = 'SiteHttpError';
    this.statusCode = statusCode;
  }
}

export async function getSiteConfigSnapshot(store: SiteDataStore) {
  const config = await store.getConfig();
  if (!config) {
    return { hasConfig: false as const, config: null };
  }
  return { hasConfig: true as const, config };
}

export async function saveSiteConfigSnapshot(
  store: SiteDataStore,
  input: Partial<SiteConfigRecord>
) {
  if (!input || typeof input !== 'object') {
    throw new SiteHttpError(400, 'Payload konfigurasi tidak valid.');
  }

  const questions = Array.isArray(input.questions) ? input.questions : null;
  const areas = Array.isArray(input.areas) ? input.areas : null;
  const heroes = Array.isArray(input.heroes) ? input.heroes : null;
  const monsters =
    input.monsters && typeof input.monsters === 'object' && !Array.isArray(input.monsters)
      ? (input.monsters as Record<string, unknown>)
      : null;
  const settings =
    input.settings && typeof input.settings === 'object' && !Array.isArray(input.settings)
      ? (input.settings as Record<string, unknown>)
      : null;

  if (!questions || !areas || !heroes || !monsters || !settings) {
    throw new SiteHttpError(
      400,
      'Data konfigurasi guru harus menyertakan bank soal, wilayah, karakter, dan pengaturan.'
    );
  }

  const existing = await store.getConfig();
  const nextConfig: SiteConfigRecord = {
    version: (existing?.version || 0) + 1,
    updatedAt: new Date().toISOString(),
    questions,
    areas,
    heroes,
    monsters,
    settings,
  };

  await store.setConfig(nextConfig);
  return { hasConfig: true as const, config: nextConfig };
}

function sanitizeAttemptId(raw: unknown): string {
  const cleaned = String(raw || '')
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, '');
  return cleaned || `att-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function sanitizeAttemptRecord(input: Partial<SiteAttemptRecord>): SiteAttemptRecord {
  if (!input || typeof input !== 'object') {
    throw new SiteHttpError(400, 'Data hasil permainan tidak valid.');
  }
  const mode =
    input.mode === 'solo' || input.mode === 'local_team' || input.mode === 'online_class'
      ? input.mode
      : 'solo';

  return {
    id: sanitizeAttemptId(input.id),
    studentName: String(input.studentName || 'Petualang').trim().slice(0, 80) || 'Petualang',
    className: String(input.className || 'Umum').trim().slice(0, 60) || 'Umum',
    mode,
    areaId: String(input.areaId || ''),
    areaName: String(input.areaName || 'Pulau Numeria'),
    levelId: String(input.levelId || ''),
    levelName: String(input.levelName || 'Misi Matematika'),
    heroId: String(input.heroId || 'ksatria'),
    dateIso: String(input.dateIso || new Date().toISOString()),
    durationSec: Number(input.durationSec) || 0,
    totalQuestions: Number(input.totalQuestions) || 0,
    correctCount: Number(input.correctCount) || 0,
    wrongCount: Number(input.wrongCount) || 0,
    unansweredCount: Number(input.unansweredCount) || 0,
    gameScore: Number(input.gameScore) || 0,
    academicMasteryPct: Number(input.academicMasteryPct) || 0,
    xpEarned: Number(input.xpEarned) || 0,
    coinsEarned: Number(input.coinsEarned) || 0,
    wonBattle: Boolean(input.wonBattle),
    indicatorStats: Array.isArray(input.indicatorStats) ? input.indicatorStats : [],
    questionLogs: Array.isArray(input.questionLogs) ? input.questionLogs : [],
  };
}

export async function listSiteAttempts(store: SiteDataStore) {
  const items = await store.listAttempts();
  const sorted = [...items].sort((a, b) => {
    const ta = Date.parse(a.dateIso || '') || 0;
    const tb = Date.parse(b.dateIso || '') || 0;
    return tb - ta;
  });
  return { attempts: sorted };
}

export async function saveSiteAttempt(
  store: SiteDataStore,
  input: Partial<SiteAttemptRecord>
) {
  const attempt = sanitizeAttemptRecord(input);
  await store.setAttempt(attempt);
  return { attempt };
}

export async function updateSiteAttempt(
  store: SiteDataStore,
  rawId: string,
  input: Partial<SiteAttemptRecord>
) {
  const id = sanitizeAttemptId(rawId);
  const existing = await store.getAttempt(id);
  const merged = sanitizeAttemptRecord({
    ...(existing || {}),
    ...input,
    id,
  });
  await store.setAttempt(merged);
  return { attempt: merged };
}

export async function deleteSiteAttempt(store: SiteDataStore, rawId: string) {
  const id = sanitizeAttemptId(rawId);
  await store.deleteAttempt(id);
  return { ok: true, id };
}

export async function clearSiteAttempts(store: SiteDataStore) {
  await store.clearAttempts();
  return { ok: true };
}
