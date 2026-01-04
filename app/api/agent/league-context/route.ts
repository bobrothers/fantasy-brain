/**
 * League Context Agent API
 *
 * POST /api/agent/league-context
 * Body: { league_id: string }
 *
 * Analyzes a Sleeper league and creates profiles for:
 * - League tendencies (trade activity, competitiveness)
 * - Owner profiles (trading style, roster needs, tendencies)
 */

import { NextRequest, NextResponse } from 'next/server';
import { runLeagueContextAgent, getLeagueProfile, getOwnerProfiles } from '@/lib/agent/league-context';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { league_id } = body;

    if (!league_id) {
      return NextResponse.json(
        { error: 'league_id is required' },
        { status: 400 }
      );
    }

    console.log(`[API] Running League Context Agent for ${league_id}`);

    const result = await runLeagueContextAgent(league_id);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to analyze league' },
        { status: 500 }
      );
    }

    // Fetch the stored profiles to return
    const leagueProfile = await getLeagueProfile(league_id);
    const ownerProfiles = await getOwnerProfiles(league_id);

    return NextResponse.json({
      success: true,
      leagueId: result.leagueId,
      leagueName: result.leagueName,
      ownersAnalyzed: result.ownersAnalyzed,
      apiCostUsd: result.apiCostUsd,
      league: leagueProfile ? {
        name: leagueProfile.name,
        tradeVolume: leagueProfile.trade_volume,
        avgTradesPerWeek: leagueProfile.avg_trades_per_week,
        competitiveness: leagueProfile.league_competitiveness,
        summary: leagueProfile.ai_summary,
      } : null,
      owners: ownerProfiles.map(o => ({
        displayName: o.display_name,
        teamName: o.team_name,
        rosterStrength: o.roster_strength,
        rosterNeeds: o.roster_needs,
        tradingStyle: o.trading_style,
        summary: o.ai_summary,
      })),
    });
  } catch (error) {
    console.error('[API] League Context Agent error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET to retrieve cached profiles
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const leagueId = searchParams.get('league_id');

  if (!leagueId) {
    return NextResponse.json(
      { error: 'league_id query parameter is required' },
      { status: 400 }
    );
  }

  const leagueProfile = await getLeagueProfile(leagueId);
  const ownerProfiles = await getOwnerProfiles(leagueId);

  if (!leagueProfile) {
    return NextResponse.json(
      { error: 'League not found. Run POST to analyze first.' },
      { status: 404 }
    );
  }

  return NextResponse.json({
    success: true,
    league: {
      id: leagueProfile.league_id,
      name: leagueProfile.name,
      tradeVolume: leagueProfile.trade_volume,
      avgTradesPerWeek: leagueProfile.avg_trades_per_week,
      competitiveness: leagueProfile.league_competitiveness,
      commonPatterns: leagueProfile.common_trade_patterns,
      summary: leagueProfile.ai_summary,
      updatedAt: leagueProfile.updated_at,
    },
    owners: ownerProfiles.map(o => ({
      ownerId: o.owner_id,
      displayName: o.display_name,
      teamName: o.team_name,
      rosterStrength: o.roster_strength,
      rosterNeeds: o.roster_needs,
      tradeAssets: o.trade_assets,
      tradingStyle: o.trading_style,
      valuesYouth: o.values_youth,
      valuesVeterans: o.values_veterans,
      positionPreferences: o.position_preferences,
      buyLowTendency: o.buy_low_tendency,
      sellHighTendency: o.sell_high_tendency,
      tradesMade: o.trades_made,
      summary: o.ai_summary,
    })),
  });
}
