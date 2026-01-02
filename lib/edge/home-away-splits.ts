/**
 * Home/Away Splits Edge Detector
 *
 * Analyzes if a player performs significantly better or worse at home vs road.
 * Flags if there's a 20%+ difference in fantasy points.
 *
 * DATA DISCLAIMER: Using sample 2025 data. Would integrate with nflfastR for real stats.
 */

import type { EdgeSignal, Player } from '../../types';

interface SplitData {
  homeAvg: number;
  awayAvg: number;
  homePPG: number;
  awayPPG: number;
}

// Sample home/away splits for notable players (2025 season averages)
// In production, this would be calculated from nflfastR play-by-play data
const HOME_AWAY_SPLITS: Record<string, SplitData> = {
  // QBs with notable home/away splits
  'Lamar Jackson': { homeAvg: 26.8, awayAvg: 21.2, homePPG: 26.8, awayPPG: 21.2 },
  'Josh Allen': { homeAvg: 28.5, awayAvg: 24.1, homePPG: 28.5, awayPPG: 24.1 },
  'Jalen Hurts': { homeAvg: 24.2, awayAvg: 22.8, homePPG: 24.2, awayPPG: 22.8 },
  'Patrick Mahomes': { homeAvg: 22.1, awayAvg: 23.4, homePPG: 22.1, awayPPG: 23.4 },

  // RBs
  'Saquon Barkley': { homeAvg: 22.4, awayAvg: 17.8, homePPG: 22.4, awayPPG: 17.8 },
  'Derrick Henry': { homeAvg: 18.2, awayAvg: 19.8, homePPG: 18.2, awayPPG: 19.8 },
  'Bijan Robinson': { homeAvg: 17.5, awayAvg: 14.2, homePPG: 17.5, awayPPG: 14.2 },

  // WRs
  "Ja'Marr Chase": { homeAvg: 24.1, awayAvg: 19.5, homePPG: 24.1, awayPPG: 19.5 },
  'Amon-Ra St. Brown': { homeAvg: 21.8, awayAvg: 18.2, homePPG: 21.8, awayPPG: 18.2 },
  'CeeDee Lamb': { homeAvg: 19.2, awayAvg: 21.5, homePPG: 19.2, awayPPG: 21.5 },
  'Tyreek Hill': { homeAvg: 18.5, awayAvg: 16.8, homePPG: 18.5, awayPPG: 16.8 },
};

interface HomeAwaySplitResult {
  signals: EdgeSignal[];
  summary: string;
  splitDifference: number;
  isHome: boolean;
}

/**
 * Detect home/away split edge for a player
 */
export function detectHomeAwaySplitEdge(
  player: Player,
  isHome: boolean,
  week: number
): HomeAwaySplitResult {
  const signals: EdgeSignal[] = [];
  const splitData = HOME_AWAY_SPLITS[player.name];

  if (!splitData) {
    return {
      signals: [],
      summary: 'No split data available',
      splitDifference: 0,
      isHome,
    };
  }

  const { homeAvg, awayAvg } = splitData;
  const baseAvg = (homeAvg + awayAvg) / 2;
  const splitDifference = ((homeAvg - awayAvg) / baseAvg) * 100;
  const absDiff = Math.abs(splitDifference);

  // Only flag if 20%+ difference
  if (absDiff >= 20) {
    const isPositive = (isHome && homeAvg > awayAvg) || (!isHome && awayAvg > homeAvg);
    const currentAvg = isHome ? homeAvg : awayAvg;
    const otherAvg = isHome ? awayAvg : homeAvg;
    const location = isHome ? 'home' : 'away';

    signals.push({
      type: 'home_away_split',
      playerId: player.id,
      week,
      impact: isPositive ? 'positive' : 'negative',
      magnitude: isPositive ? Math.min(4, absDiff / 10) : -Math.min(4, absDiff / 10),
      confidence: 65,
      shortDescription: isPositive
        ? `+${absDiff.toFixed(0)}% ${location} boost (${currentAvg.toFixed(1)} vs ${otherAvg.toFixed(1)} PPG)`
        : `-${absDiff.toFixed(0)}% ${location} decline (${currentAvg.toFixed(1)} vs ${otherAvg.toFixed(1)} PPG)`,
      details: `${player.name} averages ${homeAvg.toFixed(1)} PPG at home vs ${awayAvg.toFixed(1)} PPG on the road. ` +
        `This ${absDiff.toFixed(0)}% difference is significant. ` +
        `Playing ${location} this week ${isPositive ? 'favors' : 'hurts'} their projection.`,
      source: 'home-away-splits',
      timestamp: new Date(),
    });
  }

  // Generate summary
  let summary: string;
  if (absDiff >= 20) {
    const location = isHome ? 'Home' : 'Road';
    const trend = (isHome && homeAvg > awayAvg) || (!isHome && awayAvg > homeAvg) ? 'boost' : 'fade';
    summary = `${location} ${trend}: ${absDiff.toFixed(0)}% split`;
  } else if (splitData) {
    summary = 'No significant home/away split';
  } else {
    summary = 'No split data';
  }

  return {
    signals,
    summary,
    splitDifference,
    isHome,
  };
}

export default { detectHomeAwaySplitEdge };
