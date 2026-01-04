/**
 * Accuracy Calculation API
 *
 * Calculates prediction accuracy after outcomes are fetched.
 * Protected by CRON_SECRET for Vercel Cron jobs.
 *
 * Vercel Cron: Runs Tuesday 11am UTC (after outcomes are fetched)
 */

import { NextRequest, NextResponse } from 'next/server';
import { calculateAccuracy } from '@/lib/db/accuracy';
import { espn } from '@/lib/providers/espn';

export async function GET(request: NextRequest) {
  // Verify cron secret (required for Vercel Cron)
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  // Allow requests without auth in development, require in production
  if (process.env.NODE_ENV === 'production' && cronSecret) {
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  try {
    // Get current season from ESPN
    const currentState = await espn.getCurrentWeek();

    // Check for season override in query params
    const searchParams = request.nextUrl.searchParams;
    const seasonParam = searchParams.get('season');
    const season = seasonParam ? parseInt(seasonParam) : currentState.season;

    console.log(`[Accuracy] Calculating accuracy for season ${season}`);

    const report = await calculateAccuracy(season);

    if (!report) {
      return NextResponse.json(
        { error: 'Failed to calculate accuracy' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      season,
      totalPredictions: report.totalPredictions,
      overallHitRate: report.overallHitRate,
      topEdges: Object.entries(report.byEdgeType)
        .slice(0, 5)
        .map(([type, stats]) => ({ type, hitRate: stats.hitRate })),
      updatedAt: report.updatedAt,
    });
  } catch (error) {
    console.error('[Accuracy] Calculation error:', error);
    return NextResponse.json(
      { error: 'Failed to calculate accuracy' },
      { status: 500 }
    );
  }
}

// Allow POST for manual triggering
export async function POST(request: NextRequest) {
  return GET(request);
}
