'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import PlayerAutocomplete from '@/components/PlayerAutocomplete';
import LockTimer from '@/components/LockTimer';

type TradeMode = 'dynasty' | 'redraft';

interface DynastyValue {
  player: { name: string; team: string | null; position: string; age?: number };
  overallScore: number;
  ageScore: number;
  injuryScore: number;
  situationScore: number;
  yearsOfEliteProduction: number;
  tier: 'elite' | 'high' | 'mid' | 'low' | 'avoid';
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
  playoffMatchups: Array<{ week: number; opponent: string; difficulty: string }>;
  factors: { positive: string[]; negative: string[]; neutral: string[] };
  summary: string;
}

interface TradeResult {
  player1: { dynasty: DynastyValue; redraft: RedraftValue };
  player2: { dynasty: DynastyValue; redraft: RedraftValue };
  verdict: {
    winner: 'player1' | 'player2' | 'even';
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
  const [player1, setPlayer1] = useState('');
  const [player2, setPlayer2] = useState('');
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

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!player1.trim() || !player2.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(
        `/api/trade?player1=${encodeURIComponent(player1)}&player2=${encodeURIComponent(player2)}&mode=${mode}`
      );
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
    if (result && player1 && player2) {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/trade?player1=${encodeURIComponent(player1)}&player2=${encodeURIComponent(player2)}&mode=${newMode}`
        );
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
          <div className="flex items-center gap-4">
            <Link href="/" className="text-lg tracking-tight hover:opacity-80 transition-opacity">
              <span className="text-amber-400 font-bold">FANTASY</span>
              <span className="text-zinc-400">BRAIN</span>
            </Link>
            <div className="h-4 w-px bg-zinc-700" />
            <span className="text-xs text-zinc-500 uppercase tracking-widest">Trade Analyzer</span>
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
            <div>
              <label className="block text-xs text-zinc-500 uppercase tracking-wider mb-2">
                Player You&apos;re Getting
              </label>
              <PlayerAutocomplete
                value={player1}
                onChange={setPlayer1}
                placeholder="e.g., Ja'Marr Chase"
                inputClassName="border-emerald-700/50 focus:border-emerald-400"
              />
            </div>
            <div>
              <label className="block text-xs text-zinc-500 uppercase tracking-wider mb-2">
                Player You&apos;re Giving Up
              </label>
              <PlayerAutocomplete
                value={player2}
                onChange={setPlayer2}
                placeholder="e.g., Derrick Henry"
                inputClassName="border-amber-700/50 focus:border-amber-400"
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={loading || !player1.trim() || !player2.trim()}
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
                    result.verdict.winner === 'player1' ? 'text-emerald-400' :
                    result.verdict.winner === 'player2' ? 'text-red-400' : 'text-amber-400'
                  }`}>
                    {result.verdict.winner === 'player1' ? '+' : result.verdict.winner === 'player2' ? '-' : ''}
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
              {/* Player 1 - Getting */}
              <PlayerCard
                label="Getting"
                labelColor="emerald"
                data={mode === 'dynasty' ? result.player1.dynasty : result.player1.redraft}
                mode={mode}
                getScoreColor={getScoreColor}
                getTierColor={getTierColor}
                getDifficultyColor={getDifficultyColor}
              />

              {/* Player 2 - Giving */}
              <PlayerCard
                label="Giving Up"
                labelColor="amber"
                data={mode === 'dynasty' ? result.player2.dynasty : result.player2.redraft}
                mode={mode}
                getScoreColor={getScoreColor}
                getTierColor={getTierColor}
                getDifficultyColor={getDifficultyColor}
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
}: {
  label: string;
  labelColor: 'emerald' | 'amber';
  data: DynastyValue | RedraftValue;
  mode: TradeMode;
  getScoreColor: (score: number) => string;
  getTierColor: (tier: string) => string;
  getDifficultyColor: (diff: string) => string;
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
          {/* Tier badge */}
          <div className="flex items-center gap-2">
            <span className={`px-2 py-1 text-xs font-bold uppercase border ${getTierColor(dynasty.tier)}`}>
              {dynasty.tier}
            </span>
            <span className="text-xs text-zinc-500">
              {dynasty.yearsOfEliteProduction}+ elite years left
            </span>
          </div>

          {/* Score breakdown */}
          <div className="space-y-2">
            <ScoreBar label="Age" score={dynasty.ageScore} max={35} />
            <ScoreBar label="Durability" score={dynasty.injuryScore} max={30} />
            <ScoreBar label="Situation" score={dynasty.situationScore} max={35} />
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

          {/* Score breakdown */}
          <div className="space-y-2">
            <ScoreBar label="Schedule" score={redraft.playoffScore} max={35} />
            <ScoreBar label="Health" score={redraft.availabilityScore} max={25} />
            <ScoreBar label="Usage" score={redraft.usageScore} max={25} />
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
