/**
 * Accuracy Calculation + Learning + Analysis + AI Agent + News API
 *
 * Full weekly pipeline:
 * 1. Calculate prediction accuracy
 * 2. Run learning algorithm to adjust weights
 * 3. Deep analysis of predictions (why did we miss?)
 * 4. Pattern detection across all predictions
 * 5. AI improvement agent (analyzes patterns, suggests/applies improvements)
 * 6. Refresh NFL schedule for upcoming week
 * 7. Run news monitor to check for player updates
 *
 * Protected by CRON_SECRET for Vercel Cron jobs.
 * Vercel Cron: Runs Tuesday 11am UTC (after outcomes are fetched)
 */

import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 120; // Allow 120s for full pipeline including AI agent

import { calculateAccuracy } from '@/lib/db/accuracy';
import { learnFromAccuracy } from '@/lib/db/learning';
import { analyzeWeekPredictions } from '@/lib/db/analysis';
import { runImprovementAgent } from '@/lib/agent/improve';
import { fetchAndStoreSchedule } from '@/lib/news/schedule';
import { runNewsMonitor, deactivateOldAlerts } from '@/lib/news/monitor';
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
    // Get current season from ESPN
    const currentState = await espn.getCurrentWeek();

    // Check for season override in query params
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

    // Run learning algorithm to adjust edge weights
    const weekParam = searchParams.get('week');
    const week = weekParam ? parseInt(weekParam) : currentState.week - 1;

    console.log(`[Accuracy] Running learning for season ${season}, week ${week}`);
    const learningResult = await learnFromAccuracy(season, week);

    // Step 3: Deep analysis of predictions
    console.log(`[Accuracy] Running deep analysis for season ${season}, week ${week}`);
    const analysisResult = await analyzeWeekPredictions(season, week);

    // Step 4: Run AI improvement agent
    console.log(`[Accuracy] Running AI improvement agent for season ${season}`);
    const agentResult = await runImprovementAgent(season);

    // Step 5: Refresh NFL schedule for next week
    console.log(`[Accuracy] Refreshing schedule for week ${currentState.week}`);
    const gamesStored = await fetchAndStoreSchedule(season, currentState.week);

    // Step 6: Run news monitor
    console.log(`[Accuracy] Running news monitor`);
    const newsResult = await runNewsMonitor({
      season,
      week: currentState.week,
      runType: 'scheduled',
    });

    // Step 7: Clean up old alerts
    const alertsDeactivated = await deactivateOldAlerts();

    return NextResponse.json({
      success: true,
      season,
      week,
      totalPredictions: report.totalPredictions,
      overallHitRate: report.overallHitRate,
      topEdges: Object.entries(report.byEdgeType)
        .slice(0, 5)
        .map(([type, stats]) => ({ type, hitRate: stats.hitRate })),
      learning: {
        weightsUpdated: learningResult.updated,
        updates: learningResult.updates.slice(0, 5),
      },
      analysis: {
        predictionsAnalyzed: analysisResult.analyzed,
        patternsDetected: analysisResult.patterns,
      },
      agent: {
        patternsAnalyzed: agentResult.patternsAnalyzed,
        badMissesAnalyzed: agentResult.badMissesAnalyzed,
        recommendationsGenerated: agentResult.recommendations.length,
        autoApplied: agentResult.autoApplied,
        proposalsCreated: agentResult.proposalsCreated,
      },
      schedule: {
        gamesStored,
        nextWeek: currentState.week,
      },
      news: {
        alertsCreated: newsResult.alertsCreated,
        newsItemsProcessed: newsResult.newsItemsProcessed,
        alertsDeactivated,
      },
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
