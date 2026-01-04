/**
 * Lineup Optimizer Agent
 *
 * Generates optimal lineup recommendations based on:
 * - Edge scores from Fantasy Brain analysis
 * - Matchup analysis
 * - Risk preferences
 * - Opponent projection (for GPP vs cash game strategy)
 */

import { createTrackedClient, calculateCost } from '../db/costs';
import { getSupabaseServer, isSupabaseConfigured } from '../db/supabase';
import { sleeper } from '../providers/sleeper';
import { analyzePlayer } from '../edge-detector';
import { espn } from '../providers/espn';

const CLAUDE_MODEL = 'claude-sonnet-4-20250514';

interface PlayerWithEdge {
  id: string;
  name: string;
  position: string;
  team?: string;
  edgeScore: number;
  confidence: number;
  recommendation: string;
  keyEdges: string[];
  projectedPoints?: number;
}

interface LineupSlot {
  position: string;
  player: PlayerWithEdge;
  reasoning: string;
}

interface LineupRecommendation {
  starters: LineupSlot[];
  bench: PlayerWithEdge[];
  flexAlternatives: Array<{
    player: PlayerWithEdge;
    reasoning: string;
  }>;
  projectedPoints: number;
  floorProjection: number;
  ceilingProjection: number;
  keyMatchups: string;
  riskFactors: string;
  aiReasoning: string;
}

export interface LineupOptimizerResult {
  success: boolean;
  recommendation?: LineupRecommendation;
  apiCostUsd: number;
  error?: string;
}

/**
 * Get edge analysis for all players in roster
 */
async function analyzeRoster(
  playerIds: string[],
  week: number
): Promise<PlayerWithEdge[]> {
  const players = await sleeper.getAllPlayers();
  const analyzed: PlayerWithEdge[] = [];

  for (const id of playerIds) {
    const player = players.get(id);
    if (!player || !['QB', 'RB', 'WR', 'TE'].includes(player.position || '')) {
      continue;
    }

    const name = player.full_name || `${player.first_name} ${player.last_name}`;

    try {
      const analysis = await analyzePlayer(name, week);
      if (analysis) {
        analyzed.push({
          id,
          name,
          position: player.position || 'Unknown',
          team: player.team || undefined,
          edgeScore: analysis.overallImpact,
          confidence: analysis.confidence,
          recommendation: analysis.recommendation,
          keyEdges: analysis.signals
            .filter(e => Math.abs(e.magnitude) >= 1)
            .map(e => `${e.type}: ${e.magnitude > 0 ? '+' : ''}${e.magnitude.toFixed(1)}`),
        });
      } else {
        // No analysis available, add with neutral score
        analyzed.push({
          id,
          name,
          position: player.position || 'Unknown',
          team: player.team || undefined,
          edgeScore: 0,
          confidence: 50,
          recommendation: 'NEUTRAL',
          keyEdges: [],
        });
      }
    } catch {
      // Add player with neutral score on error
      analyzed.push({
        id,
        name,
        position: player.position || 'Unknown',
        team: player.team || undefined,
        edgeScore: 0,
        confidence: 50,
        recommendation: 'NEUTRAL',
        keyEdges: [],
      });
    }
  }

  return analyzed;
}

/**
 * Generate optimal lineup using Claude
 */
async function generateLineup(
  players: PlayerWithEdge[],
  rosterPositions: string[],
  riskPreference: 'safe' | 'balanced' | 'aggressive',
  opponentProjection?: number
): Promise<{ recommendation: LineupRecommendation; costUsd: number }> {
  const client = createTrackedClient('agent/lineup-optimizer');

  // Count required positions
  const positionCounts: Record<string, number> = {};
  for (const pos of rosterPositions) {
    if (['QB', 'RB', 'WR', 'TE', 'FLEX', 'SUPER_FLEX'].includes(pos)) {
      positionCounts[pos] = (positionCounts[pos] || 0) + 1;
    }
  }

  const systemPrompt = `You are an expert fantasy football lineup optimizer. Your job is to select the optimal starting lineup based on edge analysis data.

Consider:
- Edge scores indicate hidden advantages/disadvantages
- Positive scores = good matchup/situation
- Negative scores = concerning matchup/situation
- Confidence indicates reliability of the edge signal
- FLEX positions can be RB, WR, or TE

Risk preferences:
- SAFE: Prioritize floor, consistent players
- BALANCED: Mix of floor and ceiling
- AGGRESSIVE: Prioritize ceiling, boom potential

${opponentProjection ? `Opponent projected for ${opponentProjection} points - adjust strategy accordingly.` : ''}`;

  const userPrompt = `Generate the optimal lineup from these players:

AVAILABLE PLAYERS (sorted by edge score):
${players
  .sort((a, b) => b.edgeScore - a.edgeScore)
  .map(p => `- ${p.name} (${p.position}, ${p.team || '?'}) | Edge: ${p.edgeScore > 0 ? '+' : ''}${p.edgeScore.toFixed(1)} | Conf: ${p.confidence}% | ${p.recommendation}
    Key edges: ${p.keyEdges.length > 0 ? p.keyEdges.join(', ') : 'None significant'}`)
  .join('\n')}

ROSTER REQUIREMENTS:
${Object.entries(positionCounts).map(([pos, count]) => `- ${pos}: ${count}`).join('\n')}

RISK PREFERENCE: ${riskPreference.toUpperCase()}
${opponentProjection ? `OPPONENT PROJECTION: ${opponentProjection} points` : ''}

Return a JSON object with this structure:
{
  "starters": [
    {
      "position": "QB",
      "playerId": "player_id",
      "playerName": "Player Name",
      "reasoning": "Why this player is starting"
    }
  ],
  "bench": [
    {
      "playerId": "player_id",
      "playerName": "Player Name"
    }
  ],
  "flexAlternatives": [
    {
      "playerId": "player_id",
      "playerName": "Player Name",
      "reasoning": "When to consider this player instead"
    }
  ],
  "projectedPoints": 125.5,
  "floorProjection": 105.0,
  "ceilingProjection": 155.0,
  "keyMatchups": "Brief summary of key matchups to watch",
  "riskFactors": "Main risks with this lineup",
  "overallStrategy": "Brief explanation of lineup strategy"
}

Fill all required roster positions. Include reasoning for key decisions.`;

  const response = await client.createMessage({
    model: CLAUDE_MODEL,
    max_tokens: 2500,
    messages: [{ role: 'user', content: userPrompt }],
    system: systemPrompt,
  });

  const content = response.content[0];
  if (content.type !== 'text') {
    throw new Error('Unexpected response type');
  }

  // Parse JSON from response
  let jsonStr = content.text;
  const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    jsonStr = jsonMatch[1];
  }

  const parsed = JSON.parse(jsonStr);

  const costUsd = calculateCost(CLAUDE_MODEL, {
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
  });

  // Map response to our structure
  const recommendation: LineupRecommendation = {
    starters: parsed.starters.map((s: Record<string, string>) => {
      const player = players.find(p => p.id === s.playerId || p.name === s.playerName);
      return {
        position: s.position,
        player: player || {
          id: s.playerId,
          name: s.playerName,
          position: s.position,
          edgeScore: 0,
          confidence: 50,
          recommendation: 'NEUTRAL',
          keyEdges: [],
        },
        reasoning: s.reasoning,
      };
    }),
    bench: parsed.bench.map((b: Record<string, string>) => {
      const player = players.find(p => p.id === b.playerId || p.name === b.playerName);
      return player || {
        id: b.playerId,
        name: b.playerName,
        position: 'Unknown',
        edgeScore: 0,
        confidence: 50,
        recommendation: 'NEUTRAL',
        keyEdges: [],
      };
    }),
    flexAlternatives: parsed.flexAlternatives.map((f: Record<string, string>) => {
      const player = players.find(p => p.id === f.playerId || p.name === f.playerName);
      return {
        player: player || {
          id: f.playerId,
          name: f.playerName,
          position: 'Unknown',
          edgeScore: 0,
          confidence: 50,
          recommendation: 'NEUTRAL',
          keyEdges: [],
        },
        reasoning: f.reasoning,
      };
    }),
    projectedPoints: parsed.projectedPoints,
    floorProjection: parsed.floorProjection,
    ceilingProjection: parsed.ceilingProjection,
    keyMatchups: parsed.keyMatchups,
    riskFactors: parsed.riskFactors,
    aiReasoning: parsed.overallStrategy,
  };

  return { recommendation, costUsd };
}

/**
 * Store lineup recommendation in database
 */
async function storeRecommendation(
  leagueId: string | undefined,
  userId: string | undefined,
  season: number,
  week: number,
  riskPreference: string,
  opponentProjection: number | undefined,
  recommendation: LineupRecommendation,
  costUsd: number
): Promise<void> {
  if (!isSupabaseConfigured()) return;

  const supabase = getSupabaseServer();

  await supabase.from('lineup_recommendations').insert({
    league_id: leagueId,
    user_id: userId,
    season,
    week,
    risk_preference: riskPreference,
    opponent_projection: opponentProjection,
    optimal_lineup: recommendation.starters,
    bench: recommendation.bench,
    flex_alternatives: recommendation.flexAlternatives,
    player_decisions: recommendation.starters.map(s => ({
      player: s.player.name,
      position: s.position,
      reasoning: s.reasoning,
    })),
    projected_points: recommendation.projectedPoints,
    floor_projection: recommendation.floorProjection,
    ceiling_projection: recommendation.ceilingProjection,
    key_matchups: recommendation.keyMatchups,
    risk_factors: recommendation.riskFactors,
    ai_reasoning: recommendation.aiReasoning,
    ai_analysis: recommendation,
    api_cost_usd: costUsd,
  });
}

/**
 * Run the Lineup Optimizer Agent
 */
export async function runLineupOptimizer(options: {
  userRoster: string[];
  rosterPositions?: string[];
  riskPreference?: 'safe' | 'balanced' | 'aggressive';
  opponentProjection?: number;
  leagueId?: string;
  userId?: string;
  week?: number;
  season?: number;
}): Promise<LineupOptimizerResult> {
  console.log(`[LineupOptimizer] Analyzing ${options.userRoster.length} players`);

  try {
    // Get current week if not provided
    const currentState = await espn.getCurrentWeek();
    const week = options.week || currentState.week;
    const season = options.season || currentState.season;

    // Default roster positions (standard)
    const rosterPositions = options.rosterPositions || [
      'QB', 'RB', 'RB', 'WR', 'WR', 'TE', 'FLEX', 'FLEX'
    ];

    const riskPreference = options.riskPreference || 'balanced';

    // Analyze all roster players
    const analyzedPlayers = await analyzeRoster(options.userRoster, week);

    if (analyzedPlayers.length === 0) {
      return {
        success: false,
        apiCostUsd: 0,
        error: 'No valid players found in roster',
      };
    }

    console.log(`[LineupOptimizer] Analyzed ${analyzedPlayers.length} players with edges`);

    // Generate optimal lineup
    const { recommendation, costUsd } = await generateLineup(
      analyzedPlayers,
      rosterPositions,
      riskPreference,
      options.opponentProjection
    );

    // Store recommendation
    await storeRecommendation(
      options.leagueId,
      options.userId,
      season,
      week,
      riskPreference,
      options.opponentProjection,
      recommendation,
      costUsd
    );

    console.log(`[LineupOptimizer] Generated lineup with ${recommendation.projectedPoints} projected points`);

    return {
      success: true,
      recommendation,
      apiCostUsd: costUsd,
    };
  } catch (error) {
    console.error('[LineupOptimizer] Agent error:', error);
    return {
      success: false,
      apiCostUsd: 0,
      error: String(error),
    };
  }
}

/**
 * Get recent lineup recommendations
 */
export async function getRecentLineupRecommendations(
  leagueId?: string,
  week?: number,
  limit: number = 5
) {
  if (!isSupabaseConfigured()) return [];

  const supabase = getSupabaseServer();

  let query = supabase
    .from('lineup_recommendations')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (leagueId) {
    query = query.eq('league_id', leagueId);
  }

  if (week) {
    query = query.eq('week', week);
  }

  const { data } = await query;
  return data || [];
}
