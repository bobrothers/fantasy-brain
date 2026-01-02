/**
 * Primetime Performance Edge Detector
 *
 * Tracks if a player over/underperforms in SNF/MNF/TNF primetime games.
 * Some players thrive under the lights, others shrink.
 *
 * DATA DISCLAIMER: Using sample 2025 data. Would integrate with nflfastR for real stats.
 */

import type { EdgeSignal, Player } from '../../types';

type SlotType = 'SNF' | 'MNF' | 'TNF' | 'regular';

interface PrimetimeData {
  regularAvg: number;
  primetimeAvg: number;
  primetimeGames: number;
}

// Sample primetime performance data
// In production, would filter nflfastR data by game time slot
const PRIMETIME_PERFORMERS: Record<string, PrimetimeData> = {
  // Primetime stars (overperform)
  'Patrick Mahomes': { regularAvg: 21.5, primetimeAvg: 26.8, primetimeGames: 6 },
  'Travis Kelce': { regularAvg: 14.2, primetimeAvg: 18.5, primetimeGames: 6 },
  'Tyreek Hill': { regularAvg: 16.8, primetimeAvg: 21.2, primetimeGames: 4 },
  'Josh Allen': { regularAvg: 24.8, primetimeAvg: 28.4, primetimeGames: 5 },
  'Lamar Jackson': { regularAvg: 23.2, primetimeAvg: 27.1, primetimeGames: 5 },
  "Ja'Marr Chase": { regularAvg: 20.5, primetimeAvg: 24.8, primetimeGames: 4 },
  'Derrick Henry': { regularAvg: 17.8, primetimeAvg: 21.5, primetimeGames: 4 },

  // Primetime faders (underperform)
  'Dak Prescott': { regularAvg: 20.2, primetimeAvg: 16.5, primetimeGames: 5 },
  'CeeDee Lamb': { regularAvg: 21.2, primetimeAvg: 17.8, primetimeGames: 5 },
  'Kirk Cousins': { regularAvg: 18.5, primetimeAvg: 14.2, primetimeGames: 3 },
  'Aaron Jones': { regularAvg: 15.8, primetimeAvg: 12.5, primetimeGames: 3 },
};

// Week 18 primetime games
const PRIMETIME_GAMES: Record<string, SlotType> = {
  // Saturday Night
  SF: 'SNF',
  SEA: 'SNF',

  // Sunday Night Football
  BAL: 'SNF',
  PIT: 'SNF',
};

interface PrimetimeResult {
  signals: EdgeSignal[];
  summary: string;
  isPrimetime: boolean;
  slotType: SlotType;
}

/**
 * Detect primetime performance edge
 */
export function detectPrimetimeEdge(
  player: Player,
  week: number
): PrimetimeResult {
  const signals: EdgeSignal[] = [];

  const slotType = player.team ? PRIMETIME_GAMES[player.team] || 'regular' : 'regular';
  const isPrimetime = slotType !== 'regular';

  if (!isPrimetime) {
    return {
      signals: [],
      summary: 'Regular time slot',
      isPrimetime: false,
      slotType: 'regular',
    };
  }

  const primetimeData = PRIMETIME_PERFORMERS[player.name];

  if (!primetimeData) {
    return {
      signals: [],
      summary: `${slotType} game - no historical data`,
      isPrimetime: true,
      slotType,
    };
  }

  const { regularAvg, primetimeAvg, primetimeGames } = primetimeData;
  const diff = primetimeAvg - regularAvg;
  const pctDiff = (diff / regularAvg) * 100;
  const absPctDiff = Math.abs(pctDiff);

  // Only flag if 15%+ difference with enough sample
  if (absPctDiff >= 15 && primetimeGames >= 3) {
    const isPositive = diff > 0;

    signals.push({
      type: 'primetime_performance',
      playerId: player.id,
      week,
      impact: isPositive ? 'positive' : 'negative',
      magnitude: isPositive ? Math.min(3, absPctDiff / 10) : -Math.min(3, absPctDiff / 10),
      confidence: Math.min(75, 50 + primetimeGames * 4),
      shortDescription: isPositive
        ? `Primetime star: +${absPctDiff.toFixed(0)}% in ${slotType} games`
        : `Primetime fader: -${absPctDiff.toFixed(0)}% in ${slotType} games`,
      details: `${player.name} averages ${primetimeAvg.toFixed(1)} PPG in primetime vs ${regularAvg.toFixed(1)} PPG in regular slots. ` +
        `Based on ${primetimeGames} primetime games this season. ` +
        `${isPositive ? 'Expect elevated production under the lights.' : 'Historically struggles in primetime spots.'}`,
      source: 'primetime-performance',
      timestamp: new Date(),
    });
  }

  // Generate summary
  let summary: string;
  if (primetimeData && absPctDiff >= 15) {
    const trend = diff > 0 ? 'star' : 'fader';
    summary = `${slotType} ${trend}: ${diff > 0 ? '+' : ''}${pctDiff.toFixed(0)}%`;
  } else {
    summary = `${slotType} game - neutral history`;
  }

  return {
    signals,
    summary,
    isPrimetime,
    slotType,
  };
}

export default { detectPrimetimeEdge };
