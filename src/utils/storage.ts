import { DEMO_QUESTION_BANK } from '../data/defaultBank';
import {
  DEFAULT_AREAS,
  DEFAULT_PROFILE,
  DEFAULT_SETTINGS,
  HEROES,
  MONSTERS,
  resolveAreaBgImage,
} from '../data/worldData';
import {
  AreaDef,
  AttemptRecord,
  GameSettings,
  HeroDef,
  MonsterDef,
  PlayerProfile,
  Question,
} from '../types/game';

const KEYS = {
  QUESTIONS: 'bok_mma_questions_v1',
  AREAS: 'bok_mma_areas_v1',
  SETTINGS: 'bok_mma_settings_v1',
  PROFILE: 'bok_mma_profile_v1',
  ATTEMPTS: 'bok_mma_attempts_v1',
  HEROES: 'bok_mma_heroes_v1',
  MONSTERS: 'bok_mma_monsters_v1',
};

const MIGRATION_KEYS = {
  TANTANGAN_BANK_V1: 'bok_mma_tantangan_migrated_v1',
  DIMENSI_DIFF_V1: 'bok_mma_dimensi_diff_migrated_v1',
};

function safeRead<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function safeWrite<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore storage quota errors gracefully
  }
}

export function loadQuestions(): Question[] {
  const saved = safeRead<Question[] | null>(KEYS.QUESTIONS, null);
  if (saved && Array.isArray(saved) && saved.length > 0) {
    try {
      if (localStorage.getItem(MIGRATION_KEYS.TANTANGAN_BANK_V1) !== '1') {
        const existingIds = new Set(saved.map((q) => q.id));
        const newChallengeQuestions = DEMO_QUESTION_BANK.filter(
          (q) => q.id.startsWith('demo-tantangan-') && !existingIds.has(q.id)
        );
        localStorage.setItem(MIGRATION_KEYS.TANTANGAN_BANK_V1, '1');
        if (newChallengeQuestions.length > 0) {
          const merged = [...saved, ...newChallengeQuestions];
          safeWrite(KEYS.QUESTIONS, merged);
          return merged;
        }
      }
    } catch {
      // Ignore storage migration errors
    }
    return saved;
  }
  return DEMO_QUESTION_BANK;
}

export function saveQuestions(questions: Question[]): void {
  safeWrite(KEYS.QUESTIONS, questions);
}

export function loadAreas(): AreaDef[] {
  const saved = safeRead<AreaDef[] | null>(KEYS.AREAS, null);
  if (saved && Array.isArray(saved) && saved.length > 0) {
    const normalizeAreas = (list: AreaDef[]): AreaDef[] =>
      list.map((a) => ({ ...a, bgImage: resolveAreaBgImage(a.bgImage) }));

    try {
      if (localStorage.getItem(MIGRATION_KEYS.DIMENSI_DIFF_V1) !== '1') {
        localStorage.setItem(MIGRATION_KEYS.DIMENSI_DIFF_V1, '1');
        let changed = false;
        const upgraded = saved.map((area) => {
          if (area.id !== 'dimensi_tantangan') return area;
          return {
            ...area,
            mathTopic:
              area.mathTopic === 'Campuran & Pengayaan' ? 'Campuran & Pengayaan HOTS' : area.mathTopic,
            levels: area.levels.map((lvl) => {
              if (lvl.id === 'dimensi_lv1' && lvl.difficulty === 'campuran') {
                changed = true;
                return { ...lvl, difficulty: 'sulit' as const };
              }
              return lvl;
            }),
          };
        });
        if (changed) {
          const normalized = normalizeAreas(upgraded);
          safeWrite(KEYS.AREAS, normalized);
          return normalized;
        }
      }
    } catch {
      // Ignore storage migration errors
    }
    return normalizeAreas(saved);
  }
  return DEFAULT_AREAS;
}

export function saveAreas(areas: AreaDef[]): void {
  safeWrite(KEYS.AREAS, areas);
}

export function loadHeroes(): HeroDef[] {
  const saved = safeRead<HeroDef[] | null>(KEYS.HEROES, null);
  if (!saved || !Array.isArray(saved) || saved.length === 0) return HEROES;
  return HEROES.map((base) => {
    const found = saved.find((s) => s && s.id === base.id);
    if (!found) return base;
    return {
      ...base,
      ...found,
      visualId: found.visualId || base.id,
    };
  });
}

export function saveHeroes(heroes: HeroDef[]): void {
  safeWrite(KEYS.HEROES, heroes);
}

export function loadMonsters(): Record<string, MonsterDef> {
  const saved = safeRead<Record<string, MonsterDef> | null>(KEYS.MONSTERS, null);
  if (!saved || typeof saved !== 'object') return MONSTERS;
  const merged: Record<string, MonsterDef> = {};
  Object.entries(MONSTERS).forEach(([key, base]) => {
    merged[key] = saved[key] ? { ...base, ...saved[key] } : base;
  });
  Object.entries(saved).forEach(([key, custom]) => {
    if (!merged[key] && custom && custom.id && custom.name) {
      merged[key] = custom;
    }
  });
  return merged;
}

export function saveMonsters(monsters: Record<string, MonsterDef>): void {
  safeWrite(KEYS.MONSTERS, monsters);
}

export function loadSettings(): GameSettings {
  const saved = safeRead<Partial<GameSettings>>(KEYS.SETTINGS, {});
  return { ...DEFAULT_SETTINGS, ...saved };
}

export function saveSettings(settings: GameSettings): void {
  safeWrite(KEYS.SETTINGS, settings);
}

export function loadProfile(): PlayerProfile {
  const saved = safeRead<Partial<PlayerProfile>>(KEYS.PROFILE, {});
  return {
    ...DEFAULT_PROFILE,
    ...saved,
    completedLevels: saved.completedLevels || {},
    unlockedAreaIds: saved.unlockedAreaIds?.length ? saved.unlockedAreaIds : ['hutan_bilangan'],
    unlockedAccessories: saved.unlockedAccessories || [],
    badges: saved.badges || [],
  };
}

export function saveProfile(profile: PlayerProfile): void {
  safeWrite(KEYS.PROFILE, profile);
}

export function loadAttempts(): AttemptRecord[] {
  const saved = safeRead<AttemptRecord[]>(KEYS.ATTEMPTS, []);
  return Array.isArray(saved) ? saved : [];
}

export function saveAttempts(attempts: AttemptRecord[]): void {
  safeWrite(KEYS.ATTEMPTS, attempts);
}

export function resetAllLocalData(): void {
  Object.values(KEYS).forEach((k) => localStorage.removeItem(k));
  Object.values(MIGRATION_KEYS).forEach((k) => localStorage.removeItem(k));
}
