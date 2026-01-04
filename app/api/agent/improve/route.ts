/**
 * Self-Improvement Agent API
 *
 * Analyzes prediction failures and generates improvements.
 * Can be triggered manually or by cron (runs after accuracy calculation).
 */

import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Allow 60s for Claude API calls

import { runImprovementAgent, createGitHubIssue } from '@/lib/agent/improve';
import { analyzeWeekPredictions } from '@/lib/db/analysis';
import { espn } from '@/lib/providers/espn';

export async function GET(request: NextRequest) {
  // Verify auth via x-agent-secret header (preferred) or Authorization header
  const agentSecret = request.headers.get('x-agent-secret');
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (process.env.NODE_ENV === 'production' && cronSecret) {
    const isAuthorized =
      agentSecret === cronSecret ||
      authHeader === `Bearer ${cronSecret}`;

    if (!isAuthorized) {
      return NextResponse.json({ error: 'Unauthorized. Use x-agent-secret header.' }, { status: 401 });
    }
  }

  const searchParams = request.nextUrl.searchParams;

  try {
    const currentState = await espn.getCurrentWeek();

    // Get parameters
    const seasonParam = searchParams.get('season');
    const weekParam = searchParams.get('week');
    const createIssues = searchParams.get('createIssues') === 'true';

    const season = seasonParam ? parseInt(seasonParam) : currentState.season;
    const week = weekParam ? parseInt(weekParam) : currentState.week - 1;

    console.log(`[Agent API] Running for season ${season}, week ${week}`);

    // Step 1: Run deep analysis on predictions
    console.log('[Agent API] Step 1: Deep analysis...');
    const analysisResult = await analyzeWeekPredictions(season, week);

    // Step 2: Run improvement agent
    console.log('[Agent API] Step 2: Running improvement agent...');
    const report = await runImprovementAgent(season);

    // Step 3: Create GitHub issues for high-priority structural changes (if requested)
    let issuesCreated = 0;
    if (createIssues && process.env.GITHUB_TOKEN) {
      const { getSupabaseServer } = await import('@/lib/db/supabase');
      const supabase = getSupabaseServer();

      const { data: proposals } = await supabase
        .from('improvement_proposals')
        .select('id')
        .is('github_issue_url', null)
        .in('priority', ['critical', 'high'])
        .eq('auto_applicable', false)
        .limit(3);

      for (const proposal of proposals || []) {
        const issueUrl = await createGitHubIssue(proposal.id);
        if (issueUrl) issuesCreated++;
      }
    }

    return NextResponse.json({
      success: true,
      season,
      week,
      analysis: {
        predictionsAnalyzed: analysisResult.analyzed,
        patternsDetected: analysisResult.patterns,
      },
      improvements: {
        patternsAnalyzed: report.patternsAnalyzed,
        badMissesAnalyzed: report.badMissesAnalyzed,
        recommendationsGenerated: report.recommendations.length,
        autoApplied: report.autoApplied,
        proposalsCreated: report.proposalsCreated,
        githubIssuesCreated: issuesCreated,
      },
      recommendations: report.recommendations.map(r => ({
        type: r.type,
        priority: r.priority,
        title: r.title,
        autoApplicable: r.autoApplicable,
        expectedImprovement: r.expectedImprovement,
      })),
    });
  } catch (error) {
    console.error('[Agent API] Error:', error);
    return NextResponse.json(
      { error: 'Agent failed', details: String(error) },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
