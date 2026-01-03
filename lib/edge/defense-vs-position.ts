/**
 * Defense vs Position Edge Detector
 *
 * Analyzes how opposing defenses perform against specific positions.
 * A defense that's weak vs. RBs = boost for opposing RBs.
 * A defense that's elite vs. WRs = downgrade for opposing WRs.
 *
 * NOW LIVE: Rankings calculated from Sleeper weekly stats + ESPN schedule
 *
 * Research basis:
 * - Matchup data has ~15-20% predictive value for fantasy scoring
 * - More useful for identifying extreme matchups than average ones
 * - RB matchups matter more than WR matchups (game script dependent)
 */

import type { EdgeSignal, Player } from '../../types';
import { calculateDefenseRankings } from '../providers/defense-rankings';

// Thresholds for what constitutes a good/bad matchup
const THRESHOLDS = {
  SMASH_SPOT: 28,      // Defense ranked 28-32 = smash spot
  GOOD_MATCHUP: 22,    // Defense ranked 22-27 = good matchup
  NEUTRAL_HIGH: 18,    // Defense ranked 13-21 = neutral
  NEUTRAL_LOW: 12,
  TOUGH_MATCHUP: 8,    // Defense ranked 8-12 = tough matchup
  AVOID: 7,            // Defense ranked 1-7 = shadow realm
};

interface DefenseMatchupResult {
  signals: EdgeSignal[];
  summary: string;
  matchupRank: number;
  tier: 'smash' | 'good' | 'neutral' | 'tough' | 'avoid';
  defenseOverall: string;
  ptsAllowed?: number; // Average PPR points allowed to this position
}

/**
 * Get the relevant defensive ranking for a player's position
 */
function getPositionRank(defense: { vsQB: number; vsRB: number; vsWR: number; vsTE: number }, position: string): number {
  switch (position) {
    case 'QB': return defense.vsQB;
    case 'RB': return defense.vsRB;
    case 'WR': return defense.vsWR;
    case 'TE': return defense.vsTE;
    default: return 16; // Middle of the pack default
  }
}

/**
 * Get points allowed for a position
 */
function getPointsAllowed(defense: { ptsAllowedQB: number; ptsAllowedRB: number; ptsAllowedWR: number; ptsAllowedTE: number }, position: string): number {
  switch (position) {
    case 'QB': return defense.ptsAllowedQB;
    case 'RB': return defense.ptsAllowedRB;
    case 'WR': return defense.ptsAllowedWR;
    case 'TE': return defense.ptsAllowedTE;
    default: return 0;
  }
}

/**
 * Classify matchup tier based on defensive ranking
 */
function getMatchupTier(rank: number): 'smash' | 'good' | 'neutral' | 'tough' | 'avoid' {
  if (rank >= THRESHOLDS.SMASH_SPOT) return 'smash';
  if (rank >= THRESHOLDS.GOOD_MATCHUP) return 'good';
  if (rank >= THRESHOLDS.NEUTRAL_LOW) return 'neutral';
  if (rank >= THRESHOLDS.AVOID) return 'tough';
  return 'avoid';
}

/**
 * Calculate impact magnitude based on matchup tier
 */
function calculateMagnitude(rank: number, position: string): number {
  // Normalize rank to -5 to +5 scale
  // Rank 1 (best D) = -4, Rank 32 (worst D) = +4
  const normalized = ((rank - 16.5) / 16.5) * 4;

  // Position-specific adjustments
  // RB matchups are more predictive than WR matchups
  const positionMultiplier: Record<string, number> = {
    QB: 0.9,
    RB: 1.2,  // RB matchups matter most
    WR: 0.8,  // WR matchups less predictive (scheme/target dependent)
    TE: 1.0,
  };

  const multiplier = positionMultiplier[position] || 1.0;
  return Math.round(normalized * multiplier * 10) / 10;
}

/**
 * Detect defense vs position matchup edge - NOW LIVE FROM SLEEPER + ESPN
 */
export async function detectDefenseMatchupEdge(
  player: Player,
  opponentTeam: string,
  week: number
): Promise<DefenseMatchupResult> {
  const signals: EdgeSignal[] = [];

  // Fetch live defense rankings
  const rankings = await calculateDefenseRankings();
  const defense = rankings[opponentTeam];

  if (!defense) {
    return {
      signals: [],
      summary: 'No defensive data for ' + opponentTeam,
      matchupRank: 16,
      tier: 'neutral',
      defenseOverall: 'Unknown',
    };
  }

  const position = player.position || 'WR';
  const matchupRank = getPositionRank(defense, position);
  const ptsAllowed = getPointsAllowed(defense, position);
  const tier = getMatchupTier(matchupRank);
  const magnitude = calculateMagnitude(matchupRank, position);

  // Determine overall defensive quality
  const avgRank = (defense.vsQB + defense.vsRB + defense.vsWR + defense.vsTE) / 4;
  let defenseOverall: string;
  if (avgRank <= 8) defenseOverall = 'Elite';
  else if (avgRank <= 14) defenseOverall = 'Good';
  else if (avgRank <= 20) defenseOverall = 'Average';
  else if (avgRank <= 26) defenseOverall = 'Below Average';
  else defenseOverall = 'Poor';

  // Generate signal based on tier
  if (tier === 'smash' || tier === 'good') {
    signals.push({
      type: 'matchup_defense',
      playerId: player.id,
      week,
      impact: 'positive',
      magnitude,
      confidence: tier === 'smash' ? 80 : 70,
      shortDescription: tier === 'smash'
        ? `Smash spot: ${opponentTeam} is #${matchupRank} vs ${position}s (${ptsAllowed} PPR/gm)`
        : `Good matchup: ${opponentTeam} is #${matchupRank} vs ${position}s`,
      details: `${opponentTeam} defense ranks #${matchupRank} against ${position}s this season, allowing ${ptsAllowed} PPR points per game. ` +
        (tier === 'smash'
          ? 'This is a top-tier matchup. Expect elevated production. '
          : 'This is a favorable matchup. Slight boost to expectations. ') +
        `Overall defense rating: ${defenseOverall}.`,
      source: 'defense-rankings-live',
      timestamp: new Date(),
    });
  } else if (tier === 'tough' || tier === 'avoid') {
    signals.push({
      type: 'matchup_defense',
      playerId: player.id,
      week,
      impact: 'negative',
      magnitude,
      confidence: tier === 'avoid' ? 80 : 70,
      shortDescription: tier === 'avoid'
        ? `Avoid: ${opponentTeam} is #${matchupRank} vs ${position}s (${ptsAllowed} PPR/gm)`
        : `Tough matchup: ${opponentTeam} is #${matchupRank} vs ${position}s`,
      details: `${opponentTeam} defense ranks #${matchupRank} against ${position}s this season, allowing only ${ptsAllowed} PPR points per game. ` +
        (tier === 'avoid'
          ? 'This is an elite defense. Expect suppressed production. Consider alternatives. '
          : 'This is a difficult matchup. Temper expectations. ') +
        `Overall defense rating: ${defenseOverall}.`,
      source: 'defense-rankings-live',
      timestamp: new Date(),
    });
  }

  // Generate summary
  let summary: string;
  switch (tier) {
    case 'smash':
      summary = `Smash spot: ${opponentTeam} #${matchupRank} vs ${position}s (${ptsAllowed} PPR/gm)`;
      break;
    case 'good':
      summary = `Good matchup: ${opponentTeam} #${matchupRank} vs ${position}s`;
      break;
    case 'neutral':
      summary = `Neutral: ${opponentTeam} #${matchupRank} vs ${position}s`;
      break;
    case 'tough':
      summary = `Tough matchup: ${opponentTeam} #${matchupRank} vs ${position}s`;
      break;
    case 'avoid':
      summary = `Avoid: ${opponentTeam} #${matchupRank} vs ${position}s`;
      break;
  }

  return {
    signals,
    summary,
    matchupRank,
    tier,
    defenseOverall,
    ptsAllowed,
  };
}

/**
 * Get all smash spots for the week (for recommendations)
 */
export async function getSmashSpots(position: string): Promise<Array<{ vsTeam: string; rank: number; ptsAllowed: number }>> {
  const rankings = await calculateDefenseRankings();
  const smashSpots: Array<{ vsTeam: string; rank: number; ptsAllowed: number }> = [];

  for (const [team, defense] of Object.entries(rankings)) {
    const rank = getPositionRank(defense, position);
    if (rank >= THRESHOLDS.SMASH_SPOT) {
      smashSpots.push({
        vsTeam: team,
        rank,
        ptsAllowed: getPointsAllowed(defense, position),
      });
    }
  }

  return smashSpots.sort((a, b) => b.rank - a.rank);
}

/**
 * Get teams to avoid for a position
 */
export async function getAvoidMatchups(position: string): Promise<Array<{ vsTeam: string; rank: number; ptsAllowed: number }>> {
  const rankings = await calculateDefenseRankings();
  const avoidMatchups: Array<{ vsTeam: string; rank: number; ptsAllowed: number }> = [];

  for (const [team, defense] of Object.entries(rankings)) {
    const rank = getPositionRank(defense, position);
    if (rank <= THRESHOLDS.AVOID) {
      avoidMatchups.push({
        vsTeam: team,
        rank,
        ptsAllowed: getPointsAllowed(defense, position),
      });
    }
  }

  return avoidMatchups.sort((a, b) => a.rank - b.rank);
}

export default {
  detectDefenseMatchupEdge,
  getSmashSpots,
  getAvoidMatchups,
};
