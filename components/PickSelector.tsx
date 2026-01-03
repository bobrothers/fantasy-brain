'use client';

import { useState, useRef } from 'react';

interface DraftPick {
  year: number;
  round: 1 | 2 | 3 | 4;
  position: 'early' | 'mid' | 'late';
}

interface Props {
  picks: DraftPick[];
  onChange: (picks: DraftPick[]) => void;
  maxPicks?: number;
  label: string;
  color: 'emerald' | 'amber';
}

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = [CURRENT_YEAR + 1, CURRENT_YEAR + 2, CURRENT_YEAR + 3]; // Next 3 draft years
const ROUNDS = [1, 2, 3, 4] as const;
const POSITIONS = ['early', 'mid', 'late'] as const;

function formatPick(pick: DraftPick): string {
  const posLabel = pick.position === 'early' ? 'Early' : pick.position === 'late' ? 'Late' : 'Mid';
  const roundLabel = pick.round === 1 ? '1st' : pick.round === 2 ? '2nd' : pick.round === 3 ? '3rd' : '4th';
  return `${pick.year} ${posLabel} ${roundLabel}`;
}

function getPickValue(pick: DraftPick): number {
  // Simplified value calculation for display
  const baseValues: Record<string, number> = {
    '1-early': 85, '1-mid': 72, '1-late': 60,
    '2-early': 48, '2-mid': 40, '2-late': 32,
    '3-early': 25, '3-mid': 20, '3-late': 15,
    '4-early': 12, '4-mid': 8, '4-late': 5,
  };
  const key = `${pick.round}-${pick.position}`;
  const base = baseValues[key] || 20;

  // Year discount
  const yearsOut = pick.year - CURRENT_YEAR;
  const multiplier = yearsOut <= 1 ? 0.92 : yearsOut === 2 ? 0.82 : 0.70;

  return Math.round(base * multiplier);
}

function getPlayerEquivalent(value: number): string {
  if (value >= 75) return 'Elite prospect';
  if (value >= 60) return 'High-end starter';
  if (value >= 45) return 'Mid WR2/RB2';
  if (value >= 30) return 'Flex player';
  if (value >= 20) return 'Bench stash';
  return 'Dart throw';
}

export default function PickSelector({ picks, onChange, maxPicks = 4, label, color }: Props) {
  const [showForm, setShowForm] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [newPick, setNewPick] = useState<DraftPick>({
    year: YEARS[0],
    round: 1,
    position: 'mid',
  });
  const infoRef = useRef<HTMLDivElement>(null);

  const addPick = () => {
    if (picks.length >= maxPicks) return;
    onChange([...picks, newPick]);
    setShowForm(false);
    // Reset for next pick
    setNewPick({ year: YEARS[0], round: 1, position: 'mid' });
  };

  const removePick = (index: number) => {
    onChange(picks.filter((_, i) => i !== index));
  };

  const colorClasses = color === 'emerald'
    ? 'border-emerald-700/50 hover:border-emerald-500'
    : 'border-amber-700/50 hover:border-amber-500';

  const btnColorClasses = color === 'emerald'
    ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'
    : 'bg-amber-500/20 text-amber-400 hover:bg-amber-500/30';

  return (
    <div className="mt-3">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xs text-zinc-500 uppercase tracking-wider">{label}</span>
        <div className="relative" ref={infoRef}>
          <button
            type="button"
            onClick={() => setShowInfo(!showInfo)}
            onMouseEnter={() => setShowInfo(true)}
            onMouseLeave={() => setShowInfo(false)}
            className="text-zinc-600 hover:text-zinc-400 transition-colors"
            aria-label="Pick scoring info"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </button>
          {showInfo && (
            <div className="absolute z-50 left-0 top-5 w-72 bg-zinc-800 border border-zinc-700 shadow-xl p-3 text-xs">
              <div className="font-bold text-zinc-200 mb-2">Pick Value = Hit Rate</div>
              <div className="text-zinc-500 text-[10px] mb-2">Based on historical rookie draft outcomes</div>
              <div className="space-y-1.5 text-zinc-400 mb-3">
                <div className="flex justify-between items-center">
                  <span>Early 1st</span>
                  <span className="text-zinc-500 text-[10px]">~50% starter, ~25% star</span>
                  <span className="text-emerald-400 font-bold">85</span>
                </div>
                <div className="flex justify-between items-center">
                  <span>Mid 1st</span>
                  <span className="text-zinc-500 text-[10px]">~40% starter, ~15% star</span>
                  <span className="text-lime-400 font-bold">72</span>
                </div>
                <div className="flex justify-between items-center">
                  <span>Late 1st</span>
                  <span className="text-zinc-500 text-[10px]">~35% starter, ~10% star</span>
                  <span className="text-lime-400 font-bold">60</span>
                </div>
                <div className="flex justify-between items-center">
                  <span>Early 2nd</span>
                  <span className="text-zinc-500 text-[10px]">~25% starter, ~5% star</span>
                  <span className="text-amber-400 font-bold">48</span>
                </div>
                <div className="flex justify-between items-center">
                  <span>Mid 2nd</span>
                  <span className="text-zinc-500 text-[10px]">~20% starter</span>
                  <span className="text-amber-400 font-bold">40</span>
                </div>
                <div className="flex justify-between items-center">
                  <span>Late 2nd</span>
                  <span className="text-zinc-500 text-[10px]">~15% starter</span>
                  <span className="text-orange-400 font-bold">32</span>
                </div>
                <div className="flex justify-between items-center">
                  <span>3rd Round</span>
                  <span className="text-zinc-500 text-[10px]">~8% starter</span>
                  <span className="text-orange-400 font-bold">15-25</span>
                </div>
                <div className="flex justify-between items-center">
                  <span>4th Round</span>
                  <span className="text-zinc-500 text-[10px]">lottery ticket</span>
                  <span className="text-red-400 font-bold">5-12</span>
                </div>
              </div>
              <div className="border-t border-zinc-700 pt-2">
                <div className="font-bold text-zinc-300 mb-1">Future Pick Discount</div>
                <div className="text-zinc-500 text-[10px] mb-1">Uncertainty increases with time</div>
                <div className="flex gap-4 text-zinc-400">
                  <span>2026: <span className="text-zinc-300">-8%</span></span>
                  <span>2027: <span className="text-zinc-300">-18%</span></span>
                  <span>2028: <span className="text-zinc-300">-30%</span></span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Existing picks */}
      {picks.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2">
          {picks.map((pick, i) => (
            <div
              key={i}
              className={`inline-flex items-center gap-2 px-2 py-1 border ${colorClasses} bg-zinc-900`}
            >
              <span className="text-xs text-zinc-300">{formatPick(pick)}</span>
              <span className="text-xs text-zinc-500">({getPickValue(pick)} pts)</span>
              <button
                type="button"
                onClick={() => removePick(i)}
                className="text-zinc-500 hover:text-red-400 text-xs"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add pick form */}
      {showForm ? (
        <div className="space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={newPick.year}
              onChange={(e) => setNewPick({ ...newPick, year: parseInt(e.target.value) })}
              className="bg-zinc-800 border border-zinc-700 text-sm px-2 py-1 text-zinc-300"
            >
              {YEARS.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>

            <select
              value={newPick.position}
              onChange={(e) => setNewPick({ ...newPick, position: e.target.value as 'early' | 'mid' | 'late' })}
              className="bg-zinc-800 border border-zinc-700 text-sm px-2 py-1 text-zinc-300"
            >
              {POSITIONS.map((p) => (
                <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
              ))}
            </select>

            <select
              value={newPick.round}
              onChange={(e) => setNewPick({ ...newPick, round: parseInt(e.target.value) as 1 | 2 | 3 | 4 })}
              className="bg-zinc-800 border border-zinc-700 text-sm px-2 py-1 text-zinc-300"
            >
              {ROUNDS.map((r) => (
                <option key={r} value={r}>{r === 1 ? '1st' : r === 2 ? '2nd' : r === 3 ? '3rd' : '4th'}</option>
              ))}
            </select>

            <button
              type="button"
              onClick={addPick}
              className={`text-xs px-3 py-1 ${btnColorClasses}`}
            >
              Add
            </button>

            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="text-xs px-2 py-1 text-zinc-500 hover:text-zinc-300"
            >
              Cancel
            </button>
          </div>

          {/* Prominent pick value display */}
          <div className={`p-2 border ${color === 'emerald' ? 'border-emerald-700/50 bg-emerald-950/30' : 'border-amber-700/50 bg-amber-950/30'}`}>
            <div className="flex items-center justify-between">
              <div>
                <span className="text-zinc-300 font-medium">{formatPick(newPick)}</span>
                <span className="text-zinc-500 text-xs ml-2">≈ {getPlayerEquivalent(getPickValue(newPick))}</span>
              </div>
              <div className={`text-xl font-bold ${color === 'emerald' ? 'text-emerald-400' : 'text-amber-400'}`}>
                {getPickValue(newPick)} pts
              </div>
            </div>
          </div>
        </div>
      ) : (
        picks.length < maxPicks && (
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className={`text-xs px-3 py-1 border ${colorClasses} text-zinc-400 hover:text-zinc-200`}
          >
            + Add Draft Pick
          </button>
        )
      )}
    </div>
  );
}
