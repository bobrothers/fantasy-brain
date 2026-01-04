/**
 * News Monitor Cron Endpoint
 *
 * Runs hourly to check for player news.
 * Smart scheduling:
 * - Base: Every 3 hours during off-peak
 * - Game day: 30 min before kickoff for each game slot
 *
 * Vercel Cron: Runs hourly, checks if in monitoring window
 */

import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

import { espn } from '@/lib/providers/espn';
import { isInMonitoringWindow, fetchAndStoreSchedule, getTeamsPlayingSoon } from '@/lib/news/schedule';
import { runNewsMonitor, deactivateOldAlerts } from '@/lib/news/monitor';

export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization');
  const agentSecret = request.headers.get('x-agent-secret');
  const cronSecret = process.env.CRON_SECRET;
  const searchParams = request.nextUrl.searchParams;
  const force = searchParams.get('force') === 'true';

  if (process.env.NODE_ENV === 'production' && cronSecret) {
    const isAuthorized =
      authHeader === `Bearer ${cronSecret}` ||
      agentSecret === cronSecret;

    if (!isAuthorized) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  try {
    // Get current week from ESPN
    const currentState = await espn.getCurrentWeek();
    const season = currentState.season;
    const week = currentState.week;

    // Refresh schedule for current week (idempotent)
    await fetchAndStoreSchedule(season, week);

    // Check if we should run monitoring
    const windowCheck = await isInMonitoringWindow();

    if (!windowCheck.shouldMonitor && !force) {
      return NextResponse.json({
        success: true,
        action: 'skipped',
        reason: windowCheck.reason,
        nextGameIn: windowCheck.minutesUntilNextGame,
      });
    }

    // Determine run type and priority teams
    const runType = windowCheck.gameSlot ? 'pre_game' : 'scheduled';
    const prioritizeTeams = windowCheck.gameSlot
      ? await getTeamsPlayingSoon(60)
      : undefined;

    // Run the monitor
    const result = await runNewsMonitor({
      season,
      week,
      runType: force ? 'manual' : runType,
      gameSlot: windowCheck.gameSlot,
      prioritizeTeams,
    });

    // Clean up old alerts
    const deactivated = await deactivateOldAlerts();

    return NextResponse.json({
      success: true,
      action: 'ran',
      reason: force ? 'Manual trigger' : windowCheck.reason,
      gameSlot: windowCheck.gameSlot,
      result: {
        playersChecked: result.playersChecked,
        alertsCreated: result.alertsCreated,
        newsItemsProcessed: result.newsItemsProcessed,
        durationMs: result.durationMs,
        errors: result.errors,
      },
      alertsDeactivated: deactivated,
      season,
      week,
    });
  } catch (error) {
    console.error('[News Monitor] Error:', error);
    return NextResponse.json(
      { error: 'News monitor failed', details: String(error) },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
