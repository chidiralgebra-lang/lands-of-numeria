import React, { useEffect } from 'react';
import { ArrowRight, Award, Crown, MapPin, Sparkles, Trophy } from 'lucide-react';
import { HEROES, TITLE_BACKDROP_IMG } from '../data/worldData';
import { AttemptRecord, HeroDef } from '../types/game';
import { HeroPortraitSvg } from './CharacterSvg';

interface ChampionCelebrationScreenProps {
  record: AttemptRecord;
  heroes?: HeroDef[];
  finalMonsterName: string;
  totalAreasCount: number;
  totalLevelsCount: number;
  onContinueToResults: () => void;
}

export const ChampionCelebrationScreen: React.FC<ChampionCelebrationScreenProps> = ({
  record,
  heroes = HEROES,
  finalMonsterName,
  totalAreasCount,
  totalLevelsCount,
  onContinueToResults,
}) => {
  const hero = heroes.find((h) => h.id === record.heroId) || heroes[0];

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onContinueToResults();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onContinueToResults]);

  return (
    <div className="relative min-h-screen w-full overflow-x-hidden overflow-y-auto bg-slate-950 text-slate-100 flex items-center justify-center p-4 md:p-8 select-none">
      {/* Atmospheric Royal Victory Backdrop */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <img
          src={TITLE_BACKDROP_IMG}
          alt="Pulau Numeria"
          referrerPolicy="no-referrer"
          className="w-full h-full object-cover object-center opacity-45"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.display = 'none';
          }}
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(circle at 50% 25%, rgba(245, 158, 11, 0.24) 0%, rgba(15, 23, 42, 0.88) 48%, rgba(2, 6, 23, 0.98) 100%)',
          }}
        />
      </div>

      {/* Main Celebration Card */}
      <div className="relative z-10 w-full max-w-3xl rounded-3xl bg-slate-900/92 border border-amber-400/50 shadow-2xl shadow-amber-500/10 backdrop-blur-md p-6 md:p-10 text-center space-y-6">
        {/* Top Royal Crest + Hero Portrait */}
        <div className="flex flex-col items-center gap-3">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-500/15 border border-amber-400/40 text-amber-300 text-xs font-bold tracking-wider uppercase">
            <Crown className="w-4 h-4 text-amber-300" />
            <span>Penobatan Kehormatan · Pulau Numeria</span>
            <Sparkles className="w-4 h-4 text-amber-300" />
          </div>

          <div className="relative mt-2 flex items-center justify-center">
            <div className="absolute -inset-3 rounded-full bg-amber-400/20 blur-xl pointer-events-none" />
            <div className="relative rounded-full p-1.5 bg-gradient-to-b from-amber-300 via-amber-500 to-amber-700 shadow-lg shadow-amber-500/30">
              <div className="rounded-full bg-slate-950 p-1">
                <HeroPortraitSvg
                  heroId={hero.visualId || hero.id}
                  className="w-24 h-24 md:w-28 md:h-28"
                />
              </div>
            </div>
            <div className="absolute -top-3 -right-2 w-10 h-10 rounded-full bg-amber-400 text-slate-950 flex items-center justify-center shadow-lg border-2 border-slate-950">
              <Crown className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* Congratulatory Title & Message */}
        <div className="space-y-3">
          <h1 className="font-display text-3xl md:text-5xl font-extrabold tracking-wide text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-yellow-300 to-amber-400 leading-tight">
            Selamat! Kamu Penguasa Numeria!
          </h1>
          <p className="text-base md:text-lg text-slate-200 leading-relaxed max-w-2xl mx-auto">
            Luar biasa, <span className="font-bold text-amber-300">{record.studentName}</span>! Kamu
            telah melewati wilayah demi wilayah hingga titik terakhir, menaklukkan{' '}
            <span className="font-bold text-white">{finalMonsterName}</span> di{' '}
            <span className="font-semibold text-sky-300">{record.areaName}</span>, dan berhasil{' '}
            <span className="font-bold text-emerald-300">memenangkan semua level</span>. Dengan
            kecerdasan serta kekuatan berpikir logismu, kamu resmi menjadi{' '}
            <span className="font-bold text-amber-300">Penguasa Numeria</span>!
          </p>
        </div>

        {/* Hero & Conquest Summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-left">
          <div className="p-3.5 rounded-2xl bg-slate-950/90 border border-slate-800">
            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              <MapPin className="w-3.5 h-3.5 text-sky-400" />
              <span>Wilayah Takluk</span>
            </div>
            <div className="text-xl font-bold font-mono tabular-nums text-sky-300 mt-1">
              {totalAreasCount}/{totalAreasCount}
            </div>
            <div className="text-xs text-slate-400">Seluruh Pulau Numeria</div>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-950/90 border border-slate-800">
            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              <Trophy className="w-3.5 h-3.5 text-amber-400" />
              <span>Level Dimenangkan</span>
            </div>
            <div className="text-xl font-bold font-mono tabular-nums text-amber-300 mt-1">
              {totalLevelsCount}/{totalLevelsCount}
            </div>
            <div className="text-xs text-slate-400">Semua Misi Tuntas</div>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-950/90 border border-slate-800">
            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              <Award className="w-3.5 h-3.5 text-emerald-400" />
              <span>Penguasaan Akhir</span>
            </div>
            <div className="text-xl font-bold font-mono tabular-nums text-emerald-400 mt-1">
              {record.academicMasteryPct}%
            </div>
            <div className="text-xs text-slate-400 tabular-nums">
              {record.correctCount}/{record.totalQuestions} jawaban benar
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-950/90 border border-slate-800">
            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              <span>Gelar & Hadiah</span>
            </div>
            <div className="text-xl font-bold font-mono tabular-nums text-white mt-1">
              +{record.xpEarned} XP
            </div>
            <div className="text-xs text-amber-300 tabular-nums">
              +{record.coinsEarned} Koin · {hero.name}
            </div>
          </div>
        </div>

        {/* Action Button to Continue to Results Screen */}
        <div className="pt-2 flex flex-col items-center gap-2">
          <button
            type="button"
            onClick={onContinueToResults}
            className="w-full sm:w-auto min-w-[280px] px-8 py-4 rounded-2xl bg-gradient-to-r from-amber-400 via-amber-500 to-yellow-400 hover:from-amber-300 hover:to-yellow-300 text-slate-950 font-extrabold text-base md:text-lg shadow-xl shadow-amber-500/25 inline-flex items-center justify-center gap-3 cursor-pointer transition-transform active:scale-[0.98]"
          >
            <span>Lanjutkan ke Halaman Hasil</span>
            <ArrowRight className="w-5 h-5" />
          </button>
          <span className="text-xs text-slate-400">
            Tekan Enter atau klik tombol di atas untuk melihat rincian hasil pertarungan
          </span>
        </div>
      </div>
    </div>
  );
};
