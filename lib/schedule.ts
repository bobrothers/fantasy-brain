/**
 * Dynamic Schedule Service
 *
 * Fetches real NFL schedule from ESPN API instead of hardcoded matchups.
 * Supports any week/season - no more Week 18 2025 only!
 */

import { espn } from './providers/espn';

interface GameInfo {
  opponent: string;
  isHome: boolean;
  date: string;
  venue?: string;
}

interface ScheduleCache {
  week: number;
  season: number;
  games: Map<string, GameInfo>;
  timestamp: number;
}

let scheduleCache: ScheduleCache | null = null;
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

/**
 * Get the current NFL week and season from ESPN
 */
export async function getCurrentWeek(): Promise<{ week: number; season: number; type: string }> {
  return espn.getCurrentWeek();
}

/**
 * Get the schedule for a specific week
 * Returns a Map of team abbreviation -> opponent info
 */
export async function getSchedule(week?: number): Promise<Map<string, GameInfo>> {
  const current = await espn.getCurrentWeek();
  const targetWeek = week || current.week;
  const targetSeason = current.season;

  // Check cache validity
  if (
    scheduleCache &&
    scheduleCache.week === targetWeek &&
    scheduleCache.season === targetSeason &&
    Date.now() - scheduleCache.timestamp < CACHE_TTL
  ) {
    return scheduleCache.games;
  }

  // Fetch fresh schedule from ESPN
  const games = await espn.getWeekGames(targetSeason, targetWeek);
  const schedule = new Map<string, GameInfo>();

  for (const game of games) {
    // Home team entry
    schedule.set(game.homeTeam, {
      opponent: game.awayTeam,
      isHome: true,
      date: game.date,
      venue: game.venue,
    });

    // Away team entry
    schedule.set(game.awayTeam, {
      opponent: game.homeTeam,
      isHome: false,
      date: game.date,
      venue: game.venue,
    });
  }

  // Update cache
  scheduleCache = {
    week: targetWeek,
    season: targetSeason,
    games: schedule,
    timestamp: Date.now(),
  };

  return schedule;
}

/**
 * Get matchup string for display (e.g., "@ NYG" or "vs DAL")
 */
export async function getMatchupString(team: string, week?: number): Promise<string> {
  const schedule = await getSchedule(week);
  const game = schedule.get(team);

  if (!game) return 'BYE';

  return game.isHome ? `vs ${game.opponent}` : `@ ${game.opponent}`;
}

/**
 * Check if a game is primetime (SNF, MNF, TNF)
 * Based on kickoff time from ESPN
 */
export async function isPrimetimeGame(team: string, week?: number): Promise<{
  isPrimetime: boolean;
  slot?: 'SNF' | 'MNF' | 'TNF' | 'SAT';
}> {
  const schedule = await getSchedule(week);
  const game = schedule.get(team);

  if (!game) return { isPrimetime: false };

  const gameDate = new Date(game.date);
  const dayOfWeek = gameDate.getDay(); // 0 = Sunday, 1 = Monday, etc.
  const hour = gameDate.getUTCHours();

  // Thursday Night Football (Thursday, evening)
  if (dayOfWeek === 4 && hour >= 0) {
    return { isPrimetime: true, slot: 'TNF' };
  }

  // Sunday Night Football (Sunday, late evening - typically 8:20 PM ET = 1:20 AM UTC next day or 0:20 UTC)
  if (dayOfWeek === 0 && hour >= 0 && hour <= 2) {
    return { isPrimetime: true, slot: 'SNF' };
  }

  // Monday Night Football (Monday evening)
  if (dayOfWeek === 1 && hour >= 0 && hour <= 4) {
    return { isPrimetime: true, slot: 'MNF' };
  }

  // Saturday games (late season / playoffs)
  if (dayOfWeek === 6) {
    return { isPrimetime: true, slot: 'SAT' };
  }

  return { isPrimetime: false };
}

/**
 * Get teams on bye for a given week
 */
export async function getByeTeams(week?: number): Promise<string[]> {
  const schedule = await getSchedule(week);

  const allTeams = [
    'ARI', 'ATL', 'BAL', 'BUF', 'CAR', 'CHI', 'CIN', 'CLE',
    'DAL', 'DEN', 'DET', 'GB', 'HOU', 'IND', 'JAX', 'KC',
    'LAC', 'LAR', 'LV', 'MIA', 'MIN', 'NE', 'NO', 'NYG',
    'NYJ', 'PHI', 'PIT', 'SEA', 'SF', 'TB', 'TEN', 'WAS',
  ];

  return allTeams.filter(team => !schedule.has(team));
}

/**
 * Clear schedule cache (useful for testing or forced refresh)
 */
export function clearScheduleCache(): void {
  scheduleCache = null;
}

export default {
  getCurrentWeek,
  getSchedule,
  getMatchupString,
  isPrimetimeGame,
  getByeTeams,
  clearScheduleCache,
};
