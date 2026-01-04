/**
 * Deep Analysis System
 *
 * Analyzes predictions vs outcomes to understand why we missed.
 * Detects patterns across predictions to identify systematic issues.
 */

import { getSupabaseServer, isSupabaseConfigured, PredictionWithOutcome } from './supabase';

// Hit criteria (same as accuracy.ts)
const HIT_CRITERIA: Record<string, number> = {
  SMASH: 5,
  START: 12,
  FLEX: 24,
  RISKY: 20,
  SIT: 20,
  AVOID: 30,
};

// Miss severity thresholds
const SEVERITY = {
  BAD_MISS: 20, // Predicted top-12, finished 32+
  MAJOR_MISS: 12, // Predicted top-12, finished 24+
  MINOR_MISS: 6, // Off by 6+ spots
  HIT: 0,
  SMASH_HIT: -5, // Exceeded expectations by 5+ spots
};

interface EdgeSignal {
  type: string;
  magnitude: number;
  confidence: number;
  description?: string;
}

interface PredictionAnalysis {
  predictionId: string;
  wasHit: boolean;
  severity: string;
  predictedRank: number;
  actualRank: number;
  rankDiff: number;
  edgeSignalsUsed: EdgeSignal[];
  strongestSignal: string;
  weakestSignal: string;
  contributingFactors: string[];
}

interface PatternStats {
  patternType: string;
  patternKey: string;
  totalPredictions: number;
  correctPredictions: number;
  hitRate: number;
  samplePredictions: string[];
  severity: string;
  patternDescription: string;
}

/**
 * Analyze all predictions with outcomes for a given week
 */
export async function analyzeWeekPredictions(
  season: number,
  week: number
): Promise<{ analyzed: number; patterns: number }> {
  if (!isSupabaseConfigured()) {
    return { analyzed: 0, patterns: 0 };
  }

  const supabase = getSupabaseServer();

  // Get predictions with outcomes that haven't been analyzed yet
  const { data: predictions, error } = await supabase
    .from('predictions')
    .select(`
      *,
      outcomes!inner(fantasy_points, position_rank, stats)
    `)
    .eq('season', season)
    .eq('week', week);

  if (error || !predictions || predictions.length === 0) {
    console.log('[Analysis] No predictions to analyze');
    return { analyzed: 0, patterns: 0 };
  }

  // Check which predictions haven't been analyzed
  const { data: existingAnalyses } = await supabase
    .from('prediction_analysis')
    .select('prediction_id')
    .in('prediction_id', predictions.map(p => p.id));

  const analyzedIds = new Set((existingAnalyses || []).map(a => a.prediction_id));
  const toAnalyze = predictions.filter(p => !analyzedIds.has(p.id));

  console.log(`[Analysis] Analyzing ${toAnalyze.length} new predictions`);

  // Analyze each prediction
  const analyses: PredictionAnalysis[] = [];
  for (const pred of toAnalyze) {
    const analysis = analyzePrediction(pred as PredictionWithOutcome);
    analyses.push(analysis);

    // Store analysis
    await supabase.from('prediction_analysis').insert({
      prediction_id: pred.id,
      was_hit: analysis.wasHit,
      severity: analysis.severity,
      predicted_rank: analysis.predictedRank,
      actual_rank: analysis.actualRank,
      rank_diff: analysis.rankDiff,
      edge_signals_used: analysis.edgeSignalsUsed,
      strongest_signal: analysis.strongestSignal,
      weakest_signal: analysis.weakestSignal,
      contributing_factors: analysis.contributingFactors,
    });
  }

  // Detect patterns across all predictions for the season
  const patternsDetected = await detectPatterns(season);

  return { analyzed: analyses.length, patterns: patternsDetected };
}

/**
 * Analyze a single prediction vs its outcome
 */
function analyzePrediction(pred: PredictionWithOutcome): PredictionAnalysis {
  const outcome = pred.outcomes;
  const actualRank = outcome.position_rank || 999;
  const rec = pred.recommendation;

  // Calculate expected rank based on recommendation
  const predictedRank = HIT_CRITERIA[rec] || 12;

  // Determine if hit
  let wasHit = false;
  if (['SMASH', 'START', 'FLEX'].includes(rec)) {
    wasHit = actualRank <= HIT_CRITERIA[rec];
  } else {
    wasHit = actualRank > HIT_CRITERIA[rec];
  }

  // Calculate rank difference (positive = worse than expected)
  const rankDiff = actualRank - predictedRank;

  // Determine severity
  let severity = 'hit';
  if (!wasHit) {
    if (rankDiff >= SEVERITY.BAD_MISS) {
      severity = 'bad_miss';
    } else if (rankDiff >= SEVERITY.MAJOR_MISS) {
      severity = 'major_miss';
    } else if (rankDiff >= SEVERITY.MINOR_MISS) {
      severity = 'minor_miss';
    }
  } else if (rankDiff <= SEVERITY.SMASH_HIT) {
    severity = 'smash_hit';
  }

  // Extract edge signals
  const signals = (pred.edge_signals as { signals?: EdgeSignal[] })?.signals || [];

  // Find strongest and weakest signals
  let strongestSignal = 'none';
  let weakestSignal = 'none';
  let maxMag = 0;
  let minMag = Infinity;

  for (const signal of signals) {
    const absMag = Math.abs(signal.magnitude);
    if (absMag > maxMag) {
      maxMag = absMag;
      strongestSignal = signal.type;
    }
    if (absMag < minMag && absMag > 0) {
      minMag = absMag;
      weakestSignal = signal.type;
    }
  }

  // Identify contributing factors for misses
  const contributingFactors: string[] = [];
  if (!wasHit) {
    // Check if edge score was wrong direction
    if (pred.edge_score > 0 && actualRank > 20) {
      contributingFactors.push('positive_edge_negative_outcome');
    }
    if (pred.edge_score < 0 && actualRank < 10) {
      contributingFactors.push('negative_edge_positive_outcome');
    }

    // Check confidence vs outcome
    if (pred.confidence >= 80 && rankDiff > 12) {
      contributingFactors.push('high_confidence_bad_miss');
    }

    // Position-specific factors
    if (pred.position === 'QB' && actualRank > 20) {
      contributingFactors.push('qb_bust');
    }
  }

  return {
    predictionId: pred.id || '',
    wasHit,
    severity,
    predictedRank,
    actualRank,
    rankDiff,
    edgeSignalsUsed: signals,
    strongestSignal,
    weakestSignal,
    contributingFactors,
  };
}

/**
 * Detect patterns across all predictions for a season
 */
async function detectPatterns(season: number): Promise<number> {
  if (!isSupabaseConfigured()) return 0;

  const supabase = getSupabaseServer();

  // Get all analyzed predictions
  const { data: analyses } = await supabase
    .from('prediction_analysis')
    .select(`
      *,
      predictions!inner(
        id, player_name, player_id, position, team, week,
        recommendation, edge_score, confidence, edge_signals
      )
    `)
    .eq('predictions.season', season);

  if (!analyses || analyses.length < 10) {
    console.log('[Analysis] Not enough data for pattern detection');
    return 0;
  }

  const patterns: PatternStats[] = [];

  // Pattern 1: By Team
  const byTeam = groupBy(analyses, a => a.predictions.team);
  for (const [team, teamAnalyses] of Object.entries(byTeam)) {
    if (teamAnalyses.length >= 3) {
      const stats = calculatePatternStats(
        'team',
        team,
        teamAnalyses,
        `${team} player predictions`
      );
      if (stats.severity !== 'good') {
        patterns.push(stats);
      }
    }
  }

  // Pattern 2: By Position
  const byPosition = groupBy(analyses, a => a.predictions.position);
  for (const [position, posAnalyses] of Object.entries(byPosition)) {
    if (posAnalyses.length >= 5) {
      const stats = calculatePatternStats(
        'position',
        position,
        posAnalyses,
        `${position} predictions`
      );
      if (stats.severity !== 'good') {
        patterns.push(stats);
      }
    }
  }

  // Pattern 3: By Edge Type (strongest signal)
  const byEdgeType = groupBy(analyses, a => a.strongest_signal);
  for (const [edgeType, edgeAnalyses] of Object.entries(byEdgeType)) {
    if (edgeType && edgeType !== 'none' && edgeAnalyses.length >= 5) {
      const stats = calculatePatternStats(
        'edge_type',
        edgeType,
        edgeAnalyses,
        `Predictions led by ${edgeType.replace(/_/g, ' ')} edge`
      );
      if (stats.severity !== 'good') {
        patterns.push(stats);
      }
    }
  }

  // Pattern 4: By Recommendation
  const byRec = groupBy(analyses, a => a.predictions.recommendation);
  for (const [rec, recAnalyses] of Object.entries(byRec)) {
    if (recAnalyses.length >= 5) {
      const stats = calculatePatternStats(
        'recommendation',
        rec,
        recAnalyses,
        `${rec} recommendations`
      );
      if (stats.severity !== 'good') {
        patterns.push(stats);
      }
    }
  }

  // Pattern 5: By Confidence Level
  const byConfidence = groupBy(analyses, a => {
    const conf = a.predictions.confidence;
    if (conf >= 80) return 'high';
    if (conf >= 60) return 'medium';
    return 'low';
  });
  for (const [level, confAnalyses] of Object.entries(byConfidence)) {
    if (confAnalyses.length >= 5) {
      const stats = calculatePatternStats(
        'confidence_level',
        level,
        confAnalyses,
        `${level} confidence predictions`
      );
      if (stats.severity !== 'good') {
        patterns.push(stats);
      }
    }
  }

  // Pattern 6: Bad Misses Only (where we really blew it)
  const badMisses = analyses.filter(a => a.severity === 'bad_miss' || a.severity === 'major_miss');
  if (badMisses.length >= 3) {
    // Group bad misses by their contributing factors
    const factorCounts: Record<string, number> = {};
    for (const miss of badMisses) {
      for (const factor of (miss.contributing_factors || [])) {
        factorCounts[factor] = (factorCounts[factor] || 0) + 1;
      }
    }

    // Create patterns for common contributing factors
    for (const [factor, count] of Object.entries(factorCounts)) {
      if (count >= 2) {
        patterns.push({
          patternType: 'contributing_factor',
          patternKey: factor,
          totalPredictions: count,
          correctPredictions: 0,
          hitRate: 0,
          samplePredictions: badMisses
            .filter(m => (m.contributing_factors || []).includes(factor))
            .slice(0, 10)
            .map(m => m.prediction_id),
          severity: 'critical',
          patternDescription: `${count} bad misses with factor: ${factor.replace(/_/g, ' ')}`,
        });
      }
    }
  }

  // Store/update patterns
  let patternsStored = 0;
  for (const pattern of patterns) {
    await supabase.from('detected_patterns').upsert({
      pattern_type: pattern.patternType,
      pattern_key: pattern.patternKey,
      total_predictions: pattern.totalPredictions,
      correct_predictions: pattern.correctPredictions,
      hit_rate: pattern.hitRate,
      sample_predictions: pattern.samplePredictions,
      severity: pattern.severity,
      pattern_description: pattern.patternDescription,
      last_updated_at: new Date().toISOString(),
    }, { onConflict: 'pattern_type,pattern_key' });
    patternsStored++;
  }

  console.log(`[Analysis] Detected ${patternsStored} patterns`);
  return patternsStored;
}

/**
 * Helper: Group array by key function
 */
function groupBy<T>(arr: T[], keyFn: (item: T) => string): Record<string, T[]> {
  const result: Record<string, T[]> = {};
  for (const item of arr) {
    const key = keyFn(item);
    if (!result[key]) result[key] = [];
    result[key].push(item);
  }
  return result;
}

/**
 * Calculate pattern statistics
 */
function calculatePatternStats(
  patternType: string,
  patternKey: string,
  analyses: Array<{ was_hit: boolean; prediction_id: string; predictions: { id: string } }>,
  description: string
): PatternStats {
  const total = analyses.length;
  const correct = analyses.filter(a => a.was_hit).length;
  const hitRate = Math.round((correct / total) * 100);

  // Determine severity
  let severity = 'good';
  if (hitRate < 40) {
    severity = 'critical';
  } else if (hitRate < 50) {
    severity = 'concerning';
  } else if (hitRate < 55) {
    severity = 'notable';
  }

  return {
    patternType,
    patternKey,
    totalPredictions: total,
    correctPredictions: correct,
    hitRate,
    samplePredictions: analyses.slice(0, 10).map(a => a.predictions.id),
    severity,
    patternDescription: description,
  };
}

/**
 * Get patterns for the improvement agent to analyze
 */
export async function getPatternsForAnalysis(): Promise<PatternStats[]> {
  if (!isSupabaseConfigured()) return [];

  const supabase = getSupabaseServer();

  const { data } = await supabase
    .from('detected_patterns')
    .select('*')
    .in('severity', ['critical', 'concerning'])
    .eq('addressed', false)
    .order('hit_rate', { ascending: true });

  return (data || []).map(p => ({
    patternType: p.pattern_type,
    patternKey: p.pattern_key,
    totalPredictions: p.total_predictions,
    correctPredictions: p.correct_predictions,
    hitRate: p.hit_rate,
    samplePredictions: p.sample_predictions || [],
    severity: p.severity,
    patternDescription: p.pattern_description,
  }));
}

/**
 * Get bad misses for detailed analysis
 */
export async function getBadMisses(
  season: number,
  limit = 20
): Promise<Array<{
  prediction: PredictionWithOutcome;
  analysis: PredictionAnalysis;
}>> {
  if (!isSupabaseConfigured()) return [];

  const supabase = getSupabaseServer();

  const { data } = await supabase
    .from('prediction_analysis')
    .select(`
      *,
      predictions!inner(
        *,
        outcomes!inner(fantasy_points, position_rank, stats)
      )
    `)
    .eq('predictions.season', season)
    .in('severity', ['bad_miss', 'major_miss'])
    .order('rank_diff', { ascending: false })
    .limit(limit);

  return (data || []).map(d => ({
    prediction: d.predictions as PredictionWithOutcome,
    analysis: {
      predictionId: d.prediction_id,
      wasHit: d.was_hit,
      severity: d.severity,
      predictedRank: d.predicted_rank,
      actualRank: d.actual_rank,
      rankDiff: d.rank_diff,
      edgeSignalsUsed: d.edge_signals_used || [],
      strongestSignal: d.strongest_signal,
      weakestSignal: d.weakest_signal,
      contributingFactors: d.contributing_factors || [],
    },
  }));
}
