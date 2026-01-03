/**
 * Team Diagnosis System
 *
 * Analyzes a dynasty roster and classifies it as:
 * - CONTENDER: Win-now team with elite starters
 * - REBUILD: Young core building for the future
 * - STUCK IN THE MIDDLE: Not good enough to win, not bad enough to rebuild
 *
 * Provides strategic recommendations based on classification.
 */

import type { Player } from '@/types';
import { calculateDynastyValue, DynastyValue } from '@/lib/trade/dynasty-value';
import { getSellWindowAlert, SellWindowAlert } from '@/lib/trade/sell-window';

export interface RosterPlayer {
  name: string;
  position: string;
  age: number;
  dynastyValue: DynastyValue;
  sellWindow: SellWindowAlert;
}

export interface PositionGroup {
  starters: RosterPlayer[];
  depth: RosterPlayer[];
  totalValue: number;
  avgAge: number;
  avgScore: number;
  strengthRating: 'elite' | 'strong' | 'average' | 'weak' | 'dire';
}

export interface TeamDiagnosis {
  classification: 'CONTENDER' | 'REBUILD' | 'STUCK IN THE MIDDLE';
  confidence: number;
  summary: string;

  // Roster breakdown
  positions: {
    QB: PositionGroup;
    RB: PositionGroup;
    WR: PositionGroup;
    TE: PositionGroup;
  };

  // Key metrics
  metrics: {
    totalRosterValue: number;
    avgStarterAge: number;
    avgStarterScore: number;
    eliteAssets: number; // Players with 75+ score
    youngAssets: number; // Players age 25 or under
    agingAssets: number; // Players in sell window
    draftCapital: number; // Future picks value if tracked
  };

  // Strategic recommendations
  recommendations: {
    moves: string[];
    targets: string[];
    sells: string[];
    holds: string[];
  };

  // Detailed analysis
  strengths: string[];
  weaknesses: string[];
  outlook: string;
}

// Starter counts for standard dynasty leagues (1QB, 2RB, 2WR, 1TE, 2FLEX)
const STARTER_COUNTS = {
  QB: 1,
  RB: 3, // 2 starters + flex consideration
  WR: 3, // 2 starters + flex consideration
  TE: 1,
};

// Classification thresholds
const CONTENDER_THRESHOLD = 70; // Avg starter score needed
const REBUILD_THRESHOLD = 50; // Below this = rebuild
const ELITE_THRESHOLD = 75;
const YOUNG_AGE_THRESHOLD = 25;

function getPositionStrength(avgScore: number): PositionGroup['strengthRating'] {
  if (avgScore >= 80) return 'elite';
  if (avgScore >= 65) return 'strong';
  if (avgScore >= 50) return 'average';
  if (avgScore >= 35) return 'weak';
  return 'dire';
}

function groupByPosition(players: RosterPlayer[]): Record<string, RosterPlayer[]> {
  const groups: Record<string, RosterPlayer[]> = { QB: [], RB: [], WR: [], TE: [] };

  for (const player of players) {
    if (groups[player.position]) {
      groups[player.position].push(player);
    }
  }

  // Sort each position by dynasty value
  for (const pos of Object.keys(groups)) {
    groups[pos].sort((a, b) => b.dynastyValue.overallScore - a.dynastyValue.overallScore);
  }

  return groups;
}

function buildPositionGroup(players: RosterPlayer[], starterCount: number): PositionGroup {
  const starters = players.slice(0, starterCount);
  const depth = players.slice(starterCount);
  const totalValue = players.reduce((sum, p) => sum + p.dynastyValue.overallScore, 0);

  const avgAge = starters.length > 0
    ? starters.reduce((sum, p) => sum + p.age, 0) / starters.length
    : 0;

  const avgScore = starters.length > 0
    ? starters.reduce((sum, p) => sum + p.dynastyValue.overallScore, 0) / starters.length
    : 0;

  return {
    starters,
    depth,
    totalValue,
    avgAge: Math.round(avgAge * 10) / 10,
    avgScore: Math.round(avgScore),
    strengthRating: getPositionStrength(avgScore),
  };
}

export function diagnoseTeam(players: RosterPlayer[]): TeamDiagnosis {
  const grouped = groupByPosition(players);

  // Build position groups
  const positions = {
    QB: buildPositionGroup(grouped.QB, STARTER_COUNTS.QB),
    RB: buildPositionGroup(grouped.RB, STARTER_COUNTS.RB),
    WR: buildPositionGroup(grouped.WR, STARTER_COUNTS.WR),
    TE: buildPositionGroup(grouped.TE, STARTER_COUNTS.TE),
  };

  // Calculate overall metrics
  const allStarters = [
    ...positions.QB.starters,
    ...positions.RB.starters,
    ...positions.WR.starters,
    ...positions.TE.starters,
  ];

  const totalRosterValue = players.reduce((sum, p) => sum + p.dynastyValue.overallScore, 0);
  const avgStarterAge = allStarters.length > 0
    ? allStarters.reduce((sum, p) => sum + p.age, 0) / allStarters.length
    : 0;
  const avgStarterScore = allStarters.length > 0
    ? allStarters.reduce((sum, p) => sum + p.dynastyValue.overallScore, 0) / allStarters.length
    : 0;

  const eliteAssets = players.filter(p => p.dynastyValue.overallScore >= ELITE_THRESHOLD).length;
  const youngAssets = players.filter(p => p.age <= YOUNG_AGE_THRESHOLD).length;
  const agingAssets = players.filter(p =>
    p.sellWindow.urgency === 'SELL NOW' || p.sellWindow.urgency === 'SELL SOON'
  ).length;

  const metrics = {
    totalRosterValue,
    avgStarterAge: Math.round(avgStarterAge * 10) / 10,
    avgStarterScore: Math.round(avgStarterScore),
    eliteAssets,
    youngAssets,
    agingAssets,
    draftCapital: 0, // Could be expanded to track picks
  };

  // Determine classification
  let classification: TeamDiagnosis['classification'];
  let confidence: number;
  let summary: string;

  // Strong indicators for each classification
  const contenderScore = (
    (avgStarterScore >= CONTENDER_THRESHOLD ? 40 : avgStarterScore >= 60 ? 20 : 0) +
    (eliteAssets >= 4 ? 30 : eliteAssets >= 2 ? 15 : 0) +
    (positions.QB.strengthRating === 'elite' || positions.QB.strengthRating === 'strong' ? 15 : 0) +
    (positions.RB.strengthRating === 'elite' || positions.RB.strengthRating === 'strong' ? 15 : 0)
  );

  const rebuildScore = (
    (avgStarterScore < REBUILD_THRESHOLD ? 40 : avgStarterScore < 55 ? 20 : 0) +
    (youngAssets >= 5 ? 30 : youngAssets >= 3 ? 15 : 0) +
    (agingAssets >= 3 ? 20 : agingAssets >= 2 ? 10 : 0) +
    (eliteAssets <= 1 ? 10 : 0)
  );

  if (contenderScore >= 60) {
    classification = 'CONTENDER';
    confidence = Math.min(95, 60 + contenderScore - 60);
    summary = `Championship-caliber roster with ${eliteAssets} elite assets and ${metrics.avgStarterScore} avg starter score.`;
  } else if (rebuildScore >= 50 || avgStarterScore < REBUILD_THRESHOLD) {
    classification = 'REBUILD';
    confidence = Math.min(90, 50 + rebuildScore - 50);
    summary = `Rebuilding roster with ${youngAssets} young assets. Focus on accumulating picks and youth.`;
  } else {
    classification = 'STUCK IN THE MIDDLE';
    confidence = 70;
    summary = `Roster lacks elite ceiling for contention but has too much value to tank. Decision time.`;
  }

  // Generate strengths and weaknesses
  const strengths: string[] = [];
  const weaknesses: string[] = [];

  for (const [pos, group] of Object.entries(positions)) {
    if (group.strengthRating === 'elite' || group.strengthRating === 'strong') {
      strengths.push(`${pos} room is ${group.strengthRating} (${group.avgScore} avg)`);
    } else if (group.strengthRating === 'weak' || group.strengthRating === 'dire') {
      weaknesses.push(`${pos} room is ${group.strengthRating} (${group.avgScore} avg)`);
    }
  }

  if (youngAssets >= 4) strengths.push(`${youngAssets} players age 25 or under - strong youth core`);
  if (eliteAssets >= 3) strengths.push(`${eliteAssets} elite-tier assets (75+ score)`);
  if (agingAssets >= 3) weaknesses.push(`${agingAssets} players in sell window - aging core`);
  if (avgStarterAge > 28) weaknesses.push(`Avg starter age ${metrics.avgStarterAge} - window closing`);

  // Generate recommendations
  const moves: string[] = [];
  const targets: string[] = [];
  const sells: string[] = [];
  const holds: string[] = [];

  // Players to sell
  const sellCandidates = players.filter(p =>
    p.sellWindow.urgency === 'SELL NOW' ||
    (p.sellWindow.urgency === 'SELL SOON' && classification !== 'CONTENDER')
  );
  for (const p of sellCandidates.slice(0, 3)) {
    sells.push(`${p.name} (${p.sellWindow.urgency}: ${p.sellWindow.reason})`);
  }

  // Players to hold
  const holdCandidates = players.filter(p =>
    p.dynastyValue.overallScore >= 60 &&
    p.sellWindow.urgency === 'HOLD'
  );
  for (const p of holdCandidates.slice(0, 3)) {
    holds.push(`${p.name} (${p.dynastyValue.overallScore} pts, ${p.dynastyValue.yearsOfEliteProduction}+ elite years)`);
  }

  // Strategic moves based on classification
  if (classification === 'CONTENDER') {
    moves.push('Go all-in: trade future picks for proven producers');
    moves.push('Prioritize floor over ceiling in acquisitions');
    if (agingAssets > 0) moves.push('Accept aging stars - their window aligns with yours');
    targets.push('Veteran WRs with target share');
    targets.push('High-floor RB2s for depth');
  } else if (classification === 'REBUILD') {
    moves.push('Sell all aging assets for picks and young players');
    moves.push('Accumulate 2026-2027 1sts aggressively');
    moves.push('Target underperforming young players');
    targets.push('1st round picks (2026, 2027)');
    targets.push('Young WRs on bad teams');
    targets.push('Rookie RBs in committee situations');
  } else {
    moves.push('PICK A DIRECTION: Either commit to contention or rebuild');
    moves.push('If contending: Move 2 young assets for 1 proven star');
    moves.push('If rebuilding: Sell every player over age 27');
    targets.push('Elite young WR (if going young)');
    targets.push('Proven RB1 (if going old)');
  }

  // Outlook
  let outlook: string;
  if (classification === 'CONTENDER') {
    const yearsLeft = Math.max(1, 3 - Math.floor((avgStarterAge - 26) / 2));
    outlook = `Championship window: ${yearsLeft}-${yearsLeft + 1} years. Maximize this core NOW.`;
  } else if (classification === 'REBUILD') {
    outlook = `Projected competitiveness: 2-3 years out. Patience and pick accumulation are key.`;
  } else {
    outlook = `Risk: Wasting years in mediocrity. Make a decisive move in the next 6 months.`;
  }

  return {
    classification,
    confidence,
    summary,
    positions,
    metrics,
    recommendations: { moves, targets, sells, holds },
    strengths,
    weaknesses,
    outlook,
  };
}

export async function analyzeRoster(playerData: Player[]): Promise<TeamDiagnosis> {
  const rosterPlayers: RosterPlayer[] = [];

  for (const player of playerData) {
    const dynastyValue = calculateDynastyValue(player);
    const sellWindow = getSellWindowAlert(player);

    rosterPlayers.push({
      name: player.name,
      position: player.position,
      age: player.age || 25,
      dynastyValue,
      sellWindow,
    });
  }

  return diagnoseTeam(rosterPlayers);
}
