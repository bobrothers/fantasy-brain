/**
 * Injury Analysis Module
 *
 * Analyzes player injury history for dynasty durability scoring.
 * Factors in:
 * - Games missed (last 3 seasons)
 * - Injury types (soft tissue = chronic, ACL = one-time, concussions = cumulative)
 * - Recency weighting (recent injuries matter more)
 * - Age + injury combo risks
 * - Recovery status from major injuries
 */

import {
  getInjuryHistory,
  PlayerInjuryHistory,
  InjuryType,
  GAMES_PER_SEASON,
  TOTAL_GAMES_3YR,
} from '@/lib/data/injuries';

export interface DurabilityAnalysis {
  // Core stats
  gamesPlayed: number;
  gamesMissed: number;
  availabilityRate: number; // 0-100%
  seasonsTracked: number;

  // Durability classification
  durabilityRating: 'iron_man' | 'durable' | 'moderate' | 'injury_prone' | 'glass' | 'unknown';
  durabilityScore: number; // 0-30 for dynasty scoring

  // Injury analysis
  injuryTypes: Map<InjuryType, number>; // count by type
  hasRecurringIssue: boolean;
  recurringType?: InjuryType;
  recurringDescription?: string;

  // Risk factors
  riskFactors: string[];
  severityScore: number; // weighted injury severity

  // Recovery status
  majorInjuryRecovery?: {
    injury: string;
    monthsSince: number;
    recoveryStatus: string;
  };

  // Age + injury combo
  ageInjuryRisk?: {
    level: 'low' | 'medium' | 'high' | 'extreme';
    description: string;
  };

  // Display strings
  displayText: string;
  shortDisplay: string;
}

// Injury type weights for severity calculation
const INJURY_TYPE_WEIGHTS: Record<InjuryType, number> = {
  knee_acl: 10,       // Most severe - long recovery, re-injury risk
  concussion: 9,      // Cumulative damage, career risk
  knee_other: 6,      // MCL, meniscus - moderate
  ankle_foot: 5,      // Can linger
  soft_tissue: 7,     // Chronic concern - hamstrings, etc.
  back: 6,            // Can be career-altering
  shoulder: 4,        // Usually recoverable
  wrist_hand: 3,      // Usually minor for non-QBs
  ribs: 2,            // Usually heals fine
  illness: 1,         // Non-injury
  other: 2,
};

// Season recency weights (2024 = current, 2023 = last year, 2022 = 2 years ago)
const SEASON_WEIGHTS = {
  2024: 1.5,  // Current season matters most
  2023: 1.0,  // Last season
  2022: 0.6,  // Two seasons ago
};

// Soft tissue types that indicate chronic issues
const SOFT_TISSUE_CONCERN = ['soft_tissue'];
const CONCUSSION_CONCERN = ['concussion'];

/**
 * Calculate months since a date string (YYYY-MM format)
 */
function monthsSince(dateStr: string): number {
  const [year, month] = dateStr.split('-').map(Number);
  const injuryDate = new Date(year, month - 1);
  const now = new Date();
  const diffMonths = (now.getFullYear() - injuryDate.getFullYear()) * 12 +
    (now.getMonth() - injuryDate.getMonth());
  return Math.max(0, diffMonths);
}

/**
 * Analyze player durability from injury history
 */
export function analyzeDurability(
  playerName: string,
  playerAge?: number
): DurabilityAnalysis {
  const history = getInjuryHistory(playerName);

  // No data - return unknown
  if (!history) {
    return createUnknownAnalysis(playerName);
  }

  // Calculate games played/missed
  const gamesPlayed = history.gamesPlayed[2022] + history.gamesPlayed[2023] + history.gamesPlayed[2024];
  const seasonsActive = (history.gamesPlayed[2022] > 0 ? 1 : 0) +
    (history.gamesPlayed[2023] > 0 ? 1 : 0) +
    (history.gamesPlayed[2024] > 0 ? 1 : 0);

  // For rookies, adjust the total possible games
  const possibleGames = seasonsActive * GAMES_PER_SEASON;
  const gamesMissed = possibleGames - gamesPlayed;
  const availabilityRate = possibleGames > 0 ? Math.round((gamesPlayed / possibleGames) * 100) : 100;

  // Count injuries by type
  const injuryTypes = new Map<InjuryType, number>();
  for (const injury of history.injuries) {
    const current = injuryTypes.get(injury.type) || 0;
    injuryTypes.set(injury.type, current + 1);
  }

  // Check for recurring issues
  let hasRecurringIssue = false;
  let recurringType: InjuryType | undefined;
  let recurringDescription: string | undefined;

  for (const [type, count] of injuryTypes) {
    if (count >= 2) {
      hasRecurringIssue = true;
      if (SOFT_TISSUE_CONCERN.includes(type)) {
        recurringType = type;
        recurringDescription = 'Chronic soft tissue issues';
      } else if (CONCUSSION_CONCERN.includes(type)) {
        recurringType = type;
        recurringDescription = `${count} concussions - cumulative risk`;
      } else if (type === 'ankle_foot') {
        recurringType = type;
        recurringDescription = 'Recurring ankle/foot problems';
      } else if (type === 'knee_acl' || type === 'knee_other') {
        recurringType = type;
        recurringDescription = 'Multiple knee injuries';
      }
      break;
    }
  }

  // Calculate weighted severity score
  let severityScore = 0;
  for (const injury of history.injuries) {
    const typeWeight = INJURY_TYPE_WEIGHTS[injury.type] || 2;
    const seasonWeight = SEASON_WEIGHTS[injury.season as keyof typeof SEASON_WEIGHTS] || 0.5;
    const majorBonus = injury.isMajor ? 1.5 : 1;
    severityScore += typeWeight * seasonWeight * majorBonus * (injury.gamesMissed / 4);
  }

  // Build risk factors list
  const riskFactors: string[] = [];

  // Concussion risk
  const concussionCount = injuryTypes.get('concussion') || 0;
  if (concussionCount >= 3) {
    riskFactors.push(`SERIOUS: ${concussionCount} concussions - career risk`);
  } else if (concussionCount >= 2) {
    riskFactors.push(`${concussionCount} concussions - monitor closely`);
  }

  // Soft tissue risk
  const softTissueCount = injuryTypes.get('soft_tissue') || 0;
  if (softTissueCount >= 3) {
    riskFactors.push('Chronic soft tissue issues');
  } else if (softTissueCount >= 2) {
    riskFactors.push('Recurring soft tissue concerns');
  }

  // ACL/knee risk
  const aclCount = injuryTypes.get('knee_acl') || 0;
  const kneeOtherCount = injuryTypes.get('knee_other') || 0;
  if (aclCount >= 2) {
    riskFactors.push('Multiple ACL injuries - extreme risk');
  } else if (aclCount === 1 && kneeOtherCount >= 1) {
    riskFactors.push('ACL history + additional knee issues');
  } else if (aclCount === 1) {
    riskFactors.push('ACL history - monitor knee');
  }

  // Ankle risk
  const ankleCount = injuryTypes.get('ankle_foot') || 0;
  if (ankleCount >= 3) {
    riskFactors.push('Chronic ankle/foot issues');
  } else if (ankleCount >= 2) {
    riskFactors.push('Recurring ankle problems');
  }

  // Recovery status from major injury
  let majorInjuryRecovery: DurabilityAnalysis['majorInjuryRecovery'];
  if (history.majorInjuryDate && history.majorInjuryType) {
    const months = monthsSince(history.majorInjuryDate);
    let recoveryStatus: string;
    if (months < 9) {
      recoveryStatus = 'Still recovering - elevated risk';
    } else if (months < 12) {
      recoveryStatus = 'Recent return - monitor workload';
    } else if (months < 18) {
      recoveryStatus = 'Returned successfully - normal risk';
    } else {
      recoveryStatus = 'Fully recovered';
    }
    majorInjuryRecovery = {
      injury: history.majorInjuryType,
      monthsSince: months,
      recoveryStatus,
    };
  }

  // Age + injury combo analysis
  let ageInjuryRisk: DurabilityAnalysis['ageInjuryRisk'];
  if (playerAge) {
    if (playerAge >= 30 && softTissueCount >= 2) {
      ageInjuryRisk = {
        level: 'extreme',
        description: `Age ${playerAge} + soft tissue history = EXTREME RISK`,
      };
    } else if (playerAge >= 28 && softTissueCount >= 1) {
      ageInjuryRisk = {
        level: 'high',
        description: `Age ${playerAge} + soft tissue history = HIGH RISK`,
      };
    } else if (playerAge >= 30 && gamesMissed >= 10) {
      ageInjuryRisk = {
        level: 'high',
        description: `Age ${playerAge} + injury history = HIGH RISK`,
      };
    } else if (playerAge >= 27 && severityScore > 20) {
      ageInjuryRisk = {
        level: 'medium',
        description: `Age ${playerAge} + wear concerns`,
      };
    }
  }

  // Determine durability rating
  let durabilityRating: DurabilityAnalysis['durabilityRating'];
  let durabilityScore: number;

  if (availabilityRate >= 94) {
    durabilityRating = 'iron_man';
    durabilityScore = 30;
  } else if (availabilityRate >= 85) {
    durabilityRating = 'durable';
    durabilityScore = 25;
  } else if (availabilityRate >= 75) {
    durabilityRating = 'moderate';
    durabilityScore = 20;
  } else if (availabilityRate >= 60) {
    durabilityRating = 'injury_prone';
    durabilityScore = 12;
  } else {
    durabilityRating = 'glass';
    durabilityScore = 5;
  }

  // Apply penalties
  if (hasRecurringIssue) {
    durabilityScore = Math.max(5, durabilityScore - 5);
  }
  if (concussionCount >= 3) {
    durabilityScore = Math.max(5, durabilityScore - 8);
  } else if (concussionCount >= 2) {
    durabilityScore = Math.max(5, durabilityScore - 4);
  }
  if (ageInjuryRisk?.level === 'extreme') {
    durabilityScore = Math.max(5, durabilityScore - 8);
  } else if (ageInjuryRisk?.level === 'high') {
    durabilityScore = Math.max(5, durabilityScore - 5);
  }

  // Build display text
  const displayText = buildDisplayText(
    durabilityRating,
    gamesPlayed,
    possibleGames,
    availabilityRate,
    recurringDescription,
    majorInjuryRecovery,
    history.notes
  );

  const shortDisplay = buildShortDisplay(
    durabilityRating,
    gamesPlayed,
    possibleGames,
    availabilityRate
  );

  return {
    gamesPlayed,
    gamesMissed,
    availabilityRate,
    seasonsTracked: seasonsActive,
    durabilityRating,
    durabilityScore,
    injuryTypes,
    hasRecurringIssue,
    recurringType,
    recurringDescription,
    riskFactors,
    severityScore: Math.round(severityScore),
    majorInjuryRecovery,
    ageInjuryRisk,
    displayText,
    shortDisplay,
  };
}

function createUnknownAnalysis(playerName: string): DurabilityAnalysis {
  return {
    gamesPlayed: 0,
    gamesMissed: 0,
    availabilityRate: 0,
    seasonsTracked: 0,
    durabilityRating: 'unknown',
    durabilityScore: 20, // Neutral score for unknown
    injuryTypes: new Map(),
    hasRecurringIssue: false,
    riskFactors: [],
    severityScore: 0,
    displayText: 'No injury data available',
    shortDisplay: 'DURABILITY: Unknown',
  };
}

function buildDisplayText(
  rating: DurabilityAnalysis['durabilityRating'],
  gamesPlayed: number,
  possibleGames: number,
  availabilityRate: number,
  recurringDescription?: string,
  majorInjuryRecovery?: DurabilityAnalysis['majorInjuryRecovery'],
  notes?: string
): string {
  const ratingLabels = {
    iron_man: 'Iron Man',
    durable: 'Durable',
    moderate: 'Moderate concern',
    injury_prone: 'Injury prone',
    glass: 'Glass',
    unknown: 'Unknown',
  };

  let text = `DURABILITY: ${ratingLabels[rating]} - ${gamesPlayed}/${possibleGames} games (${availabilityRate}%)`;

  if (recurringDescription) {
    text += ` - ${recurringDescription}`;
  }

  if (majorInjuryRecovery && majorInjuryRecovery.monthsSince < 18) {
    text += ` | ${majorInjuryRecovery.monthsSince} months post-${majorInjuryRecovery.injury.split(' ')[0]}`;
  }

  return text;
}

function buildShortDisplay(
  rating: DurabilityAnalysis['durabilityRating'],
  gamesPlayed: number,
  possibleGames: number,
  availabilityRate: number
): string {
  const ratingLabels = {
    iron_man: 'Iron Man',
    durable: 'Durable',
    moderate: 'Moderate',
    injury_prone: 'Injury Prone',
    glass: 'Glass',
    unknown: 'Unknown',
  };

  return `${ratingLabels[rating]} (${availabilityRate}%)`;
}

/**
 * Get durability color for UI
 */
export function getDurabilityColor(rating: DurabilityAnalysis['durabilityRating']): string {
  switch (rating) {
    case 'iron_man':
      return 'text-emerald-400 bg-emerald-950/30 border-emerald-500/50';
    case 'durable':
      return 'text-lime-400 bg-lime-950/30 border-lime-500/50';
    case 'moderate':
      return 'text-amber-400 bg-amber-950/30 border-amber-500/50';
    case 'injury_prone':
      return 'text-orange-400 bg-orange-950/30 border-orange-500/50';
    case 'glass':
      return 'text-red-400 bg-red-950/30 border-red-500/50';
    default:
      return 'text-zinc-400 bg-zinc-800/50 border-zinc-600/50';
  }
}
