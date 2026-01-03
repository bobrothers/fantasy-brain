'use client';

import { useState, useEffect } from 'react';

interface WeekData {
  week: number;
  targetShare?: number;
  carryShare?: number;
  targets?: number;
  carries?: number;
}

interface UsageTrendData {
  player: string;
  available: boolean;
  position?: string;
  team?: string;
  weeks?: WeekData[];
  avgTargetShare?: number;
  avgCarryShare?: number;
  targetTrend?: 'up' | 'down' | 'stable';
  carryTrend?: 'up' | 'down' | 'stable';
  trendChange?: number;
}

interface Props {
  playerName: string;
  position: string;
}

export default function UsageTrendChart({ playerName, position }: Props) {
  const [data, setData] = useState<UsageTrendData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTrend = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/usage-trend?player=${encodeURIComponent(playerName)}&weeks=6`);
        if (!res.ok) throw new Error('Failed to fetch usage trend');
        const result = await res.json();
        setData(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load');
      } finally {
        setLoading(false);
      }
    };
    fetchTrend();
  }, [playerName]);

  // QBs don't have target/carry share
  if (position === 'QB') {
    return null;
  }

  if (loading) {
    return (
      <div className="bg-zinc-900 border border-zinc-800 p-4">
        <div className="animate-pulse flex items-center gap-3">
          <div className="h-16 w-full bg-zinc-800 rounded" />
        </div>
      </div>
    );
  }

  if (error || !data?.available || !data.weeks || data.weeks.length < 2) {
    return null;
  }

  // Determine which metric to show
  const isRB = position === 'RB';
  const showCarryShare = isRB && data.avgCarryShare !== undefined;
  const showTargetShare = data.avgTargetShare !== undefined;

  if (!showCarryShare && !showTargetShare) {
    return null;
  }

  // Get the data points for the chart
  const values = data.weeks.map(w =>
    showCarryShare ? (w.carryShare || 0) : (w.targetShare || 0)
  );
  const metric = showCarryShare ? 'Carry Share' : 'Target Share';
  const trend = showCarryShare ? data.carryTrend : data.targetTrend;
  const avg = showCarryShare ? data.avgCarryShare : data.avgTargetShare;

  // Chart dimensions - no horizontal padding so points align with labels
  const width = 200;
  const height = 50;
  const verticalPadding = 8;
  const labelHeight = 35; // Space for week labels and stats below chart

  const maxVal = Math.max(...values, 1);
  const minVal = Math.min(...values);
  const range = maxVal - minVal || 1;

  // Generate SVG path - x goes edge to edge to match justify-between labels
  const points = values.map((val, i) => {
    const x = (i / (values.length - 1)) * width;
    const y = height - verticalPadding - ((val - minVal) / range) * (height - verticalPadding * 2);
    return { x, y, val };
  });

  const pathD = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`)
    .join(' ');

  // Trend indicator
  const trendIcon = trend === 'up' ? '▲' : trend === 'down' ? '▼' : '─';
  const trendColor = trend === 'up' ? 'text-emerald-400' : trend === 'down' ? 'text-red-400' : 'text-zinc-500';
  const trendText = trend === 'up' ? 'Trending Up' : trend === 'down' ? 'Trending Down' : 'Stable';
  const lineColor = trend === 'up' ? '#34d399' : trend === 'down' ? '#f87171' : '#71717a';

  return (
    <div className="bg-zinc-900 border border-zinc-800 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="text-xs text-zinc-500 uppercase tracking-wider">
          Usage Trend (Last 6 Weeks)
        </div>
        <div className={`text-xs font-bold ${trendColor}`}>
          {trendIcon} {trendText}
        </div>
      </div>

      <div className="flex items-center gap-6">
        {/* Chart */}
        <div className="flex-1">
          <svg viewBox={`0 0 ${width} ${height + labelHeight}`} className="w-full" style={{ height: '95px', overflow: 'visible' }}>
            {/* Grid lines */}
            <line x1={0} y1={height/2} x2={width} y2={height/2}
              stroke="#3f3f46" strokeWidth="0.5" strokeDasharray="2,2" />

            {/* Trend line */}
            <path
              d={pathD}
              fill="none"
              stroke={lineColor}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* Data points, week labels, and stats */}
            {points.map((p, i) => {
              const weekData = data.weeks?.[i];
              const pctValue = showCarryShare ? weekData?.carryShare : weekData?.targetShare;
              const rawValue = showCarryShare ? weekData?.carries : weekData?.targets;
              const rawLabel = showCarryShare ? 'car' : 'tgt';
              return (
                <g key={i}>
                  <circle cx={p.x} cy={p.y} r="4" fill="#18181b" stroke={lineColor} strokeWidth="2" />
                  <text x={p.x} y={height + 12} textAnchor="middle" fontSize="10" fill="#52525b">
                    W{weekData?.week}
                  </text>
                  <text x={p.x} y={height + 24} textAnchor="middle" fontSize="10" fill="#d4d4d8">
                    {pctValue?.toFixed(0)}%
                  </text>
                  <text x={p.x} y={height + 34} textAnchor="middle" fontSize="8" fill="#52525b">
                    {rawValue} {rawLabel}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        {/* Stats */}
        <div className="text-right shrink-0">
          <div className="text-xs text-zinc-500 mb-1">{metric}</div>
          <div className="text-xl font-bold text-zinc-200">{avg?.toFixed(1)}%</div>
          {data.trendChange !== undefined && data.trendChange !== 0 && (
            <div className={`text-xs ${trendColor}`}>
              {data.trendChange > 0 ? '+' : ''}{data.trendChange.toFixed(1)}%
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
