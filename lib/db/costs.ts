/**
 * API Cost Tracking
 *
 * Wrapper for Claude API calls that logs token usage and costs.
 * Also provides cost querying and reporting functions.
 */

import Anthropic from '@anthropic-ai/sdk';
import { getSupabaseServer, isSupabaseConfigured } from './supabase';

// Pricing per 1M tokens (as of Jan 2024)
const PRICING = {
  'claude-3-opus-20240229': { input: 15.0, output: 75.0, cacheWrite: 18.75, cacheRead: 1.875 },
  'claude-3-sonnet-20240229': { input: 3.0, output: 15.0, cacheWrite: 3.75, cacheRead: 0.375 },
  'claude-3-haiku-20240307': { input: 0.25, output: 1.25, cacheWrite: 0.3, cacheRead: 0.03 },
  'claude-3-5-sonnet-20241022': { input: 3.0, output: 15.0, cacheWrite: 3.75, cacheRead: 0.375 },
  'claude-3-5-haiku-20241022': { input: 1.0, output: 5.0, cacheWrite: 1.25, cacheRead: 0.1 },
  'claude-sonnet-4-20250514': { input: 3.0, output: 15.0, cacheWrite: 3.75, cacheRead: 0.375 },
  'claude-opus-4-20250514': { input: 15.0, output: 75.0, cacheWrite: 18.75, cacheRead: 1.875 },
  // Default for unknown models
  default: { input: 3.0, output: 15.0, cacheWrite: 3.75, cacheRead: 0.375 },
};

interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens?: number;
  cacheReadTokens?: number;
}

interface CostEntry {
  endpoint: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens?: number;
  cacheReadTokens?: number;
  costUsd: number;
  userId?: string;
  sessionId?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Calculate cost from token usage
 */
export function calculateCost(model: string, usage: TokenUsage): number {
  const pricing = PRICING[model as keyof typeof PRICING] || PRICING.default;

  const inputCost = (usage.inputTokens / 1_000_000) * pricing.input;
  const outputCost = (usage.outputTokens / 1_000_000) * pricing.output;
  const cacheWriteCost = ((usage.cacheCreationTokens || 0) / 1_000_000) * pricing.cacheWrite;
  const cacheReadCost = ((usage.cacheReadTokens || 0) / 1_000_000) * pricing.cacheRead;

  return inputCost + outputCost + cacheWriteCost + cacheReadCost;
}

/**
 * Log a cost entry to the database
 */
export async function logCost(entry: CostEntry): Promise<void> {
  if (!isSupabaseConfigured()) return;

  const supabase = getSupabaseServer();

  await supabase.from('api_costs').insert({
    endpoint: entry.endpoint,
    model: entry.model,
    input_tokens: entry.inputTokens,
    output_tokens: entry.outputTokens,
    cache_creation_tokens: entry.cacheCreationTokens || 0,
    cache_read_tokens: entry.cacheReadTokens || 0,
    cost_usd: entry.costUsd,
    user_id: entry.userId,
    session_id: entry.sessionId,
    request_metadata: entry.metadata,
  });
}

/**
 * Tracked Anthropic client that logs all API calls
 */
export function createTrackedClient(endpoint: string, sessionId?: string) {
  const client = new Anthropic();

  return {
    /**
     * Create a message with automatic cost tracking
     */
    async createMessage(
      params: Anthropic.MessageCreateParamsNonStreaming,
      options?: { userId?: string; metadata?: Record<string, unknown> }
    ): Promise<Anthropic.Message> {
      const response = await client.messages.create(params);

      // Extract usage
      const usageAny = response.usage as unknown as Record<string, number>;
      const usage: TokenUsage = {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        // Cache tokens are in the usage object if present
        cacheCreationTokens: usageAny.cache_creation_input_tokens || 0,
        cacheReadTokens: usageAny.cache_read_input_tokens || 0,
      };

      // Calculate and log cost
      const costUsd = calculateCost(params.model, usage);

      await logCost({
        endpoint,
        model: params.model,
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        cacheCreationTokens: usage.cacheCreationTokens,
        cacheReadTokens: usage.cacheReadTokens,
        costUsd,
        userId: options?.userId,
        sessionId,
        metadata: options?.metadata,
      });

      return response;
    },
  };
}

// ============================================
// Cost Reporting Functions
// ============================================

interface CostSummary {
  totalCost: number;
  totalRequests: number;
  inputTokens: number;
  outputTokens: number;
  byEndpoint: Record<string, { cost: number; requests: number }>;
  byModel: Record<string, { cost: number; requests: number }>;
}

/**
 * Get cost summary for a date range
 */
export async function getCostSummary(
  startDate: Date,
  endDate: Date
): Promise<CostSummary | null> {
  if (!isSupabaseConfigured()) return null;

  const supabase = getSupabaseServer();

  const { data, error } = await supabase
    .from('api_costs')
    .select('*')
    .gte('created_at', startDate.toISOString())
    .lte('created_at', endDate.toISOString());

  if (error || !data) return null;

  const summary: CostSummary = {
    totalCost: 0,
    totalRequests: data.length,
    inputTokens: 0,
    outputTokens: 0,
    byEndpoint: {},
    byModel: {},
  };

  for (const row of data) {
    summary.totalCost += parseFloat(row.cost_usd);
    summary.inputTokens += row.input_tokens;
    summary.outputTokens += row.output_tokens;

    // By endpoint
    if (!summary.byEndpoint[row.endpoint]) {
      summary.byEndpoint[row.endpoint] = { cost: 0, requests: 0 };
    }
    summary.byEndpoint[row.endpoint].cost += parseFloat(row.cost_usd);
    summary.byEndpoint[row.endpoint].requests++;

    // By model
    if (!summary.byModel[row.model]) {
      summary.byModel[row.model] = { cost: 0, requests: 0 };
    }
    summary.byModel[row.model].cost += parseFloat(row.cost_usd);
    summary.byModel[row.model].requests++;
  }

  return summary;
}

/**
 * Get daily costs for the last N days
 */
export async function getDailyCosts(days: number): Promise<Array<{ date: string; cost: number; requests: number }>> {
  if (!isSupabaseConfigured()) return [];

  const supabase = getSupabaseServer();

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const { data, error } = await supabase
    .from('api_costs')
    .select('created_at, cost_usd')
    .gte('created_at', startDate.toISOString())
    .order('created_at', { ascending: true });

  if (error || !data) return [];

  // Group by date
  const byDate: Record<string, { cost: number; requests: number }> = {};

  for (const row of data) {
    const date = new Date(row.created_at).toISOString().split('T')[0];
    if (!byDate[date]) {
      byDate[date] = { cost: 0, requests: 0 };
    }
    byDate[date].cost += parseFloat(row.cost_usd);
    byDate[date].requests++;
  }

  return Object.entries(byDate).map(([date, stats]) => ({
    date,
    cost: Math.round(stats.cost * 1000000) / 1000000, // 6 decimal places
    requests: stats.requests,
  }));
}

/**
 * Get projected monthly spend based on current usage
 */
export async function getProjectedMonthlySpend(): Promise<{
  currentMonthSpend: number;
  projectedMonthlySpend: number;
  daysInMonth: number;
  daysElapsed: number;
  avgDailySpend: number;
}> {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const daysInMonth = endOfMonth.getDate();
  const daysElapsed = now.getDate();

  const summary = await getCostSummary(startOfMonth, now);
  const currentMonthSpend = summary?.totalCost || 0;

  const avgDailySpend = daysElapsed > 0 ? currentMonthSpend / daysElapsed : 0;
  const projectedMonthlySpend = avgDailySpend * daysInMonth;

  return {
    currentMonthSpend: Math.round(currentMonthSpend * 100) / 100,
    projectedMonthlySpend: Math.round(projectedMonthlySpend * 100) / 100,
    daysInMonth,
    daysElapsed,
    avgDailySpend: Math.round(avgDailySpend * 100) / 100,
  };
}
