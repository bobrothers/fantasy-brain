'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { getProStatus } from '@/lib/usage';

type Position = 'ALL' | 'QB' | 'RB' | 'WR' | 'TE';

interface WaiverTarget {
  player: {
    id: string;
    name: string;
    team: string | null;
    position: string;
    injuryStatus: string | null;
  };
  edgeScore: number;
  trendingAdds: number;
  isHiddenGem: boolean;
  keyFactors: string[];
  matchup: string;
}

interface WaiversResponse {
  week: number;
  position: string;
  targets: WaiverTarget[];
  hiddenGems: WaiverTarget[];
  totalFound: number;
}

export default function WaiversPage() {
  const [position, setPosition] = useState<Position>('ALL');
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<WaiversResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [time, setTime] = useState<Date | null>(null);
  const [expandedPlayer, setExpandedPlayer] = useState<string | null>(null);
  const [isPro, setIsPro] = useState(false);

  useEffect(() => {
    setTime(new Date());
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Check Pro status on mount
  useEffect(() => {
    const status = getProStatus();
    setIsPro(status.isPro);
  }, []);

  useEffect(() => {
    fetchWaivers();
  }, [position]);

  const fetchWaivers = async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/waivers?position=${position}&limit=20`);
      if (!res.ok) throw new Error('Failed to fetch waivers');
      const data = await res.json();
      setData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load waivers');
    } finally {
      setLoading(false);
    }
  };

  const getEdgeColor = (score: number) => {
    if (score >= 6) return 'text-emerald-400';
    if (score >= 4) return 'text-lime-400';
    if (score >= 3) return 'text-amber-400';
    return 'text-zinc-400';
  };

  const getTrendingColor = (adds: number) => {
    if (adds >= 2000) return 'text-red-400'; // Hot
    if (adds >= 1000) return 'text-amber-400';
    if (adds >= 500) return 'text-lime-400';
    return 'text-zinc-400';
  };

  const getPositionColor = (pos: string) => {
    switch (pos) {
      case 'QB': return 'bg-red-500/20 text-red-400 border-red-500/50';
      case 'RB': return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50';
      case 'WR': return 'bg-blue-500/20 text-blue-400 border-blue-500/50';
      case 'TE': return 'bg-amber-500/20 text-amber-400 border-amber-500/50';
      default: return 'bg-zinc-500/20 text-zinc-400 border-zinc-500/50';
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-mono selection:bg-amber-500/30">
      {/* Scanline overlay */}
      <div
        className="fixed inset-0 pointer-events-none z-50 opacity-[0.02]"
        style={{
          backgroundImage:
            'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.3) 2px, rgba(0,0,0,0.3) 4px)',
        }}
      />

      {/* Header */}
      <header className="border-b border-zinc-800 bg-zinc-900/80 backdrop-blur-sm sticky top-0 z-40">
        <div className="flex items-center justify-between px-4 py-2">
          <div className="flex items-center gap-6">
            <Link href="/" className="text-lg tracking-tight hover:opacity-80 transition-opacity flex items-center gap-2">
              <span className="text-amber-400 font-bold">FANTASY</span>
              <span className="text-zinc-400">BRAIN</span>
              {isPro && (
                <span className="bg-amber-400 text-zinc-900 text-xs font-bold px-1.5 py-0.5">
                  PRO
                </span>
              )}
            </Link>
            <nav className="flex items-center gap-4 text-sm">
              <Link href="/" className="text-zinc-400 hover:text-white transition-colors">Analysis</Link>
              <Link href="/trade" className="text-zinc-400 hover:text-white transition-colors">Trade</Link>
              <Link href="/waivers" className="text-white">Waivers</Link>
              <Link href="/diagnose" className="text-zinc-400 hover:text-white transition-colors">Diagnose</Link>
              {!isPro && (
                <Link href="/pricing" className="text-amber-400/70 hover:text-amber-400 transition-colors font-bold">
                  Upgrade
                </Link>
              )}
            </nav>
          </div>
          <div className="flex items-center gap-6 text-xs">
            <div className="flex items-center gap-2">
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-zinc-500">LIVE</span>
            </div>
            <div className="text-zinc-400 tabular-nums">
              {time?.toLocaleTimeString('en-US', { hour12: false }) ?? '--:--:--'}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Title and Position Filter */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">Waiver Wire Targets</h1>
            <p className="text-sm text-zinc-500 mt-1">Week 18 pickups ranked by edge score</p>
          </div>
          <div className="flex gap-1 bg-zinc-900 border border-zinc-700 p-1">
            {(['ALL', 'QB', 'RB', 'WR', 'TE'] as Position[]).map((pos) => (
              <button
                key={pos}
                onClick={() => setPosition(pos)}
                className={`px-3 py-1.5 text-xs font-bold tracking-wider transition-colors ${
                  position === pos
                    ? 'bg-amber-400 text-zinc-900'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {pos}
              </button>
            ))}
          </div>
        </div>

        {/* Hidden Gems Banner */}
        {data && data.hiddenGems.length > 0 && (
          <div className="bg-emerald-950/30 border border-emerald-500/50 p-4 mb-6">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-emerald-400 text-lg">💎</span>
              <span className="text-xs text-emerald-400 uppercase tracking-wider font-bold">
                Hidden Gems ({data.hiddenGems.length})
              </span>
            </div>
            <p className="text-sm text-zinc-400">
              High-edge players rostered in &lt;50% of leagues:{' '}
              <span className="text-emerald-400 font-medium">
                {data.hiddenGems.map(g => g.player.name).join(', ')}
              </span>
            </p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="bg-red-950/50 border border-red-800 px-4 py-3 mb-6">
            <span className="text-red-400">{error}</span>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="text-center py-20">
            <div className="inline-block relative">
              <div className="w-16 h-16 border-2 border-zinc-800 border-t-amber-400 rounded-full animate-spin" />
            </div>
            <div className="mt-6 text-zinc-500 text-sm uppercase tracking-widest animate-pulse">
              Scanning waiver wire...
            </div>
          </div>
        )}

        {/* Results */}
        {!loading && data && (
          <div className="space-y-2">
            {/* Legend */}
            <div className="flex items-center gap-4 text-xs text-zinc-500 mb-4 px-2">
              <span>Edge Score = matchup advantage this week</span>
              <span>|</span>
              <span>Adds = 24hr Sleeper trending adds</span>
            </div>

            {data.targets.map((target, index) => (
              <div
                key={target.player.id}
                className={`bg-zinc-900 border transition-all ${
                  target.isHiddenGem
                    ? 'border-emerald-500/50 shadow-lg shadow-emerald-500/10'
                    : 'border-zinc-800'
                }`}
              >
                {/* Main row */}
                <div
                  className="p-4 cursor-pointer hover:bg-zinc-800/50 transition-colors"
                  onClick={() =>
                    setExpandedPlayer(expandedPlayer === target.player.id ? null : target.player.id)
                  }
                >
                  <div className="flex items-center gap-4">
                    {/* Rank */}
                    <div className="w-8 text-center">
                      <span className="text-lg font-bold text-zinc-600">
                        {index + 1}
                      </span>
                    </div>

                    {/* Player info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white">{target.player.name}</span>
                        {target.isHiddenGem && (
                          <span className="text-emerald-400 text-sm">💎</span>
                        )}
                        {target.player.injuryStatus && (
                          <span className="text-xs text-red-400 bg-red-500/20 px-1.5 py-0.5">
                            {target.player.injuryStatus}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`px-1.5 py-0.5 text-xs font-bold border ${getPositionColor(target.player.position)}`}>
                          {target.player.position}
                        </span>
                        <span className="text-xs text-zinc-500">{target.player.team}</span>
                        <span className="text-xs text-zinc-600">•</span>
                        <span className="text-xs text-zinc-400">{target.matchup}</span>
                      </div>
                    </div>

                    {/* Edge Score */}
                    <div className="text-right">
                      <div className={`text-2xl font-black tabular-nums ${getEdgeColor(target.edgeScore)}`}>
                        +{target.edgeScore}
                      </div>
                      <div className="text-xs text-zinc-500">edge</div>
                    </div>

                    {/* Trending Adds */}
                    <div className="text-right w-20">
                      <div className={`text-lg font-bold tabular-nums ${getTrendingColor(target.trendingAdds)}`}>
                        {target.trendingAdds >= 1000
                          ? `${(target.trendingAdds / 1000).toFixed(1)}k`
                          : target.trendingAdds}
                      </div>
                      <div className="text-xs text-zinc-500">adds</div>
                    </div>

                    {/* Expand indicator */}
                    <div className="text-zinc-600">
                      {expandedPlayer === target.player.id ? '▼' : '▶'}
                    </div>
                  </div>
                </div>

                {/* Expanded details */}
                {expandedPlayer === target.player.id && (
                  <div className="px-4 pb-4 border-t border-zinc-800 pt-4 animate-fadeIn">
                    {/* Key Factors */}
                    <div className="text-xs text-zinc-500 uppercase tracking-wider mb-2">
                      Edge Factors (from real data)
                    </div>
                    <ul className="space-y-1">
                      {target.keyFactors.map((factor, i) => (
                        <li key={i} className="text-sm text-zinc-300 flex items-start gap-2">
                          <span className="text-emerald-400">+</span>
                          {factor}
                        </li>
                      ))}
                    </ul>
                    {target.isHiddenGem && (
                      <div className="mt-3 text-xs text-emerald-400">
                        💎 Hidden gem - trending up with positive edge
                      </div>
                    )}
                    <div className="mt-3 text-xs text-zinc-600">
                      Data: Sleeper API • Weather API • Odds API • nflfastR
                    </div>
                  </div>
                )}
              </div>
            ))}

            {data.targets.length === 0 && (
              <div className="text-center py-12 text-zinc-500">
                No waiver targets found for {position}
              </div>
            )}
          </div>
        )}

        {/* Empty state */}
        {!loading && !data && !error && (
          <div className="text-center py-20">
            <div className="text-zinc-700 text-6xl mb-4">📋</div>
            <div className="text-zinc-500 text-sm uppercase tracking-widest">
              Loading waiver targets...
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-800 mt-auto">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between text-xs text-zinc-600">
          <div>Real data: Sleeper trending API + edge detection</div>
          <div>Not financial advice. For entertainment only.</div>
        </div>
      </footer>

      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeIn {
          animation: fadeIn 0.2s ease-out;
        }
      `}</style>
    </div>
  );
}
