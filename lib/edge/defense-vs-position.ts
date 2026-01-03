/**
 * Defense vs Position Edge Detector
 *
 * Analyzes how opposing defenses perform against specific positions.
 * A defense that's weak vs. RBs = boost for opposing RBs.
 * A defense that's elite vs. WRs = downgrade for opposing WRs.
 *
 * ⚠️ DATA DISCLAIMER: The defense rankings below are APPROXIMATE.
 * Based on 2024-2025 season trends but not pulled from a live source.
 * Directionally useful but verify with ESPN/Yahoo/FantasyPros for exact numbers.
 *
 * TODO: Integrate live defense rankings from:
 * - FantasyPros API: https://www.fantasypros.com/nfl/points-allowed.php
 * - NFL.com Fantasy: https://fantasy.nfl.com/research/pointsagainst
 * - Calculate from nflfastR play-by-play with opponent context
 *
 * Research basis:
 * - Matchup data has ~15-20% predictive value for fantasy scoring
 * - More useful for identifying extreme matchups than average ones
 * - RB matchups matter more than WR matchups (game script dependent)
 *
 * Last updated: January 2026 (approximate end-of-season rankings)
 */

import type { EdgeSignal, Player } from '../../types';

// Defense rankings vs each position (1 = best defense, 32 = worst defense)
// This would be updated weekly from ESPN/Yahoo/etc
// For now, using approximate Week 18 2025 rankings
interface DefenseRankings {
  vsQB: number;
  vsRB: number;
  vsWR: number;
  vsTE: number;
  // Advanced metrics
  passYardsAllowed: number;  // rank 1-32
  rushYardsAllowed: number;  // rank 1-32
  pointsAllowed: number;     // rank 1-32
  sackRate: number;          // rank 1-32 (1 = most sacks)
}

// Week 18 2025 Defense Rankings (approximate - would be fetched live in production)
// Lower number = BETTER defense at stopping that position
const DEFENSE_RANKINGS: Record<string, DefenseRankings> = {
  // Elite defenses
  BAL: { vsQB: 3, vsRB: 5, vsWR: 4, vsTE: 8, passYardsAllowed: 2, rushYardsAllowed: 6, pointsAllowed: 1, sackRate: 3 },
  DEN: { vsQB: 2, vsRB: 4, vsWR: 3, vsTE: 5, passYardsAllowed: 1, rushYardsAllowed: 8, pointsAllowed: 3, sackRate: 5 },
  PHI: { vsQB: 5, vsRB: 2, vsWR: 6, vsTE: 4, passYardsAllowed: 4, rushYardsAllowed: 1, pointsAllowed: 2, sackRate: 2 },
  BUF: { vsQB: 8, vsRB: 7, vsWR: 5, vsTE: 3, passYardsAllowed: 6, rushYardsAllowed: 5, pointsAllowed: 5, sackRate: 8 },
  PIT: { vsQB: 6, vsRB: 6, vsWR: 7, vsTE: 10, passYardsAllowed: 5, rushYardsAllowed: 7, pointsAllowed: 7, sackRate: 1 },
  DET: { vsQB: 10, vsRB: 8, vsWR: 9, vsTE: 6, passYardsAllowed: 9, rushYardsAllowed: 10, pointsAllowed: 8, sackRate: 10 },
  MIN: { vsQB: 7, vsRB: 10, vsWR: 8, vsTE: 9, passYardsAllowed: 7, rushYardsAllowed: 12, pointsAllowed: 6, sackRate: 6 },
  GB: { vsQB: 9, vsRB: 9, vsWR: 10, vsTE: 7, passYardsAllowed: 8, rushYardsAllowed: 9, pointsAllowed: 9, sackRate: 9 },
  
  // Middle tier
  KC: { vsQB: 12, vsRB: 14, vsWR: 11, vsTE: 12, passYardsAllowed: 11, rushYardsAllowed: 15, pointsAllowed: 10, sackRate: 12 },
  SF: { vsQB: 11, vsRB: 11, vsWR: 14, vsTE: 11, passYardsAllowed: 12, rushYardsAllowed: 11, pointsAllowed: 11, sackRate: 11 },
  HOU: { vsQB: 14, vsRB: 12, vsWR: 13, vsTE: 15, passYardsAllowed: 14, rushYardsAllowed: 13, pointsAllowed: 13, sackRate: 7 },
  LAC: { vsQB: 13, vsRB: 13, vsWR: 12, vsTE: 14, passYardsAllowed: 13, rushYardsAllowed: 14, pointsAllowed: 12, sackRate: 14 },
  CIN: { vsQB: 16, vsRB: 16, vsWR: 15, vsTE: 16, passYardsAllowed: 15, rushYardsAllowed: 16, pointsAllowed: 15, sackRate: 16 },
  MIA: { vsQB: 15, vsRB: 15, vsWR: 16, vsTE: 13, passYardsAllowed: 16, rushYardsAllowed: 17, pointsAllowed: 14, sackRate: 15 },
  SEA: { vsQB: 17, vsRB: 17, vsWR: 17, vsTE: 17, passYardsAllowed: 17, rushYardsAllowed: 18, pointsAllowed: 16, sackRate: 17 },
  IND: { vsQB: 18, vsRB: 18, vsWR: 18, vsTE: 18, passYardsAllowed: 18, rushYardsAllowed: 19, pointsAllowed: 17, sackRate: 18 },
  
  // Below average
  NYJ: { vsQB: 19, vsRB: 19, vsWR: 19, vsTE: 19, passYardsAllowed: 19, rushYardsAllowed: 20, pointsAllowed: 18, sackRate: 13 },
  TB: { vsQB: 20, vsRB: 20, vsWR: 20, vsTE: 20, passYardsAllowed: 20, rushYardsAllowed: 21, pointsAllowed: 19, sackRate: 19 },
  ATL: { vsQB: 21, vsRB: 21, vsWR: 21, vsTE: 21, passYardsAllowed: 21, rushYardsAllowed: 22, pointsAllowed: 20, sackRate: 20 },
  NO: { vsQB: 22, vsRB: 22, vsWR: 22, vsTE: 22, passYardsAllowed: 22, rushYardsAllowed: 23, pointsAllowed: 21, sackRate: 21 },
  ARI: { vsQB: 23, vsRB: 23, vsWR: 23, vsTE: 23, passYardsAllowed: 23, rushYardsAllowed: 24, pointsAllowed: 22, sackRate: 22 },
  CHI: { vsQB: 24, vsRB: 24, vsWR: 24, vsTE: 24, passYardsAllowed: 24, rushYardsAllowed: 25, pointsAllowed: 23, sackRate: 23 },
  LAR: { vsQB: 25, vsRB: 25, vsWR: 25, vsTE: 25, passYardsAllowed: 25, rushYardsAllowed: 26, pointsAllowed: 24, sackRate: 24 },
  CLE: { vsQB: 26, vsRB: 26, vsWR: 26, vsTE: 26, passYardsAllowed: 26, rushYardsAllowed: 27, pointsAllowed: 25, sackRate: 25 },
  
  // Weak defenses (smash spots)
  TEN: { vsQB: 27, vsRB: 27, vsWR: 27, vsTE: 27, passYardsAllowed: 27, rushYardsAllowed: 28, pointsAllowed: 26, sackRate: 26 },
  NE: { vsQB: 28, vsRB: 28, vsWR: 28, vsTE: 28, passYardsAllowed: 28, rushYardsAllowed: 29, pointsAllowed: 27, sackRate: 27 },
  JAX: { vsQB: 29, vsRB: 29, vsWR: 29, vsTE: 29, passYardsAllowed: 29, rushYardsAllowed: 30, pointsAllowed: 28, sackRate: 28 },
  NYG: { vsQB: 30, vsRB: 30, vsWR: 30, vsTE: 30, passYardsAllowed: 30, rushYardsAllowed: 31, pointsAllowed: 29, sackRate: 29 },
  WAS: { vsQB: 31, vsRB: 31, vsWR: 31, vsTE: 31, passYardsAllowed: 31, rushYardsAllowed: 32, pointsAllowed: 30, sackRate: 30 },
  LV: { vsQB: 32, vsRB: 32, vsWR: 32, vsTE: 32, passYardsAllowed: 32, rushYardsAllowed: 3, pointsAllowed: 31, sackRate: 31 },
  CAR: { vsQB: 4, vsRB: 3, vsWR: 2, vsTE: 2, passYardsAllowed: 3, rushYardsAllowed: 2, pointsAllowed: 32, sackRate: 32 },
};

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
}

/**
 * Get the relevant defensive ranking for a player's position
 */
function getPositionRank(defense: DefenseRankings, position: string): number {
  switch (position) {
    case 'QB': return defense.vsQB;
    case 'RB': return defense.vsRB;
    case 'WR': return defense.vsWR;
    case 'TE': return defense.vsTE;
    default: return 16; // Middle of the pack default
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
 * Detect defense vs position matchup edge
 */
export function detectDefenseMatchupEdge(
  player: Player,
  opponentTeam: string,
  week: number
): DefenseMatchupResult {
  const signals: EdgeSignal[] = [];
  
  const defense = DEFENSE_RANKINGS[opponentTeam];
  
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
        ? 'Smash spot: ' + opponentTeam + ' is #' + matchupRank + ' vs ' + position + 's'
        : 'Good matchup: ' + opponentTeam + ' is #' + matchupRank + ' vs ' + position + 's',
      details: opponentTeam + ' defense ranks #' + matchupRank + ' against ' + position + 's this season. ' +
        (tier === 'smash' 
          ? 'This is a top-tier matchup. Expect elevated production. '
          : 'This is a favorable matchup. Slight boost to expectations. ') +
        'Overall defense rating: ' + defenseOverall + '. ' +
        'Pass yards allowed rank: #' + defense.passYardsAllowed + ', Rush yards allowed rank: #' + defense.rushYardsAllowed + '.',
      source: 'defense-rankings',
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
        ? 'Avoid: ' + opponentTeam + ' is #' + matchupRank + ' vs ' + position + 's'
        : 'Tough matchup: ' + opponentTeam + ' is #' + matchupRank + ' vs ' + position + 's',
      details: opponentTeam + ' defense ranks #' + matchupRank + ' against ' + position + 's this season. ' +
        (tier === 'avoid'
          ? 'This is an elite defense. Expect suppressed production. Consider alternatives. '
          : 'This is a difficult matchup. Temper expectations. ') +
        'Overall defense rating: ' + defenseOverall + '. ' +
        'Pass yards allowed rank: #' + defense.passYardsAllowed + ', Rush yards allowed rank: #' + defense.rushYardsAllowed + '.',
      source: 'defense-rankings',
      timestamp: new Date(),
    });
  }
  
  // Generate summary
  let summary: string;
  switch (tier) {
    case 'smash':
      summary = 'Smash spot: ' + opponentTeam + ' is #' + matchupRank + ' vs ' + position + 's';
      break;
    case 'good':
      summary = 'Good matchup: ' + opponentTeam + ' is #' + matchupRank + ' vs ' + position + 's';
      break;
    case 'neutral':
      summary = 'Neutral: ' + opponentTeam + ' is #' + matchupRank + ' vs ' + position + 's';
      break;
    case 'tough':
      summary = 'Tough matchup: ' + opponentTeam + ' is #' + matchupRank + ' vs ' + position + 's';
      break;
    case 'avoid':
      summary = 'Avoid: ' + opponentTeam + ' is #' + matchupRank + ' vs ' + position + 's';
      break;
  }
  
  return {
    signals,
    summary,
    matchupRank,
    tier,
    defenseOverall,
  };
}

/**
 * Get all smash spots for the week (for recommendations)
 */
export function getSmashSpots(position: string): Array<{ vsTeam: string; rank: number }> {
  const smashSpots: Array<{ vsTeam: string; rank: number }> = [];
  
  for (const [team, defense] of Object.entries(DEFENSE_RANKINGS)) {
    const rank = getPositionRank(defense, position);
    if (rank >= THRESHOLDS.SMASH_SPOT) {
      smashSpots.push({ vsTeam: team, rank });
    }
  }
  
  return smashSpots.sort((a, b) => b.rank - a.rank);
}

/**
 * Get teams to avoid for a position
 */
export function getAvoidMatchups(position: string): Array<{ vsTeam: string; rank: number }> {
  const avoidMatchups: Array<{ vsTeam: string; rank: number }> = [];
  
  for (const [team, defense] of Object.entries(DEFENSE_RANKINGS)) {
    const rank = getPositionRank(defense, position);
    if (rank <= THRESHOLDS.AVOID) {
      avoidMatchups.push({ vsTeam: team, rank });
    }
  }
  
  return avoidMatchups.sort((a, b) => a.rank - b.rank);
}

export default {
  detectDefenseMatchupEdge,
  getSmashSpots,
  getAvoidMatchups,
  DEFENSE_RANKINGS,
};
