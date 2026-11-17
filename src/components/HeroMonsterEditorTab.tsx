import React, { useMemo, useState } from 'react';
import {
  CheckCircle2,
  Plus,
  RotateCcw,
  Search,
  Shield,
  Sparkles,
  Swords,
  Trash2,
} from 'lucide-react';
import {
  HERO_VISUAL_OPTIONS,
  HEROES,
  MONSTER_VISUAL_OPTIONS,
  MONSTERS,
} from '../data/worldData';
import { AreaDef, HeroDef, HeroId, MonsterArchetype, MonsterDef } from '../types/game';
import { HeroPortraitSvg, MonsterBadgeSvg } from './CharacterSvg';

interface HeroMonsterEditorTabProps {
  heroes: HeroDef[];
  monsters: Record<string, MonsterDef>;
  areas: AreaDef[];
  activeHeroId: HeroId;
  onUpdateHeroes: (next: HeroDef[]) => void;
  onUpdateMonsters: (next: Record<string, MonsterDef>) => void;
  onUpdateAreas: (next: AreaDef[]) => void;
  onSelectActiveHero: (heroId: HeroId) => void;
}

export const HeroMonsterEditorTab: React.FC<HeroMonsterEditorTabProps> = ({
  heroes,
  monsters,
  areas,
  activeHeroId,
  onUpdateHeroes,
  onUpdateMonsters,
  onUpdateAreas,
  onSelectActiveHero,
}) => {
  const monsterList = useMemo(() => Object.values(monsters), [monsters]);

  // Quick selector state: pick hero by name & pick monster by name for any area/level
  const [selectedAreaId, setSelectedAreaId] = useState<string>(areas[0]?.id || '');
  const selectedArea = areas.find((a) => a.id === selectedAreaId) || areas[0];
  const [selectedLevelId, setSelectedLevelId] = useState<string>(
    selectedArea?.levels[0]?.id || ''
  );
  const selectedLevel =
    selectedArea?.levels.find((l) => l.id === selectedLevelId) || selectedArea?.levels[0];

  // Monster search & custom monster creator
  const [monsterSearch, setMonsterSearch] = useState('');
  const [newMonsterName, setNewMonsterName] = useState('');
  const [newMonsterArchetype, setNewMonsterArchetype] =
    useState<MonsterArchetype>('penjaga_sudut');
  const [newMonsterTier, setNewMonsterTier] = useState<'reguler' | 'boss'>('reguler');
  const [newMonsterDesc, setNewMonsterDesc] = useState('');
  const [confirmResetChars, setConfirmResetChars] = useState(false);

  const activeHero = heroes.find((h) => h.id === activeHeroId) || heroes[0];
  const assignedMonster =
    (selectedLevel && monsters[selectedLevel.monsterId]) ||
    monsters.slime_angka ||
    monsterList[0];

  const filteredMonsters = useMemo(() => {
    const q = monsterSearch.trim().toLowerCase();
    if (!q) return monsterList;
    return monsterList.filter((m) => {
      const visualLabel =
        MONSTER_VISUAL_OPTIONS.find((v) => v.archetype === m.archetype)?.label || '';
      return (
        m.name.toLowerCase().includes(q) ||
        visualLabel.toLowerCase().includes(q) ||
        m.tier.toLowerCase().includes(q)
      );
    });
  }, [monsterList, monsterSearch]);

  const handleUpdateHeroField = (heroId: HeroId, patch: Partial<HeroDef>) => {
    onUpdateHeroes(heroes.map((h) => (h.id === heroId ? { ...h, ...patch } : h)));
  };

  const handleChangeHeroVisual = (heroId: HeroId, nextVisualId: HeroId) => {
    const preset = HERO_VISUAL_OPTIONS.find((v) => v.id === nextVisualId);
    if (!preset) return;
    handleUpdateHeroField(heroId, {
      visualId: nextVisualId,
      attackStyle: preset.attackStyle,
      attackName: preset.attackName,
      primaryColor: preset.primaryColor,
      secondaryColor: preset.secondaryColor,
      accentColor: preset.accentColor,
    });
  };

  const handleUpdateMonsterField = (monsterId: string, patch: Partial<MonsterDef>) => {
    const existing = monsters[monsterId];
    if (!existing) return;
    onUpdateMonsters({
      ...monsters,
      [monsterId]: { ...existing, ...patch },
    });
  };

  const handleChangeMonsterVisual = (monsterId: string, nextArch: MonsterArchetype) => {
    const preset = MONSTER_VISUAL_OPTIONS.find((v) => v.archetype === nextArch);
    handleUpdateMonsterField(monsterId, {
      archetype: nextArch,
      primaryColor: preset?.primaryColor || '#f59e0b',
      accentColor: preset?.accentColor || '#fbbf24',
    });
  };

  const handleCreateCustomMonster = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = newMonsterName.trim();
    if (!cleanName) return;
    const preset = MONSTER_VISUAL_OPTIONS.find((v) => v.archetype === newMonsterArchetype);
    const id = `monster_custom_${Date.now()}`;
    const created: MonsterDef = {
      id,
      name: cleanName,
      archetype: newMonsterArchetype,
      tier: newMonsterTier,
      maxHp: newMonsterTier === 'boss' ? 170 : 110,
      attackPower: newMonsterTier === 'boss' ? 22 : 16,
      attackPattern: `Serangan ${cleanName}`,
      description:
        newMonsterDesc.trim() ||
        `Monster ${cleanName} (${preset?.label || 'Karakter Kustom'}) penjaga tantangan matematika.`,
      primaryColor: preset?.primaryColor || '#f59e0b',
      accentColor: preset?.accentColor || '#fbbf24',
      isCustom: true,
    };
    onUpdateMonsters({ ...monsters, [id]: created });
    if (selectedArea && selectedLevel) {
      onUpdateAreas(
        areas.map((a) =>
          a.id === selectedArea.id
            ? {
                ...a,
                levels: a.levels.map((l) =>
                  l.id === selectedLevel.id ? { ...l, monsterId: id } : l
                ),
              }
            : a
        )
      );
    }
    setNewMonsterName('');
    setNewMonsterDesc('');
  };

  const handleDeleteCustomMonster = (monsterId: string) => {
    const target = monsters[monsterId];
    if (!target?.isCustom) return;
    const nextMonsters = { ...monsters };
    delete nextMonsters[monsterId];
    onUpdateMonsters(nextMonsters);
    onUpdateAreas(
      areas.map((a) => ({
        ...a,
        levels: a.levels.map((l) =>
          l.monsterId === monsterId ? { ...l, monsterId: 'slime_angka' } : l
        ),
      }))
    );
  };

  const handleAssignLevelMonster = (monsterId: string) => {
    if (!selectedArea || !selectedLevel) return;
    onUpdateAreas(
      areas.map((a) =>
        a.id === selectedArea.id
          ? {
              ...a,
              levels: a.levels.map((l) =>
                l.id === selectedLevel.id ? { ...l, monsterId } : l
              ),
            }
          : a
      )
    );
  };

  return (
    <div className="space-y-6">
      {/* Top Bar + Quick Picker by Custom Name */}
      <div className="rounded-2xl bg-slate-900 border border-slate-800 p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-bold text-lg text-white">
              Edit Nama &amp; Pilih Karakter Hero / Monster
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Ubah nama hero dan monster sesuai keinginan guru, pilih wujud karakter masing-masing,
              serta pilih hero aktif maupun monster penjaga level berdasarkan namanya.
            </p>
          </div>
          {!confirmResetChars ? (
            <button
              type="button"
              onClick={() => setConfirmResetChars(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
              <span>Reset Nama &amp; Karakter Bawaan</span>
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  onUpdateHeroes(HEROES);
                  onUpdateMonsters(MONSTERS);
                  setConfirmResetChars(false);
                }}
                className="px-3 py-1.5 rounded-lg bg-rose-600 text-white text-xs font-bold cursor-pointer"
              >
                Ya, Reset Semua
              </button>
              <button
                type="button"
                onClick={() => setConfirmResetChars(false)}
                className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-200 text-xs font-semibold cursor-pointer"
              >
                Batal
              </button>
            </div>
          )}
        </div>

        {/* Quick Select Hero & Monster by Teacher's Chosen Name */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pt-2 border-t border-slate-800">
          {/* Quick Hero Selector by Name */}
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-sky-300">
              <Shield className="w-4 h-4" />
              <span>Pilih Karakter Hero Berdasarkan Nama</span>
            </div>
            <div className="flex items-center gap-3">
              {activeHero && (
                <HeroPortraitSvg
                  heroId={activeHero.visualId || activeHero.id}
                  className="w-12 h-12 shrink-0"
                />
              )}
              <div className="flex-1 space-y-1.5">
                <label className="block text-[11px] text-slate-400">
                  Hero Aktif / Pilihan Utama Game
                </label>
                <select
                  value={activeHeroId}
                  onChange={(e) => onSelectActiveHero(e.target.value as HeroId)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-sm font-semibold text-white"
                >
                  {heroes.map((h) => {
                    const visLabel =
                      HERO_VISUAL_OPTIONS.find((v) => v.id === (h.visualId || h.id))?.label || '';
                    return (
                      <option key={h.id} value={h.id}>
                        {h.name} ({h.archetype}) — {visLabel}
                      </option>
                    );
                  })}
                </select>
              </div>
            </div>
          </div>

          {/* Quick Monster Selector by Name for Area/Level */}
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-amber-300">
              <Swords className="w-4 h-4" />
              <span>Pilih Karakter Monster Berdasarkan Nama untuk Level</span>
            </div>
            <div className="flex items-center gap-3">
              {assignedMonster && (
                <MonsterBadgeSvg
                  archetype={assignedMonster.archetype}
                  className="w-12 h-12 shrink-0"
                />
              )}
              <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Wilayah</label>
                  <select
                    value={selectedArea?.id || ''}
                    onChange={(e) => {
                      const nextAreaId = e.target.value;
                      setSelectedAreaId(nextAreaId);
                      const found = areas.find((a) => a.id === nextAreaId);
                      setSelectedLevelId(found?.levels[0]?.id || '');
                    }}
                    className="w-full px-2.5 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white"
                  >
                    {areas.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Level / Misi</label>
                  <select
                    value={selectedLevel?.id || ''}
                    onChange={(e) => setSelectedLevelId(e.target.value)}
                    className="w-full px-2.5 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white"
                  >
                    {(selectedArea?.levels || []).map((lvl) => (
                      <option key={lvl.id} value={lvl.id}>
                        {lvl.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">
                    Monster (Berdasarkan Nama)
                  </label>
                  <select
                    value={selectedLevel?.monsterId || ''}
                    disabled={!selectedLevel}
                    onChange={(e) => handleAssignLevelMonster(e.target.value)}
                    className="w-full px-2.5 py-2 rounded-lg bg-slate-900 border border-amber-500/50 text-xs font-semibold text-amber-200"
                  >
                    {monsterList.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} ({m.tier})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 1: HERO NAME & CHARACTER EDITOR */}
      <div className="rounded-2xl bg-slate-900 border border-slate-800 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-base text-white flex items-center gap-2">
            <Shield className="w-4 h-4 text-sky-400" />
            <span>Daftar Hero ({heroes.length} Karakter)</span>
          </h3>
          <span className="text-xs text-slate-400">
            Perubahan nama dan karakter langsung muncul di pilihan Hero &amp; Arena Pertarungan
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {heroes.map((h) => {
            const isCurrentActive = activeHeroId === h.id;
            const visualId = h.visualId || h.id;
            return (
              <div
                key={h.id}
                className={`p-4 rounded-xl bg-slate-950 border space-y-3 ${
                  isCurrentActive ? 'border-amber-400/70' : 'border-slate-800'
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <HeroPortraitSvg heroId={visualId} className="w-14 h-14 shrink-0" />
                    <div>
                      <div className="text-xs text-amber-300 font-semibold">{h.archetype}</div>
                      <div className="font-bold text-base text-white">{h.name}</div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onSelectActiveHero(h.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold inline-flex items-center gap-1 cursor-pointer ${
                      isCurrentActive
                        ? 'bg-amber-500 text-slate-950'
                        : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                    }`}
                  >
                    {isCurrentActive && <CheckCircle2 className="w-3.5 h-3.5" />}
                    <span>{isCurrentActive ? 'Hero Aktif' : 'Pilih Hero Ini'}</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                  <div>
                    <label className="block text-slate-400 mb-1">Nama Hero</label>
                    <input
                      type="text"
                      maxLength={32}
                      value={h.name}
                      onChange={(e) => handleUpdateHeroField(h.id, { name: e.target.value })}
                      placeholder="Masukkan nama hero..."
                      className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white font-semibold"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1">Peran / Julukan</label>
                    <input
                      type="text"
                      maxLength={32}
                      value={h.archetype}
                      onChange={(e) => handleUpdateHeroField(h.id, { archetype: e.target.value })}
                      placeholder="Contoh: Ksatria"
                      className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-amber-200"
                    />
                  </div>
                </div>

                <div className="text-xs">
                  <label className="block text-slate-400 mb-1">
                    Pilih Karakter Visual untuk &ldquo;{h.name || 'Hero'}&rdquo;
                  </label>
                  <select
                    value={visualId}
                    onChange={(e) => handleChangeHeroVisual(h.id, e.target.value as HeroId)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-sky-200 font-medium"
                  >
                    {HERO_VISUAL_OPTIONS.map((opt) => (
                      <option key={opt.id} value={opt.id}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="text-xs">
                  <label className="block text-slate-400 mb-1">Deskripsi Hero</label>
                  <input
                    type="text"
                    value={h.description}
                    onChange={(e) =>
                      handleUpdateHeroField(h.id, { description: e.target.value })
                    }
                    className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-300"
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* SECTION 2: MONSTER NAME & CHARACTER EDITOR + CREATE NEW */}
      <div className="rounded-2xl bg-slate-900 border border-slate-800 p-5 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-bold text-base text-white flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-rose-400" />
            <span>Daftar Monster ({monsterList.length} Karakter)</span>
          </h3>
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={monsterSearch}
              onChange={(e) => setMonsterSearch(e.target.value)}
              placeholder="Cari nama atau wujud monster..."
              className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white"
            />
          </div>
        </div>

        {/* Add Custom Monster Form */}
        <form
          onSubmit={handleCreateCustomMonster}
          className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3"
        >
          <div className="text-xs font-bold text-amber-300">
            Buat Monster Baru dengan Nama &amp; Karakter Pilihan Guru
          </div>
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end text-xs">
            <div className="md:col-span-4">
              <label className="block text-slate-400 mb-1">Nama Monster Baru</label>
              <input
                type="text"
                required
                maxLength={40}
                value={newMonsterName}
                onChange={(e) => setNewMonsterName(e.target.value)}
                placeholder="Mis. Kobra Aljabar"
                className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white"
              />
            </div>
            <div className="md:col-span-4">
              <label className="block text-slate-400 mb-1">Karakter Visual Monster</label>
              <div className="flex items-center gap-2">
                <MonsterBadgeSvg archetype={newMonsterArchetype} className="w-9 h-9 shrink-0" />
                <select
                  value={newMonsterArchetype}
                  onChange={(e) =>
                    setNewMonsterArchetype(e.target.value as MonsterArchetype)
                  }
                  className="flex-1 px-2.5 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white"
                >
                  {MONSTER_VISUAL_OPTIONS.map((opt) => (
                    <option key={opt.archetype} value={opt.archetype}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="md:col-span-2">
              <label className="block text-slate-400 mb-1">Tingkat</label>
              <select
                value={newMonsterTier}
                onChange={(e) => setNewMonsterTier(e.target.value as 'reguler' | 'boss')}
                className="w-full px-2.5 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white"
              >
                <option value="reguler">Reguler</option>
                <option value="boss">Bos Wilayah</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <button
                type="submit"
                className="w-full py-2 px-3 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold inline-flex items-center justify-center gap-1 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Tambah</span>
              </button>
            </div>
          </div>
          <input
            type="text"
            value={newMonsterDesc}
            onChange={(e) => setNewMonsterDesc(e.target.value)}
            placeholder="Deskripsi singkat monster baru (opsional)..."
            className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-slate-300"
          />
        </form>

        {/* Existing & Custom Monsters Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredMonsters.map((m) => (
            <div
              key={m.id}
              className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <MonsterBadgeSvg archetype={m.archetype} className="w-12 h-12 shrink-0" />
                  <div>
                    <div className="text-[11px] text-slate-400">
                      {m.tier === 'boss' ? 'Bos Wilayah' : 'Monster Reguler'}
                      {m.isCustom ? ' · Kustom Guru' : ''}
                    </div>
                    <div className="font-bold text-base text-white">{m.name}</div>
                  </div>
                </div>
                {m.isCustom && (
                  <button
                    type="button"
                    onClick={() => handleDeleteCustomMonster(m.id)}
                    className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-rose-400 cursor-pointer"
                    title="Hapus monster kustom"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                <div>
                  <label className="block text-slate-400 mb-1">Nama Monster</label>
                  <input
                    type="text"
                    maxLength={40}
                    value={m.name}
                    onChange={(e) =>
                      handleUpdateMonsterField(m.id, { name: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white font-semibold"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">
                    Pilih Karakter Visual Monster
                  </label>
                  <select
                    value={m.archetype}
                    onChange={(e) =>
                      handleChangeMonsterVisual(m.id, e.target.value as MonsterArchetype)
                    }
                    className="w-full px-2.5 py-2 rounded-lg bg-slate-900 border border-slate-700 text-amber-200"
                  >
                    {MONSTER_VISUAL_OPTIONS.map((opt) => (
                      <option key={opt.archetype} value={opt.archetype}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 text-xs">
                <div>
                  <label className="block text-slate-400 mb-1">Tier</label>
                  <select
                    value={m.tier}
                    onChange={(e) =>
                      handleUpdateMonsterField(m.id, {
                        tier: e.target.value as 'reguler' | 'boss',
                      })
                    }
                    className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white"
                  >
                    <option value="reguler">Reguler</option>
                    <option value="boss">Bos Wilayah</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">HP Dasar</label>
                  <input
                    type="number"
                    min={40}
                    max={500}
                    value={m.maxHp}
                    onChange={(e) =>
                      handleUpdateMonsterField(m.id, {
                        maxHp: Math.max(40, Number(e.target.value) || 90),
                      })
                    }
                    className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">ATK</label>
                  <input
                    type="number"
                    min={5}
                    max={80}
                    value={m.attackPower}
                    onChange={(e) =>
                      handleUpdateMonsterField(m.id, {
                        attackPower: Math.max(5, Number(e.target.value) || 14),
                      })
                    }
                    className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white font-mono"
                  />
                </div>
              </div>

              <div className="text-xs">
                <label className="block text-slate-400 mb-1">Deskripsi</label>
                <input
                  type="text"
                  value={m.description}
                  onChange={(e) =>
                    handleUpdateMonsterField(m.id, { description: e.target.value })
                  }
                  className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-300"
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
