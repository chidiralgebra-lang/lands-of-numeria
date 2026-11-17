import React, { useState } from 'react';
import {
  ArrowRight,
  Award,
  CheckCircle2,
  Download,
  Home,
  Map,
  Printer,
  RotateCcw,
  Target,
  XCircle,
} from 'lucide-react';
import { HEROES } from '../data/worldData';
import { AreaDef, AttemptRecord, HeroDef, LevelDef } from '../types/game';
import { HeroPortraitSvg } from './CharacterSvg';
import { PrintableReportSheet } from './PrintableReportSheet';

interface ResultsScreenProps {
  record: AttemptRecord;
  heroes?: HeroDef[];
  nextTarget?: { area: AreaDef; level: LevelDef; isNewArea: boolean } | null;
  showExplanation: boolean;
  onContinueNext?: () => void;
  onPlayAgain: () => void;
  onPracticeWeak: (weakTopic: string) => void;
  onBackToMap: () => void;
  onBackToTitle: () => void;
}

export const ResultsScreen: React.FC<ResultsScreenProps> = ({
  record,
  heroes = HEROES,
  nextTarget,
  showExplanation,
  onContinueNext,
  onPlayAgain,
  onPracticeWeak,
  onBackToMap,
  onBackToTitle,
}) => {
  const [showPrintModal, setShowPrintModal] = useState(false);
  const hero = heroes.find((h) => h.id === record.heroId) || heroes[0];
  const strongIndicators = record.indicatorStats.filter((i) => i.accuracyPct >= 75);
  const weakIndicators = record.indicatorStats.filter((i) => i.accuracyPct < 75);

  const handleDownloadJson = () => {
    const blob = new Blob([JSON.stringify(record, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `hasil-${record.studentName.replace(/\s+/g, '_')}-${record.levelId}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen w-full bg-slate-950 text-slate-100 p-4 md:p-8 overflow-y-auto">
      <div className={`max-w-4xl mx-auto space-y-6 ${showPrintModal ? 'no-print' : ''}`}>
        {/* Header Summary Card */}
        <div className="rounded-2xl bg-slate-900 border border-slate-800 p-6 space-y-5 print-only-clean">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <HeroPortraitSvg heroId={hero.visualId || hero.id} className="w-16 h-16 shrink-0" />
              <div>
                <div className="text-xs font-semibold text-amber-300">
                  {record.wonBattle ? 'Misi Berhasil Diselesaikan' : 'Sesi Latihan Selesai'} ·{' '}
                  {record.areaName}
                </div>
                <h1 className="font-display text-2xl md:text-3xl font-bold text-white">
                  {record.levelName}
                </h1>
                <p className="text-sm text-slate-300">
                  {record.studentName} · {record.className} · Hero: {hero.name} ({hero.archetype}) · Durasi{' '}
                  <span className="font-mono tabular-nums">{record.durationSec} detik</span>
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 no-print">
              <button
                type="button"
                onClick={() => setShowPrintModal(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>Cetak Hasil</span>
              </button>
              <button
                type="button"
                onClick={handleDownloadJson}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>Unduh JSON</span>
              </button>
            </div>
          </div>

          {/* Separated Academic vs Game Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-2 border-t border-slate-800">
            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800">
              <div className="text-xs text-slate-400">Nilai Penguasaan Materi</div>
              <div className="text-2xl font-bold font-mono tabular-nums text-emerald-400 mt-1">
                {record.academicMasteryPct}%
              </div>
              <div className="text-xs text-slate-400 mt-0.5 tabular-nums">
                {record.correctCount} benar · {record.wrongCount} salah
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800">
              <div className="text-xs text-slate-400">Skor Permainan</div>
              <div className="text-2xl font-bold font-mono tabular-nums text-amber-300 mt-1">
                {record.gameScore}
              </div>
              <div className="text-xs text-slate-400 mt-0.5">Terpisah dari nilai akademik</div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800">
              <div className="text-xs text-slate-400">Hadiah Petualangan</div>
              <div className="text-2xl font-bold font-mono tabular-nums text-sky-300 mt-1">
                +{record.xpEarned} XP
              </div>
              <div className="text-xs text-amber-300 mt-0.5 tabular-nums">+{record.coinsEarned} Koin</div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800">
              <div className="text-xs text-slate-400">Total Soal</div>
              <div className="text-2xl font-bold font-mono tabular-nums text-white mt-1">
                {record.totalQuestions}
              </div>
              <div className="text-xs text-slate-400 mt-0.5 tabular-nums">
                {record.unansweredCount} belum terjawab
              </div>
            </div>
          </div>
        </div>

        {/* Indicator Mastery Breakdown */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-2xl bg-slate-900 border border-slate-800 p-5 space-y-3 print-only-clean">
            <h2 className="font-bold text-base text-emerald-300 flex items-center gap-2">
              <Award className="w-4 h-4" />
              <span>Indikator Kuat</span>
            </h2>
            {strongIndicators.length === 0 ? (
              <p className="text-sm text-slate-400">Belum ada indikator dengan ketepatan ≥ 75% pada sesi ini.</p>
            ) : (
              <ul className="space-y-2">
                {strongIndicators.map((ind, idx) => (
                  <li key={idx} className="p-3 rounded-lg bg-slate-950 border border-slate-800 text-sm">
                    <div className="font-medium text-slate-100">{ind.indicator}</div>
                    <div className="text-xs text-emerald-400 mt-1 tabular-nums">
                      Ketepatan {ind.accuracyPct}% ({ind.correct}/{ind.total} soal
                      {ind.total < 3 ? ' — indikasi awal, sampel terbatas' : ''})
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-2xl bg-slate-900 border border-slate-800 p-5 space-y-3 print-only-clean">
            <h2 className="font-bold text-base text-amber-300 flex items-center gap-2">
              <Target className="w-4 h-4" />
              <span>Indikator Perlu Latihan</span>
            </h2>
            {weakIndicators.length === 0 ? (
              <p className="text-sm text-slate-400">Semua indikator pada sesi ini sudah dikuasai dengan baik.</p>
            ) : (
              <div className="space-y-2">
                <ul className="space-y-2">
                  {weakIndicators.map((ind, idx) => (
                    <li key={idx} className="p-3 rounded-lg bg-slate-950 border border-slate-800 text-sm">
                      <div className="font-medium text-slate-100">{ind.indicator}</div>
                      <div className="text-xs text-amber-400 mt-1 tabular-nums">
                        Ketepatan {ind.accuracyPct}% ({ind.correct}/{ind.total} soal
                        {ind.total < 3 ? ' — perlu soal tambahan untuk kepastian' : ''})
                      </div>
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  onClick={() => onPracticeWeak(weakIndicators[0].topic)}
                  className="w-full mt-2 py-2 px-4 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/50 text-emerald-200 text-xs font-bold cursor-pointer no-print"
                >
                  Latih Ulang Topik: {weakIndicators[0].topic}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Question-by-Question Review */}
        {showExplanation && (
          <div className="rounded-2xl bg-slate-900 border border-slate-800 p-5 space-y-3 print-only-clean">
            <h2 className="font-bold text-base text-white">Rincian Jawaban & Pembahasan</h2>
            <div className="space-y-3">
              {record.questionLogs.map((log, i) => (
                <div key={i} className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-xs font-semibold text-slate-400">
                      Soal {i + 1} · {log.topic} · {log.indicator}
                    </span>
                    {log.pendingTeacherReview ? (
                      <span className="text-xs font-bold text-sky-300">Menunggu Penilaian Guru</span>
                    ) : log.isCorrect ? (
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-400">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Benar
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-rose-400">
                        <XCircle className="w-3.5 h-3.5" /> Perlu Perbaikan
                      </span>
                    )}
                  </div>
                  <p className="text-sm font-medium text-slate-100">{log.prompt}</p>
                  <div className="text-xs text-slate-300 flex flex-wrap gap-4 pt-1">
                    <span>
                      Jawabanmu: <strong className="text-white">{log.studentAnswer || '(Kosong)'}</strong>
                    </span>
                    {!log.pendingTeacherReview && (
                      <span>
                        Kunci: <strong className="text-emerald-300">{log.correctAnswer}</strong>
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Navigation Buttons */}
        <div className="flex flex-wrap items-center justify-center gap-3 pb-6 no-print">
          {record.wonBattle && nextTarget && onContinueNext && (
            <button
              type="button"
              onClick={onContinueNext}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm cursor-pointer shadow-lg shadow-amber-500/20"
            >
              <span>
                {nextTarget.isNewArea
                  ? `Lanjut ke ${nextTarget.area.name}: ${nextTarget.level.name}`
                  : `Lanjut ke Misi Berikutnya: ${nextTarget.level.name}`}
              </span>
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
          <button
            type="button"
            onClick={onPlayAgain}
            className={`inline-flex items-center gap-2 px-5 py-3 rounded-xl font-bold text-sm cursor-pointer ${
              record.wonBattle && nextTarget
                ? 'bg-slate-800 hover:bg-slate-700 text-slate-100'
                : 'bg-amber-500 hover:bg-amber-400 text-slate-950'
            }`}
          >
            <RotateCcw className="w-4 h-4" />
            <span>Main Lagi</span>
          </button>
          <button
            type="button"
            onClick={onBackToMap}
            className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 font-semibold text-sm cursor-pointer"
          >
            <Map className="w-4 h-4 text-emerald-400" />
            <span>Kembali ke Peta</span>
          </button>
          <button
            type="button"
            onClick={onBackToTitle}
            className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 font-semibold text-sm cursor-pointer"
          >
            <Home className="w-4 h-4" />
            <span>Menu Utama</span>
          </button>
        </div>
      </div>

      {showPrintModal && (
        <PrintableReportSheet
          mode="student"
          attempts={[record]}
          selectedAttempt={record}
          aggregateIndicators={record.indicatorStats}
          onClose={() => setShowPrintModal(false)}
        />
      )}
    </div>
  );
};
