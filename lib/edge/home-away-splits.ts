/**
 * Home/Away Splits Edge Detector
 *
 * Analyzes if a player performs significantly better or worse at home vs road.
 * Flags if there's a 20%+ difference in fantasy points.
 *
 * DATA SOURCE: nflverse player_stats + games.csv (LIVE DATA)
 * Calculates PPR fantasy points per game at home vs away
 */

import type { EdgeSignal, Player } from '../../types';
import { nflfastr } from '../providers/nflfastr';

interface HomeAwaySplitResult {
  signals: EdgeSignal[];
  summary: string;
  splitDifference: number;
  isHome: boolean;
  splits?: {
    homePPG: number;
    awayPPG: number;
    homeGames: number;
    awayGames: number;
  };
}

/**
 * Detect home/away split edge for a player
 * Uses LIVE data from nflverse
 */
export async function detectHomeAwaySplitEdge(
  player: Player,
  isHome: boolean,
  week: number
): Promise<HomeAwaySplitResult> {
  const signals: EdgeSignal[] = [];

  // Get live splits from nflverse data
  const splitData = await nflfastr.getHomeAwaySplits(player.name);

  if (!splitData) {
    return {
      signals: [],
      summary: 'No split data available',
      splitDifference: 0,
      isHome,
    };
  }

  const { homePPG, awayPPG, homeGames, awayGames, splitPct } = splitData;
  const absDiff = Math.abs(splitPct);

  // Only flag if 20%+ difference
  if (absDiff >= 20) {
    const isPositive = (isHome && homePPG > awayPPG) || (!isHome && awayPPG > homePPG);
    const currentAvg = isHome ? homePPG : awayPPG;
    const otherAvg = isHome ? awayPPG : homePPG;
    const location = isHome ? 'home' : 'away';

    signals.push({
      type: 'home_away_split',
      playerId: player.id,
      week,
      impact: isPositive ? 'positive' : 'negative',
      magnitude: isPositive ? Math.min(4, absDiff / 10) : -Math.min(4, absDiff / 10),
      confidence: Math.min(80, 50 + (homeGames + awayGames) * 2), // Higher confidence with more games
      shortDescription: isPositive
        ? `+${absDiff.toFixed(0)}% ${location} boost (${currentAvg.toFixed(1)} vs ${otherAvg.toFixed(1)} PPG)`
        : `-${absDiff.toFixed(0)}% ${location} decline (${currentAvg.toFixed(1)} vs ${otherAvg.toFixed(1)} PPG)`,
      details: `${player.name} averages ${homePPG.toFixed(1)} PPG at home (${homeGames} games) vs ${awayPPG.toFixed(1)} PPG on the road (${awayGames} games). ` +
        `This ${absDiff.toFixed(0)}% difference is significant. ` +
        `Playing ${location} this week ${isPositive ? 'favors' : 'hurts'} their projection.`,
      source: 'home-away-splits (nflverse)',
      timestamp: new Date(),
    });
  }

  // Generate summary
  let summary: string;
  if (absDiff >= 20) {
    const location = isHome ? 'Home' : 'Road';
    const trend = (isHome && homePPG > awayPPG) || (!isHome && awayPPG > homePPG) ? 'boost' : 'fade';
    summary = `${location} ${trend}: ${absDiff.toFixed(0)}% split`;
  } else {
    summary = 'No significant home/away split';
  }

  return {
    signals,
    summary,
    splitDifference: splitPct,
    isHome,
    splits: {
      homePPG,
      awayPPG,
      homeGames,
      awayGames,
    },
  };
}

// Sync wrapper for backwards compatibility - uses cached data
// Note: First call may not have data; subsequent calls will work
let cachedSplits: Map<string, Awaited<ReturnType<typeof nflfastr.getHomeAwaySplits>>> = new Map();

export function detectHomeAwaySplitEdgeSync(
  player: Player,
  isHome: boolean,
  week: number
): Omit<HomeAwaySplitResult, 'splits'> {
  const signals: EdgeSignal[] = [];

  // Check cache
  const splitData = cachedSplits.get(player.name);

  if (!splitData) {
    // Trigger async load for next time
    nflfastr.getHomeAwaySplits(player.name).then(data => {
      if (data) cachedSplits.set(player.name, data);
    });

    return {
      signals: [],
      summary: 'No split data available',
      splitDifference: 0,
      isHome,
    };
  }

  const { homePPG, awayPPG, homeGames, awayGames, splitPct } = splitData;
  const absDiff = Math.abs(splitPct);

  if (absDiff >= 20) {
    const isPositive = (isHome && homePPG > awayPPG) || (!isHome && awayPPG > homePPG);
    const currentAvg = isHome ? homePPG : awayPPG;
    const otherAvg = isHome ? awayPPG : homePPG;
    const location = isHome ? 'home' : 'away';

    signals.push({
      type: 'home_away_split',
      playerId: player.id,
      week,
      impact: isPositive ? 'positive' : 'negative',
      magnitude: isPositive ? Math.min(4, absDiff / 10) : -Math.min(4, absDiff / 10),
      confidence: Math.min(80, 50 + (homeGames + awayGames) * 2),
      shortDescription: isPositive
        ? `+${absDiff.toFixed(0)}% ${location} boost (${currentAvg.toFixed(1)} vs ${otherAvg.toFixed(1)} PPG)`
        : `-${absDiff.toFixed(0)}% ${location} decline (${currentAvg.toFixed(1)} vs ${otherAvg.toFixed(1)} PPG)`,
      details: `${player.name} averages ${homePPG.toFixed(1)} PPG at home (${homeGames} games) vs ${awayPPG.toFixed(1)} PPG on the road (${awayGames} games).`,
      source: 'home-away-splits (nflverse)',
      timestamp: new Date(),
    });
  }

  let summary: string;
  if (absDiff >= 20) {
    const location = isHome ? 'Home' : 'Road';
    const trend = (isHome && homePPG > awayPPG) || (!isHome && awayPPG > homePPG) ? 'boost' : 'fade';
    summary = `${location} ${trend}: ${absDiff.toFixed(0)}% split`;
  } else {
    summary = 'No significant home/away split';
  }

  return {
    signals,
    summary,
    splitDifference: splitPct,
    isHome,
  };
}

export default { detectHomeAwaySplitEdge, detectHomeAwaySplitEdgeSync };
