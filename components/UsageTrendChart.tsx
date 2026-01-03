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
  teamRank?: number;
  teamTotal?: number;
}

interface Props {
  playerName: string;
  position: string;
}

export default function UsageTrendChart({ playerName, position }: Props) {
  const [data, setData] = useState<UsageTrendData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hoveredPoint, setHoveredPoint] = useState<number | null>(null);

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

  // Get the data points for the chart - round to 1 decimal to match display
  const values = data.weeks.map(w => {
    const raw = showCarryShare ? (w.carryShare || 0) : (w.targetShare || 0);
    return Math.round(raw * 10) / 10; // Round to 1 decimal place
  });
  const metric = showCarryShare ? 'Carry Share' : 'Target Share';
  const trend = showCarryShare ? data.carryTrend : data.targetTrend;
  const avg = showCarryShare ? data.avgCarryShare : data.avgTargetShare;

  // Chart dimensions
  const width = 200;
  const height = 50;
  const verticalPadding = 8;
  const labelHeight = 35;

  const maxVal = Math.max(...values, 1);
  const minVal = Math.min(...values);
  const range = maxVal - minVal || 1;

  // Season average (use player's own average for the line)
  const seasonAvg = avg || 0;
  const avgY = height - verticalPadding - ((seasonAvg - minVal) / range) * (height - verticalPadding * 2);

  // Generate SVG path
  const points = values.map((val, i) => {
    const x = (i / (values.length - 1)) * width;
    const y = height - verticalPadding - ((val - minVal) / range) * (height - verticalPadding * 2);
    return { x, y, val };
  });

  const pathD = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`)
    .join(' ');

  // Trend styling
  const trendIcon = trend === 'up' ? '▲' : trend === 'down' ? '▼' : '─';
  const trendColor = trend === 'up' ? 'text-emerald-400' : trend === 'down' ? 'text-red-400' : 'text-zinc-500';
  const trendText = trend === 'up' ? 'Trending Up' : trend === 'down' ? 'Trending Down' : 'Stable';
  const lineColor = trend === 'up' ? '#34d399' : trend === 'down' ? '#f87171' : '#71717a';

  // Position rank text
  const getRankText = () => {
    if (!data.teamRank) return null;
    const suffix = data.teamRank === 1 ? 'st' : data.teamRank === 2 ? 'nd' : data.teamRank === 3 ? 'rd' : 'th';
    return `#${data.teamRank}${suffix} on team`;
  };

  return (
    <div className="bg-zinc-900 border border-zinc-800 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <span className="text-xs text-zinc-500 uppercase tracking-wider">
            Usage Trend
          </span>
          <span className="text-[10px] bg-amber-900/50 text-amber-400 px-1.5 py-0.5 rounded">
            2024 DATA
          </span>
          {data.teamRank && (
            <span className="text-xs bg-zinc-800 px-2 py-0.5 text-amber-400">
              {getRankText()}
            </span>
          )}
        </div>
        <div className={`text-xs font-bold ${trendColor}`}>
          {trendIcon} {trendText}
        </div>
      </div>

      <div className="flex items-center gap-6">
        {/* Chart */}
        <div className="flex-1 relative">
          <svg viewBox={`0 0 ${width} ${height + labelHeight}`} className="w-full" style={{ height: '95px', overflow: 'visible' }}>
            {/* Definitions */}
            <defs>
              <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={lineColor} stopOpacity="0.3" />
                <stop offset="100%" stopColor={lineColor} stopOpacity="0" />
              </linearGradient>
            </defs>

            {/* Season average line */}
            <line
              x1={0}
              y1={avgY}
              x2={width}
              y2={avgY}
              stroke="#fbbf24"
              strokeWidth="1"
              strokeDasharray="4,4"
              opacity="0.5"
            />
            <text x={width - 2} y={avgY - 4} textAnchor="end" fontSize="8" fill="#fbbf24" opacity="0.7">
              AVG
            </text>

            {/* Area fill under line */}
            <path
              d={`${pathD} L ${points[points.length - 1]?.x} ${height - verticalPadding} L ${points[0]?.x} ${height - verticalPadding} Z`}
              fill="url(#areaGradient)"
            />

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
              const isLast = i === points.length - 1;
              const isHovered = hoveredPoint === i;
              return (
                <g
                  key={i}
                  onMouseEnter={() => setHoveredPoint(i)}
                  onMouseLeave={() => setHoveredPoint(null)}
                  style={{ cursor: 'pointer' }}
                >
                  {/* Hover hitbox */}
                  <circle cx={p.x} cy={p.y} r="12" fill="transparent" />

                  {/* Pulse ring for latest week */}
                  {isLast && (
                    <circle
                      cx={p.x}
                      cy={p.y}
                      r="6"
                      fill="none"
                      stroke={lineColor}
                      strokeWidth="2"
                    >
                      <animate attributeName="r" from="6" to="12" dur="1.5s" repeatCount="indefinite" />
                      <animate attributeName="opacity" from="0.6" to="0" dur="1.5s" repeatCount="indefinite" />
                    </circle>
                  )}

                  {/* Data point */}
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r={isHovered ? 6 : 4}
                    fill={isLast || isHovered ? lineColor : "#18181b"}
                    stroke={lineColor}
                    strokeWidth="2"
                    style={{ transition: 'r 0.15s ease' }}
                  />

                  {/* Tooltip on hover */}
                  {isHovered && (
                    <g>
                      <rect
                        x={p.x - 35}
                        y={p.y - 45}
                        width="70"
                        height="35"
                        rx="4"
                        fill="#18181b"
                        stroke="#3f3f46"
                        strokeWidth="1"
                      />
                      <text x={p.x} y={p.y - 32} textAnchor="middle" fontSize="10" fill="#ffffff" fontWeight="bold">
                        {pctValue?.toFixed(1)}%
                      </text>
                      <text x={p.x} y={p.y - 20} textAnchor="middle" fontSize="9" fill="#a1a1aa">
                        {rawValue} {rawLabel} • W{weekData?.week}
                      </text>
                    </g>
                  )}

                  {/* Week labels and stats (dimmed when another point is hovered) */}
                  <text
                    x={p.x}
                    y={height + 12}
                    textAnchor="middle"
                    fontSize="10"
                    fill={isLast ? "#a1a1aa" : "#52525b"}
                    opacity={hoveredPoint !== null && !isHovered ? 0.4 : 1}
                  >
                    W{weekData?.week}
                  </text>
                  <text
                    x={p.x}
                    y={height + 24}
                    textAnchor="middle"
                    fontSize="10"
                    fill={isLast ? "#ffffff" : "#d4d4d8"}
                    fontWeight={isLast ? "bold" : "normal"}
                    opacity={hoveredPoint !== null && !isHovered ? 0.4 : 1}
                  >
                    {pctValue?.toFixed(1)}%
                  </text>
                  <text
                    x={p.x}
                    y={height + 34}
                    textAnchor="middle"
                    fontSize="8"
                    fill="#52525b"
                    opacity={hoveredPoint !== null && !isHovered ? 0.4 : 1}
                  >
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

      {/* Legend */}
      <div className="flex items-center gap-4 mt-3 pt-2 border-t border-zinc-800 text-[10px] text-zinc-600">
        <span className="flex items-center gap-1">
          <span className="w-4 h-px bg-amber-400 opacity-50" style={{ backgroundImage: 'repeating-linear-gradient(90deg, #fbbf24 0, #fbbf24 4px, transparent 4px, transparent 8px)' }}></span>
          Season Avg
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: lineColor }}></span>
          Latest
        </span>
      </div>
    </div>
  );
}
