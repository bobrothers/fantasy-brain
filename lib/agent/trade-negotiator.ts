/**
 * Trade Negotiation Agent
 *
 * Generates 3 trade offer tiers (lowball/fair/overpay) for acquiring a target player.
 * Uses league context and owner profiles to personalize offers.
 */

import { createTrackedClient, calculateCost } from '../db/costs';
import { getSupabaseServer, isSupabaseConfigured } from '../db/supabase';
import { sleeper } from '../providers/sleeper';
import { getOwnerProfiles, getLeagueProfile } from './league-context';

const CLAUDE_MODEL = 'claude-sonnet-4-20250514';

interface TradeOffer {
  players: Array<{
    playerId: string;
    playerName: string;
    position: string;
  }>;
  reasoning: string;
  successProbability: number;
}

interface TradeSuggestion {
  targetPlayerId: string;
  targetPlayerName: string;
  targetOwnerId: string;
  targetOwnerName: string;
  lowball: TradeOffer;
  fair: TradeOffer;
  overpay: TradeOffer;
  targetValueAnalysis: string;
  ownerTendencyNotes: string;
  negotiationTips: string[];
  aiReasoning: string;
}

export interface TradeNegotiatorResult {
  success: boolean;
  suggestion?: TradeSuggestion;
  apiCostUsd: number;
  error?: string;
}

interface RosterPlayer {
  id: string;
  name: string;
  position: string;
  team?: string;
}

/**
 * Get player info from roster
 */
async function enrichRoster(playerIds: string[]): Promise<RosterPlayer[]> {
  const players = await sleeper.getAllPlayers();
  return playerIds.map(id => {
    const p = players.get(id);
    return {
      id,
      name: p?.full_name || p?.name || `${p?.first_name || ''} ${p?.last_name || ''}`.trim() || id,
      position: p?.position || 'Unknown',
      team: p?.team || undefined,
    };
  }).filter(p => p.position !== 'DEF' && p.position !== 'K'); // Filter out DST/K
}

/**
 * Find which owner has the target player
 */
async function findPlayerOwner(
  leagueId: string,
  targetPlayerId: string
): Promise<{ ownerId: string; ownerName: string; roster: string[] } | null> {
  try {
    const rostersRes = await fetch(`https://api.sleeper.app/v1/league/${leagueId}/rosters`);
    const rosters = await rostersRes.json();

    const usersRes = await fetch(`https://api.sleeper.app/v1/league/${leagueId}/users`);
    const users = await usersRes.json();

    for (const roster of rosters) {
      if (roster.players?.includes(targetPlayerId)) {
        const user = users.find((u: { user_id: string }) => u.user_id === roster.owner_id);
        return {
          ownerId: roster.owner_id,
          ownerName: user?.display_name || roster.owner_id,
          roster: roster.players,
        };
      }
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Generate trade offers using Claude
 */
async function generateTradeOffers(
  targetPlayer: RosterPlayer,
  targetOwner: { ownerId: string; ownerName: string; profile: Record<string, unknown> | null },
  userRoster: RosterPlayer[],
  leagueProfile: Record<string, unknown> | null
): Promise<{ suggestion: TradeSuggestion; costUsd: number }> {
  const client = createTrackedClient('agent/trade-negotiator');

  const systemPrompt = `You are an expert fantasy football trade negotiator. Your job is to analyze player values and owner tendencies to generate strategic trade offers.

Generate 3 trade tiers:
1. LOWBALL: Minimum offer that might work if owner is desperate or undervalues player
2. FAIR: Balanced trade that should be accepted by a reasonable owner
3. OVERPAY: Premium offer when you really need this player

Consider:
- Target player's value and recent performance
- Owner's trading style and tendencies
- What positions the owner needs
- Your roster's trade assets

Be realistic about success probabilities.`;

  const userPrompt = `Generate trade offers for this scenario:

TARGET PLAYER:
- Name: ${targetPlayer.name}
- Position: ${targetPlayer.position}
- Team: ${targetPlayer.team || 'Unknown'}

TARGET OWNER:
- Name: ${targetOwner.ownerName}
${targetOwner.profile ? `- Trading Style: ${(targetOwner.profile as Record<string, unknown>).trading_style}
- Values Youth: ${(targetOwner.profile as Record<string, unknown>).values_youth}
- Values Veterans: ${(targetOwner.profile as Record<string, unknown>).values_veterans}
- Roster Needs: ${JSON.stringify((targetOwner.profile as Record<string, unknown>).roster_needs)}
- Buy Low Tendency: ${(targetOwner.profile as Record<string, unknown>).buy_low_tendency}/10
- Sell High Tendency: ${(targetOwner.profile as Record<string, unknown>).sell_high_tendency}/10
- AI Summary: ${(targetOwner.profile as Record<string, unknown>).ai_summary}` : '- No profile available (use general strategy)'}

YOUR AVAILABLE TRADE ASSETS:
${userRoster.map(p => `- ${p.name} (${p.position}, ${p.team || 'Unknown'})`).join('\n')}

${leagueProfile ? `LEAGUE CONTEXT:
- Trade Volume: ${(leagueProfile as Record<string, unknown>).trade_volume}
- Competitiveness: ${(leagueProfile as Record<string, unknown>).league_competitiveness}` : ''}

Return a JSON object with this exact structure:
{
  "targetValueAnalysis": "Brief analysis of target player's trade value",
  "ownerTendencyNotes": "How to approach this specific owner",
  "negotiationTips": ["tip1", "tip2", "tip3"],
  "lowball": {
    "players": [{"playerId": "id", "playerName": "name", "position": "POS"}],
    "reasoning": "Why this might work",
    "successProbability": 0-100
  },
  "fair": {
    "players": [{"playerId": "id", "playerName": "name", "position": "POS"}],
    "reasoning": "Why this is balanced",
    "successProbability": 0-100
  },
  "overpay": {
    "players": [{"playerId": "id", "playerName": "name", "position": "POS"}],
    "reasoning": "When to use this offer",
    "successProbability": 0-100
  },
  "overallStrategy": "Brief summary of negotiation approach"
}

IMPORTANT: Only use players from the "YOUR AVAILABLE TRADE ASSETS" list. Include their exact playerId.`;

  const response = await client.createMessage({
    model: CLAUDE_MODEL,
    max_tokens: 2000,
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

  const suggestion: TradeSuggestion = {
    targetPlayerId: targetPlayer.id,
    targetPlayerName: targetPlayer.name,
    targetOwnerId: targetOwner.ownerId,
    targetOwnerName: targetOwner.ownerName,
    lowball: parsed.lowball,
    fair: parsed.fair,
    overpay: parsed.overpay,
    targetValueAnalysis: parsed.targetValueAnalysis,
    ownerTendencyNotes: parsed.ownerTendencyNotes,
    negotiationTips: parsed.negotiationTips,
    aiReasoning: parsed.overallStrategy,
  };

  return { suggestion, costUsd };
}

/**
 * Store trade suggestion in database
 */
async function storeSuggestion(
  leagueId: string,
  suggestion: TradeSuggestion,
  userRoster: RosterPlayer[],
  costUsd: number
): Promise<void> {
  if (!isSupabaseConfigured()) return;

  const supabase = getSupabaseServer();

  await supabase.from('trade_suggestions').insert({
    league_id: leagueId,
    target_player_id: suggestion.targetPlayerId,
    target_player_name: suggestion.targetPlayerName,
    target_owner_id: suggestion.targetOwnerId,
    user_roster: userRoster,
    lowball_offer: suggestion.lowball,
    fair_offer: suggestion.fair,
    overpay_offer: suggestion.overpay,
    target_value_analysis: suggestion.targetValueAnalysis,
    owner_tendency_notes: suggestion.ownerTendencyNotes,
    negotiation_tips: suggestion.negotiationTips.join('\n'),
    success_probability: {
      lowball: suggestion.lowball.successProbability,
      fair: suggestion.fair.successProbability,
      overpay: suggestion.overpay.successProbability,
    },
    ai_reasoning: suggestion.aiReasoning,
    ai_analysis: suggestion,
    api_cost_usd: costUsd,
  });
}

/**
 * Run the Trade Negotiation Agent
 */
export async function runTradeNegotiator(options: {
  leagueId: string;
  targetPlayerId?: string;
  targetPlayerName?: string;
  userRoster: string[]; // Array of player IDs
}): Promise<TradeNegotiatorResult> {
  const { leagueId, userRoster } = options;

  console.log(`[TradeNegotiator] Generating offers for league ${leagueId}`);

  try {
    // Resolve target player
    let targetPlayerId = options.targetPlayerId;
    if (!targetPlayerId && options.targetPlayerName) {
      // Search for player by name
      const players = await sleeper.getAllPlayers();
      for (const [id, player] of players) {
        const name = player.full_name || `${player.first_name} ${player.last_name}`;
        if (name.toLowerCase().includes(options.targetPlayerName.toLowerCase())) {
          targetPlayerId = id;
          break;
        }
      }
    }

    if (!targetPlayerId) {
      return {
        success: false,
        apiCostUsd: 0,
        error: 'Could not find target player',
      };
    }

    // Get target player info
    const players = await sleeper.getAllPlayers();
    const targetPlayerData = players.get(targetPlayerId);
    if (!targetPlayerData) {
      return {
        success: false,
        apiCostUsd: 0,
        error: 'Target player not found',
      };
    }

    const targetPlayer: RosterPlayer = {
      id: targetPlayerId,
      name: targetPlayerData.full_name || `${targetPlayerData.first_name} ${targetPlayerData.last_name}`,
      position: targetPlayerData.position || 'Unknown',
      team: targetPlayerData.team || undefined,
    };

    // Find who owns the target player
    const ownerInfo = await findPlayerOwner(leagueId, targetPlayerId);
    if (!ownerInfo) {
      return {
        success: false,
        apiCostUsd: 0,
        error: 'Could not find player owner in this league',
      };
    }

    // Get owner profile if available
    const ownerProfiles = await getOwnerProfiles(leagueId);
    const ownerProfile = ownerProfiles.find(o => o.owner_id === ownerInfo.ownerId);

    // Get league profile if available
    const leagueProfile = await getLeagueProfile(leagueId);

    // Enrich user roster
    const enrichedRoster = await enrichRoster(userRoster);

    // Generate trade offers
    const { suggestion, costUsd } = await generateTradeOffers(
      targetPlayer,
      {
        ownerId: ownerInfo.ownerId,
        ownerName: ownerInfo.ownerName,
        profile: ownerProfile,
      },
      enrichedRoster,
      leagueProfile
    );

    // Store suggestion
    await storeSuggestion(leagueId, suggestion, enrichedRoster, costUsd);

    console.log(`[TradeNegotiator] Generated 3 trade tiers for ${targetPlayer.name}`);

    return {
      success: true,
      suggestion,
      apiCostUsd: costUsd,
    };
  } catch (error) {
    console.error('[TradeNegotiator] Agent error:', error);
    return {
      success: false,
      apiCostUsd: 0,
      error: String(error),
    };
  }
}

/**
 * Get recent trade suggestions for a league
 */
export async function getRecentTradeSuggestions(leagueId: string, limit: number = 10) {
  if (!isSupabaseConfigured()) return [];

  const supabase = getSupabaseServer();
  const { data } = await supabase
    .from('trade_suggestions')
    .select('*')
    .eq('league_id', leagueId)
    .order('created_at', { ascending: false })
    .limit(limit);

  return data || [];
}
