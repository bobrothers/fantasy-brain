/**
 * Resting Players API
 *
 * GET /api/resting - Get all confirmed resting players
 * GET /api/resting?player=Name - Check if specific player is resting via news search
 * POST /api/resting/refresh - Refresh resting list from news (future enhancement)
 */

import { NextRequest, NextResponse } from 'next/server';
import { RESTING_PLAYERS_WEEK_18, isConfirmedResting } from '@/lib/data/resting-players';
import { getCurrentWeek } from '@/lib/schedule';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const playerName = searchParams.get('player');

  try {
    const { week } = await getCurrentWeek();

    // If checking a specific player
    if (playerName) {
      // First check our confirmed list
      const confirmed = isConfirmedResting(playerName);
      if (confirmed) {
        return NextResponse.json({
          player: playerName,
          isResting: true,
          reason: confirmed.reason,
          source: confirmed.source,
          confidence: 'confirmed',
          week,
        });
      }

      // For Week 15+, we could do a live news search here
      // For now, return not confirmed
      return NextResponse.json({
        player: playerName,
        isResting: false,
        reason: 'Not in confirmed resting list',
        confidence: 'unknown',
        week,
        hint: week >= 15 ? 'Check news sources for latest updates' : null,
      });
    }

    // Return all confirmed resting players
    return NextResponse.json({
      week,
      lastUpdated: 'January 2026',
      players: RESTING_PLAYERS_WEEK_18,
      count: RESTING_PLAYERS_WEEK_18.length,
      sources: [
        'https://dknetwork.draftkings.com/2026/01/01/which-teams-will-rest-starters-in-week-18-3/',
        'https://www.rotoballer.com/nfl-inactives-week-18-which-teams-are-resting-starters-whos-sitting-and-playing-2025/1790202',
        'https://www.si.com/nfl/nfl-week-18-tracker-playoff-picture',
      ],
    });
  } catch (error) {
    console.error('Resting check error:', error);
    return NextResponse.json({ error: 'Failed to check resting status' }, { status: 500 });
  }
}
