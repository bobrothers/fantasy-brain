import { NextRequest, NextResponse } from 'next/server';
import edgeDetector from '@/lib/edge-detector';
import { isConfirmedResting } from '@/lib/data/resting-players';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const playerName = searchParams.get('player');

  if (!playerName) {
    return NextResponse.json({ error: 'Player name required' }, { status: 400 });
  }

  try {
    const result = await edgeDetector.analyzePlayer(playerName);
    
    if (!result) {
      return NextResponse.json({ error: 'Player not found' }, { status: 404 });
    }

    // Helper to extract signals for a given type prefix
    const getSignalsForType = (typePrefix: string) =>
      result.signals.filter(s => s.type.startsWith(typePrefix));

    // Check if player is confirmed resting
    const restingInfo = isConfirmedResting(playerName);

    // Transform result into API-friendly format
    const response = {
      player: {
        name: result.player.name,
        team: result.player.team || 'FA',
        position: result.player.position,
      },
      week: result.week,
      edges: {
        weather: {
          summary: result.summary.weather,
          signals: getSignalsForType('weather'),
        },
        travel: {
          summary: result.summary.travel,
          signals: getSignalsForType('travel'),
        },
        olHealth: {
          summary: result.summary.olInjury,
          signals: getSignalsForType('ol_'),
        },
        betting: {
          summary: result.summary.betting,
          signals: getSignalsForType('betting'),
        },
        matchup: {
          summary: result.summary.defenseMatchup,
          signals: getSignalsForType('matchup_def'),
        },
        oppDefense: {
          summary: result.summary.opposingDInjuries,
          signals: getSignalsForType('matchup_def_injury'),
        },
        usage: {
          summary: result.summary.usageTrends,
          signals: getSignalsForType('usage'),
        },
        contract: {
          summary: result.summary.contractIncentive,
          signals: getSignalsForType('contract'),
        },
        revenge: {
          summary: result.summary.revengeGame,
          signals: getSignalsForType('revenge'),
        },
        redZone: {
          summary: result.summary.redZone,
          signals: getSignalsForType('redzone'),
        },
        homeAway: {
          summary: result.summary.homeAway,
          signals: getSignalsForType('home_away'),
        },
        primetime: {
          summary: result.summary.primetime,
          signals: getSignalsForType('primetime'),
        },
        division: {
          summary: result.summary.divisionRivalry,
          signals: getSignalsForType('division'),
        },
        rest: {
          summary: result.summary.restAdvantage,
          signals: getSignalsForType('rest_'),
        },
        venue: {
          summary: result.summary.indoorOutdoor,
          signals: getSignalsForType('indoor_outdoor'),
        },
        coverage: {
          summary: result.summary.coverageMatchup,
          signals: getSignalsForType('coverage'),
        },
      },
      overall: {
        impact: restingInfo ? -10 : result.overallImpact,
        confidence: restingInfo ? 99 : result.confidence,
        recommendation: restingInfo
          ? `DO NOT START - ${restingInfo.reason}`
          : result.recommendation,
      },
      resting: restingInfo
        ? { isResting: true, reason: restingInfo.reason }
        : null,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Analysis error:', error);
    return NextResponse.json(
      { error: 'Analysis failed' },
      { status: 500 }
    );
  }
}
