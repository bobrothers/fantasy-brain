'use client';

import { useState, useEffect } from 'react';

interface DeepStatsData {
  player: string;
  available: boolean;
  snapTrend?: {
    recentAvg: number;
    seasonAvg: number;
    trending: 'up' | 'down' | 'stable';
    weeklySnaps: Array<{ week: number; snapPct: number }>;
  };
  airYards?: {
    share: number;
    total: number;
    avgPerGame: number;
    rank: number;
  };
  targetPremium?: {
    targetsPerSnap: number;
    leagueAvg: number;
    premium: number;
  };
  divisional?: {
    avgPoints: number;
    nonDivAvgPoints: number;
    differential: number;
    games: Array<{ week: number; opponent: string; points: number }>;
  } | null;
  secondHalf?: {
    firstHalfAvg: number;
    secondHalfAvg: number;
    surge: number;
  } | null;
}

interface Props {
  playerName: string;
  position: string;
}

export default function DeepStats({ playerName, position }: Props) {
  const [data, setData] = useState<DeepStatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/deep-stats?player=${encodeURIComponent(playerName)}`);
        if (!res.ok) throw new Error('Failed to fetch');
        const result = await res.json();
        setData(result);
      } catch {
        setData(null);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [playerName]);

  // QBs don't have these receiving stats
  if (position === 'QB') {
    return null;
  }

  if (loading) {
    return (
      <div className="bg-zinc-900 border border-zinc-800 p-4 animate-pulse">
        <div className="h-4 bg-zinc-800 rounded w-32 mb-3" />
        <div className="grid grid-cols-3 gap-4">
          <div className="h-16 bg-zinc-800 rounded" />
          <div className="h-16 bg-zinc-800 rounded" />
          <div className="h-16 bg-zinc-800 rounded" />
        </div>
      </div>
    );
  }

  if (!data?.available) {
    return null;
  }

  const getTrendIcon = (trend: 'up' | 'down' | 'stable') => {
    if (trend === 'up') return '📈';
    if (trend === 'down') return '📉';
    return '➡️';
  };

  const getTrendColor = (trend: 'up' | 'down' | 'stable') => {
    if (trend === 'up') return 'text-emerald-400';
    if (trend === 'down') return 'text-red-400';
    return 'text-zinc-500';
  };

  const getDifferentialColor = (diff: number) => {
    if (diff > 2) return 'text-emerald-400';
    if (diff < -2) return 'text-red-400';
    return 'text-zinc-400';
  };

  // Mini sparkline for snap trend
  const renderSnapSparkline = () => {
    if (!data.snapTrend?.weeklySnaps) return null;
    const snaps = data.snapTrend.weeklySnaps.slice(-6);
    const max = Math.max(...snaps.map(s => s.snapPct), 100);
    const min = Math.min(...snaps.map(s => s.snapPct), 0);
    const range = max - min || 1;

    return (
      <svg viewBox="0 0 60 20" className="w-16 h-5">
        <polyline
          points={snaps.map((s, i) =>
            `${(i / (snaps.length - 1)) * 60},${20 - ((s.snapPct - min) / range) * 18}`
          ).join(' ')}
          fill="none"
          stroke={data.snapTrend.trending === 'up' ? '#34d399' : data.snapTrend.trending === 'down' ? '#f87171' : '#71717a'}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  };

  return (
    <div className="bg-zinc-900 border border-zinc-800 p-4">
      <div
        className="flex items-center justify-between mb-4 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2">
          <span className="text-lg">🔬</span>
          <span className="text-xs text-zinc-500 uppercase tracking-wider">
            Deep Stats
          </span>
        </div>
        <span className="text-xs text-zinc-600">
          {expanded ? '▲ collapse' : '▼ expand'}
        </span>
      </div>

      {/* Main stats row - always visible */}
      <div className="grid grid-cols-3 gap-4 mb-4">
        {/* Snap Trend */}
        {data.snapTrend && (
          <div className="bg-zinc-800/50 p-3 rounded">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-zinc-500">Snap Trend</span>
              <span className={`text-xs ${getTrendColor(data.snapTrend.trending)}`}>
                {getTrendIcon(data.snapTrend.trending)}
              </span>
            </div>
            <div className="flex items-end justify-between">
              <div>
                <div className="text-lg font-bold text-zinc-200">
                  {data.snapTrend.recentAvg}%
                </div>
                <div className="text-[10px] text-zinc-600">
                  vs {data.snapTrend.seasonAvg}% szn
                </div>
              </div>
              {renderSnapSparkline()}
            </div>
          </div>
        )}

        {/* Air Yards Share */}
        {data.airYards && (
          <div className="bg-zinc-800/50 p-3 rounded">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-zinc-500">Air Yards Share</span>
              <span className="text-xs text-amber-400">#{data.airYards.rank}</span>
            </div>
            <div className="text-lg font-bold text-zinc-200">
              {data.airYards.share}%
            </div>
            <div className="text-[10px] text-zinc-600">
              {data.airYards.avgPerGame} yd/gm
            </div>
          </div>
        )}

        {/* Target Premium */}
        {data.targetPremium && (
          <div className="bg-zinc-800/50 p-3 rounded">
            <div className="text-xs text-zinc-500 mb-1">Target Premium</div>
            <div className={`text-lg font-bold ${getDifferentialColor(data.targetPremium.premium)}`}>
              {data.targetPremium.premium > 0 ? '+' : ''}{data.targetPremium.premium}%
            </div>
            <div className="text-[10px] text-zinc-600">
              {data.targetPremium.targetsPerSnap}% tgt/snap
            </div>
          </div>
        )}
      </div>

      {/* Expanded stats */}
      {expanded && (
        <div className="border-t border-zinc-800 pt-4 space-y-4">
          {/* Second Half Surge */}
          {data.secondHalf && (
            <div className="bg-zinc-800/30 p-3 rounded">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-zinc-500 uppercase">Second Half Surge</span>
                <span className={`text-sm font-bold ${getDifferentialColor(data.secondHalf.surge)}`}>
                  {data.secondHalf.surge > 0 ? '+' : ''}{data.secondHalf.surge} PPR
                </span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-xs text-zinc-600">Weeks 1-8</div>
                  <div className="text-lg font-medium text-zinc-400">{data.secondHalf.firstHalfAvg}</div>
                </div>
                <div>
                  <div className="text-xs text-zinc-600">Weeks 9+</div>
                  <div className="text-lg font-medium text-zinc-200">{data.secondHalf.secondHalfAvg}</div>
                </div>
              </div>
              {data.secondHalf.surge > 3 && (
                <div className="text-xs text-emerald-400 mt-2">
                  🔥 Strong second half performer
                </div>
              )}
              {data.secondHalf.surge < -3 && (
                <div className="text-xs text-red-400 mt-2">
                  ⚠️ Fading down the stretch
                </div>
              )}
            </div>
          )}

          {/* Divisional Performance */}
          {data.divisional && data.divisional.games.length > 0 && (
            <div className="bg-zinc-800/30 p-3 rounded">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-zinc-500 uppercase">Divisional Games</span>
                <span className={`text-sm font-bold ${getDifferentialColor(data.divisional.differential)}`}>
                  {data.divisional.differential > 0 ? '+' : ''}{data.divisional.differential} PPR
                </span>
              </div>
              <div className="grid grid-cols-2 gap-4 mb-3">
                <div>
                  <div className="text-xs text-zinc-600">Div Avg</div>
                  <div className="text-lg font-medium text-zinc-200">{data.divisional.avgPoints}</div>
                </div>
                <div>
                  <div className="text-xs text-zinc-600">Non-Div Avg</div>
                  <div className="text-lg font-medium text-zinc-400">{data.divisional.nonDivAvgPoints}</div>
                </div>
              </div>
              <div className="space-y-1">
                {data.divisional.games.slice(-3).map((game, i) => (
                  <div key={i} className="flex items-center justify-between text-xs">
                    <span className="text-zinc-500">W{game.week} vs {game.opponent}</span>
                    <span className={`font-medium ${game.points >= data.divisional!.nonDivAvgPoints ? 'text-emerald-400' : 'text-zinc-400'}`}>
                      {game.points.toFixed(1)}
                    </span>
                  </div>
                ))}
              </div>
              {data.divisional.differential > 4 && (
                <div className="text-xs text-emerald-400 mt-2">
                  ⚔️ Steps up in rivalry games
                </div>
              )}
            </div>
          )}

          {/* Snap breakdown sparkline detail */}
          {data.snapTrend && data.snapTrend.weeklySnaps.length > 0 && (
            <div className="bg-zinc-800/30 p-3 rounded">
              <div className="text-xs text-zinc-500 uppercase mb-2">Weekly Snap %</div>
              <div className="flex items-end justify-between gap-1 h-12">
                {data.snapTrend.weeklySnaps.slice(-8).map((week, i) => {
                  const height = (week.snapPct / 100) * 100;
                  const isRecent = i >= data.snapTrend!.weeklySnaps.slice(-8).length - 3;
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center">
                      <div
                        className={`w-full rounded-t ${isRecent ? 'bg-emerald-500' : 'bg-zinc-600'}`}
                        style={{ height: `${height}%` }}
                      />
                      <span className="text-[8px] text-zinc-600 mt-1">W{week.week}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="text-[10px] text-zinc-600 mt-3">
        Target premium = targets per snap vs position avg
      </div>
    </div>
  );
}
