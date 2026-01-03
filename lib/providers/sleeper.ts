/**
 * Sleeper API Adapter
 * 
 * Free, read-only API. No auth required.
 * Rate limit: Stay under 1000 calls/minute
 * 
 * Docs: https://docs.sleeper.com/
 */

import type { Player, League, Roster, Matchup } from '@/types';

const BASE_URL = 'https://api.sleeper.app/v1';

// Simple in-memory cache to avoid hammering the API
const cache = new Map<string, { data: unknown; expires: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

async function fetchWithCache<T>(url: string, ttl = CACHE_TTL): Promise<T> {
  const cached = cache.get(url);
  if (cached && cached.expires > Date.now()) {
    return cached.data as T;
  }

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Sleeper API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  cache.set(url, { data, expires: Date.now() + ttl });
  return data as T;
}

// Raw Sleeper types (before normalization)
interface SleeperPlayer {
  player_id: string;
  full_name: string;
  first_name: string;
  last_name: string;
  position: string;
  team: string | null;
  status: string;
  injury_status: string | null;
  age: number;
  years_exp: number;
  college: string;
  fantasy_positions: string[];
}

interface SleeperLeague {
  league_id: string;
  name: string;
  season: string;
  total_rosters: number;
  scoring_settings: Record<string, number>;
  roster_positions: string[];
  status: string;
}

interface SleeperRoster {
  owner_id: string;
  league_id: string;
  players: string[];
  starters: string[];
  reserve: string[] | null;
  roster_id: number;
}

interface SleeperMatchup {
  matchup_id: number;
  roster_id: number;
  points: number;
  players: string[];
  starters: string[];
  starters_points: number[];
}

// Normalization functions
function normalizePlayer(raw: SleeperPlayer): Player {
  const positionMap: Record<string, Player['position']> = {
    QB: 'QB',
    RB: 'RB',
    WR: 'WR',
    TE: 'TE',
    K: 'K',
    DEF: 'DEF',
  };

  const statusMap: Record<string, Player['status']> = {
    Active: 'Active',
    'Injured Reserve': 'Injured Reserve',
    Out: 'Out',
    Questionable: 'Questionable',
    Doubtful: 'Doubtful',
    Inactive: 'Inactive',
  };

  return {
    id: raw.player_id,
    name: raw.full_name || `${raw.first_name} ${raw.last_name}`,
    position: positionMap[raw.position] || 'WR', // fallback
    team: raw.team,
    status: statusMap[raw.status] || 'Active',
    injuryStatus: raw.injury_status || undefined,
    age: raw.age,
    yearsExp: raw.years_exp,
    college: raw.college,
  };
}

function normalizeLeague(raw: SleeperLeague): League {
  const scoring = raw.scoring_settings;
  
  return {
    id: raw.league_id,
    name: raw.name,
    season: raw.season,
    totalRosters: raw.total_rosters,
    rosterPositions: raw.roster_positions,
    status: raw.status as League['status'],
    scoringSettings: {
      passYd: scoring.pass_yd || 0.04,
      passTd: scoring.pass_td || 4,
      passInt: scoring.pass_int || -1,
      pass2pt: scoring.pass_2pt || 2,
      rushYd: scoring.rush_yd || 0.1,
      rushTd: scoring.rush_td || 6,
      rush2pt: scoring.rush_2pt || 2,
      rec: scoring.rec || 0,
      recYd: scoring.rec_yd || 0.1,
      recTd: scoring.rec_td || 6,
      rec2pt: scoring.rec_2pt || 2,
      fumble: scoring.fum_lost || -2,
      fumbleRecTd: scoring.fum_rec_td || 6,
    },
  };
}

function normalizeRoster(raw: SleeperRoster): Roster {
  return {
    odwnerId: raw.owner_id,
    leagueId: raw.league_id,
    players: raw.players || [],
    starters: raw.starters || [],
    reserve: raw.reserve || undefined,
  };
}

function normalizeMatchup(raw: SleeperMatchup): Matchup {
  return {
    matchupId: raw.matchup_id,
    rosterId: raw.roster_id,
    points: raw.points || 0,
    players: raw.players || [],
    starters: raw.starters || [],
    startersPoints: raw.starters_points || [],
  };
}

// Public API
export const sleeper = {
  /**
   * Get all NFL players
   * WARNING: This is a large response (~8MB). Cache aggressively.
   * Sleeper recommends calling once per day max.
   */
  async getAllPlayers(): Promise<Map<string, Player>> {
    const raw = await fetchWithCache<Record<string, SleeperPlayer>>(
      `${BASE_URL}/players/nfl`,
      24 * 60 * 60 * 1000 // 24 hour cache
    );

    const players = new Map<string, Player>();
    for (const [id, player] of Object.entries(raw)) {
      // Only include fantasy-relevant positions
      if (['QB', 'RB', 'WR', 'TE', 'K', 'DEF'].includes(player.position)) {
        players.set(id, normalizePlayer(player));
      }
    }
    return players;
  },

  /**
   * Get a single player by ID
   */
  async getPlayer(playerId: string): Promise<Player | null> {
    const players = await this.getAllPlayers();
    return players.get(playerId) || null;
  },

  /**
   * Get a player by name (case-insensitive)
   */
  async getPlayerByName(name: string): Promise<Player | null> {
    const players = await this.getAllPlayers();
    const nameLower = name.toLowerCase().trim();

    for (const player of players.values()) {
      if (player.name.toLowerCase() === nameLower) {
        return player;
      }
    }

    // Try fuzzy match (contains)
    for (const player of players.values()) {
      if (player.name.toLowerCase().includes(nameLower) ||
          nameLower.includes(player.name.toLowerCase())) {
        return player;
      }
    }

    return null;
  },

  /**
   * Check if player is likely resting (Week 17-18 healthy scratch)
   * Returns true if player appears to be a healthy scratch for playoffs
   */
  isLikelyResting(player: Player, week: number): {
    isResting: boolean;
    reason?: string;
  } {
    // Only check in late season (Week 15+)
    if (week < 15) {
      return { isResting: false };
    }

    const status = player.injuryStatus?.toLowerCase();

    // Explicit rest indicators
    if (status === 'dnr' || status === 'rest' || status === 'nfi-r') {
      return { isResting: true, reason: 'DNP - Resting' };
    }

    // "Out" or "Inactive" with no real injury in late season
    // This is heuristic - in reality we'd need practice report data
    if ((status === 'out' || status === 'inactive') && week >= 17) {
      // Could be resting - flag for user awareness
      return { isResting: true, reason: 'DNP - Possible rest (Week ' + week + ')' };
    }

    return { isResting: false };
  },

  /**
   * Get league info by ID
   */
  async getLeague(leagueId: string): Promise<League> {
    const raw = await fetchWithCache<SleeperLeague>(
      `${BASE_URL}/league/${leagueId}`
    );
    return normalizeLeague(raw);
  },

  /**
   * Get all rosters in a league
   */
  async getRosters(leagueId: string): Promise<Roster[]> {
    const raw = await fetchWithCache<SleeperRoster[]>(
      `${BASE_URL}/league/${leagueId}/rosters`
    );
    return raw.map(normalizeRoster);
  },

  /**
   * Get matchups for a specific week
   */
  async getMatchups(leagueId: string, week: number): Promise<Matchup[]> {
    const raw = await fetchWithCache<SleeperMatchup[]>(
      `${BASE_URL}/league/${leagueId}/matchups/${week}`
    );
    return raw.map(normalizeMatchup);
  },

  /**
   * Get users in a league (for display names)
   */
  async getLeagueUsers(leagueId: string): Promise<Array<{ odwnerId: string; displayName: string; teamName?: string }>> {
    interface SleeperUser {
      user_id: string;
      display_name: string;
      metadata?: { team_name?: string };
    }
    
    const raw = await fetchWithCache<SleeperUser[]>(
      `${BASE_URL}/league/${leagueId}/users`
    );
    
    return raw.map(u => ({
      odwnerId: u.user_id,
      displayName: u.display_name,
      teamName: u.metadata?.team_name,
    }));
  },

  /**
   * Get current NFL state (week, season)
   */
  async getNflState(): Promise<{ season: string; week: number; seasonType: string }> {
    interface SleeperState {
      season: string;
      week: number;
      season_type: string;
      display_week: number;
    }
    
    const raw = await fetchWithCache<SleeperState>(
      `${BASE_URL}/state/nfl`,
      60 * 60 * 1000 // 1 hour cache
    );
    
    return {
      season: raw.season,
      week: raw.display_week || raw.week,
      seasonType: raw.season_type,
    };
  },

  /**
   * Get trending players (adds/drops)
   */
  async getTrendingPlayers(
    type: 'add' | 'drop',
    lookbackHours = 24,
    limit = 25
  ): Promise<Array<{ playerId: string; count: number }>> {
    interface TrendingPlayer {
      player_id: string;
      count: number;
    }
    
    const raw = await fetchWithCache<TrendingPlayer[]>(
      `${BASE_URL}/players/nfl/trending/${type}?lookback_hours=${lookbackHours}&limit=${limit}`,
      30 * 60 * 1000 // 30 min cache
    );
    
    return raw.map(p => ({
      playerId: p.player_id,
      count: p.count,
    }));
  },

  /**
   * Clear the cache (useful for testing or forcing refresh)
   */
  clearCache(): void {
    cache.clear();
  },

  /**
   * Get all injured defensive players for a team
   * Uses the full player database (includes defensive positions)
   */
  async getTeamDefensiveInjuries(teamAbbrev: string): Promise<Array<{
    playerId: string;
    name: string;
    position: string;
    injuryStatus: string;
  }>> {
    // Fetch ALL players (not just fantasy-relevant)
    const raw = await fetchWithCache<Record<string, SleeperPlayer>>(
      `${BASE_URL}/players/nfl`,
      24 * 60 * 60 * 1000 // 24 hour cache
    );
    
    const defensivePositions = new Set([
      'CB', 'S', 'FS', 'SS', 'DB',
      'LB', 'MLB', 'ILB', 'OLB',
      'DE', 'DT', 'NT', 'DL', 'EDGE'
    ]);
    
    const injuredDefenders: Array<{
      playerId: string;
      name: string;
      position: string;
      injuryStatus: string;
    }> = [];
    
    for (const [id, player] of Object.entries(raw)) {
      // Check if player is on the team, is a defender, and has injury status
      if (
        player.team === teamAbbrev &&
        defensivePositions.has(player.position) &&
        player.injury_status &&
        ['Out', 'IR', 'Doubtful', 'Questionable', 'PUP', 'Sus'].includes(player.injury_status)
      ) {
        injuredDefenders.push({
          playerId: id,
          name: player.full_name || `${player.first_name} ${player.last_name}`,
          position: player.position,
          injuryStatus: player.injury_status,
        });
      }
    }
    
    return injuredDefenders;
  },

  /**
   * Get weekly stats for all players for a specific week
   */
  async getWeeklyStats(season: number, week: number): Promise<Map<string, {
    targets?: number;
    receptions?: number;
    recYards?: number;
    carries?: number;
    rushYards?: number;
    team?: string;
  }>> {
    const url = `${BASE_URL}/stats/nfl/regular/${season}/${week}`;
    const raw = await fetchWithCache<Record<string, Record<string, number>>>(url, 60 * 60 * 1000); // 1hr cache

    const stats = new Map<string, {
      targets?: number;
      receptions?: number;
      recYards?: number;
      carries?: number;
      rushYards?: number;
      team?: string;
    }>();

    for (const [playerId, playerStats] of Object.entries(raw)) {
      if (playerStats.rec_tgt || playerStats.rush_att) {
        stats.set(playerId, {
          targets: playerStats.rec_tgt,
          receptions: playerStats.rec,
          recYards: playerStats.rec_yd,
          carries: playerStats.rush_att,
          rushYards: playerStats.rush_yd,
        });
      }
    }

    return stats;
  },

  /**
   * Get usage trend data for a player (last 6 weeks)
   */
  async getUsageTrend(playerName: string, numWeeks: number = 6): Promise<{
    position: string;
    team: string;
    weeks: Array<{
      week: number;
      targetShare?: number;
      carryShare?: number;
      targets?: number;
      carries?: number;
    }>;
    avgTargetShare?: number;
    avgCarryShare?: number;
    targetTrend?: 'up' | 'down' | 'stable';
    carryTrend?: 'up' | 'down' | 'stable';
    trendChange?: number;
  } | null> {
    // Get player info
    const player = await this.getPlayerByName(playerName);
    if (!player || !player.team) return null;

    const position = player.position;
    const team = player.team;
    const playerId = player.id;

    // Get all players to find teammates
    const allPlayers = await this.getAllPlayers();
    const teammates = new Map<string, Player>();
    for (const [id, p] of allPlayers) {
      if (p.team === team) {
        teammates.set(id, p);
      }
    }

    // Determine current week (approximate based on date)
    const now = new Date();
    const seasonStart = new Date(2025, 8, 4); // Sept 4, 2025 (Week 1)
    const daysSinceStart = Math.floor((now.getTime() - seasonStart.getTime()) / (1000 * 60 * 60 * 24));
    const currentWeek = Math.min(18, Math.max(1, Math.floor(daysSinceStart / 7) + 1));

    // Fetch stats for recent weeks
    const weeks: Array<{
      week: number;
      targetShare?: number;
      carryShare?: number;
      targets?: number;
      carries?: number;
    }> = [];

    const targetShares: number[] = [];
    const carryShares: number[] = [];

    const startWeek = Math.max(1, currentWeek - numWeeks + 1);

    for (let week = startWeek; week <= currentWeek; week++) {
      try {
        const weekStats = await this.getWeeklyStats(2025, week);
        const playerWeekStats = weekStats.get(playerId);

        if (!playerWeekStats) continue;

        // Calculate team totals for this week
        let teamTargets = 0;
        let teamCarries = 0;

        for (const [id, p] of teammates) {
          const stats = weekStats.get(id);
          if (stats) {
            teamTargets += stats.targets || 0;
            teamCarries += stats.carries || 0;
          }
        }

        const weekData: typeof weeks[0] = { week };

        if (playerWeekStats.targets && teamTargets > 0) {
          const share = (playerWeekStats.targets / teamTargets) * 100;
          weekData.targetShare = Math.round(share * 10) / 10;
          weekData.targets = playerWeekStats.targets;
          targetShares.push(share);
        }

        if (playerWeekStats.carries && teamCarries > 0) {
          const share = (playerWeekStats.carries / teamCarries) * 100;
          weekData.carryShare = Math.round(share * 10) / 10;
          weekData.carries = playerWeekStats.carries;
          carryShares.push(share);
        }

        if (weekData.targets || weekData.carries) {
          weeks.push(weekData);
        }
      } catch (e) {
        // Week data not available, skip
        continue;
      }
    }

    if (weeks.length < 2) return null;

    // Calculate averages
    const avgTargetShare = targetShares.length > 0
      ? Math.round((targetShares.reduce((a, b) => a + b, 0) / targetShares.length) * 10) / 10
      : undefined;

    const avgCarryShare = carryShares.length > 0
      ? Math.round((carryShares.reduce((a, b) => a + b, 0) / carryShares.length) * 10) / 10
      : undefined;

    // Calculate trends
    let targetTrend: 'up' | 'down' | 'stable' | undefined;
    let carryTrend: 'up' | 'down' | 'stable' | undefined;
    let trendChange: number | undefined;

    if (targetShares.length >= 2) {
      const firstHalf = targetShares.slice(0, Math.floor(targetShares.length / 2));
      const secondHalf = targetShares.slice(Math.floor(targetShares.length / 2));
      const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
      const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;

      if (secondAvg > firstAvg * 1.15) targetTrend = 'up';
      else if (secondAvg < firstAvg * 0.85) targetTrend = 'down';
      else targetTrend = 'stable';

      trendChange = Math.round((secondAvg - firstAvg) * 10) / 10;
    }

    if (carryShares.length >= 2) {
      const firstHalf = carryShares.slice(0, Math.floor(carryShares.length / 2));
      const secondHalf = carryShares.slice(Math.floor(carryShares.length / 2));
      const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
      const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;

      if (secondAvg > firstAvg * 1.15) carryTrend = 'up';
      else if (secondAvg < firstAvg * 0.85) carryTrend = 'down';
      else carryTrend = 'stable';

      if (position === 'RB') {
        trendChange = Math.round((secondAvg - firstAvg) * 10) / 10;
      }
    }

    return {
      position,
      team,
      weeks,
      avgTargetShare,
      avgCarryShare,
      targetTrend,
      carryTrend,
      trendChange,
    };
  },

  /**
   * Get player's rank on team for targets/carries
   */
  async getTeamRank(playerName: string, position: string): Promise<{ rank: number; total: number } | null> {
    const player = await this.getPlayerByName(playerName);
    if (!player || !player.team) return null;

    const team = player.team;
    const playerId = player.id;

    // Get current week
    const now = new Date();
    const seasonStart = new Date(2025, 8, 4);
    const daysSinceStart = Math.floor((now.getTime() - seasonStart.getTime()) / (1000 * 60 * 60 * 24));
    const currentWeek = Math.min(18, Math.max(1, Math.floor(daysSinceStart / 7) + 1));

    // Get all players
    const allPlayers = await this.getAllPlayers();

    // Aggregate stats over last 3 weeks
    const playerUsage = new Map<string, { total: number; games: number; name: string; pos: string }>();

    for (let week = Math.max(1, currentWeek - 2); week <= currentWeek; week++) {
      try {
        const weekStats = await this.getWeeklyStats(2025, week);

        for (const [id, stats] of weekStats) {
          const p = allPlayers.get(id);
          if (!p || p.team !== team) continue;

          // For RBs use carries, for WR/TE use targets
          const usage = position === 'RB' ? (stats.carries || 0) : (stats.targets || 0);
          if (usage === 0) continue;

          // Only compare within position group
          const isReceiver = ['WR', 'TE'].includes(p.position);
          const playerIsReceiver = ['WR', 'TE'].includes(position);
          const isRB = p.position === 'RB';
          const playerIsRB = position === 'RB';

          if ((playerIsReceiver && !isReceiver) || (playerIsRB && !isRB)) continue;

          const current = playerUsage.get(id) || { total: 0, games: 0, name: p.name, pos: p.position };
          playerUsage.set(id, {
            total: current.total + usage,
            games: current.games + 1,
            name: p.name,
            pos: p.position,
          });
        }
      } catch {
        continue;
      }
    }

    // Rank by average usage
    const rankings = Array.from(playerUsage.entries())
      .map(([id, data]) => ({
        id,
        avgUsage: data.total / data.games,
      }))
      .sort((a, b) => b.avgUsage - a.avgUsage);

    const playerRank = rankings.findIndex(r => r.id === playerId);
    if (playerRank === -1) return null;

    return {
      rank: playerRank + 1,
      total: rankings.length,
    };
  },
};

export default sleeper;
