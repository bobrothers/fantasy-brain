/**
 * Draft Pick Value System for Dynasty Trades
 *
 * Converts draft picks to dynasty value scores (0-100 scale)
 * so they can be directly compared to player values.
 *
 * Based on historical draft pick trade values and hit rates:
 * - 1st round picks have ~50% hit rate on startable players
 * - 2nd round picks have ~25% hit rate
 * - 3rd round picks have ~10% hit rate
 * - 4th round picks rarely produce starters
 *
 * Future picks are discounted for uncertainty.
 */

export interface DraftPick {
  year: number;
  round: 1 | 2 | 3 | 4;
  position: 'early' | 'mid' | 'late';
}

export interface PickValue {
  pick: DraftPick;
  dynastyScore: number;
  tier: 'elite' | 'high' | 'mid' | 'low' | 'dart';
  playerEquivalent: string;
  description: string;
}

// Base values for current year picks (2025 season = 2025 rookie draft already happened, so 2026 is "next")
const BASE_PICK_VALUES: Record<string, { score: number; tier: PickValue['tier']; equivalent: string }> = {
  // 1st Round - the money picks
  '1-early': { score: 85, tier: 'elite', equivalent: 'Top-5 dynasty WR/RB' },
  '1-mid': { score: 72, tier: 'high', equivalent: 'Mid WR2/RB2' },
  '1-late': { score: 60, tier: 'mid', equivalent: 'Low-end WR2/Flex RB' },

  // 2nd Round - solid dart throws
  '2-early': { score: 48, tier: 'mid', equivalent: 'WR3/RB3 with upside' },
  '2-mid': { score: 40, tier: 'low', equivalent: 'Flex player' },
  '2-late': { score: 32, tier: 'low', equivalent: 'Bench stash' },

  // 3rd Round - lottery tickets
  '3-early': { score: 25, tier: 'dart', equivalent: 'Deep bench stash' },
  '3-mid': { score: 20, tier: 'dart', equivalent: 'Handcuff-level value' },
  '3-late': { score: 15, tier: 'dart', equivalent: 'Waiver-level prospect' },

  // 4th Round - filler
  '4-early': { score: 12, tier: 'dart', equivalent: 'Camp body with a dream' },
  '4-mid': { score: 8, tier: 'dart', equivalent: 'Roster clogger' },
  '4-late': { score: 5, tier: 'dart', equivalent: 'Practice squad fodder' },
};

// Year multipliers (future picks are worth less due to uncertainty)
const YEAR_MULTIPLIERS: Record<number, number> = {
  2025: 1.0,    // Current year (draft already happened if we're in-season)
  2026: 0.92,   // Next year - slight discount for uncertainty
  2027: 0.82,   // 2 years out - more uncertainty
  2028: 0.70,   // 3 years out - significant uncertainty
  2029: 0.60,   // 4+ years out - major uncertainty
};

/**
 * Get the year multiplier for a pick
 */
function getYearMultiplier(year: number): number {
  const currentYear = new Date().getFullYear();
  const yearsOut = year - currentYear;

  if (yearsOut <= 0) return 1.0; // Current or past year
  if (yearsOut === 1) return 0.92;
  if (yearsOut === 2) return 0.82;
  if (yearsOut === 3) return 0.70;
  return 0.60; // 4+ years out
}

/**
 * Calculate the dynasty value of a draft pick
 */
export function calculatePickValue(pick: DraftPick): PickValue {
  const key = `${pick.round}-${pick.position}`;
  const base = BASE_PICK_VALUES[key];

  if (!base) {
    throw new Error(`Invalid pick: Round ${pick.round}, Position ${pick.position}`);
  }

  const yearMultiplier = getYearMultiplier(pick.year);
  const adjustedScore = Math.round(base.score * yearMultiplier);

  // Adjust tier based on final score
  let tier: PickValue['tier'] = base.tier;
  if (adjustedScore >= 75) tier = 'elite';
  else if (adjustedScore >= 55) tier = 'high';
  else if (adjustedScore >= 35) tier = 'mid';
  else if (adjustedScore >= 20) tier = 'low';
  else tier = 'dart';

  // Build description
  const yearLabel = pick.year === new Date().getFullYear() + 1 ? 'next year' : `${pick.year}`;
  const posLabel = pick.position === 'early' ? 'early' : pick.position === 'late' ? 'late' : 'mid';

  let description = `${pick.year} ${posLabel} ${getOrdinal(pick.round)} round pick`;
  if (yearMultiplier < 1) {
    const discountPct = Math.round((1 - yearMultiplier) * 100);
    description += ` (${discountPct}% future discount)`;
  }

  return {
    pick,
    dynastyScore: adjustedScore,
    tier,
    playerEquivalent: base.equivalent,
    description,
  };
}

/**
 * Format a pick for display
 */
export function formatPick(pick: DraftPick): string {
  const posLabel = pick.position === 'early' ? 'Early' : pick.position === 'late' ? 'Late' : 'Mid';
  return `${pick.year} ${posLabel} ${getOrdinal(pick.round)}`;
}

/**
 * Parse a pick string like "2026 mid 1st" into a DraftPick
 */
export function parsePick(pickStr: string): DraftPick | null {
  const normalized = pickStr.toLowerCase().trim();

  // Extract year (4 digits)
  const yearMatch = normalized.match(/\b(202[4-9]|203[0-9])\b/);
  if (!yearMatch) return null;
  const year = parseInt(yearMatch[1]);

  // Extract round
  let round: 1 | 2 | 3 | 4 = 1;
  if (normalized.includes('1st') || normalized.includes('first') || normalized.includes('1')) round = 1;
  else if (normalized.includes('2nd') || normalized.includes('second') || normalized.includes('2')) round = 2;
  else if (normalized.includes('3rd') || normalized.includes('third') || normalized.includes('3')) round = 3;
  else if (normalized.includes('4th') || normalized.includes('fourth') || normalized.includes('4')) round = 4;
  else return null;

  // Extract position
  let position: 'early' | 'mid' | 'late' = 'mid';
  if (normalized.includes('early') || normalized.includes('top')) position = 'early';
  else if (normalized.includes('late') || normalized.includes('bottom')) position = 'late';

  return { year, round, position };
}

/**
 * Get ordinal suffix
 */
function getOrdinal(n: number): string {
  if (n === 1) return '1st';
  if (n === 2) return '2nd';
  if (n === 3) return '3rd';
  return `${n}th`;
}

/**
 * Get all possible picks for a given year (for UI dropdowns)
 */
export function getPickOptions(year: number): Array<{ pick: DraftPick; label: string; value: PickValue }> {
  const options: Array<{ pick: DraftPick; label: string; value: PickValue }> = [];

  const rounds: Array<1 | 2 | 3 | 4> = [1, 2, 3, 4];
  const positions: Array<'early' | 'mid' | 'late'> = ['early', 'mid', 'late'];

  for (const round of rounds) {
    for (const position of positions) {
      const pick: DraftPick = { year, round, position };
      const value = calculatePickValue(pick);
      options.push({
        pick,
        label: formatPick(pick),
        value,
      });
    }
  }

  return options;
}

/**
 * Compare a pick's value to player tiers
 */
export function getPickPlayerEquivalents(pick: DraftPick): string[] {
  const value = calculatePickValue(pick);
  const score = value.dynastyScore;

  const equivalents: string[] = [];

  if (score >= 80) {
    equivalents.push('≈ Elite dynasty asset (top-5 at position)');
    equivalents.push('Examples: Comparable to young WR1 like Marvin Harrison Jr.');
  } else if (score >= 65) {
    equivalents.push('≈ High-end dynasty starter');
    equivalents.push('Examples: Comparable to established WR2 like Drake London');
  } else if (score >= 50) {
    equivalents.push('≈ Mid-tier dynasty starter');
    equivalents.push('Examples: Comparable to flex-worthy player like Jaylen Waddle');
  } else if (score >= 35) {
    equivalents.push('≈ Depth piece with upside');
    equivalents.push('Examples: Comparable to a young backup like Tank Dell');
  } else if (score >= 20) {
    equivalents.push('≈ Bench stash / lottery ticket');
    equivalents.push('Examples: Comparable to a handcuff RB');
  } else {
    equivalents.push('≈ Roster filler');
    equivalents.push('Best used as trade sweetener, not core asset');
  }

  return equivalents;
}

/**
 * Sum up the total dynasty value of multiple picks
 */
export function sumPickValues(picks: DraftPick[]): number {
  return picks.reduce((sum, pick) => sum + calculatePickValue(pick).dynastyScore, 0);
}

export default {
  calculatePickValue,
  formatPick,
  parsePick,
  getPickOptions,
  getPickPlayerEquivalents,
  sumPickValues,
};
