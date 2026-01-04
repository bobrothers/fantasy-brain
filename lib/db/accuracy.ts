/**
 * Accuracy Calculation
 *
 * Compares predictions to outcomes and calculates hit rates
 * for overall, by edge type, by position, and by confidence level.
 */

import {
  getSupabaseServer,
  getSupabaseBrowser,
  isSupabaseConfigured,
  PredictionRow,
  OutcomeRow,
  EdgeAccuracyRow,
  PredictionWithOutcome,
} from './supabase';

// Hit criteria by recommendation type
const HIT_CRITERIA: Record<string, number> = {
  SMASH: 5,   // Must be top 5 at position
  START: 12,  // Must be top 12 at position
  FLEX: 24,   // Must be top 24 at position
  RISKY: 20,  // Must be outside top 20 to be "correct" (we said it was risky)
  SIT: 20,    // Must be outside top 20 to be "correct"
  AVOID: 30,  // Must be outside top 30 to be "correct"
};

export interface AccuracyReport {
  season: number;
  totalPredictions: number;
  overallHitRate: number;

  // By recommendation type
  byRecommendation: Record<string, {
    total: number;
    correct: number;
    hitRate: number;
  }>;

  // By position
  byPosition: Record<string, {
    total: number;
    correct: number;
    hitRate: number;
  }>;

  // By confidence bucket
  byConfidence: {
    high: { total: number; correct: number; hitRate: number };    // 80+
    medium: { total: number; correct: number; hitRate: number };  // 60-79
    low: { total: number; correct: number; hitRate: number };     // < 60
  };

  // By edge type (which edges are most predictive)
  byEdgeType: Record<string, {
    total: number;
    correct: number;
    hitRate: number;
  }>;

  // Notable examples
  biggestHits: Array<{
    playerName: string;
    week: number;
    edgeScore: number;
    recommendation: string;
    actualPoints: number;
    positionRank: number;
  }>;

  biggestMisses: Array<{
    playerName: string;
    week: number;
    edgeScore: number;
    recommendation: string;
    actualPoints: number;
    positionRank: number;
  }>;

  updatedAt: string;
}

/**
 * Calculate accuracy report for a season
 */
export async function calculateAccuracy(season: number): Promise<AccuracyReport | null> {
  if (!isSupabaseConfigured()) {
    return null;
  }

  const supabase = getSupabaseServer();

  // Fetch predictions with their outcomes
  const { data: predictions, error } = await supabase
    .from('predictions')
    .select(`
      *,
      outcomes!inner(fantasy_points, position_rank)
    `)
    .eq('season', season);

  if (error) {
    console.error('[Accuracy] Failed to fetch predictions:', error.message);
    return null;
  }

  if (!predictions || predictions.length === 0) {
    return {
      season,
      totalPredictions: 0,
      overallHitRate: 0,
      byRecommendation: {},
      byPosition: {},
      byConfidence: {
        high: { total: 0, correct: 0, hitRate: 0 },
        medium: { total: 0, correct: 0, hitRate: 0 },
        low: { total: 0, correct: 0, hitRate: 0 },
      },
      byEdgeType: {},
      biggestHits: [],
      biggestMisses: [],
      updatedAt: new Date().toISOString(),
    };
  }

  // Initialize counters
  const byRecommendation: Record<string, { total: number; correct: number }> = {};
  const byPosition: Record<string, { total: number; correct: number }> = {};
  const byConfidence = {
    high: { total: 0, correct: 0 },
    medium: { total: 0, correct: 0 },
    low: { total: 0, correct: 0 },
  };
  const byEdgeType: Record<string, { total: number; correct: number }> = {};

  let totalCorrect = 0;
  const hits: typeof predictions = [];
  const misses: typeof predictions = [];

  for (const pred of predictions as PredictionWithOutcome[]) {
    const outcome = pred.outcomes;
    const rec = pred.recommendation;
    const posRank = outcome.position_rank || 999;
    const threshold = HIT_CRITERIA[rec] || 12;

    // Determine if prediction was correct
    let isCorrect = false;
    if (['SMASH', 'START', 'FLEX'].includes(rec)) {
      // Positive recommendations: player should rank high
      isCorrect = posRank <= threshold;
    } else {
      // Negative recommendations: player should rank low
      isCorrect = posRank > threshold;
    }

    if (isCorrect) {
      totalCorrect++;
      hits.push(pred);
    } else {
      misses.push(pred);
    }

    // By recommendation
    if (!byRecommendation[rec]) {
      byRecommendation[rec] = { total: 0, correct: 0 };
    }
    byRecommendation[rec].total++;
    if (isCorrect) byRecommendation[rec].correct++;

    // By position
    const pos = pred.position;
    if (!byPosition[pos]) {
      byPosition[pos] = { total: 0, correct: 0 };
    }
    byPosition[pos].total++;
    if (isCorrect) byPosition[pos].correct++;

    // By confidence
    if (pred.confidence >= 80) {
      byConfidence.high.total++;
      if (isCorrect) byConfidence.high.correct++;
    } else if (pred.confidence >= 60) {
      byConfidence.medium.total++;
      if (isCorrect) byConfidence.medium.correct++;
    } else {
      byConfidence.low.total++;
      if (isCorrect) byConfidence.low.correct++;
    }

    // By edge type (analyze individual signals)
    const signals = (pred.edge_signals as { signals?: Array<{ type: string; magnitude: number }> })?.signals || [];
    for (const signal of signals) {
      if (Math.abs(signal.magnitude) >= 2) {
        // Only count significant signals
        const edgeType = signal.type;
        if (!byEdgeType[edgeType]) {
          byEdgeType[edgeType] = { total: 0, correct: 0 };
        }
        byEdgeType[edgeType].total++;
        if (isCorrect) byEdgeType[edgeType].correct++;
      }
    }
  }

  // Calculate hit rates
  const calcHitRate = (c: { total: number; correct: number }) =>
    c.total > 0 ? Math.round((c.correct / c.total) * 1000) / 10 : 0;

  // Sort hits and misses by impact
  hits.sort((a, b) => {
    const aRank = (a as PredictionWithOutcome).outcomes.position_rank || 999;
    const bRank = (b as PredictionWithOutcome).outcomes.position_rank || 999;
    return aRank - bRank; // Best rank first
  });

  misses.sort((a, b) => {
    const aRank = (a as PredictionWithOutcome).outcomes.position_rank || 999;
    const bRank = (b as PredictionWithOutcome).outcomes.position_rank || 999;
    return bRank - aRank; // Worst rank first
  });

  const formatExample = (p: PredictionWithOutcome) => ({
    playerName: p.player_name,
    week: p.week,
    edgeScore: p.edge_score,
    recommendation: p.recommendation,
    actualPoints: p.outcomes.fantasy_points,
    positionRank: p.outcomes.position_rank || 0,
  });

  const report: AccuracyReport = {
    season,
    totalPredictions: predictions.length,
    overallHitRate: calcHitRate({ total: predictions.length, correct: totalCorrect }),
    byRecommendation: Object.fromEntries(
      Object.entries(byRecommendation).map(([k, v]) => [
        k,
        { ...v, hitRate: calcHitRate(v) },
      ])
    ),
    byPosition: Object.fromEntries(
      Object.entries(byPosition).map(([k, v]) => [
        k,
        { ...v, hitRate: calcHitRate(v) },
      ])
    ),
    byConfidence: {
      high: { ...byConfidence.high, hitRate: calcHitRate(byConfidence.high) },
      medium: { ...byConfidence.medium, hitRate: calcHitRate(byConfidence.medium) },
      low: { ...byConfidence.low, hitRate: calcHitRate(byConfidence.low) },
    },
    byEdgeType: Object.fromEntries(
      Object.entries(byEdgeType)
        .map(([k, v]) => [k, { ...v, hitRate: calcHitRate(v) }])
        .sort((a, b) => (b[1] as { hitRate: number }).hitRate - (a[1] as { hitRate: number }).hitRate)
    ),
    biggestHits: hits.slice(0, 5).map(p => formatExample(p as PredictionWithOutcome)),
    biggestMisses: misses.slice(0, 5).map(p => formatExample(p as PredictionWithOutcome)),
    updatedAt: new Date().toISOString(),
  };

  // Cache to edge_accuracy table for quick access
  await cacheEdgeAccuracy(report);

  return report;
}

/**
 * Cache edge accuracy stats for quick retrieval
 */
async function cacheEdgeAccuracy(report: AccuracyReport): Promise<void> {
  if (!isSupabaseConfigured()) return;

  const supabase = getSupabaseServer();

  // Store each edge type's accuracy
  for (const [edgeType, stats] of Object.entries(report.byEdgeType)) {
    const row: Partial<EdgeAccuracyRow> = {
      edge_type: edgeType,
      season: report.season,
      total_predictions: stats.total,
      correct_predictions: stats.correct,
      hit_rate: stats.hitRate,
      qb_hit_rate: report.byPosition.QB?.hitRate || null,
      rb_hit_rate: report.byPosition.RB?.hitRate || null,
      wr_hit_rate: report.byPosition.WR?.hitRate || null,
      te_hit_rate: report.byPosition.TE?.hitRate || null,
      high_conf_total: report.byConfidence.high.total,
      high_conf_correct: report.byConfidence.high.correct,
      med_conf_total: report.byConfidence.medium.total,
      med_conf_correct: report.byConfidence.medium.correct,
      low_conf_total: report.byConfidence.low.total,
      low_conf_correct: report.byConfidence.low.correct,
    };

    await supabase.from('edge_accuracy').upsert(row, {
      onConflict: 'edge_type,season',
    });
  }
}

/**
 * Get cached accuracy report (for public display)
 */
export async function getCachedAccuracy(season: number): Promise<AccuracyReport | null> {
  // For now, recalculate on demand
  // In production, you might cache this in Redis or a separate table
  return calculateAccuracy(season);
}

/**
 * Get quick stats for display (uses browser client)
 */
export async function getQuickStats(season: number): Promise<{
  totalPredictions: number;
  overallHitRate: number;
  topEdges: Array<{ type: string; hitRate: number }>;
} | null> {
  if (!isSupabaseConfigured()) return null;

  try {
    const supabase = getSupabaseBrowser();

    // Get edge accuracy stats
    const { data, error } = await supabase
      .from('edge_accuracy')
      .select('edge_type, total_predictions, hit_rate')
      .eq('season', season)
      .order('hit_rate', { ascending: false })
      .limit(5);

    if (error || !data || data.length === 0) {
      return null;
    }

    const totalPredictions = data.reduce((sum, d) => sum + (d.total_predictions || 0), 0);
    const weightedHitRate = data.reduce((sum, d) =>
      sum + ((d.hit_rate || 0) * (d.total_predictions || 0)), 0
    ) / totalPredictions;

    return {
      totalPredictions,
      overallHitRate: Math.round(weightedHitRate * 10) / 10,
      topEdges: data.map(d => ({
        type: d.edge_type,
        hitRate: d.hit_rate || 0,
      })),
    };
  } catch {
    return null;
  }
}
