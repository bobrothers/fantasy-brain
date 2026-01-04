/**
 * Outcome Tracking
 *
 * Fetches actual fantasy points after games complete and stores them
 * for accuracy analysis.
 */

import { getSupabaseServer, isSupabaseConfigured, OutcomeRow } from './supabase';
import { sleeper } from '../providers/sleeper';

// Sleeper API base URL
const SLEEPER_STATS_URL = 'https://api.sleeper.app/v1/stats/nfl/regular';

interface SleeperStats {
  pts_ppr?: number;
  rec_tgt?: number;
  rec?: number;
  rec_yd?: number;
  rec_td?: number;
  rush_att?: number;
  rush_yd?: number;
  rush_td?: number;
  pass_att?: number;
  pass_yd?: number;
  pass_td?: number;
  pass_int?: number;
  fum_lost?: number;
  [key: string]: number | undefined;
}

/**
 * Fetch and store outcomes for a specific week
 */
export async function fetchAndStoreOutcomes(
  week: number,
  season: number
): Promise<{ stored: number; errors: string[] }> {
  if (!isSupabaseConfigured()) {
    return { stored: 0, errors: ['Supabase not configured'] };
  }

  const errors: string[] = [];

  try {
    // Fetch all player stats from Sleeper
    const url = `${SLEEPER_STATS_URL}/${season}/${week}`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Sleeper API error: ${response.status}`);
    }

    const statsData: Record<string, SleeperStats> = await response.json();

    // Get player info for names/positions
    const players = await sleeper.getAllPlayers();

    // Calculate position rankings
    const byPosition: Record<string, { playerId: string; points: number }[]> = {
      QB: [],
      RB: [],
      WR: [],
      TE: [],
    };

    // First pass: collect all fantasy points by position
    for (const [playerId, stats] of Object.entries(statsData)) {
      const points = stats.pts_ppr;
      if (points === undefined || points <= 0) continue;

      const player = players.get(playerId);
      if (!player) continue;

      const position = player.position;
      if (!['QB', 'RB', 'WR', 'TE'].includes(position)) continue;

      byPosition[position].push({ playerId, points });
    }

    // Sort each position by points (descending) to get rankings
    const rankings: Record<string, number> = {};
    for (const position of Object.keys(byPosition)) {
      byPosition[position].sort((a, b) => b.points - a.points);
      byPosition[position].forEach((p, index) => {
        rankings[p.playerId] = index + 1; // 1-indexed rank
      });
    }

    // Build outcome rows
    const outcomes: OutcomeRow[] = [];

    for (const [playerId, stats] of Object.entries(statsData)) {
      const points = stats.pts_ppr;
      if (points === undefined || points <= 0) continue;

      const player = players.get(playerId);
      if (!player) continue;

      const position = player.position;
      if (!['QB', 'RB', 'WR', 'TE'].includes(position)) continue;

      outcomes.push({
        player_id: playerId,
        player_name: player.name,
        position,
        week,
        season,
        fantasy_points: points,
        position_rank: rankings[playerId] || null,
        stats: {
          targets: stats.rec_tgt,
          receptions: stats.rec,
          rec_yards: stats.rec_yd,
          rec_tds: stats.rec_td,
          carries: stats.rush_att,
          rush_yards: stats.rush_yd,
          rush_tds: stats.rush_td,
          pass_attempts: stats.pass_att,
          pass_yards: stats.pass_yd,
          pass_tds: stats.pass_td,
          interceptions: stats.pass_int,
          fumbles_lost: stats.fum_lost,
        },
      });
    }

    if (outcomes.length === 0) {
      return { stored: 0, errors: ['No fantasy points data available for this week'] };
    }

    // Upsert to database in batches (Supabase limit is 1000 per request)
    const supabase = getSupabaseServer();
    const batchSize = 500;
    let stored = 0;

    for (let i = 0; i < outcomes.length; i += batchSize) {
      const batch = outcomes.slice(i, i + batchSize);
      const { error } = await supabase
        .from('outcomes')
        .upsert(batch, {
          onConflict: 'player_id,week,season',
        });

      if (error) {
        errors.push(`Batch ${Math.floor(i / batchSize) + 1} failed: ${error.message}`);
      } else {
        stored += batch.length;
      }
    }

    console.log(`[Outcomes] Stored ${stored} outcomes for week ${week}`);
    return { stored, errors };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    errors.push(message);
    return { stored: 0, errors };
  }
}

/**
 * Get outcomes for a specific week
 */
export async function getOutcomes(
  week: number,
  season: number
): Promise<OutcomeRow[]> {
  if (!isSupabaseConfigured()) {
    return [];
  }

  const supabase = getSupabaseServer();
  const { data, error } = await supabase
    .from('outcomes')
    .select('*')
    .eq('week', week)
    .eq('season', season)
    .order('fantasy_points', { ascending: false });

  if (error) {
    console.error('[Outcomes] Failed to fetch outcomes:', error.message);
    return [];
  }

  return data || [];
}

/**
 * Get outcome for a specific player/week
 */
export async function getPlayerOutcome(
  playerId: string,
  week: number,
  season: number
): Promise<OutcomeRow | null> {
  if (!isSupabaseConfigured()) {
    return null;
  }

  const supabase = getSupabaseServer();
  const { data, error } = await supabase
    .from('outcomes')
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
 * Get all outcomes for a season (for accuracy analysis)
 */
export async function getAllOutcomes(season: number): Promise<OutcomeRow[]> {
  if (!isSupabaseConfigured()) {
    return [];
  }

  const supabase = getSupabaseServer();
  const { data, error } = await supabase
    .from('outcomes')
    .select('*')
    .eq('season', season)
    .order('week', { ascending: true });

  if (error) {
    console.error('[Outcomes] Failed to fetch all outcomes:', error.message);
    return [];
  }

  return data || [];
}

/**
 * Check which weeks have outcomes stored
 */
export async function getStoredWeeks(season: number): Promise<number[]> {
  if (!isSupabaseConfigured()) {
    return [];
  }

  const supabase = getSupabaseServer();
  const { data, error } = await supabase
    .from('outcomes')
    .select('week')
    .eq('season', season)
    .order('week', { ascending: true });

  if (error) {
    return [];
  }

  // Get unique weeks
  const weeks = [...new Set((data || []).map(d => d.week))];
  return weeks;
}
