'use client';

import { useState, useEffect } from 'react';

interface ColdWeatherData {
  player: string;
  available: boolean;
  coldGames?: Array<{ week: number; opponent: string; points: number; isHome: boolean }>;
  avgColdPoints?: number;
  avgAllPoints?: number;
  coldGameCount?: number;
  allGameCount?: number;
  differential?: number;
}

interface Props {
  playerName: string;
}

export default function ColdWeatherPerformance({ playerName }: Props) {
  const [data, setData] = useState<ColdWeatherData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/cold-weather?player=${encodeURIComponent(playerName)}`);
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

  if (loading) {
    return (
      <div className="bg-zinc-900 border border-zinc-800 p-4 animate-pulse">
        <div className="h-4 bg-zinc-800 rounded w-32 mb-2" />
        <div className="h-6 bg-zinc-800 rounded w-20" />
      </div>
    );
  }

  if (!data?.available || !data.coldGames || data.coldGames.length === 0) {
    return null;
  }

  const differential = data.differential || 0;
  const isPositive = differential > 0;
  const isNeutral = Math.abs(differential) < 1;

  return (
    <div className="bg-zinc-900 border border-zinc-800 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-lg">🥶</span>
          <span className="text-xs text-zinc-500 uppercase tracking-wider">
            Cold Weather Performance
          </span>
        </div>
        <div className={`text-xs font-bold ${isNeutral ? 'text-zinc-500' : isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
          {isPositive ? '+' : ''}{differential.toFixed(1)} PPR vs avg
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-3">
        <div>
          <div className="text-xs text-zinc-500 mb-1">Cold Games Avg</div>
          <div className="text-xl font-bold text-zinc-200">{data.avgColdPoints?.toFixed(1)}</div>
          <div className="text-xs text-zinc-600">{data.coldGameCount} games</div>
        </div>
        <div>
          <div className="text-xs text-zinc-500 mb-1">Season Avg</div>
          <div className="text-xl font-bold text-zinc-400">{data.avgAllPoints?.toFixed(1)}</div>
          <div className="text-xs text-zinc-600">{data.allGameCount} games</div>
        </div>
      </div>

      {/* Cold games breakdown */}
      <div className="border-t border-zinc-800 pt-2">
        <div className="text-xs text-zinc-500 mb-2">Recent Cold Games</div>
        <div className="space-y-1">
          {data.coldGames.slice(-3).map((game, i) => (
            <div key={i} className="flex items-center justify-between text-xs">
              <span className="text-zinc-400">
                W{game.week} {game.isHome ? 'vs' : '@'} {game.opponent}
              </span>
              <span className={`font-medium ${game.points >= (data.avgAllPoints || 0) ? 'text-emerald-400' : 'text-red-400'}`}>
                {game.points.toFixed(1)} pts
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="text-[10px] text-zinc-600 mt-2">
        Cold games = weeks 10+ at outdoor northern stadiums
      </div>
    </div>
  );
}
