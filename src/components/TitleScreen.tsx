import React, { useEffect, useState } from 'react';
import {
  ArrowRight,
  BookOpen,
  Coins,
  GraduationCap,
  Play,
  RotateCcw,
  Settings,
  Sparkles,
  Swords,
  UserPlus,
  Users,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { DEFAULT_PROFILE, HEROES, TITLE_BACKDROP_IMG } from '../data/worldData';
import { HeroDef, HeroId, PlayerProfile } from '../types/game';
import { HeroPortraitSvg, TitleCrestSvg } from './CharacterSvg';

interface TitleScreenProps {
  profile: PlayerProfile;
  heroes?: HeroDef[];
  musicOrSfxEnabled: boolean;
  externalModalOpen?: boolean;
  onToggleMute: () => void;
  onContinueAdventure: () => void;
  onStartNewAdventure: () => void;
  onStartLocalTeam: () => void;
  onJoinOnlineClass: () => void;
  onOpenTeacherPanel: () => void;
  onOpenHowToPlay: () => void;
  onOpenSettings: () => void;
  onSelectQuickHero: (heroId: HeroId) => void;
}

export const TitleScreen: React.FC<TitleScreenProps> = ({
  profile,
  heroes = HEROES,
  musicOrSfxEnabled,
  externalModalOpen = false,
  onToggleMute,
  onContinueAdventure,
  onStartNewAdventure,
  onStartLocalTeam,
  onJoinOnlineClass,
  onOpenTeacherPanel,
  onOpenHowToPlay,
  onOpenSettings,
}) => {
  const [showStartChoice, setShowStartChoice] = useState(false);
  const activeHero = heroes.find((h) => h.id === profile.heroId) || heroes[0];
  const completedMissionsCount = Object.keys(profile.completedLevels || {}).length;

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (externalModalOpen) return;
      if (showStartChoice) {
        if (e.key === 'Escape') {
          e.preventDefault();
          setShowStartChoice(false);
        }
        return;
      }
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        setShowStartChoice(true);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [showStartChoice, externalModalOpen]);

  return (
    <div className="relative w-full h-full min-h-screen overflow-hidden bg-slate-950 flex flex-col justify-between select-none">
      {/* Live atmospheric backdrop */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <img
          src={TITLE_BACKDROP_IMG}
          alt="Dunia Petualangan LANDS of NUMERIA"
          referrerPolicy="no-referrer"
          className="w-full h-full object-cover object-center animate-slow-pan opacity-85"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.display = 'none';
          }}
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(105deg, rgba(2,6,23,0.92) 0%, rgba(2,6,23,0.68) 48%, rgba(2,6,23,0.38) 100%)',
          }}
        />
      </div>

      {/* Top minimal utility bar (transparent, unobtrusive) */}
      <header className="relative z-10 flex items-center justify-between px-6 py-4 md:px-10">
        <div className="flex items-center gap-3 text-sm text-slate-200/90">
          <HeroPortraitSvg heroId={activeHero?.visualId || profile.heroId} className="w-9 h-9" />
          <div>
            <span className="font-semibold text-white">{profile.name}</span>
            <span className="mx-2 text-slate-400">·</span>
            <span className="font-mono text-amber-300 tabular-nums">Lv.{profile.level}</span>
            <span className="mx-2 text-slate-400">·</span>
            <span className="font-mono text-emerald-300 tabular-nums">{profile.coins} Koin</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onOpenHowToPlay}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-slate-900/80 hover:bg-slate-800 border border-slate-700/80 text-sm font-medium text-slate-100 transition-colors cursor-pointer"
          >
            <BookOpen className="w-4 h-4 text-sky-400" />
            <span>Cara Bermain</span>
          </button>
          <button
            type="button"
            onClick={onOpenSettings}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-slate-900/80 hover:bg-slate-800 border border-slate-700/80 text-sm font-medium text-slate-100 transition-colors cursor-pointer"
          >
            <Settings className="w-4 h-4 text-amber-400" />
            <span>Pengaturan</span>
          </button>
          <button
            type="button"
            onClick={onToggleMute}
            aria-label={musicOrSfxEnabled ? 'Bisukan audio' : 'Aktifkan audio'}
            className="p-2 rounded-lg bg-slate-900/80 hover:bg-slate-800 border border-slate-700/80 text-slate-100 transition-colors cursor-pointer"
          >
            {musicOrSfxEnabled ? (
              <Volume2 className="w-4 h-4 text-emerald-400" />
            ) : (
              <VolumeX className="w-4 h-4 text-rose-400" />
            )}
          </button>
        </div>
      </header>

      {/* Main Focal Content anchored on calm left/upper-left negative space */}
      <main className="relative z-10 flex-1 flex items-center px-6 md:px-12 lg:px-16 py-4">
        <div className="max-w-2xl space-y-6">
          <TitleCrestSvg className="w-full max-w-[35rem] h-auto" />

          <p className="text-base md:text-lg text-slate-200 leading-relaxed max-w-xl">
            Pilih pahlawanmu, jelajahi 5+ wilayah matematika dari Hutan Bilangan hingga Menara Logika,
            dan taklukkan monster dengan kekuatan berpikir logis.
          </p>

          {/* Primary & Secondary Actions */}
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <button
              type="button"
              onClick={() => setShowStartChoice(true)}
              className="inline-flex items-center gap-3 px-7 py-3.5 rounded-xl bg-amber-500 hover:bg-amber-400 active:translate-y-0.5 text-slate-950 font-bold text-base shadow-lg shadow-amber-500/25 transition-all cursor-pointer hc-button"
            >
              <Play className="w-5 h-5 fill-slate-950" />
              <span>Mulai Bermain</span>
            </button>

            <button
              type="button"
              onClick={onStartLocalTeam}
              className="inline-flex items-center gap-2.5 px-5 py-3.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-emerald-500/50 text-emerald-100 font-semibold text-sm transition-colors cursor-pointer"
            >
              <Swords className="w-4 h-4 text-emerald-400" />
              <span>Team Battle Lokal</span>
            </button>

            <button
              type="button"
              onClick={onJoinOnlineClass}
              className="inline-flex items-center gap-2.5 px-5 py-3.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-sky-500/50 text-sky-100 font-semibold text-sm transition-colors cursor-pointer"
            >
              <Users className="w-4 h-4 text-sky-400" />
              <span>Masuk Kelas</span>
            </button>

            <button
              type="button"
              onClick={onOpenTeacherPanel}
              className="inline-flex items-center gap-2.5 px-5 py-3.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-slate-600 text-slate-100 font-semibold text-sm transition-colors cursor-pointer"
            >
              <GraduationCap className="w-4 h-4 text-amber-400" />
              <span>Panel Guru</span>
            </button>
          </div>
        </div>
      </main>

      {/* Single flat control-hint footer line */}
      <footer className="relative z-10 px-6 py-3 md:px-12 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400 bg-slate-950/70 border-t border-slate-800/70">
        <span>Enter / Spasi Mulai · 1–4 Pilih Jawaban · Esc Jeda · Mouse & Layar Sentuh Didukung</span>
        <span>Penyimpanan lokal perangkat + dukungan sesi kelas daring</span>
      </footer>

      {/* Start Adventure Choice Modal */}
      {showStartChoice && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4"
          onClick={() => setShowStartChoice(false)}
        >
          <div
            className="w-full max-w-2xl rounded-2xl bg-slate-900 border border-slate-700/90 shadow-2xl p-6 space-y-5 hc-surface"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="font-display text-2xl font-bold text-white">
                  Pilih Petualangan
                </h2>
                <p className="text-sm text-slate-300 mt-1">
                  Lanjutkan permainan dengan karakter sebelumnya atau mulai baru dengan karakter dan nama siswa baru.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowStartChoice(false)}
                aria-label="Tutup pilihan"
                className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Option 1: Continue Previous Character */}
              <button
                type="button"
                onClick={() => {
                  setShowStartChoice(false);
                  onContinueAdventure();
                }}
                className="group text-left p-5 rounded-xl bg-slate-950/90 hover:bg-slate-800/90 border border-amber-400/50 hover:border-amber-400 transition-all flex flex-col justify-between gap-4 cursor-pointer"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wide text-amber-300">
                      Karakter Sebelumnya
                    </span>
                    <Play className="w-4 h-4 text-amber-400" />
                  </div>

                  <div className="flex items-center gap-3">
                    <HeroPortraitSvg
                      heroId={activeHero?.visualId || profile.heroId}
                      className="w-14 h-14 shrink-0"
                    />
                    <div className="min-w-0">
                      <div className="font-bold text-lg text-white truncate">{profile.name}</div>
                      <div className="text-xs text-slate-400 truncate">
                        {profile.className} · {activeHero?.name} ({activeHero?.archetype})
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-800 text-xs font-mono tabular-nums">
                    <div>
                      <div className="text-slate-400 font-sans">Level</div>
                      <div className="text-amber-300 font-bold">Lv.{profile.level}</div>
                    </div>
                    <div>
                      <div className="text-slate-400 font-sans">Koin</div>
                      <div className="text-emerald-300 font-bold">{profile.coins}</div>
                    </div>
                    <div>
                      <div className="text-slate-400 font-sans">Misi Selesai</div>
                      <div className="text-sky-300 font-bold">{completedMissionsCount}</div>
                    </div>
                  </div>
                </div>

                <div className="w-full py-2.5 px-4 rounded-lg bg-amber-500 group-hover:bg-amber-400 text-slate-950 font-bold text-sm inline-flex items-center justify-center gap-2">
                  <span>Lanjutkan Bermain</span>
                  <ArrowRight className="w-4 h-4" />
                </div>
              </button>

              {/* Option 2: New Character & New Student Name */}
              <button
                type="button"
                onClick={() => {
                  setShowStartChoice(false);
                  onStartNewAdventure();
                }}
                className="group text-left p-5 rounded-xl bg-slate-950/90 hover:bg-slate-800/90 border border-emerald-500/40 hover:border-emerald-400 transition-all flex flex-col justify-between gap-4 cursor-pointer"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wide text-emerald-300">
                      Petualang Baru
                    </span>
                    <UserPlus className="w-4 h-4 text-emerald-400" />
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="w-14 h-14 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center shrink-0">
                      <Sparkles className="w-7 h-7 text-emerald-300" />
                    </div>
                    <div>
                      <div className="font-bold text-lg text-white">Karakter & Nama Baru</div>
                      <div className="text-xs text-slate-400">
                        Isi nama siswa baru dan pilih hero awal dari nol
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-800 text-xs font-mono tabular-nums">
                    <div>
                      <div className="text-slate-400 font-sans">Mulai</div>
                      <div className="text-white font-bold">Wilayah 1</div>
                    </div>
                    <div>
                      <div className="text-slate-400 font-sans">Koin Awal</div>
                      <div className="text-emerald-300 font-bold flex items-center gap-1">
                        <Coins className="w-3 h-3" />
                        {DEFAULT_PROFILE.coins}
                      </div>
                    </div>
                    <div>
                      <div className="text-slate-400 font-sans">Level</div>
                      <div className="text-amber-300 font-bold">Lv.1</div>
                    </div>
                  </div>
                </div>

                <div className="w-full py-2.5 px-4 rounded-lg bg-emerald-500 group-hover:bg-emerald-400 text-slate-950 font-bold text-sm inline-flex items-center justify-center gap-2">
                  <RotateCcw className="w-4 h-4" />
                  <span>Mulai dari Awal</span>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
