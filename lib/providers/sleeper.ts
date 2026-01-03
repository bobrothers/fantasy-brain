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
   * Get hot/cold streak for a player (last 4 weeks PPG vs season average)
   * Returns live data from Sleeper API - no hardcoding
   */
  async getHotColdStreak(playerName: string): Promise<{
    last4PPG: number;
    seasonPPG: number;
    trend: 'hot' | 'warm' | 'neutral' | 'cold' | 'ice';
    weeklyPoints: Array<{ week: number; points: number }>;
    gamesPlayed: number;
  } | null> {
    const player = await this.getPlayerByName(playerName);
    if (!player) return null;

    const playerId = player.id;
    const nflState = await this.getNflState();
    const season = parseInt(nflState.season);
    const currentWeek = nflState.week;

    // Collect all weekly points
    const weeklyPoints: Array<{ week: number; points: number }> = [];

    for (let week = 1; week <= currentWeek; week++) {
      try {
        const url = `${BASE_URL}/stats/nfl/regular/${season}/${week}`;
        const cached = cache.get(url);
        let weekStats: Record<string, Record<string, number>>;

        if (cached && cached.expires > Date.now()) {
          weekStats = cached.data as Record<string, Record<string, number>>;
        } else {
          const response = await fetch(url);
          if (!response.ok) continue;
          weekStats = await response.json();
          cache.set(url, { data: weekStats, expires: Date.now() + 60 * 60 * 1000 });
        }

        const playerStats = weekStats[playerId];
        if (playerStats?.pts_ppr !== undefined && playerStats.pts_ppr > 0) {
          weeklyPoints.push({ week, points: playerStats.pts_ppr });
        }
      } catch {
        continue;
      }
    }

    if (weeklyPoints.length < 4) return null;

    // Calculate season average
    const seasonTotal = weeklyPoints.reduce((sum, w) => sum + w.points, 0);
    const seasonPPG = seasonTotal / weeklyPoints.length;

    // Calculate last 4 weeks average
    const last4Weeks = weeklyPoints.slice(-4);
    const last4Total = last4Weeks.reduce((sum, w) => sum + w.points, 0);
    const last4PPG = last4Total / last4Weeks.length;

    // Determine trend based on percentage difference
    const pctDiff = ((last4PPG - seasonPPG) / seasonPPG) * 100;
    let trend: 'hot' | 'warm' | 'neutral' | 'cold' | 'ice';

    if (pctDiff >= 20) {
      trend = 'hot';
    } else if (pctDiff >= 8) {
      trend = 'warm';
    } else if (pctDiff <= -20) {
      trend = 'ice';
    } else if (pctDiff <= -8) {
      trend = 'cold';
    } else {
      trend = 'neutral';
    }

    return {
      last4PPG: Math.round(last4PPG * 10) / 10,
      seasonPPG: Math.round(seasonPPG * 10) / 10,
      trend,
      weeklyPoints,
      gamesPlayed: weeklyPoints.length,
    };
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
    season?: number;
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

    // Get current NFL state from Sleeper (official season/week)
    const nflState = await this.getNflState();
    const season = parseInt(nflState.season);
    const currentWeek = nflState.week;

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
        const weekStats = await this.getWeeklyStats(season, week);
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
      season,
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

    // Get current NFL state from Sleeper
    const nflState = await this.getNflState();
    const season = parseInt(nflState.season);
    const currentWeek = nflState.week;

    // Get all players
    const allPlayers = await this.getAllPlayers();

    // Aggregate stats over last 3 weeks
    const playerUsage = new Map<string, { total: number; games: number; name: string; pos: string }>();

    for (let week = Math.max(1, currentWeek - 2); week <= currentWeek; week++) {
      try {
        const weekStats = await this.getWeeklyStats(season, week);

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

  /**
   * Get deep stats for a player (snap trends, air yards, target premium, etc.)
   */
  async getDeepStats(playerName: string): Promise<{
    // Snap Count Trend
    snapTrend: {
      recentAvg: number; // Last 3 weeks snap %
      seasonAvg: number;
      trending: 'up' | 'down' | 'stable';
      weeklySnaps: Array<{ week: number; snapPct: number }>;
    };
    // Air Yards Share
    airYards: {
      share: number; // % of team air yards
      total: number; // Total air yards
      avgPerGame: number;
      rank: number; // Team rank
    };
    // Target Premium (targets per snap)
    targetPremium: {
      targetsPerSnap: number;
      leagueAvg: number; // Approximate league avg
      premium: number; // How much above/below avg
    };
    // Divisional Performance
    divisional: {
      avgPoints: number;
      nonDivAvgPoints: number;
      differential: number;
      games: Array<{ week: number; opponent: string; points: number }>;
    } | null;
    // Second Half Surge (approximated by 2nd half of season performance)
    secondHalf: {
      firstHalfAvg: number;
      secondHalfAvg: number;
      surge: number;
    } | null;
  } | null> {
    const player = await this.getPlayerByName(playerName);
    if (!player || !player.team) return null;

    const playerId = player.id;
    const team = player.team;
    const position = player.position;

    const nflState = await this.getNflState();
    const season = parseInt(nflState.season);
    const currentWeek = nflState.week;

    // NFL Divisions for divisional game detection
    const NFL_DIVISIONS: Record<string, string[]> = {
      'AFC East': ['BUF', 'MIA', 'NE', 'NYJ'],
      'AFC North': ['BAL', 'CIN', 'CLE', 'PIT'],
      'AFC South': ['HOU', 'IND', 'JAX', 'TEN'],
      'AFC West': ['DEN', 'KC', 'LAC', 'LV'],
      'NFC East': ['DAL', 'NYG', 'PHI', 'WAS'],
      'NFC North': ['CHI', 'DET', 'GB', 'MIN'],
      'NFC South': ['ATL', 'CAR', 'NO', 'TB'],
      'NFC West': ['ARI', 'LAR', 'SF', 'SEA'],
    };

    // Find player's division rivals
    let divisionRivals: string[] = [];
    for (const [_, teams] of Object.entries(NFL_DIVISIONS)) {
      if (teams.includes(team)) {
        divisionRivals = teams.filter(t => t !== team);
        break;
      }
    }

    // Get all players for team calculations
    const allPlayers = await this.getAllPlayers();
    const teammates = new Map<string, Player>();
    for (const [id, p] of allPlayers) {
      if (p.team === team) {
        teammates.set(id, p);
      }
    }

    // Collect weekly stats
    const weeklyData: Array<{
      week: number;
      snapPct: number;
      airYards: number;
      targets: number;
      snaps: number;
      points: number;
      opponent?: string;
      isDivisional?: boolean;
    }> = [];

    let teamTotalAirYards = 0;
    let playerTotalAirYards = 0;

    // Fetch schedule for divisional game detection
    const schedule = new Map<number, { opponent: string }>();
    for (let week = 1; week <= currentWeek; week++) {
      try {
        const schedUrl = `https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?seasontype=2&week=${week}&dates=${season}`;
        const schedResp = await fetch(schedUrl);
        if (schedResp.ok) {
          const schedData = await schedResp.json();
          for (const event of schedData.events || []) {
            const homeTeam = event.competitions?.[0]?.competitors?.find((c: { homeAway: string }) => c.homeAway === 'home')?.team?.abbreviation;
            const awayTeam = event.competitions?.[0]?.competitors?.find((c: { homeAway: string }) => c.homeAway === 'away')?.team?.abbreviation;
            if (homeTeam === team) {
              schedule.set(week, { opponent: awayTeam });
            } else if (awayTeam === team) {
              schedule.set(week, { opponent: homeTeam });
            }
          }
        }
      } catch {
        // Continue without schedule data for this week
      }
    }

    // Fetch weekly stats
    for (let week = 1; week <= currentWeek; week++) {
      try {
        const url = `https://api.sleeper.app/v1/stats/nfl/regular/${season}/${week}`;
        const cached = cache.get(url);
        let weekStats: Record<string, Record<string, number>>;

        if (cached && cached.expires > Date.now()) {
          weekStats = cached.data as Record<string, Record<string, number>>;
        } else {
          const response = await fetch(url);
          if (!response.ok) continue;
          weekStats = await response.json();
          cache.set(url, { data: weekStats, expires: Date.now() + 60 * 60 * 1000 });
        }

        const playerStats = weekStats[playerId];
        if (!playerStats || !playerStats.off_snp) continue;

        const snapPct = playerStats.tm_off_snp > 0
          ? (playerStats.off_snp / playerStats.tm_off_snp) * 100
          : 0;

        const airYards = playerStats.rec_air_yd || 0;
        playerTotalAirYards += airYards;

        // Calculate team air yards for this week
        let weekTeamAirYards = 0;
        for (const [id] of teammates) {
          const tmStats = weekStats[id];
          if (tmStats?.rec_air_yd) {
            weekTeamAirYards += tmStats.rec_air_yd;
          }
        }
        teamTotalAirYards += weekTeamAirYards;

        const gameInfo = schedule.get(week);
        const isDivisional = gameInfo ? divisionRivals.includes(gameInfo.opponent) : false;

        weeklyData.push({
          week,
          snapPct: Math.round(snapPct * 10) / 10,
          airYards,
          targets: playerStats.rec_tgt || 0,
          snaps: playerStats.off_snp || 0,
          points: playerStats.pts_ppr || 0,
          opponent: gameInfo?.opponent,
          isDivisional,
        });
      } catch {
        continue;
      }
    }

    if (weeklyData.length < 3) return null;

    // Calculate Snap Trend
    const recentWeeks = weeklyData.slice(-3);
    const recentSnapAvg = recentWeeks.reduce((sum, w) => sum + w.snapPct, 0) / recentWeeks.length;
    const seasonSnapAvg = weeklyData.reduce((sum, w) => sum + w.snapPct, 0) / weeklyData.length;
    const snapTrending = recentSnapAvg > seasonSnapAvg * 1.05 ? 'up' :
                         recentSnapAvg < seasonSnapAvg * 0.95 ? 'down' : 'stable';

    // Calculate Air Yards Share
    const airYardsShare = teamTotalAirYards > 0
      ? (playerTotalAirYards / teamTotalAirYards) * 100
      : 0;
    const avgAirYardsPerGame = playerTotalAirYards / weeklyData.length;

    // Calculate team air yards rank
    const teammateAirYards: Array<{ id: string; total: number }> = [];
    for (const [id] of teammates) {
      let total = 0;
      for (let week = 1; week <= currentWeek; week++) {
        const url = `https://api.sleeper.app/v1/stats/nfl/regular/${season}/${week}`;
        const cached = cache.get(url);
        if (cached) {
          const weekStats = cached.data as Record<string, Record<string, number>>;
          total += weekStats[id]?.rec_air_yd || 0;
        }
      }
      if (total > 0) {
        teammateAirYards.push({ id, total });
      }
    }
    teammateAirYards.sort((a, b) => b.total - a.total);
    const airYardsRank = teammateAirYards.findIndex(t => t.id === playerId) + 1;

    // Calculate Target Premium
    const totalTargets = weeklyData.reduce((sum, w) => sum + w.targets, 0);
    const totalSnaps = weeklyData.reduce((sum, w) => sum + w.snaps, 0);
    const targetsPerSnap = totalSnaps > 0 ? (totalTargets / totalSnaps) * 100 : 0;
    // League average is roughly 15-20% for primary receivers
    const leagueAvg = position === 'TE' ? 12 : position === 'RB' ? 8 : 18;
    const targetPremium = targetsPerSnap - leagueAvg;

    // Calculate Divisional Performance
    const divisionalGames = weeklyData.filter(w => w.isDivisional);
    const nonDivGames = weeklyData.filter(w => !w.isDivisional);
    const divisional = divisionalGames.length >= 1 ? {
      avgPoints: Math.round((divisionalGames.reduce((sum, g) => sum + g.points, 0) / divisionalGames.length) * 10) / 10,
      nonDivAvgPoints: nonDivGames.length > 0
        ? Math.round((nonDivGames.reduce((sum, g) => sum + g.points, 0) / nonDivGames.length) * 10) / 10
        : 0,
      differential: 0,
      games: divisionalGames.map(g => ({ week: g.week, opponent: g.opponent || '', points: g.points })),
    } : null;
    if (divisional) {
      divisional.differential = Math.round((divisional.avgPoints - divisional.nonDivAvgPoints) * 10) / 10;
    }

    // Calculate Second Half Surge (weeks 9+ vs weeks 1-8)
    const firstHalfGames = weeklyData.filter(w => w.week <= 8);
    const secondHalfGames = weeklyData.filter(w => w.week >= 9);
    const secondHalf = firstHalfGames.length >= 2 && secondHalfGames.length >= 2 ? {
      firstHalfAvg: Math.round((firstHalfGames.reduce((sum, g) => sum + g.points, 0) / firstHalfGames.length) * 10) / 10,
      secondHalfAvg: Math.round((secondHalfGames.reduce((sum, g) => sum + g.points, 0) / secondHalfGames.length) * 10) / 10,
      surge: 0,
    } : null;
    if (secondHalf) {
      secondHalf.surge = Math.round((secondHalf.secondHalfAvg - secondHalf.firstHalfAvg) * 10) / 10;
    }

    return {
      snapTrend: {
        recentAvg: Math.round(recentSnapAvg * 10) / 10,
        seasonAvg: Math.round(seasonSnapAvg * 10) / 10,
        trending: snapTrending,
        weeklySnaps: weeklyData.map(w => ({ week: w.week, snapPct: w.snapPct })),
      },
      airYards: {
        share: Math.round(airYardsShare * 10) / 10,
        total: Math.round(playerTotalAirYards),
        avgPerGame: Math.round(avgAirYardsPerGame * 10) / 10,
        rank: airYardsRank || 1,
      },
      targetPremium: {
        targetsPerSnap: Math.round(targetsPerSnap * 10) / 10,
        leagueAvg,
        premium: Math.round(targetPremium * 10) / 10,
      },
      divisional,
      secondHalf,
    };
  },

  /**
   * Get player's cold weather performance (games at outdoor cold-weather stadiums)
   * Returns fantasy points comparison: cold games vs all games
   */
  async getColdWeatherPerformance(playerName: string): Promise<{
    coldGames: Array<{ week: number; opponent: string; points: number; isHome: boolean }>;
    avgColdPoints: number;
    avgAllPoints: number;
    coldGameCount: number;
    allGameCount: number;
    differential: number;
  } | null> {
    // Cold-weather outdoor stadiums by tier
    // Tier 1: Very cold (can be cold even in October) - weeks 8+
    const VERY_COLD_STADIUMS = new Set(['BUF', 'GB', 'CHI', 'NE', 'DEN']);
    // Tier 2: Cold in late season - weeks 10+
    const COLD_STADIUMS = new Set([
      'BUF', 'NE', 'NYJ', 'NYG', // Northeast
      'CLE', 'PIT', 'CIN', 'BAL', // Midwest/Mid-Atlantic
      'GB', 'CHI', 'MIN', // Upper Midwest (MIN outdoor for some games)
      'DEN', 'KC', // Mountain/Plains
      'PHI', 'WAS', // Mid-Atlantic
      'SEA', // Pacific Northwest (cold/rainy in Dec)
      'IND', // Can be cold
    ]);

    // Get player info
    const player = await this.getPlayerByName(playerName);
    if (!player || !player.team) return null;

    const playerId = player.id;
    const team = player.team;

    // Get NFL state for current season
    const nflState = await this.getNflState();
    const season = parseInt(nflState.season);
    const currentWeek = nflState.week;

    // Fetch schedule for cold weather weeks
    const schedule = new Map<number, { opponent: string; isHome: boolean; venue: string }>();

    // Use ESPN for schedule data - start from week 8 for very cold stadiums
    for (let week = 8; week <= currentWeek; week++) {
      try {
        const schedUrl = `https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?seasontype=2&week=${week}&dates=${season}`;
        const schedResp = await fetch(schedUrl);
        if (!schedResp.ok) continue;
        const schedData = await schedResp.json();

        for (const event of schedData.events || []) {
          const homeTeam = event.competitions?.[0]?.competitors?.find((c: { homeAway: string }) => c.homeAway === 'home')?.team?.abbreviation;
          const awayTeam = event.competitions?.[0]?.competitors?.find((c: { homeAway: string }) => c.homeAway === 'away')?.team?.abbreviation;

          if (homeTeam === team) {
            schedule.set(week, { opponent: awayTeam, isHome: true, venue: homeTeam });
          } else if (awayTeam === team) {
            schedule.set(week, { opponent: homeTeam, isHome: false, venue: homeTeam });
          }
        }
      } catch {
        continue;
      }
    }

    // Collect all game stats and identify cold games
    const coldGames: Array<{ week: number; opponent: string; points: number; isHome: boolean }> = [];
    const allGames: Array<{ week: number; points: number }> = [];

    // Check weeks 1 through current week
    for (let week = 1; week <= currentWeek; week++) {
      try {
        const url = `https://api.sleeper.app/v1/stats/nfl/regular/${season}/${week}`;
        const cached = cache.get(url);
        let weekStats: Record<string, Record<string, number>>;

        if (cached && cached.expires > Date.now()) {
          weekStats = cached.data as Record<string, Record<string, number>>;
        } else {
          const response = await fetch(url);
          if (!response.ok) continue;
          weekStats = await response.json();
          cache.set(url, { data: weekStats, expires: Date.now() + 60 * 60 * 1000 });
        }

        const playerStats = weekStats[playerId];
        if (!playerStats || !playerStats.pts_ppr) continue;

        const points = playerStats.pts_ppr;
        allGames.push({ week, points });

        // Check if it was a cold game using schedule
        // Week 8-9: Only very cold stadiums (BUF, GB, CHI, NE, DEN)
        // Week 10+: All cold stadiums
        const gameInfo = schedule.get(week);
        if (gameInfo) {
          const venue = gameInfo.venue;
          const isVeryCold = VERY_COLD_STADIUMS.has(venue);
          const isCold = COLD_STADIUMS.has(venue);

          if ((week >= 10 && isCold) || (week >= 8 && week < 10 && isVeryCold)) {
            coldGames.push({
              week,
              opponent: gameInfo.opponent,
              points,
              isHome: gameInfo.isHome,
            });
          }
        }
      } catch {
        continue;
      }
    }

    if (allGames.length === 0) return null;

    const avgAllPoints = allGames.reduce((sum, g) => sum + g.points, 0) / allGames.length;
    const avgColdPoints = coldGames.length > 0
      ? coldGames.reduce((sum, g) => sum + g.points, 0) / coldGames.length
      : avgAllPoints;

    return {
      coldGames,
      avgColdPoints: Math.round(avgColdPoints * 10) / 10,
      avgAllPoints: Math.round(avgAllPoints * 10) / 10,
      coldGameCount: coldGames.length,
      allGameCount: allGames.length,
      differential: Math.round((avgColdPoints - avgAllPoints) * 10) / 10,
    };
  },
};

export default sleeper;
