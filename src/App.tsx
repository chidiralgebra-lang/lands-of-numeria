import React, { useCallback, useEffect, useRef, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { ZoomIn, ZoomOut } from 'lucide-react';
import { DEMO_QUESTION_BANK } from './data/defaultBank';
import { DEFAULT_AREAS, DEFAULT_PROFILE, DEFAULT_SETTINGS, HEROES, MONSTERS } from './data/worldData';
import { auth, isTeacherAdminUser, signInWithGoogle, signOutGoogle } from './firebase';
import {
  AreaDef,
  AttemptRecord,
  GameSettings,
  HeroDef,
  HeroId,
  LevelDef,
  LocalTeamConfig,
  MonsterDef,
  PlayerProfile,
  Question,
  ScreenState,
} from './types/game';
import { soundEngine } from './utils/audioEngine';
import {
  loadAreas,
  loadAttempts,
  loadHeroes,
  loadMonsters,
  loadProfile,
  loadQuestions,
  loadSettings,
  resetAllLocalData,
  saveAreas,
  saveAttempts,
  saveHeroes,
  saveMonsters,
  saveProfile,
  saveQuestions,
  saveSettings,
} from './utils/storage';
import {
  clearSiteAttemptsOnServer,
  deleteSiteAttemptOnServer,
  enqueuePendingAttempt,
  fetchSiteAttempts,
  fetchSiteConfig,
  flushPendingAttempts,
  getPendingAttemptIds,
  mergeServerSettings,
  normalizeServerAreas,
  publishSiteConfig,
  pushSiteAttempt,
  removePendingAttempt,
  updateSiteAttemptOnServer,
} from './utils/siteSync';
import {
  clearAllFirebaseAttempts,
  deleteFirebaseAttempt,
  ensureUserProfile,
  fetchFirebaseAttempts,
  fetchFirebaseConfig,
  fetchTeacherPrivatePin,
  publishFirebaseConfig,
  pushFirebaseAttempt,
  subscribeFirebaseAttempts,
  subscribeFirebaseConfig,
  updateFirebaseAttemptReview,
} from './utils/firebaseSync';
import { BattleArenaScreen } from './components/BattleArenaScreen';
import { ChampionCelebrationScreen } from './components/ChampionCelebrationScreen';
import { HowToPlayModal, SettingsModal } from './components/InfoModals';
import { OnlineClassScreen } from './components/OnlineClassScreen';
import { PlayerSetupScreen } from './components/PlayerSetupScreen';
import { ResultsScreen } from './components/ResultsScreen';
import { TeacherPanelScreen } from './components/TeacherPanelScreen';
import { TitleScreen } from './components/TitleScreen';
import { WorldMapScreen } from './components/WorldMapScreen';

function getNextProgressionTarget(
  areas: AreaDef[],
  areaId: string,
  levelId: string
): { area: AreaDef; level: LevelDef; isNewArea: boolean } | null {
  const sorted = [...areas].sort((a, b) => a.order - b.order);
  const areaIdx = sorted.findIndex((a) => a.id === areaId);
  if (areaIdx < 0) return null;
  const currentArea = sorted[areaIdx];
  const lvlIdx = currentArea.levels.findIndex((l) => l.id === levelId);
  if (lvlIdx >= 0 && lvlIdx + 1 < currentArea.levels.length) {
    return {
      area: currentArea,
      level: currentArea.levels[lvlIdx + 1],
      isNewArea: false,
    };
  }
  const nextArea = sorted[areaIdx + 1];
  if (nextArea && nextArea.levels.length > 0) {
    return {
      area: nextArea,
      level: nextArea.levels[0],
      isNewArea: true,
    };
  }
  return null;
}

function isFinalChallengeBattle(areas: AreaDef[], areaId: string, levelId: string): boolean {
  if (areaId === 'dimensi_tantangan' || levelId === 'dimensi_lv1') return true;
  const sorted = [...areas].sort((a, b) => a.order - b.order);
  const finalArea = sorted[sorted.length - 1];
  if (!finalArea || finalArea.id !== areaId) return false;
  const lastLevel = finalArea.levels[finalArea.levels.length - 1];
  return Boolean(lastLevel && lastLevel.id === levelId);
}

function getFrontierAreaId(
  areas: AreaDef[],
  profile: PlayerProfile,
  settings: GameSettings
): string {
  const sorted = [...areas].sort((a, b) => a.order - b.order);
  const unlocked = sorted.filter(
    (a) =>
      settings.unlockAllAreas ||
      a.unlockedByDefault ||
      profile.unlockedAreaIds.includes(a.id)
  );
  const nextIncomplete = unlocked.find((a) =>
    a.levels.some((l) => !profile.completedLevels[l.id])
  );
  return (nextIncomplete || unlocked[unlocked.length - 1] || sorted[0])?.id || '';
}

export default function App() {
  const [screen, setScreen] = useState<ScreenState>('TITLE_MENU');
  const [setupMode, setSetupMode] = useState<'solo' | 'local_team'>('solo');
  const [isNewAdventureSetup, setIsNewAdventureSetup] = useState(false);

  const [questions, setQuestions] = useState<Question[]>(() => loadQuestions());
  const [areas, setAreas] = useState<AreaDef[]>(() => loadAreas());
  const [heroes, setHeroes] = useState<HeroDef[]>(() => loadHeroes());
  const [monsters, setMonsters] = useState<Record<string, MonsterDef>>(() => loadMonsters());
  const [settings, setSettings] = useState<GameSettings>(() => loadSettings());
  const [profile, setProfile] = useState<PlayerProfile>(() => loadProfile());
  const [attempts, setAttempts] = useState<AttemptRecord[]>(() => loadAttempts());

  const [focusedAreaId, setFocusedAreaId] = useState<string>(() =>
    getFrontierAreaId(loadAreas(), loadProfile(), loadSettings())
  );
  const [mapTransitionFromAreaId, setMapTransitionFromAreaId] = useState<string | null>(null);
  const [nextMissionTarget, setNextMissionTarget] = useState<{
    area: AreaDef;
    level: LevelDef;
    isNewArea: boolean;
  } | null>(null);

  const [activeBattle, setActiveBattle] = useState<{
    mode: 'solo' | 'local_team';
    area: AreaDef;
    level: LevelDef;
    teamConfig?: LocalTeamConfig;
  } | null>(null);
  const [lastResult, setLastResult] = useState<AttemptRecord | null>(null);

  const [showHowToPlay, setShowHowToPlay] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [displayScale, setDisplayScale] = useState<number>(70);

  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');
  const isTeacherAdmin = isTeacherAdminUser(firebaseUser);

  const [configSyncStatus, setConfigSyncStatus] = useState<
    'checking' | 'synced' | 'syncing' | 'unsynced' | 'error'
  >('checking');
  const [configSyncError, setConfigSyncError] = useState('');
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [attemptsLoading, setAttemptsLoading] = useState(false);

  const teacherDirtyRef = useRef(false);
  const syncTimerRef = useRef<number | null>(null);
  const latestConfigRef = useRef({ questions, areas, heroes, monsters, settings });
  latestConfigRef.current = { questions, areas, heroes, monsters, settings };
  const firebaseUserRef = useRef<User | null>(null);
  firebaseUserRef.current = firebaseUser;

  const handleSignInGoogle = useCallback(async () => {
    setAuthLoading(true);
    setAuthError('');
    try {
      await signInWithGoogle();
    } catch (err) {
      const code = (err as { code?: string })?.code || '';
      if (code === 'auth/unauthorized-domain') {
        const host = typeof window !== 'undefined' ? window.location.hostname : 'domain-ini';
        setAuthError(
          `Domain "${host}" belum terdaftar di Firebase Authentication -> Settings -> Authorized domains. Tambahkan domain Netlify ini di Firebase Console agar Login Google berjalan.`
        );
      } else if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
        setAuthError('Login Google dibatalkan. Silakan coba lagi untuk menyinkronkan cloud.');
      } else {
        setAuthError(
          err instanceof Error ? err.message : 'Gagal masuk dengan akun Google. Coba lagi.'
        );
      }
    } finally {
      setAuthLoading(false);
    }
  }, []);

  const handleSignOutGoogle = useCallback(async () => {
    setAuthLoading(true);
    setAuthError('');
    try {
      await signOutGoogle();
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Gagal keluar dari akun Google.');
    } finally {
      setAuthLoading(false);
    }
  }, []);

  const applyConfigPayload = useCallback(
    (cfg: {
      updatedAt?: string;
      questions?: Question[];
      areas?: AreaDef[];
      heroes?: HeroDef[];
      monsters?: Record<string, MonsterDef>;
      settings?: Partial<GameSettings>;
    }) => {
      if (Array.isArray(cfg.questions)) {
        setQuestions(cfg.questions);
      }
      if (Array.isArray(cfg.areas) && cfg.areas.length > 0) {
        const normalized = normalizeServerAreas(cfg.areas);
        setAreas(normalized);
        setFocusedAreaId((prev) =>
          normalized.some((a) => a.id === prev)
            ? prev
            : getFrontierAreaId(normalized, profile, latestConfigRef.current.settings)
        );
      }
      if (Array.isArray(cfg.heroes) && cfg.heroes.length > 0) {
        setHeroes(cfg.heroes);
      }
      if (cfg.monsters && typeof cfg.monsters === 'object') {
        setMonsters(cfg.monsters);
      }
      if (cfg.settings && typeof cfg.settings === 'object') {
        setSettings((prev) => mergeServerSettings(prev, cfg.settings!));
      }
      setLastSyncedAt(cfg.updatedAt || null);
      setConfigSyncStatus('synced');
      setConfigSyncError('');
    },
    []
  );

  const flushPendingToCloud = useCallback(async (user: User | null) => {
    if (!user || !user.emailVerified) {
      await flushPendingAttempts();
      return;
    }
    const pendingIds = Array.from(getPendingAttemptIds());
    if (pendingIds.length === 0) return;
    const localMap = new Map(loadAttempts().map((a) => [a.id, a]));
    for (const id of pendingIds) {
      const target = localMap.get(id);
      if (!target) {
        removePendingAttempt(id);
        continue;
      }
      try {
        await pushFirebaseAttempt(target, user);
        removePendingAttempt(id);
      } catch {
        // Keep in pending queue for next retry
      }
    }
  }, []);

  const applyServerConfig = useCallback(async () => {
    if (teacherDirtyRef.current) return;
    const currentUser = firebaseUserRef.current;
    if (currentUser && currentUser.emailVerified) {
      try {
        const fbRes = await fetchFirebaseConfig();
        if (teacherDirtyRef.current) return;
        if (fbRes.hasConfig && fbRes.config) {
          applyConfigPayload(fbRes.config);
          return;
        }
        setConfigSyncStatus('unsynced');
        return;
      } catch (err) {
        setConfigSyncStatus('error');
        setConfigSyncError(
          err instanceof Error ? err.message : 'Gagal membaca konfigurasi dari Firebase Cloud.'
        );
        return;
      }
    }

    const res = await fetchSiteConfig();
    if (!res || !res.hasConfig || !res.config) {
      setConfigSyncStatus((prev) => (prev === 'checking' ? 'unsynced' : prev));
      return;
    }
    if (teacherDirtyRef.current) return;
    applyConfigPayload(res.config);
  }, [applyConfigPayload]);

  const refreshServerAttempts = useCallback(async () => {
    setAttemptsLoading(true);
    try {
      const currentUser = firebaseUserRef.current;
      if (currentUser && currentUser.emailVerified) {
        await flushPendingToCloud(currentUser);
        const cloudList = await fetchFirebaseAttempts(currentUser);
        const pendingIds = getPendingAttemptIds();
        setAttempts((prevLocal) => {
          const map = new Map<string, AttemptRecord>();
          cloudList.forEach((a) => map.set(a.id, a));
          prevLocal.forEach((a) => {
            if (pendingIds.has(a.id) && !map.has(a.id)) {
              map.set(a.id, a);
            }
          });
          return Array.from(map.values()).sort(
            (a, b) => (Date.parse(b.dateIso || '') || 0) - (Date.parse(a.dateIso || '') || 0)
          );
        });
        return;
      }

      const serverList = await fetchSiteAttempts();
      if (!serverList) return;
      const pendingIds = getPendingAttemptIds();
      setAttempts((prevLocal) => {
        const map = new Map<string, AttemptRecord>();
        serverList.forEach((a) => map.set(a.id, a));
        prevLocal.forEach((a) => {
          if (pendingIds.has(a.id) && !map.has(a.id)) {
            map.set(a.id, a);
          }
        });
        return Array.from(map.values()).sort((a, b) => {
          const ta = Date.parse(a.dateIso || '') || 0;
          const tb = Date.parse(b.dateIso || '') || 0;
          return tb - ta;
        });
      });
    } catch (err) {
      setConfigSyncError(err instanceof Error ? err.message : 'Gagal menyegarkan data hasil siswa.');
    } finally {
      setAttemptsLoading(false);
    }
  }, [flushPendingToCloud]);

  const publishTeacherConfigNow = useCallback(
    async (override?: Partial<typeof latestConfigRef.current>) => {
      if (syncTimerRef.current !== null) {
        window.clearTimeout(syncTimerRef.current);
        syncTimerRef.current = null;
      }
      const payload = {
        ...latestConfigRef.current,
        ...override,
      };
      latestConfigRef.current = payload;
      setConfigSyncStatus('syncing');
      setConfigSyncError('');

      const currentUser = firebaseUserRef.current;
      if (currentUser && isTeacherAdminUser(currentUser)) {
        try {
          const fbRes = await publishFirebaseConfig(payload, currentUser);
          teacherDirtyRef.current = false;
          setLastSyncedAt(fbRes.config?.updatedAt || new Date().toISOString());
          setConfigSyncStatus('synced');
          // Best-effort secondary mirror to Netlify/Express endpoint if active
          void publishSiteConfig(payload).catch(() => undefined);
        } catch (err) {
          setConfigSyncStatus('error');
          setConfigSyncError(
            err instanceof Error
              ? err.message
              : 'Gagal menyimpan konfigurasi guru ke Firebase Cloud.'
          );
        }
        return;
      }

      try {
        const res = await publishSiteConfig(payload);
        teacherDirtyRef.current = false;
        setLastSyncedAt(res.config?.updatedAt || new Date().toISOString());
        setConfigSyncStatus('synced');
      } catch (err) {
        setConfigSyncStatus('error');
        setConfigSyncError(
          currentUser
            ? 'Anda masuk bukan sebagai Guru Pemilik. Perubahan hanya tersimpan lokal di perangkat ini.'
            : err instanceof Error
            ? `${err.message} Masuk dengan Akun Google Guru agar konfigurasi tersimpan di Firebase Cloud.`
            : 'Masuk dengan Akun Google Guru untuk mempublikasikan ke Firebase Cloud.'
        );
      }
    },
    []
  );

  const scheduleTeacherPublish = useCallback(
    (override?: Partial<typeof latestConfigRef.current>) => {
      teacherDirtyRef.current = true;
      if (override) {
        latestConfigRef.current = { ...latestConfigRef.current, ...override };
      }
      const currentUser = firebaseUserRef.current;
      if (currentUser && !isTeacherAdminUser(currentUser)) {
        // Non-admin stays local without throwing cloud permission error
        teacherDirtyRef.current = false;
        setConfigSyncStatus('unsynced');
        return;
      }
      setConfigSyncStatus('syncing');
      setConfigSyncError('');
      if (syncTimerRef.current !== null) {
        window.clearTimeout(syncTimerRef.current);
      }
      syncTimerRef.current = window.setTimeout(() => {
        syncTimerRef.current = null;
        void publishTeacherConfigNow();
      }, 450);
    },
    [publishTeacherConfigNow]
  );

  // Firebase Auth listener
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user);
      setAuthReady(true);
      if (user && user.emailVerified) {
        void ensureUserProfile(user).catch((err) => {
          console.error('Profile sync failed:', err);
        });
        if (isTeacherAdminUser(user)) {
          void fetchTeacherPrivatePin(user)
            .then((pin) => {
              if (pin !== null) {
                setSettings((prev) => ({ ...prev, teacherPin: pin }));
              }
            })
            .catch(() => undefined);
        }
      }
    });
    return () => unsub();
  }, []);

  // Real-time Firebase Firestore listeners when authenticated & verified
  useEffect(() => {
    if (!authReady) return;
    if (!firebaseUser || !firebaseUser.emailVerified) {
      void applyServerConfig();
      void flushPendingAttempts();
      return;
    }

    setConfigSyncStatus('checking');
    void flushPendingToCloud(firebaseUser);

    const unsubConfig = subscribeFirebaseConfig(
      (res) => {
        if (teacherDirtyRef.current) return;
        if (res.hasConfig && res.config) {
          applyConfigPayload(res.config);
        } else {
          setConfigSyncStatus('unsynced');
        }
      },
      (err) => {
        setConfigSyncStatus('error');
        setConfigSyncError(
          err instanceof Error ? err.message : 'Gagal menyinkronkan pengaturan dari Firebase Cloud.'
        );
      }
    );

    const unsubAttempts = subscribeFirebaseAttempts(
      firebaseUser,
      (cloudList) => {
        const pendingIds = getPendingAttemptIds();
        setAttempts((prevLocal) => {
          const map = new Map<string, AttemptRecord>();
          cloudList.forEach((a) => map.set(a.id, a));
          prevLocal.forEach((a) => {
            if (pendingIds.has(a.id) && !map.has(a.id)) {
              map.set(a.id, a);
            }
          });
          return Array.from(map.values()).sort(
            (a, b) => (Date.parse(b.dateIso || '') || 0) - (Date.parse(a.dateIso || '') || 0)
          );
        });
      },
      (err) => {
        console.error('Attempts subscription error:', err);
      }
    );

    return () => {
      unsubConfig();
      unsubAttempts();
    };
  }, [authReady, firebaseUser, applyConfigPayload, applyServerConfig, flushPendingToCloud]);

  useEffect(() => {
    const onOnline = () => {
      void flushPendingToCloud(firebaseUserRef.current);
      void applyServerConfig();
    };
    window.addEventListener('online', onOnline);
    return () => {
      window.removeEventListener('online', onOnline);
      if (syncTimerRef.current !== null) {
        window.clearTimeout(syncTimerRef.current);
      }
    };
  }, [applyServerConfig, flushPendingToCloud]);

  useEffect(() => {
    if (screen === 'WORLD_MAP' || screen === 'PLAYER_SETUP') {
      void applyServerConfig();
    } else if (screen === 'TEACHER_PANEL') {
      if (!teacherDirtyRef.current) {
        void applyServerConfig();
      }
      void refreshServerAttempts();
    }
  }, [screen, applyServerConfig, refreshServerAttempts]);

  useEffect(() => {
    document.documentElement.style.fontSize = `${displayScale}%`;
  }, [displayScale]);

  const updateDisplayScale = (next: number) => {
    const clamped = Math.min(125, Math.max(50, Math.round(next)));
    setDisplayScale(clamped);
  };

  // Persist changes to LocalStorage
  useEffect(() => saveQuestions(questions), [questions]);
  useEffect(() => saveAreas(areas), [areas]);
  useEffect(() => saveHeroes(heroes), [heroes]);
  useEffect(() => saveMonsters(monsters), [monsters]);
  useEffect(() => saveSettings(settings), [settings]);
  useEffect(() => saveProfile(profile), [profile]);
  useEffect(() => saveAttempts(attempts), [attempts]);

  // Sync audio engine config
  useEffect(() => {
    soundEngine.updateConfig(settings.musicEnabled, settings.sfxEnabled, settings.volume);
  }, [settings.musicEnabled, settings.sfxEnabled, settings.volume]);

  // Unlock Web Audio API on first user gesture
  useEffect(() => {
    const unlock = () => {
      soundEngine.unlock();
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, []);

  const handleToggleMute = () => {
    const anyOn = settings.musicEnabled || settings.sfxEnabled;
    setSettings((s) => ({
      ...s,
      musicEnabled: !anyOn,
      sfxEnabled: !anyOn,
    }));
  };

  const handleStartSoloLevel = (area: AreaDef, level: LevelDef) => {
    const areaUnlocked =
      settings.unlockAllAreas ||
      area.unlockedByDefault ||
      profile.unlockedAreaIds.includes(area.id) ||
      (() => {
        if (!area.prerequisiteAreaId) return false;
        const prereq = areas.find((a) => a.id === area.prerequisiteAreaId);
        const lastLvl = prereq?.levels[prereq.levels.length - 1];
        return Boolean(lastLvl && profile.completedLevels[lastLvl.id]);
      })();
    const lvlIdx = area.levels.findIndex((l) => l.id === level.id);
    const prevLvlCompleted =
      lvlIdx <= 0 || Boolean(profile.completedLevels[area.levels[lvlIdx - 1].id]);
    if (!areaUnlocked || !prevLvlCompleted) return;

    soundEngine.playMenuClick();
    setActiveBattle({ mode: 'solo', area, level });
    setScreen('BATTLE_ARENA');
  };

  const handleStartLocalTeam = (config: LocalTeamConfig) => {
    soundEngine.playMenuClick();
    const chosenArea = areas.find((a) => a.id === config.areaId) || areas[0];
    const teamLevel: LevelDef = {
      id: `team-${Date.now()}`,
      name: `Duel: ${config.teamAName} vs ${config.teamBName}`,
      monsterId: chosenArea.levels[chosenArea.levels.length - 1]?.monsterId || 'raja_slime',
      questionCount: config.questionCountPerTeam * 2,
      difficulty: config.difficulty,
      topicFilter: config.topicFilter,
      rewardXp: 100,
      rewardCoins: 40,
    };
    setActiveBattle({ mode: 'local_team', area: chosenArea, level: teamLevel, teamConfig: config });
    setScreen('BATTLE_ARENA');
  };

  const recordBattleCompletion = (
    record: AttemptRecord
  ): {
    nextTarget: { area: AreaDef; level: LevelDef; isNewArea: boolean } | null;
    isGrandChampion: boolean;
  } => {
    setLastResult(record);
    setAttempts((prev) => [record, ...prev]);
    const currentUser = firebaseUserRef.current;
    if (currentUser && currentUser.emailVerified) {
      void pushFirebaseAttempt(record, currentUser).catch(() => {
        enqueuePendingAttempt(record);
      });
    } else {
      void pushSiteAttempt(record);
    }

    if (record.mode !== 'solo') {
      setNextMissionTarget(null);
      return { nextTarget: null, isGrandChampion: false };
    }

    const nextXp = profile.xp + record.xpEarned;
    const nextLevel = 1 + Math.floor(nextXp / 200);
    const stars =
      record.academicMasteryPct >= 90
        ? 3
        : record.academicMasteryPct >= 70
        ? 2
        : record.wonBattle
        ? 1
        : 0;

    const prevBest = profile.completedLevels[record.levelId];
    const nextCompleted = {
      ...profile.completedLevels,
      ...(record.wonBattle
        ? {
            [record.levelId]: {
              stars: Math.max(stars, prevBest?.stars || 0),
              bestMasteryPct: Math.max(record.academicMasteryPct, prevBest?.bestMasteryPct || 0),
              attempts: (prevBest?.attempts || 0) + 1,
            },
          }
        : {}),
    };

    const sortedAreas = [...areas].sort((a, b) => a.order - b.order);
    const areasWithLevels = sortedAreas.filter((a) => a.levels.length > 0);
    const finalArea = areasWithLevels[areasWithLevels.length - 1];
    const finalLevel = finalArea?.levels[finalArea.levels.length - 1];
    const isFinalMonsterVictory = Boolean(
      record.wonBattle &&
        finalArea &&
        finalLevel &&
        record.areaId === finalArea.id &&
        record.levelId === finalLevel.id
    );
    const allLevelsWon =
      areasWithLevels.length > 0 &&
      areasWithLevels.every((a) => a.levels.every((l) => Boolean(nextCompleted[l.id])));
    const isGrandChampion = isFinalMonsterVictory && allLevelsWon;

    const areaIdx = sortedAreas.findIndex((a) => a.id === record.areaId);
    const currentArea = sortedAreas[areaIdx];
    const isAreaBoss =
      currentArea &&
      currentArea.levels[currentArea.levels.length - 1]?.id === record.levelId &&
      record.wonBattle;
    const nextArea = areaIdx >= 0 ? sortedAreas[areaIdx + 1] : undefined;
    const nextTarget = record.wonBattle
      ? getNextProgressionTarget(areas, record.areaId, record.levelId)
      : null;

    let unlockedAreaIds = profile.unlockedAreaIds;
    if (isAreaBoss && nextArea && !unlockedAreaIds.includes(nextArea.id)) {
      unlockedAreaIds = [...unlockedAreaIds, nextArea.id];
    }
    if (nextTarget?.isNewArea && !unlockedAreaIds.includes(nextTarget.area.id)) {
      unlockedAreaIds = [...unlockedAreaIds, nextTarget.area.id];
    }

    const nextBadges =
      isGrandChampion && !profile.badges.includes('Penguasa Numeria')
        ? [...profile.badges, 'Penguasa Numeria']
        : profile.badges;

    if (nextLevel > profile.level) soundEngine.playLevelUp();

    setProfile({
      ...profile,
      xp: nextXp,
      level: nextLevel,
      coins: profile.coins + record.coinsEarned,
      badges: nextBadges,
      completedLevels: nextCompleted,
      unlockedAreaIds,
    });

    setNextMissionTarget(nextTarget);
    if (record.wonBattle && nextTarget) {
      if (nextTarget.isNewArea && nextTarget.area.id !== record.areaId) {
        setMapTransitionFromAreaId(record.areaId);
      } else {
        setMapTransitionFromAreaId(null);
      }
      setFocusedAreaId(nextTarget.area.id);
    }

    return { nextTarget, isGrandChampion };
  };

  const handleFinishBattle = (record: AttemptRecord) => {
    const { isGrandChampion } = recordBattleCompletion(record);
    if (isGrandChampion) {
      soundEngine.playLevelUp();
      setScreen('CHAMPION_CELEBRATION');
    } else {
      setScreen('RESULTS');
    }
  };

  const handleContinueNextFromBattle = (record: AttemptRecord) => {
    const { nextTarget, isGrandChampion } = recordBattleCompletion(record);
    if (nextTarget) {
      soundEngine.playMenuClick();
      setActiveBattle({ mode: 'solo', area: nextTarget.area, level: nextTarget.level });
      setScreen('BATTLE_ARENA');
    } else if (isGrandChampion) {
      soundEngine.playLevelUp();
      setScreen('CHAMPION_CELEBRATION');
    } else {
      setScreen('RESULTS');
    }
  };

  const handlePracticeWeakTopic = (weakTopic: string) => {
    const matchArea =
      areas.find((a) => a.mathTopic.toLowerCase() === weakTopic.toLowerCase()) || areas[0];
    const customLevel: LevelDef = {
      id: `practice-${Date.now()}`,
      name: `Latihan Fokus: ${weakTopic}`,
      monsterId: matchArea.levels[0]?.monsterId || 'slime_angka',
      questionCount: 4,
      difficulty: 'campuran',
      topicFilter: weakTopic,
      rewardXp: 60,
      rewardCoins: 25,
    };
    setActiveBattle({ mode: 'solo', area: matchArea, level: customLevel });
    setScreen('BATTLE_ARENA');
  };

  const handleResetLocal = () => {
    resetAllLocalData();
    setQuestions(DEMO_QUESTION_BANK);
    setAreas(DEFAULT_AREAS);
    setHeroes(HEROES);
    setMonsters(MONSTERS);
    setSettings(DEFAULT_SETTINGS);
    setProfile(DEFAULT_PROFILE);
    setAttempts([]);
    setNextMissionTarget(null);
    setMapTransitionFromAreaId(null);
    setFocusedAreaId(DEFAULT_AREAS[0]?.id || '');
  };

  const hasProfileProgress =
    profile.xp > 0 ||
    profile.level > 1 ||
    Object.keys(profile.completedLevels).length > 0 ||
    profile.unlockedAreaIds.length > 1 ||
    profile.badges.length > 0 ||
    profile.unlockedAccessories.length > 0;

  const handleResetGameResults = (alsoResetProfile: boolean) => {
    setAttempts([]);
    setLastResult(null);
    setActiveBattle(null);
    setNextMissionTarget(null);
    setMapTransitionFromAreaId(null);
    const currentUser = firebaseUserRef.current;
    if (currentUser && isTeacherAdminUser(currentUser)) {
      void clearAllFirebaseAttempts(currentUser).catch(() => undefined);
    }
    void clearSiteAttemptsOnServer();
    if (alsoResetProfile) {
      setProfile(DEFAULT_PROFILE);
      const sorted = [...areas].sort((a, b) => a.order - b.order);
      setFocusedAreaId(sorted[0]?.id || '');
    }
  };

  const rootClasses = [
    'min-h-screen w-full',
    settings.textSize === 'besar' ? 'a11y-large-text' : '',
    settings.highContrast ? 'a11y-high-contrast' : '',
    settings.reducedMotion ? 'reduced-motion' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={rootClasses}>
      {screen === 'TITLE_MENU' && (
        <TitleScreen
          profile={profile}
          heroes={heroes}
          musicOrSfxEnabled={settings.musicEnabled || settings.sfxEnabled}
          externalModalOpen={showHowToPlay || showSettings}
          firebaseUser={firebaseUser}
          authLoading={authLoading}
          authError={authError}
          isTeacherAdmin={isTeacherAdmin}
          configSyncStatus={configSyncStatus}
          onSignInGoogle={() => void handleSignInGoogle()}
          onSignOutGoogle={() => void handleSignOutGoogle()}
          onClearAuthError={() => setAuthError('')}
          onToggleMute={handleToggleMute}
          onContinueAdventure={() => {
            soundEngine.playMenuClick();
            setIsNewAdventureSetup(false);
            setFocusedAreaId(getFrontierAreaId(areas, profile, settings));
            setScreen('WORLD_MAP');
          }}
          onStartNewAdventure={() => {
            soundEngine.playMenuClick();
            setSetupMode('solo');
            setIsNewAdventureSetup(true);
            setScreen('PLAYER_SETUP');
          }}
          onStartLocalTeam={() => {
            soundEngine.playMenuClick();
            setSetupMode('local_team');
            setIsNewAdventureSetup(false);
            setScreen('PLAYER_SETUP');
          }}
          onJoinOnlineClass={() => {
            soundEngine.playMenuClick();
            setScreen('JOIN_CLASS');
          }}
          onOpenTeacherPanel={() => {
            soundEngine.playMenuClick();
            setScreen('TEACHER_PANEL');
          }}
          onOpenHowToPlay={() => {
            soundEngine.playMenuClick();
            setShowHowToPlay(true);
          }}
          onOpenSettings={() => {
            soundEngine.playMenuClick();
            setShowSettings(true);
          }}
          onSelectQuickHero={(heroId: HeroId) => setProfile({ ...profile, heroId })}
        />
      )}

      {screen === 'PLAYER_SETUP' && (
        <PlayerSetupScreen
          key={`${setupMode}-${isNewAdventureSetup ? 'new' : 'edit'}`}
          mode={setupMode}
          isNewAdventure={isNewAdventureSetup}
          profile={profile}
          areas={areas}
          heroes={heroes}
          onUpdateProfile={setProfile}
          onContinueSolo={() => {
            soundEngine.playMenuClick();
            if (isNewAdventureSetup) {
              const sorted = [...areas].sort((a, b) => a.order - b.order);
              setFocusedAreaId(sorted[0]?.id || 'hutan_bilangan');
              setMapTransitionFromAreaId(null);
              setNextMissionTarget(null);
              setActiveBattle(null);
              setLastResult(null);
              setIsNewAdventureSetup(false);
            }
            setScreen('WORLD_MAP');
          }}
          onStartLocalTeam={handleStartLocalTeam}
          onBack={() => {
            soundEngine.playMenuClick();
            setIsNewAdventureSetup(false);
            setScreen('TITLE_MENU');
          }}
        />
      )}

      {screen === 'WORLD_MAP' && (
        <WorldMapScreen
          areas={areas}
          heroes={heroes}
          monsters={monsters}
          questions={questions}
          profile={profile}
          settings={settings}
          focusedAreaId={focusedAreaId}
          transitionFromAreaId={mapTransitionFromAreaId}
          onSelectArea={(areaId) => {
            setFocusedAreaId(areaId);
            setMapTransitionFromAreaId(null);
          }}
          onClearTransition={() => setMapTransitionFromAreaId(null)}
          onStartLevel={handleStartSoloLevel}
          onBackToSetup={() => setScreen('PLAYER_SETUP')}
          onBackToTitle={() => setScreen('TITLE_MENU')}
        />
      )}

      {screen === 'BATTLE_ARENA' && activeBattle && (
        <BattleArenaScreen
          key={`${activeBattle.mode}-${activeBattle.area.id}-${activeBattle.level.id}`}
          mode={activeBattle.mode}
          area={activeBattle.area}
          level={activeBattle.level}
          teamConfig={activeBattle.teamConfig}
          allQuestions={questions}
          heroes={heroes}
          monsters={monsters}
          nextTarget={
            activeBattle.mode === 'solo'
              ? getNextProgressionTarget(areas, activeBattle.area.id, activeBattle.level.id)
              : null
          }
          isChallengeStage={isFinalChallengeBattle(areas, activeBattle.area.id, activeBattle.level.id)}
          profile={profile}
          settings={settings}
          onToggleMute={handleToggleMute}
          onFinishBattle={handleFinishBattle}
          onContinueNext={handleContinueNextFromBattle}
          onExitToMap={() =>
            setScreen(activeBattle.mode === 'local_team' ? 'TITLE_MENU' : 'WORLD_MAP')
          }
        />
      )}

      {screen === 'CHAMPION_CELEBRATION' && lastResult && (() => {
        const sortedWithLevels = [...areas]
          .sort((a, b) => a.order - b.order)
          .filter((a) => a.levels.length > 0);
        const finalArea = sortedWithLevels[sortedWithLevels.length - 1];
        const finalLevel = finalArea?.levels[finalArea.levels.length - 1];
        const monsterId = activeBattle?.level.monsterId || finalLevel?.monsterId || 'raja_matematika';
        const finalMonsterName = monsters[monsterId]?.name || 'Raja Matematika';
        const totalAreasCount = sortedWithLevels.length;
        const totalLevelsCount = sortedWithLevels.reduce((sum, a) => sum + a.levels.length, 0);

        return (
          <ChampionCelebrationScreen
            record={lastResult}
            heroes={heroes}
            finalMonsterName={finalMonsterName}
            totalAreasCount={totalAreasCount}
            totalLevelsCount={totalLevelsCount}
            onContinueToResults={() => {
              soundEngine.playMenuClick();
              setScreen('RESULTS');
            }}
          />
        );
      })()}

      {screen === 'RESULTS' && lastResult && (
        <ResultsScreen
          record={lastResult}
          heroes={heroes}
          nextTarget={nextMissionTarget}
          showExplanation={settings.showExplanationOnWrong}
          onContinueNext={() => {
            if (!nextMissionTarget) return;
            soundEngine.playMenuClick();
            setActiveBattle({
              mode: 'solo',
              area: nextMissionTarget.area,
              level: nextMissionTarget.level,
            });
            setScreen('BATTLE_ARENA');
          }}
          onPlayAgain={() => {
            if (activeBattle) setScreen('BATTLE_ARENA');
          }}
          onPracticeWeak={handlePracticeWeakTopic}
          onBackToMap={() => setScreen('WORLD_MAP')}
          onBackToTitle={() => setScreen('TITLE_MENU')}
        />
      )}

      {screen === 'JOIN_CLASS' && (
        <OnlineClassScreen
          defaultName={profile.name}
          defaultHero={profile.heroId}
          heroes={heroes}
          firebaseUser={firebaseUser}
          authLoading={authLoading}
          onSignInGoogle={() => void handleSignInGoogle()}
          onBack={() => setScreen('TITLE_MENU')}
        />
      )}

      {screen === 'TEACHER_PANEL' && (
        <TeacherPanelScreen
          questions={questions}
          areas={areas}
          heroes={heroes}
          monsters={monsters}
          activeHeroId={profile.heroId}
          settings={settings}
          attempts={attempts}
          hasProfileProgress={hasProfileProgress}
          firebaseUser={firebaseUser}
          isTeacherAdmin={isTeacherAdmin}
          authLoading={authLoading}
          authError={authError}
          onSignInGoogle={() => void handleSignInGoogle()}
          onSignOutGoogle={() => void handleSignOutGoogle()}
          configSyncStatus={configSyncStatus}
          configSyncError={configSyncError}
          lastSyncedAt={lastSyncedAt}
          attemptsLoading={attemptsLoading}
          onPublishConfigNow={() => {
            void publishTeacherConfigNow();
          }}
          onRefreshAttempts={() => {
            void refreshServerAttempts();
          }}
          onUpdateQuestions={(next) => {
            setQuestions(next);
            scheduleTeacherPublish({ questions: next });
          }}
          onUpdateAreas={(next) => {
            setAreas(next);
            scheduleTeacherPublish({ areas: next });
          }}
          onUpdateHeroes={(next) => {
            setHeroes(next);
            scheduleTeacherPublish({ heroes: next });
          }}
          onUpdateMonsters={(next) => {
            setMonsters(next);
            scheduleTeacherPublish({ monsters: next });
          }}
          onSelectActiveHero={(heroId) => setProfile((p) => ({ ...p, heroId }))}
          onUpdateSettings={(next) => {
            setSettings(next);
            scheduleTeacherPublish({ settings: next });
          }}
          onUpdateAttempts={setAttempts}
          onSaveAttemptReview={(updated) => {
            setAttempts((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
            const currentUser = firebaseUserRef.current;
            if (currentUser && isTeacherAdminUser(currentUser)) {
              void updateFirebaseAttemptReview(updated, currentUser).catch(() => undefined);
            }
            void updateSiteAttemptOnServer(updated);
          }}
          onDeleteAttempt={(id) => {
            setAttempts((prev) => prev.filter((item) => item.id !== id));
            const currentUser = firebaseUserRef.current;
            if (currentUser && isTeacherAdminUser(currentUser)) {
              void deleteFirebaseAttempt(id, currentUser).catch(() => undefined);
            }
            void deleteSiteAttemptOnServer(id);
          }}
          onResetResults={handleResetGameResults}
          onBack={() => {
            if (teacherDirtyRef.current) {
              void publishTeacherConfigNow();
            }
            setScreen('TITLE_MENU');
          }}
        />
      )}

      {showHowToPlay && <HowToPlayModal onClose={() => setShowHowToPlay(false)} />}
      {showSettings && (
        <SettingsModal
          settings={settings}
          displayScale={displayScale}
          onChangeDisplayScale={updateDisplayScale}
          onUpdateSettings={setSettings}
          onResetLocalData={handleResetLocal}
          onClose={() => setShowSettings(false)}
        />
      )}

      {/* Global Display Scale Controls (Default 70%, Zoom Out / Zoom In anytime) */}
      <div
        className="fixed bottom-3 right-3 z-40 no-print flex items-center rounded-xl bg-slate-900/95 border border-slate-700/90 shadow-xl backdrop-blur-sm text-slate-100"
        style={{ fontSize: '12px', padding: '4px', gap: '4px' }}
        aria-label="Pengatur ukuran layar permainan"
      >
        <button
          type="button"
          onClick={() => updateDisplayScale(displayScale - 5)}
          disabled={displayScale <= 50}
          title="Perkecil tampilan layar"
          aria-label="Perkecil tampilan layar"
          className="inline-flex items-center justify-center rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-100 cursor-pointer transition-colors"
          style={{ width: '28px', height: '28px' }}
        >
          <ZoomOut style={{ width: '15px', height: '15px' }} />
        </button>
        <button
          type="button"
          onClick={() => updateDisplayScale(70)}
          title="Reset ukuran layar ke 70%"
          className="rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 font-mono font-bold text-amber-300 tabular-nums cursor-pointer transition-colors"
          style={{ height: '28px', padding: '0 8px', fontSize: '12px' }}
        >
          {displayScale}%
        </button>
        <button
          type="button"
          onClick={() => updateDisplayScale(displayScale + 5)}
          disabled={displayScale >= 125}
          title="Perbesar tampilan layar"
          aria-label="Perbesar tampilan layar"
          className="inline-flex items-center justify-center rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-100 cursor-pointer transition-colors"
          style={{ width: '28px', height: '28px' }}
        >
          <ZoomIn style={{ width: '15px', height: '15px' }} />
        </button>
      </div>
    </div>
  );
}
