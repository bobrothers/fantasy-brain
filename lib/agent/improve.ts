/**
 * Self-Improvement Agent
 *
 * Uses Claude to analyze prediction failures and generate improvements.
 * Can auto-apply safe changes and create GitHub issues for structural changes.
 */

import Anthropic from '@anthropic-ai/sdk';
import { getSupabaseServer, isSupabaseConfigured } from '../db/supabase';
import { getPatternsForAnalysis, getBadMisses } from '../db/analysis';
import { getAllWeights } from '../db/learning';

const anthropic = new Anthropic();

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
  proposalsCreated: number;
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
    proposalsCreated: 0,
  };

  // 1. Gather data for analysis
  const patterns = await getPatternsForAnalysis();
  const badMisses = await getBadMisses(season);
  const currentWeights = await getAllWeights();

  report.patternsAnalyzed = patterns.length;
  report.badMissesAnalyzed = badMisses.length;

  if (patterns.length === 0 && badMisses.length === 0) {
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
      // Auto-apply weight adjustments
      const applied = await applyWeightAdjustment(rec);
      if (applied) {
        report.autoApplied++;
      }
    } else {
      // Create proposal for human review or GitHub issue
      const proposalId = await createProposal(rec, patterns, badMisses);
      if (proposalId) {
        report.proposalsCreated++;
      }
    }
  }

  console.log(`[Agent] Generated ${recommendations.length} recommendations, auto-applied ${report.autoApplied}, created ${report.proposalsCreated} proposals`);

  return report;
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

## Current Edge Weights
${weights.map(w => `- ${w.edgeType}: ${w.weight.toFixed(2)}x (hit rate: ${w.hitRate}%, predictions: ${w.predictions})`).join('\n')}

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

IMPORTANT GUIDELINES:
- Weight adjustments between 0.5 and 2.0 are "safe" and can be auto-applied
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

Only output the JSON array, no other text.`;

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
async function applyWeightAdjustment(rec: Recommendation): Promise<boolean> {
  if (!isSupabaseConfigured() || !rec.proposedChange.edgeType) {
    return false;
  }

  const supabase = getSupabaseServer();

  // Get current weight
  const { data: currentData } = await supabase
    .from('edge_weights')
    .select('current_weight')
    .eq('edge_type', rec.proposedChange.edgeType)
    .single();

  const currentWeight = currentData?.current_weight || 1.0;
  const newWeight = rec.proposedChange.newValue || 1.0;

  // Validate change is safe (within bounds)
  if (newWeight < 0.2 || newWeight > 3.0) {
    console.log(`[Agent] Weight ${newWeight} out of safe bounds, skipping`);
    return false;
  }

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
    hit_rate_this_week: null,
    sample_size: null,
    adjustment_reason: `[AI Agent] ${rec.title}: ${rec.proposedChange.reasoning}`,
  });

  // Track in applied_improvements
  await supabase.from('applied_improvements').insert({
    change_type: 'weight',
    change_description: rec.title,
    change_details: {
      edgeType: rec.proposedChange.edgeType,
      reason: rec.proposedChange.reasoning,
      evidence: rec.evidence,
    },
    state_before: { weight: currentWeight },
    state_after: { weight: newWeight },
  });

  console.log(`[Agent] Applied weight change: ${rec.proposedChange.edgeType} ${currentWeight} -> ${newWeight}`);
  return true;
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
      pattern_id: relatedPattern ? undefined : undefined, // Would need to look up by pattern
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
