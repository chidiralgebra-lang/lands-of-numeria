import React, { useState } from 'react';
import { BookOpen, Monitor, ShieldCheck, Sliders, Trash2, Volume2, X, ZoomIn, ZoomOut } from 'lucide-react';
import { GameSettings } from '../types/game';

export const HowToPlayModal: React.FC<{ onClose: () => void }> = ({ onClose }) => (
  <div className="fixed inset-0 z-50 bg-slate-950/85 flex items-center justify-center p-4 overflow-y-auto">
    <div className="w-full max-w-2xl rounded-2xl bg-slate-900 border border-slate-700 p-6 space-y-4 my-auto">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-xl font-bold text-amber-300 flex items-center gap-2">
          <BookOpen className="w-5 h-5" />
          <span>Cara Bermain LANDS of NUMERIA</span>
        </h2>
        <button
          type="button"
          onClick={onClose}
          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="space-y-3 text-sm text-slate-200 leading-relaxed">
        <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800">
          <strong className="text-white">1. Petualangan Solo:</strong> Pilih nama panggilan dan hero
          (Ksatria, Penyihir, Penjelajah, atau Penjaga Hutan), lalu pilih wilayah pada Peta Dunia. Jawab
          soal matematika dengan tepat untuk menyerang monster dan membuka wilayah berikutnya.
        </div>
        <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800">
          <strong className="text-white">2. Mekanisme Pertarungan & Bantuan:</strong> Jawaban benar memicu
          serangan hero (tebasan, bola energi, panah cahaya, atau mantra). Jika tersedia, gunakan tombol
          Petunjuk Langkah, Eliminasi 1 Opsi, atau Perisai sebelum menjawab.
        </div>
        <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800">
          <strong className="text-white">3. Team Battle Lokal & Kelas Daring:</strong> Bermain bergantian
          dengan 2 tim di 1 perangkat (dengan layar penutup agar jawaban tetap rahasia), atau gabung ke sesi
          kelas daring menggunakan kode 6 huruf dari guru.
        </div>
        <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800">
          <strong className="text-white">4. Kontrol Keyboard & Sentuh:</strong> Gunakan mouse/sentuhan,
          tombol angka <span className="font-mono text-amber-300">1–4</span> untuk memilih opsi ganda,{' '}
          <span className="font-mono text-amber-300">Enter</span> untuk mengirim/lanjut, dan{' '}
          <span className="font-mono text-amber-300">Esc</span> untuk jeda.
        </div>
      </div>

      <div className="flex justify-end pt-1">
        <button
          type="button"
          onClick={onClose}
          className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm cursor-pointer"
        >
          Mengerti, Ayo Mulai!
        </button>
      </div>
    </div>
  </div>
);

export const SettingsModal: React.FC<{
  settings: GameSettings;
  displayScale?: number;
  onChangeDisplayScale?: (nextScale: number) => void;
  onUpdateSettings: (next: GameSettings) => void;
  onResetLocalData: () => void;
  onClose: () => void;
}> = ({
  settings,
  displayScale = 70,
  onChangeDisplayScale,
  onUpdateSettings,
  onResetLocalData,
  onClose,
}) => {
  const [confirmReset, setConfirmReset] = useState(false);

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 flex items-center justify-center p-4 overflow-y-auto">
      <div className="w-full max-w-lg rounded-2xl bg-slate-900 border border-slate-700 p-6 space-y-5 my-auto">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl font-bold text-white flex items-center gap-2">
            <Sliders className="w-5 h-5 text-amber-400" />
            <span>Pengaturan Audio, Tampilan & Privasi</span>
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Audio */}
        <div className="space-y-3 p-4 rounded-xl bg-slate-950 border border-slate-800">
          <div className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
            <Volume2 className="w-4 h-4" />
            <span>AUDIO & SUARA</span>
          </div>
          <label className="flex items-center justify-between text-sm cursor-pointer">
            <span>Musik Latar Petualangan</span>
            <input
              type="checkbox"
              checked={settings.musicEnabled}
              onChange={(e) => onUpdateSettings({ ...settings, musicEnabled: e.target.checked })}
            />
          </label>
          <label className="flex items-center justify-between text-sm cursor-pointer">
            <span>Efek Suara Pertarungan & UI</span>
            <input
              type="checkbox"
              checked={settings.sfxEnabled}
              onChange={(e) => onUpdateSettings({ ...settings, sfxEnabled: e.target.checked })}
            />
          </label>
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-slate-400">
              <span>Volume Utama</span>
              <span className="font-mono tabular-nums">{Math.round(settings.volume * 100)}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round(settings.volume * 100)}
              onChange={(e) =>
                onUpdateSettings({ ...settings, volume: Number(e.target.value) / 100 })
              }
              className="w-full accent-amber-400"
            />
          </div>
        </div>

        {/* Accessibility & Performance */}
        <div className="space-y-3 p-4 rounded-xl bg-slate-950 border border-slate-800">
          <div className="text-xs font-bold text-sky-300">AKSESIBILITAS & PERFORMA</div>
          {onChangeDisplayScale && (
            <div className="space-y-1.5 pb-1">
              <div className="flex items-center justify-between text-sm">
                <span className="inline-flex items-center gap-1.5">
                  <Monitor className="w-4 h-4 text-amber-400" />
                  <span>Ukuran Layar Permainan</span>
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => onChangeDisplayScale(Math.max(50, displayScale - 5))}
                    disabled={displayScale <= 50}
                    className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 disabled:opacity-40 cursor-pointer"
                    aria-label="Perkecil ukuran layar"
                  >
                    <ZoomOut className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onChangeDisplayScale(70)}
                    className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 font-mono text-xs font-bold text-amber-300 tabular-nums cursor-pointer"
                    title="Reset ke 70%"
                  >
                    {displayScale}%
                  </button>
                  <button
                    type="button"
                    onClick={() => onChangeDisplayScale(Math.min(125, displayScale + 5))}
                    disabled={displayScale >= 125}
                    className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 disabled:opacity-40 cursor-pointer"
                    aria-label="Perbesar ukuran layar"
                  >
                    <ZoomIn className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              <input
                type="range"
                min={50}
                max={125}
                step={5}
                value={displayScale}
                onChange={(e) => onChangeDisplayScale(Number(e.target.value))}
                className="w-full accent-sky-400"
              />
            </div>
          )}
          <div className="flex items-center justify-between text-sm">
            <span>Ukuran Teks</span>
            <select
              value={settings.textSize}
              onChange={(e) =>
                onUpdateSettings({ ...settings, textSize: e.target.value as 'normal' | 'besar' })
              }
              className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-700 text-xs"
            >
              <option value="normal">Normal</option>
              <option value="besar">Besar (+12.5%)</option>
            </select>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span>Kualitas Animasi</span>
            <select
              value={settings.animationQuality}
              onChange={(e) =>
                onUpdateSettings({
                  ...settings,
                  animationQuality: e.target.value as 'penuh' | 'hemat',
                })
              }
              className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-700 text-xs"
            >
              <option value="penuh">Penuh</option>
              <option value="hemat">Hemat Baterai</option>
            </select>
          </div>
          <label className="flex items-center justify-between text-sm cursor-pointer">
            <span>Mode Kontras Tinggi</span>
            <input
              type="checkbox"
              checked={settings.highContrast}
              onChange={(e) => onUpdateSettings({ ...settings, highContrast: e.target.checked })}
            />
          </label>
          <label className="flex items-center justify-between text-sm cursor-pointer">
            <span>Kurangi Gerakan (Reduced Motion)</span>
            <input
              type="checkbox"
              checked={settings.reducedMotion}
              onChange={(e) => onUpdateSettings({ ...settings, reducedMotion: e.target.checked })}
            />
          </label>
        </div>

        {/* Privacy & Local Data */}
        <div className="space-y-2.5 p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300">
          <div className="font-bold text-emerald-300 flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4" />
            <span>PRIVASI & PENYIMPANAN DATA</span>
          </div>
          <p className="leading-relaxed">
            Progres petualangan solo, bank soal kustom guru, dan riwayat nilai disimpan secara lokal di
            browser perangkat ini (<span className="font-mono">LocalStorage</span>) dan tidak disinkronkan
            otomatis ke perangkat lain. Sesi Kelas Daring menggunakan ruang sementara di server selama sesi
            berlangsung.
          </p>

          {!confirmReset ? (
            <button
              type="button"
              onClick={() => setConfirmReset(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-950/60 hover:bg-rose-900/60 border border-rose-500/40 text-rose-200 font-semibold cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Reset Semua Data Lokal</span>
            </button>
          ) : (
            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  onResetLocalData();
                  setConfirmReset(false);
                }}
                className="px-3 py-1.5 rounded-lg bg-rose-600 text-white font-bold cursor-pointer"
              >
                Konfirmasi Hapus Semua Data
              </button>
              <button
                type="button"
                onClick={() => setConfirmReset(false)}
                className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-200 cursor-pointer"
              >
                Batal
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
