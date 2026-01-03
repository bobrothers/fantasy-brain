/**
 * Coverage Matchup Edge Detector
 *
 * Analyzes how players perform based on opposing defense coverage tendencies.
 * - Man-beaters: Elite route runners, physical WRs who win at catch point
 * - Zone-beaters: Speed/deep threats, slot receivers who find soft spots
 *
 * Data source: Sharp Football Analysis (coverage tendencies)
 * https://www.sharpfootballanalysis.com/stats-nfl/nfl-coverage-schemes/
 *
 * Research basis:
 * - Coverage scheme impacts target distribution and efficiency
 * - Man coverage favors physical, separation-creating receivers
 * - Zone coverage favors speed, finding soft spots in coverage
 */

import type { EdgeSignal, Player } from '@/types';

// Defense coverage tendencies (2025 season from Sharp Football Analysis)
// Updated: January 2026
const DEFENSE_COVERAGE_TENDENCIES: Record<string, { manPct: number; zonePct: number }> = {
  // Heavy man teams (30%+)
  CLE: { manPct: 45.1, zonePct: 51.1 },
  DET: { manPct: 33.3, zonePct: 61.7 },
  DEN: { manPct: 32.6, zonePct: 63.0 },
  PIT: { manPct: 31.0, zonePct: 64.5 },
  NYJ: { manPct: 30.9, zonePct: 62.9 },
  BAL: { manPct: 30.5, zonePct: 63.1 },

  // Moderate man teams (20-30%)
  NYG: { manPct: 29.9, zonePct: 63.6 },
  NE: { manPct: 29.2, zonePct: 66.5 },
  CHI: { manPct: 27.6, zonePct: 67.4 },
  IND: { manPct: 27.1, zonePct: 65.1 },
  CIN: { manPct: 26.6, zonePct: 67.4 },
  PHI: { manPct: 24.3, zonePct: 69.6 },
  WAS: { manPct: 23.7, zonePct: 69.8 },
  BUF: { manPct: 23.6, zonePct: 70.5 },
  MIA: { manPct: 22.8, zonePct: 72.0 },
  TB: { manPct: 22.7, zonePct: 73.2 },
  KC: { manPct: 20.0, zonePct: 73.7 },

  // Heavy zone teams (under 20% man)
  HOU: { manPct: 19.9, zonePct: 75.2 },
  DAL: { manPct: 19.4, zonePct: 73.4 },
  ATL: { manPct: 19.3, zonePct: 76.6 },
  TEN: { manPct: 17.6, zonePct: 75.5 },
  JAX: { manPct: 17.4, zonePct: 78.5 },
  SF: { manPct: 17.1, zonePct: 76.8 },
  GB: { manPct: 16.8, zonePct: 78.5 },
  MIN: { manPct: 16.6, zonePct: 76.5 },
  ARI: { manPct: 15.8, zonePct: 74.2 },
  NO: { manPct: 15.2, zonePct: 78.1 },
  SEA: { manPct: 14.9, zonePct: 80.6 },
  LV: { manPct: 14.8, zonePct: 78.5 },
  LAR: { manPct: 14.6, zonePct: 80.2 },
  LAC: { manPct: 12.8, zonePct: 81.9 },
  CAR: { manPct: 11.6, zonePct: 82.5 },
};

// Player coverage preferences
// 'man' = beats man coverage (elite route runner, physical, contested catch)
// 'zone' = beats zone coverage (speed, finds soft spots, works middle of field)
// 'neutral' = no strong preference
type CoveragePreference = 'man' | 'zone' | 'neutral';

// Manually researched WR/TE coverage preferences
// Based on: route running grade, separation metrics, target depth, catch contested rate
const PLAYER_COVERAGE_PREFERENCES: Record<string, { preference: CoveragePreference; reason: string }> = {
  // Elite Man-Beaters (win with routes and physicality)
  'Ja\'Marr Chase': { preference: 'man', reason: 'Elite route runner, wins at all levels, physical at catch point' },
  'CeeDee Lamb': { preference: 'man', reason: 'Precise route runner, great releases vs press' },
  'Davante Adams': { preference: 'man', reason: 'Best route runner in NFL, creates separation vs anyone' },
  'Tyreek Hill': { preference: 'man', reason: 'Speed creates instant separation, forces safety help' },
  'Stefon Diggs': { preference: 'man', reason: 'Sharp routes, great vs press coverage' },
  'A.J. Brown': { preference: 'man', reason: 'Physical monster, wins contested catches' },
  'Justin Jefferson': { preference: 'man', reason: 'Elite route running, separation artist' },
  'Amon-Ra St. Brown': { preference: 'man', reason: 'Route technician, YAC ability in traffic' },
  'Mike Evans': { preference: 'man', reason: 'Contested catch king, physical dominance' },
  'Keenan Allen': { preference: 'man', reason: 'Route running savant, finds soft spots' },
  'DeVonta Smith': { preference: 'man', reason: 'Elite releases, smooth route runner' },
  'Chris Olave': { preference: 'man', reason: 'Polished routes, great at creating separation' },
  'Amari Cooper': { preference: 'man', reason: 'Route running technician, crisp breaks' },
  'Terry McLaurin': { preference: 'man', reason: 'Speed + route running combo' },
  'DK Metcalf': { preference: 'man', reason: 'Physical freak, wins jump balls' },
  'Tee Higgins': { preference: 'man', reason: 'Contested catch specialist, body control' },
  'Cooper Kupp': { preference: 'man', reason: 'Route running master, finds space vs man' },
  'Brandon Aiyuk': { preference: 'man', reason: 'YAC monster, beats press with technique' },
  'George Pickens': { preference: 'man', reason: 'Contested catch ability, physical receiver' },
  'Zay Flowers': { preference: 'zone', reason: 'Speed/slot work, finds soft spots in zone' },
  'Jayden Reed': { preference: 'zone', reason: 'Slot specialist, works zone windows' },
  'Brian Thomas Jr.': { preference: 'man', reason: 'Physical downfield threat, wins at catch point' },
  'Quentin Johnston': { preference: 'zone', reason: 'Deep speed threat, exploits zone cushion' },
  'Rashee Rice': { preference: 'man', reason: 'Physical route runner, wins in traffic' },
  'Jakobi Meyers': { preference: 'zone', reason: 'Slot work, finds holes in zone' },

  // Elite Zone-Beaters (speed, find soft spots, work middle)
  'Nico Collins': { preference: 'zone', reason: 'Size/speed combo, attacks zone windows' },
  'Drake London': { preference: 'zone', reason: 'Big body, sits in zone holes' },
  'Garrett Wilson': { preference: 'zone', reason: 'Finds soft spots, great after catch' },
  'Jaylen Waddle': { preference: 'zone', reason: 'Speed kills zone, YAC threat' },
  'DeAndre Hopkins': { preference: 'zone', reason: 'Zone reader, sits in soft spots' },
  'Puka Nacua': { preference: 'zone', reason: 'Instinctive zone reader, finds windows' },
  'Malik Nabers': { preference: 'zone', reason: 'Speed + YAC, attacks zone leverage' },
  'Jaxon Smith-Njigba': { preference: 'zone', reason: 'Slot specialist, zone killer' },
  'Christian Kirk': { preference: 'zone', reason: 'Slot receiver, works zone windows' },
  'Michael Pittman Jr.': { preference: 'zone', reason: 'Possession receiver, finds zones' },
  'DJ Moore': { preference: 'zone', reason: 'YAC ability, works middle of field' },
  'Tank Dell': { preference: 'zone', reason: 'Speedster, exploits zone cushion' },
  'Rashod Bateman': { preference: 'zone', reason: 'Deep threat, attacks zone over top' },
  'Jameson Williams': { preference: 'zone', reason: 'Elite speed, burns zone coverage' },
  'Marvin Harrison Jr.': { preference: 'zone', reason: 'Route runner who finds zone windows' },
  'Rome Odunze': { preference: 'zone', reason: 'Size/athleticism, sits in zones' },
  'Xavier Worthy': { preference: 'zone', reason: 'Speed demon, zone destroyer' },
  'Ladd McConkey': { preference: 'zone', reason: 'Slot work, zone reader' },

  // Tight Ends
  'Travis Kelce': { preference: 'zone', reason: 'GOAT at finding zone holes' },
  'George Kittle': { preference: 'man', reason: 'Physical monster, wins in traffic' },
  'Mark Andrews': { preference: 'zone', reason: 'Red zone/zone window specialist' },
  'Sam LaPorta': { preference: 'zone', reason: 'Moves well, finds soft spots' },
  'T.J. Hockenson': { preference: 'zone', reason: 'Route runner, zone windows' },
  'Dalton Kincaid': { preference: 'zone', reason: 'Seam threat, zone beater' },
  'Evan Engram': { preference: 'zone', reason: 'Speed for position, zone killer' },
  'David Njoku': { preference: 'man', reason: 'Athletic freak, wins contested' },
  'Dallas Goedert': { preference: 'zone', reason: 'Reliable zone target' },
  'Kyle Pitts': { preference: 'zone', reason: 'Matchup nightmare in zone' },
  'Brock Bowers': { preference: 'zone', reason: 'Versatile, exploits zone mismatches' },
  'Trey McBride': { preference: 'zone', reason: 'High volume zone target' },
};

// Thresholds for generating signals
const THRESHOLDS = {
  HEAVY_MAN: 30,      // Defense plays 30%+ man
  HEAVY_ZONE: 78,     // Defense plays 78%+ zone
  MODERATE_MAN: 25,   // Defense plays 25%+ man
  MODERATE_ZONE: 73,  // Defense plays 73%+ zone
};

interface CoverageMatchupResult {
  signals: EdgeSignal[];
  summary: string;
  defenseManPct: number;
  defenseZonePct: number;
  playerPreference: CoveragePreference;
  matchupGrade: 'smash' | 'good' | 'neutral' | 'tough' | 'avoid';
}

/**
 * Infer coverage preference for untagged players based on position/role
 */
function inferCoveragePreference(player: Player): { preference: CoveragePreference; reason: string } {
  // TEs generally do better vs zone (find soft spots)
  if (player.position === 'TE') {
    return { preference: 'zone', reason: 'TEs typically excel finding zone windows' };
  }

  // RBs receiving - generally neutral but slightly better vs zone
  if (player.position === 'RB') {
    return { preference: 'zone', reason: 'RBs work underneath zones effectively' };
  }

  // Default for WRs without data - neutral
  return { preference: 'neutral', reason: 'No specific coverage preference data' };
}

/**
 * Get player coverage preference (manual or inferred)
 */
function getPlayerCoveragePreference(player: Player): { preference: CoveragePreference; reason: string } {
  // Try multiple name formats (Sleeper uses 'name', others might use full_name)
  const namesToCheck = [
    player.name,
    player.full_name,
    player.first_name && player.last_name ? `${player.first_name} ${player.last_name}` : null,
  ].filter(Boolean) as string[];

  // Check manual database first with exact match
  for (const name of namesToCheck) {
    if (PLAYER_COVERAGE_PREFERENCES[name]) {
      return PLAYER_COVERAGE_PREFERENCES[name];
    }
  }

  // Try partial match on last name for edge cases
  const lastName = player.last_name || (player.name?.split(' ').pop()) || '';
  if (lastName.length > 3) {
    for (const [name, pref] of Object.entries(PLAYER_COVERAGE_PREFERENCES)) {
      if (name.endsWith(lastName)) {
        return pref;
      }
    }
  }

  // Infer from position
  return inferCoveragePreference(player);
}

/**
 * Calculate matchup grade based on coverage alignment
 */
function calculateMatchupGrade(
  playerPref: CoveragePreference,
  defenseManPct: number,
  defenseZonePct: number
): 'smash' | 'good' | 'neutral' | 'tough' | 'avoid' {
  if (playerPref === 'neutral') {
    return 'neutral';
  }

  if (playerPref === 'man') {
    // Man-beater vs heavy man defense = tough matchup (they're built for it)
    // Man-beater vs heavy zone defense = smash spot (zone can't handle them)
    if (defenseManPct >= THRESHOLDS.HEAVY_MAN) {
      return 'tough'; // Defense is built to stop man-beaters
    } else if (defenseZonePct >= THRESHOLDS.HEAVY_ZONE) {
      return 'smash'; // Zone can't handle elite route runners
    } else if (defenseZonePct >= THRESHOLDS.MODERATE_ZONE) {
      return 'good';
    }
    return 'neutral';
  }

  if (playerPref === 'zone') {
    // Zone-beater vs heavy zone defense = tough matchup
    // Zone-beater vs heavy man defense = smash spot
    if (defenseZonePct >= THRESHOLDS.HEAVY_ZONE) {
      return 'tough'; // Defense zone scheme limits zone-beaters
    } else if (defenseManPct >= THRESHOLDS.HEAVY_MAN) {
      return 'smash'; // Man coverage leaves holes for zone readers
    } else if (defenseManPct >= THRESHOLDS.MODERATE_MAN) {
      return 'good';
    }
    return 'neutral';
  }

  return 'neutral';
}

/**
 * Calculate impact magnitude
 */
function calculateMagnitude(grade: 'smash' | 'good' | 'neutral' | 'tough' | 'avoid'): number {
  switch (grade) {
    case 'smash': return 3;
    case 'good': return 2;
    case 'neutral': return 0;
    case 'tough': return -2;
    case 'avoid': return -3;
  }
}

/**
 * Detect coverage matchup edge
 */
export function detectCoverageMatchupEdge(
  player: Player,
  opponentTeam: string,
  week: number
): CoverageMatchupResult {
  const signals: EdgeSignal[] = [];

  // Only applies to pass catchers
  if (!['WR', 'TE', 'RB'].includes(player.position || '')) {
    return {
      signals: [],
      summary: 'N/A (not a pass catcher)',
      defenseManPct: 0,
      defenseZonePct: 0,
      playerPreference: 'neutral',
      matchupGrade: 'neutral',
    };
  }

  // Get defense coverage tendencies
  const defense = DEFENSE_COVERAGE_TENDENCIES[opponentTeam];
  if (!defense) {
    return {
      signals: [],
      summary: 'No coverage data for ' + opponentTeam,
      defenseManPct: 0,
      defenseZonePct: 0,
      playerPreference: 'neutral',
      matchupGrade: 'neutral',
    };
  }

  // Get player preference
  const { preference, reason } = getPlayerCoveragePreference(player);

  // Calculate matchup grade
  const matchupGrade = calculateMatchupGrade(preference, defense.manPct, defense.zonePct);
  const magnitude = calculateMagnitude(matchupGrade);

  // Generate signals for non-neutral matchups
  if (matchupGrade !== 'neutral' && preference !== 'neutral') {
    const isPositive = matchupGrade === 'smash' || matchupGrade === 'good';
    const coverageType = defense.manPct >= THRESHOLDS.MODERATE_MAN ? 'man' : 'zone';

    signals.push({
      type: 'coverage_matchup',
      playerId: player.id,
      week,
      impact: isPositive ? 'positive' : 'negative',
      magnitude,
      confidence: 75, // Player has known coverage preference
      shortDescription: isPositive
        ? `${matchupGrade === 'smash' ? 'Smash' : 'Good'}: ${preference}-beater vs ${coverageType}-heavy ${opponentTeam}`
        : `${matchupGrade === 'avoid' ? 'Avoid' : 'Tough'}: ${preference}-beater vs ${coverageType}-heavy ${opponentTeam}`,
      details: `${opponentTeam} plays ${defense.manPct.toFixed(1)}% man / ${defense.zonePct.toFixed(1)}% zone. ` +
        `Player profile: ${reason}. ` +
        (isPositive
          ? `This coverage scheme favors this player's skill set.`
          : `This coverage scheme is designed to limit this player type.`),
      source: 'sharp-football-analysis',
      timestamp: new Date(),
    });
  }

  // Generate summary
  let summary: string;
  if (preference === 'neutral') {
    summary = `vs ${opponentTeam}: ${defense.manPct.toFixed(0)}% man / ${defense.zonePct.toFixed(0)}% zone`;
  } else {
    const coverageType = defense.manPct >= THRESHOLDS.MODERATE_MAN ? 'man' : 'zone';
    switch (matchupGrade) {
      case 'smash':
        summary = `Smash spot: ${preference}-beater vs ${coverageType}-heavy ${opponentTeam}`;
        break;
      case 'good':
        summary = `Good matchup: ${preference}-beater vs ${coverageType}-leaning ${opponentTeam}`;
        break;
      case 'tough':
        summary = `Tough matchup: ${preference}-beater limited by ${opponentTeam}'s scheme`;
        break;
      case 'avoid':
        summary = `Avoid: ${opponentTeam}'s scheme counters ${preference}-beaters`;
        break;
      default:
        summary = `Neutral: ${opponentTeam} ${defense.manPct.toFixed(0)}% man / ${defense.zonePct.toFixed(0)}% zone`;
    }
  }

  return {
    signals,
    summary,
    defenseManPct: defense.manPct,
    defenseZonePct: defense.zonePct,
    playerPreference: preference,
    matchupGrade,
  };
}

/**
 * Get teams that play heavy man coverage (good for zone-beaters)
 */
export function getHeavyManTeams(): Array<{ team: string; manPct: number }> {
  return Object.entries(DEFENSE_COVERAGE_TENDENCIES)
    .filter(([_, d]) => d.manPct >= THRESHOLDS.MODERATE_MAN)
    .map(([team, d]) => ({ team, manPct: d.manPct }))
    .sort((a, b) => b.manPct - a.manPct);
}

/**
 * Get teams that play heavy zone coverage (good for man-beaters)
 */
export function getHeavyZoneTeams(): Array<{ team: string; zonePct: number }> {
  return Object.entries(DEFENSE_COVERAGE_TENDENCIES)
    .filter(([_, d]) => d.zonePct >= THRESHOLDS.MODERATE_ZONE)
    .map(([team, d]) => ({ team, zonePct: d.zonePct }))
    .sort((a, b) => b.zonePct - a.zonePct);
}

export default {
  detectCoverageMatchupEdge,
  getHeavyManTeams,
  getHeavyZoneTeams,
};
