/**
 * Trade Negotiation Agent API
 *
 * POST /api/agent/trade-negotiator
 * Body: {
 *   league_id: string,
 *   target_player_id?: string,
 *   target_player_name?: string,
 *   user_roster: string[] (player IDs)
 * }
 *
 * Generates 3 trade offer tiers (lowball/fair/overpay) for acquiring a target player.
 */

import { NextRequest, NextResponse } from 'next/server';
import { runTradeNegotiator, getRecentTradeSuggestions } from '@/lib/agent/trade-negotiator';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { league_id, target_player_id, target_player_name, user_roster } = body;

    if (!league_id) {
      return NextResponse.json(
        { error: 'league_id is required' },
        { status: 400 }
      );
    }

    if (!target_player_id && !target_player_name) {
      return NextResponse.json(
        { error: 'Either target_player_id or target_player_name is required' },
        { status: 400 }
      );
    }

    if (!user_roster || !Array.isArray(user_roster) || user_roster.length === 0) {
      return NextResponse.json(
        { error: 'user_roster must be a non-empty array of player IDs' },
        { status: 400 }
      );
    }

    console.log(`[API] Running Trade Negotiator for ${target_player_name || target_player_id}`);

    const result = await runTradeNegotiator({
      leagueId: league_id,
      targetPlayerId: target_player_id,
      targetPlayerName: target_player_name,
      userRoster: user_roster,
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to generate trade offers' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      apiCostUsd: result.apiCostUsd,
      target: {
        playerId: result.suggestion?.targetPlayerId,
        playerName: result.suggestion?.targetPlayerName,
        ownerId: result.suggestion?.targetOwnerId,
        ownerName: result.suggestion?.targetOwnerName,
      },
      analysis: {
        targetValue: result.suggestion?.targetValueAnalysis,
        ownerNotes: result.suggestion?.ownerTendencyNotes,
        tips: result.suggestion?.negotiationTips,
      },
      offers: {
        lowball: {
          players: result.suggestion?.lowball.players,
          reasoning: result.suggestion?.lowball.reasoning,
          successProbability: result.suggestion?.lowball.successProbability,
        },
        fair: {
          players: result.suggestion?.fair.players,
          reasoning: result.suggestion?.fair.reasoning,
          successProbability: result.suggestion?.fair.successProbability,
        },
        overpay: {
          players: result.suggestion?.overpay.players,
          reasoning: result.suggestion?.overpay.reasoning,
          successProbability: result.suggestion?.overpay.successProbability,
        },
      },
      strategy: result.suggestion?.aiReasoning,
    });
  } catch (error) {
    console.error('[API] Trade Negotiator error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET to retrieve recent trade suggestions
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const leagueId = searchParams.get('league_id');
  const limit = parseInt(searchParams.get('limit') || '10');

  if (!leagueId) {
    return NextResponse.json(
      { error: 'league_id query parameter is required' },
      { status: 400 }
    );
  }

  const suggestions = await getRecentTradeSuggestions(leagueId, limit);

  return NextResponse.json({
    success: true,
    suggestions: suggestions.map(s => ({
      id: s.id,
      targetPlayerName: s.target_player_name,
      createdAt: s.created_at,
      offers: {
        lowball: s.lowball_offer,
        fair: s.fair_offer,
        overpay: s.overpay_offer,
      },
      successProbability: s.success_probability,
    })),
  });
}
