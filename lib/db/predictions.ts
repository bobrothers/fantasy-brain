/**
 * Prediction Logging
 *
 * Stores player analysis predictions before games for accuracy tracking.
 * Only logs predictions for games that haven't started yet.
 */

import { getSupabaseServer, isSupabaseConfigured, PredictionRow } from './supabase';
import { espn } from '../providers/espn';
import { getSchedule, getCurrentWeek } from '../schedule';
import type { Player, EdgeSignal } from '../../types';

// EdgeAnalysis type (matches edge-detector.ts)
interface EdgeAnalysis {
  player: Player;
  week: number;
  signals: EdgeSignal[];
  summary: Record<string, string>;
  overallImpact: number;
  recommendation: string;
  confidence: number;
}

/**
 * Log a prediction to the database
 * Only logs if:
 * 1. Supabase is configured
 * 2. Game hasn't started yet
 */
export async function logPrediction(analysis: EdgeAnalysis): Promise<boolean> {
  console.log('[Predictions] Starting logPrediction for:', analysis.player?.name);

  // Skip if Supabase isn't configured
  if (!isSupabaseConfigured()) {
    console.log('[Predictions] Supabase not configured, skipping prediction logging');
    console.log('[Predictions] ENV check - URL:', !!process.env.NEXT_PUBLIC_SUPABASE_URL, 'ANON:', !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
    return false;
  }

  console.log('[Predictions] Supabase is configured, proceeding...');

  try {
    const { player, week, signals, summary, overallImpact, recommendation, confidence } = analysis;

    // Get current season
    const currentState = await getCurrentWeek();
    const season = currentState.season;

    // Get game time to check if game has started
    const schedule = await getSchedule(week);
    const gameInfo = schedule.get(player.team || '');

    // Get game time from ESPN
    let gameTime: Date | null = null;
    try {
      const games = await espn.getWeekGames(season, week);
      const game = games.find(
        g => g.homeTeam === player.team || g.awayTeam === player.team
      );
      if (game?.date) {
        gameTime = new Date(game.date);
      }
    } catch (e) {
      console.log('[Predictions] Could not get game time, proceeding anyway');
    }

    // Skip if game has already started
    console.log('[Predictions] Game time check:', gameTime, 'Now:', new Date(), 'Started?', gameTime && new Date() > gameTime);
    if (gameTime && new Date() > gameTime) {
      console.log(`[Predictions] Game already started for ${player.name}, skipping`);
      return false;
    }
    console.log('[Predictions] Game has not started, proceeding to log...');

    // Build prediction row
    const predictionRow: PredictionRow = {
      player_id: player.id,
      player_name: player.name,
      position: player.position,
      team: player.team,
      week,
      season,
      edge_score: overallImpact,
      confidence,
      recommendation: categorizeRecommendation(overallImpact, confidence),
      edge_signals: {
        signals: signals.map(s => ({
          type: s.type,
          impact: s.impact,
          magnitude: s.magnitude,
          confidence: s.confidence,
          shortDescription: s.shortDescription,
        })),
        summary,
      },
      game_time: gameTime?.toISOString() || null,
      opponent: gameInfo?.opponent || null,
      is_home: gameInfo?.isHome ?? null,
    };

    // Upsert to database
    console.log('[Predictions] About to upsert:', predictionRow.player_name, predictionRow.week, predictionRow.season);
    const supabase = getSupabaseServer();
    const { error } = await supabase
      .from('predictions')
      .upsert(predictionRow, {
        onConflict: 'player_id,week,season',
      });

    if (error) {
      console.error('[Predictions] Failed to log prediction:', error.message);
      return false;
    }

    console.log(`[Predictions] Logged prediction for ${player.name} week ${week}`);
    return true;
  } catch (error) {
    console.error('[Predictions] Error logging prediction:', error);
    return false;
  }
}

/**
 * Categorize the recommendation into standard buckets
 */
function categorizeRecommendation(edgeScore: number, confidence: number): string {
  // High confidence boosts the recommendation
  const effectiveScore = edgeScore * (confidence / 80);

  if (effectiveScore >= 5) return 'SMASH';
  if (effectiveScore >= 3) return 'START';
  if (effectiveScore >= 0) return 'FLEX';
  if (effectiveScore >= -3) return 'RISKY';
  if (effectiveScore >= -5) return 'SIT';
  return 'AVOID';
}

/**
 * Get predictions for a specific week
 */
export async function getPredictions(
  week: number,
  season: number
): Promise<PredictionRow[]> {
  if (!isSupabaseConfigured()) {
    return [];
  }

  const supabase = getSupabaseServer();
  const { data, error } = await supabase
    .from('predictions')
    .select('*')
    .eq('week', week)
    .eq('season', season)
    .order('edge_score', { ascending: false });

  if (error) {
    console.error('[Predictions] Failed to fetch predictions:', error.message);
    return [];
  }

  return data || [];
}

/**
 * Get prediction for a specific player/week
 */
export async function getPlayerPrediction(
  playerId: string,
  week: number,
  season: number
): Promise<PredictionRow | null> {
  if (!isSupabaseConfigured()) {
    return null;
  }

  const supabase = getSupabaseServer();
  const { data, error } = await supabase
    .from('predictions')
    .select('*')
    .eq('player_id', playerId)
    .eq('week', week)
    .eq('season', season)
    .single();

  if (error) {
    return null;
  }

  return data;
}

/**
 * Get all predictions for accuracy analysis
 */
export async function getAllPredictions(season: number): Promise<PredictionRow[]> {
  if (!isSupabaseConfigured()) {
    return [];
  }

  const supabase = getSupabaseServer();
  const { data, error } = await supabase
    .from('predictions')
    .select('*')
    .eq('season', season)
    .order('week', { ascending: true });

  if (error) {
    console.error('[Predictions] Failed to fetch all predictions:', error.message);
    return [];
  }

  return data || [];
}
