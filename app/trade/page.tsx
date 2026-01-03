'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import PlayerAutocomplete from '@/components/PlayerAutocomplete';
import LockTimer from '@/components/LockTimer';
import PickSelector from '@/components/PickSelector';

type TradeMode = 'dynasty' | 'redraft';

interface DraftPick {
  year: number;
  round: 1 | 2 | 3 | 4;
  position: 'early' | 'mid' | 'late';
}

interface DynastyValue {
  player: { name: string; team: string | null; position: string; age?: number };
  overallScore: number;
  ageScore: number;
  injuryScore: number;
  situationScore: number;
  draftCapitalScore: number;
  breakoutScore: number;
  offenseScore: number;
  depthChartScore: number;
  contractScore: number;
  qbStabilityScore: number;
  competitionScore: number;
  yearsOfEliteProduction: number;
  tier: 'elite' | 'high' | 'mid' | 'low' | 'avoid';
  draftCapital?: { round: number; pick: number; year: number };
  breakoutAge?: number;
  offensiveRanking?: number;
  depthThreat?: { name: string; level: string };
  contract?: {
    summary: string;
    status: string;
    risk: 'low' | 'medium' | 'high';
    yearsRemaining: number;
    isContractYear: boolean;
    isRookieDeal: boolean;
  };
  factors: { positive: string[]; negative: string[]; neutral: string[] };
  summary: string;
}

interface RedraftValue {
  player: { name: string; team: string | null; position: string };
  overallScore: number;
  scheduleScore: number;
  playoffScore: number;
  availabilityScore: number;
  usageScore: number;
  hotColdScore: number;
  vegasScore: number;
  weatherScore: number;
  scarcityScore: number;
  primetimeScore: number;
  playoffMatchups: Array<{ week: number; opponent: string; difficulty: string }>;
  hotColdStreak?: { last4PPG: number; seasonPPG: number; trend: string };
  vegasImplied?: number;
  coldWeatherGames?: number;
  primetimeGames?: Array<{ week: number; slot: string }>;
  factors: { positive: string[]; negative: string[]; neutral: string[] };
  summary: string;
}

interface PickValue {
  pick: DraftPick;
  value: {
    dynastyScore: number;
    tier: string;
    playerEquivalent: string;
    description: string;
  };
}

interface SellWindowAlert {
  urgency: 'SELL NOW' | 'SELL SOON' | 'HOLD' | 'BUY LOW' | 'BUY NOW';
  reason: string;
  eliteYearsLeft: number;
  windowDescription: string;
  actionAdvice: string;
}

interface ConsolidationAnalysis {
  type: 'consolidating' | 'dispersing' | 'even';
  warning: string | null;
  premium: number;
  recommendation: string;
  breakdown: {
    consolidatingSide: { playerCount: number; pickCount: number; totalAssets: number; avgValue: number };
    dispersingSide: { playerCount: number; pickCount: number; totalAssets: number; avgValue: number };
  };
}

interface TradeSide {
  players: Array<{
    name: string;
    dynasty: DynastyValue;
    redraft: RedraftValue;
    sellWindow?: SellWindowAlert;
  }>;
  picks: PickValue[];
  totalDynastyValue: number;
  totalRedraftValue: number;
}

interface TradeResult {
  side1: TradeSide;
  side2: TradeSide;
  consolidation?: ConsolidationAnalysis;
  player1?: { dynasty: DynastyValue; redraft: RedraftValue };
  player2?: { dynasty: DynastyValue; redraft: RedraftValue };
  verdict: {
    winner: 'side1' | 'side2' | 'even';
    action: 'ACCEPT' | 'REJECT' | 'SLIGHT EDGE' | 'TOSS-UP';
    margin: number;
    confidence: number;
    reasoning: string[];
    summary: string;
    gunToHead: string;
  };
  mode: TradeMode;
}

export default function TradePage() {
  const [players1, setPlayers1] = useState<string[]>([]);
  const [players2, setPlayers2] = useState<string[]>([]);
  const [newPlayer1, setNewPlayer1] = useState('');
  const [newPlayer2, setNewPlayer2] = useState('');
  const [picks1, setPicks1] = useState<DraftPick[]>([]);
  const [picks2, setPicks2] = useState<DraftPick[]>([]);
  const [mode, setMode] = useState<TradeMode>('dynasty');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<TradeResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [time, setTime] = useState<Date | null>(null);

  useEffect(() => {
    setTime(new Date());
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const addPlayer1 = () => {
    if (newPlayer1.trim() && players1.length < 4) {
      setPlayers1([...players1, newPlayer1.trim()]);
      setNewPlayer1('');
    }
  };

  const addPlayer2 = () => {
    if (newPlayer2.trim() && players2.length < 4) {
      setPlayers2([...players2, newPlayer2.trim()]);
      setNewPlayer2('');
    }
  };

  const removePlayer1 = (index: number) => {
    setPlayers1(players1.filter((_, i) => i !== index));
  };

  const removePlayer2 = (index: number) => {
    setPlayers2(players2.filter((_, i) => i !== index));
  };

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    // Need at least one asset on each side (player or picks)
    const hasSide1 = players1.length > 0 || picks1.length > 0;
    const hasSide2 = players2.length > 0 || picks2.length > 0;
    if (!hasSide1 || !hasSide2) return;

    setLoading(true);
    setError(null);

    try {
      // Build query params
      const params = new URLSearchParams();
      if (players1.length > 0) params.set('players1', JSON.stringify(players1));
      if (players2.length > 0) params.set('players2', JSON.stringify(players2));
      if (picks1.length > 0) params.set('picks1', JSON.stringify(picks1));
      if (picks2.length > 0) params.set('picks2', JSON.stringify(picks2));
      params.set('mode', mode);

      const res = await fetch(`/api/trade?${params.toString()}`);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Analysis failed');
      }
      const data = await res.json();
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Trade analysis failed');
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  // Re-analyze when mode changes (if we have a result)
  const handleModeChange = async (newMode: TradeMode) => {
    setMode(newMode);
    const hasSide1 = players1.length > 0 || picks1.length > 0;
    const hasSide2 = players2.length > 0 || picks2.length > 0;
    if (result && hasSide1 && hasSide2) {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (players1.length > 0) params.set('players1', JSON.stringify(players1));
        if (players2.length > 0) params.set('players2', JSON.stringify(players2));
        if (picks1.length > 0) params.set('picks1', JSON.stringify(picks1));
        if (picks2.length > 0) params.set('picks2', JSON.stringify(picks2));
        params.set('mode', newMode);

        const res = await fetch(`/api/trade?${params.toString()}`);
        if (res.ok) {
          const data = await res.json();
          setResult(data);
        }
      } finally {
        setLoading(false);
      }
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-emerald-400';
    if (score >= 65) return 'text-lime-400';
    if (score >= 45) return 'text-amber-400';
    if (score >= 25) return 'text-orange-400';
    return 'text-red-400';
  };

  const getTierColor = (tier: string) => {
    switch (tier) {
      case 'elite': return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50';
      case 'high': return 'bg-lime-500/20 text-lime-400 border-lime-500/50';
      case 'mid': return 'bg-amber-500/20 text-amber-400 border-amber-500/50';
      case 'low': return 'bg-orange-500/20 text-orange-400 border-orange-500/50';
      default: return 'bg-red-500/20 text-red-400 border-red-500/50';
    }
  };

  const getDifficultyColor = (diff: string) => {
    switch (diff) {
      case 'smash': return 'text-emerald-400';
      case 'good': return 'text-lime-400';
      case 'neutral': return 'text-zinc-400';
      case 'tough': return 'text-orange-400';
      default: return 'text-red-400';
    }
  };

  const getActionStyle = (action: string) => {
    switch (action) {
      case 'ACCEPT': return 'bg-emerald-500 text-white';
      case 'REJECT': return 'bg-red-500 text-white';
      case 'SLIGHT EDGE': return 'bg-lime-500 text-zinc-900';
      default: return 'bg-amber-500 text-zinc-900';
    }
  };

  const getSellWindowStyle = (urgency: SellWindowAlert['urgency']) => {
    switch (urgency) {
      case 'SELL NOW': return 'bg-red-500/20 text-red-400 border-red-500/50';
      case 'SELL SOON': return 'bg-orange-500/20 text-orange-400 border-orange-500/50';
      case 'BUY LOW': return 'bg-amber-500/20 text-amber-400 border-amber-500/50';
      case 'BUY NOW': return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50';
      default: return 'bg-zinc-700/20 text-zinc-400 border-zinc-600/50';
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
            <Link href="/" className="text-lg tracking-tight hover:opacity-80 transition-opacity">
              <span className="text-amber-400 font-bold">FANTASY</span>
              <span className="text-zinc-400">BRAIN</span>
            </Link>
            <nav className="flex items-center gap-4 text-sm">
              <Link href="/" className="text-zinc-400 hover:text-white transition-colors">Analysis</Link>
              <Link href="/trade" className="text-white">Trade</Link>
              <Link href="/waivers" className="text-zinc-400 hover:text-white transition-colors">Waivers</Link>
              <Link href="/diagnose" className="text-zinc-400 hover:text-white transition-colors">Diagnose</Link>
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

      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* Mode Toggle */}
        <div className="flex justify-center mb-6">
          <div className="inline-flex bg-zinc-900 border border-zinc-700 p-1">
            <button
              onClick={() => handleModeChange('dynasty')}
              className={`px-6 py-2 text-sm font-bold tracking-wider transition-colors ${
                mode === 'dynasty'
                  ? 'bg-amber-400 text-zinc-900'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              DYNASTY
            </button>
            <button
              onClick={() => handleModeChange('redraft')}
              className={`px-6 py-2 text-sm font-bold tracking-wider transition-colors ${
                mode === 'redraft'
                  ? 'bg-amber-400 text-zinc-900'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              REDRAFT
            </button>
          </div>
        </div>

        {/* Mode description */}
        <div className="text-center mb-6 text-xs text-zinc-500">
          {mode === 'dynasty' ? (
            <span>Long-term value: age curves, injury history, situation stability</span>
          ) : (
            <span>Rest-of-season value: playoff schedule, availability, usage trends</span>
          )}
        </div>

        {/* Input form */}
        <form onSubmit={handleAnalyze} className="mb-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            {/* Side 1 - Getting */}
            <div className="bg-zinc-900/50 border border-emerald-900/30 p-4">
              <label className="block text-xs text-emerald-400 uppercase tracking-wider mb-2">
                You&apos;re Getting
              </label>

              {/* Added players */}
              {players1.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-3">
                  {players1.map((name, i) => (
                    <div key={i} className="inline-flex items-center gap-2 px-3 py-1.5 bg-emerald-950/50 border border-emerald-700/50 text-emerald-300">
                      <span className="text-sm">{name}</span>
                      <button
                        type="button"
                        onClick={() => removePlayer1(i)}
                        className="text-emerald-500 hover:text-red-400"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Add player input */}
              {players1.length < 4 && (
                <div className="flex gap-2">
                  <div className="flex-1">
                    <PlayerAutocomplete
                      value={newPlayer1}
                      onChange={setNewPlayer1}
                      placeholder="Search player..."
                      inputClassName="border-emerald-700/50 focus:border-emerald-400"
                      onSelect={(player) => {
                        if (players1.length < 4) {
                          setPlayers1([...players1, player.name]);
                          setNewPlayer1('');
                        }
                      }}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={addPlayer1}
                    disabled={!newPlayer1.trim()}
                    className="px-3 py-2 bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 disabled:opacity-30 text-sm"
                  >
                    Add
                  </button>
                </div>
              )}

              {mode === 'dynasty' && (
                <PickSelector
                  picks={picks1}
                  onChange={setPicks1}
                  label="Draft Picks"
                  color="emerald"
                />
              )}
            </div>

            {/* Side 2 - Giving Up */}
            <div className="bg-zinc-900/50 border border-amber-900/30 p-4">
              <label className="block text-xs text-amber-400 uppercase tracking-wider mb-2">
                You&apos;re Giving Up
              </label>

              {/* Added players */}
              {players2.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-3">
                  {players2.map((name, i) => (
                    <div key={i} className="inline-flex items-center gap-2 px-3 py-1.5 bg-amber-950/50 border border-amber-700/50 text-amber-300">
                      <span className="text-sm">{name}</span>
                      <button
                        type="button"
                        onClick={() => removePlayer2(i)}
                        className="text-amber-500 hover:text-red-400"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Add player input */}
              {players2.length < 4 && (
                <div className="flex gap-2">
                  <div className="flex-1">
                    <PlayerAutocomplete
                      value={newPlayer2}
                      onChange={setNewPlayer2}
                      placeholder="Search player..."
                      inputClassName="border-amber-700/50 focus:border-amber-400"
                      onSelect={(player) => {
                        if (players2.length < 4) {
                          setPlayers2([...players2, player.name]);
                          setNewPlayer2('');
                        }
                      }}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={addPlayer2}
                    disabled={!newPlayer2.trim()}
                    className="px-3 py-2 bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 disabled:opacity-30 text-sm"
                  >
                    Add
                  </button>
                </div>
              )}

              {mode === 'dynasty' && (
                <PickSelector
                  picks={picks2}
                  onChange={setPicks2}
                  label="Draft Picks"
                  color="amber"
                />
              )}
            </div>
          </div>
          <button
            type="submit"
            disabled={loading || (players1.length === 0 && picks1.length === 0) || (players2.length === 0 && picks2.length === 0)}
            className="w-full bg-amber-400 text-zinc-900 px-6 py-3 text-sm font-bold tracking-wider hover:bg-amber-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'ANALYZING...' : 'ANALYZE TRADE'}
          </button>
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
            {/* VERDICT BANNER */}
            <div className={`border-4 p-6 ${
              result.verdict.action === 'ACCEPT' ? 'border-emerald-500 bg-emerald-950/30' :
              result.verdict.action === 'REJECT' ? 'border-red-500 bg-red-950/30' :
              'border-amber-500 bg-amber-950/30'
            }`}>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="text-xs text-zinc-500 uppercase tracking-wider mb-2">Trade Verdict</div>
                  <div className={`inline-block px-4 py-2 text-2xl font-black ${getActionStyle(result.verdict.action)}`}>
                    {result.verdict.action}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-zinc-500">Value Difference</div>
                  <div className={`text-4xl font-black tabular-nums ${
                    result.verdict.winner === 'side1' ? 'text-emerald-400' :
                    result.verdict.winner === 'side2' ? 'text-red-400' : 'text-amber-400'
                  }`}>
                    {result.verdict.winner === 'side1' ? '+' : result.verdict.winner === 'side2' ? '-' : ''}
                    {result.verdict.margin.toFixed(0)}
                  </div>
                  <div className="text-xs text-zinc-500">{result.verdict.confidence}% confidence</div>
                </div>
              </div>
              <div className="text-zinc-300 text-sm mb-2">{result.verdict.summary}</div>

              {/* Gun to head */}
              <div className="bg-zinc-800/50 px-3 py-2 mb-4 border-l-2 border-amber-400">
                <span className="text-amber-400 font-bold">{result.verdict.gunToHead}</span>
              </div>

              {/* Consolidation Warning */}
              {result.consolidation && result.consolidation.warning && (
                <div className="bg-purple-950/30 border border-purple-500/50 px-4 py-3 mb-4">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-purple-400 font-bold text-sm">CONSOLIDATION ALERT</span>
                  </div>
                  <div className="text-purple-300 text-sm">{result.consolidation.warning}</div>
                  <div className="text-purple-400/70 text-xs mt-1">{result.consolidation.recommendation}</div>
                </div>
              )}

              {/* Sell Window Alerts (Dynasty mode) */}
              {mode === 'dynasty' && (
                <>
                  {[...result.side1.players, ...result.side2.players]
                    .filter(p => p.sellWindow && (p.sellWindow.urgency === 'SELL NOW' || p.sellWindow.urgency === 'SELL SOON' || p.sellWindow.urgency === 'BUY NOW'))
                    .map((p, i) => (
                      <div key={i} className={`border px-3 py-2 mb-2 ${getSellWindowStyle(p.sellWindow!.urgency)}`}>
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-sm">{p.name}: {p.sellWindow!.urgency}</span>
                          <span className="text-xs opacity-80">{p.sellWindow!.eliteYearsLeft} elite yr{p.sellWindow!.eliteYearsLeft !== 1 ? 's' : ''} left</span>
                        </div>
                        <div className="text-xs opacity-80 mt-0.5">{p.sellWindow!.reason}</div>
                      </div>
                    ))
                  }
                </>
              )}

              {/* Reasoning */}
              {result.verdict.reasoning.length > 0 && (
                <div className="border-t border-zinc-700 pt-4 mt-4">
                  <div className="text-xs text-zinc-500 uppercase tracking-wider mb-2">Key Factors</div>
                  <ul className="space-y-1">
                    {result.verdict.reasoning.map((reason, i) => (
                      <li key={i} className="text-sm text-zinc-400 flex items-start gap-2">
                        <span className="text-amber-400">*</span>
                        {reason}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Side by side comparison */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Side 1 - Getting */}
              <SideCard
                label="Getting"
                labelColor="emerald"
                side={result.side1}
                mode={mode}
                getScoreColor={getScoreColor}
                getTierColor={getTierColor}
                getDifficultyColor={getDifficultyColor}
                getSellWindowStyle={getSellWindowStyle}
              />

              {/* Side 2 - Giving */}
              <SideCard
                label="Giving Up"
                labelColor="amber"
                side={result.side2}
                mode={mode}
                getScoreColor={getScoreColor}
                getTierColor={getTierColor}
                getDifficultyColor={getDifficultyColor}
                getSellWindowStyle={getSellWindowStyle}
              />
            </div>

            {/* Mode-specific disclaimer */}
            <div className="text-xs text-zinc-600 text-center">
              {mode === 'dynasty'
                ? 'Dynasty values based on age curves, injury history, and situation analysis.'
                : 'Redraft values based on remaining schedule, playoff matchups (Wks 15-17), and current usage.'
              }
            </div>
          </div>
        )}

        {/* Empty state */}
        {!result && !loading && !error && (
          <div className="text-center py-16">
            <div className="text-zinc-700 text-6xl mb-4">
              {mode === 'dynasty' ? '♔' : '🏈'}
            </div>
            <div className="text-zinc-500 text-sm uppercase tracking-widest mb-2">
              {mode === 'dynasty' ? 'Dynasty Trade Analyzer' : 'Redraft Trade Analyzer'}
            </div>
            <div className="mt-4 text-xs text-zinc-600 max-w-md mx-auto">
              {mode === 'dynasty'
                ? 'Evaluate long-term player value based on age, injury history, contract situation, and years of elite production remaining.'
                : 'Evaluate rest-of-season value based on playoff schedule strength, injury status, and recent usage trends.'
              }
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
              Calculating {mode} value...
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-800 mt-auto">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between text-xs text-zinc-600">
          <div>Data: Sleeper API + Manual Research</div>
          <div>Not financial advice. For entertainment only.</div>
        </div>
      </footer>

      <style jsx>{`
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

// Player Card Component
function PlayerCard({
  label,
  labelColor,
  data,
  mode,
  getScoreColor,
  getTierColor,
  getDifficultyColor,
  sellWindow,
  getSellWindowStyle,
}: {
  label: string;
  labelColor: 'emerald' | 'amber';
  data: DynastyValue | RedraftValue;
  mode: TradeMode;
  getScoreColor: (score: number) => string;
  getTierColor: (tier: string) => string;
  getDifficultyColor: (diff: string) => string;
  sellWindow?: SellWindowAlert;
  getSellWindowStyle: (urgency: SellWindowAlert['urgency']) => string;
}) {
  const isDynasty = mode === 'dynasty';
  const dynasty = data as DynastyValue;
  const redraft = data as RedraftValue;

  return (
    <div className="bg-zinc-900 border border-zinc-800">
      {/* Header */}
      <div className={`p-4 border-b border-zinc-800 ${labelColor === 'emerald' ? 'bg-emerald-950/20' : 'bg-amber-950/20'}`}>
        <div className={`text-xs uppercase tracking-wider mb-1 ${labelColor === 'emerald' ? 'text-emerald-400' : 'text-amber-400'}`}>
          {label}
        </div>
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl font-bold text-white">{data.player.name}</h2>
            <div className="flex items-center gap-2 mt-1">
              <span className="bg-zinc-800 px-2 py-0.5 text-xs">{data.player.team || 'FA'}</span>
              <span className="text-zinc-500 text-xs">{data.player.position}</span>
              {isDynasty && dynasty.player.age && (
                <span className="text-zinc-500 text-xs">Age {dynasty.player.age}</span>
              )}
              {data.player.team && (
                <LockTimer
                  team={data.player.team}
                  playerName={data.player.name}
                  compact
                />
              )}
            </div>
          </div>
          <div className="text-right">
            <div className={`text-3xl font-black tabular-nums ${getScoreColor(data.overallScore)}`}>
              {data.overallScore}
            </div>
            <div className="text-xs text-zinc-500">/ 100</div>
          </div>
        </div>
      </div>

      {/* Dynasty-specific content */}
      {isDynasty && (
        <div className="p-4 space-y-4">
          {/* Sell Window Alert - prominent display */}
          {sellWindow && sellWindow.urgency !== 'HOLD' && (
            <div className={`border px-3 py-2 ${getSellWindowStyle(sellWindow.urgency)}`}>
              <div className="flex items-center justify-between">
                <span className="font-bold text-sm">{sellWindow.urgency}</span>
                <span className="text-xs opacity-80">{sellWindow.eliteYearsLeft} elite yr{sellWindow.eliteYearsLeft !== 1 ? 's' : ''} left</span>
              </div>
              <div className="text-xs opacity-80 mt-0.5">{sellWindow.reason}</div>
              <div className="text-xs opacity-60 mt-1">{sellWindow.actionAdvice}</div>
            </div>
          )}

          {/* Tier badge and meta info */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className={`px-2 py-1 text-xs font-bold uppercase border ${getTierColor(dynasty.tier)}`}>
                {dynasty.tier}
              </span>
              <span className="text-xs text-zinc-500">
                {dynasty.yearsOfEliteProduction}+ elite years left
              </span>
            </div>
            {dynasty.draftCapital && (
              <span className="text-xs text-zinc-500">
                {dynasty.draftCapital.year} Rd {dynasty.draftCapital.round}
              </span>
            )}
          </div>

          {/* Score breakdown - Core */}
          <div className="space-y-2">
            <div className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Core Value</div>
            <ScoreBar label="Age" score={dynasty.ageScore} max={35} />
            <ScoreBar label="Durability" score={dynasty.injuryScore} max={30} />
            <ScoreBar label="Situation" score={dynasty.situationScore} max={35} />
          </div>

          {/* Contract Info - NEW */}
          {dynasty.contract && (
            <div className={`p-2 border text-xs ${
              dynasty.contract.risk === 'low' ? 'border-emerald-700/50 bg-emerald-950/20' :
              dynasty.contract.risk === 'medium' ? 'border-amber-700/50 bg-amber-950/20' :
              'border-red-700/50 bg-red-950/20'
            }`}>
              <div className="flex items-center justify-between">
                <span className="text-zinc-400 uppercase tracking-wider">Contract</span>
                <span className={`font-bold ${
                  dynasty.contract.risk === 'low' ? 'text-emerald-400' :
                  dynasty.contract.risk === 'medium' ? 'text-amber-400' : 'text-red-400'
                }`}>
                  {dynasty.contract.status.toUpperCase()}
                </span>
              </div>
              <div className="text-zinc-300 mt-1">{dynasty.contract.summary}</div>
              {dynasty.contract.isContractYear && (
                <div className="text-amber-400 mt-1">Playing for new deal</div>
              )}
              {dynasty.contract.isRookieDeal && (
                <div className="text-emerald-400 mt-1">Rookie deal surplus value</div>
              )}
            </div>
          )}

          {/* Score breakdown - Situation */}
          <div className="space-y-2">
            <div className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Situation Factors</div>
            <ScoreBar label="Contract" score={dynasty.contractScore} max={15} />
            <ScoreBar label="QB Stability" score={dynasty.qbStabilityScore} max={10} />
            <ScoreBar label="Competition" score={dynasty.competitionScore} max={10} />
            <ScoreBar label="Offense" score={dynasty.offenseScore} max={10} />
          </div>

          {/* Score breakdown - Development */}
          <div className="space-y-2">
            <div className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Development</div>
            <ScoreBar label="Draft Cap" score={dynasty.draftCapitalScore} max={10} />
            <ScoreBar label="Breakout" score={dynasty.breakoutScore} max={10} />
            <ScoreBar label="Depth" score={dynasty.depthChartScore} max={10} />
          </div>

          {/* Factors */}
          <FactorsList factors={dynasty.factors} />
        </div>
      )}

      {/* Redraft-specific content */}
      {!isDynasty && (
        <div className="p-4 space-y-4">
          {/* Playoff matchups */}
          <div>
            <div className="text-xs text-zinc-500 uppercase tracking-wider mb-2">Playoff Schedule</div>
            <div className="flex gap-2">
              {redraft.playoffMatchups.map((m) => (
                <div key={m.week} className="bg-zinc-800 px-3 py-2 text-center flex-1">
                  <div className="text-xs text-zinc-500">Wk {m.week}</div>
                  <div className={`text-sm font-bold ${getDifficultyColor(m.difficulty)}`}>
                    {m.opponent}
                  </div>
                  <div className={`text-xs ${getDifficultyColor(m.difficulty)}`}>
                    {m.difficulty}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Hot/Cold indicator */}
          {redraft.hotColdStreak && (
            <div className={`flex items-center justify-between px-3 py-2 ${
              redraft.hotColdStreak.trend === 'hot' ? 'bg-red-950/30 border border-red-500/30' :
              redraft.hotColdStreak.trend === 'cold' || redraft.hotColdStreak.trend === 'ice' ? 'bg-blue-950/30 border border-blue-500/30' :
              'bg-zinc-800'
            }`}>
              <span className="text-xs text-zinc-400">Last 4 games</span>
              <span className={`text-sm font-bold ${
                redraft.hotColdStreak.trend === 'hot' ? 'text-red-400' :
                redraft.hotColdStreak.trend === 'warm' ? 'text-orange-400' :
                redraft.hotColdStreak.trend === 'cold' ? 'text-blue-400' :
                redraft.hotColdStreak.trend === 'ice' ? 'text-cyan-400' : 'text-zinc-400'
              }`}>
                {redraft.hotColdStreak.last4PPG.toFixed(1)} PPG
                {redraft.hotColdStreak.trend === 'hot' && ' 🔥'}
                {redraft.hotColdStreak.trend === 'cold' && ' ❄️'}
              </span>
            </div>
          )}

          {/* Score breakdown - Core */}
          <div className="space-y-2">
            <div className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Core Value</div>
            <ScoreBar label="Schedule" score={redraft.playoffScore} max={35} />
            <ScoreBar label="Health" score={redraft.availabilityScore} max={25} />
            <ScoreBar label="Usage" score={redraft.usageScore} max={25} />
          </div>

          {/* Score breakdown - New metrics */}
          <div className="space-y-2">
            <div className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Additional Factors</div>
            <ScoreBar label="Hot/Cold" score={redraft.hotColdScore} max={15} />
            <ScoreBar label="Vegas Env" score={redraft.vegasScore} max={12} />
            <ScoreBar label="Weather" score={redraft.weatherScore} max={8} />
            <ScoreBar label="Scarcity" score={redraft.scarcityScore} max={10} />
            <ScoreBar label="Primetime" score={redraft.primetimeScore} max={8} />
          </div>

          {/* Factors */}
          <FactorsList factors={redraft.factors} />
        </div>
      )}
    </div>
  );
}

// Score Bar Component
function ScoreBar({ label, score, max }: { label: string; score: number; max: number }) {
  const pct = (score / max) * 100;
  const color = pct >= 80 ? 'bg-emerald-500' : pct >= 60 ? 'bg-lime-500' : pct >= 40 ? 'bg-amber-500' : 'bg-red-500';

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-zinc-500 w-20">{label}</span>
      <div className="flex-1 h-2 bg-zinc-800 overflow-hidden">
        <div className={`h-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-zinc-400 w-12 text-right">{score}/{max}</span>
    </div>
  );
}

// Factors List Component
function FactorsList({ factors }: { factors: { positive: string[]; negative: string[]; neutral: string[] } }) {
  return (
    <div className="space-y-2 text-xs">
      {factors.positive.slice(0, 2).map((f, i) => (
        <div key={`p${i}`} className="flex items-start gap-2">
          <span className="text-emerald-400">+</span>
          <span className="text-zinc-300">{f}</span>
        </div>
      ))}
      {factors.negative.slice(0, 2).map((f, i) => (
        <div key={`n${i}`} className="flex items-start gap-2">
          <span className="text-red-400">-</span>
          <span className="text-zinc-300">{f}</span>
        </div>
      ))}
    </div>
  );
}

// Format pick for display
function formatPickLabel(pick: DraftPick): string {
  const posLabel = pick.position === 'early' ? 'Early' : pick.position === 'late' ? 'Late' : 'Mid';
  const roundLabel = pick.round === 1 ? '1st' : pick.round === 2 ? '2nd' : pick.round === 3 ? '3rd' : '4th';
  return `${pick.year} ${posLabel} ${roundLabel}`;
}

// Side Card Component - handles players + picks
function SideCard({
  label,
  labelColor,
  side,
  mode,
  getScoreColor,
  getTierColor,
  getDifficultyColor,
  getSellWindowStyle,
}: {
  label: string;
  labelColor: 'emerald' | 'amber';
  side: TradeSide;
  mode: TradeMode;
  getScoreColor: (score: number) => string;
  getTierColor: (tier: string) => string;
  getDifficultyColor: (diff: string) => string;
  getSellWindowStyle: (urgency: SellWindowAlert['urgency']) => string;
}) {
  const isDynasty = mode === 'dynasty';
  const totalScore = isDynasty ? side.totalDynastyValue : side.totalRedraftValue;
  const hasPlayer = side.players.length > 0;
  const hasPicks = side.picks.length > 0;

  // If we have a single player, show detailed view
  if (hasPlayer && side.players.length === 1 && !hasPicks) {
    const p = side.players[0];
    return (
      <PlayerCard
        label={label}
        labelColor={labelColor}
        data={isDynasty ? p.dynasty : p.redraft}
        mode={mode}
        getScoreColor={getScoreColor}
        getTierColor={getTierColor}
        getDifficultyColor={getDifficultyColor}
        sellWindow={p.sellWindow}
        getSellWindowStyle={getSellWindowStyle}
      />
    );
  }

  // Multi-asset view (players + picks)
  return (
    <div className="bg-zinc-900 border border-zinc-800">
      {/* Header */}
      <div className={`p-4 border-b border-zinc-800 ${labelColor === 'emerald' ? 'bg-emerald-950/20' : 'bg-amber-950/20'}`}>
        <div className={`text-xs uppercase tracking-wider mb-1 ${labelColor === 'emerald' ? 'text-emerald-400' : 'text-amber-400'}`}>
          {label}
        </div>
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold text-white">
              {hasPlayer ? side.players.map(p => p.name).join(' + ') : ''}
              {hasPlayer && hasPicks ? ' + ' : ''}
              {hasPicks ? side.picks.map(p => formatPickLabel(p.pick)).join(' + ') : ''}
            </h2>
            <div className="text-xs text-zinc-500 mt-1">
              {hasPlayer && `${side.players.length} player${side.players.length > 1 ? 's' : ''}`}
              {hasPlayer && hasPicks && ' + '}
              {hasPicks && `${side.picks.length} pick${side.picks.length > 1 ? 's' : ''}`}
            </div>
          </div>
          <div className="text-right">
            <div className={`text-3xl font-black tabular-nums ${getScoreColor(totalScore)}`}>
              {totalScore}
            </div>
            <div className="text-xs text-zinc-500">total pts</div>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Players */}
        {side.players.map((p, i) => {
          const val = isDynasty ? p.dynasty : p.redraft;
          return (
            <div key={i} className="border-b border-zinc-800 pb-3 last:border-0 last:pb-0">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-white">{p.name}</span>
                  <span className="text-xs text-zinc-500">{val.player.team} {val.player.position}</span>
                </div>
                <span className={`font-bold ${getScoreColor(val.overallScore)}`}>{val.overallScore}</span>
              </div>
              {isDynasty && (
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`px-2 py-0.5 text-xs font-bold uppercase border ${getTierColor(p.dynasty.tier)}`}>
                    {p.dynasty.tier}
                  </span>
                  <span className="text-xs text-zinc-500">{p.dynasty.yearsOfEliteProduction}+ elite years</span>
                  {p.sellWindow && p.sellWindow.urgency !== 'HOLD' && (
                    <span className={`px-2 py-0.5 text-xs font-bold uppercase border ${getSellWindowStyle(p.sellWindow.urgency)}`}>
                      {p.sellWindow.urgency}
                    </span>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {/* Picks */}
        {side.picks.map((p, i) => (
          <div key={`pick-${i}`} className="border-b border-zinc-800 pb-3 last:border-0 last:pb-0">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-amber-400">📋</span>
                <span className="font-bold text-white">{formatPickLabel(p.pick)}</span>
              </div>
              <span className={`font-bold ${getScoreColor(p.value.dynastyScore)}`}>{p.value.dynastyScore}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className={`px-2 py-0.5 text-xs font-bold uppercase border ${getTierColor(p.value.tier)}`}>
                {p.value.tier}
              </span>
              <span className="text-xs text-zinc-500">≈ {p.value.playerEquivalent}</span>
            </div>
          </div>
        ))}

        {/* Value breakdown if multiple assets */}
        {(side.players.length + side.picks.length) > 1 && (
          <div className="pt-2 border-t border-zinc-700">
            <div className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Value Breakdown</div>
            {side.players.map((p, i) => (
              <div key={i} className="flex justify-between text-sm">
                <span className="text-zinc-400">{p.name}</span>
                <span className="text-zinc-300">{isDynasty ? p.dynasty.overallScore : p.redraft.overallScore} pts</span>
              </div>
            ))}
            {side.picks.map((p, i) => (
              <div key={`pb-${i}`} className="flex justify-between text-sm">
                <span className="text-zinc-400">{formatPickLabel(p.pick)}</span>
                <span className="text-zinc-300">{p.value.dynastyScore} pts</span>
              </div>
            ))}
            <div className="flex justify-between text-sm font-bold border-t border-zinc-700 pt-1 mt-1">
              <span className="text-zinc-300">Total</span>
              <span className={getScoreColor(totalScore)}>{totalScore} pts</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
