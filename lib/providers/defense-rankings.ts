/**
 * Live Defense Rankings Calculator
 *
 * Calculates fantasy points allowed by each defense vs each position
 * using Sleeper weekly stats + ESPN schedule data.
 *
 * This replaces hardcoded defense rankings with live calculated data.
 */

import { sleeper } from './sleeper';

interface DefenseRankings {
  vsQB: number;
  vsRB: number;
  vsWR: number;
  vsTE: number;
  // Raw points allowed (higher = worse defense)
  ptsAllowedQB: number;
  ptsAllowedRB: number;
  ptsAllowedWR: number;
  ptsAllowedTE: number;
  gamesPlayed: number;
}

interface WeekMatchup {
  homeTeam: string;
  awayTeam: string;
}

// Cache for defense rankings (expensive to calculate)
let rankingsCache: { data: Record<string, DefenseRankings>; expires: number } | null = null;
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

/**
 * Get all matchups for a specific week from ESPN
 */
async function getWeekMatchups(season: number, week: number): Promise<WeekMatchup[]> {
  try {
    const url = `https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?seasontype=2&week=${week}&dates=${season}`;
    const response = await fetch(url);
    if (!response.ok) return [];

    const data = await response.json();
    const matchups: WeekMatchup[] = [];

    for (const event of data.events || []) {
      const comp = event.competitions?.[0];
      if (!comp) continue;

      const home = comp.competitors?.find((c: { homeAway: string }) => c.homeAway === 'home');
      const away = comp.competitors?.find((c: { homeAway: string }) => c.homeAway === 'away');

      if (home?.team?.abbreviation && away?.team?.abbreviation) {
        matchups.push({
          homeTeam: home.team.abbreviation,
          awayTeam: away.team.abbreviation,
        });
      }
    }

    return matchups;
  } catch {
    return [];
  }
}

/**
 * Build a map of team -> opponent for a given week
 */
function buildOpponentMap(matchups: WeekMatchup[]): Map<string, string> {
  const map = new Map<string, string>();

  for (const m of matchups) {
    map.set(m.homeTeam, m.awayTeam);
    map.set(m.awayTeam, m.homeTeam);
  }

  return map;
}

/**
 * Calculate live defense rankings from Sleeper stats + ESPN schedule
 */
export async function calculateDefenseRankings(): Promise<Record<string, DefenseRankings>> {
  // Check cache
  if (rankingsCache && rankingsCache.expires > Date.now()) {
    return rankingsCache.data;
  }

  const nflState = await sleeper.getNflState();
  const season = parseInt(nflState.season);
  const currentWeek = Math.min(nflState.week, 18); // Cap at week 18

  // Initialize accumulators for each team
  const teams = [
    'ARI', 'ATL', 'BAL', 'BUF', 'CAR', 'CHI', 'CIN', 'CLE',
    'DAL', 'DEN', 'DET', 'GB', 'HOU', 'IND', 'JAX', 'KC',
    'LAC', 'LAR', 'LV', 'MIA', 'MIN', 'NE', 'NO', 'NYG',
    'NYJ', 'PHI', 'PIT', 'SEA', 'SF', 'TB', 'TEN', 'WAS',
  ];

  const pointsAllowed: Record<string, { QB: number; RB: number; WR: number; TE: number; games: number }> = {};
  for (const team of teams) {
    pointsAllowed[team] = { QB: 0, RB: 0, WR: 0, TE: 0, games: 0 };
  }

  // Get all players for position mapping
  const allPlayers = await sleeper.getAllPlayers();
  const playerPositions = new Map<string, string>();
  const playerTeams = new Map<string, string>();

  for (const [id, player] of Object.entries(allPlayers)) {
    if (player.position && ['QB', 'RB', 'WR', 'TE'].includes(player.position)) {
      playerPositions.set(id, player.position);
      if (player.team) {
        playerTeams.set(id, player.team);
      }
    }
  }

  // Process each week
  for (let week = 1; week <= currentWeek; week++) {
    try {
      // Get matchups for this week
      const matchups = await getWeekMatchups(season, week);
      if (matchups.length === 0) continue;

      const opponentMap = buildOpponentMap(matchups);

      // Get all player stats for this week (raw from Sleeper API)
      const weekStatsUrl = `https://api.sleeper.app/v1/stats/nfl/regular/${season}/${week}`;
      const weekStatsRes = await fetch(weekStatsUrl);
      if (!weekStatsRes.ok) continue;
      const weekStats: Record<string, { pts_ppr?: number }> = await weekStatsRes.json();
      if (!weekStats) continue;

      // Track which defenses played this week
      const defensesPlayed = new Set<string>();
      for (const m of matchups) {
        defensesPlayed.add(m.homeTeam);
        defensesPlayed.add(m.awayTeam);
      }

      // Attribute points to defenses
      for (const [playerId, stats] of Object.entries(weekStats)) {
        const position = playerPositions.get(playerId);
        const playerTeam = playerTeams.get(playerId);

        if (!position || !playerTeam) continue;

        const opponent = opponentMap.get(playerTeam);
        if (!opponent || !pointsAllowed[opponent]) continue;

        const points = stats.pts_ppr || 0;
        if (points <= 0) continue;

        // Attribute to opponent defense
        if (position === 'QB') pointsAllowed[opponent].QB += points;
        else if (position === 'RB') pointsAllowed[opponent].RB += points;
        else if (position === 'WR') pointsAllowed[opponent].WR += points;
        else if (position === 'TE') pointsAllowed[opponent].TE += points;
      }

      // Count games for defenses that played
      for (const team of defensesPlayed) {
        if (pointsAllowed[team]) {
          pointsAllowed[team].games++;
        }
      }
    } catch (err) {
      console.error(`Error processing week ${week}:`, err);
      continue;
    }
  }

  // Calculate per-game averages and rankings
  const avgPointsAllowed: Array<{ team: string; QB: number; RB: number; WR: number; TE: number; games: number }> = [];

  for (const [team, data] of Object.entries(pointsAllowed)) {
    const games = Math.max(data.games, 1);
    avgPointsAllowed.push({
      team,
      QB: data.QB / games,
      RB: data.RB / games,
      WR: data.WR / games,
      TE: data.TE / games,
      games: data.games,
    });
  }

  // Sort by points allowed (ascending = better defense = lower rank number)
  const rankQB = [...avgPointsAllowed].sort((a, b) => a.QB - b.QB);
  const rankRB = [...avgPointsAllowed].sort((a, b) => a.RB - b.RB);
  const rankWR = [...avgPointsAllowed].sort((a, b) => a.WR - b.WR);
  const rankTE = [...avgPointsAllowed].sort((a, b) => a.TE - b.TE);

  // Build final rankings object
  const rankings: Record<string, DefenseRankings> = {};

  for (const data of avgPointsAllowed) {
    rankings[data.team] = {
      vsQB: rankQB.findIndex(t => t.team === data.team) + 1,
      vsRB: rankRB.findIndex(t => t.team === data.team) + 1,
      vsWR: rankWR.findIndex(t => t.team === data.team) + 1,
      vsTE: rankTE.findIndex(t => t.team === data.team) + 1,
      ptsAllowedQB: Math.round(data.QB * 10) / 10,
      ptsAllowedRB: Math.round(data.RB * 10) / 10,
      ptsAllowedWR: Math.round(data.WR * 10) / 10,
      ptsAllowedTE: Math.round(data.TE * 10) / 10,
      gamesPlayed: data.games,
    };
  }

  // Cache results
  rankingsCache = {
    data: rankings,
    expires: Date.now() + CACHE_TTL,
  };

  return rankings;
}

/**
 * Get defense ranking for a specific team
 */
export async function getDefenseRanking(team: string): Promise<DefenseRankings | null> {
  const rankings = await calculateDefenseRankings();
  return rankings[team] || null;
}

/**
 * Clear the cache (useful for testing)
 */
export function clearDefenseRankingsCache(): void {
  rankingsCache = null;
}

export default {
  calculateDefenseRankings,
  getDefenseRanking,
  clearDefenseRankingsCache,
};
