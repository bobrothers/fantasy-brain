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
  yearsOfEliteProduction: number;
  tier: 'elite' | 'high' | 'mid' | 'low' | 'avoid';
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

  // Calculate overall
  const overallScore = ageScore + injuryScore + situationScore;

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
    yearsOfEliteProduction,
    tier,
    factors,
    summary,
  };
}

export default { calculateDynastyValue };
