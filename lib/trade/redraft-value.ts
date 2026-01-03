/**
 * Redraft Trade Value Calculator
 *
 * Evaluates rest-of-season value for redraft leagues.
 * Factors: remaining schedule strength, playoff matchups (weeks 15-17),
 * injury history this season, current usage trends
 *
 * DATA SOURCES:
 * - Schedule data (2025 NFL season)
 * - Defense rankings (hardcoded approximations)
 * - Usage from nflfastR
 */

import type { Player } from '../../types';

// 2025 remaining schedule (Weeks 15-18)
// Defense rankings vs position (1=toughest, 32=easiest)
const DEFENSE_RANKINGS: Record<string, { vsQB: number; vsRB: number; vsWR: number; vsTE: number }> = {
  ARI: { vsQB: 28, vsRB: 25, vsWR: 27, vsTE: 22 },
  ATL: { vsQB: 24, vsRB: 22, vsWR: 20, vsTE: 18 },
  BAL: { vsQB: 8, vsRB: 10, vsWR: 12, vsTE: 6 },
  BUF: { vsQB: 6, vsRB: 12, vsWR: 8, vsTE: 10 },
  CAR: { vsQB: 30, vsRB: 29, vsWR: 30, vsTE: 28 },
  CHI: { vsQB: 14, vsRB: 18, vsWR: 16, vsTE: 14 },
  CIN: { vsQB: 20, vsRB: 24, vsWR: 22, vsTE: 26 },
  CLE: { vsQB: 4, vsRB: 8, vsWR: 10, vsTE: 8 },
  DAL: { vsQB: 26, vsRB: 28, vsWR: 26, vsTE: 24 },
  DEN: { vsQB: 10, vsRB: 6, vsWR: 4, vsTE: 12 },
  DET: { vsQB: 18, vsRB: 20, vsWR: 18, vsTE: 20 },
  GB: { vsQB: 16, vsRB: 16, vsWR: 14, vsTE: 16 },
  HOU: { vsQB: 12, vsRB: 14, vsWR: 6, vsTE: 4 },
  IND: { vsQB: 22, vsRB: 26, vsWR: 24, vsTE: 30 },
  JAX: { vsQB: 32, vsRB: 30, vsWR: 32, vsTE: 32 },
  KC: { vsQB: 2, vsRB: 4, vsWR: 2, vsTE: 2 },
  LAC: { vsQB: 7, vsRB: 9, vsWR: 7, vsTE: 9 },
  LAR: { vsQB: 19, vsRB: 21, vsWR: 19, vsTE: 21 },
  LV: { vsQB: 27, vsRB: 27, vsWR: 28, vsTE: 27 },
  MIA: { vsQB: 21, vsRB: 23, vsWR: 21, vsTE: 23 },
  MIN: { vsQB: 5, vsRB: 3, vsWR: 5, vsTE: 5 },
  NE: { vsQB: 11, vsRB: 11, vsWR: 11, vsTE: 11 },
  NO: { vsQB: 23, vsRB: 19, vsWR: 23, vsTE: 19 },
  NYG: { vsQB: 29, vsRB: 31, vsWR: 29, vsTE: 29 },
  NYJ: { vsQB: 3, vsRB: 2, vsWR: 3, vsTE: 3 },
  PHI: { vsQB: 9, vsRB: 5, vsWR: 9, vsTE: 7 },
  PIT: { vsQB: 1, vsRB: 7, vsWR: 1, vsTE: 1 },
  SF: { vsQB: 13, vsRB: 1, vsWR: 13, vsTE: 13 },
  SEA: { vsQB: 25, vsRB: 17, vsWR: 25, vsTE: 25 },
  TB: { vsQB: 17, vsRB: 15, vsWR: 17, vsTE: 17 },
  TEN: { vsQB: 31, vsRB: 32, vsWR: 31, vsTE: 31 },
  WSH: { vsQB: 15, vsRB: 13, vsWR: 15, vsTE: 15 },
};

// Playoff schedule (Weeks 15-17 for most leagues)
const PLAYOFF_SCHEDULE: Record<string, { week15: string; week16: string; week17: string }> = {
  ARI: { week15: 'NE', week16: 'CAR', week17: 'LAR' },
  ATL: { week15: 'MIN', week16: 'NYG', week17: 'WSH' },
  BAL: { week15: 'NYG', week16: 'PIT', week17: 'HOU' },
  BUF: { week15: 'DET', week16: 'NE', week17: 'NYJ' },
  CAR: { week15: 'DAL', week16: 'ARI', week17: 'TB' },
  CHI: { week15: 'MIN', week16: 'DET', week17: 'SEA' },
  CIN: { week15: 'TEN', week16: 'CLE', week17: 'DEN' },
  CLE: { week15: 'KC', week16: 'CIN', week17: 'MIA' },
  DAL: { week15: 'CAR', week16: 'TB', week17: 'PHI' },
  DEN: { week15: 'IND', week16: 'LAC', week17: 'CIN' },
  DET: { week15: 'BUF', week16: 'CHI', week17: 'SF' },
  GB: { week15: 'SEA', week16: 'NO', week17: 'MIN' },
  HOU: { week15: 'MIA', week16: 'KC', week17: 'BAL' },
  IND: { week15: 'DEN', week16: 'TEN', week17: 'NYG' },
  JAX: { week15: 'NYJ', week16: 'LV', week17: 'TEN' },
  KC: { week15: 'CLE', week16: 'HOU', week17: 'PIT' },
  LAC: { week15: 'TB', week16: 'DEN', week17: 'NE' },
  LAR: { week15: 'SF', week16: 'NYJ', week17: 'ARI' },
  LV: { week15: 'ATL', week16: 'JAX', week17: 'NO' },
  MIA: { week15: 'HOU', week16: 'SF', week17: 'CLE' },
  MIN: { week15: 'CHI', week16: 'SEA', week17: 'GB' },
  NE: { week15: 'ARI', week16: 'BUF', week17: 'LAC' },
  NO: { week15: 'WSH', week16: 'GB', week17: 'LV' },
  NYG: { week15: 'BAL', week16: 'ATL', week17: 'IND' },
  NYJ: { week15: 'JAX', week16: 'LAR', week17: 'BUF' },
  PHI: { week15: 'PIT', week16: 'WSH', week17: 'DAL' },
  PIT: { week15: 'PHI', week16: 'BAL', week17: 'KC' },
  SF: { week15: 'LAR', week16: 'MIA', week17: 'DET' },
  SEA: { week15: 'GB', week16: 'MIN', week17: 'CHI' },
  TB: { week15: 'LAC', week16: 'DAL', week17: 'CAR' },
  TEN: { week15: 'CIN', week16: 'IND', week17: 'JAX' },
  WSH: { week15: 'NO', week16: 'PHI', week17: 'ATL' },
};

// This season's injury/availability data
const SEASON_AVAILABILITY: Record<string, {
  gamesPlayed: number;
  gamesMissed: number;
  currentStatus: 'healthy' | 'questionable' | 'doubtful' | 'out' | 'IR';
  recentInjury?: string;
}> = {
  'Saquon Barkley': { gamesPlayed: 16, gamesMissed: 0, currentStatus: 'healthy' },
  'Jonathan Taylor': { gamesPlayed: 12, gamesMissed: 4, currentStatus: 'questionable', recentInjury: 'Ankle' },
  'Derrick Henry': { gamesPlayed: 16, gamesMissed: 0, currentStatus: 'healthy' },
  'Christian McCaffrey': { gamesPlayed: 4, gamesMissed: 12, currentStatus: 'IR', recentInjury: 'Achilles' },
  "Ja'Marr Chase": { gamesPlayed: 16, gamesMissed: 0, currentStatus: 'healthy' },
  'CeeDee Lamb': { gamesPlayed: 14, gamesMissed: 2, currentStatus: 'healthy' },
  'Tyreek Hill': { gamesPlayed: 15, gamesMissed: 1, currentStatus: 'healthy' },
  'Justin Jefferson': { gamesPlayed: 14, gamesMissed: 2, currentStatus: 'healthy' },
  'Amon-Ra St. Brown': { gamesPlayed: 16, gamesMissed: 0, currentStatus: 'healthy' },
  'A.J. Brown': { gamesPlayed: 12, gamesMissed: 4, currentStatus: 'questionable', recentInjury: 'Knee' },
  'Cooper Kupp': { gamesPlayed: 11, gamesMissed: 5, currentStatus: 'questionable', recentInjury: 'Ankle' },
  'Lamar Jackson': { gamesPlayed: 16, gamesMissed: 0, currentStatus: 'healthy' },
  'Josh Allen': { gamesPlayed: 16, gamesMissed: 0, currentStatus: 'healthy' },
  'Patrick Mahomes': { gamesPlayed: 16, gamesMissed: 0, currentStatus: 'healthy' },
  'Jalen Hurts': { gamesPlayed: 14, gamesMissed: 2, currentStatus: 'healthy' },
  'Joe Burrow': { gamesPlayed: 16, gamesMissed: 0, currentStatus: 'healthy' },
  'Bijan Robinson': { gamesPlayed: 16, gamesMissed: 0, currentStatus: 'healthy' },
  'Jahmyr Gibbs': { gamesPlayed: 15, gamesMissed: 1, currentStatus: 'healthy' },
  'Breece Hall': { gamesPlayed: 15, gamesMissed: 1, currentStatus: 'healthy' },
  'Travis Kelce': { gamesPlayed: 16, gamesMissed: 0, currentStatus: 'healthy' },
  'De\'Von Achane': { gamesPlayed: 13, gamesMissed: 3, currentStatus: 'healthy' },
  'Puka Nacua': { gamesPlayed: 11, gamesMissed: 5, currentStatus: 'healthy' },
  'Tua Tagovailoa': { gamesPlayed: 10, gamesMissed: 6, currentStatus: 'questionable', recentInjury: 'Concussion' },
};

// Hot/Cold Streak - last 4 games PPG vs season average
const HOT_COLD_STREAK: Record<string, {
  last4PPG: number;
  seasonPPG: number;
  trend: 'hot' | 'warm' | 'neutral' | 'cold' | 'ice';
}> = {
  'Saquon Barkley': { last4PPG: 24.5, seasonPPG: 22.1, trend: 'warm' },
  'Derrick Henry': { last4PPG: 18.2, seasonPPG: 17.8, trend: 'neutral' },
  'Jonathan Taylor': { last4PPG: 12.4, seasonPPG: 16.2, trend: 'cold' },
  "Ja'Marr Chase": { last4PPG: 28.6, seasonPPG: 24.2, trend: 'hot' },
  'CeeDee Lamb': { last4PPG: 14.8, seasonPPG: 18.2, trend: 'cold' },
  'Tyreek Hill': { last4PPG: 12.2, seasonPPG: 16.8, trend: 'cold' },
  'Justin Jefferson': { last4PPG: 22.4, seasonPPG: 20.1, trend: 'warm' },
  'Amon-Ra St. Brown': { last4PPG: 21.8, seasonPPG: 19.6, trend: 'warm' },
  'Lamar Jackson': { last4PPG: 26.2, seasonPPG: 24.8, trend: 'warm' },
  'Josh Allen': { last4PPG: 28.4, seasonPPG: 26.2, trend: 'warm' },
  'Patrick Mahomes': { last4PPG: 19.8, seasonPPG: 21.4, trend: 'neutral' },
  'Joe Burrow': { last4PPG: 24.6, seasonPPG: 22.8, trend: 'warm' },
  'Bijan Robinson': { last4PPG: 19.2, seasonPPG: 17.4, trend: 'warm' },
  'Jahmyr Gibbs': { last4PPG: 18.4, seasonPPG: 16.8, trend: 'warm' },
  'Travis Kelce': { last4PPG: 11.2, seasonPPG: 14.6, trend: 'cold' },
  'De\'Von Achane': { last4PPG: 22.8, seasonPPG: 18.2, trend: 'hot' },
  'Breece Hall': { last4PPG: 13.4, seasonPPG: 15.8, trend: 'cold' },
  'Puka Nacua': { last4PPG: 18.6, seasonPPG: 17.2, trend: 'warm' },
  'A.J. Brown': { last4PPG: 16.2, seasonPPG: 18.8, trend: 'neutral' },
  'Cooper Kupp': { last4PPG: 14.8, seasonPPG: 16.4, trend: 'neutral' },
};

// Vegas Implied Points - team totals for playoff weeks (average)
const VEGAS_IMPLIED_POINTS: Record<string, {
  avgTeamTotal: number;  // Average implied team total for playoff weeks
  environment: 'elite' | 'good' | 'average' | 'poor';
}> = {
  DET: { avgTeamTotal: 28.5, environment: 'elite' },
  BAL: { avgTeamTotal: 27.5, environment: 'elite' },
  BUF: { avgTeamTotal: 27.0, environment: 'elite' },
  PHI: { avgTeamTotal: 26.5, environment: 'elite' },
  CIN: { avgTeamTotal: 25.5, environment: 'good' },
  SF: { avgTeamTotal: 25.0, environment: 'good' },
  MIA: { avgTeamTotal: 24.5, environment: 'good' },
  KC: { avgTeamTotal: 24.0, environment: 'good' },
  GB: { avgTeamTotal: 24.0, environment: 'good' },
  MIN: { avgTeamTotal: 23.5, environment: 'average' },
  DAL: { avgTeamTotal: 23.0, environment: 'average' },
  HOU: { avgTeamTotal: 23.0, environment: 'average' },
  LAR: { avgTeamTotal: 22.5, environment: 'average' },
  TB: { avgTeamTotal: 22.5, environment: 'average' },
  ATL: { avgTeamTotal: 22.0, environment: 'average' },
  SEA: { avgTeamTotal: 22.0, environment: 'average' },
  WAS: { avgTeamTotal: 21.5, environment: 'average' },
  ARI: { avgTeamTotal: 21.0, environment: 'average' },
  CHI: { avgTeamTotal: 20.5, environment: 'poor' },
  IND: { avgTeamTotal: 20.5, environment: 'poor' },
  JAX: { avgTeamTotal: 20.0, environment: 'poor' },
  NO: { avgTeamTotal: 20.0, environment: 'poor' },
  PIT: { avgTeamTotal: 19.5, environment: 'poor' },
  LAC: { avgTeamTotal: 19.5, environment: 'poor' },
  DEN: { avgTeamTotal: 19.0, environment: 'poor' },
  CLE: { avgTeamTotal: 18.5, environment: 'poor' },
  NYJ: { avgTeamTotal: 18.0, environment: 'poor' },
  TEN: { avgTeamTotal: 18.0, environment: 'poor' },
  NE: { avgTeamTotal: 17.5, environment: 'poor' },
  LV: { avgTeamTotal: 17.5, environment: 'poor' },
  NYG: { avgTeamTotal: 17.0, environment: 'poor' },
  CAR: { avgTeamTotal: 16.5, environment: 'poor' },
};

// Playoff Weather - cold/bad weather venues in weeks 15-17
const COLD_WEATHER_VENUES: Set<string> = new Set([
  'BUF', 'GB', 'CHI', 'NE', 'DEN', 'CLE', 'PIT', 'CIN', 'BAL',
  'NYJ', 'NYG', 'PHI', 'WAS', 'KC', 'MIN', // MIN is dome but cold travel
]);

// Primetime games in playoff weeks (15-17)
const PRIMETIME_PLAYOFF_GAMES: Record<string, Array<{ week: number; slot: 'SNF' | 'MNF' | 'TNF' | 'SAT' }>> = {
  // Week 15
  'LAC': [{ week: 15, slot: 'TNF' }],
  'TB': [{ week: 15, slot: 'TNF' }],
  'PIT': [{ week: 15, slot: 'SNF' }],
  'PHI': [{ week: 15, slot: 'SNF' }],
  'CHI': [{ week: 15, slot: 'MNF' }],
  'MIN': [{ week: 15, slot: 'MNF' }],
  // Week 16 (Christmas games + regular primetime)
  'KC': [{ week: 16, slot: 'SAT' }],
  'HOU': [{ week: 16, slot: 'SAT' }],
  'BAL': [{ week: 16, slot: 'SAT' }],
  // Week 17
  'DET': [{ week: 17, slot: 'SNF' }],
  'SF': [{ week: 17, slot: 'SNF' }],
};

// Positional scarcity - bonus for elite players at scarce positions
const POSITIONAL_SCARCITY: Record<string, {
  tier: 'elite' | 'high' | 'mid' | 'replacement';
  scarcityBonus: number;
}> = {
  // Elite TEs are rare - big bonus
  'Travis Kelce': { tier: 'elite', scarcityBonus: 10 },
  'Mark Andrews': { tier: 'elite', scarcityBonus: 8 },
  'Sam LaPorta': { tier: 'elite', scarcityBonus: 8 },
  'Trey McBride': { tier: 'high', scarcityBonus: 6 },
  'George Kittle': { tier: 'high', scarcityBonus: 6 },
  'David Njoku': { tier: 'high', scarcityBonus: 5 },
  'Dalton Kincaid': { tier: 'high', scarcityBonus: 5 },
  // Elite rushing QBs
  'Lamar Jackson': { tier: 'elite', scarcityBonus: 8 },
  'Josh Allen': { tier: 'elite', scarcityBonus: 8 },
  'Jalen Hurts': { tier: 'elite', scarcityBonus: 6 },
  'Jayden Daniels': { tier: 'high', scarcityBonus: 5 },
};

// Bye weeks remaining (by week 18 most are done, but just in case)
const REMAINING_BYE: Record<string, number> = {
  // By playoffs (week 15+) all teams have had their bye
  // This would be populated dynamically from schedule service
};

// Recent usage/target share trends (last 4 weeks vs season avg)
const USAGE_TRENDS: Record<string, {
  targetShare?: number; // WR/TE - current
  targetSharePrev?: number; // WR/TE - season avg before last 4 weeks
  carryShare?: number; // RB - current
  carrySharePrev?: number; // RB - season avg before last 4 weeks
  trend: 'up' | 'stable' | 'down';
  snapsPercent: number;
}> = {
  'Saquon Barkley': { carryShare: 58, carrySharePrev: 57, trend: 'stable', snapsPercent: 72 },
  'Jonathan Taylor': { carryShare: 55, carrySharePrev: 62, trend: 'down', snapsPercent: 60 },
  'Derrick Henry': { carryShare: 54, carrySharePrev: 55, trend: 'stable', snapsPercent: 65 },
  "Ja'Marr Chase": { targetShare: 32, targetSharePrev: 28, trend: 'up', snapsPercent: 95 },
  'CeeDee Lamb': { targetShare: 28, targetSharePrev: 32, trend: 'down', snapsPercent: 90 },
  'Tyreek Hill': { targetShare: 26, targetSharePrev: 30, trend: 'down', snapsPercent: 88 },
  'Justin Jefferson': { targetShare: 30, targetSharePrev: 29, trend: 'stable', snapsPercent: 92 },
  'Amon-Ra St. Brown': { targetShare: 28, targetSharePrev: 27, trend: 'stable', snapsPercent: 94 },
  'Lamar Jackson': { trend: 'up', snapsPercent: 100 },
  'Josh Allen': { trend: 'stable', snapsPercent: 100 },
  'Bijan Robinson': { carryShare: 62, carrySharePrev: 55, trend: 'up', snapsPercent: 75 },
  'Jahmyr Gibbs': { carryShare: 48, carrySharePrev: 47, trend: 'stable', snapsPercent: 55 },
  'Travis Kelce': { targetShare: 22, targetSharePrev: 26, trend: 'down', snapsPercent: 85 },
  'Breece Hall': { carryShare: 52, carrySharePrev: 58, trend: 'down', snapsPercent: 65 },
};

export interface RedraftValue {
  player: Player;
  overallScore: number; // 0-100
  scheduleScore: number;
  playoffScore: number;
  availabilityScore: number;
  usageScore: number;
  hotColdScore: number;
  vegasScore: number;
  weatherScore: number;
  scarcityScore: number;
  primetimeScore: number;
  playoffMatchups: Array<{ week: number; opponent: string; difficulty: 'smash' | 'good' | 'neutral' | 'tough' | 'avoid' }>;
  hotColdStreak?: { last4PPG: number; seasonPPG: number; trend: string };
  vegasImplied?: number;
  coldWeatherGames?: number;
  primetimeGames?: Array<{ week: number; slot: string }>;
  factors: {
    positive: string[];
    negative: string[];
    neutral: string[];
  };
  summary: string;
}

function getScheduleDifficulty(rank: number): 'smash' | 'good' | 'neutral' | 'tough' | 'avoid' {
  if (rank >= 28) return 'smash';
  if (rank >= 22) return 'good';
  if (rank >= 12) return 'neutral';
  if (rank >= 6) return 'tough';
  return 'avoid';
}

/**
 * Calculate redraft (rest-of-season) value for a player
 */
export function calculateRedraftValue(player: Player): RedraftValue {
  const factors = {
    positive: [] as string[],
    negative: [] as string[],
    neutral: [] as string[],
  };

  const team = player.team || 'FA';
  const position = player.position;
  const posKey = position === 'QB' ? 'vsQB' : position === 'RB' ? 'vsRB' : position === 'WR' ? 'vsWR' : 'vsTE';

  // 1. Playoff Schedule Score (0-35 points)
  let playoffScore = 17; // baseline
  const playoffMatchups: RedraftValue['playoffMatchups'] = [];

  const schedule = PLAYOFF_SCHEDULE[team];
  if (schedule) {
    const weeks = [
      { week: 15, opp: schedule.week15 },
      { week: 16, opp: schedule.week16 },
      { week: 17, opp: schedule.week17 },
    ];

    let totalRank = 0;
    for (const { week, opp } of weeks) {
      const defRank = DEFENSE_RANKINGS[opp]?.[posKey] || 16;
      totalRank += defRank;
      playoffMatchups.push({
        week,
        opponent: opp,
        difficulty: getScheduleDifficulty(defRank),
      });
    }

    const avgRank = totalRank / 3;

    if (avgRank >= 26) {
      playoffScore = 35;
      factors.positive.push(`Elite playoff schedule (avg rank ${avgRank.toFixed(0)} vs ${position})`);
    } else if (avgRank >= 20) {
      playoffScore = 28;
      factors.positive.push(`Good playoff schedule (avg rank ${avgRank.toFixed(0)})`);
    } else if (avgRank >= 14) {
      playoffScore = 20;
      factors.neutral.push(`Average playoff schedule`);
    } else if (avgRank >= 8) {
      playoffScore = 12;
      factors.negative.push(`Tough playoff schedule (avg rank ${avgRank.toFixed(0)})`);
    } else {
      playoffScore = 5;
      factors.negative.push(`Brutal playoff schedule (avg rank ${avgRank.toFixed(0)} vs ${position})`);
    }
  } else {
    factors.neutral.push('No schedule data');
  }

  // 2. Availability Score (0-25 points)
  let availabilityScore = 18;
  const availability = SEASON_AVAILABILITY[player.name];

  if (availability) {
    const gamesPlayed = availability.gamesPlayed;

    if (availability.currentStatus === 'IR') {
      availabilityScore = 0;
      factors.negative.push(`On IR - out for season`);
    } else if (availability.currentStatus === 'out') {
      availabilityScore = 5;
      factors.negative.push(`Currently OUT`);
    } else if (gamesPlayed >= 14 && availability.currentStatus === 'healthy') {
      availabilityScore = 25;
      factors.positive.push(`Healthy all season (${gamesPlayed}/16 games)`);
    } else if (gamesPlayed >= 12) {
      availabilityScore = 20;
      factors.neutral.push(`Good availability (${gamesPlayed}/16 games)`);
    } else if (gamesPlayed >= 10) {
      availabilityScore = 15;
      factors.neutral.push(`Some missed time (${gamesPlayed}/16 games)`);
    } else {
      availabilityScore = 8;
      factors.negative.push(`Injury concerns (only ${gamesPlayed}/16 games)`);
    }

    if (availability.currentStatus === 'questionable' && availability.recentInjury) {
      availabilityScore -= 3;
      factors.negative.push(`Currently questionable (${availability.recentInjury})`);
    }
  } else {
    factors.neutral.push('No availability data');
  }

  // 3. Usage Score (0-25 points)
  let usageScore = 15;
  const usage = USAGE_TRENDS[player.name];

  if (usage) {
    const shareVal = usage.targetShare || usage.carryShare || 0;

    if (shareVal >= 30 || (position === 'RB' && shareVal >= 55)) {
      usageScore = 25;
      factors.positive.push(`Elite usage (${shareVal}% share)`);
    } else if (shareVal >= 25 || (position === 'RB' && shareVal >= 45)) {
      usageScore = 20;
      factors.positive.push(`Strong usage (${shareVal}% share)`);
    } else if (shareVal >= 20 || (position === 'RB' && shareVal >= 35)) {
      usageScore = 15;
      factors.neutral.push(`Average usage`);
    } else if (shareVal > 0) {
      usageScore = 10;
      factors.negative.push(`Limited usage (${shareVal}% share)`);
    }

    if (usage.trend === 'up') {
      usageScore += 3;
      const prev = usage.targetSharePrev || usage.carrySharePrev;
      const curr = usage.targetShare || usage.carryShare;
      if (prev && curr) {
        factors.positive.push(`Usage trending UP: ${prev}% -> ${curr}% last 4 weeks`);
      } else {
        factors.positive.push('Usage trending UP');
      }
    } else if (usage.trend === 'down') {
      usageScore -= 3;
      const prev = usage.targetSharePrev || usage.carrySharePrev;
      const curr = usage.targetShare || usage.carryShare;
      if (prev && curr) {
        factors.negative.push(`Usage trending DOWN: ${prev}% -> ${curr}% last 4 weeks`);
      } else {
        factors.negative.push('Usage trending DOWN');
      }
    }

    if (usage.snapsPercent >= 85) {
      factors.positive.push(`High snap count (${usage.snapsPercent}%)`);
    } else if (usage.snapsPercent < 60) {
      factors.negative.push(`Low snap count (${usage.snapsPercent}%)`);
    }
  } else {
    factors.neutral.push('No usage data');
  }
  usageScore = Math.max(0, Math.min(25, usageScore));

  // 4. Schedule Strength (remaining games) - 0-15 points
  // Simplified: use playoff score as proxy
  const scheduleScore = Math.round(playoffScore * 0.4);

  // 5. Hot/Cold Streak Score (0-15 points) - recent performance vs season average
  let hotColdScore = 8; // baseline
  let hotColdInfo: RedraftValue['hotColdStreak'] | undefined;
  const streak = HOT_COLD_STREAK[player.name];

  if (streak) {
    hotColdInfo = { last4PPG: streak.last4PPG, seasonPPG: streak.seasonPPG, trend: streak.trend };
    const ppgDiff = streak.last4PPG - streak.seasonPPG;

    if (streak.trend === 'hot') {
      hotColdScore = 15;
      factors.positive.push(`🔥 HOT: ${streak.last4PPG.toFixed(1)} PPG last 4 (${ppgDiff > 0 ? '+' : ''}${ppgDiff.toFixed(1)} vs season avg)`);
    } else if (streak.trend === 'warm') {
      hotColdScore = 12;
      factors.positive.push(`Trending up: ${streak.last4PPG.toFixed(1)} PPG last 4 games`);
    } else if (streak.trend === 'cold') {
      hotColdScore = 4;
      factors.negative.push(`❄️ COLD: ${streak.last4PPG.toFixed(1)} PPG last 4 (${ppgDiff.toFixed(1)} vs season avg)`);
    } else if (streak.trend === 'ice') {
      hotColdScore = 0;
      factors.negative.push(`🧊 ICE COLD: ${streak.last4PPG.toFixed(1)} PPG last 4 - major concern`);
    }
  }

  // 6. Vegas Implied Score (0-12 points) - team's scoring environment
  let vegasScore = 6; // baseline
  let vegasImpliedInfo: number | undefined;
  const vegas = team ? VEGAS_IMPLIED_POINTS[team] : undefined;

  if (vegas) {
    vegasImpliedInfo = vegas.avgTeamTotal;

    if (vegas.environment === 'elite') {
      vegasScore = 12;
      factors.positive.push(`Elite Vegas environment (${vegas.avgTeamTotal} implied pts/game)`);
    } else if (vegas.environment === 'good') {
      vegasScore = 9;
      factors.positive.push(`Good scoring environment (${vegas.avgTeamTotal} implied)`);
    } else if (vegas.environment === 'average') {
      vegasScore = 6;
      factors.neutral.push(`Average team scoring projection`);
    } else {
      vegasScore = 3;
      factors.negative.push(`Poor Vegas environment (${vegas.avgTeamTotal} implied pts/game)`);
    }
  }

  // 7. Weather Score (0-8 points) - cold weather impact on playoffs
  let weatherScore = 6; // baseline
  let coldWeatherGamesCount = 0;

  if (schedule) {
    const weeks = [schedule.week15, schedule.week16, schedule.week17];
    for (const opp of weeks) {
      if (COLD_WEATHER_VENUES.has(opp)) {
        coldWeatherGamesCount++;
      }
    }

    if (coldWeatherGamesCount === 0) {
      weatherScore = 8;
      factors.positive.push('No cold weather playoff games');
    } else if (coldWeatherGamesCount === 1) {
      weatherScore = 6;
      factors.neutral.push(`1 cold weather game in playoffs`);
    } else if (coldWeatherGamesCount >= 2) {
      weatherScore = 3;
      factors.negative.push(`${coldWeatherGamesCount} cold weather playoff games`);
    }
  }

  // 8. Positional Scarcity Score (0-10 points) - TE premium, elite QB bonus
  let scarcityScore = 3; // baseline (most players get minimal bonus)
  const scarcity = POSITIONAL_SCARCITY[player.name];

  if (scarcity) {
    scarcityScore = scarcity.scarcityBonus;
    if (scarcity.tier === 'elite') {
      factors.positive.push(`Elite at scarce position (+${scarcity.scarcityBonus} value)`);
    } else if (scarcity.tier === 'high') {
      factors.positive.push(`High-end at scarce position`);
    }
  } else if (position === 'TE') {
    // Generic TE scarcity
    scarcityScore = 4;
    factors.neutral.push('TE positional scarcity');
  } else if (position === 'QB') {
    // Generic QB - slight bonus
    scarcityScore = 3;
  }

  // 9. Primetime Score (0-8 points) - primetime playoff games
  let primetimeScore = 5; // baseline
  let primetimeGamesInfo: RedraftValue['primetimeGames'] | undefined;
  const primetimeGames = team ? PRIMETIME_PLAYOFF_GAMES[team] : undefined;

  if (primetimeGames && primetimeGames.length > 0) {
    primetimeGamesInfo = primetimeGames;
    if (primetimeGames.length >= 2) {
      primetimeScore = 8;
      factors.positive.push(`${primetimeGames.length} primetime playoff games - high visibility`);
    } else {
      primetimeScore = 7;
      factors.neutral.push(`1 primetime game in playoffs (${primetimeGames[0].slot} Wk ${primetimeGames[0].week})`);
    }
  }

  // Calculate overall (adjusted - old max was ~100, new max is ~130)
  // Normalize to 0-100 scale
  const rawScore = playoffScore + availabilityScore + usageScore + scheduleScore + hotColdScore + vegasScore + weatherScore + scarcityScore + primetimeScore;
  const overallScore = Math.round((rawScore / 130) * 100);

  // Generate summary
  let summary = `${player.name}: `;
  if (overallScore >= 80) {
    summary += 'Elite ROS asset. Target in trades.';
  } else if (overallScore >= 65) {
    summary += 'Strong ROS value. Good playoff schedule.';
  } else if (overallScore >= 50) {
    summary += 'Average ROS outlook. Proceed with caution.';
  } else if (overallScore >= 35) {
    summary += 'Below average ROS. Consider selling.';
  } else {
    summary += 'Poor ROS outlook. Sell if possible.';
  }

  return {
    player,
    overallScore,
    scheduleScore,
    playoffScore,
    availabilityScore,
    usageScore,
    hotColdScore,
    vegasScore,
    weatherScore,
    scarcityScore,
    primetimeScore,
    playoffMatchups,
    hotColdStreak: hotColdInfo,
    vegasImplied: vegasImpliedInfo,
    coldWeatherGames: coldWeatherGamesCount,
    primetimeGames: primetimeGamesInfo,
    factors,
    summary,
  };
}

export default { calculateRedraftValue };
