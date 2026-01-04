/**
 * API Costs Admin Endpoint
 *
 * Returns cost analytics for the admin dashboard.
 */

import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

import { getCostSummary, getDailyCosts, getProjectedMonthlySpend } from '@/lib/db/costs';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const range = searchParams.get('range') || '30'; // days

  try {
    const days = parseInt(range);

    // Get date range
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Fetch all data in parallel
    const [summary, dailyCosts, projections] = await Promise.all([
      getCostSummary(startDate, endDate),
      getDailyCosts(days),
      getProjectedMonthlySpend(),
    ]);

    // Calculate week and month summaries
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    const monthAgo = new Date();
    monthAgo.setMonth(monthAgo.getMonth() - 1);

    const [weekSummary, monthSummary] = await Promise.all([
      getCostSummary(weekAgo, endDate),
      getCostSummary(monthAgo, endDate),
    ]);

    return NextResponse.json({
      success: true,
      range: {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        days,
      },
      totals: {
        totalCost: Math.round((summary?.totalCost || 0) * 100) / 100,
        totalRequests: summary?.totalRequests || 0,
        inputTokens: summary?.inputTokens || 0,
        outputTokens: summary?.outputTokens || 0,
      },
      byPeriod: {
        last7Days: {
          cost: Math.round((weekSummary?.totalCost || 0) * 100) / 100,
          requests: weekSummary?.totalRequests || 0,
        },
        last30Days: {
          cost: Math.round((monthSummary?.totalCost || 0) * 100) / 100,
          requests: monthSummary?.totalRequests || 0,
        },
      },
      projections: {
        currentMonthSpend: projections.currentMonthSpend,
        projectedMonthlySpend: projections.projectedMonthlySpend,
        avgDailySpend: projections.avgDailySpend,
        daysElapsed: projections.daysElapsed,
        daysInMonth: projections.daysInMonth,
      },
      byEndpoint: summary?.byEndpoint
        ? Object.entries(summary.byEndpoint)
            .map(([endpoint, stats]) => ({
              endpoint,
              cost: Math.round(stats.cost * 100) / 100,
              requests: stats.requests,
              avgCost: Math.round((stats.cost / stats.requests) * 1000) / 1000,
            }))
            .sort((a, b) => b.cost - a.cost)
        : [],
      byModel: summary?.byModel
        ? Object.entries(summary.byModel)
            .map(([model, stats]) => ({
              model,
              cost: Math.round(stats.cost * 100) / 100,
              requests: stats.requests,
              avgCost: Math.round((stats.cost / stats.requests) * 1000) / 1000,
            }))
            .sort((a, b) => b.cost - a.cost)
        : [],
      dailyCosts: dailyCosts.map(d => ({
        date: d.date,
        cost: Math.round(d.cost * 100) / 100,
        requests: d.requests,
      })),
    });
  } catch (error) {
    console.error('[Costs API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch costs', details: String(error) },
      { status: 500 }
    );
  }
}
