'use client';

import { useState, useEffect } from 'react';
import PlayerAutocomplete from '@/components/PlayerAutocomplete';
import LockTimer from '@/components/LockTimer';
import UsageTrendChart from '@/components/UsageTrendChart';
import ColdWeatherPerformance from '@/components/ColdWeatherPerformance';
import DeepStats from '@/components/DeepStats';

interface EdgeSignal {
  type: string;
  impact: 'positive' | 'negative' | 'neutral';
  magnitude: number;
  confidence: number;
  shortDescription: string;
  details: string;
}

interface AnalysisResult {
  player: {
    name: string;
    team: string;
    position: string;
  };
  week: number;
  resting?: {
    isResting: boolean;
    reason: string;
  } | null;
  edges: {
    weather: { summary: string; signals: EdgeSignal[] };
    travel: { summary: string; signals: EdgeSignal[] };
    olHealth: { summary: string; signals: EdgeSignal[] };
    betting: { summary: string; signals: EdgeSignal[] };
    matchup: { summary: string; signals: EdgeSignal[] };
    oppDefense: { summary: string; signals: EdgeSignal[] };
    usage: { summary: string; signals: EdgeSignal[] };
    contract: { summary: string; signals: EdgeSignal[] };
    revenge: { summary: string; signals: EdgeSignal[] };
    redZone: { summary: string; signals: EdgeSignal[] };
    homeAway: { summary: string; signals: EdgeSignal[] };
    primetime: { summary: string; signals: EdgeSignal[] };
    division: { summary: string; signals: EdgeSignal[] };
    rest: { summary: string; signals: EdgeSignal[] };
    venue: { summary: string; signals: EdgeSignal[] };
  };
  overall: {
    impact: number;
    confidence: number;
    recommendation: string;
  };
}

interface RestingPlayer {
  name: string;
  team: string;
  reason: string;
  source?: string;
}

interface GameScore {
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  status: 'scheduled' | 'in_progress' | 'final';
  statusDetail: string;
  slot?: string;
}

export default function Home() {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [time, setTime] = useState<Date | null>(null);
  const [restingPlayers, setRestingPlayers] = useState<RestingPlayer[]>([]);
  const [showRestingPanel, setShowRestingPanel] = useState(false);
  const [restingLoading, setRestingLoading] = useState(false);
  const [games, setGames] = useState<GameScore[]>([]);

  // Live clock - only render on client to avoid hydration mismatch
  useEffect(() => {
    setTime(new Date());
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch resting players on mount
  useEffect(() => {
    fetchRestingPlayers();
  }, []);

  // Fetch live scores
  useEffect(() => {
    const fetchScores = async () => {
      try {
        const res = await fetch('/api/scores');
        if (res.ok) {
          const data = await res.json();
          setGames(data.games || []);
        }
      } catch (err) {
        console.error('Failed to fetch scores:', err);
      }
    };
    fetchScores();
    // Refresh every 30 seconds during games
    const interval = setInterval(fetchScores, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchRestingPlayers = async () => {
    setRestingLoading(true);
    try {
      const res = await fetch('/api/resting');
      if (res.ok) {
        const data = await res.json();
        setRestingPlayers(data.players || []);
      }
    } catch (err) {
      console.error('Failed to fetch resting players:', err);
    } finally {
      setRestingLoading(false);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/analyze?player=${encodeURIComponent(query)}`);
      if (!res.ok) throw new Error('Player not found');
      const data = await res.json();
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed');
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  const getImpactColor = (impact: number) => {
    if (impact >= 3) return 'text-emerald-400';
    if (impact >= 1) return 'text-lime-400';
    if (impact <= -3) return 'text-red-500';
    if (impact <= -1) return 'text-orange-400';
    return 'text-zinc-400';
  };

  const getSignalIcon = (signals: EdgeSignal[]) => {
    if (signals.length === 0) return '○';
    const hasPositive = signals.some(s => s.impact === 'positive');
    const hasNegative = signals.some(s => s.impact === 'negative');
    if (hasPositive && hasNegative) return '◐';
    if (hasPositive) return '✓';
    if (hasNegative) return '⚠';
    return '○';
  };

  const getSignalColor = (signals: EdgeSignal[]) => {
    if (signals.length === 0) return 'text-zinc-600';
    const hasPositive = signals.some(s => s.impact === 'positive');
    const hasNegative = signals.some(s => s.impact === 'negative');
    if (hasPositive && hasNegative) return 'text-amber-400';
    if (hasPositive) return 'text-emerald-400';
    if (hasNegative) return 'text-red-400';
    return 'text-zinc-500';
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-mono selection:bg-amber-500/30">
      {/* Scanline overlay */}
      <div className="fixed inset-0 pointer-events-none z-50 opacity-[0.02]"
        style={{
          backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.3) 2px, rgba(0,0,0,0.3) 4px)'
        }}
      />
      
      {/* Header ticker */}
      <header className="border-b border-zinc-800 bg-zinc-900/80 backdrop-blur-sm sticky top-0 z-40">
        <div className="flex items-center justify-between px-4 py-2">
          <div className="flex items-center gap-6">
            <a href="/" className="text-lg tracking-tight hover:opacity-80 transition-opacity">
              <span className="text-amber-400 font-bold">FANTASY</span>
              <span className="text-zinc-400">BRAIN</span>
            </a>
            <nav className="flex items-center gap-4 text-sm">
              <a href="/" className="text-zinc-400 hover:text-white transition-colors">Analysis</a>
              <a href="/trade" className="text-zinc-400 hover:text-white transition-colors">Trade</a>
              <a href="/waivers" className="text-zinc-400 hover:text-white transition-colors">Waivers</a>
              <a href="/diagnose" className="text-zinc-400 hover:text-white transition-colors">Diagnose</a>
            </nav>
          </div>
          <div className="flex items-center gap-4 text-xs">
            {restingPlayers.length > 0 && (
              <button
                onClick={() => setShowRestingPanel(!showRestingPanel)}
                className="flex items-center gap-2 px-3 py-1 bg-purple-950/50 border border-purple-700 text-purple-300 hover:bg-purple-900/50 transition-colors"
              >
                <span className="text-purple-400">⚠</span>
                <span>{restingPlayers.length} Resting</span>
              </button>
            )}
            <div className="flex items-center gap-2">
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-zinc-500">LIVE</span>
            </div>
            <div className="text-zinc-400 tabular-nums">
              {time?.toLocaleTimeString('en-US', { hour12: false }) ?? '--:--:--'}
            </div>
            <div className="text-zinc-500">
              WK18
            </div>
          </div>
        </div>
        
        {/* Scrolling ticker - live scores */}
        <div className="bg-zinc-900 border-t border-zinc-800 overflow-hidden">
          <div className="flex animate-ticker">
            {/* Render games twice for seamless loop */}
            {[...games, ...games].map((game, i) => (
              <div key={i} className="flex-shrink-0 px-4 py-1 text-xs whitespace-nowrap">
                {game.status === 'final' ? (
                  <span className="text-zinc-400">
                    {game.awayTeam} {game.awayScore} - {game.homeTeam} {game.homeScore}{' '}
                    <span className="text-zinc-600">FINAL</span>
                  </span>
                ) : game.status === 'in_progress' ? (
                  <span className="text-emerald-400">
                    {game.awayTeam} {game.awayScore} - {game.homeTeam} {game.homeScore}{' '}
                    <span className="text-emerald-600">{game.statusDetail}</span>
                  </span>
                ) : (
                  <span className="text-zinc-500">
                    {game.awayTeam} @ {game.homeTeam}{' '}
                    <span className="text-zinc-600">{game.slot || game.statusDetail}</span>
                  </span>
                )}
              </div>
            ))}
            {/* Fallback if no games */}
            {games.length === 0 && (
              <span className="px-4 py-1 text-xs text-zinc-600">Loading scores...</span>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* Resting Players Panel */}
        {showRestingPanel && restingPlayers.length > 0 && (
          <div className="mb-6 bg-purple-950/30 border border-purple-800 p-4 animate-fadeIn">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-purple-400 text-lg">⚠</span>
                <span className="text-purple-300 font-bold uppercase tracking-wide text-sm">
                  Week 18 Resting Players
                </span>
              </div>
              <button
                onClick={() => setShowRestingPanel(false)}
                className="text-purple-400 hover:text-purple-300 text-xl"
              >
                ×
              </button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
              {restingPlayers.map((player, i) => {
                const isSuspended = player.reason.toLowerCase().includes('suspended');
                return (
                  <div
                    key={i}
                    className={`px-3 py-2 text-sm ${
                      isSuspended
                        ? 'bg-red-950/50 border border-red-800'
                        : 'bg-purple-950/50'
                    }`}
                  >
                    <div className={`font-medium ${isSuspended ? 'text-red-200' : 'text-purple-200'}`}>
                      {player.name}
                    </div>
                    <div className={`text-xs ${isSuspended ? 'text-red-400' : 'text-purple-400'}`}>
                      {player.team} • {player.reason.split(' - ')[0]}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-3 text-xs text-purple-500">
              Sources: Coach press conferences, official injury reports •{' '}
              <button
                onClick={fetchRestingPlayers}
                className="text-purple-400 hover:text-purple-300 underline"
              >
                {restingLoading ? 'Refreshing...' : 'Refresh'}
              </button>
            </div>
          </div>
        )}

        {/* Search */}
        <form onSubmit={handleSearch} className="mb-8">
          <div className="relative group flex gap-2">
            <PlayerAutocomplete
              value={query}
              onChange={setQuery}
              onSelect={() => {
                // Auto-submit when player is selected from dropdown
                setTimeout(() => {
                  const form = document.querySelector('form');
                  if (form) form.requestSubmit();
                }, 50);
              }}
              placeholder="ENTER PLAYER NAME"
              className="flex-1"
            />
            <button
              type="submit"
              disabled={loading}
              className="bg-amber-400 text-zinc-900 px-6 py-2 text-sm font-bold tracking-wider hover:bg-amber-300 transition-colors disabled:opacity-50"
            >
              {loading ? 'SCANNING...' : 'ANALYZE'}
            </button>
          </div>
        </form>

        {/* Error */}
        {error && (
          <div className="bg-red-950/50 border border-red-800 px-4 py-3 mb-8">
            <span className="text-red-400">{error}</span>
          </div>
        )}

        {/* Results */}
        {result && (
          <div className="space-y-6 animate-fadeIn">
            {/* Resting Warning Banner */}
            {result.resting?.isResting && (
              <div className="bg-purple-950 border-2 border-purple-500 p-4 flex items-center gap-4">
                <div className="text-4xl">⚠️</div>
                <div>
                  <div className="text-purple-300 font-bold text-lg uppercase tracking-wide">
                    DO NOT START
                  </div>
                  <div className="text-purple-200">
                    {result.resting.reason}
                  </div>
                </div>
              </div>
            )}

            {/* Player header */}
            <div className="bg-zinc-900 border border-zinc-800 p-6">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-xs text-zinc-500 mb-1">ANALYZING</div>
                  <h2 className="text-3xl font-bold tracking-tight text-white">
                    {result.player.name}
                  </h2>
                  <div className="flex items-center gap-3 mt-2">
                    <span className="bg-zinc-800 px-2 py-1 text-xs">{result.player.team}</span>
                    <span className="text-zinc-500 text-sm">{result.player.position}</span>
                    <LockTimer
                      team={result.player.team}
                      playerName={result.player.name}
                      compact
                    />
                  </div>
                </div>
                
                {/* Impact score with tooltip */}
                <div className="text-right relative group cursor-help">
                  <div className="text-xs text-zinc-500 mb-1 flex items-center justify-end gap-1">
                    EDGE IMPACT
                    <span className="text-zinc-600 text-[10px]">ⓘ</span>
                  </div>
                  <div className={`text-5xl font-black tabular-nums ${getImpactColor(result.overall.impact)}`}>
                    {result.overall.impact > 0 ? '+' : ''}{result.overall.impact.toFixed(1)}
                  </div>
                  <div className="text-xs text-zinc-500 mt-1">
                    {result.overall.confidence}% confidence
                  </div>
                  {/* Tooltip */}
                  <div className="absolute right-0 top-full mt-2 w-64 p-3 bg-zinc-800 border border-zinc-700 text-left text-xs opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 shadow-xl">
                    <div className="font-bold text-zinc-300 mb-2">How Edge Impact Works</div>
                    <div className="text-zinc-400 space-y-1.5">
                      <div><span className="text-emerald-400">+3 to +5</span> = Strong start</div>
                      <div><span className="text-lime-400">+1 to +3</span> = Slight boost</div>
                      <div><span className="text-zinc-400">-1 to +1</span> = Neutral</div>
                      <div><span className="text-orange-400">-3 to -1</span> = Slight concern</div>
                      <div><span className="text-red-400">-5 to -3</span> = Major red flags</div>
                    </div>
                    <div className="text-zinc-500 mt-2 pt-2 border-t border-zinc-700">
                      Aggregates 15 edge signals: weather, matchup, usage, betting lines, injuries, and more.
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Recommendation bar */}
              <div className="mt-6 pt-4 border-t border-zinc-800">
                <div className="flex items-center gap-3">
                  <span className={`text-sm font-bold ${
                    result.overall.impact >= 2 ? 'text-emerald-400' :
                    result.overall.impact <= -2 ? 'text-red-400' :
                    'text-zinc-400'
                  }`}>
                    {result.overall.impact >= 3 ? '◆◆◆ SMASH' :
                     result.overall.impact >= 1 ? '◆◆○ LEAN START' :
                     result.overall.impact <= -3 ? '◇◇◇ FADE' :
                     result.overall.impact <= -1 ? '◇◇○ LEAN SIT' :
                     '◆○○ NEUTRAL'}
                  </span>
                  <span className="text-zinc-500 text-sm">{result.overall.recommendation}</span>
                </div>
              </div>
            </div>

            {/* Usage Trend Chart */}
            <UsageTrendChart
              playerName={result.player.name}
              position={result.player.position}
            />

            {/* Cold Weather Performance */}
            <ColdWeatherPerformance playerName={result.player.name} />

            {/* Deep Stats */}
            <DeepStats
              playerName={result.player.name}
              position={result.player.position}
            />

            {/* Legend */}
            <div className="flex items-center gap-6 text-xs text-zinc-500 mb-2">
              <span><span className="text-emerald-400">✓</span> Positive edge</span>
              <span><span className="text-red-400">⚠</span> Negative edge</span>
              <span><span className="text-amber-400">◐</span> Mixed signals</span>
              <span><span className="text-zinc-600">○</span> No signal</span>
            </div>

            {/* Edge grid */}
            <div className="grid grid-cols-2 gap-px bg-zinc-800">
              {Object.entries(result.edges).map(([key, edge]) => (
                <div key={key} className="bg-zinc-900 p-4 hover:bg-zinc-900/80 transition-colors">
                  <div className="flex items-start gap-3">
                    <span className={`text-lg ${getSignalColor(edge.signals)}`}>
                      {getSignalIcon(edge.signals)}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-zinc-500 uppercase tracking-wider mb-1">
                        {key.replace(/([A-Z])/g, ' $1').trim()}
                      </div>
                      <div className="text-sm text-zinc-300 truncate">
                        {edge.summary}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Key factors */}
            {result.overall.impact !== 0 && (
              <div className="bg-zinc-900 border border-zinc-800 p-4">
                <div className="text-xs text-zinc-500 uppercase tracking-wider mb-3">Key Factors</div>
                <div className="space-y-2">
                  {Object.entries(result.edges)
                    .filter(([_, edge]) => edge.signals.length > 0)
                    .flatMap(([_, edge]) => edge.signals)
                    .filter((signal, i, arr) => arr.findIndex(s => s.shortDescription === signal.shortDescription) === i)
                    .slice(0, 4)
                    .map((signal, i) => (
                      <div key={i} className="flex items-start gap-2 text-sm">
                        <span className={signal.impact === 'positive' ? 'text-emerald-400' : 'text-red-400'}>
                          {signal.impact === 'positive' ? '▲' : '▼'}
                        </span>
                        <span className="text-zinc-300">{signal.shortDescription}</span>
                      </div>
                    ))
                  }
                </div>
              </div>
            )}
          </div>
        )}

        {/* Empty state */}
        {!result && !loading && !error && (
          <div className="text-center py-20">
            <div className="text-zinc-700 text-6xl mb-4">◇</div>
            <div className="text-zinc-500 text-sm uppercase tracking-widest">
              Enter a player name to begin analysis
            </div>
            <div className="mt-8 flex flex-wrap justify-center gap-2">
              {['Ja\'Marr Chase', 'Saquon Barkley', 'Derrick Henry', 'Lamar Jackson'].map(name => (
                <button
                  key={name}
                  onClick={() => { setQuery(name); }}
                  className="bg-zinc-900 border border-zinc-800 px-3 py-1 text-xs text-zinc-400 hover:border-zinc-600 hover:text-zinc-300 transition-colors"
                >
                  {name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Loading state */}
        {loading && (
          <div className="text-center py-20">
            <div className="inline-block relative">
              <div className="w-16 h-16 border-2 border-zinc-800 border-t-amber-400 rounded-full animate-spin" />
            </div>
            <div className="mt-6 text-zinc-500 text-sm uppercase tracking-widest animate-pulse">
              Scanning edge signals...
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-800 mt-auto">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between text-xs text-zinc-600">
          <div>Data: Sleeper • nflfastR • Open-Meteo • The Odds API</div>
          <div>Not financial advice. For entertainment only.</div>
        </div>
      </footer>

      <style jsx>{`
        @keyframes ticker {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .animate-ticker {
          animation: ticker 30s linear infinite;
          width: max-content;
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeIn {
          animation: fadeIn 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}
