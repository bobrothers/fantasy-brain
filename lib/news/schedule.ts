/**
 * NFL Schedule Management
 *
 * Fetches and stores weekly NFL schedules from ESPN.
 * Used to determine monitoring windows for game day news checks.
 */

import { getSupabaseServer, isSupabaseConfigured } from '../db/supabase';
import { espn } from '../providers/espn';

interface Game {
  gameId: string;
  homeTeam: string;
  awayTeam: string;
  kickoffTime: Date;
  gameSlot: string;
  venue?: string;
}

// Game slot definitions (all times in ET)
const GAME_SLOTS = {
  TNF: { day: 4, hour: 20, minute: 15 },           // Thursday 8:15pm ET
  early_sunday: { day: 0, hour: 13, minute: 0 },  // Sunday 1pm ET
  late_sunday: { day: 0, hour: 16, minute: 25 },  // Sunday 4:25pm ET
  SNF: { day: 0, hour: 20, minute: 20 },          // Sunday 8:20pm ET
  MNF: { day: 1, hour: 20, minute: 15 },          // Monday 8:15pm ET
  saturday: { day: 6, hour: 13, minute: 0 },      // Saturday (varies)
};

/**
 * Determine the game slot based on kickoff time
 */
function determineGameSlot(kickoffTime: Date): string {
  const etTime = new Date(kickoffTime.toLocaleString('en-US', { timeZone: 'America/New_York' }));
  const day = etTime.getDay();
  const hour = etTime.getHours();

  if (day === 4) return 'TNF'; // Thursday
  if (day === 1) return 'MNF'; // Monday
  if (day === 6) return 'saturday'; // Saturday

  // Sunday games
  if (day === 0) {
    if (hour >= 20) return 'SNF';
    if (hour >= 16) return 'late_sunday';
    return 'early_sunday';
  }

  return 'other';
}

/**
 * Fetch weekly schedule from ESPN and store in database
 */
export async function fetchAndStoreSchedule(season: number, week: number): Promise<number> {
  if (!isSupabaseConfigured()) return 0;

  const supabase = getSupabaseServer();

  try {
    // Fetch from ESPN API
    const response = await fetch(
      `https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?seasontype=2&week=${week}&dates=${season}`
    );

    if (!response.ok) {
      console.error('[Schedule] ESPN API error:', response.status);
      return 0;
    }

    const data = await response.json();
    const events = data.events || [];

    const games: Game[] = events.map((event: Record<string, unknown>) => {
      const competition = (event.competitions as Record<string, unknown>[])?.[0];
      const competitors = competition?.competitors as Array<{ homeAway: string; team: { abbreviation: string } }>;
      const homeTeam = competitors?.find(c => c.homeAway === 'home')?.team?.abbreviation || 'UNK';
      const awayTeam = competitors?.find(c => c.homeAway === 'away')?.team?.abbreviation || 'UNK';
      const kickoffTime = new Date(event.date as string);

      return {
        gameId: event.id as string,
        homeTeam,
        awayTeam,
        kickoffTime,
        gameSlot: determineGameSlot(kickoffTime),
        venue: (competition?.venue as Record<string, unknown>)?.fullName as string,
      };
    });

    // Upsert games
    for (const game of games) {
      await supabase.from('weekly_schedule').upsert({
        season,
        week,
        game_id: game.gameId,
        home_team: game.homeTeam,
        away_team: game.awayTeam,
        kickoff_time: game.kickoffTime.toISOString(),
        game_slot: game.gameSlot,
        venue: game.venue,
        game_status: 'scheduled',
      }, { onConflict: 'season,week,game_id' });
    }

    console.log(`[Schedule] Stored ${games.length} games for week ${week}`);
    return games.length;
  } catch (error) {
    console.error('[Schedule] Error fetching schedule:', error);
    return 0;
  }
}

/**
 * Get upcoming games within a time window
 */
export async function getUpcomingGames(
  withinMinutes: number
): Promise<Array<{
  gameId: string;
  homeTeam: string;
  awayTeam: string;
  kickoffTime: Date;
  gameSlot: string;
  minutesUntilKickoff: number;
}>> {
  if (!isSupabaseConfigured()) return [];

  const supabase = getSupabaseServer();
  const now = new Date();
  const windowEnd = new Date(now.getTime() + withinMinutes * 60 * 1000);

  const { data } = await supabase
    .from('weekly_schedule')
    .select('*')
    .eq('game_status', 'scheduled')
    .gte('kickoff_time', now.toISOString())
    .lte('kickoff_time', windowEnd.toISOString())
    .order('kickoff_time', { ascending: true });

  return (data || []).map(g => ({
    gameId: g.game_id,
    homeTeam: g.home_team,
    awayTeam: g.away_team,
    kickoffTime: new Date(g.kickoff_time),
    gameSlot: g.game_slot,
    minutesUntilKickoff: Math.round((new Date(g.kickoff_time).getTime() - now.getTime()) / 60000),
  }));
}

/**
 * Get teams playing in the next N minutes (for prioritizing news checks)
 */
export async function getTeamsPlayingSoon(withinMinutes: number = 45): Promise<string[]> {
  const upcomingGames = await getUpcomingGames(withinMinutes);
  const teams = new Set<string>();

  for (const game of upcomingGames) {
    teams.add(game.homeTeam);
    teams.add(game.awayTeam);
  }

  return Array.from(teams);
}

/**
 * Check if we're in a game day monitoring window
 */
export async function isInMonitoringWindow(): Promise<{
  shouldMonitor: boolean;
  reason: string;
  gameSlot?: string;
  minutesUntilNextGame?: number;
}> {
  const now = new Date();
  const hour = now.getUTCHours();

  // Base schedule: every 3 hours
  const baseScheduleHours = [0, 3, 6, 9, 12, 15, 18, 21];
  const currentHour = hour;

  // Check if we're at a base schedule time (within 5 minutes)
  const isBaseScheduleTime = baseScheduleHours.includes(currentHour) && now.getUTCMinutes() < 5;

  // Check for upcoming games (30 min pre-game window)
  const upcomingGames = await getUpcomingGames(45);

  if (upcomingGames.length > 0) {
    const nextGame = upcomingGames[0];

    // If game is within 30-45 minutes, trigger pre-game monitoring
    if (nextGame.minutesUntilKickoff <= 45 && nextGame.minutesUntilKickoff >= 25) {
      return {
        shouldMonitor: true,
        reason: `Pre-game monitoring for ${nextGame.gameSlot}`,
        gameSlot: nextGame.gameSlot,
        minutesUntilNextGame: nextGame.minutesUntilKickoff,
      };
    }
  }

  if (isBaseScheduleTime) {
    return {
      shouldMonitor: true,
      reason: 'Base schedule monitoring',
    };
  }

  return {
    shouldMonitor: false,
    reason: 'Not in monitoring window',
    minutesUntilNextGame: upcomingGames[0]?.minutesUntilKickoff,
  };
}

/**
 * Mark a game's pre-game check as done
 */
export async function markPreGameCheckDone(gameId: string): Promise<void> {
  if (!isSupabaseConfigured()) return;

  const supabase = getSupabaseServer();

  await supabase
    .from('weekly_schedule')
    .update({ pre_game_check_done: true })
    .eq('game_id', gameId);
}
