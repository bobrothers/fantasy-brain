/**
 * Learning API
 *
 * Runs the edge weight learning algorithm after accuracy is calculated.
 * Protected by CRON_SECRET for Vercel Cron jobs.
 *
 * Vercel Cron: Runs Tuesday 12pm UTC (after accuracy calculation at 11am)
 */

import { NextRequest, NextResponse } from 'next/server';
import { learnFromAccuracy, getAllWeights } from '@/lib/db/learning';
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
    // Get current season/week from ESPN
    const currentState = await espn.getCurrentWeek();

    // Check for overrides in query params
    const seasonParam = searchParams.get('season');
    const weekParam = searchParams.get('week');
    const season = seasonParam ? parseInt(seasonParam) : currentState.season;
    const week = weekParam ? parseInt(weekParam) : currentState.week - 1; // Learn from previous week

    console.log(`[Learning] Running learning algorithm for season ${season}, week ${week}`);

    const result = await learnFromAccuracy(season, week);

    // Get updated weights for response
    const weights = await getAllWeights();

    return NextResponse.json({
      success: true,
      season,
      week,
      weightsUpdated: result.updated,
      updates: result.updates,
      currentWeights: weights.slice(0, 10), // Top 10 weights
    });
  } catch (error) {
    console.error('[Learning] Error:', error);
    return NextResponse.json(
      { error: 'Failed to run learning algorithm' },
      { status: 500 }
    );
  }
}

// Allow POST for manual triggering
export async function POST(request: NextRequest) {
  return GET(request);
}
