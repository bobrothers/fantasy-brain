/**
 * Team Diagnosis System
 *
 * TWO MODES:
 * 1. DYNASTY OUTLOOK - Long-term asset value, age, potential
 *    Answers: "Is my team set up for future success?"
 *
 * 2. WIN NOW ASSESSMENT - Based on actual production this season
 *    Answers: "Can I compete for a championship THIS year?"
 *
 * Classifications:
 * - CONTENDER: Win-now team with elite starters
 * - REBUILD: Young core building for the future
 * - STUCK IN THE MIDDLE: Not good enough to win, not bad enough to rebuild
 */

import type { Player } from '@/types';
import { calculateDynastyValue, DynastyValue } from '@/lib/trade/dynasty-value';
import { getSellWindowAlert, SellWindowAlert } from '@/lib/trade/sell-window';
import { sleeper } from '@/lib/providers/sleeper';

export interface RosterPlayer {
  name: string;
  id: string;
  position: string;
  age: number;
  dynastyValue: DynastyValue;
  sellWindow: SellWindowAlert;
  // Production stats (for Win Now)
  production?: {
    seasonPPG: number;
    last4PPG: number;
    gamesPlayed: number;
    trend: 'hot' | 'warm' | 'neutral' | 'cold' | 'ice';
  };
}

export interface PositionGroup {
  starters: RosterPlayer[];
  depth: RosterPlayer[];
  totalValue: number;
  avgAge: number;
  avgScore: number;
  strengthRating: 'elite' | 'strong' | 'average' | 'weak' | 'dire';
}

// Production-based position group for Win Now
export interface ProductionPositionGroup {
  starters: Array<{
    name: string;
    position: string;
    seasonPPG: number;
    last4PPG: number;
    gamesPlayed: number;
    trend: 'hot' | 'warm' | 'neutral' | 'cold' | 'ice';
  }>;
  avgPPG: number;
  avgLast4PPG: number;
  strengthRating: 'elite' | 'strong' | 'average' | 'weak' | 'dire';
  positionRank: string; // e.g., "Top 5", "Top 12", "Below Average"
}

// Win Now Assessment - based on actual production
export interface WinNowAssessment {
  verdict: 'CHAMPIONSHIP READY' | 'PLAYOFF TEAM' | 'BUBBLE TEAM' | 'NOT COMPETING';
  confidence: number;
  summary: string;

  positions: {
    QB: ProductionPositionGroup;
    RB: ProductionPositionGroup;
    WR: ProductionPositionGroup;
    TE: ProductionPositionGroup;
  };

  metrics: {
    projectedWeeklyPoints: number;
    avgStarterPPG: number;
    avgLast4PPG: number;
    hotPlayers: number;
    coldPlayers: number;
    injuredStarters: number;
  };

  issues: string[];
  strengths: string[];
}

// Dynasty Outlook (original logic, renamed for clarity)
export interface DynastyOutlook {
  classification: 'CONTENDER' | 'REBUILD' | 'STUCK IN THE MIDDLE';
  confidence: number;
  summary: string;

  positions: {
    QB: PositionGroup;
    RB: PositionGroup;
    WR: PositionGroup;
    TE: PositionGroup;
  };

  metrics: {
    totalRosterValue: number;
    avgStarterAge: number;
    avgStarterScore: number;
    eliteAssets: number;
    youngAssets: number;
    agingAssets: number;
    draftCapital: number;
  };

  recommendations: {
    moves: string[];
    targets: string[];
    sells: string[];
    holds: string[];
  };

  strengths: string[];
  weaknesses: string[];
  outlook: string;
}

// Combined diagnosis with both modes
export interface TeamDiagnosis {
  // Dynasty outlook (long-term)
  dynastyOutlook: DynastyOutlook;

  // Win now assessment (this season)
  winNow: WinNowAssessment;

  // Quick summary comparing both
  comparison: {
    dynastyRating: 'elite' | 'strong' | 'average' | 'weak' | 'dire';
    winNowRating: 'elite' | 'strong' | 'average' | 'weak' | 'dire';
    gap: string; // e.g., "Dynasty STRONG but Win Now WEAK - assets developing"
  };

  // Legacy fields for backwards compatibility
  classification: 'CONTENDER' | 'REBUILD' | 'STUCK IN THE MIDDLE';
  confidence: number;
  summary: string;
  positions: {
    QB: PositionGroup;
    RB: PositionGroup;
    WR: PositionGroup;
    TE: PositionGroup;
  };
  metrics: {
    totalRosterValue: number;
    avgStarterAge: number;
    avgStarterScore: number;
    eliteAssets: number;
    youngAssets: number;
    agingAssets: number;
    draftCapital: number;
  };
  recommendations: {
    moves: string[];
    targets: string[];
    sells: string[];
    holds: string[];
  };
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

// Internal type for dynasty diagnosis result (before combining with Win Now)
type DynastyDiagnosisResult = {
  classification: 'CONTENDER' | 'REBUILD' | 'STUCK IN THE MIDDLE';
  confidence: number;
  summary: string;
  positions: {
    QB: PositionGroup;
    RB: PositionGroup;
    WR: PositionGroup;
    TE: PositionGroup;
  };
  metrics: {
    totalRosterValue: number;
    avgStarterAge: number;
    avgStarterScore: number;
    eliteAssets: number;
    youngAssets: number;
    agingAssets: number;
    draftCapital: number;
  };
  recommendations: {
    moves: string[];
    targets: string[];
    sells: string[];
    holds: string[];
  };
  strengths: string[];
  weaknesses: string[];
  outlook: string;
};

export function diagnoseTeam(players: RosterPlayer[]): DynastyDiagnosisResult {
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

// Production-based strength rating
function getProductionStrength(avgPPG: number, position: string): ProductionPositionGroup['strengthRating'] {
  // Thresholds vary by position (PPR scoring)
  const thresholds: Record<string, { elite: number; strong: number; avg: number; weak: number }> = {
    QB: { elite: 22, strong: 18, avg: 14, weak: 10 },
    RB: { elite: 18, strong: 14, avg: 10, weak: 6 },
    WR: { elite: 18, strong: 14, avg: 10, weak: 6 },
    TE: { elite: 14, strong: 10, avg: 7, weak: 4 },
  };

  const t = thresholds[position] || thresholds.WR;
  if (avgPPG >= t.elite) return 'elite';
  if (avgPPG >= t.strong) return 'strong';
  if (avgPPG >= t.avg) return 'average';
  if (avgPPG >= t.weak) return 'weak';
  return 'dire';
}

// Get position rank description
function getPositionRank(avgPPG: number, position: string): string {
  const strength = getProductionStrength(avgPPG, position);
  switch (strength) {
    case 'elite': return 'Top 3';
    case 'strong': return 'Top 8';
    case 'average': return 'Top 15';
    case 'weak': return 'Below Average';
    case 'dire': return 'Bottom Tier';
  }
}

// Build production-based position group for Win Now
function buildProductionPositionGroup(
  players: RosterPlayer[],
  starterCount: number,
  position: string
): ProductionPositionGroup {
  // Sort by recent production (last 4 weeks weighted heavily)
  const withProduction = players.filter(p => p.production);
  withProduction.sort((a, b) => {
    const aScore = (a.production!.seasonPPG * 0.4) + (a.production!.last4PPG * 0.6);
    const bScore = (b.production!.seasonPPG * 0.4) + (b.production!.last4PPG * 0.6);
    return bScore - aScore;
  });

  const starters = withProduction.slice(0, starterCount).map(p => ({
    name: p.name,
    position: p.position,
    seasonPPG: p.production!.seasonPPG,
    last4PPG: p.production!.last4PPG,
    gamesPlayed: p.production!.gamesPlayed,
    trend: p.production!.trend,
  }));

  const avgPPG = starters.length > 0
    ? starters.reduce((sum, p) => sum + p.seasonPPG, 0) / starters.length
    : 0;

  const avgLast4PPG = starters.length > 0
    ? starters.reduce((sum, p) => sum + p.last4PPG, 0) / starters.length
    : 0;

  return {
    starters,
    avgPPG: Math.round(avgPPG * 10) / 10,
    avgLast4PPG: Math.round(avgLast4PPG * 10) / 10,
    strengthRating: getProductionStrength(avgPPG, position),
    positionRank: getPositionRank(avgPPG, position),
  };
}

// Win Now Assessment - based on actual production this season
export function diagnoseWinNow(players: RosterPlayer[]): WinNowAssessment {
  const grouped: Record<string, RosterPlayer[]> = { QB: [], RB: [], WR: [], TE: [] };

  for (const player of players) {
    if (grouped[player.position]) {
      grouped[player.position].push(player);
    }
  }

  // Build production-based position groups
  const positions = {
    QB: buildProductionPositionGroup(grouped.QB, STARTER_COUNTS.QB, 'QB'),
    RB: buildProductionPositionGroup(grouped.RB, STARTER_COUNTS.RB, 'RB'),
    WR: buildProductionPositionGroup(grouped.WR, STARTER_COUNTS.WR, 'WR'),
    TE: buildProductionPositionGroup(grouped.TE, STARTER_COUNTS.TE, 'TE'),
  };

  // Calculate metrics
  const allStarters = [
    ...positions.QB.starters,
    ...positions.RB.starters,
    ...positions.WR.starters,
    ...positions.TE.starters,
  ];

  const avgStarterPPG = allStarters.length > 0
    ? allStarters.reduce((sum, p) => sum + p.seasonPPG, 0) / allStarters.length
    : 0;

  const avgLast4PPG = allStarters.length > 0
    ? allStarters.reduce((sum, p) => sum + p.last4PPG, 0) / allStarters.length
    : 0;

  const hotPlayers = allStarters.filter(p => p.trend === 'hot' || p.trend === 'warm').length;
  const coldPlayers = allStarters.filter(p => p.trend === 'cold' || p.trend === 'ice').length;
  const injuredStarters = allStarters.filter(p => p.gamesPlayed < 10).length; // Missed 4+ games

  // Project weekly points (8 starters typical)
  const projectedWeeklyPoints = avgStarterPPG * 8;

  const metrics = {
    projectedWeeklyPoints: Math.round(projectedWeeklyPoints * 10) / 10,
    avgStarterPPG: Math.round(avgStarterPPG * 10) / 10,
    avgLast4PPG: Math.round(avgLast4PPG * 10) / 10,
    hotPlayers,
    coldPlayers,
    injuredStarters,
  };

  // Determine verdict
  let verdict: WinNowAssessment['verdict'];
  let confidence: number;
  let summary: string;

  // Elite scoring thresholds for fantasy (PPR, 8-starter leagues)
  // Championship teams typically need 130+ points/week
  const elitePositions = Object.values(positions).filter(p => p.strengthRating === 'elite').length;
  const weakPositions = Object.values(positions).filter(p =>
    p.strengthRating === 'weak' || p.strengthRating === 'dire'
  ).length;

  if (projectedWeeklyPoints >= 130 && elitePositions >= 2 && weakPositions === 0) {
    verdict = 'CHAMPIONSHIP READY';
    confidence = Math.min(90, 70 + (elitePositions * 5) + (hotPlayers * 2));
    summary = `Elite production across the board. ${hotPlayers} starters trending up. Championship ceiling.`;
  } else if (projectedWeeklyPoints >= 115 && weakPositions <= 1) {
    verdict = 'PLAYOFF TEAM';
    confidence = Math.min(85, 60 + (elitePositions * 5));
    summary = `Solid production with ${elitePositions} elite position group(s). Playoff-caliber roster.`;
  } else if (projectedWeeklyPoints >= 100 || (elitePositions >= 1 && weakPositions <= 2)) {
    verdict = 'BUBBLE TEAM';
    confidence = 65;
    summary = `Inconsistent production. ${weakPositions} weak position group(s) hurting ceiling.`;
  } else {
    verdict = 'NOT COMPETING';
    confidence = 75;
    summary = `Below-average production (${metrics.avgStarterPPG} PPG). Not a playoff contender this year.`;
  }

  // Generate issues and strengths
  const issues: string[] = [];
  const strengths: string[] = [];

  for (const [pos, group] of Object.entries(positions)) {
    if (group.strengthRating === 'elite' || group.strengthRating === 'strong') {
      strengths.push(`${pos}: ${group.avgPPG} PPG (${group.positionRank})`);
    }
    if (group.strengthRating === 'weak' || group.strengthRating === 'dire') {
      issues.push(`${pos} production is ${group.strengthRating} (${group.avgPPG} PPG)`);
    }
  }

  if (coldPlayers >= 2) {
    issues.push(`${coldPlayers} starters trending cold - recent performance declining`);
  }
  if (injuredStarters >= 2) {
    issues.push(`${injuredStarters} starters have missed significant time`);
  }
  if (hotPlayers >= 3) {
    strengths.push(`${hotPlayers} starters are hot - momentum heading into playoffs`);
  }

  // Check for trending up vs down
  if (avgLast4PPG > avgStarterPPG * 1.1) {
    strengths.push(`Team trending UP - last 4 weeks ${((avgLast4PPG / avgStarterPPG - 1) * 100).toFixed(0)}% better than season avg`);
  } else if (avgLast4PPG < avgStarterPPG * 0.9) {
    issues.push(`Team trending DOWN - last 4 weeks ${((1 - avgLast4PPG / avgStarterPPG) * 100).toFixed(0)}% worse than season avg`);
  }

  return {
    verdict,
    confidence,
    summary,
    positions,
    metrics,
    issues,
    strengths,
  };
}

// Get overall rating from Win Now assessment
function getWinNowRating(assessment: WinNowAssessment): 'elite' | 'strong' | 'average' | 'weak' | 'dire' {
  switch (assessment.verdict) {
    case 'CHAMPIONSHIP READY': return 'elite';
    case 'PLAYOFF TEAM': return 'strong';
    case 'BUBBLE TEAM': return 'average';
    case 'NOT COMPETING': return assessment.metrics.avgStarterPPG < 8 ? 'dire' : 'weak';
  }
}

// Get overall rating from Dynasty assessment
function getDynastyRating(classification: DynastyOutlook['classification'], avgScore: number): 'elite' | 'strong' | 'average' | 'weak' | 'dire' {
  if (classification === 'CONTENDER') {
    return avgScore >= 75 ? 'elite' : 'strong';
  } else if (classification === 'REBUILD') {
    return avgScore < 40 ? 'dire' : 'weak';
  }
  return 'average';
}

// Generate comparison gap description
function getComparisonGap(
  dynastyRating: 'elite' | 'strong' | 'average' | 'weak' | 'dire',
  winNowRating: 'elite' | 'strong' | 'average' | 'weak' | 'dire'
): string {
  const ratings = ['dire', 'weak', 'average', 'strong', 'elite'];
  const dynastyIdx = ratings.indexOf(dynastyRating);
  const winNowIdx = ratings.indexOf(winNowRating);
  const gap = dynastyIdx - winNowIdx;

  if (gap >= 2) {
    return `Dynasty ${dynastyRating.toUpperCase()} but Win Now ${winNowRating.toUpperCase()} - assets haven't produced yet`;
  } else if (gap <= -2) {
    return `Win Now ${winNowRating.toUpperCase()} but Dynasty ${dynastyRating.toUpperCase()} - aging core overperforming`;
  } else if (gap === 1) {
    return `Dynasty slightly ahead - young talent developing`;
  } else if (gap === -1) {
    return `Win Now slightly ahead - maximize this window`;
  }
  return `Aligned - ${dynastyRating.toUpperCase()} in both dynasty value and production`;
}

export async function analyzeRoster(playerData: Player[]): Promise<TeamDiagnosis> {
  // Fetch production stats for all players
  const playerIds = playerData.map(p => p.id).filter(Boolean);
  let productionStats: Map<string, {
    seasonPPG: number;
    last4PPG: number;
    totalPoints: number;
    gamesPlayed: number;
    weeklyPoints: number[];
    trend: 'hot' | 'warm' | 'neutral' | 'cold' | 'ice';
  }> = new Map();

  try {
    productionStats = await sleeper.getBatchSeasonStats(playerIds);
  } catch (error) {
    console.warn('Could not fetch production stats:', error);
  }

  const rosterPlayers: RosterPlayer[] = [];

  for (const player of playerData) {
    const dynastyValue = calculateDynastyValue(player);
    const sellWindow = getSellWindowAlert(player);
    const stats = productionStats.get(player.id);

    rosterPlayers.push({
      name: player.name,
      id: player.id,
      position: player.position,
      age: player.age || 25,
      dynastyValue,
      sellWindow,
      production: stats ? {
        seasonPPG: stats.seasonPPG,
        last4PPG: stats.last4PPG,
        gamesPlayed: stats.gamesPlayed,
        trend: stats.trend,
      } : undefined,
    });
  }

  // Get dynasty outlook (existing logic)
  const dynastyResult = diagnoseTeam(rosterPlayers);

  // Get win now assessment (production-based)
  const winNow = diagnoseWinNow(rosterPlayers);

  // Calculate ratings for comparison
  const dynastyRating = getDynastyRating(dynastyResult.classification, dynastyResult.metrics.avgStarterScore);
  const winNowRating = getWinNowRating(winNow);

  // Build dynasty outlook object
  const dynastyOutlook: DynastyOutlook = {
    classification: dynastyResult.classification,
    confidence: dynastyResult.confidence,
    summary: dynastyResult.summary,
    positions: dynastyResult.positions,
    metrics: dynastyResult.metrics,
    recommendations: dynastyResult.recommendations,
    strengths: dynastyResult.strengths,
    weaknesses: dynastyResult.weaknesses,
    outlook: dynastyResult.outlook,
  };

  return {
    // New two-mode structure
    dynastyOutlook,
    winNow,
    comparison: {
      dynastyRating,
      winNowRating,
      gap: getComparisonGap(dynastyRating, winNowRating),
    },

    // Legacy fields for backwards compatibility
    classification: dynastyResult.classification,
    confidence: dynastyResult.confidence,
    summary: dynastyResult.summary,
    positions: dynastyResult.positions,
    metrics: dynastyResult.metrics,
    recommendations: dynastyResult.recommendations,
    strengths: dynastyResult.strengths,
    weaknesses: dynastyResult.weaknesses,
    outlook: dynastyResult.outlook,
  };
}
