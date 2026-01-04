/**
 * Outcomes Fetch API
 *
 * Fetches actual fantasy points for a week and stores them in the database.
 * Protected by CRON_SECRET for Vercel Cron jobs.
 *
 * Vercel Cron: Runs Tuesday 10am UTC (after all NFL games complete)
 */

import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
import { fetchAndStoreOutcomes } from '@/lib/db/outcomes';
import { espn } from '@/lib/providers/espn';

export async function GET(request: NextRequest) {
  // Verify cron secret (required for Vercel Cron)
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  const searchParams = request.nextUrl.searchParams;
  const secretParam = searchParams.get('secret');

  // Allow requests without auth in development, require in production
  // Accept secret via header (Vercel Cron) or query param (manual trigger)
  if (process.env.NODE_ENV === 'production' && cronSecret) {
    const isAuthorized =
      authHeader === `Bearer ${cronSecret}` ||
      secretParam === cronSecret;

    if (!isAuthorized) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  try {
    // Get current week from ESPN
    const currentState = await espn.getCurrentWeek();
    const season = currentState.season;

    // Check for week override in query params
    const weekParam = searchParams.get('week');
    const seasonParam = searchParams.get('season');

    // Use params if provided, otherwise fetch previous week (games are done)
    const week = weekParam ? parseInt(weekParam) : currentState.week - 1;
    const targetSeason = seasonParam ? parseInt(seasonParam) : season;

    if (week < 1 || week > 18) {
      return NextResponse.json(
        { error: 'Invalid week. Must be 1-18.' },
        { status: 400 }
      );
    }

    console.log(`[Outcomes] Fetching outcomes for week ${week}, season ${targetSeason}`);

    const result = await fetchAndStoreOutcomes(week, targetSeason);

    return NextResponse.json({
      success: true,
      week,
      season: targetSeason,
      stored: result.stored,
      errors: result.errors.length > 0 ? result.errors : undefined,
    });
  } catch (error) {
    console.error('[Outcomes] Fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch outcomes' },
      { status: 500 }
    );
  }
}

// Allow POST for manual triggering
export async function POST(request: NextRequest) {
  return GET(request);
}
