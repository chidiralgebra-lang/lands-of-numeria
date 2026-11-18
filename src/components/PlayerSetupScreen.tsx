import React, { useState } from 'react';
import { ArrowLeft, Check, Coins, Shield, Sparkles, Swords } from 'lucide-react';
import { DEFAULT_PROFILE, HERO_ACCESSORIES, HEROES } from '../data/worldData';
import { AreaDef, HeroDef, HeroId, LocalTeamConfig, PlayerProfile } from '../types/game';
import { HeroPortraitSvg } from './CharacterSvg';

interface PlayerSetupScreenProps {
  mode: 'solo' | 'local_team';
  isNewAdventure?: boolean;
  profile: PlayerProfile;
  areas: AreaDef[];
  heroes?: HeroDef[];
  onUpdateProfile: (next: PlayerProfile) => void;
  onContinueSolo: () => void;
  onStartLocalTeam: (config: LocalTeamConfig) => void;
  onBack: () => void;
}

export const PlayerSetupScreen: React.FC<PlayerSetupScreenProps> = ({
  mode,
  isNewAdventure = false,
  profile,
  areas,
  heroes = HEROES,
  onUpdateProfile,
  onContinueSolo,
  onStartLocalTeam,
  onBack,
}) => {
  const [name, setName] = useState(isNewAdventure ? '' : profile.name);
  const [className, setClassName] = useState(isNewAdventure ? '' : profile.className);
  const [heroId, setHeroId] = useState<HeroId>(
    isNewAdventure ? heroes[0]?.id || 'ksatria' : profile.heroId
  );
  const [draftCoins, setDraftCoins] = useState(
    isNewAdventure ? DEFAULT_PROFILE.coins : profile.coins
  );
  const [draftUnlockedAcc, setDraftUnlockedAcc] = useState<string[]>(
    isNewAdventure ? [] : profile.unlockedAccessories
  );
  const [draftEquippedAcc, setDraftEquippedAcc] = useState<string | null>(
    isNewAdventure ? null : profile.equippedAccessory
  );

  // Local Team State
  const [teamAName, setTeamAName] = useState('Tim Bintang');
  const [teamBName, setTeamBName] = useState('Tim Komet');
  const [teamAHero, setTeamAHero] = useState<HeroId>('ksatria');
  const [teamBHero, setTeamBHero] = useState<HeroId>('penyihir');
  const [teamAreaId, setTeamAreaId] = useState(areas[0]?.id || 'hutan_bilangan');
  const [teamDifficulty, setTeamDifficulty] = useState<'campuran' | 'mudah' | 'sedang' | 'sulit'>('campuran');

  const activeCoins = isNewAdventure ? draftCoins : profile.coins;
  const activeUnlockedAcc = isNewAdventure ? draftUnlockedAcc : profile.unlockedAccessories;
  const activeEquippedAcc = isNewAdventure ? draftEquippedAcc : profile.equippedAccessory;

  const handleBuyOrEquip = (accId: string, cost: number) => {
    const owned = activeUnlockedAcc.includes(accId);
    if (owned) {
      const nextEquipped = activeEquippedAcc === accId ? null : accId;
      if (isNewAdventure) {
        setDraftEquippedAcc(nextEquipped);
      } else {
        onUpdateProfile({
          ...profile,
          equippedAccessory: nextEquipped,
        });
      }
      return;
    }
    if (activeCoins >= cost) {
      const nextCoins = activeCoins - cost;
      const nextUnlocked = [...activeUnlockedAcc, accId];
      if (isNewAdventure) {
        setDraftCoins(nextCoins);
        setDraftUnlockedAcc(nextUnlocked);
        setDraftEquippedAcc(accId);
      } else {
        onUpdateProfile({
          ...profile,
          coins: nextCoins,
          unlockedAccessories: nextUnlocked,
          equippedAccessory: accId,
        });
      }
    }
  };

  const handleSoloSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const sortedAreas = [...areas].sort((a, b) => a.order - b.order);
    const firstAreaId = sortedAreas[0]?.id || 'hutan_bilangan';

    if (isNewAdventure) {
      onUpdateProfile({
        ...DEFAULT_PROFILE,
        name: name.trim() || 'Petualang Muda',
        className: className.trim() || 'Kelas Umum',
        heroId,
        coins: draftCoins,
        unlockedAccessories: draftUnlockedAcc,
        equippedAccessory: draftEquippedAcc,
        unlockedAreaIds: [firstAreaId],
      });
    } else {
      onUpdateProfile({
        ...profile,
        name: name.trim() || 'Petualang Muda',
        className: className.trim() || 'Kelas Umum',
        heroId,
      });
    }
    onContinueSolo();
  };

  const handleTeamSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const chosenArea = areas.find((a) => a.id === teamAreaId) || areas[0];
    onStartLocalTeam({
      teamAName: teamAName.trim() || 'Tim A',
      teamBName: teamBName.trim() || 'Tim B',
      teamAHero,
      teamBHero,
      areaId: chosenArea.id,
      topicFilter:
        chosenArea.mathTopic === 'Campuran & Pengayaan' ||
        chosenArea.mathTopic === 'Campuran & Pengayaan HOTS'
          ? 'ALL'
          : chosenArea.mathTopic,
      questionCountPerTeam: 0,
      difficulty: teamDifficulty,
    });
  };

  return (
    <div className="min-h-screen w-full bg-slate-950 text-slate-100 p-4 md:p-8 overflow-y-auto">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-sm font-medium text-slate-200 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Kembali</span>
          </button>
          <div className="text-sm font-mono text-amber-300 tabular-nums flex items-center gap-2">
            <Coins className="w-4 h-4" />
            <span>
              {activeCoins} {isNewAdventure ? 'Koin Awal' : 'Koin Kosmetik'}
            </span>
          </div>
        </div>

        {mode === 'solo' ? (
          <form onSubmit={handleSoloSubmit} className="space-y-6">
            <div className="rounded-2xl bg-slate-900 border border-slate-800 p-6 space-y-5">
              <div>
                <h1 className="font-display text-2xl md:text-3xl font-bold text-white">
                  {isNewAdventure ? 'Mulai Karakter & Petualangan Baru' : 'Persiapan Petualang Solo'}
                </h1>
                <p className="text-sm text-slate-400 mt-1">
                  {isNewAdventure
                    ? `Masukkan nama siswa baru dan pilih hero baru. Permainan dimulai lagi dari tantangan awal dengan ${DEFAULT_PROFILE.coins} koin awal.`
                    : 'Masukkan nama panggilanmu dan pilih hero untuk menjelajahi dunia matematika.'}
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Nama Panggilan Siswa
                  </label>
                  <input
                    type="text"
                    required
                    autoFocus={isNewAdventure}
                    maxLength={32}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Contoh: Bima"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white focus:outline-none focus:border-amber-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Kelas / Kelompok
                  </label>
                  <input
                    type="text"
                    maxLength={24}
                    value={className}
                    onChange={(e) => setClassName(e.target.value)}
                    placeholder="Contoh: Kelas X-A"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white focus:outline-none focus:border-amber-400"
                  />
                </div>
              </div>

              {/* Hero Selection */}
              <div className="space-y-3">
                <h2 className="text-sm font-bold text-slate-200">Pilih Hero</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {heroes.map((h) => {
                    const selected = heroId === h.id;
                    return (
                      <button
                        key={h.id}
                        type="button"
                        onClick={() => setHeroId(h.id)}
                        className={`p-4 rounded-xl text-left border transition-all cursor-pointer flex flex-col gap-3 ${
                          selected
                            ? 'bg-amber-500/10 border-amber-400 shadow-lg shadow-amber-500/10'
                            : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <HeroPortraitSvg heroId={h.visualId || h.id} className="w-14 h-14" />
                          {selected && (
                            <span className="p-1 rounded-full bg-amber-400 text-slate-950">
                              <Check className="w-3.5 h-3.5" />
                            </span>
                          )}
                        </div>
                        <div>
                          <div className="text-xs text-amber-300 font-semibold">{h.archetype}</div>
                          <div className="font-bold text-base text-white">{h.name}</div>
                          <p className="text-xs text-slate-400 mt-1 line-clamp-2">{h.description}</p>
                        </div>
                        <div className="pt-2 border-t border-slate-800 text-xs text-slate-300 font-mono tabular-nums flex justify-between">
                          <span>HP {h.baseHp}</span>
                          <span>Serangan {h.baseAttack}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Cosmetic Accessories Shop */}
              <div className="space-y-3 pt-2 border-t border-slate-800">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-amber-400" />
                    <span>Aksesori Kosmetik Hero (Opsional)</span>
                  </h2>
                  <span className="text-xs text-slate-400">Hanya hiasan visual, tidak mengunci materi</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {HERO_ACCESSORIES.map((acc) => {
                    const owned = activeUnlockedAcc.includes(acc.id);
                    const equipped = activeEquippedAcc === acc.id;
                    const canAfford = activeCoins >= acc.cost;
                    return (
                      <button
                        key={acc.id}
                        type="button"
                        onClick={() => handleBuyOrEquip(acc.id, acc.cost)}
                        disabled={!owned && !canAfford}
                        className={`p-3 rounded-xl border text-left transition-colors cursor-pointer ${
                          equipped
                            ? 'bg-emerald-500/15 border-emerald-400'
                            : 'bg-slate-950 border-slate-800 hover:border-slate-700 disabled:opacity-50 disabled:cursor-not-allowed'
                        }`}
                      >
                        <div className="flex items-center justify-between text-xs font-bold">
                          <span className="text-white">{acc.name}</span>
                          <span className={owned ? 'text-emerald-400' : 'text-amber-300 font-mono'}>
                            {equipped ? 'Dipakai' : owned ? 'Milikmu' : `${acc.cost} Koin`}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 mt-1">{acc.description}</p>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                className="px-7 py-3.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-base inline-flex items-center gap-2 cursor-pointer shadow-lg shadow-amber-500/20"
              >
                <Shield className="w-5 h-5" />
                <span>{isNewAdventure ? 'Mulai dari Tantangan Awal' : 'Lanjut ke Peta Petualangan'}</span>
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleTeamSubmit} className="space-y-6">
            <div className="rounded-2xl bg-slate-900 border border-slate-800 p-6 space-y-5">
              <div>
                <h1 className="font-display text-2xl md:text-3xl font-bold text-white">
                  Local Team Battle (2 Tim · 1 Perangkat)
                </h1>
                <p className="text-sm text-slate-400 mt-1">
                  Dua tim bermain bergantian pada perangkat yang sama. Soal paralel dibagikan bergiliran dan
                  layar jeda menjaga kerahasiaan jawaban antar tim.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Team A */}
                <div className="p-4 rounded-xl bg-slate-950 border border-sky-500/40 space-y-3">
                  <div className="text-xs font-bold text-sky-400">TIM PERTAMA</div>
                  <input
                    type="text"
                    required
                    value={teamAName}
                    onChange={(e) => setTeamAName(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white"
                    placeholder="Nama Tim A"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    {heroes.map((h) => (
                      <button
                        key={`ta-${h.id}`}
                        type="button"
                        onClick={() => setTeamAHero(h.id)}
                        className={`p-2 rounded-lg border text-xs font-semibold flex items-center gap-2 cursor-pointer ${
                          teamAHero === h.id
                            ? 'bg-sky-500/20 border-sky-400 text-white'
                            : 'bg-slate-900 border-slate-800 text-slate-400'
                        }`}
                      >
                        <HeroPortraitSvg heroId={h.visualId || h.id} className="w-7 h-7 shrink-0" />
                        <span className="truncate">{h.name}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Team B */}
                <div className="p-4 rounded-xl bg-slate-950 border border-amber-500/40 space-y-3">
                  <div className="text-xs font-bold text-amber-400">TIM KEDUA</div>
                  <input
                    type="text"
                    required
                    value={teamBName}
                    onChange={(e) => setTeamBName(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white"
                    placeholder="Nama Tim B"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    {heroes.map((h) => (
                      <button
                        key={`tb-${h.id}`}
                        type="button"
                        onClick={() => setTeamBHero(h.id)}
                        className={`p-2 rounded-lg border text-xs font-semibold flex items-center gap-2 cursor-pointer ${
                          teamBHero === h.id
                            ? 'bg-amber-500/20 border-amber-400 text-white'
                            : 'bg-slate-900 border-slate-800 text-slate-400'
                        }`}
                      >
                        <HeroPortraitSvg heroId={h.visualId || h.id} className="w-7 h-7 shrink-0" />
                        <span className="truncate">{h.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-slate-800">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">Wilayah & Materi</label>
                  <select
                    value={teamAreaId}
                    onChange={(e) => setTeamAreaId(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-lg bg-slate-950 border border-slate-700 text-white text-sm"
                  >
                    {areas.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name} ({a.mathTopic})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Aturan Pertarungan
                  </label>
                  <div className="px-3 py-2.5 rounded-lg bg-slate-950 border border-slate-700 text-amber-300 text-xs font-semibold">
                    Soal Tanpa Batas hingga HP Monster Habis (0)
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">Tingkat Kesulitan</label>
                  <select
                    value={teamDifficulty}
                    onChange={(e) =>
                      setTeamDifficulty(e.target.value as 'campuran' | 'mudah' | 'sedang' | 'sulit')
                    }
                    className="w-full px-3 py-2.5 rounded-lg bg-slate-950 border border-slate-700 text-white text-sm"
                  >
                    <option value="campuran">Campuran</option>
                    <option value="mudah">Mudah</option>
                    <option value="sedang">Sedang</option>
                    <option value="sulit">Sulit</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                className="px-7 py-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-base inline-flex items-center gap-2 cursor-pointer shadow-lg shadow-emerald-500/20"
              >
                <Swords className="w-5 h-5" />
                <span>Mulai Pertarungan Tim</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
