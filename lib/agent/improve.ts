/**
 * Self-Improvement Agent
 *
 * Uses Claude to analyze prediction failures and generate improvements.
 * Can auto-apply safe changes and create GitHub issues for structural changes.
 *
 * Features:
 * - Minimum sample size (20) before adjusting weights
 * - Decision audit logging for all decisions
 * - Rollback tracking with 2-week evaluation window
 * - Auto-rollback if accuracy drops 10%+
 */

import Anthropic from '@anthropic-ai/sdk';
import { getSupabaseServer, isSupabaseConfigured } from '../db/supabase';
import { getPatternsForAnalysis, getBadMisses } from '../db/analysis';
import { getAllWeights } from '../db/learning';

const anthropic = new Anthropic();

// Configuration
const CONFIG = {
  MIN_SAMPLE_SIZE: 20, // Minimum predictions before adjusting weight
  ROLLBACK_THRESHOLD: -10, // Auto-rollback if accuracy drops by this much (%)
  EVALUATION_WEEKS: 2, // Weeks to wait before evaluating improvement
  SAFE_WEIGHT_MIN: 0.5, // Minimum safe auto-apply weight
  SAFE_WEIGHT_MAX: 2.0, // Maximum safe auto-apply weight
};

interface Recommendation {
  type: 'weight_adjustment' | 'threshold_change' | 'new_edge' | 'code_change' | 'data_source';
  priority: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  evidence: string[];
  proposedChange: {
    edgeType?: string;
    currentValue?: number;
    newValue?: number;
    codeChange?: string;
    reasoning: string;
  };
  autoApplicable: boolean;
  expectedImprovement: string;
}

interface ImprovementReport {
  timestamp: string;
  patternsAnalyzed: number;
  badMissesAnalyzed: number;
  recommendations: Recommendation[];
  autoApplied: number;
  skippedInsufficientData: number;
  proposalsCreated: number;
  decisionsLogged: number;
  rollbacksTriggered: number;
}

interface AgentDecision {
  decisionType: string;
  edgeType?: string;
  dataAnalyzed: Record<string, unknown>;
  patternsConsidered?: Record<string, unknown>[];
  sampleSize?: number;
  reasoning: string;
  actionTaken: string;
  actionDetails?: Record<string, unknown>;
  improvementId?: string;
  proposalId?: string;
}

/**
 * Log a decision to the audit table
 */
async function logDecision(decision: AgentDecision): Promise<void> {
  if (!isSupabaseConfigured()) return;

  const supabase = getSupabaseServer();

  await supabase.from('agent_decisions').insert({
    decision_type: decision.decisionType,
    edge_type: decision.edgeType,
    data_analyzed: decision.dataAnalyzed,
    patterns_considered: decision.patternsConsidered,
    sample_size: decision.sampleSize,
    reasoning: decision.reasoning,
    action_taken: decision.actionTaken,
    action_details: decision.actionDetails,
    improvement_id: decision.improvementId,
    proposal_id: decision.proposalId,
  });
}

/**
 * Main improvement agent - analyzes and improves the system
 */
export async function runImprovementAgent(season: number): Promise<ImprovementReport> {
  console.log('[Agent] Starting self-improvement analysis...');

  const report: ImprovementReport = {
    timestamp: new Date().toISOString(),
    patternsAnalyzed: 0,
    badMissesAnalyzed: 0,
    recommendations: [],
    autoApplied: 0,
    skippedInsufficientData: 0,
    proposalsCreated: 0,
    decisionsLogged: 0,
    rollbacksTriggered: 0,
  };

  // 0. Check for improvements needing evaluation/rollback
  const rollbacks = await evaluateAndRollback();
  report.rollbacksTriggered = rollbacks;

  // 1. Gather data for analysis
  const patterns = await getPatternsForAnalysis();
  const badMisses = await getBadMisses(season);
  const currentWeights = await getAllWeights();

  report.patternsAnalyzed = patterns.length;
  report.badMissesAnalyzed = badMisses.length;

  if (patterns.length === 0 && badMisses.length === 0) {
    await logDecision({
      decisionType: 'no_action',
      dataAnalyzed: { patterns: 0, badMisses: 0 },
      reasoning: 'No patterns or bad misses to analyze',
      actionTaken: 'none',
    });
    report.decisionsLogged++;
    console.log('[Agent] No patterns or bad misses to analyze');
    return report;
  }

  // 2. Build context for Claude
  const context = buildAnalysisContext(patterns, badMisses, currentWeights);

  // 3. Get Claude's analysis and recommendations
  const recommendations = await getClaudeRecommendations(context);
  report.recommendations = recommendations;

  // 4. Process recommendations
  for (const rec of recommendations) {
    if (rec.autoApplicable && rec.type === 'weight_adjustment') {
      // Check sample size before applying
      const weight = currentWeights.find(w => w.edgeType === rec.proposedChange.edgeType);
      const sampleSize = weight?.predictions || 0;

      if (sampleSize < CONFIG.MIN_SAMPLE_SIZE) {
        // Insufficient data - skip and log
        await logDecision({
          decisionType: 'skip_insufficient_data',
          edgeType: rec.proposedChange.edgeType,
          dataAnalyzed: {
            recommendation: rec.title,
            proposedWeight: rec.proposedChange.newValue,
          },
          sampleSize,
          reasoning: `Sample size ${sampleSize} is below minimum threshold of ${CONFIG.MIN_SAMPLE_SIZE}`,
          actionTaken: 'skipped',
          actionDetails: {
            minRequired: CONFIG.MIN_SAMPLE_SIZE,
            actual: sampleSize,
          },
        });
        report.skippedInsufficientData++;
        report.decisionsLogged++;
        console.log(`[Agent] Skipping ${rec.proposedChange.edgeType}: insufficient data (${sampleSize}/${CONFIG.MIN_SAMPLE_SIZE})`);
        continue;
      }

      // Auto-apply weight adjustment
      const result = await applyWeightAdjustment(rec, sampleSize);
      if (result.applied) {
        await logDecision({
          decisionType: 'weight_adjustment',
          edgeType: rec.proposedChange.edgeType,
          dataAnalyzed: {
            recommendation: rec.title,
            evidence: rec.evidence,
          },
          sampleSize,
          reasoning: rec.proposedChange.reasoning,
          actionTaken: 'applied',
          actionDetails: {
            oldWeight: rec.proposedChange.currentValue,
            newWeight: rec.proposedChange.newValue,
            evaluationDue: result.evaluationDue,
          },
          improvementId: result.improvementId,
        });
        report.autoApplied++;
        report.decisionsLogged++;
      }
    } else {
      // Create proposal for human review
      const proposalId = await createProposal(rec, patterns, badMisses);
      if (proposalId) {
        await logDecision({
          decisionType: 'proposal_created',
          edgeType: rec.proposedChange.edgeType,
          dataAnalyzed: {
            recommendation: rec.title,
            type: rec.type,
            priority: rec.priority,
          },
          reasoning: `${rec.type} requires human review: ${rec.description}`,
          actionTaken: 'deferred',
          proposalId,
        });
        report.proposalsCreated++;
        report.decisionsLogged++;
      }
    }
  }

  console.log(`[Agent] Generated ${recommendations.length} recommendations, auto-applied ${report.autoApplied}, skipped ${report.skippedInsufficientData}, created ${report.proposalsCreated} proposals`);

  return report;
}

/**
 * Evaluate improvements due for evaluation and auto-rollback if needed
 */
async function evaluateAndRollback(): Promise<number> {
  if (!isSupabaseConfigured()) return 0;

  const supabase = getSupabaseServer();
  let rollbacks = 0;

  // Get improvements due for evaluation
  const { data: dueImprovements } = await supabase
    .from('applied_improvements')
    .select('*')
    .eq('evaluation_complete', false)
    .eq('rolled_back', false)
    .lte('evaluation_due_at', new Date().toISOString());

  if (!dueImprovements || dueImprovements.length === 0) return 0;

  for (const improvement of dueImprovements) {
    // Calculate accuracy since this improvement was applied
    const { data: predsAfter } = await supabase
      .from('prediction_analysis')
      .select('was_hit')
      .gte('analyzed_at', improvement.applied_at);

    const countAfter = predsAfter?.length || 0;
    const correctAfter = predsAfter?.filter(p => p.was_hit).length || 0;
    const accuracyAfter = countAfter > 0 ? (correctAfter / countAfter) * 100 : null;

    // Get baseline accuracy (before this improvement)
    const accuracyBefore = improvement.accuracy_before || 50;
    const accuracyDiff = accuracyAfter !== null ? accuracyAfter - accuracyBefore : 0;

    // Update the improvement with current stats
    await supabase
      .from('applied_improvements')
      .update({
        predictions_after: countAfter,
        accuracy_after: accuracyAfter,
        improvement_detected: accuracyDiff > 0,
        improvement_percentage: accuracyDiff,
        evaluation_complete: true,
      })
      .eq('id', improvement.id);

    // Check if we need to rollback
    if (accuracyDiff <= CONFIG.ROLLBACK_THRESHOLD) {
      const changeDetails = improvement.change_details as { edgeType?: string };
      const reason = `Auto-rollback: Accuracy dropped ${accuracyDiff.toFixed(1)}% (threshold: ${CONFIG.ROLLBACK_THRESHOLD}%)`;

      await rollbackImprovement(improvement.id, reason);

      await logDecision({
        decisionType: 'auto_rollback',
        edgeType: changeDetails?.edgeType,
        dataAnalyzed: {
          accuracyBefore,
          accuracyAfter,
          accuracyDiff,
          predictionsEvaluated: countAfter,
        },
        reasoning: reason,
        actionTaken: 'rolled_back',
        actionDetails: {
          improvementId: improvement.id,
          stateBefore: improvement.state_before,
          stateAfter: improvement.state_after,
        },
        improvementId: improvement.id,
      });

      // Update to mark as auto-triggered
      await supabase
        .from('applied_improvements')
        .update({ auto_rollback_triggered: true })
        .eq('id', improvement.id);

      rollbacks++;
      console.log(`[Agent] Auto-rollback triggered for improvement ${improvement.id}: ${reason}`);
    } else {
      console.log(`[Agent] Improvement ${improvement.id} evaluated: accuracy ${accuracyDiff >= 0 ? '+' : ''}${accuracyDiff.toFixed(1)}%`);
    }
  }

  return rollbacks;
}

/**
 * Build context string for Claude
 */
function buildAnalysisContext(
  patterns: Awaited<ReturnType<typeof getPatternsForAnalysis>>,
  badMisses: Awaited<ReturnType<typeof getBadMisses>>,
  weights: Awaited<ReturnType<typeof getAllWeights>>
): string {
  let context = `# Fantasy Football Prediction System Analysis

## Current Edge Weights (only consider edges with 20+ predictions)
${weights.filter(w => w.predictions >= CONFIG.MIN_SAMPLE_SIZE).map(w => `- ${w.edgeType}: ${w.weight.toFixed(2)}x (hit rate: ${w.hitRate}%, predictions: ${w.predictions})`).join('\n')}

## Edges with Insufficient Data (<${CONFIG.MIN_SAMPLE_SIZE} predictions) - DO NOT RECOMMEND CHANGES
${weights.filter(w => w.predictions < CONFIG.MIN_SAMPLE_SIZE).map(w => `- ${w.edgeType}: ${w.predictions} predictions (need ${CONFIG.MIN_SAMPLE_SIZE})`).join('\n')}

## Detected Patterns (Problem Areas)
${patterns.length === 0 ? 'No concerning patterns detected.' : patterns.map(p => `
### ${p.patternType}: ${p.patternKey}
- Hit Rate: ${p.hitRate}% (${p.correctPredictions}/${p.totalPredictions})
- Severity: ${p.severity}
- Description: ${p.patternDescription}
`).join('\n')}

## Bad Misses Analysis (Predicted Top-12, Finished 24+)
${badMisses.length === 0 ? 'No bad misses to analyze.' : badMisses.slice(0, 10).map(m => `
### ${m.prediction.player_name} (Week ${m.prediction.week})
- Recommendation: ${m.prediction.recommendation}
- Predicted Rank: ~${m.analysis.predictedRank}
- Actual Rank: ${m.analysis.actualRank}
- Edge Score: ${m.prediction.edge_score?.toFixed(1)}
- Strongest Signal: ${m.analysis.strongestSignal}
- Contributing Factors: ${m.analysis.contributingFactors.join(', ') || 'none identified'}
- Edge Signals Used:
${m.analysis.edgeSignalsUsed.slice(0, 5).map(s => `  - ${s.type}: magnitude ${s.magnitude?.toFixed(1)}, confidence ${s.confidence}%`).join('\n')}
`).join('\n')}

## Edge Types Available
- weather_wind, weather_cold, weather_rain, weather_snow, weather_dome
- travel_distance, travel_timezone, rest_advantage, rest_short_week
- ol_injury, betting_spread, betting_total, betting_line_move
- matchup_defense, matchup_def_injury, usage_target_share, usage_snap_count
- usage_opportunity, contract_incentive, revenge_game, redzone_usage
- home_away_split, primetime_performance, division_rivalry, indoor_outdoor

IMPORTANT: Only recommend weight changes for edges with ${CONFIG.MIN_SAMPLE_SIZE}+ predictions.
`;

  return context;
}

/**
 * Get recommendations from Claude
 */
async function getClaudeRecommendations(context: string): Promise<Recommendation[]> {
  const systemPrompt = `You are an expert fantasy football analyst AI that improves a prediction system by analyzing its failures.

Your job is to:
1. Identify WHY predictions failed (not just that they did)
2. Propose specific, measurable improvements
3. Distinguish between safe auto-apply changes and changes needing human review

CRITICAL RULES:
- ONLY recommend weight changes for edges with ${CONFIG.MIN_SAMPLE_SIZE}+ predictions
- Weight adjustments between ${CONFIG.SAFE_WEIGHT_MIN} and ${CONFIG.SAFE_WEIGHT_MAX} are "safe" and can be auto-applied
- Weight changes more drastic need review (auto_applicable: false)
- Code changes always need review (auto_applicable: false)
- Be specific: "Reduce weather_wind weight to 0.7" not "reduce weather impact"
- Provide evidence for each recommendation
- Expected improvement should be realistic (e.g., "+3% hit rate" not "50% improvement")

Output your recommendations as a JSON array of objects with this structure:
{
  "type": "weight_adjustment" | "threshold_change" | "new_edge" | "code_change" | "data_source",
  "priority": "critical" | "high" | "medium" | "low",
  "title": "Short descriptive title",
  "description": "Detailed explanation",
  "evidence": ["Evidence point 1", "Evidence point 2"],
  "proposedChange": {
    "edgeType": "edge_type_name (if applicable)",
    "currentValue": 1.0,
    "newValue": 0.7,
    "codeChange": "Description of code change if applicable",
    "reasoning": "Why this specific change"
  },
  "autoApplicable": true/false,
  "expectedImprovement": "Expected impact description"
}

Only output the JSON array, no other text. If no recommendations, output empty array [].`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: `Analyze this prediction system data and provide specific improvement recommendations:\n\n${context}`,
        },
      ],
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      return [];
    }

    // Parse JSON from response
    const jsonMatch = content.text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      console.error('[Agent] Could not parse Claude response as JSON');
      return [];
    }

    const recommendations = JSON.parse(jsonMatch[0]) as Recommendation[];
    return recommendations;
  } catch (error) {
    console.error('[Agent] Error getting Claude recommendations:', error);
    return [];
  }
}

/**
 * Apply a weight adjustment automatically
 */
async function applyWeightAdjustment(
  rec: Recommendation,
  sampleSize: number
): Promise<{ applied: boolean; improvementId?: string; evaluationDue?: string }> {
  if (!isSupabaseConfigured() || !rec.proposedChange.edgeType) {
    return { applied: false };
  }

  const supabase = getSupabaseServer();

  // Get current weight and accuracy
  const { data: currentData } = await supabase
    .from('edge_weights')
    .select('current_weight, hit_rate')
    .eq('edge_type', rec.proposedChange.edgeType)
    .single();

  const currentWeight = currentData?.current_weight || 1.0;
  const currentAccuracy = currentData?.hit_rate || 50;
  const newWeight = rec.proposedChange.newValue || 1.0;

  // Validate change is safe (within bounds)
  if (newWeight < 0.2 || newWeight > 3.0) {
    console.log(`[Agent] Weight ${newWeight} out of safe bounds, skipping`);
    return { applied: false };
  }

  // Calculate evaluation due date (2 weeks from now)
  const evaluationDue = new Date();
  evaluationDue.setDate(evaluationDue.getDate() + CONFIG.EVALUATION_WEEKS * 7);

  // Update weight
  await supabase
    .from('edge_weights')
    .update({ current_weight: newWeight, last_updated: new Date().toISOString() })
    .eq('edge_type', rec.proposedChange.edgeType);

  // Log in weight_history
  await supabase.from('weight_history').insert({
    edge_type: rec.proposedChange.edgeType,
    season: new Date().getFullYear(),
    week: 0, // Agent-applied, not weekly
    weight_before: currentWeight,
    weight_after: newWeight,
    hit_rate_this_week: currentAccuracy,
    sample_size: sampleSize,
    adjustment_reason: `[AI Agent] ${rec.title}: ${rec.proposedChange.reasoning}`,
  });

  // Track in applied_improvements with rollback tracking
  const { data: improvement } = await supabase.from('applied_improvements').insert({
    change_type: 'weight',
    change_description: rec.title,
    change_details: {
      edgeType: rec.proposedChange.edgeType,
      reason: rec.proposedChange.reasoning,
      evidence: rec.evidence,
    },
    state_before: { weight: currentWeight },
    state_after: { weight: newWeight },
    accuracy_before: currentAccuracy,
    evaluation_due_at: evaluationDue.toISOString(),
    evaluation_complete: false,
  }).select('id').single();

  console.log(`[Agent] Applied weight change: ${rec.proposedChange.edgeType} ${currentWeight} -> ${newWeight} (eval due: ${evaluationDue.toISOString()})`);

  return {
    applied: true,
    improvementId: improvement?.id,
    evaluationDue: evaluationDue.toISOString(),
  };
}

/**
 * Create a proposal for human review
 */
async function createProposal(
  rec: Recommendation,
  patterns: Awaited<ReturnType<typeof getPatternsForAnalysis>>,
  badMisses: Awaited<ReturnType<typeof getBadMisses>>
): Promise<string | null> {
  if (!isSupabaseConfigured()) return null;

  const supabase = getSupabaseServer();

  // Find related pattern
  const relatedPattern = patterns.find(
    p => p.patternKey === rec.proposedChange.edgeType ||
         rec.evidence.some(e => e.toLowerCase().includes(p.patternKey.toLowerCase()))
  );

  const { data, error } = await supabase
    .from('improvement_proposals')
    .insert({
      pattern_id: relatedPattern ? undefined : undefined,
      prediction_ids: badMisses.slice(0, 5).map(m => m.prediction.id),
      title: rec.title,
      description: rec.description,
      category: rec.type,
      priority: rec.priority,
      evidence: {
        reasoning: rec.proposedChange.reasoning,
        evidencePoints: rec.evidence,
        relatedPattern: relatedPattern?.patternDescription,
      },
      affected_edge_types: rec.proposedChange.edgeType ? [rec.proposedChange.edgeType] : [],
      proposed_code_changes: rec.proposedChange.codeChange ? { description: rec.proposedChange.codeChange } : null,
      proposed_weight_changes: rec.proposedChange.edgeType ? {
        edgeType: rec.proposedChange.edgeType,
        from: rec.proposedChange.currentValue,
        to: rec.proposedChange.newValue,
      } : null,
      expected_improvement: rec.expectedImprovement,
      auto_applicable: rec.autoApplicable,
      status: 'pending',
    })
    .select('id')
    .single();

  if (error) {
    console.error('[Agent] Error creating proposal:', error);
    return null;
  }

  return data?.id || null;
}

/**
 * Create a GitHub issue for a structural change
 */
export async function createGitHubIssue(proposalId: string): Promise<string | null> {
  if (!isSupabaseConfigured()) return null;

  const supabase = getSupabaseServer();
  const githubToken = process.env.GITHUB_TOKEN;

  if (!githubToken) {
    console.log('[Agent] No GITHUB_TOKEN, skipping issue creation');
    return null;
  }

  // Get proposal details
  const { data: proposal } = await supabase
    .from('improvement_proposals')
    .select('*')
    .eq('id', proposalId)
    .single();

  if (!proposal) return null;

  // Build issue body
  const issueBody = `## AI Agent Improvement Proposal

**Category:** ${proposal.category}
**Priority:** ${proposal.priority}

### Description
${proposal.description}

### Evidence
${(proposal.evidence as { evidencePoints?: string[] })?.evidencePoints?.map((e: string) => `- ${e}`).join('\n') || 'No specific evidence provided'}

### Proposed Changes
${proposal.proposed_code_changes ? `\`\`\`\n${JSON.stringify(proposal.proposed_code_changes, null, 2)}\n\`\`\`` : 'No code changes specified'}

${proposal.proposed_weight_changes ? `**Weight Changes:**
\`\`\`json
${JSON.stringify(proposal.proposed_weight_changes, null, 2)}
\`\`\`` : ''}

### Expected Improvement
${proposal.expected_improvement}

---
*This issue was automatically generated by the Fantasy Brain AI improvement agent.*
*Proposal ID: ${proposalId}*`;

  try {
    const response = await fetch('https://api.github.com/repos/bobrothers/fantasy-brain/issues', {
      method: 'POST',
      headers: {
        'Authorization': `token ${githubToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/vnd.github.v3+json',
      },
      body: JSON.stringify({
        title: `[AI Agent] ${proposal.title}`,
        body: issueBody,
        labels: ['ai-agent', proposal.priority, proposal.category],
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('[Agent] GitHub API error:', error);
      return null;
    }

    const issue = await response.json();

    // Update proposal with issue URL
    await supabase
      .from('improvement_proposals')
      .update({
        github_issue_url: issue.html_url,
        github_issue_number: issue.number,
      })
      .eq('id', proposalId);

    await logDecision({
      decisionType: 'github_issue_created',
      dataAnalyzed: { proposalId, title: proposal.title },
      reasoning: `Created GitHub issue for ${proposal.category} proposal: ${proposal.title}`,
      actionTaken: 'applied',
      actionDetails: { issueNumber: issue.number, issueUrl: issue.html_url },
      proposalId,
    });

    console.log(`[Agent] Created GitHub issue #${issue.number}: ${issue.html_url}`);
    return issue.html_url;
  } catch (error) {
    console.error('[Agent] Error creating GitHub issue:', error);
    return null;
  }
}

/**
 * Track impact of an applied improvement
 */
export async function trackImprovementImpact(improvementId: string): Promise<void> {
  if (!isSupabaseConfigured()) return;

  const supabase = getSupabaseServer();

  // Get the improvement
  const { data: improvement } = await supabase
    .from('applied_improvements')
    .select('*, proposal_id')
    .eq('id', improvementId)
    .single();

  if (!improvement) return;

  // Get predictions before and after
  const { data: predsBefore } = await supabase
    .from('prediction_analysis')
    .select('was_hit')
    .lt('analyzed_at', improvement.applied_at);

  const { data: predsAfter } = await supabase
    .from('prediction_analysis')
    .select('was_hit')
    .gte('analyzed_at', improvement.applied_at);

  const countBefore = predsBefore?.length || 0;
  const countAfter = predsAfter?.length || 0;
  const correctBefore = predsBefore?.filter(p => p.was_hit).length || 0;
  const correctAfter = predsAfter?.filter(p => p.was_hit).length || 0;

  const accuracyBefore = countBefore > 0 ? (correctBefore / countBefore) * 100 : 0;
  const accuracyAfter = countAfter > 0 ? (correctAfter / countAfter) * 100 : 0;

  // Update improvement with impact data
  await supabase
    .from('applied_improvements')
    .update({
      predictions_before: countBefore,
      predictions_after: countAfter,
      accuracy_before: accuracyBefore,
      accuracy_after: accuracyAfter,
      improvement_detected: accuracyAfter > accuracyBefore,
      improvement_percentage: accuracyAfter - accuracyBefore,
    })
    .eq('id', improvementId);
}

/**
 * Rollback an improvement that made things worse
 */
export async function rollbackImprovement(improvementId: string, reason: string): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;

  const supabase = getSupabaseServer();

  // Get the improvement
  const { data: improvement } = await supabase
    .from('applied_improvements')
    .select('*')
    .eq('id', improvementId)
    .single();

  if (!improvement || improvement.rolled_back) return false;

  // Restore previous state
  if (improvement.change_type === 'weight') {
    const stateBefore = improvement.state_before as { weight: number };
    const changeDetails = improvement.change_details as { edgeType: string };

    await supabase
      .from('edge_weights')
      .update({ current_weight: stateBefore.weight })
      .eq('edge_type', changeDetails.edgeType);

    // Log rollback in weight_history
    await supabase.from('weight_history').insert({
      edge_type: changeDetails.edgeType,
      season: new Date().getFullYear(),
      week: 0,
      weight_before: (improvement.state_after as { weight: number }).weight,
      weight_after: stateBefore.weight,
      adjustment_reason: `[ROLLBACK] ${reason}`,
    });
  }

  // Mark as rolled back
  await supabase
    .from('applied_improvements')
    .update({
      rolled_back: true,
      rolled_back_at: new Date().toISOString(),
      rollback_reason: reason,
    })
    .eq('id', improvementId);

  console.log(`[Agent] Rolled back improvement ${improvementId}: ${reason}`);
  return true;
}

/**
 * Get agent decision history for review
 */
export async function getDecisionHistory(limit = 50): Promise<AgentDecision[]> {
  if (!isSupabaseConfigured()) return [];

  const supabase = getSupabaseServer();

  const { data } = await supabase
    .from('agent_decisions')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  return (data || []).map(d => ({
    decisionType: d.decision_type,
    edgeType: d.edge_type,
    dataAnalyzed: d.data_analyzed,
    patternsConsidered: d.patterns_considered,
    sampleSize: d.sample_size,
    reasoning: d.reasoning,
    actionTaken: d.action_taken,
    actionDetails: d.action_details,
    improvementId: d.improvement_id,
    proposalId: d.proposal_id,
  }));
}
