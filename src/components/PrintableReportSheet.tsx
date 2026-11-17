import React from 'react';
import { Download, Printer, X } from 'lucide-react';
import { AttemptRecord, IndicatorSummary } from '../types/game';

interface PrintableReportSheetProps {
  mode: 'summary' | 'student';
  attempts: AttemptRecord[];
  selectedAttempt?: AttemptRecord | null;
  aggregateIndicators: IndicatorSummary[];
  filterLabel?: string;
  onClose: () => void;
}

function formatDateId(iso: string): string {
  try {
    return new Date(iso).toLocaleString('id-ID', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function escapeHtml(text: string): string {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildStandaloneHtml(
  mode: 'summary' | 'student',
  attempts: AttemptRecord[],
  selectedAttempt: AttemptRecord | null | undefined,
  aggregateIndicators: IndicatorSummary[],
  filterLabel?: string
): string {
  const title =
    mode === 'student' && selectedAttempt
      ? `Hasil Pekerjaan Siswa - ${selectedAttempt.studentName}`
      : 'Laporan Rekapitulasi Hasil Belajar - LANDS of NUMERIA';

  let bodyHtml = '';
  if (mode === 'student' && selectedAttempt) {
    const att = selectedAttempt;
    const rows = att.questionLogs
      .map(
        (log, i) => `
      <div class="q-card">
        <div class="q-meta">
          <strong>Soal ${i + 1}</strong> · ${escapeHtml(log.topic)} · ${escapeHtml(log.indicator)} ·
          <span class="badge ${
            log.pendingTeacherReview ? 'badge-wait' : log.isCorrect ? 'badge-ok' : 'badge-no'
          }">
            ${
              log.pendingTeacherReview
                ? 'Menunggu Penilaian Guru'
                : log.isCorrect
                ? 'Benar'
                : 'Belum Tepat'
            }
            ${typeof log.teacherScorePct === 'number' ? ` (Skor Rubrik: ${log.teacherScorePct}%)` : ''}
          </span>
        </div>
        <p class="q-prompt">${escapeHtml(log.prompt)}</p>
        <div class="q-ans">
          <div><strong>Jawaban Siswa:</strong> ${escapeHtml(log.studentAnswer || '(Kosong)')}</div>
          <div><strong>Kunci / Acuan:</strong> ${escapeHtml(log.correctAnswer)}</div>
          ${log.teacherNote ? `<div><strong>Catatan Guru:</strong> ${escapeHtml(log.teacherNote)}</div>` : ''}
        </div>
      </div>`
      )
      .join('');

    const indRows = att.indicatorStats
      .map(
        (ind) => `
      <tr>
        <td>${escapeHtml(ind.indicator)}</td>
        <td>${escapeHtml(ind.topic)}</td>
        <td class="num">${ind.correct}/${ind.total}</td>
        <td class="num"><strong>${ind.accuracyPct}%</strong>${ind.total < 3 ? ' (sampel terbatas)' : ''}</td>
      </tr>`
      )
      .join('');

    bodyHtml = `
      <div class="header">
        <h1>LEMBAR HASIL PEKERJAAN SISWA</h1>
        <p class="subtitle">LANDS of NUMERIA — Math Monster Adventure</p>
      </div>
      <table class="meta-table">
        <tr><td><strong>Nama Siswa / Tim</strong></td><td>${escapeHtml(att.studentName)}</td><td><strong>Kelas</strong></td><td>${escapeHtml(att.className)}</td></tr>
        <tr><td><strong>Wilayah & Level</strong></td><td>${escapeHtml(att.areaName)} — ${escapeHtml(att.levelName)}</td><td><strong>Tanggal</strong></td><td>${escapeHtml(formatDateId(att.dateIso))}</td></tr>
        <tr><td><strong>Nilai Penguasaan Materi</strong></td><td><strong>${att.academicMasteryPct}%</strong> (${att.correctCount}/${att.totalQuestions} benar)</td><td><strong>Skor Permainan & Durasi</strong></td><td>${att.gameScore} pts · ${att.durationSec} detik</td></tr>
      </table>
      <h2>Ringkasan Ketuntasan Indikator</h2>
      <table class="data-table">
        <thead><tr><th>Indikator</th><th>Topik</th><th>Benar/Total</th><th>Ketepatan</th></tr></thead>
        <tbody>${indRows}</tbody>
      </table>
      <h2>Rincian Jawaban Pekerjaan Siswa</h2>
      ${rows}
    `;
  } else {
    const attemptRows = attempts
      .map(
        (att, idx) => `
      <tr>
        <td class="num">${idx + 1}</td>
        <td><strong>${escapeHtml(att.studentName)}</strong></td>
        <td>${escapeHtml(att.className)}</td>
        <td>${escapeHtml(att.areaName)} — ${escapeHtml(att.levelName)}</td>
        <td>${escapeHtml(formatDateId(att.dateIso))}</td>
        <td class="num"><strong>${att.academicMasteryPct}%</strong> (${att.correctCount}/${att.totalQuestions})</td>
        <td class="num">${att.gameScore}</td>
        <td class="num">${att.durationSec} dtk</td>
      </tr>`
      )
      .join('');

    const indRows = aggregateIndicators
      .map(
        (ind) => `
      <tr>
        <td>${escapeHtml(ind.indicator)}</td>
        <td>${escapeHtml(ind.topic)}</td>
        <td class="num">${ind.correct}/${ind.total}</td>
        <td class="num"><strong>${ind.accuracyPct}%</strong>${ind.total < 3 ? ' (sampel terbatas)' : ''}</td>
      </tr>`
      )
      .join('');

    bodyHtml = `
      <div class="header">
        <h1>LAPORAN HASIL BELAJAR MATEMATIKA</h1>
        <p class="subtitle">LANDS of NUMERIA — Math Monster Adventure${filterLabel ? ` · Filter: ${escapeHtml(filterLabel)}` : ''}</p>
        <p class="subtitle">Dicetak pada: ${escapeHtml(formatDateId(new Date().toISOString()))}</p>
      </div>
      <h2>Rekapitulasi Sesi & Nilai Siswa (${attempts.length} Catatan)</h2>
      <table class="data-table">
        <thead>
          <tr>
            <th>No</th><th>Nama Siswa / Tim</th><th>Kelas</th><th>Wilayah & Level</th>
            <th>Tanggal</th><th>Nilai Akademik</th><th>Skor Game</th><th>Durasi</th>
          </tr>
        </thead>
        <tbody>${attemptRows}</tbody>
      </table>
      <h2>Ketuntasan Rata-Rata per Indikator</h2>
      <table class="data-table">
        <thead><tr><th>Indikator Pembelajaran</th><th>Topik</th><th>Benar/Total</th><th>Ketepatan</th></tr></thead>
        <tbody>${indRows}</tbody>
      </table>
    `;
  }

  return `<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(title)}</title>
<style>
  body { font-family: "Plus Jakarta Sans", Arial, sans-serif; color: #0f172a; background: #ffffff; margin: 24px; line-height: 1.5; font-size: 13px; }
  .header { border-bottom: 2px solid #0f172a; padding-bottom: 10px; margin-bottom: 16px; }
  h1 { margin: 0; font-size: 20px; }
  h2 { margin: 20px 0 8px; font-size: 15px; border-bottom: 1px solid #cbd5e1; padding-bottom: 4px; }
  .subtitle { margin: 3px 0 0; color: #475569; font-size: 12px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 14px; }
  .meta-table td { border: 1px solid #cbd5e1; padding: 6px 10px; font-size: 12px; }
  .data-table th, .data-table td { border: 1px solid #cbd5e1; padding: 6px 8px; text-align: left; font-size: 12px; }
  .data-table th { background: #f1f5f9; }
  .num { font-variant-numeric: tabular-nums; white-space: nowrap; }
  .q-card { border: 1px solid #cbd5e1; border-radius: 6px; padding: 10px 12px; margin-bottom: 10px; page-break-inside: avoid; }
  .q-meta { font-size: 11px; color: #475569; margin-bottom: 4px; }
  .q-prompt { font-weight: 600; margin: 4px 0 6px; font-size: 13px; }
  .q-ans { font-size: 12px; background: #f8fafc; padding: 6px 8px; border-radius: 4px; }
  .badge { font-weight: 700; }
  .badge-ok { color: #047857; }
  .badge-no { color: #be123c; }
  .badge-wait { color: #0369a1; }
  @media print { body { margin: 12mm; } }
</style>
</head>
<body>${bodyHtml}</body>
</html>`;
}

export const PrintableReportSheet: React.FC<PrintableReportSheetProps> = ({
  mode,
  attempts,
  selectedAttempt,
  aggregateIndicators,
  filterLabel,
  onClose,
}) => {
  const handlePrintNow = () => {
    window.print();
  };

  const handleDownloadHtml = () => {
    const html = buildStandaloneHtml(mode, attempts, selectedAttempt, aggregateIndicators, filterLabel);
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const safeName =
      mode === 'student' && selectedAttempt
        ? `hasil_pekerjaan_${selectedAttempt.studentName.replace(/\s+/g, '_')}.html`
        : 'laporan_hasil_belajar_kelas.html';
    a.download = safeName;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/90 flex flex-col p-3 md:p-6 overflow-y-auto print-sheet-overlay">
      {/* Action Bar (hidden during print) */}
      <div className="max-w-5xl w-full mx-auto mb-4 flex flex-wrap items-center justify-between gap-3 bg-slate-900 border border-slate-700 rounded-xl p-3.5 no-print">
        <div>
          <h2 className="font-bold text-sm md:text-base text-white">
            Pratinjau Cetak (Format Kertas Putih A4)
          </h2>
          <p className="text-xs text-slate-400">
            Klik "Cetak Sekarang" untuk mencetak atau simpan sebagai PDF. Jika jendela pratinjau terblokir
            browser, gunakan "Unduh Dokumen Siap Cetak (.html)".
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleDownloadHtml}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-100 text-xs font-semibold cursor-pointer"
          >
            <Download className="w-4 h-4 text-sky-400" />
            <span>Unduh Dokumen (.html)</span>
          </button>
          <button
            type="button"
            onClick={handlePrintNow}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>Cetak Sekarang</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
            aria-label="Tutup pratinjau cetak"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* White Paper A4 Printable Area */}
      <div
        id="printable-sheet"
        className="max-w-5xl w-full mx-auto bg-white text-slate-900 rounded-xl shadow-2xl p-6 md:p-10 space-y-6"
      >
        {mode === 'student' && selectedAttempt ? (
          <>
            <div className="border-b-2 border-slate-900 pb-4 flex flex-wrap items-end justify-between gap-4">
              <div>
                <div className="text-xs font-bold tracking-wider text-slate-500 uppercase">
                  LANDS of NUMERIA — Math Monster Adventure
                </div>
                <h1 className="text-2xl font-bold text-slate-900 mt-1">
                  Lembar Hasil Pekerjaan Siswa
                </h1>
              </div>
              <div className="text-xs text-slate-600 text-right">
                Tanggal Sesi: {formatDateId(selectedAttempt.dateIso)}
              </div>
            </div>

            {/* Metadata Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs border border-slate-300 rounded-lg p-3.5 bg-slate-50">
              <div>
                <div className="text-slate-500">Nama Siswa / Tim</div>
                <div className="font-bold text-sm text-slate-900">{selectedAttempt.studentName}</div>
              </div>
              <div>
                <div className="text-slate-500">Kelas & Mode</div>
                <div className="font-semibold text-slate-900">
                  {selectedAttempt.className} ({selectedAttempt.mode.replace('_', ' ')})
                </div>
              </div>
              <div>
                <div className="text-slate-500">Wilayah & Level</div>
                <div className="font-semibold text-slate-900">
                  {selectedAttempt.areaName} — {selectedAttempt.levelName}
                </div>
              </div>
              <div>
                <div className="text-slate-500">Durasi Pengerjaan</div>
                <div className="font-mono font-semibold text-slate-900 tabular-nums">
                  {selectedAttempt.durationSec} detik
                </div>
              </div>
            </div>

            {/* Score Summary */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-3 rounded-lg border border-slate-300">
                <div className="text-slate-500">Nilai Penguasaan Materi</div>
                <div className="text-xl font-bold font-mono text-emerald-700 tabular-nums">
                  {selectedAttempt.academicMasteryPct}%
                </div>
              </div>
              <div className="p-3 rounded-lg border border-slate-300">
                <div className="text-slate-500">Jawaban Benar / Salah</div>
                <div className="text-xl font-bold font-mono text-slate-900 tabular-nums">
                  {selectedAttempt.correctCount} / {selectedAttempt.wrongCount}
                </div>
              </div>
              <div className="p-3 rounded-lg border border-slate-300">
                <div className="text-slate-500">Skor Permainan</div>
                <div className="text-xl font-bold font-mono text-amber-700 tabular-nums">
                  {selectedAttempt.gameScore}
                </div>
              </div>
              <div className="p-3 rounded-lg border border-slate-300">
                <div className="text-slate-500">Status Misi</div>
                <div className="text-base font-bold text-slate-900 mt-1">
                  {selectedAttempt.wonBattle ? 'Lulus / Menang' : 'Latihan'}
                </div>
              </div>
            </div>

            {/* Indicator Table */}
            <div className="space-y-2">
              <h3 className="font-bold text-sm text-slate-900 border-b border-slate-300 pb-1">
                Ketuntasan per Indikator
              </h3>
              <table className="w-full text-left text-xs border-collapse border border-slate-300">
                <thead className="bg-slate-100">
                  <tr>
                    <th className="border border-slate-300 p-2">Indikator</th>
                    <th className="border border-slate-300 p-2">Topik</th>
                    <th className="border border-slate-300 p-2">Benar / Total</th>
                    <th className="border border-slate-300 p-2">Ketepatan</th>
                  </tr>
                </thead>
                <tbody className="tabular-nums">
                  {selectedAttempt.indicatorStats.map((ind, idx) => (
                    <tr key={idx}>
                      <td className="border border-slate-300 p-2">{ind.indicator}</td>
                      <td className="border border-slate-300 p-2">{ind.topic}</td>
                      <td className="border border-slate-300 p-2 font-mono">
                        {ind.correct}/{ind.total}
                      </td>
                      <td className="border border-slate-300 p-2 font-mono font-bold">
                        {ind.accuracyPct}%{ind.total < 3 ? ' (sampel terbatas)' : ''}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Detailed Question-by-Question Student Work */}
            <div className="space-y-3">
              <h3 className="font-bold text-sm text-slate-900 border-b border-slate-300 pb-1">
                Rincian Butir Soal & Jawaban Siswa
              </h3>
              {selectedAttempt.questionLogs.map((log, i) => (
                <div
                  key={i}
                  className="p-3.5 rounded-lg border border-slate-300 space-y-1.5 break-inside-avoid"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
                    <span>
                      <strong>Soal {i + 1}</strong> · {log.topic} · {log.indicator} ({log.type.replace('_', ' ')})
                    </span>
                    <span
                      className={`font-bold ${
                        log.pendingTeacherReview
                          ? 'text-sky-700'
                          : log.isCorrect
                          ? 'text-emerald-700'
                          : 'text-rose-700'
                      }`}
                    >
                      {log.pendingTeacherReview
                        ? 'Menunggu Penilaian Guru'
                        : log.isCorrect
                        ? 'Benar'
                        : 'Belum Tepat'}
                      {typeof log.teacherScorePct === 'number'
                        ? ` · Nilai Rubrik: ${log.teacherScorePct}%`
                        : ''}
                    </span>
                  </div>
                  <p className="text-sm font-semibold text-slate-900">{log.prompt}</p>
                  <div className="text-xs bg-slate-50 border border-slate-200 rounded p-2 space-y-1">
                    <div>
                      <strong>Jawaban Siswa:</strong> {log.studentAnswer || '(Tidak diisi)'}
                    </div>
                    <div>
                      <strong>Kunci / Acuan Jawaban:</strong> {log.correctAnswer}
                    </div>
                    {log.teacherNote && (
                      <div>
                        <strong>Catatan Guru:</strong> {log.teacherNote}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <>
            {/* Class Summary Report */}
            <div className="border-b-2 border-slate-900 pb-4 flex flex-wrap items-end justify-between gap-4">
              <div>
                <div className="text-xs font-bold tracking-wider text-slate-500 uppercase">
                  LANDS of NUMERIA — Math Monster Adventure
                </div>
                <h1 className="text-2xl font-bold text-slate-900 mt-1">
                  Laporan Rekapitulasi Hasil Belajar
                </h1>
                {filterLabel && (
                  <p className="text-xs text-slate-600 mt-0.5">Filter: {filterLabel}</p>
                )}
              </div>
              <div className="text-xs text-slate-600 text-right">
                Dicetak: {formatDateId(new Date().toISOString())}
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="font-bold text-sm text-slate-900">
                Daftar Hasil Pekerjaan Siswa ({attempts.length} Sesi)
              </h3>
              <table className="w-full text-left text-xs border-collapse border border-slate-300">
                <thead className="bg-slate-100">
                  <tr>
                    <th className="border border-slate-300 p-2">No</th>
                    <th className="border border-slate-300 p-2">Siswa / Tim</th>
                    <th className="border border-slate-300 p-2">Kelas</th>
                    <th className="border border-slate-300 p-2">Wilayah & Level</th>
                    <th className="border border-slate-300 p-2">Tanggal</th>
                    <th className="border border-slate-300 p-2">Nilai Akademik</th>
                    <th className="border border-slate-300 p-2">Skor Game</th>
                    <th className="border border-slate-300 p-2">Durasi</th>
                  </tr>
                </thead>
                <tbody className="tabular-nums">
                  {attempts.map((att, idx) => (
                    <tr key={att.id}>
                      <td className="border border-slate-300 p-2 font-mono">{idx + 1}</td>
                      <td className="border border-slate-300 p-2 font-semibold">{att.studentName}</td>
                      <td className="border border-slate-300 p-2">{att.className}</td>
                      <td className="border border-slate-300 p-2">
                        {att.areaName} — {att.levelName}
                      </td>
                      <td className="border border-slate-300 p-2">{formatDateId(att.dateIso)}</td>
                      <td className="border border-slate-300 p-2 font-mono font-bold">
                        {att.academicMasteryPct}% ({att.correctCount}/{att.totalQuestions})
                      </td>
                      <td className="border border-slate-300 p-2 font-mono">{att.gameScore}</td>
                      <td className="border border-slate-300 p-2 font-mono">{att.durationSec} dtk</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="space-y-2">
              <h3 className="font-bold text-sm text-slate-900">
                Ketuntasan Rata-Rata per Indikator Kompetensi
              </h3>
              <table className="w-full text-left text-xs border-collapse border border-slate-300">
                <thead className="bg-slate-100">
                  <tr>
                    <th className="border border-slate-300 p-2">Indikator Pembelajaran</th>
                    <th className="border border-slate-300 p-2">Topik</th>
                    <th className="border border-slate-300 p-2">Benar / Total</th>
                    <th className="border border-slate-300 p-2">Ketepatan</th>
                  </tr>
                </thead>
                <tbody className="tabular-nums">
                  {aggregateIndicators.map((ind, idx) => (
                    <tr key={idx}>
                      <td className="border border-slate-300 p-2">{ind.indicator}</td>
                      <td className="border border-slate-300 p-2">{ind.topic}</td>
                      <td className="border border-slate-300 p-2 font-mono">
                        {ind.correct}/{ind.total}
                      </td>
                      <td className="border border-slate-300 p-2 font-mono font-bold">
                        {ind.accuracyPct}%{ind.total < 3 ? ' (sampel terbatas)' : ''}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
