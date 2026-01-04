/**
 * Edge Weight Learning System
 *
 * Analyzes prediction accuracy and adjusts edge weights to improve future predictions.
 * Runs weekly after accuracy calculation.
 *
 * Learning approach:
 * - Track hit rate for each edge type
 * - Compare to baseline (50% random chance)
 * - Increase weights for predictive edges, decrease for non-predictive
 * - Learn position-specific weights (weather might matter more for QBs)
 * - Use exponential smoothing to prevent overreaction to small samples
 */

import {
  getSupabaseServer,
  isSupabaseConfigured,
  PredictionWithOutcome,
} from './supabase';

// Learning configuration
const LEARNING_CONFIG = {
  // How fast weights change (0.1 = 10% adjustment max per week)
  learningRate: 0.1,

  // Minimum predictions before adjusting weights
  minSampleSize: 10,

  // Weight bounds to prevent extreme values
  minWeight: 0.2,
  maxWeight: 3.0,

  // Baseline hit rate (random chance)
  baselineHitRate: 0.5,

  // Decay factor for older data (0.9 = 90% of old weight retained)
  decayFactor: 0.9,

  // Minimum magnitude to count as a "signal" for that edge
  minSignalMagnitude: 1.5,
};

// Hit criteria (same as accuracy.ts)
const HIT_CRITERIA: Record<string, number> = {
  SMASH: 5,
  START: 12,
  FLEX: 24,
  RISKY: 20,
  SIT: 20,
  AVOID: 30,
};

interface EdgePerformance {
  edgeType: string;
  totalPredictions: number;
  correctPredictions: number;
  hitRate: number;
  byPosition: {
    QB: { total: number; correct: number; hitRate: number };
    RB: { total: number; correct: number; hitRate: number };
    WR: { total: number; correct: number; hitRate: number };
    TE: { total: number; correct: number; hitRate: number };
  };
}

interface WeightUpdate {
  edgeType: string;
  oldWeight: number;
  newWeight: number;
  hitRate: number;
  sampleSize: number;
  reason: string;
}

/**
 * Main learning function - analyzes accuracy and updates weights
 */
export async function learnFromAccuracy(
  season: number,
  week: number
): Promise<{ updated: number; updates: WeightUpdate[] }> {
  if (!isSupabaseConfigured()) {
    return { updated: 0, updates: [] };
  }

  const supabase = getSupabaseServer();
  const updates: WeightUpdate[] = [];

  try {
    // 1. Fetch all predictions with outcomes for the season
    const { data: predictions, error } = await supabase
      .from('predictions')
      .select(`
        *,
        outcomes!inner(fantasy_points, position_rank)
      `)
      .eq('season', season);

    if (error || !predictions || predictions.length === 0) {
      console.log('[Learning] No predictions with outcomes to learn from');
      return { updated: 0, updates: [] };
    }

    // 2. Analyze performance by edge type
    const edgePerformance = analyzeEdgePerformance(predictions as PredictionWithOutcome[]);

    // 3. Get current weights
    const { data: currentWeights } = await supabase
      .from('edge_weights')
      .select('*');

    const weightsMap = new Map(
      (currentWeights || []).map((w) => [w.edge_type, w])
    );

    // 4. Calculate and apply weight updates
    for (const perf of edgePerformance) {
      const currentWeight = weightsMap.get(perf.edgeType);
      const oldWeight = currentWeight?.current_weight || 1.0;

      // Skip if not enough data
      if (perf.totalPredictions < LEARNING_CONFIG.minSampleSize) {
        continue;
      }

      // Calculate new weight
      const { newWeight, reason } = calculateNewWeight(
        oldWeight,
        perf.hitRate,
        perf.totalPredictions
      );

      // Skip if no meaningful change
      if (Math.abs(newWeight - oldWeight) < 0.01) {
        continue;
      }

      // Update weight in database
      const updateData = {
        current_weight: newWeight,
        total_predictions: perf.totalPredictions,
        correct_predictions: perf.correctPredictions,
        hit_rate: perf.hitRate,
        qb_weight: calculatePositionWeight(
          currentWeight?.qb_weight || 1.0,
          perf.byPosition.QB
        ),
        rb_weight: calculatePositionWeight(
          currentWeight?.rb_weight || 1.0,
          perf.byPosition.RB
        ),
        wr_weight: calculatePositionWeight(
          currentWeight?.wr_weight || 1.0,
          perf.byPosition.WR
        ),
        te_weight: calculatePositionWeight(
          currentWeight?.te_weight || 1.0,
          perf.byPosition.TE
        ),
        qb_predictions: perf.byPosition.QB.total,
        qb_correct: perf.byPosition.QB.correct,
        rb_predictions: perf.byPosition.RB.total,
        rb_correct: perf.byPosition.RB.correct,
        wr_predictions: perf.byPosition.WR.total,
        wr_correct: perf.byPosition.WR.correct,
        te_predictions: perf.byPosition.TE.total,
        te_correct: perf.byPosition.TE.correct,
        last_updated: new Date().toISOString(),
      };

      await supabase
        .from('edge_weights')
        .upsert(
          { edge_type: perf.edgeType, ...updateData },
          { onConflict: 'edge_type' }
        );

      // Log weight history
      await supabase.from('weight_history').insert({
        edge_type: perf.edgeType,
        season,
        week,
        weight_before: oldWeight,
        weight_after: newWeight,
        hit_rate_this_week: perf.hitRate,
        sample_size: perf.totalPredictions,
        adjustment_reason: reason,
      });

      updates.push({
        edgeType: perf.edgeType,
        oldWeight,
        newWeight,
        hitRate: perf.hitRate,
        sampleSize: perf.totalPredictions,
        reason,
      });
    }

    console.log(`[Learning] Updated ${updates.length} edge weights`);
    return { updated: updates.length, updates };
  } catch (error) {
    console.error('[Learning] Error:', error);
    return { updated: 0, updates: [] };
  }
}

/**
 * Analyze how each edge type performed
 */
function analyzeEdgePerformance(
  predictions: PredictionWithOutcome[]
): EdgePerformance[] {
  const edgeStats: Record<
    string,
    {
      total: number;
      correct: number;
      byPosition: Record<string, { total: number; correct: number }>;
    }
  > = {};

  for (const pred of predictions) {
    const outcome = pred.outcomes;
    const posRank = outcome.position_rank || 999;
    const rec = pred.recommendation;
    const threshold = HIT_CRITERIA[rec] || 12;

    // Determine if prediction was correct
    let isCorrect = false;
    if (['SMASH', 'START', 'FLEX'].includes(rec)) {
      isCorrect = posRank <= threshold;
    } else {
      isCorrect = posRank > threshold;
    }

    // Get edge signals from this prediction
    const signals =
      (pred.edge_signals as { signals?: Array<{ type: string; magnitude: number }> })
        ?.signals || [];

    // Track performance for each significant signal
    for (const signal of signals) {
      if (Math.abs(signal.magnitude) < LEARNING_CONFIG.minSignalMagnitude) {
        continue; // Skip weak signals
      }

      const edgeType = signal.type;
      if (!edgeStats[edgeType]) {
        edgeStats[edgeType] = {
          total: 0,
          correct: 0,
          byPosition: {
            QB: { total: 0, correct: 0 },
            RB: { total: 0, correct: 0 },
            WR: { total: 0, correct: 0 },
            TE: { total: 0, correct: 0 },
          },
        };
      }

      edgeStats[edgeType].total++;
      if (isCorrect) edgeStats[edgeType].correct++;

      // Track by position
      const pos = pred.position as 'QB' | 'RB' | 'WR' | 'TE';
      if (edgeStats[edgeType].byPosition[pos]) {
        edgeStats[edgeType].byPosition[pos].total++;
        if (isCorrect) edgeStats[edgeType].byPosition[pos].correct++;
      }
    }
  }

  // Convert to EdgePerformance array
  return Object.entries(edgeStats).map(([edgeType, stats]) => ({
    edgeType,
    totalPredictions: stats.total,
    correctPredictions: stats.correct,
    hitRate: stats.total > 0 ? (stats.correct / stats.total) * 100 : 50,
    byPosition: {
      QB: {
        ...stats.byPosition.QB,
        hitRate:
          stats.byPosition.QB.total > 0
            ? (stats.byPosition.QB.correct / stats.byPosition.QB.total) * 100
            : 50,
      },
      RB: {
        ...stats.byPosition.RB,
        hitRate:
          stats.byPosition.RB.total > 0
            ? (stats.byPosition.RB.correct / stats.byPosition.RB.total) * 100
            : 50,
      },
      WR: {
        ...stats.byPosition.WR,
        hitRate:
          stats.byPosition.WR.total > 0
            ? (stats.byPosition.WR.correct / stats.byPosition.WR.total) * 100
            : 50,
      },
      TE: {
        ...stats.byPosition.TE,
        hitRate:
          stats.byPosition.TE.total > 0
            ? (stats.byPosition.TE.correct / stats.byPosition.TE.total) * 100
            : 50,
      },
    },
  }));
}

/**
 * Calculate new weight based on hit rate
 */
function calculateNewWeight(
  currentWeight: number,
  hitRate: number,
  sampleSize: number
): { newWeight: number; reason: string } {
  const baseline = LEARNING_CONFIG.baselineHitRate * 100; // 50%

  // How much better/worse than baseline
  const performanceDiff = (hitRate - baseline) / 100; // -0.5 to +0.5

  // Confidence factor based on sample size (more data = more confident)
  const confidenceFactor = Math.min(1, sampleSize / 50);

  // Calculate adjustment
  const adjustment =
    LEARNING_CONFIG.learningRate * performanceDiff * confidenceFactor;

  // Apply decay to current weight (prevents weights from growing unbounded)
  const decayedWeight =
    1 + (currentWeight - 1) * LEARNING_CONFIG.decayFactor;

  // Calculate new weight
  let newWeight = decayedWeight * (1 + adjustment);

  // Clamp to bounds
  newWeight = Math.max(
    LEARNING_CONFIG.minWeight,
    Math.min(LEARNING_CONFIG.maxWeight, newWeight)
  );

  // Round to 2 decimals
  newWeight = Math.round(newWeight * 100) / 100;

  // Generate reason
  let reason: string;
  if (hitRate > baseline + 10) {
    reason = `Strong performer (${hitRate.toFixed(1)}% hit rate) - increasing weight`;
  } else if (hitRate < baseline - 10) {
    reason = `Weak performer (${hitRate.toFixed(1)}% hit rate) - decreasing weight`;
  } else {
    reason = `Average performer (${hitRate.toFixed(1)}% hit rate) - minor adjustment`;
  }

  return { newWeight, reason };
}

/**
 * Calculate position-specific weight
 */
function calculatePositionWeight(
  currentWeight: number,
  positionStats: { total: number; correct: number; hitRate: number }
): number {
  if (positionStats.total < 5) {
    return currentWeight; // Not enough data
  }

  const { newWeight } = calculateNewWeight(
    currentWeight,
    positionStats.hitRate,
    positionStats.total
  );

  return newWeight;
}

/**
 * Get current weight for an edge type (used by edge-detector)
 */
export async function getEdgeWeight(
  edgeType: string,
  position?: string
): Promise<number> {
  if (!isSupabaseConfigured()) {
    return 1.0; // Default weight if no database
  }

  try {
    const supabase = getSupabaseServer();
    const { data } = await supabase
      .from('edge_weights')
      .select('*')
      .eq('edge_type', edgeType)
      .single();

    if (!data) {
      return 1.0;
    }

    // Return position-specific weight if available
    if (position) {
      const posWeight = data[`${position.toLowerCase()}_weight`];
      if (posWeight && posWeight !== 1.0) {
        return posWeight;
      }
    }

    return data.current_weight || 1.0;
  } catch {
    return 1.0;
  }
}

/**
 * Get all current weights (for display)
 */
export async function getAllWeights(): Promise<
  Array<{
    edgeType: string;
    weight: number;
    hitRate: number;
    predictions: number;
    qbWeight: number;
    rbWeight: number;
    wrWeight: number;
    teWeight: number;
  }>
> {
  if (!isSupabaseConfigured()) {
    return [];
  }

  try {
    const supabase = getSupabaseServer();
    const { data } = await supabase
      .from('edge_weights')
      .select('*')
      .order('current_weight', { ascending: false });

    return (data || []).map((w) => ({
      edgeType: w.edge_type,
      weight: w.current_weight || 1.0,
      hitRate: w.hit_rate || 0,
      predictions: w.total_predictions || 0,
      qbWeight: w.qb_weight || 1.0,
      rbWeight: w.rb_weight || 1.0,
      wrWeight: w.wr_weight || 1.0,
      teWeight: w.te_weight || 1.0,
    }));
  } catch {
    return [];
  }
}

/**
 * Get weight history for visualization
 */
export async function getWeightHistory(
  edgeType: string,
  season: number
): Promise<
  Array<{
    week: number;
    weightBefore: number;
    weightAfter: number;
    hitRate: number;
  }>
> {
  if (!isSupabaseConfigured()) {
    return [];
  }

  try {
    const supabase = getSupabaseServer();
    const { data } = await supabase
      .from('weight_history')
      .select('*')
      .eq('edge_type', edgeType)
      .eq('season', season)
      .order('week', { ascending: true });

    return (data || []).map((h) => ({
      week: h.week,
      weightBefore: h.weight_before,
      weightAfter: h.weight_after,
      hitRate: h.hit_rate_this_week,
    }));
  } catch {
    return [];
  }
}
