/**
 * Patterns API
 *
 * Returns detected patterns and improvement proposals for review.
 */

import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

import { getSupabaseServer, isSupabaseConfigured } from '@/lib/db/supabase';

export async function GET() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ patterns: [], proposals: [] });
  }

  const supabase = getSupabaseServer();

  // Get patterns
  const { data: patterns } = await supabase
    .from('detected_patterns')
    .select('*')
    .order('hit_rate', { ascending: true });

  // Get proposals
  const { data: proposals } = await supabase
    .from('improvement_proposals')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(20);

  // Get applied improvements
  const { data: improvements } = await supabase
    .from('applied_improvements')
    .select('*')
    .order('applied_at', { ascending: false })
    .limit(20);

  return NextResponse.json({
    patterns: (patterns || []).map(p => ({
      type: p.pattern_type,
      key: p.pattern_key,
      hitRate: p.hit_rate,
      total: p.total_predictions,
      correct: p.correct_predictions,
      severity: p.severity,
      description: p.pattern_description,
      rootCause: p.root_cause_analysis,
      recommendation: p.recommended_action,
      addressed: p.addressed,
    })),
    proposals: (proposals || []).map(p => ({
      id: p.id,
      title: p.title,
      description: p.description,
      category: p.category,
      priority: p.priority,
      status: p.status,
      autoApplicable: p.auto_applicable,
      githubIssue: p.github_issue_url,
      expectedImprovement: p.expected_improvement,
      createdAt: p.created_at,
    })),
    improvements: (improvements || []).map(i => ({
      id: i.id,
      changeType: i.change_type,
      description: i.change_description,
      appliedAt: i.applied_at,
      accuracyBefore: i.accuracy_before,
      accuracyAfter: i.accuracy_after,
      improvementDetected: i.improvement_detected,
      improvementPct: i.improvement_percentage,
      rolledBack: i.rolled_back,
    })),
  });
}
