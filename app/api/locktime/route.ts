/**
 * Lock Time API
 * Returns the game lock time for a player's team
 * Also checks if player appears to be resting (healthy scratch)
 */

import { NextRequest, NextResponse } from 'next/server';
import { sleeper } from '@/lib/providers/sleeper';
import { getSchedule, getCurrentWeek } from '@/lib/schedule';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const playerName = searchParams.get('player');
  const team = searchParams.get('team');

  if (!playerName && !team) {
    return NextResponse.json({ error: 'Player name or team required' }, { status: 400 });
  }

  try {
    let playerTeam = team;
    let restingInfo: { isResting: boolean; reason?: string } = { isResting: false };
    let injuryStatus: string | undefined;

    // Get current week first
    const { week } = await getCurrentWeek();

    // Look up player info if name provided
    if (playerName) {
      const player = await sleeper.getPlayerByName(playerName);
      if (!player) {
        return NextResponse.json({ error: 'Player not found' }, { status: 404 });
      }
      playerTeam = player.team;
      injuryStatus = player.injuryStatus;

      // Check if player is resting
      restingInfo = sleeper.isLikelyResting(player, week);
    }

    if (!playerTeam) {
      return NextResponse.json({
        lockTime: null,
        status: 'no_team',
        message: 'Player has no team (free agent)',
      });
    }

    // Get schedule
    const schedule = await getSchedule(week);
    const game = schedule.get(playerTeam);

    if (!game) {
      return NextResponse.json({
        lockTime: null,
        status: 'bye',
        message: 'Team is on bye this week',
      });
    }

    const lockTime = new Date(game.date);
    const now = new Date();

    // Determine lock status
    let status: 'upcoming' | 'imminent' | 'locked';
    const msUntilLock = lockTime.getTime() - now.getTime();

    if (msUntilLock <= 0) {
      status = 'locked';
    } else if (msUntilLock <= 60 * 60 * 1000) {
      // Under 1 hour
      status = 'imminent';
    } else {
      status = 'upcoming';
    }

    return NextResponse.json({
      lockTime: lockTime.toISOString(),
      team: playerTeam,
      opponent: game.opponent,
      isHome: game.isHome,
      status,
      week,
      injuryStatus: injuryStatus || null,
      resting: restingInfo,
    });
  } catch (error) {
    console.error('Lock time error:', error);
    return NextResponse.json({ error: 'Failed to get lock time' }, { status: 500 });
  }
}
