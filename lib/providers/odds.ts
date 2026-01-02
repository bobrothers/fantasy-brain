/**
 * The Odds API Adapter
 * 
 * Free tier: 500 requests/month
 * Sign up at: https://the-odds-api.com/
 * 
 * Used for:
 * - Spread (home team favored by X)
 * - Total (over/under)
 * - Implied team totals
 * - Line movement signals
 */

import type { GameOdds } from '@/types';

const BASE_URL = 'https://api.the-odds-api.com/v4';

// You'll need to set this in your environment
const API_KEY = process.env.ODDS_API_KEY || '';

interface OddsAPIBookmaker {
  key: string;
  title: string;
  last_update: string;
  markets: Array<{
    key: string;
    last_update: string;
    outcomes: Array<{
      name: string;
      price: number;
      point?: number;
    }>;
  }>;
}

interface OddsAPIEvent {
  id: string;
  sport_key: string;
  sport_title: string;
  commence_time: string;
  home_team: string;
  away_team: string;
  bookmakers: OddsAPIBookmaker[];
}

// Team name mapping (Odds API uses full names)
const TEAM_ABBREV: Record<string, string> = {
  'Arizona Cardinals': 'ARI',
  'Atlanta Falcons': 'ATL',
  'Baltimore Ravens': 'BAL',
  'Buffalo Bills': 'BUF',
  'Carolina Panthers': 'CAR',
  'Chicago Bears': 'CHI',
  'Cincinnati Bengals': 'CIN',
  'Cleveland Browns': 'CLE',
  'Dallas Cowboys': 'DAL',
  'Denver Broncos': 'DEN',
  'Detroit Lions': 'DET',
  'Green Bay Packers': 'GB',
  'Houston Texans': 'HOU',
  'Indianapolis Colts': 'IND',
  'Jacksonville Jaguars': 'JAX',
  'Kansas City Chiefs': 'KC',
  'Las Vegas Raiders': 'LV',
  'Los Angeles Chargers': 'LAC',
  'Los Angeles Rams': 'LAR',
  'Miami Dolphins': 'MIA',
  'Minnesota Vikings': 'MIN',
  'New England Patriots': 'NE',
  'New Orleans Saints': 'NO',
  'New York Giants': 'NYG',
  'New York Jets': 'NYJ',
  'Philadelphia Eagles': 'PHI',
  'Pittsburgh Steelers': 'PIT',
  'San Francisco 49ers': 'SF',
  'Seattle Seahawks': 'SEA',
  'Tampa Bay Buccaneers': 'TB',
  'Tennessee Titans': 'TEN',
  'Washington Commanders': 'WAS',
};

function getTeamAbbrev(fullName: string): string {
  return TEAM_ABBREV[fullName] || fullName;
}

// Calculate implied team total from spread and total
function calculateImpliedTotals(spread: number, total: number): { home: number; away: number } {
  // If home team is favored by 7 and total is 47:
  // Home implied = (47 + 7) / 2 = 27
  // Away implied = (47 - 7) / 2 = 20
  const homeImplied = (total - spread) / 2;
  const awayImplied = (total + spread) / 2;
  
  return {
    home: Math.round(homeImplied * 10) / 10,
    away: Math.round(awayImplied * 10) / 10,
  };
}

// Simple cache
const cache = new Map<string, { data: unknown; expires: number }>();
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes (odds change, but free tier is limited)

async function fetchOdds(endpoint: string): Promise<OddsAPIEvent[]> {
  if (!API_KEY) {
    console.warn('ODDS_API_KEY not set. Odds data will be unavailable.');
    return [];
  }

  const cacheKey = endpoint;
  const cached = cache.get(cacheKey);
  if (cached && cached.expires > Date.now()) {
    return cached.data as OddsAPIEvent[];
  }

  const url = `${BASE_URL}${endpoint}`;
  const separator = endpoint.includes('?') ? '&' : '?';
  const fullUrl = `${url}${separator}apiKey=${API_KEY}`;

  try {
    const response = await fetch(fullUrl);
    
    if (!response.ok) {
      if (response.status === 401) {
        console.error('Invalid Odds API key');
      } else if (response.status === 429) {
        console.error('Odds API rate limit exceeded');
      }
      throw new Error(`Odds API error: ${response.status}`);
    }

    // Log remaining requests (useful for free tier)
    const remaining = response.headers.get('x-requests-remaining');
    if (remaining) {
      console.log(`Odds API requests remaining: ${remaining}`);
    }

    const data = await response.json();
    cache.set(cacheKey, { data, expires: Date.now() + CACHE_TTL });
    return data;
  } catch (error) {
    console.error('Failed to fetch odds:', error);
    return [];
  }
}

export const odds = {
  /**
   * Check if API is configured
   */
  isConfigured(): boolean {
    return !!API_KEY;
  },

  /**
   * Get odds for all upcoming NFL games
   */
  async getNFLOdds(): Promise<GameOdds[]> {
    const events = await fetchOdds(
      '/sports/americanfootball_nfl/odds/?regions=us&markets=h2h,spreads,totals&oddsFormat=american'
    );

    return events.map(event => {
      // Use first bookmaker with all markets (usually FanDuel or DraftKings)
      const bookmaker = event.bookmakers.find(b => 
        b.markets.length >= 3 &&
        b.markets.some(m => m.key === 'spreads') &&
        b.markets.some(m => m.key === 'totals')
      ) || event.bookmakers[0];

      if (!bookmaker) {
        return {
          gameId: event.id,
          homeTeam: getTeamAbbrev(event.home_team),
          awayTeam: getTeamAbbrev(event.away_team),
          spread: 0,
          total: 0,
          homeMoneyline: -110,
          awayMoneyline: -110,
          impliedHomeTotal: 0,
          impliedAwayTotal: 0,
          lastUpdate: new Date(),
        };
      }

      // Extract markets
      const spreadsMarket = bookmaker.markets.find(m => m.key === 'spreads');
      const totalsMarket = bookmaker.markets.find(m => m.key === 'totals');
      const h2hMarket = bookmaker.markets.find(m => m.key === 'h2h');

      // Get spread (home team perspective)
      const homeSpread = spreadsMarket?.outcomes.find(o => o.name === event.home_team);
      const spread = homeSpread?.point ?? 0;

      // Get total
      const overOutcome = totalsMarket?.outcomes.find(o => o.name === 'Over');
      const total = overOutcome?.point ?? 0;

      // Get moneylines
      const homeML = h2hMarket?.outcomes.find(o => o.name === event.home_team);
      const awayML = h2hMarket?.outcomes.find(o => o.name === event.away_team);

      // Calculate implied totals
      const implied = calculateImpliedTotals(spread, total);

      return {
        gameId: event.id,
        homeTeam: getTeamAbbrev(event.home_team),
        awayTeam: getTeamAbbrev(event.away_team),
        spread,
        total,
        homeMoneyline: homeML?.price ?? -110,
        awayMoneyline: awayML?.price ?? -110,
        impliedHomeTotal: implied.home,
        impliedAwayTotal: implied.away,
        lastUpdate: new Date(bookmaker.last_update),
      };
    });
  },

  /**
   * Get odds for a specific game
   */
  async getGameOdds(homeTeam: string, awayTeam: string): Promise<GameOdds | null> {
    const allOdds = await this.getNFLOdds();
    return allOdds.find(g => 
      g.homeTeam === homeTeam && g.awayTeam === awayTeam
    ) || null;
  },

  /**
   * Get implied team total
   * Higher implied total = more expected scoring = better for offensive players
   */
  async getImpliedTotal(team: string): Promise<number | null> {
    const allOdds = await this.getNFLOdds();
    
    // Find game where team is playing
    const game = allOdds.find(g => g.homeTeam === team || g.awayTeam === team);
    if (!game) return null;

    return game.homeTeam === team ? game.impliedHomeTotal : game.impliedAwayTotal;
  },

  /**
   * Analyze if spread suggests blowout (affects late-game usage)
   */
  isBlowoutRisk(gameOdds: GameOdds): { team: string; risk: 'high' | 'medium' | 'low' } | null {
    const absSpread = Math.abs(gameOdds.spread);
    
    if (absSpread >= 14) {
      // 2+ TD favorite - high blowout risk
      const favorite = gameOdds.spread < 0 ? gameOdds.homeTeam : gameOdds.awayTeam;
      return { team: favorite, risk: 'high' };
    } else if (absSpread >= 10) {
      const favorite = gameOdds.spread < 0 ? gameOdds.homeTeam : gameOdds.awayTeam;
      return { team: favorite, risk: 'medium' };
    }
    
    return null;
  },

  /**
   * Get games with high totals (shootout potential)
   */
  async getHighScoringGames(threshold = 48): Promise<GameOdds[]> {
    const allOdds = await this.getNFLOdds();
    return allOdds.filter(g => g.total >= threshold);
  },

  /**
   * Clear cache
   */
  clearCache(): void {
    cache.clear();
  },
};

export default odds;
