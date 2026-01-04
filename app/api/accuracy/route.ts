/**
 * Accuracy API
 *
 * Returns accuracy report for public display on /accuracy page.
 */

import { NextRequest, NextResponse } from 'next/server';

// Force dynamic - uses searchParams
export const dynamic = 'force-dynamic';
import { calculateAccuracy } from '@/lib/db/accuracy';
import { espn } from '@/lib/providers/espn';

export async function GET(request: NextRequest) {
  try {
    // Get current season from ESPN
    const currentState = await espn.getCurrentWeek();

    // Check for season override in query params
    const searchParams = request.nextUrl.searchParams;
    const seasonParam = searchParams.get('season');
    const season = seasonParam ? parseInt(seasonParam) : currentState.season;

    const report = await calculateAccuracy(season);

    if (!report) {
      // Return empty report structure when no data
      return NextResponse.json({
        season,
        totalPredictions: 0,
        overallHitRate: 0,
        byRecommendation: {},
        byPosition: {},
        byConfidence: {
          high: { total: 0, correct: 0, hitRate: 0 },
          medium: { total: 0, correct: 0, hitRate: 0 },
          low: { total: 0, correct: 0, hitRate: 0 },
        },
        byEdgeType: {},
        biggestHits: [],
        biggestMisses: [],
        updatedAt: new Date().toISOString(),
      });
    }

    return NextResponse.json(report);
  } catch (error) {
    console.error('[Accuracy] API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch accuracy data' },
      { status: 500 }
    );
  }
}
