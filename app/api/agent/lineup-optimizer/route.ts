/**
 * Lineup Optimizer Agent API
 *
 * POST /api/agent/lineup-optimizer
 * Body: {
 *   user_roster: string[] (player IDs),
 *   roster_positions?: string[],
 *   risk_preference?: 'safe' | 'balanced' | 'aggressive',
 *   opponent_projection?: number,
 *   league_id?: string,
 *   user_id?: string,
 *   week?: number,
 *   season?: number
 * }
 *
 * Generates optimal lineup based on edge analysis.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  runLineupOptimizer,
  getRecentLineupRecommendations,
} from '@/lib/agent/lineup-optimizer';

export const dynamic = 'force-dynamic';
export const maxDuration = 120; // Allow more time for analyzing multiple players

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      user_roster,
      roster_positions,
      risk_preference,
      opponent_projection,
      league_id,
      user_id,
      week,
      season,
    } = body;

    if (!user_roster || !Array.isArray(user_roster) || user_roster.length === 0) {
      return NextResponse.json(
        { error: 'user_roster must be a non-empty array of player IDs' },
        { status: 400 }
      );
    }

    if (risk_preference && !['safe', 'balanced', 'aggressive'].includes(risk_preference)) {
      return NextResponse.json(
        { error: 'risk_preference must be "safe", "balanced", or "aggressive"' },
        { status: 400 }
      );
    }

    console.log(`[API] Running Lineup Optimizer for ${user_roster.length} players`);

    const result = await runLineupOptimizer({
      userRoster: user_roster,
      rosterPositions: roster_positions,
      riskPreference: risk_preference,
      opponentProjection: opponent_projection,
      leagueId: league_id,
      userId: user_id,
      week,
      season,
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to optimize lineup' },
        { status: 500 }
      );
    }

    const rec = result.recommendation!;

    return NextResponse.json({
      success: true,
      apiCostUsd: result.apiCostUsd,
      lineup: {
        starters: rec.starters.map(s => ({
          position: s.position,
          player: {
            id: s.player.id,
            name: s.player.name,
            team: s.player.team,
            edgeScore: s.player.edgeScore,
            recommendation: s.player.recommendation,
          },
          reasoning: s.reasoning,
        })),
        bench: rec.bench.map(p => ({
          id: p.id,
          name: p.name,
          position: p.position,
          team: p.team,
          edgeScore: p.edgeScore,
        })),
        flexAlternatives: rec.flexAlternatives.map(f => ({
          player: {
            id: f.player.id,
            name: f.player.name,
            position: f.player.position,
            edgeScore: f.player.edgeScore,
          },
          reasoning: f.reasoning,
        })),
      },
      projections: {
        projected: rec.projectedPoints,
        floor: rec.floorProjection,
        ceiling: rec.ceilingProjection,
      },
      analysis: {
        keyMatchups: rec.keyMatchups,
        riskFactors: rec.riskFactors,
        strategy: rec.aiReasoning,
      },
    });
  } catch (error) {
    console.error('[API] Lineup Optimizer error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET to retrieve recent recommendations
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const leagueId = searchParams.get('league_id') || undefined;
  const week = searchParams.get('week')
    ? parseInt(searchParams.get('week')!)
    : undefined;
  const limit = parseInt(searchParams.get('limit') || '5');

  const recommendations = await getRecentLineupRecommendations(leagueId, week, limit);

  return NextResponse.json({
    success: true,
    recommendations: recommendations.map(r => ({
      id: r.id,
      week: r.week,
      season: r.season,
      riskPreference: r.risk_preference,
      projectedPoints: r.projected_points,
      floor: r.floor_projection,
      ceiling: r.ceiling_projection,
      starters: r.optimal_lineup,
      createdAt: r.created_at,
    })),
  });
}
