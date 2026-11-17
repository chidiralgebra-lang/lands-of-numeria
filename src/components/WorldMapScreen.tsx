import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Compass,
  Lock,
  Play,
  Sparkles,
  Star,
  Swords,
} from 'lucide-react';
import { HEROES, MONSTERS, WORLD_MAP_IMG } from '../data/worldData';
import {
  AreaDef,
  GameSettings,
  HeroDef,
  LevelDef,
  MonsterDef,
  PlayerProfile,
  Question,
} from '../types/game';
import { HeroPortraitSvg, MonsterBadgeSvg } from './CharacterSvg';

interface WorldMapScreenProps {
  areas: AreaDef[];
  heroes?: HeroDef[];
  monsters?: Record<string, MonsterDef>;
  questions: Question[];
  profile: PlayerProfile;
  settings: GameSettings;
  focusedAreaId?: string;
  transitionFromAreaId?: string | null;
  onSelectArea?: (areaId: string) => void;
  onClearTransition?: () => void;
  onStartLevel: (area: AreaDef, level: LevelDef) => void;
  onBackToSetup: () => void;
  onBackToTitle: () => void;
}

export const WorldMapScreen: React.FC<WorldMapScreenProps> = ({
  areas,
  heroes = HEROES,
  monsters = MONSTERS,
  questions,
  profile,
  settings,
  focusedAreaId,
  transitionFromAreaId,
  onSelectArea,
  onClearTransition,
  onStartLevel,
  onBackToSetup,
  onBackToTitle,
}) => {
  const sortedAreas = useMemo(() => [...areas].sort((a, b) => a.order - b.order), [areas]);
  const [selectedAreaId, setSelectedAreaId] = useState<string>(
    () => focusedAreaId || sortedAreas[0]?.id || ''
  );

  // Sync external focusedAreaId updates (e.g., auto-advanced after winning an area)
  useEffect(() => {
    if (focusedAreaId && sortedAreas.some((a) => a.id === focusedAreaId)) {
      setSelectedAreaId(focusedAreaId);
    }
  }, [focusedAreaId, sortedAreas]);

  // Smooth hero location marker animation from conquered area -> next area
  const initialMarkerArea = useMemo(() => {
    if (transitionFromAreaId) {
      const from = sortedAreas.find((a) => a.id === transitionFromAreaId);
      if (from) return from;
    }
    return sortedAreas.find((a) => a.id === selectedAreaId) || sortedAreas[0];
  }, [transitionFromAreaId, sortedAreas, selectedAreaId]);

  const [markerPos, setMarkerPos] = useState<{ x: number; y: number }>(() => ({
    x: initialMarkerArea?.mapPos.x ?? 20,
    y: initialMarkerArea?.mapPos.y ?? 74,
  }));
  const [isTraveling, setIsTraveling] = useState(Boolean(transitionFromAreaId));

  const selectedArea = sortedAreas.find((a) => a.id === selectedAreaId) || sortedAreas[0];
  const activeHero = heroes.find((h) => h.id === profile.heroId) || heroes[0];

  useEffect(() => {
    if (!selectedArea) return;
    if (transitionFromAreaId && transitionFromAreaId !== selectedArea.id) {
      const fromArea = sortedAreas.find((a) => a.id === transitionFromAreaId);
      if (fromArea) {
        setMarkerPos(fromArea.mapPos);
        setIsTraveling(true);
        const moveTimer = window.setTimeout(() => {
          setMarkerPos(selectedArea.mapPos);
        }, 120);
        const doneTimer = window.setTimeout(() => {
          setIsTraveling(false);
          onClearTransition?.();
        }, 1350);
        return () => {
          window.clearTimeout(moveTimer);
          window.clearTimeout(doneTimer);
        };
      }
    }
    setMarkerPos(selectedArea.mapPos);
    setIsTraveling(false);
  }, [selectedArea, transitionFromAreaId, sortedAreas, onClearTransition]);

  const isAreaUnlocked = (area: AreaDef): boolean => {
    if (settings.unlockAllAreas || area.unlockedByDefault) return true;
    if (profile.unlockedAreaIds.includes(area.id)) return true;
    if (area.prerequisiteAreaId) {
      const prereq = sortedAreas.find((a) => a.id === area.prerequisiteAreaId);
      if (prereq) {
        const lastLevel = prereq.levels[prereq.levels.length - 1];
        if (lastLevel && profile.completedLevels[lastLevel.id]) return true;
      }
    }
    return false;
  };

  const countMatchingQuestions = (level: LevelDef): number => {
    return questions.filter((q) => {
      const topicOk = level.topicFilter === 'ALL' || q.topic.toLowerCase() === level.topicFilter.toLowerCase();
      const indOk =
        !level.indicatorFilter ||
        q.indicator.toLowerCase().includes(level.indicatorFilter.toLowerCase());
      const diffOk = level.difficulty === 'campuran' || q.difficulty === level.difficulty;
      return topicOk && indOk && diffOk;
    }).length;
  };

  const handleSelectPin = (areaId: string) => {
    setSelectedAreaId(areaId);
    onSelectArea?.(areaId);
  };

  return (
    <div className="min-h-screen w-full bg-slate-950 text-slate-100 flex flex-col">
      {/* Header */}
      <header className="flex flex-wrap items-center justify-between gap-4 px-5 py-3.5 bg-slate-900 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBackToSetup}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-sm font-medium text-slate-200 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Hero & Profil</span>
          </button>
          <div>
            <h1 className="font-display text-lg md:text-xl font-bold text-amber-300 leading-tight">
              Peta Dunia Matematika
            </h1>
            <p className="text-xs text-slate-400">
              {profile.name} · {profile.className} · Lv.{profile.level} ({profile.xp} XP)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBackToTitle}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 cursor-pointer"
          >
            Menu Utama
          </button>
        </div>
      </header>

      {/* Main Split: Interactive Map Canvas (Left) + Area & Level Detail Drawer (Right) */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-0 overflow-hidden">
        {/* Left: Illustrated Map with Interactive Nodes inside exact 16:9 frame */}
        <div className="lg:col-span-7 xl:col-span-8 bg-slate-950 flex items-center justify-center p-2 md:p-4 overflow-hidden border-b lg:border-b-0 lg:border-r border-slate-800">
          <div
            className="relative aspect-video rounded-xl overflow-hidden border border-slate-800 bg-slate-900 shadow-2xl"
            style={{ width: 'min(100%, calc((100vh - 7.5rem) * 16 / 9))' }}
          >
            <img
              src={WORLD_MAP_IMG}
              alt="Peta Dunia LANDS of NUMERIA"
              referrerPolicy="no-referrer"
              className="w-full h-full object-fill opacity-95"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = 'none';
              }}
            />
            <div className="absolute inset-0 bg-slate-950/20 pointer-events-none" />

            {/* SVG Connecting Trails */}
            <svg
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              className="absolute inset-0 w-full h-full pointer-events-none"
            >
              {sortedAreas.map((area, idx) => {
                if (idx === 0) return null;
                const prev = sortedAreas[idx - 1];
                const unlocked = isAreaUnlocked(area);
                return (
                  <line
                    key={`trail-${area.id}`}
                    x1={prev.mapPos.x}
                    y1={prev.mapPos.y}
                    x2={area.mapPos.x}
                    y2={area.mapPos.y}
                    stroke={unlocked ? '#fbbf24' : '#64748b'}
                    strokeWidth="0.6"
                    strokeDasharray="1.4 1.2"
                    strokeOpacity={unlocked ? 0.9 : 0.55}
                  />
                );
              })}
            </svg>

            {/* Interactive Area Pins */}
            {sortedAreas.map((area) => {
              const unlocked = isAreaUnlocked(area);
              const isSelected = area.id === selectedArea?.id;
              const totalLevels = area.levels.length;
              const doneLevels = area.levels.filter((l) => Boolean(profile.completedLevels[l.id])).length;

              return (
                <button
                  key={area.id}
                  type="button"
                  onClick={() => handleSelectPin(area.id)}
                  style={{ left: `${area.mapPos.x}%`, top: `${area.mapPos.y}%` }}
                  className={`absolute -translate-x-1/2 -translate-y-1/2 group flex flex-col items-center cursor-pointer transition-transform ${
                    isSelected ? 'scale-110 z-20' : 'hover:scale-105 z-10'
                  }`}
                >
                  <div
                    className={`w-9 h-9 sm:w-11 sm:h-11 rounded-full flex items-center justify-center border-2 shadow-lg transition-colors ${
                      isSelected
                        ? 'bg-amber-400 border-white text-slate-950'
                        : unlocked
                        ? 'bg-slate-900/95 border-amber-400 text-amber-300'
                        : 'bg-slate-900/90 border-slate-600 text-slate-400'
                    }`}
                  >
                    {unlocked ? (
                      doneLevels === totalLevels && totalLevels > 0 ? (
                        <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5" />
                      ) : (
                        <Compass className="w-4 h-4 sm:w-5 sm:h-5" />
                      )
                    ) : (
                      <Lock className="w-4 h-4" />
                    )}
                  </div>
                  <span
                    className={`mt-1 px-2 py-0.5 rounded-md text-[0.6875rem] sm:text-xs font-bold whitespace-nowrap max-w-[9.75rem] truncate shadow ${
                      isSelected
                        ? 'bg-amber-400 text-slate-950'
                        : 'bg-slate-950/90 text-slate-100 border border-slate-700'
                    }`}
                  >
                    {area.order}. {area.name}
                  </span>
                </button>
              );
            })}

            {/* Animated Hero Current-Location Marker gliding between areas */}
            {selectedArea && (
              <div
                style={{ left: `${markerPos.x}%`, top: `${markerPos.y}%` }}
                className="absolute -translate-x-1/2 -translate-y-[128%] z-30 pointer-events-none transition-all duration-1000 ease-in-out flex flex-col items-center"
              >
                <div className="px-2 py-0.5 rounded-md bg-emerald-500 text-slate-950 text-[0.625rem] font-bold shadow mb-1 whitespace-nowrap">
                  {isTraveling ? `Berpindah ke ${selectedArea.name}...` : 'Posisi Hero'}
                </div>
                <div className="p-0.5 rounded-full bg-amber-400 shadow-xl shadow-amber-500/40 border-2 border-white">
                  <HeroPortraitSvg
                    heroId={activeHero?.visualId || profile.heroId}
                    className="w-8 h-8 sm:w-9 sm:h-9"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right: Selected Area Preview & Level Cards */}
        <aside className="lg:col-span-5 xl:col-span-4 bg-slate-900/95 p-5 overflow-y-auto space-y-5">
          {selectedArea && (
            <>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>Wilayah {selectedArea.order}</span>
                  <span>{selectedArea.gradeRecommendation}</span>
                </div>
                <h2 className="font-display text-2xl font-bold text-white">{selectedArea.name}</h2>
                <p className="text-sm font-semibold text-amber-300">{selectedArea.mathTopic}</p>
                <p className="text-sm text-slate-300 leading-relaxed">{selectedArea.description}</p>
              </div>

              {!isAreaUnlocked(selectedArea) && (
                <div className="p-3.5 rounded-xl bg-slate-950 border border-amber-500/40 flex items-start gap-3 text-sm text-amber-200">
                  <Lock className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold">Wilayah Masih Terkunci</p>
                    <p className="text-xs text-slate-300 mt-0.5">
                      Kalahkan bos di wilayah sebelumnya untuk membuka jalur ini, atau aktifkan "Buka Semua
                      Wilayah" di Panel Guru.
                    </p>
                  </div>
                </div>
              )}

              <div className="space-y-3">
                <h3 className="text-sm font-bold text-slate-200">Misi & Monster Penjaga</h3>
                {selectedArea.levels.length === 0 && (
                  <p className="text-sm text-slate-400">Belum ada level pada wilayah ini. Tambahkan lewat Panel Guru.</p>
                )}

                {selectedArea.levels.map((lvl, idx) => {
                  const monster = monsters[lvl.monsterId] || monsters.slime_angka || MONSTERS.slime_angka;
                  const areaUnlocked = isAreaUnlocked(selectedArea);
                  const prevLevel = idx > 0 ? selectedArea.levels[idx - 1] : null;
                  const prevMonster = prevLevel
                    ? monsters[prevLevel.monsterId] || monsters.slime_angka || MONSTERS.slime_angka
                    : null;
                  const prevLevelCompleted = !prevLevel || Boolean(profile.completedLevels[prevLevel.id]);
                  const levelUnlocked = areaUnlocked && prevLevelCompleted;

                  const record = profile.completedLevels[lvl.id];
                  const firstUncompletedIdx = selectedArea.levels.findIndex(
                    (item) => !profile.completedLevels[item.id]
                  );
                  const isNextMission = levelUnlocked && firstUncompletedIdx === idx;
                  const availableQ = countMatchingQuestions(lvl);
                  const topicOnlyQ = questions.filter(
                    (q) => lvl.topicFilter === 'ALL' || q.topic.toLowerCase() === lvl.topicFilter.toLowerCase()
                  ).length;
                  const usableQ = Math.max(availableQ, topicOnlyQ);
                  const insufficient = usableQ === 0;
                  const canEnter = levelUnlocked && !insufficient;

                  return (
                    <div
                      key={lvl.id}
                      className={`p-4 rounded-xl bg-slate-950 border space-y-3 hc-surface ${
                        isNextMission
                          ? 'border-amber-400/70'
                          : !levelUnlocked
                          ? 'border-slate-800/80 opacity-80'
                          : 'border-slate-800'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <MonsterBadgeSvg archetype={monster.archetype} className="w-12 h-12 shrink-0" />
                          <div>
                            <div className="text-xs text-slate-400">
                              {monster.tier === 'boss' ? 'Bos Wilayah' : 'Monster Penjaga'} ·{' '}
                              <span className="capitalize">
                                {selectedArea.id === 'dimensi_tantangan' || lvl.id === 'dimensi_lv1'
                                  ? 'Sulit (HOTS Tantangan Akhir)'
                                  : lvl.difficulty}
                              </span>
                              {isNextMission && (
                                <span className="text-emerald-400 font-semibold"> · Misi Berikutnya</span>
                              )}
                              {areaUnlocked && !prevLevelCompleted && (
                                <span className="text-amber-400 font-semibold"> · Terkunci</span>
                              )}
                            </div>
                            <h4 className="font-bold text-base text-white">{lvl.name}</h4>
                            <p className="text-xs text-amber-300">
                              Lawan: {monster.name} (HP {Math.round(monster.maxHp * settings.monsterHpMultiplier)})
                            </p>
                          </div>
                        </div>

                        {record ? (
                          <div className="flex items-center gap-0.5 text-amber-400" title="Bintang terbaik">
                            {[1, 2, 3].map((s) => (
                              <Star
                                key={s}
                                className={`w-4 h-4 ${s <= record.stars ? 'fill-amber-400' : 'text-slate-700'}`}
                              />
                            ))}
                          </div>
                        ) : (
                          !levelUnlocked && <Lock className="w-4 h-4 text-slate-500 shrink-0 mt-1" />
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400 tabular-nums">
                        <span>Soal sampai HP Monster 0</span>
                        <span>·</span>
                        <span>+{lvl.rewardXp} XP</span>
                        <span>·</span>
                        <span>+{lvl.rewardCoins} Koin</span>
                        {record && (
                          <>
                            <span>·</span>
                            <span className="text-emerald-400">Penguasaan: {record.bestMasteryPct}%</span>
                          </>
                        )}
                      </div>

                      {areaUnlocked && !prevLevelCompleted && prevLevel && (
                        <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-700/80 flex items-center gap-2 text-xs text-slate-300">
                          <Lock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                          <span>
                            Kalahkan <strong className="text-white">{prevMonster?.name}</strong> pada{' '}
                            <strong className="text-amber-300">{prevLevel.name}</strong> terlebih dahulu untuk
                            membuka level ini.
                          </span>
                        </div>
                      )}

                      {insufficient && (
                        <div className="p-2.5 rounded-lg bg-rose-950/60 border border-rose-500/40 flex items-center gap-2 text-xs text-rose-200">
                          <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                          <span>
                            Bank soal topik "{lvl.topicFilter}" masih kosong. Tambahkan soal di Panel Guru.
                          </span>
                        </div>
                      )}

                      <button
                        type="button"
                        disabled={!canEnter}
                        onClick={() => onStartLevel(selectedArea, lvl)}
                        className={`w-full py-2.5 px-4 rounded-lg font-bold text-sm inline-flex items-center justify-center gap-2 transition-colors ${
                          canEnter
                            ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 cursor-pointer'
                            : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                        }`}
                      >
                        {!levelUnlocked ? (
                          <>
                            <Lock className="w-4 h-4" />
                            <span>
                              {!areaUnlocked ? 'Wilayah Terkunci' : 'Selesaikan Level Sebelumnya'}
                            </span>
                          </>
                        ) : (
                          <>
                            {monster.tier === 'boss' ? <Swords className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                            <span>{record ? 'Main Ulang' : 'Masuk Arena Pertarungan'}</span>
                          </>
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>

              {/* Area quick selector strip for mobile/accessibility */}
              <div className="pt-2 border-t border-slate-800">
                <p className="text-xs text-slate-400 mb-2 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-sky-400" />
                  <span>Daftar Cepat Semua Wilayah ({sortedAreas.length})</span>
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {sortedAreas.map((a) => {
                    const ok = isAreaUnlocked(a);
                    return (
                      <button
                        key={`quick-${a.id}`}
                        type="button"
                        onClick={() => handleSelectPin(a.id)}
                        className={`px-3 py-2 rounded-lg text-left text-xs font-medium border transition-colors cursor-pointer flex items-center justify-between ${
                          a.id === selectedArea.id
                            ? 'bg-amber-500/15 border-amber-400 text-amber-200'
                            : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                        }`}
                      >
                        <span className="truncate">{a.name}</span>
                        {!ok && <Lock className="w-3 h-3 text-slate-500 shrink-0 ml-1" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </aside>
      </div>
    </div>
  );
};
