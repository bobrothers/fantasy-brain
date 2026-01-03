/**
 * Consolidation Analyzer
 *
 * Analyzes trades where multiple pieces are exchanged for fewer pieces.
 * Warns when "3 nickels ≠ 1 dollar" - consolidation premium exists.
 *
 * Key insight: Elite players are worth MORE than their raw score suggests
 * because roster spots are limited and elite production is scarce.
 */

export interface ConsolidationAnalysis {
  type: 'consolidating' | 'dispersing' | 'even';
  warning: string | null;
  premium: number; // Additional value the consolidating side should demand
  recommendation: string;
  breakdown: {
    consolidatingSide: {
      playerCount: number;
      pickCount: number;
      totalAssets: number;
      avgValue: number;
    };
    dispersingSide: {
      playerCount: number;
      pickCount: number;
      totalAssets: number;
      avgValue: number;
    };
  };
}

// Elite tier thresholds
const ELITE_THRESHOLD = 75; // Score above this = elite asset
const STARTER_THRESHOLD = 55; // Score above this = quality starter
const DEPTH_THRESHOLD = 35; // Score above this = depth piece

// Consolidation premium multipliers
// When trading multiple pieces for one stud, the stud is worth MORE
const CONSOLIDATION_PREMIUMS = {
  '2-for-1': 1.15, // 2 players for 1 = 15% premium on the 1
  '3-for-1': 1.25, // 3 players for 1 = 25% premium
  '4-for-1': 1.35, // 4 players for 1 = 35% premium
  '3-for-2': 1.10, // 3 for 2 = 10% premium on the 2
  '4-for-2': 1.15, // 4 for 2 = 15% premium
  '4-for-3': 1.08, // 4 for 3 = 8% premium
};

export function analyzeConsolidation(
  side1PlayerCount: number,
  side1PickCount: number,
  side1TotalValue: number,
  side1PlayerValues: number[],
  side2PlayerCount: number,
  side2PickCount: number,
  side2TotalValue: number,
  side2PlayerValues: number[]
): ConsolidationAnalysis {
  const side1Assets = side1PlayerCount + side1PickCount;
  const side2Assets = side2PlayerCount + side2PickCount;
  const side1Avg = side1Assets > 0 ? side1TotalValue / side1Assets : 0;
  const side2Avg = side2Assets > 0 ? side2TotalValue / side2Assets : 0;

  const breakdown = {
    consolidatingSide: {
      playerCount: 0,
      pickCount: 0,
      totalAssets: 0,
      avgValue: 0,
    },
    dispersingSide: {
      playerCount: 0,
      pickCount: 0,
      totalAssets: 0,
      avgValue: 0,
    },
  };

  // Determine which side is consolidating (fewer assets)
  let type: ConsolidationAnalysis['type'];
  let consolidatingSideValue: number;
  let dispersingSideValue: number;
  let consolidatingSideAssets: number;
  let dispersingSideAssets: number;
  let consolidatingPlayerValues: number[];
  let dispersingPlayerValues: number[];

  if (side1Assets < side2Assets) {
    // Side 1 is consolidating (receiving fewer, better pieces)
    type = 'consolidating';
    consolidatingSideValue = side1TotalValue;
    dispersingSideValue = side2TotalValue;
    consolidatingSideAssets = side1Assets;
    dispersingSideAssets = side2Assets;
    consolidatingPlayerValues = side1PlayerValues;
    dispersingPlayerValues = side2PlayerValues;
    breakdown.consolidatingSide = {
      playerCount: side1PlayerCount,
      pickCount: side1PickCount,
      totalAssets: side1Assets,
      avgValue: side1Avg,
    };
    breakdown.dispersingSide = {
      playerCount: side2PlayerCount,
      pickCount: side2PickCount,
      totalAssets: side2Assets,
      avgValue: side2Avg,
    };
  } else if (side2Assets < side1Assets) {
    // Side 2 is consolidating
    type = 'dispersing'; // From perspective of side 1, they're dispersing
    consolidatingSideValue = side2TotalValue;
    dispersingSideValue = side1TotalValue;
    consolidatingSideAssets = side2Assets;
    dispersingSideAssets = side1Assets;
    consolidatingPlayerValues = side2PlayerValues;
    dispersingPlayerValues = side1PlayerValues;
    breakdown.consolidatingSide = {
      playerCount: side2PlayerCount,
      pickCount: side2PickCount,
      totalAssets: side2Assets,
      avgValue: side2Avg,
    };
    breakdown.dispersingSide = {
      playerCount: side1PlayerCount,
      pickCount: side1PickCount,
      totalAssets: side1Assets,
      avgValue: side1Avg,
    };
  } else {
    // Even number of assets
    type = 'even';
    breakdown.consolidatingSide = {
      playerCount: side1PlayerCount,
      pickCount: side1PickCount,
      totalAssets: side1Assets,
      avgValue: side1Avg,
    };
    breakdown.dispersingSide = {
      playerCount: side2PlayerCount,
      pickCount: side2PickCount,
      totalAssets: side2Assets,
      avgValue: side2Avg,
    };
    return {
      type,
      warning: null,
      premium: 0,
      recommendation: 'Even trade in terms of asset count. Standard valuation applies.',
      breakdown,
    };
  }

  // Calculate consolidation premium
  const assetDiff = dispersingSideAssets - consolidatingSideAssets;
  let premiumKey: string;
  if (consolidatingSideAssets === 1) {
    premiumKey = `${dispersingSideAssets}-for-1`;
  } else if (consolidatingSideAssets === 2) {
    premiumKey = `${dispersingSideAssets}-for-2`;
  } else if (consolidatingSideAssets === 3) {
    premiumKey = `${dispersingSideAssets}-for-3`;
  } else {
    premiumKey = '2-for-1'; // Default
  }

  const premiumMultiplier = CONSOLIDATION_PREMIUMS[premiumKey as keyof typeof CONSOLIDATION_PREMIUMS] || 1.10;
  const premium = Math.round((premiumMultiplier - 1) * 100);

  // Check if the consolidating side has elite talent
  const hasElite = consolidatingPlayerValues.some(v => v >= ELITE_THRESHOLD);
  const dispersingHasElite = dispersingPlayerValues.some(v => v >= ELITE_THRESHOLD);

  // Generate warning and recommendation
  let warning: string | null = null;
  let recommendation: string;

  if (hasElite && !dispersingHasElite) {
    // Trading depth for a stud
    const adjustedConsolidatingValue = consolidatingSideValue * premiumMultiplier;

    if (dispersingSideValue < adjustedConsolidatingValue) {
      const shortfall = Math.round(adjustedConsolidatingValue - dispersingSideValue);
      warning = `CONSOLIDATION PREMIUM: ${dispersingSideAssets} pieces for ${consolidatingSideAssets} stud requires ~${premium}% overpay. You're short ~${shortfall} pts.`;
      recommendation = `"${dispersingSideAssets} nickels ≠ 1 dollar" - Add another asset or accept you're buying elite scarcity.`;
    } else {
      recommendation = `Good consolidation trade. You're paying the premium for elite talent.`;
    }
  } else if (!hasElite && dispersingHasElite) {
    // They're trading a stud for your depth
    warning = `You're DISPERSING elite talent for depth pieces. Make sure you're getting full value + premium.`;
    recommendation = `Demand ${premium}% more value when trading elite players for multiple pieces.`;
  } else if (assetDiff >= 2) {
    // Large asset count difference without clear elite
    warning = `Trading ${dispersingSideAssets} assets for ${consolidatingSideAssets} - consolidation math applies.`;
    recommendation = `Fewer roster spots used = inherent value. Factor in ~${premium}% premium.`;
  } else {
    recommendation = 'Mild consolidation. Standard valuation with small adjustment.';
  }

  return {
    type,
    warning,
    premium,
    recommendation,
    breakdown,
  };
}

export function getConsolidationSummary(analysis: ConsolidationAnalysis): string {
  if (analysis.type === 'even') {
    return 'Even asset count';
  }

  const { consolidatingSide, dispersingSide } = analysis.breakdown;
  return `${dispersingSide.totalAssets} assets → ${consolidatingSide.totalAssets} assets (${analysis.premium}% premium applies)`;
}
