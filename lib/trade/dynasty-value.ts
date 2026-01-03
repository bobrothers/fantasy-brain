/**
 * Dynasty Trade Value Calculator
 *
 * Evaluates long-term player value for dynasty/keeper leagues.
 * Factors: age curves, injury history, situation stability, usage trends
 *
 * DATA SOURCES:
 * - Age/experience from Sleeper API
 * - Injury history manually researched (major injuries only)
 * - Contract/situation data manually researched
 */

import type { Player } from '../../types';

// Position-specific age curves (peak years and decline rates)
// Based on historical NFL data
const AGE_CURVES = {
  QB: { peakStart: 26, peakEnd: 35, declineRate: 0.03, careerEnd: 40 },
  RB: { peakStart: 23, peakEnd: 27, declineRate: 0.12, careerEnd: 31 },
  WR: { peakStart: 24, peakEnd: 30, declineRate: 0.06, careerEnd: 34 },
  TE: { peakStart: 25, peakEnd: 30, declineRate: 0.05, careerEnd: 34 },
  K: { peakStart: 25, peakEnd: 38, declineRate: 0.02, careerEnd: 45 },
  DEF: { peakStart: 0, peakEnd: 99, declineRate: 0, careerEnd: 99 },
};

// Career injury history - major injuries that affect long-term value
// Manually researched - add players as needed
const INJURY_HISTORY: Record<string, {
  injuries: Array<{ year: number; type: string; severity: 'major' | 'moderate' | 'minor' }>;
  recurring: boolean;
  concern: 'high' | 'moderate' | 'low' | 'none';
}> = {
  'Saquon Barkley': {
    injuries: [
      { year: 2020, type: 'ACL tear', severity: 'major' },
      { year: 2021, type: 'Ankle', severity: 'moderate' },
    ],
    recurring: false,
    concern: 'moderate',
  },
  'Jonathan Taylor': {
    injuries: [
      { year: 2023, type: 'Ankle', severity: 'major' },
      { year: 2024, type: 'Ankle', severity: 'moderate' },
    ],
    recurring: true,
    concern: 'high',
  },
  'Derrick Henry': {
    injuries: [
      { year: 2021, type: 'Foot (Jones fracture)', severity: 'major' },
    ],
    recurring: false,
    concern: 'moderate',
  },
  'Christian McCaffrey': {
    injuries: [
      { year: 2020, type: 'Ankle/Shoulder', severity: 'major' },
      { year: 2021, type: 'Hamstring/Thigh', severity: 'moderate' },
      { year: 2024, type: 'Achilles', severity: 'major' },
    ],
    recurring: true,
    concern: 'high',
  },
  'Breece Hall': {
    injuries: [
      { year: 2022, type: 'ACL tear', severity: 'major' },
    ],
    recurring: false,
    concern: 'moderate',
  },
  'Javonte Williams': {
    injuries: [
      { year: 2022, type: 'ACL/LCL/MCL tear', severity: 'major' },
    ],
    recurring: false,
    concern: 'high',
  },
  'Nick Chubb': {
    injuries: [
      { year: 2023, type: 'ACL/MCL tear', severity: 'major' },
      { year: 2015, type: 'ACL (college)', severity: 'major' },
    ],
    recurring: true,
    concern: 'high',
  },
  'Michael Thomas': {
    injuries: [
      { year: 2020, type: 'Ankle', severity: 'major' },
      { year: 2021, type: 'Ankle', severity: 'major' },
    ],
    recurring: true,
    concern: 'high',
  },
  'Tua Tagovailoa': {
    injuries: [
      { year: 2022, type: 'Concussion', severity: 'major' },
      { year: 2023, type: 'Concussion', severity: 'major' },
      { year: 2024, type: 'Concussion', severity: 'major' },
    ],
    recurring: true,
    concern: 'high',
  },
  "Ja'Marr Chase": {
    injuries: [],
    recurring: false,
    concern: 'none',
  },
  'CeeDee Lamb': {
    injuries: [],
    recurring: false,
    concern: 'none',
  },
  'Tyreek Hill': {
    injuries: [],
    recurring: false,
    concern: 'low',
  },
  'Davante Adams': {
    injuries: [
      { year: 2024, type: 'Hamstring', severity: 'moderate' },
    ],
    recurring: false,
    concern: 'low',
  },
  'A.J. Brown': {
    injuries: [
      { year: 2024, type: 'Hamstring', severity: 'moderate' },
      { year: 2024, type: 'Knee', severity: 'moderate' },
    ],
    recurring: false,
    concern: 'moderate',
  },
  'Cooper Kupp': {
    injuries: [
      { year: 2022, type: 'Ankle', severity: 'major' },
      { year: 2023, type: 'Hamstring', severity: 'moderate' },
    ],
    recurring: true,
    concern: 'moderate',
  },
  'Travis Kelce': {
    injuries: [],
    recurring: false,
    concern: 'low',
  },
  'Mark Andrews': {
    injuries: [
      { year: 2023, type: 'Ankle/Achilles', severity: 'major' },
    ],
    recurring: false,
    concern: 'moderate',
  },
  'Lamar Jackson': {
    injuries: [],
    recurring: false,
    concern: 'low',
  },
  'Josh Allen': {
    injuries: [],
    recurring: false,
    concern: 'low',
  },
  'Patrick Mahomes': {
    injuries: [],
    recurring: false,
    concern: 'none',
  },
  'Jalen Hurts': {
    injuries: [],
    recurring: false,
    concern: 'low',
  },
  'Joe Burrow': {
    injuries: [
      { year: 2020, type: 'ACL tear', severity: 'major' },
      { year: 2023, type: 'Wrist', severity: 'major' },
    ],
    recurring: false,
    concern: 'moderate',
  },
  'Justin Jefferson': {
    injuries: [
      { year: 2023, type: 'Hamstring', severity: 'moderate' },
    ],
    recurring: false,
    concern: 'low',
  },
  'Amon-Ra St. Brown': {
    injuries: [],
    recurring: false,
    concern: 'none',
  },
  'Puka Nacua': {
    injuries: [
      { year: 2024, type: 'Knee', severity: 'moderate' },
    ],
    recurring: false,
    concern: 'low',
  },
  'Bijan Robinson': {
    injuries: [],
    recurring: false,
    concern: 'none',
  },
  'Jahmyr Gibbs': {
    injuries: [],
    recurring: false,
    concern: 'none',
  },
  'De\'Von Achane': {
    injuries: [
      { year: 2023, type: 'Knee/Ankle', severity: 'moderate' },
    ],
    recurring: false,
    concern: 'low',
  },
};

// Draft capital - higher picks are more valuable in dynasty
// Format: { round: 1-7, pick: overall pick number, year: draft year }
const DRAFT_CAPITAL: Record<string, { round: number; pick: number; year: number }> = {
  "Ja'Marr Chase": { round: 1, pick: 5, year: 2021 },
  'Justin Jefferson': { round: 1, pick: 22, year: 2020 },
  'CeeDee Lamb': { round: 1, pick: 17, year: 2020 },
  'Tyreek Hill': { round: 5, pick: 165, year: 2016 },
  'A.J. Brown': { round: 2, pick: 51, year: 2019 },
  'Amon-Ra St. Brown': { round: 4, pick: 112, year: 2021 },
  'Puka Nacua': { round: 5, pick: 177, year: 2023 },
  'Davante Adams': { round: 2, pick: 53, year: 2014 },
  'Cooper Kupp': { round: 3, pick: 69, year: 2017 },
  'Saquon Barkley': { round: 1, pick: 2, year: 2018 },
  'Bijan Robinson': { round: 1, pick: 8, year: 2023 },
  'Jahmyr Gibbs': { round: 1, pick: 12, year: 2023 },
  'Breece Hall': { round: 2, pick: 36, year: 2022 },
  'Jonathan Taylor': { round: 2, pick: 41, year: 2020 },
  'Derrick Henry': { round: 2, pick: 45, year: 2016 },
  'Christian McCaffrey': { round: 1, pick: 8, year: 2017 },
  "De'Von Achane": { round: 3, pick: 84, year: 2023 },
  'Josh Jacobs': { round: 1, pick: 24, year: 2019 },
  'Nick Chubb': { round: 2, pick: 35, year: 2018 },
  'Travis Kelce': { round: 3, pick: 63, year: 2013 },
  'Mark Andrews': { round: 3, pick: 86, year: 2018 },
  'Sam LaPorta': { round: 2, pick: 34, year: 2023 },
  'Trey McBride': { round: 2, pick: 55, year: 2022 },
  'Patrick Mahomes': { round: 1, pick: 10, year: 2017 },
  'Josh Allen': { round: 1, pick: 7, year: 2018 },
  'Lamar Jackson': { round: 1, pick: 32, year: 2018 },
  'Joe Burrow': { round: 1, pick: 1, year: 2020 },
  'Jalen Hurts': { round: 2, pick: 53, year: 2020 },
  'Justin Herbert': { round: 1, pick: 6, year: 2020 },
  'Jayden Daniels': { round: 1, pick: 2, year: 2024 },
  'Caleb Williams': { round: 1, pick: 1, year: 2024 },
  'Drake Maye': { round: 1, pick: 3, year: 2024 },
  'Marvin Harrison Jr.': { round: 1, pick: 4, year: 2024 },
  'Malik Nabers': { round: 1, pick: 6, year: 2024 },
  'Rome Odunze': { round: 1, pick: 9, year: 2024 },
};

// Breakout age - age when player first had fantasy-relevant production
// WRs who break out before 22 tend to have longer elite careers
const BREAKOUT_AGE: Record<string, { age: number; season: number }> = {
  "Ja'Marr Chase": { age: 21, season: 2021 }, // Rookie breakout
  'Justin Jefferson': { age: 21, season: 2020 }, // Rookie breakout
  'CeeDee Lamb': { age: 21, season: 2020 }, // Rookie impact
  'Puka Nacua': { age: 22, season: 2023 }, // Historic rookie
  'Amon-Ra St. Brown': { age: 22, season: 2021 }, // Late rookie surge
  'A.J. Brown': { age: 22, season: 2019 }, // Rookie breakout
  'Tyreek Hill': { age: 22, season: 2016 }, // Rookie impact
  'Cooper Kupp': { age: 26, season: 2021 }, // Late breakout
  'Davante Adams': { age: 24, season: 2016 }, // Year 3 breakout
  'Saquon Barkley': { age: 21, season: 2018 }, // Rookie breakout
  'Bijan Robinson': { age: 21, season: 2023 }, // Rookie breakout
  'Jahmyr Gibbs': { age: 21, season: 2023 }, // Rookie breakout
  'Breece Hall': { age: 21, season: 2022 }, // Pre-injury breakout
  'Jonathan Taylor': { age: 21, season: 2020 }, // Rookie breakout
  'Christian McCaffrey': { age: 21, season: 2017 }, // Rookie impact
  "De'Von Achane": { age: 21, season: 2023 }, // Rookie breakout
  'Travis Kelce': { age: 26, season: 2016 }, // Late TE breakout (normal)
  'Mark Andrews': { age: 24, season: 2019 }, // Year 2 breakout
  'Sam LaPorta': { age: 22, season: 2023 }, // Rookie breakout (rare for TE)
};

// Team offensive rankings (1 = best, 32 = worst)
// Based on 2024/2025 offensive efficiency
const TEAM_OFFENSIVE_RANKING: Record<string, number> = {
  DET: 1, BAL: 2, BUF: 3, PHI: 4, SF: 5, CIN: 6, MIA: 7, DAL: 8,
  GB: 9, HOU: 10, LAR: 11, KC: 12, MIN: 13, TB: 14, SEA: 15, ATL: 16,
  CHI: 17, WAS: 18, JAX: 19, IND: 20, ARI: 21, LAC: 22, DEN: 23, PIT: 24,
  NO: 25, CLE: 26, NYJ: 27, LV: 28, TEN: 29, NE: 30, NYG: 31, CAR: 32,
};

// Depth chart threats - young backups who could take over
const DEPTH_CHART_THREAT: Record<string, {
  backupName: string;
  backupAge: number;
  threatLevel: 'high' | 'moderate' | 'low' | 'none';
  notes: string;
}> = {
  'Derrick Henry': { backupName: 'Justice Hill', backupAge: 26, threatLevel: 'low', notes: 'Hill is change-of-pace only' },
  'Saquon Barkley': { backupName: 'Kenny Gainwell', backupAge: 25, threatLevel: 'none', notes: 'Barkley is workhorse' },
  'Jonathan Taylor': { backupName: 'Trey Sermon', backupAge: 26, threatLevel: 'low', notes: 'Clear bellcow when healthy' },
  'Jahmyr Gibbs': { backupName: 'David Montgomery', backupAge: 28, threatLevel: 'moderate', notes: 'Split backfield limits ceiling' },
  'Breece Hall': { backupName: 'Braelon Allen', backupAge: 20, threatLevel: 'moderate', notes: 'Allen getting more work' },
  'Travis Kelce': { backupName: 'Noah Gray', backupAge: 25, threatLevel: 'low', notes: 'Kelce still dominant when playing' },
  'CeeDee Lamb': { backupName: 'Jalen Tolbert', backupAge: 25, threatLevel: 'none', notes: 'Clear WR1' },
  'Tyreek Hill': { backupName: 'Jaylen Waddle', backupAge: 26, threatLevel: 'low', notes: 'Waddle is WR2, not replacement' },
  'Josh Jacobs': { backupName: 'MarShawn Lloyd', backupAge: 23, threatLevel: 'moderate', notes: 'Lloyd was high draft pick' },
  'Aaron Jones': { backupName: 'Various', backupAge: 0, threatLevel: 'high', notes: 'Age and injury history' },
  'Alvin Kamara': { backupName: 'Kendre Miller', backupAge: 23, threatLevel: 'moderate', notes: 'Miller drafted to take over' },
};

// Situation analysis - team stability, role security, contract
// Manually researched
const SITUATION_DATA: Record<string, {
  contractYears: number; // Years remaining
  roleSecure: boolean;
  crowdedBackfield: boolean;
  newCoach: boolean;
  teamTrending: 'up' | 'stable' | 'down';
  notes: string;
}> = {
  'Saquon Barkley': {
    contractYears: 2,
    roleSecure: true,
    crowdedBackfield: false,
    newCoach: false,
    teamTrending: 'up',
    notes: 'Workhorse role in Philly. Massive turnaround from NYG.',
  },
  'Jonathan Taylor': {
    contractYears: 3,
    roleSecure: true,
    crowdedBackfield: false,
    newCoach: false,
    teamTrending: 'stable',
    notes: 'Signed extension. Injury concerns limit ceiling.',
  },
  'Derrick Henry': {
    contractYears: 1,
    roleSecure: true,
    crowdedBackfield: false,
    newCoach: false,
    teamTrending: 'up',
    notes: 'Resurgence in Baltimore. Age 30 - limited runway.',
  },
  "Ja'Marr Chase": {
    contractYears: 4,
    roleSecure: true,
    crowdedBackfield: false,
    newCoach: false,
    teamTrending: 'up',
    notes: 'Elite WR1. Burrow connection. Locked in long-term.',
  },
  'CeeDee Lamb': {
    contractYears: 4,
    roleSecure: true,
    crowdedBackfield: false,
    newCoach: true,
    teamTrending: 'down',
    notes: 'Cowboys dysfunction. New coaching staff incoming.',
  },
  'Tyreek Hill': {
    contractYears: 2,
    roleSecure: true,
    crowdedBackfield: false,
    newCoach: false,
    teamTrending: 'down',
    notes: 'QB uncertainty in Miami. Age 31.',
  },
  'Lamar Jackson': {
    contractYears: 4,
    roleSecure: true,
    crowdedBackfield: false,
    newCoach: false,
    teamTrending: 'up',
    notes: 'MVP-caliber play. Baltimore committed long-term.',
  },
  'Josh Allen': {
    contractYears: 5,
    roleSecure: true,
    crowdedBackfield: false,
    newCoach: false,
    teamTrending: 'up',
    notes: 'Bills cornerstone. Elite rushing floor for QB.',
  },
  'Patrick Mahomes': {
    contractYears: 8,
    roleSecure: true,
    crowdedBackfield: false,
    newCoach: false,
    teamTrending: 'up',
    notes: 'Dynasty locked. Could decline in fantasy with aging weapons.',
  },
  'Bijan Robinson': {
    contractYears: 3,
    roleSecure: true,
    crowdedBackfield: false,
    newCoach: false,
    teamTrending: 'up',
    notes: 'Workhorse role secured. ATL run-heavy.',
  },
  'Jahmyr Gibbs': {
    contractYears: 3,
    roleSecure: true,
    crowdedBackfield: true,
    newCoach: false,
    teamTrending: 'up',
    notes: 'Split with Montgomery limits ceiling. Explosive play ability.',
  },
  'Travis Kelce': {
    contractYears: 2,
    roleSecure: true,
    crowdedBackfield: false,
    newCoach: false,
    teamTrending: 'stable',
    notes: 'Age 35. Still elite but limited dynasty runway.',
  },
  'Justin Jefferson': {
    contractYears: 4,
    roleSecure: true,
    crowdedBackfield: false,
    newCoach: false,
    teamTrending: 'up',
    notes: 'Consensus WR1. Elite situation.',
  },
  'Amon-Ra St. Brown': {
    contractYears: 4,
    roleSecure: true,
    crowdedBackfield: false,
    newCoach: false,
    teamTrending: 'up',
    notes: 'Target hog in elite offense.',
  },
};

export interface DynastyValue {
  player: Player;
  overallScore: number; // 0-100 dynasty value
  ageScore: number;
  injuryScore: number;
  situationScore: number;
  draftCapitalScore: number;
  breakoutScore: number;
  offenseScore: number;
  depthChartScore: number;
  yearsOfEliteProduction: number;
  tier: 'elite' | 'high' | 'mid' | 'low' | 'avoid';
  draftCapital?: { round: number; pick: number; year: number };
  breakoutAge?: number;
  offensiveRanking?: number;
  depthThreat?: { name: string; level: string };
  factors: {
    positive: string[];
    negative: string[];
    neutral: string[];
  };
  summary: string;
}

/**
 * Calculate dynasty value for a player
 */
export function calculateDynastyValue(player: Player): DynastyValue {
  const factors = {
    positive: [] as string[],
    negative: [] as string[],
    neutral: [] as string[],
  };

  const age = player.age || 25;
  const position = player.position;
  const curve = AGE_CURVES[position] || AGE_CURVES.WR;

  // 1. Age Score (0-35 points)
  // RBs have aggressive decline - be realistic about elite years
  let ageScore = 35;
  let yearsOfEliteProduction = 0;

  if (position === 'RB') {
    // RB-specific age curve - much more aggressive
    if (age <= 24) {
      yearsOfEliteProduction = 27 - age; // Elite until ~27
      ageScore = 35;
      factors.positive.push(`Age ${age}: ${yearsOfEliteProduction} elite RB years remaining`);
    } else if (age <= 26) {
      yearsOfEliteProduction = Math.max(1, 27 - age);
      ageScore = 30 - ((age - 24) * 3);
      factors.positive.push(`Age ${age}: Peak RB years (${yearsOfEliteProduction} elite years left)`);
    } else if (age === 27) {
      yearsOfEliteProduction = 1;
      ageScore = 18;
      factors.neutral.push(`Age ${age}: Final elite RB year - sell high window`);
    } else if (age === 28) {
      yearsOfEliteProduction = 0;
      ageScore = 10;
      factors.negative.push(`Age ${age}: RB cliff - elite production unlikely`);
    } else if (age === 29) {
      yearsOfEliteProduction = 0;
      ageScore = 5;
      factors.negative.push(`Age ${age}: Past RB prime - limited dynasty value`);
    } else {
      yearsOfEliteProduction = 0;
      ageScore = 0;
      factors.negative.push(`Age ${age}: RB expiration - redraft only value`);
    }
  } else if (age < curve.peakStart) {
    // Pre-peak - valuable
    yearsOfEliteProduction = curve.peakEnd - age;
    ageScore = 35;
    factors.positive.push(`Age ${age}: ${yearsOfEliteProduction} years until decline`);
  } else if (age <= curve.peakEnd) {
    // In peak
    yearsOfEliteProduction = curve.peakEnd - age;
    ageScore = 30 - ((age - curve.peakStart) * 2);
    factors.positive.push(`Age ${age}: In prime years (${yearsOfEliteProduction}+ elite years left)`);
  } else {
    // Post-peak
    const yearsPostPeak = age - curve.peakEnd;
    yearsOfEliteProduction = Math.max(0, curve.careerEnd - age);
    ageScore = Math.max(0, 25 - (yearsPostPeak * 5));
    factors.negative.push(`Age ${age}: Past prime (${yearsOfEliteProduction} productive years left)`);
  }
  ageScore = Math.max(0, Math.min(35, ageScore));

  // 2. Injury Score (0-30 points)
  let injuryScore = 30;
  const injuryData = INJURY_HISTORY[player.name];

  if (injuryData) {
    const majorInjuries = injuryData.injuries.filter(i => i.severity === 'major').length;

    if (injuryData.concern === 'high') {
      injuryScore = 10;
      factors.negative.push(`High injury concern: ${majorInjuries} major injuries, ${injuryData.recurring ? 'recurring pattern' : 'durability questions'}`);
    } else if (injuryData.concern === 'moderate') {
      injuryScore = 20;
      factors.neutral.push(`Moderate injury history: ${majorInjuries} major injury${majorInjuries !== 1 ? 'ies' : ''}`);
    } else if (injuryData.concern === 'low') {
      injuryScore = 27;
      factors.positive.push('Minor injury history - generally durable');
    } else {
      injuryScore = 30;
      factors.positive.push('Clean injury history');
    }

    // ACL penalty
    const hasACL = injuryData.injuries.some(i => i.type.includes('ACL'));
    if (hasACL && position === 'RB') {
      injuryScore -= 5;
      factors.negative.push('ACL history (RB concern)');
    }

    // Recurring soft tissue
    if (injuryData.recurring && injuryData.injuries.some(i =>
      i.type.includes('Hamstring') || i.type.includes('Ankle') || i.type.includes('Achilles')
    )) {
      injuryScore -= 5;
      factors.negative.push('Recurring soft tissue injuries');
    }
  } else {
    // No data - assume average
    injuryScore = 22;
    factors.neutral.push('No detailed injury data');
  }
  injuryScore = Math.max(0, Math.min(30, injuryScore));

  // 3. Situation Score (0-35 points)
  let situationScore = 20;
  const situation = SITUATION_DATA[player.name];

  if (situation) {
    // Contract stability
    if (situation.contractYears >= 3) {
      situationScore += 8;
      factors.positive.push(`${situation.contractYears} years under contract`);
    } else if (situation.contractYears === 1) {
      situationScore -= 5;
      factors.negative.push('Contract year - uncertainty ahead');
    }

    // Role security
    if (situation.roleSecure && !situation.crowdedBackfield) {
      situationScore += 7;
      factors.positive.push('Secure role with heavy usage');
    } else if (situation.crowdedBackfield) {
      situationScore -= 3;
      factors.neutral.push('Crowded backfield limits ceiling');
    }

    // Team trajectory
    if (situation.teamTrending === 'up') {
      situationScore += 5;
      factors.positive.push('Team trending up');
    } else if (situation.teamTrending === 'down') {
      situationScore -= 5;
      factors.negative.push('Team trending down');
    }

    // Coaching stability
    if (situation.newCoach) {
      situationScore -= 3;
      factors.neutral.push('New coaching staff - scheme uncertainty');
    }

    if (situation.notes) {
      factors.neutral.push(situation.notes);
    }
  } else {
    factors.neutral.push('Limited situation data');
  }
  situationScore = Math.max(0, Math.min(35, situationScore));

  // 4. Draft Capital Score (0-10 points) - bonus for high draft picks who've proven it
  let draftCapitalScore = 5; // baseline
  const draftData = DRAFT_CAPITAL[player.name];
  let draftCapitalInfo: DynastyValue['draftCapital'] | undefined;

  if (draftData) {
    draftCapitalInfo = draftData;
    if (draftData.round === 1 && draftData.pick <= 10) {
      draftCapitalScore = 10;
      factors.positive.push(`Top-10 pick (${draftData.year} #${draftData.pick}) - premium asset`);
    } else if (draftData.round === 1) {
      draftCapitalScore = 8;
      factors.positive.push(`1st round pedigree (${draftData.year} #${draftData.pick})`);
    } else if (draftData.round === 2) {
      draftCapitalScore = 6;
      factors.neutral.push(`2nd round pick (${draftData.year})`);
    } else if (draftData.round >= 4) {
      // Late round breakouts get extra credit for exceeding expectations
      draftCapitalScore = 7;
      factors.positive.push(`Late-round gem (Rd ${draftData.round}) - exceeded draft capital`);
    }
  }

  // 5. Breakout Age Score (0-10 points) - WRs/RBs who broke out early have longer careers
  let breakoutScore = 5; // baseline
  let breakoutAgeInfo: number | undefined;
  const breakout = BREAKOUT_AGE[player.name];

  if (breakout) {
    breakoutAgeInfo = breakout.age;
    if (position === 'WR' || position === 'RB') {
      if (breakout.age <= 21) {
        breakoutScore = 10;
        factors.positive.push(`Elite breakout age (${breakout.age}) - historically predicts sustained production`);
      } else if (breakout.age <= 22) {
        breakoutScore = 8;
        factors.positive.push(`Early breakout (age ${breakout.age})`);
      } else if (breakout.age >= 25) {
        breakoutScore = 3;
        factors.negative.push(`Late breakout (age ${breakout.age}) - shorter prime window`);
      }
    } else if (position === 'TE') {
      // TEs typically break out later
      if (breakout.age <= 23) {
        breakoutScore = 10;
        factors.positive.push(`Rare early TE breakout (age ${breakout.age})`);
      } else if (breakout.age <= 25) {
        breakoutScore = 7;
        factors.neutral.push(`Standard TE development (breakout age ${breakout.age})`);
      }
    }
  }

  // 6. Offensive Ranking Score (0-10 points) - elite offenses boost value
  let offenseScore = 5; // baseline
  let offensiveRankingInfo: number | undefined;
  const team = player.team;

  if (team && TEAM_OFFENSIVE_RANKING[team]) {
    const rank = TEAM_OFFENSIVE_RANKING[team];
    offensiveRankingInfo = rank;

    if (rank <= 5) {
      offenseScore = 10;
      factors.positive.push(`Elite offense (#${rank}) - volume and scoring opportunity`);
    } else if (rank <= 10) {
      offenseScore = 8;
      factors.positive.push(`Top-10 offense (#${rank})`);
    } else if (rank <= 16) {
      offenseScore = 6;
      factors.neutral.push(`Average offense (#${rank})`);
    } else if (rank <= 24) {
      offenseScore = 4;
      factors.negative.push(`Below-average offense (#${rank})`);
    } else {
      offenseScore = 2;
      factors.negative.push(`Bottom-tier offense (#${rank}) - limits ceiling`);
    }
  }

  // 7. Depth Chart Threat Score (0-10 points) - deduct for looming replacements
  let depthChartScore = 8; // baseline - most players don't have immediate threats
  let depthThreatInfo: DynastyValue['depthThreat'] | undefined;
  const depthThreat = DEPTH_CHART_THREAT[player.name];

  if (depthThreat) {
    depthThreatInfo = { name: depthThreat.backupName, level: depthThreat.threatLevel };

    if (depthThreat.threatLevel === 'high') {
      depthChartScore = 3;
      factors.negative.push(`High depth chart threat: ${depthThreat.backupName} (${depthThreat.notes})`);
    } else if (depthThreat.threatLevel === 'moderate') {
      depthChartScore = 6;
      factors.neutral.push(`Moderate depth threat: ${depthThreat.backupName}`);
    } else if (depthThreat.threatLevel === 'low') {
      depthChartScore = 9;
      factors.positive.push(`Secure role - minimal backup threat`);
    } else {
      depthChartScore = 10;
      factors.positive.push(`No depth chart concerns`);
    }
  }

  // Calculate overall (adjusted weights - old max was 100, new max is 130)
  // Normalize to 0-100 scale
  const rawScore = ageScore + injuryScore + situationScore + draftCapitalScore + breakoutScore + offenseScore + depthChartScore;
  const overallScore = Math.round((rawScore / 130) * 100);

  // Determine tier
  let tier: DynastyValue['tier'];
  if (overallScore >= 80) {
    tier = 'elite';
  } else if (overallScore >= 65) {
    tier = 'high';
  } else if (overallScore >= 45) {
    tier = 'mid';
  } else if (overallScore >= 25) {
    tier = 'low';
  } else {
    tier = 'avoid';
  }

  // Generate summary
  let summary = `${player.name} (${position}, age ${age}): `;
  if (tier === 'elite') {
    summary += `Elite dynasty asset. ${yearsOfEliteProduction}+ years of production expected.`;
  } else if (tier === 'high') {
    summary += `Strong dynasty hold. Good long-term value.`;
  } else if (tier === 'mid') {
    summary += `Solid but not elite. Consider selling at peak value.`;
  } else if (tier === 'low') {
    summary += `Declining asset. Sell if you can get fair value.`;
  } else {
    summary += `Avoid for dynasty. Limited upside remaining.`;
  }

  return {
    player,
    overallScore,
    ageScore,
    injuryScore,
    situationScore,
    draftCapitalScore,
    breakoutScore,
    offenseScore,
    depthChartScore,
    yearsOfEliteProduction,
    tier,
    draftCapital: draftCapitalInfo,
    breakoutAge: breakoutAgeInfo,
    offensiveRanking: offensiveRankingInfo,
    depthThreat: depthThreatInfo,
    factors,
    summary,
  };
}

export default { calculateDynastyValue };
