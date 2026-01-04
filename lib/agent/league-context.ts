/**
 * League Context Agent
 *
 * Analyzes a Sleeper league to build profiles for:
 * - League settings and tendencies
 * - Each owner's trading style and roster needs
 *
 * This data feeds into the Trade Negotiation Agent.
 */

import { createTrackedClient, calculateCost } from '../db/costs';
import { getSupabaseServer, isSupabaseConfigured } from '../db/supabase';
import { sleeper } from '../providers/sleeper';

const CLAUDE_MODEL = 'claude-sonnet-4-20250514';

interface LeagueData {
  leagueId: string;
  name: string;
  season: number;
  settings: {
    rosterPositions: string[];
    scoringSettings: Record<string, number>;
    tradeDeadline: number | null;
    waiverType: string;
  };
  rosters: Array<{
    ownerId: string;
    players: string[];
    wins: number;
    losses: number;
    points: number;
  }>;
  users: Array<{
    oderId: string;
    displayName: string;
    teamName?: string;
    avatar?: string;
  }>;
  transactions: Array<{
    type: string;
    adds?: Record<string, string>;
    drops?: Record<string, string>;
    createdAt: number;
  }>;
}

interface OwnerAnalysis {
  ownerId: string;
  displayName: string;
  teamName?: string;
  rosterStrength: number;
  rosterNeeds: string[];
  tradeAssets: string[];
  tradingStyle: 'aggressive' | 'moderate' | 'passive';
  valuesYouth: boolean;
  valuesVeterans: boolean;
  positionPreferences: string[];
  buyLowTendency: number;
  sellHighTendency: number;
  tradesMade: number;
  aiSummary: string;
}

interface LeagueAnalysis {
  leagueId: string;
  name: string;
  tradeVolume: 'high' | 'medium' | 'low';
  avgTradesPerWeek: number;
  leagueCompetitiveness: 'very_competitive' | 'competitive' | 'casual';
  commonTradePatterns: string[];
  aiSummary: string;
  owners: OwnerAnalysis[];
}

export interface LeagueContextResult {
  success: boolean;
  leagueId: string;
  leagueName?: string;
  ownersAnalyzed: number;
  apiCostUsd: number;
  error?: string;
}

/**
 * Fetch all league data from Sleeper
 */
async function fetchLeagueData(leagueId: string): Promise<LeagueData | null> {
  try {
    // Fetch league info
    const leagueRes = await fetch(`https://api.sleeper.app/v1/league/${leagueId}`);
    if (!leagueRes.ok) return null;
    const league = await leagueRes.json();

    // Fetch rosters
    const rostersRes = await fetch(`https://api.sleeper.app/v1/league/${leagueId}/rosters`);
    const rosters = rostersRes.ok ? await rostersRes.json() : [];

    // Fetch users
    const usersRes = await fetch(`https://api.sleeper.app/v1/league/${leagueId}/users`);
    const users = usersRes.ok ? await usersRes.json() : [];

    // Fetch transactions (trades only)
    const transactions: LeagueData['transactions'] = [];
    for (let week = 1; week <= 18; week++) {
      try {
        const txRes = await fetch(
          `https://api.sleeper.app/v1/league/${leagueId}/transactions/${week}`
        );
        if (txRes.ok) {
          const weekTx = await txRes.json();
          const trades = weekTx.filter((t: { type: string }) => t.type === 'trade');
          transactions.push(...trades);
        }
      } catch {
        // Skip failed weeks
      }
    }

    return {
      leagueId,
      name: league.name,
      season: parseInt(league.season),
      settings: {
        rosterPositions: league.roster_positions || [],
        scoringSettings: league.scoring_settings || {},
        tradeDeadline: league.settings?.trade_deadline,
        waiverType: league.settings?.waiver_type || 'normal',
      },
      rosters: rosters.map((r: Record<string, unknown>) => ({
        ownerId: r.owner_id as string,
        players: (r.players as string[]) || [],
        wins: (r.settings as Record<string, number>)?.wins || 0,
        losses: (r.settings as Record<string, number>)?.losses || 0,
        points: (r.settings as Record<string, number>)?.fpts || 0,
      })),
      users: users.map((u: Record<string, unknown>) => ({
        oderId: u.user_id as string,
        displayName: u.display_name as string,
        teamName: (u.metadata as Record<string, string>)?.team_name,
        avatar: u.avatar as string,
      })),
      transactions,
    };
  } catch (error) {
    console.error('[LeagueContext] Error fetching league data:', error);
    return null;
  }
}

/**
 * Build context string for Claude analysis
 */
async function buildAnalysisContext(data: LeagueData): Promise<string> {
  // Get player names for context
  const allPlayerIds = new Set<string>();
  data.rosters.forEach(r => r.players.forEach(p => allPlayerIds.add(p)));

  const players = await sleeper.getAllPlayers();
  const playerNames: Record<string, string> = {};
  allPlayerIds.forEach(id => {
    const p = players.get(id);
    if (p) {
      playerNames[id] = p.full_name || `${p.first_name} ${p.last_name}`;
    }
  });

  // Build roster summaries
  const rosterSummaries = data.rosters.map(roster => {
    const owner = data.users.find(u => u.oderId === roster.ownerId);
    const rosterPlayers = roster.players
      .map(id => playerNames[id] || id)
      .slice(0, 15); // Top 15 players

    return {
      owner: owner?.displayName || roster.ownerId,
      teamName: owner?.teamName,
      record: `${roster.wins}-${roster.losses}`,
      points: roster.points,
      players: rosterPlayers,
    };
  });

  // Summarize trades
  const tradeSummaries = data.transactions.slice(0, 20).map(tx => {
    const adds = Object.keys(tx.adds || {}).map(id => playerNames[id] || id);
    const drops = Object.keys(tx.drops || {}).map(id => playerNames[id] || id);
    return { adds, drops };
  });

  return JSON.stringify({
    league: {
      name: data.name,
      season: data.season,
      numTeams: data.rosters.length,
      rosterPositions: data.settings.rosterPositions,
      scoringType: data.settings.scoringSettings.rec === 1 ? 'PPR' :
                   data.settings.scoringSettings.rec === 0.5 ? 'Half-PPR' : 'Standard',
      totalTrades: data.transactions.length,
    },
    rosters: rosterSummaries,
    recentTrades: tradeSummaries,
  }, null, 2);
}

/**
 * Analyze league using Claude
 */
async function analyzeLeague(
  data: LeagueData,
  context: string
): Promise<{ analysis: LeagueAnalysis; costUsd: number }> {
  const client = createTrackedClient('agent/league-context');

  const systemPrompt = `You are a fantasy football analyst specializing in league dynamics and owner behavior patterns.

Analyze the provided league data and return a JSON response with:
1. League-level analysis (trade activity, competitiveness)
2. Per-owner analysis (trading style, roster needs, tendencies)

Be specific and actionable. Your analysis will be used by a Trade Negotiation Agent.`;

  const userPrompt = `Analyze this fantasy football league and its owners:

${context}

Return a JSON object with this exact structure:
{
  "league": {
    "tradeVolume": "high" | "medium" | "low",
    "avgTradesPerWeek": number,
    "leagueCompetitiveness": "very_competitive" | "competitive" | "casual",
    "commonTradePatterns": ["pattern1", "pattern2"],
    "summary": "Brief league summary"
  },
  "owners": [
    {
      "displayName": "owner name",
      "rosterStrength": 1-10,
      "rosterNeeds": ["QB", "RB", etc],
      "tradeAssets": ["Player Name 1", "Player Name 2"],
      "tradingStyle": "aggressive" | "moderate" | "passive",
      "valuesYouth": true/false,
      "valuesVeterans": true/false,
      "positionPreferences": ["RB", "WR"],
      "buyLowTendency": 1-10,
      "sellHighTendency": 1-10,
      "summary": "Brief owner summary for trade negotiations"
    }
  ]
}`;

  const response = await client.createMessage({
    model: CLAUDE_MODEL,
    max_tokens: 4000,
    messages: [
      { role: 'user', content: userPrompt }
    ],
    system: systemPrompt,
  });

  // Extract JSON from response
  const content = response.content[0];
  if (content.type !== 'text') {
    throw new Error('Unexpected response type');
  }

  // Parse JSON from response (handle markdown code blocks)
  let jsonStr = content.text;
  const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    jsonStr = jsonMatch[1];
  }

  const parsed = JSON.parse(jsonStr);

  // Calculate cost
  const costUsd = calculateCost(CLAUDE_MODEL, {
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
  });

  // Map to our structure
  const analysis: LeagueAnalysis = {
    leagueId: data.leagueId,
    name: data.name,
    tradeVolume: parsed.league.tradeVolume,
    avgTradesPerWeek: parsed.league.avgTradesPerWeek,
    leagueCompetitiveness: parsed.league.leagueCompetitiveness,
    commonTradePatterns: parsed.league.commonTradePatterns,
    aiSummary: parsed.league.summary,
    owners: parsed.owners.map((o: Record<string, unknown>) => {
      const roster = data.rosters.find(r => {
        const user = data.users.find(u => u.oderId === r.ownerId);
        return user?.displayName === o.displayName;
      });
      const user = data.users.find(u => u.displayName === o.displayName);

      return {
        ownerId: user?.oderId || '',
        displayName: o.displayName as string,
        teamName: user?.teamName,
        rosterStrength: o.rosterStrength as number,
        rosterNeeds: o.rosterNeeds as string[],
        tradeAssets: o.tradeAssets as string[],
        tradingStyle: o.tradingStyle as 'aggressive' | 'moderate' | 'passive',
        valuesYouth: o.valuesYouth as boolean,
        valuesVeterans: o.valuesVeterans as boolean,
        positionPreferences: o.positionPreferences as string[],
        buyLowTendency: o.buyLowTendency as number,
        sellHighTendency: o.sellHighTendency as number,
        tradesMade: data.transactions.filter(t =>
          Object.values(t.adds || {}).includes(roster?.ownerId || '')
        ).length,
        aiSummary: o.summary as string,
      };
    }),
  };

  return { analysis, costUsd };
}

/**
 * Store league and owner profiles in database
 */
async function storeProfiles(analysis: LeagueAnalysis): Promise<void> {
  if (!isSupabaseConfigured()) return;

  const supabase = getSupabaseServer();

  // Upsert league profile
  await supabase.from('league_profiles').upsert({
    league_id: analysis.leagueId,
    platform: 'sleeper',
    name: analysis.name,
    trade_volume: analysis.tradeVolume,
    avg_trades_per_week: analysis.avgTradesPerWeek,
    league_competitiveness: analysis.leagueCompetitiveness,
    common_trade_patterns: analysis.commonTradePatterns,
    ai_summary: analysis.aiSummary,
    ai_analysis: analysis,
    updated_at: new Date().toISOString(),
  }, {
    onConflict: 'league_id',
  });

  // Upsert owner profiles
  for (const owner of analysis.owners) {
    await supabase.from('owner_profiles').upsert({
      league_id: analysis.leagueId,
      owner_id: owner.ownerId,
      platform: 'sleeper',
      display_name: owner.displayName,
      team_name: owner.teamName,
      roster_strength: owner.rosterStrength,
      roster_needs: owner.rosterNeeds,
      trade_assets: owner.tradeAssets,
      trading_style: owner.tradingStyle,
      values_youth: owner.valuesYouth,
      values_veterans: owner.valuesVeterans,
      position_preferences: owner.positionPreferences,
      buy_low_tendency: owner.buyLowTendency,
      sell_high_tendency: owner.sellHighTendency,
      trades_made: owner.tradesMade,
      ai_summary: owner.aiSummary,
      ai_analysis: owner,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'league_id,owner_id',
    });
  }
}

/**
 * Run the League Context Agent
 */
export async function runLeagueContextAgent(leagueId: string): Promise<LeagueContextResult> {
  console.log(`[LeagueContext] Analyzing league ${leagueId}`);

  try {
    // Fetch league data from Sleeper
    const data = await fetchLeagueData(leagueId);
    if (!data) {
      return {
        success: false,
        leagueId,
        ownersAnalyzed: 0,
        apiCostUsd: 0,
        error: 'Failed to fetch league data from Sleeper',
      };
    }

    console.log(`[LeagueContext] Fetched ${data.rosters.length} rosters, ${data.transactions.length} trades`);

    // Build analysis context
    const context = await buildAnalysisContext(data);

    // Analyze with Claude
    const { analysis, costUsd } = await analyzeLeague(data, context);

    console.log(`[LeagueContext] Analysis complete. Trade volume: ${analysis.tradeVolume}`);

    // Store profiles
    await storeProfiles(analysis);

    return {
      success: true,
      leagueId,
      leagueName: data.name,
      ownersAnalyzed: analysis.owners.length,
      apiCostUsd: costUsd,
    };
  } catch (error) {
    console.error('[LeagueContext] Agent error:', error);
    return {
      success: false,
      leagueId,
      ownersAnalyzed: 0,
      apiCostUsd: 0,
      error: String(error),
    };
  }
}

/**
 * Get cached league profile
 */
export async function getLeagueProfile(leagueId: string) {
  if (!isSupabaseConfigured()) return null;

  const supabase = getSupabaseServer();
  const { data } = await supabase
    .from('league_profiles')
    .select('*')
    .eq('league_id', leagueId)
    .single();

  return data;
}

/**
 * Get cached owner profiles for a league
 */
export async function getOwnerProfiles(leagueId: string) {
  if (!isSupabaseConfigured()) return [];

  const supabase = getSupabaseServer();
  const { data } = await supabase
    .from('owner_profiles')
    .select('*')
    .eq('league_id', leagueId);

  return data || [];
}
