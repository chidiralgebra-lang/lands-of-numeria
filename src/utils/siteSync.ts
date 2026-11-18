import { resolveAreaBgImage } from '../data/worldData';
import {
  AreaDef,
  AttemptRecord,
  GameSettings,
  HeroDef,
  MonsterDef,
  Question,
} from '../types/game';
import { getApiUrl } from './api';

export interface SiteConfigPayload {
  version?: number;
  updatedAt?: string;
  questions: Question[];
  areas: AreaDef[];
  heroes: HeroDef[];
  monsters: Record<string, MonsterDef>;
  settings: GameSettings;
}

export interface SiteConfigResponse {
  hasConfig: boolean;
  config: SiteConfigPayload | null;
}

const PENDING_ATTEMPTS_KEY = 'bok_mma_pending_attempts_v1';

function readPendingAttempts(): AttemptRecord[] {
  try {
    const raw = localStorage.getItem(PENDING_ATTEMPTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as AttemptRecord[]) : [];
  } catch {
    return [];
  }
}

function writePendingAttempts(list: AttemptRecord[]): void {
  try {
    if (list.length === 0) {
      localStorage.removeItem(PENDING_ATTEMPTS_KEY);
    } else {
      localStorage.setItem(PENDING_ATTEMPTS_KEY, JSON.stringify(list));
    }
  } catch {
    // Ignore localStorage quota errors
  }
}

export function getPendingAttemptIds(): Set<string> {
  return new Set(readPendingAttempts().map((a) => a.id));
}

export function enqueuePendingAttempt(attempt: AttemptRecord): void {
  const existing = readPendingAttempts().filter((a) => a.id !== attempt.id);
  writePendingAttempts([attempt, ...existing]);
}

export function removePendingAttempt(id: string): void {
  const remaining = readPendingAttempts().filter((a) => a.id !== id);
  writePendingAttempts(remaining);
}

async function parseJsonSafe<T>(res: Response): Promise<T | null> {
  const raw = await res.text();
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function mergeServerSettings(
  local: GameSettings,
  server: Partial<GameSettings>
): GameSettings {
  return {
    ...local,
    timerEnabled: server.timerEnabled ?? local.timerEnabled,
    secondsPerQuestion: server.secondsPerQuestion ?? local.secondsPerQuestion,
    allowHints: server.allowHints ?? local.allowHints,
    allowSecondChance: server.allowSecondChance ?? local.allowSecondChance,
    showExplanationOnWrong: server.showExplanationOnWrong ?? local.showExplanationOnWrong,
    showPublicLeaderboard: server.showPublicLeaderboard ?? local.showPublicLeaderboard,
    baseScore: server.baseScore ?? local.baseScore,
    difficultyBonus: server.difficultyBonus ?? local.difficultyBonus,
    timeBonusEnabled: server.timeBonusEnabled ?? local.timeBonusEnabled,
    unlockAllAreas: server.unlockAllAreas ?? local.unlockAllAreas,
    monsterHpMultiplier: server.monsterHpMultiplier ?? local.monsterHpMultiplier,
    teacherPin: server.teacherPin !== undefined ? server.teacherPin : local.teacherPin,
  };
}

export function normalizeServerAreas(areas: AreaDef[]): AreaDef[] {
  return areas.map((a) => ({
    ...a,
    bgImage: resolveAreaBgImage(a.bgImage),
  }));
}

export async function fetchSiteConfig(): Promise<SiteConfigResponse | null> {
  try {
    const res = await fetch(getApiUrl('/api/site-config'), { cache: 'no-store' });
    if (!res.ok) return null;
    const data = await parseJsonSafe<SiteConfigResponse>(res);
    if (!data || typeof data.hasConfig !== 'boolean') return null;
    return data;
  } catch {
    return null;
  }
}

export async function publishSiteConfig(
  payload: Omit<SiteConfigPayload, 'version' | 'updatedAt'>
): Promise<SiteConfigResponse> {
  const res = await fetch(getApiUrl('/api/site-config'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await parseJsonSafe<SiteConfigResponse & { error?: string }>(res);
  if (!res.ok || !data) {
    throw new Error(
      data?.error ||
        'Gagal menyimpan konfigurasi guru ke server Netlify. Pastikan Netlify Functions aktif.'
    );
  }
  return data;
}

export async function pushSiteAttempt(attempt: AttemptRecord): Promise<boolean> {
  try {
    const res = await fetch(getApiUrl('/api/site-attempts'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(attempt),
    });
    if (!res.ok) {
      enqueuePendingAttempt(attempt);
      return false;
    }
    const data = await parseJsonSafe<{ attempt?: AttemptRecord }>(res);
    if (!data?.attempt) {
      enqueuePendingAttempt(attempt);
      return false;
    }
    removePendingAttempt(attempt.id);
    return true;
  } catch {
    enqueuePendingAttempt(attempt);
    return false;
  }
}

export async function flushPendingAttempts(): Promise<void> {
  const pending = readPendingAttempts();
  if (pending.length === 0) return;
  for (const item of pending) {
    await pushSiteAttempt(item);
  }
}

export async function fetchSiteAttempts(): Promise<AttemptRecord[] | null> {
  try {
    await flushPendingAttempts();
    const res = await fetch(getApiUrl('/api/site-attempts'), { cache: 'no-store' });
    if (!res.ok) return null;
    const data = await parseJsonSafe<{ attempts?: AttemptRecord[] }>(res);
    if (!data || !Array.isArray(data.attempts)) return null;
    return data.attempts;
  } catch {
    return null;
  }
}

export async function updateSiteAttemptOnServer(attempt: AttemptRecord): Promise<boolean> {
  try {
    const res = await fetch(getApiUrl(`/api/site-attempts/${encodeURIComponent(attempt.id)}`), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(attempt),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function deleteSiteAttemptOnServer(id: string): Promise<boolean> {
  removePendingAttempt(id);
  try {
    const res = await fetch(getApiUrl(`/api/site-attempts/${encodeURIComponent(id)}`), {
      method: 'DELETE',
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function clearSiteAttemptsOnServer(): Promise<boolean> {
  writePendingAttempts([]);
  try {
    const res = await fetch(getApiUrl('/api/site-attempts'), {
      method: 'DELETE',
    });
    return res.ok;
  } catch {
    return false;
  }
}
