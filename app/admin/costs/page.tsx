'use client';

import { useState, useEffect } from 'react';

interface CostData {
  success: boolean;
  range: { startDate: string; endDate: string; days: number };
  totals: {
    totalCost: number;
    totalRequests: number;
    inputTokens: number;
    outputTokens: number;
  };
  byPeriod: {
    last7Days: { cost: number; requests: number };
    last30Days: { cost: number; requests: number };
  };
  projections: {
    currentMonthSpend: number;
    projectedMonthlySpend: number;
    avgDailySpend: number;
    daysElapsed: number;
    daysInMonth: number;
  };
  byEndpoint: Array<{ endpoint: string; cost: number; requests: number; avgCost: number }>;
  byModel: Array<{ model: string; cost: number; requests: number; avgCost: number }>;
  dailyCosts: Array<{ date: string; cost: number; requests: number }>;
}

export default function CostsDashboard() {
  const [data, setData] = useState<CostData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [range, setRange] = useState(30);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        const response = await fetch(`/api/admin/costs?range=${range}`);
        const result = await response.json();
        if (result.success) {
          setData(result);
          setError(null);
        } else {
          setError(result.error || 'Failed to fetch data');
        }
      } catch (err) {
        setError(String(err));
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [range]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 text-white p-8">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-3xl font-bold mb-8">API Cost Dashboard</h1>
          <div className="animate-pulse">Loading...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-900 text-white p-8">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-3xl font-bold mb-8">API Cost Dashboard</h1>
          <div className="bg-red-900/50 border border-red-500 rounded-lg p-4">
            Error: {error}
          </div>
        </div>
      </div>
    );
  }

  const formatCurrency = (amount: number) => `$${amount.toFixed(2)}`;
  const formatNumber = (num: number) => num.toLocaleString();

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">API Cost Dashboard</h1>
          <select
            value={range}
            onChange={(e) => setRange(parseInt(e.target.value))}
            className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-2"
          >
            <option value="7">Last 7 days</option>
            <option value="14">Last 14 days</option>
            <option value="30">Last 30 days</option>
            <option value="90">Last 90 days</option>
          </select>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-gray-800 rounded-lg p-6">
            <div className="text-gray-400 text-sm mb-1">Total Spend ({range}d)</div>
            <div className="text-3xl font-bold text-green-400">
              {formatCurrency(data?.totals.totalCost || 0)}
            </div>
            <div className="text-gray-500 text-sm mt-1">
              {formatNumber(data?.totals.totalRequests || 0)} requests
            </div>
          </div>

          <div className="bg-gray-800 rounded-lg p-6">
            <div className="text-gray-400 text-sm mb-1">Last 7 Days</div>
            <div className="text-3xl font-bold text-blue-400">
              {formatCurrency(data?.byPeriod.last7Days.cost || 0)}
            </div>
            <div className="text-gray-500 text-sm mt-1">
              {formatNumber(data?.byPeriod.last7Days.requests || 0)} requests
            </div>
          </div>

          <div className="bg-gray-800 rounded-lg p-6">
            <div className="text-gray-400 text-sm mb-1">Avg Daily</div>
            <div className="text-3xl font-bold text-yellow-400">
              {formatCurrency(data?.projections.avgDailySpend || 0)}
            </div>
            <div className="text-gray-500 text-sm mt-1">per day</div>
          </div>

          <div className="bg-gray-800 rounded-lg p-6">
            <div className="text-gray-400 text-sm mb-1">Projected Monthly</div>
            <div className="text-3xl font-bold text-purple-400">
              {formatCurrency(data?.projections.projectedMonthlySpend || 0)}
            </div>
            <div className="text-gray-500 text-sm mt-1">
              Day {data?.projections.daysElapsed} of {data?.projections.daysInMonth}
            </div>
          </div>
        </div>

        {/* Token Usage */}
        <div className="bg-gray-800 rounded-lg p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">Token Usage</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-gray-400 text-sm">Input Tokens</div>
              <div className="text-2xl font-bold">
                {formatNumber(data?.totals.inputTokens || 0)}
              </div>
            </div>
            <div>
              <div className="text-gray-400 text-sm">Output Tokens</div>
              <div className="text-2xl font-bold">
                {formatNumber(data?.totals.outputTokens || 0)}
              </div>
            </div>
          </div>
        </div>

        {/* Cost by Endpoint */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
          <div className="bg-gray-800 rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Cost by Endpoint</h2>
            {data?.byEndpoint && data.byEndpoint.length > 0 ? (
              <div className="space-y-3">
                {data.byEndpoint.map((item) => (
                  <div key={item.endpoint} className="flex justify-between items-center">
                    <div>
                      <div className="font-mono text-sm">{item.endpoint}</div>
                      <div className="text-gray-500 text-xs">
                        {item.requests} requests · ${item.avgCost.toFixed(3)} avg
                      </div>
                    </div>
                    <div className="text-green-400 font-semibold">
                      {formatCurrency(item.cost)}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-gray-500">No data yet</div>
            )}
          </div>

          <div className="bg-gray-800 rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Cost by Model</h2>
            {data?.byModel && data.byModel.length > 0 ? (
              <div className="space-y-3">
                {data.byModel.map((item) => (
                  <div key={item.model} className="flex justify-between items-center">
                    <div>
                      <div className="font-mono text-sm">{item.model}</div>
                      <div className="text-gray-500 text-xs">
                        {item.requests} requests · ${item.avgCost.toFixed(3)} avg
                      </div>
                    </div>
                    <div className="text-blue-400 font-semibold">
                      {formatCurrency(item.cost)}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-gray-500">No data yet</div>
            )}
          </div>
        </div>

        {/* Daily Costs Chart (Simple Bar) */}
        <div className="bg-gray-800 rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Daily Costs</h2>
          {data?.dailyCosts && data.dailyCosts.length > 0 ? (
            <div className="space-y-2">
              {data.dailyCosts.slice(-14).map((day) => {
                const maxCost = Math.max(...data.dailyCosts.map(d => d.cost)) || 1;
                const width = (day.cost / maxCost) * 100;
                return (
                  <div key={day.date} className="flex items-center gap-4">
                    <div className="w-24 text-gray-500 text-sm">{day.date}</div>
                    <div className="flex-1 bg-gray-700 rounded-full h-4 overflow-hidden">
                      <div
                        className="bg-green-500 h-full rounded-full transition-all"
                        style={{ width: `${width}%` }}
                      />
                    </div>
                    <div className="w-20 text-right text-sm">
                      {formatCurrency(day.cost)}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-gray-500">No data yet</div>
          )}
        </div>

        {/* Footer */}
        <div className="mt-8 text-center text-gray-500 text-sm">
          Data refreshes automatically. Costs are tracked per API call.
        </div>
      </div>
    </div>
  );
}
