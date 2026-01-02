/**
 * ESPN Hidden API Adapter
 * 
 * Undocumented API - may break without notice.
 * No auth required. Rate limits unknown (be respectful).
 * 
 * Used primarily for injury data since it's free and reasonably up-to-date.
 */

import type { InjuryReport } from '@/types';

const BASE_URL = 'https://sports.core.api.espn.com/v2/sports/football/leagues/nfl';
const SITE_API = 'https://site.api.espn.com/apis/site/v2/sports/football/nfl';

// ESPN team ID mapping
const ESPN_TEAM_IDS: Record<string, string> = {
  ARI: '22', ATL: '1', BAL: '33', BUF: '2',
  CAR: '29', CHI: '3', CIN: '4', CLE: '5',
  DAL: '6', DEN: '7', DET: '8', GB: '9',
  HOU: '34', IND: '11', JAX: '30', KC: '12',
  LAC: '24', LAR: '14', LV: '13', MIA: '15',
  MIN: '16', NE: '17', NO: '18', NYG: '19',
  NYJ: '20', PHI: '21', PIT: '23', SEA: '26',
  SF: '25', TB: '27', TEN: '10', WAS: '28',
};

// Reverse mapping
const TEAM_ABBREV_BY_ID: Record<string, string> = Object.fromEntries(
  Object.entries(ESPN_TEAM_IDS).map(([abbr, id]) => [id, abbr])
);

interface ESPNInjury {
  id: string;
  status: string;
  date: string;
  athlete: {
    id: string;
    fullName: string;
    displayName: string;
    position: {
      abbreviation: string;
    };
  };
  type: {
    text: string;
  };
  details?: {
    type: string;
    returnDate?: string;
    fantasyStatus?: {
      description: string;
    };
  };
}

interface ESPNInjuryResponse {
  items: Array<{
    $ref: string;
  }>;
}

interface ESPNTeamInjuryDetail {
  id: string;
  status: string;
  date: string;
  athlete: {
    $ref: string;
  };
  type: {
    text: string;
  };
}

interface ESPNAthlete {
  id: string;
  fullName: string;
  displayName: string;
  position: {
    abbreviation: string;
  };
}

// Simple cache
const cache = new Map<string, { data: unknown; expires: number }>();
const CACHE_TTL = 15 * 60 * 1000; // 15 minutes for injuries

async function fetchWithCache<T>(url: string, ttl = CACHE_TTL): Promise<T> {
  const cached = cache.get(url);
  if (cached && cached.expires > Date.now()) {
    return cached.data as T;
  }

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`ESPN API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  cache.set(url, { data, expires: Date.now() + ttl });
  return data as T;
}

function normalizeInjuryStatus(espnStatus: string): InjuryReport['status'] {
  const statusMap: Record<string, InjuryReport['status']> = {
    'Out': 'Out',
    'Doubtful': 'Doubtful',
    'Questionable': 'Questionable',
    'Probable': 'Probable',
    'Injured Reserve': 'IR',
    'IR': 'IR',
    'Day-To-Day': 'Questionable',
    'Active': 'Probable',
  };
  return statusMap[espnStatus] || 'Questionable';
}

export const espn = {
  /**
   * Get all injuries for a team
   */
  async getTeamInjuries(teamAbbrev: string): Promise<InjuryReport[]> {
    const teamId = ESPN_TEAM_IDS[teamAbbrev];
    if (!teamId) {
      console.warn(`Unknown team: ${teamAbbrev}`);
      return [];
    }

    try {
      // Get injury list references
      const injuryListUrl = `${BASE_URL}/teams/${teamId}/injuries`;
      const injuryList = await fetchWithCache<ESPNInjuryResponse>(injuryListUrl);

      if (!injuryList.items || injuryList.items.length === 0) {
        return [];
      }

      // Fetch each injury detail (ESPN returns refs, not full data)
      const injuries: InjuryReport[] = [];
      
      for (const item of injuryList.items.slice(0, 20)) { // Limit to avoid too many requests
        try {
          const injuryDetail = await fetchWithCache<ESPNTeamInjuryDetail>(item.$ref);
          
          // Get athlete details
          const athlete = await fetchWithCache<ESPNAthlete>(injuryDetail.athlete.$ref);
          
          injuries.push({
            playerId: athlete.id, // ESPN ID, not Sleeper ID
            playerName: athlete.displayName || athlete.fullName,
            team: teamAbbrev,
            position: athlete.position?.abbreviation || 'Unknown',
            status: normalizeInjuryStatus(injuryDetail.status),
            injury: injuryDetail.type?.text || 'Undisclosed',
            lastUpdate: new Date(injuryDetail.date),
          });
        } catch (e) {
          // Skip individual injuries that fail to fetch
          console.warn(`Failed to fetch injury detail:`, e);
        }
      }

      return injuries;
    } catch (error) {
      console.error(`Failed to fetch injuries for ${teamAbbrev}:`, error);
      return [];
    }
  },

  /**
   * Get all injuries across the league
   */
  async getAllInjuries(): Promise<InjuryReport[]> {
    const allInjuries: InjuryReport[] = [];
    
    // Fetch injuries for all teams (this is slow but comprehensive)
    const teams = Object.keys(ESPN_TEAM_IDS);
    
    for (const team of teams) {
      try {
        const teamInjuries = await this.getTeamInjuries(team);
        allInjuries.push(...teamInjuries);
        
        // Small delay to be respectful to the API
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (e) {
        console.warn(`Failed to fetch injuries for ${team}`);
      }
    }

    return allInjuries;
  },

  /**
   * Get offensive line injuries for a team
   * This is key for our OL injury edge detection
   */
  async getOLInjuries(teamAbbrev: string): Promise<InjuryReport[]> {
    const injuries = await this.getTeamInjuries(teamAbbrev);
    
    // Exact match only - avoid matching DT, NT, DE, etc
    const olPositions = new Set(['OT', 'OG', 'C', 'T', 'G', 'LT', 'RT', 'LG', 'RG', 'OL']);
    
    // Defensive positions to explicitly exclude
    const defensivePositions = new Set(['DT', 'DE', 'NT', 'DL', 'LB', 'MLB', 'OLB', 'ILB', 'CB', 'S', 'SS', 'FS', 'DB']);
    
    return injuries.filter(inj => {
      const pos = inj.position.toUpperCase();
      // Must be an OL position AND not a defensive position
      return olPositions.has(pos) && !defensivePositions.has(pos);
    });
  },

  /**
   * Get the current NFL week and season
   */
  async getCurrentWeek(): Promise<{ season: number; week: number; type: string }> {
    interface ESPNScoreboard {
      week: { number: number };
      season: { year: number; type: number };
    }
    
    const url = `${SITE_API}/scoreboard`;
    const data = await fetchWithCache<ESPNScoreboard>(url, 60 * 60 * 1000); // 1 hour cache
    
    return {
      season: data.season.year,
      week: data.week.number,
      type: data.season.type === 2 ? 'regular' : 'postseason',
    };
  },

  /**
   * Get schedule/games for a specific week
   */
  async getWeekGames(season: number, week: number): Promise<Array<{
    id: string;
    homeTeam: string;
    awayTeam: string;
    date: string;
    venue?: string;
  }>> {
    interface ESPNEvent {
      id: string;
      date: string;
      competitions: Array<{
        venue?: { fullName: string };
        competitors: Array<{
          homeAway: string;
          team: { abbreviation: string };
        }>;
      }>;
    }
    
    interface ESPNScoreboardResponse {
      events: ESPNEvent[];
    }

    const url = `${SITE_API}/scoreboard?week=${week}&seasontype=2&dates=${season}`;
    const data = await fetchWithCache<ESPNScoreboardResponse>(url);

    return data.events.map(event => {
      const comp = event.competitions[0];
      const home = comp.competitors.find(c => c.homeAway === 'home');
      const away = comp.competitors.find(c => c.homeAway === 'away');
      
      return {
        id: event.id,
        homeTeam: home?.team.abbreviation || 'UNK',
        awayTeam: away?.team.abbreviation || 'UNK',
        date: event.date,
        venue: comp.venue?.fullName,
      };
    });
  },

  /**
   * Clear the cache
   */
  clearCache(): void {
    cache.clear();
  },
};

export default espn;
