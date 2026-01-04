/**
 * Draft Assistant Agent API
 *
 * POST /api/agent/draft-assistant
 * Body: {
 *   draft_id: string,
 *   league_id?: string,
 *   user_pick_position: number (1-12),
 *   pick_to_record?: {
 *     owner_id: string,
 *     owner_name: string,
 *     player_id: string,
 *     player_name: string,
 *     position: string,
 *     team?: string
 *   },
 *   num_teams?: number,
 *   num_rounds?: number,
 *   draft_type?: 'snake' | 'linear'
 * }
 *
 * Tracks draft picks, detects runs, finds value, recommends picks.
 */

import { NextRequest, NextResponse } from 'next/server';
import { runDraftAssistant, getDraftState } from '@/lib/agent/draft-assistant';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      draft_id,
      league_id,
      user_pick_position,
      pick_to_record,
      num_teams,
      num_rounds,
      draft_type,
    } = body;

    if (!draft_id) {
      return NextResponse.json(
        { error: 'draft_id is required' },
        { status: 400 }
      );
    }

    if (!user_pick_position || user_pick_position < 1) {
      return NextResponse.json(
        { error: 'user_pick_position must be a positive number' },
        { status: 400 }
      );
    }

    console.log(`[API] Running Draft Assistant for draft ${draft_id}`);

    const result = await runDraftAssistant({
      draftId: draft_id,
      leagueId: league_id,
      userPickPosition: user_pick_position,
      pickToRecord: pick_to_record ? {
        ownerId: pick_to_record.owner_id,
        ownerName: pick_to_record.owner_name,
        playerId: pick_to_record.player_id,
        playerName: pick_to_record.player_name,
        position: pick_to_record.position,
        team: pick_to_record.team,
      } : undefined,
      numTeams: num_teams,
      numRounds: num_rounds,
      draftType: draft_type,
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to process draft' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      apiCostUsd: result.apiCostUsd,
      recommendation: {
        topPick: result.recommendation?.topPick,
        alternatives: result.recommendation?.alternatives,
        analysis: {
          positionalScarcity: result.recommendation?.positionalScarcity,
          valueAnalysis: result.recommendation?.valueAnalysis,
          rosterFit: result.recommendation?.rosterFitAnalysis,
          strategy: result.recommendation?.aiReasoning,
        },
      },
      draftState: result.draftState ? {
        currentPick: result.draftState.currentPick,
        recentPicks: result.draftState.recentPicks.map(p => ({
          pickNumber: p.pickNumber,
          round: p.round,
          playerName: p.playerName,
          position: p.position,
          ownerName: p.ownerName,
          pickVsAdp: p.pickVsAdp,
        })),
        positionRuns: result.draftState.positionRuns,
        valuePicks: result.draftState.valuePicks.map(p => ({
          pickNumber: p.pickNumber,
          playerName: p.playerName,
          adp: p.adp,
          value: p.pickVsAdp,
        })),
        reaches: result.draftState.reaches.map(p => ({
          pickNumber: p.pickNumber,
          playerName: p.playerName,
          adp: p.adp,
          reach: p.pickVsAdp,
        })),
      } : null,
    });
  } catch (error) {
    console.error('[API] Draft Assistant error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET to retrieve draft state
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const draftId = searchParams.get('draft_id');

  if (!draftId) {
    return NextResponse.json(
      { error: 'draft_id query parameter is required' },
      { status: 400 }
    );
  }

  const state = await getDraftState(draftId);

  if (!state?.session) {
    return NextResponse.json(
      { error: 'Draft not found' },
      { status: 404 }
    );
  }

  return NextResponse.json({
    success: true,
    draft: {
      id: state.session.draft_id,
      leagueId: state.session.league_id,
      numTeams: state.session.num_teams,
      numRounds: state.session.num_rounds,
      draftType: state.session.draft_type,
      currentPick: state.session.current_pick,
      isComplete: state.session.is_complete,
      positionRuns: state.session.position_runs,
      valuePicks: state.session.value_picks,
      reaches: state.session.reaches,
    },
    picks: state.picks.map(p => ({
      pickNumber: p.pick_number,
      round: p.round,
      ownerName: p.owner_name,
      playerName: p.player_name,
      position: p.position,
      team: p.team,
      adp: p.adp,
      pickVsAdp: p.pick_vs_adp,
    })),
  });
}
