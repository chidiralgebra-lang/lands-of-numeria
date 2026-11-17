import React, { useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Compass,
  MapPin,
  Move,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import { DEFAULT_AREAS, WORLD_MAP_IMG } from '../data/worldData';
import { AreaDef } from '../types/game';

const MIN_X = 6;
const MAX_X = 94;
const MIN_Y = 10;
const MAX_Y = 88;

const OVERLAP_DX = 15;
const OVERLAP_DY = 13;

export function clampMapPos(x: number, y: number): { x: number; y: number } {
  return {
    x: Math.round(Math.min(MAX_X, Math.max(MIN_X, x))),
    y: Math.round(Math.min(MAX_Y, Math.max(MIN_Y, y))),
  };
}

export function isPosOverlapping(
  a: { x: number; y: number },
  b: { x: number; y: number }
): boolean {
  return Math.abs(a.x - b.x) < OVERLAP_DX && Math.abs(a.y - b.y) < OVERLAP_DY;
}

export function findOverlapPairs(areas: AreaDef[]): Array<[AreaDef, AreaDef]> {
  const pairs: Array<[AreaDef, AreaDef]> = [];
  for (let i = 0; i < areas.length; i++) {
    for (let j = i + 1; j < areas.length; j++) {
      if (isPosOverlapping(areas[i].mapPos, areas[j].mapPos)) {
        pairs.push([areas[i], areas[j]]);
      }
    }
  }
  return pairs;
}

export function findNonOverlappingPos(
  existingAreas: AreaDef[],
  preferred?: { x: number; y: number }
): { x: number; y: number } {
  const candidates: Array<{ x: number; y: number }> = [];
  if (preferred) candidates.push(clampMapPos(preferred.x, preferred.y));

  // Scenic landmark & valley fallback slots avoiding bottom-right compass rose
  const presetSlots = [
    { x: 63, y: 75 },
    { x: 38, y: 78 },
    { x: 43, y: 20 },
    { x: 14, y: 52 },
    { x: 74, y: 58 },
    { x: 56, y: 18 },
    { x: 32, y: 56 },
    { x: 86, y: 22 },
  ];
  candidates.push(...presetSlots);

  for (let y = 16; y <= 84; y += 14) {
    for (let x = 12; x <= 88; x += 16) {
      // Avoid bottom-right compass rose zone when auto-placing
      if (x > 78 && y > 68) continue;
      candidates.push({ x, y });
    }
  }

  for (const cand of candidates) {
    const collides = existingAreas.some((a) => isPosOverlapping(cand, a.mapPos));
    if (!collides) return clampMapPos(cand.x, cand.y);
  }

  return clampMapPos(50, 50);
}

export function autoArrangeAreasNonOverlapping(areas: AreaDef[]): AreaDef[] {
  if (areas.length <= 1) return areas;

  const sorted = [...areas].sort((a, b) => a.order - b.order);
  const positions = sorted.map((a) => ({
    id: a.id,
    x: Math.min(MAX_X, Math.max(MIN_X, a.mapPos.x)),
    y: Math.min(MAX_Y, Math.max(MIN_Y, a.mapPos.y)),
  }));

  // Iterative gentle repulsion preserving rough landmark placement
  for (let iter = 0; iter < 120; iter++) {
    let moved = false;
    for (let i = 0; i < positions.length; i++) {
      for (let j = i + 1; j < positions.length; j++) {
        const a = positions[i];
        const b = positions[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        if (Math.abs(dx) < OVERLAP_DX && Math.abs(dy) < OVERLAP_DY) {
          moved = true;
          const pushX = dx === 0 ? (i % 2 === 0 ? 1 : -1) : Math.sign(dx);
          const pushY = dy === 0 ? (j % 2 === 0 ? 1 : -1) : Math.sign(dy);

          // Push primarily along whichever axis needs less travel to clear overlap
          const remX = OVERLAP_DX - Math.abs(dx) + 1.2;
          const remY = OVERLAP_DY - Math.abs(dy) + 1.2;
          if (remX <= remY * 1.15) {
            a.x -= pushX * (remX * 0.52);
            b.x += pushX * (remX * 0.52);
          } else {
            a.y -= pushY * (remY * 0.52);
            b.y += pushY * (remY * 0.52);
          }

          a.x = Math.min(MAX_X, Math.max(MIN_X, a.x));
          a.y = Math.min(MAX_Y, Math.max(MIN_Y, a.y));
          b.x = Math.min(MAX_X, Math.max(MIN_X, b.x));
          b.y = Math.min(MAX_Y, Math.max(MIN_Y, b.y));
        }
      }
    }
    if (!moved) break;
  }

  // Fallback deterministic grid if any pair still overlaps (e.g., many areas)
  const placed: AreaDef[] = [];
  const resultMap = new Map<string, { x: number; y: number }>();
  for (const item of sorted) {
    const pos = positions.find((p) => p.id === item.id)!;
    const rounded = clampMapPos(pos.x, pos.y);
    const hasCollision = placed.some((p) => isPosOverlapping(rounded, p.mapPos));
    const finalPos = hasCollision ? findNonOverlappingPos(placed, rounded) : rounded;
    resultMap.set(item.id, finalPos);
    placed.push({ ...item, mapPos: finalPos });
  }

  return areas.map((a) => ({
    ...a,
    mapPos: resultMap.get(a.id) || a.mapPos,
  }));
}

interface WorldMapPositionEditorProps {
  areas: AreaDef[];
  onUpdateAreas: (next: AreaDef[]) => void;
}

export const WorldMapPositionEditor: React.FC<WorldMapPositionEditorProps> = ({
  areas,
  onUpdateAreas,
}) => {
  const sortedAreas = useMemo(() => [...areas].sort((a, b) => a.order - b.order), [areas]);
  const [selectedId, setSelectedId] = useState<string>(sortedAreas[0]?.id || '');
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [clickToPlace, setClickToPlace] = useState<boolean>(true);
  const mapRef = useRef<HTMLDivElement | null>(null);
  const movedDuringPointerRef = useRef(false);

  const selectedArea =
    sortedAreas.find((a) => a.id === selectedId) || sortedAreas[0] || null;

  const overlapPairs = useMemo(() => findOverlapPairs(sortedAreas), [sortedAreas]);
  const overlappingIds = useMemo(() => {
    const set = new Set<string>();
    overlapPairs.forEach(([a, b]) => {
      set.add(a.id);
      set.add(b.id);
    });
    return set;
  }, [overlapPairs]);

  const updateAreaPos = (areaId: string, x: number, y: number) => {
    const clamped = clampMapPos(x, y);
    onUpdateAreas(
      areas.map((a) => (a.id === areaId ? { ...a, mapPos: clamped } : a))
    );
  };

  const clientToPercent = (clientX: number, clientY: number) => {
    const el = mapRef.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
    const x = ((clientX - rect.left) / rect.width) * 100;
    const y = ((clientY - rect.top) / rect.height) * 100;
    return clampMapPos(x, y);
  };

  const handlePinPointerDown = (e: React.PointerEvent<HTMLButtonElement>, areaId: string) => {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    setSelectedId(areaId);
    setDraggingId(areaId);
    movedDuringPointerRef.current = false;
  };

  const handlePinPointerMove = (e: React.PointerEvent<HTMLButtonElement>, areaId: string) => {
    if (draggingId !== areaId) return;
    movedDuringPointerRef.current = true;
    const pos = clientToPercent(e.clientX, e.clientY);
    if (pos) updateAreaPos(areaId, pos.x, pos.y);
  };

  const handlePinPointerUp = (e: React.PointerEvent<HTMLButtonElement>, areaId: string) => {
    if (draggingId === areaId) {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
      setDraggingId(null);
    }
  };

  const handleMapClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!clickToPlace || !selectedArea || movedDuringPointerRef.current) return;
    const pos = clientToPercent(e.clientX, e.clientY);
    if (pos) updateAreaPos(selectedArea.id, pos.x, pos.y);
  };

  const handleAutoArrange = () => {
    onUpdateAreas(autoArrangeAreasNonOverlapping(areas));
  };

  const handleResetDefaults = () => {
    const next: AreaDef[] = [];
    const sorted = [...areas].sort((a, b) => a.order - b.order);
    for (const area of sorted) {
      const def = DEFAULT_AREAS.find((d) => d.id === area.id);
      if (def) {
        next.push({ ...area, mapPos: { ...def.mapPos } });
      } else {
        next.push({ ...area, mapPos: findNonOverlappingPos(next, area.mapPos) });
      }
    }
    const orderMap = new Map(next.map((a) => [a.id, a.mapPos]));
    onUpdateAreas(areas.map((a) => ({ ...a, mapPos: orderMap.get(a.id) || a.mapPos })));
  };

  return (
    <div className="rounded-2xl bg-slate-900 border border-slate-800 p-5 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="inline-flex items-center gap-2 text-amber-300 text-xs font-bold uppercase tracking-wider mb-1">
            <MapPin className="w-4 h-4" />
            <span>Tata Letak Peta Dunia Matematika</span>
          </div>
          <h2 className="font-bold text-lg text-white">
            Atur Posisi Wilayah di Atas Gambar Peta
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Seret pin wilayah langsung ke lokasi gambar yang sesuai, atau pilih wilayah lalu klik titik
            tujuan di peta. Sistem otomatis mendeteksi jika dua pin terlalu berdekatan.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleAutoArrange}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Rapikan Otomatis (Anti-Tumpang Tindih)</span>
          </button>
          <button
            type="button"
            onClick={handleResetDefaults}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Posisi Bawaan</span>
          </button>
        </div>
      </div>

      {/* Overlap Status Banner */}
      {overlapPairs.length > 0 ? (
        <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-500/50 flex flex-wrap items-center justify-between gap-2 text-xs text-rose-200">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">
                Terdeteksi {overlapPairs.length} pasang wilayah yang berpotensi tumpang tindih:
              </span>{' '}
              {overlapPairs.map(([a, b]) => `${a.name} ↔ ${b.name}`).join(', ')}.
            </div>
          </div>
          <button
            type="button"
            onClick={handleAutoArrange}
            className="px-3 py-1 rounded-lg bg-rose-500 hover:bg-rose-400 text-white font-bold cursor-pointer"
          >
            Pisahkan Sekarang
          </button>
        </div>
      ) : (
        <div className="p-2.5 rounded-xl bg-emerald-950/40 border border-emerald-500/35 flex items-center gap-2 text-xs text-emerald-300">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>
            Semua {sortedAreas.length} wilayah tertata rapi dengan jarak aman dan tidak saling tumpang tindih.
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-start">
        {/* Interactive 16:9 World Map Canvas */}
        <div className="xl:col-span-8 space-y-2">
          <div
            ref={mapRef}
            onClick={handleMapClick}
            className={`relative w-full aspect-video rounded-xl overflow-hidden border-2 bg-slate-950 select-none ${
              draggingId
                ? 'border-amber-400 cursor-grabbing'
                : clickToPlace
                ? 'border-slate-700 cursor-crosshair'
                : 'border-slate-700'
            }`}
          >
            <img
              src={WORLD_MAP_IMG}
              alt="Editor Posisi Peta Dunia Matematika"
              draggable={false}
              className="w-full h-full object-fill pointer-events-none"
            />
            <div className="absolute inset-0 bg-slate-950/20 pointer-events-none" />

            {/* Subtle alignment grid */}
            <div
              className="absolute inset-0 pointer-events-none opacity-20"
              style={{
                backgroundImage:
                  'linear-gradient(to right, rgba(255,255,255,0.25) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.25) 1px, transparent 1px)',
                backgroundSize: '10% 10%',
              }}
            />

            {/* Connecting Trails */}
            <svg
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              className="absolute inset-0 w-full h-full pointer-events-none"
            >
              {sortedAreas.map((area, idx) => {
                if (idx === 0) return null;
                const prev = sortedAreas[idx - 1];
                return (
                  <line
                    key={`edit-trail-${area.id}`}
                    x1={prev.mapPos.x}
                    y1={prev.mapPos.y}
                    x2={area.mapPos.x}
                    y2={area.mapPos.y}
                    stroke="#fbbf24"
                    strokeWidth="0.55"
                    strokeDasharray="1.4 1.2"
                    strokeOpacity={0.8}
                  />
                );
              })}
            </svg>

            {/* Draggable Area Pins */}
            {sortedAreas.map((area) => {
              const isSelected = area.id === selectedArea?.id;
              const hasOverlap = overlappingIds.has(area.id);
              const isDragging = draggingId === area.id;

              return (
                <button
                  key={`pin-edit-${area.id}`}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedId(area.id);
                  }}
                  onPointerDown={(e) => handlePinPointerDown(e, area.id)}
                  onPointerMove={(e) => handlePinPointerMove(e, area.id)}
                  onPointerUp={(e) => handlePinPointerUp(e, area.id)}
                  onPointerCancel={(e) => handlePinPointerUp(e, area.id)}
                  style={{
                    left: `${area.mapPos.x}%`,
                    top: `${area.mapPos.y}%`,
                    touchAction: 'none',
                  }}
                  className={`absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center transition-transform ${
                    isDragging
                      ? 'scale-115 z-30 cursor-grabbing'
                      : isSelected
                      ? 'scale-110 z-20 cursor-grab'
                      : 'hover:scale-105 z-10 cursor-grab'
                  }`}
                >
                  <div
                    className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center border-2 shadow-lg ${
                      hasOverlap
                        ? 'bg-rose-500 border-white text-white animate-pulse'
                        : isSelected
                        ? 'bg-amber-400 border-white text-slate-950'
                        : 'bg-slate-900/95 border-amber-400 text-amber-300'
                    }`}
                  >
                    {hasOverlap ? (
                      <AlertTriangle className="w-4 h-4" />
                    ) : (
                      <Compass className="w-4 h-4" />
                    )}
                  </div>
                  <span
                    className={`mt-1 px-2 py-0.5 rounded text-[11px] font-bold whitespace-nowrap max-w-[140px] truncate shadow ${
                      hasOverlap
                        ? 'bg-rose-600 text-white border border-rose-300'
                        : isSelected
                        ? 'bg-amber-400 text-slate-950'
                        : 'bg-slate-950/90 text-slate-100 border border-slate-700'
                    }`}
                  >
                    {area.order}. {area.name}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
            <label className="inline-flex items-center gap-2 cursor-pointer text-slate-300">
              <input
                type="checkbox"
                checked={clickToPlace}
                onChange={(e) => setClickToPlace(e.target.checked)}
              />
              <span>Klik titik kosong di peta untuk memindahkan wilayah terpilih</span>
            </label>
            <span className="inline-flex items-center gap-1 text-slate-400">
              <Move className="w-3.5 h-3.5 text-amber-400" />
              <span>Bisa diseret (drag &amp; drop) langsung pada pin</span>
            </span>
          </div>
        </div>

        {/* Fine Coordinate Controls & Area Picker */}
        <div className="xl:col-span-4 rounded-xl bg-slate-950 border border-slate-800 p-4 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Pilih Wilayah yang Diatur
            </label>
            <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
              {sortedAreas.map((area) => {
                const isSelected = area.id === selectedArea?.id;
                const hasOverlap = overlappingIds.has(area.id);
                return (
                  <button
                    key={`pick-${area.id}`}
                    type="button"
                    onClick={() => setSelectedId(area.id)}
                    className={`w-full px-3 py-2 rounded-lg text-left text-xs border flex items-center justify-between gap-2 cursor-pointer ${
                      isSelected
                        ? 'bg-amber-500/15 border-amber-400 text-amber-200 font-semibold'
                        : hasOverlap
                        ? 'bg-rose-950/40 border-rose-500/50 text-rose-200'
                        : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <span className="truncate">
                      {area.order}. {area.name}
                    </span>
                    <span className="font-mono text-[11px] shrink-0 text-slate-400">
                      ({area.mapPos.x}%, {area.mapPos.y}%)
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {selectedArea && (
            <div className="pt-3 border-t border-slate-800 space-y-3">
              <div>
                <div className="text-xs text-slate-400">Koordinat Terpilih</div>
                <div className="font-bold text-sm text-white truncate">
                  {selectedArea.order}. {selectedArea.name}
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <label className="text-slate-300">Posisi Horizontal (X%)</label>
                  <span className="font-mono text-amber-300">{selectedArea.mapPos.x}%</span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min={MIN_X}
                    max={MAX_X}
                    value={selectedArea.mapPos.x}
                    onChange={(e) =>
                      updateAreaPos(selectedArea.id, Number(e.target.value), selectedArea.mapPos.y)
                    }
                    className="flex-1 accent-amber-400 cursor-pointer"
                  />
                  <input
                    type="number"
                    min={MIN_X}
                    max={MAX_X}
                    value={selectedArea.mapPos.x}
                    onChange={(e) =>
                      updateAreaPos(
                        selectedArea.id,
                        Number(e.target.value) || MIN_X,
                        selectedArea.mapPos.y
                      )
                    }
                    className="w-16 px-2 py-1 rounded bg-slate-900 border border-slate-700 text-xs font-mono text-white"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <label className="text-slate-300">Posisi Vertikal (Y%)</label>
                  <span className="font-mono text-amber-300">{selectedArea.mapPos.y}%</span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min={MIN_Y}
                    max={MAX_Y}
                    value={selectedArea.mapPos.y}
                    onChange={(e) =>
                      updateAreaPos(selectedArea.id, selectedArea.mapPos.x, Number(e.target.value))
                    }
                    className="flex-1 accent-amber-400 cursor-pointer"
                  />
                  <input
                    type="number"
                    min={MIN_Y}
                    max={MAX_Y}
                    value={selectedArea.mapPos.y}
                    onChange={(e) =>
                      updateAreaPos(
                        selectedArea.id,
                        selectedArea.mapPos.x,
                        Number(e.target.value) || MIN_Y
                      )
                    }
                    className="w-16 px-2 py-1 rounded bg-slate-900 border border-slate-700 text-xs font-mono text-white"
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
