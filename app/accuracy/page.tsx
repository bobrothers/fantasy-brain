'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface AccuracyStats {
  total: number;
  correct: number;
  hitRate: number;
}

interface EdgeWeight {
  edgeType: string;
  weight: number;
  hitRate: number;
  predictions: number;
  qbWeight: number;
  rbWeight: number;
  wrWeight: number;
  teWeight: number;
}

interface AccuracyReport {
  season: number;
  totalPredictions: number;
  overallHitRate: number;
  byRecommendation: Record<string, AccuracyStats>;
  byPosition: Record<string, AccuracyStats>;
  byConfidence: {
    high: AccuracyStats;
    medium: AccuracyStats;
    low: AccuracyStats;
  };
  byEdgeType: Record<string, AccuracyStats>;
  biggestHits: Array<{
    playerName: string;
    week: number;
    edgeScore: number;
    recommendation: string;
    actualPoints: number;
    positionRank: number;
  }>;
  biggestMisses: Array<{
    playerName: string;
    week: number;
    edgeScore: number;
    recommendation: string;
    actualPoints: number;
    positionRank: number;
  }>;
  updatedAt: string;
}

export default function AccuracyPage() {
  const [report, setReport] = useState<AccuracyReport | null>(null);
  const [weights, setWeights] = useState<EdgeWeight[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [time, setTime] = useState<Date | null>(null);
  const [showWeights, setShowWeights] = useState(false);

  useEffect(() => {
    setTime(new Date());
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch accuracy and weights in parallel
        const [accuracyRes, weightsRes] = await Promise.all([
          fetch('/api/accuracy'),
          fetch('/api/weights'),
        ]);

        if (!accuracyRes.ok) throw new Error('Failed to fetch accuracy data');
        const accuracyData = await accuracyRes.json();
        setReport(accuracyData);

        if (weightsRes.ok) {
          const weightsData = await weightsRes.json();
          setWeights(weightsData.weights || []);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load accuracy data');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const getHitRateColor = (rate: number) => {
    if (rate >= 70) return 'text-emerald-400';
    if (rate >= 55) return 'text-lime-400';
    if (rate >= 40) return 'text-amber-400';
    return 'text-red-400';
  };

  const getScoreColor = (score: number) => {
    if (score >= 3) return 'text-emerald-400';
    if (score >= 1) return 'text-lime-400';
    if (score <= -3) return 'text-red-400';
    if (score <= -1) return 'text-orange-400';
    return 'text-zinc-400';
  };

  const getWeightColor = (weight: number) => {
    if (weight >= 1.5) return 'text-emerald-400';
    if (weight >= 1.2) return 'text-lime-400';
    if (weight <= 0.5) return 'text-red-400';
    if (weight <= 0.8) return 'text-orange-400';
    return 'text-zinc-400';
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
            <Link
              href="/"
              className="text-lg tracking-tight hover:opacity-80 transition-opacity flex items-center gap-2"
            >
              <span className="text-amber-400 font-bold">FANTASY</span>
              <span className="text-zinc-400">BRAIN</span>
            </Link>
            <nav className="flex items-center gap-4 text-sm">
              <Link href="/" className="text-zinc-400 hover:text-white transition-colors">
                Analysis
              </Link>
              <Link href="/trade" className="text-zinc-400 hover:text-white transition-colors">
                Trade
              </Link>
              <Link href="/waivers" className="text-zinc-400 hover:text-white transition-colors">
                Waivers
              </Link>
              <Link href="/accuracy" className="text-white">
                Accuracy
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-4 text-xs">
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
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-white mb-2">
            Prediction Accuracy
          </h1>
          <p className="text-zinc-500">
            Historical performance of our edge detection system. Updated weekly after games.
          </p>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="text-center py-20">
            <div className="inline-block relative">
              <div className="w-16 h-16 border-2 border-zinc-800 border-t-amber-400 rounded-full animate-spin" />
            </div>
            <div className="mt-6 text-zinc-500 text-sm uppercase tracking-widest animate-pulse">
              Loading accuracy data...
            </div>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="bg-red-950/50 border border-red-800 px-4 py-3 mb-8">
            <span className="text-red-400">{error}</span>
          </div>
        )}

        {/* No Data State */}
        {!loading && !error && report && report.totalPredictions === 0 && (
          <div className="text-center py-20">
            <div className="text-zinc-700 text-6xl mb-4">◇</div>
            <div className="text-zinc-500 text-sm uppercase tracking-widest mb-4">
              No predictions tracked yet
            </div>
            <p className="text-zinc-600 text-sm max-w-md mx-auto">
              Predictions are logged when players are analyzed before games. After games complete,
              outcomes are fetched and accuracy is calculated.
            </p>
            <Link
              href="/"
              className="mt-6 inline-block bg-amber-400 text-zinc-900 px-6 py-2 text-sm font-bold tracking-wider hover:bg-amber-300 transition-colors"
            >
              ANALYZE PLAYERS
            </Link>
          </div>
        )}

        {/* Report Data */}
        {!loading && !error && report && report.totalPredictions > 0 && (
          <div className="space-y-8 animate-fadeIn">
            {/* Hero Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-zinc-900 border border-zinc-800 p-6 text-center">
                <div className="text-xs text-zinc-500 uppercase tracking-wider mb-2">
                  Total Predictions
                </div>
                <div className="text-5xl font-black text-white tabular-nums">
                  {report.totalPredictions.toLocaleString()}
                </div>
              </div>
              <div className="bg-zinc-900 border border-zinc-800 p-6 text-center">
                <div className="text-xs text-zinc-500 uppercase tracking-wider mb-2">
                  Overall Hit Rate
                </div>
                <div className={`text-5xl font-black tabular-nums ${getHitRateColor(report.overallHitRate)}`}>
                  {report.overallHitRate}%
                </div>
              </div>
              <div className="bg-zinc-900 border border-zinc-800 p-6 text-center">
                <div className="text-xs text-zinc-500 uppercase tracking-wider mb-2">
                  Season
                </div>
                <div className="text-5xl font-black text-amber-400 tabular-nums">
                  {report.season}
                </div>
              </div>
            </div>

            {/* By Recommendation */}
            <div className="bg-zinc-900 border border-zinc-800 p-6">
              <h2 className="text-xs text-zinc-500 uppercase tracking-wider mb-4">
                Hit Rate by Recommendation
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                {Object.entries(report.byRecommendation)
                  .sort((a, b) => b[1].hitRate - a[1].hitRate)
                  .map(([rec, stats]) => (
                    <div key={rec} className="text-center">
                      <div className="text-lg font-bold text-zinc-300">{rec}</div>
                      <div className={`text-2xl font-black ${getHitRateColor(stats.hitRate)}`}>
                        {stats.hitRate}%
                      </div>
                      <div className="text-xs text-zinc-600">
                        {stats.correct}/{stats.total}
                      </div>
                    </div>
                  ))}
              </div>
            </div>

            {/* By Position */}
            <div className="bg-zinc-900 border border-zinc-800 p-6">
              <h2 className="text-xs text-zinc-500 uppercase tracking-wider mb-4">
                Hit Rate by Position
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {['QB', 'RB', 'WR', 'TE'].map((pos) => {
                  const stats = report.byPosition[pos];
                  if (!stats) return null;
                  return (
                    <div key={pos} className="text-center bg-zinc-800/50 p-4">
                      <div className="text-xl font-bold text-zinc-300">{pos}</div>
                      <div className={`text-3xl font-black ${getHitRateColor(stats.hitRate)}`}>
                        {stats.hitRate}%
                      </div>
                      <div className="text-xs text-zinc-600 mt-1">
                        {stats.correct} of {stats.total} correct
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Confidence Calibration */}
            <div className="bg-zinc-900 border border-zinc-800 p-6">
              <h2 className="text-xs text-zinc-500 uppercase tracking-wider mb-4">
                Confidence Calibration
              </h2>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center bg-zinc-800/50 p-4">
                  <div className="text-sm font-bold text-zinc-400">High (80%+)</div>
                  <div className={`text-3xl font-black ${getHitRateColor(report.byConfidence.high.hitRate)}`}>
                    {report.byConfidence.high.hitRate}%
                  </div>
                  <div className="text-xs text-zinc-600 mt-1">
                    {report.byConfidence.high.total} predictions
                  </div>
                </div>
                <div className="text-center bg-zinc-800/50 p-4">
                  <div className="text-sm font-bold text-zinc-400">Medium (60-79%)</div>
                  <div className={`text-3xl font-black ${getHitRateColor(report.byConfidence.medium.hitRate)}`}>
                    {report.byConfidence.medium.hitRate}%
                  </div>
                  <div className="text-xs text-zinc-600 mt-1">
                    {report.byConfidence.medium.total} predictions
                  </div>
                </div>
                <div className="text-center bg-zinc-800/50 p-4">
                  <div className="text-sm font-bold text-zinc-400">Low (&lt;60%)</div>
                  <div className={`text-3xl font-black ${getHitRateColor(report.byConfidence.low.hitRate)}`}>
                    {report.byConfidence.low.hitRate}%
                  </div>
                  <div className="text-xs text-zinc-600 mt-1">
                    {report.byConfidence.low.total} predictions
                  </div>
                </div>
              </div>
              <p className="text-xs text-zinc-600 mt-4">
                A well-calibrated system shows higher hit rates for high-confidence predictions.
              </p>
            </div>

            {/* Edge Type Leaderboard */}
            <div className="bg-zinc-900 border border-zinc-800 p-6">
              <h2 className="text-xs text-zinc-500 uppercase tracking-wider mb-4">
                Edge Type Performance
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-zinc-500 border-b border-zinc-800">
                      <th className="pb-2">Edge Type</th>
                      <th className="pb-2 text-right">Hit Rate</th>
                      <th className="pb-2 text-right">Predictions</th>
                      <th className="pb-2 text-right">Correct</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(report.byEdgeType)
                      .sort((a, b) => b[1].hitRate - a[1].hitRate)
                      .map(([type, stats]) => (
                        <tr key={type} className="border-b border-zinc-800/50">
                          <td className="py-2 text-zinc-300">
                            {type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                          </td>
                          <td className={`py-2 text-right font-bold ${getHitRateColor(stats.hitRate)}`}>
                            {stats.hitRate}%
                          </td>
                          <td className="py-2 text-right text-zinc-500">{stats.total}</td>
                          <td className="py-2 text-right text-zinc-500">{stats.correct}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Learned Weights */}
            {weights.length > 0 && (
              <div className="bg-zinc-900 border border-amber-800/50 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xs text-amber-500 uppercase tracking-wider flex items-center gap-2">
                    <span className="text-amber-400">&#x2699;</span> Learned Edge Weights
                  </h2>
                  <button
                    onClick={() => setShowWeights(!showWeights)}
                    className="text-xs text-amber-400 hover:text-amber-300"
                  >
                    {showWeights ? 'Hide Details' : 'Show Details'}
                  </button>
                </div>

                <p className="text-xs text-zinc-500 mb-4">
                  The system learns which edge signals are most predictive and adjusts their weights automatically.
                  Higher weights = more influence on predictions.
                </p>

                {/* Summary: Top boosted and reduced edges */}
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <div className="text-xs text-emerald-500 mb-2">Top Boosted Edges</div>
                    {weights
                      .filter((w) => w.weight > 1.1)
                      .slice(0, 3)
                      .map((w) => (
                        <div key={w.edgeType} className="flex justify-between text-sm mb-1">
                          <span className="text-zinc-400">
                            {w.edgeType.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                          </span>
                          <span className={getWeightColor(w.weight)}>{w.weight.toFixed(2)}x</span>
                        </div>
                      ))}
                    {weights.filter((w) => w.weight > 1.1).length === 0 && (
                      <span className="text-zinc-600 text-xs">No boosted edges yet</span>
                    )}
                  </div>
                  <div>
                    <div className="text-xs text-red-500 mb-2">Reduced Edges</div>
                    {weights
                      .filter((w) => w.weight < 0.9 && w.weight > 0)
                      .slice(0, 3)
                      .map((w) => (
                        <div key={w.edgeType} className="flex justify-between text-sm mb-1">
                          <span className="text-zinc-400">
                            {w.edgeType.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                          </span>
                          <span className={getWeightColor(w.weight)}>{w.weight.toFixed(2)}x</span>
                        </div>
                      ))}
                    {weights.filter((w) => w.weight < 0.9 && w.weight > 0).length === 0 && (
                      <span className="text-zinc-600 text-xs">No reduced edges yet</span>
                    )}
                  </div>
                </div>

                {/* Full table when expanded */}
                {showWeights && (
                  <div className="overflow-x-auto mt-4 border-t border-zinc-800 pt-4">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-zinc-500 border-b border-zinc-800">
                          <th className="pb-2">Edge Type</th>
                          <th className="pb-2 text-right">Weight</th>
                          <th className="pb-2 text-right">Hit Rate</th>
                          <th className="pb-2 text-right">QB</th>
                          <th className="pb-2 text-right">RB</th>
                          <th className="pb-2 text-right">WR</th>
                          <th className="pb-2 text-right">TE</th>
                        </tr>
                      </thead>
                      <tbody>
                        {weights.map((w) => (
                          <tr key={w.edgeType} className="border-b border-zinc-800/50">
                            <td className="py-2 text-zinc-300">
                              {w.edgeType.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                            </td>
                            <td className={`py-2 text-right font-bold ${getWeightColor(w.weight)}`}>
                              {w.weight.toFixed(2)}x
                            </td>
                            <td className={`py-2 text-right ${getHitRateColor(w.hitRate)}`}>
                              {w.hitRate > 0 ? `${w.hitRate.toFixed(1)}%` : '-'}
                            </td>
                            <td className={`py-2 text-right ${getWeightColor(w.qbWeight)}`}>
                              {w.qbWeight !== 1 ? `${w.qbWeight.toFixed(2)}` : '-'}
                            </td>
                            <td className={`py-2 text-right ${getWeightColor(w.rbWeight)}`}>
                              {w.rbWeight !== 1 ? `${w.rbWeight.toFixed(2)}` : '-'}
                            </td>
                            <td className={`py-2 text-right ${getWeightColor(w.wrWeight)}`}>
                              {w.wrWeight !== 1 ? `${w.wrWeight.toFixed(2)}` : '-'}
                            </td>
                            <td className={`py-2 text-right ${getWeightColor(w.teWeight)}`}>
                              {w.teWeight !== 1 ? `${w.teWeight.toFixed(2)}` : '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* Biggest Hits & Misses */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Biggest Hits */}
              <div className="bg-zinc-900 border border-emerald-800/50 p-6">
                <h2 className="text-xs text-emerald-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                  <span className="text-emerald-400">✓</span> Biggest Hits
                </h2>
                {report.biggestHits.length === 0 ? (
                  <p className="text-zinc-600 text-sm">No hits recorded yet</p>
                ) : (
                  <div className="space-y-3">
                    {report.biggestHits.map((hit, i) => (
                      <div key={i} className="flex items-center justify-between">
                        <div>
                          <div className="text-zinc-300 font-medium">{hit.playerName}</div>
                          <div className="text-xs text-zinc-600">
                            Week {hit.week} • {hit.recommendation} • #{hit.positionRank} finish
                          </div>
                        </div>
                        <div className="text-right">
                          <div className={`font-bold ${getScoreColor(hit.edgeScore)}`}>
                            {hit.edgeScore > 0 ? '+' : ''}
                            {hit.edgeScore.toFixed(1)}
                          </div>
                          <div className="text-xs text-emerald-400">{hit.actualPoints.toFixed(1)} pts</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Biggest Misses */}
              <div className="bg-zinc-900 border border-red-800/50 p-6">
                <h2 className="text-xs text-red-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                  <span className="text-red-400">!</span> Biggest Misses
                </h2>
                {report.biggestMisses.length === 0 ? (
                  <p className="text-zinc-600 text-sm">No misses recorded yet</p>
                ) : (
                  <div className="space-y-3">
                    {report.biggestMisses.map((miss, i) => (
                      <div key={i} className="flex items-center justify-between">
                        <div>
                          <div className="text-zinc-300 font-medium">{miss.playerName}</div>
                          <div className="text-xs text-zinc-600">
                            Week {miss.week} • {miss.recommendation} • #{miss.positionRank} finish
                          </div>
                        </div>
                        <div className="text-right">
                          <div className={`font-bold ${getScoreColor(miss.edgeScore)}`}>
                            {miss.edgeScore > 0 ? '+' : ''}
                            {miss.edgeScore.toFixed(1)}
                          </div>
                          <div className="text-xs text-red-400">{miss.actualPoints.toFixed(1)} pts</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Updated At */}
            <div className="text-center text-xs text-zinc-600">
              Last updated: {new Date(report.updatedAt).toLocaleString()}
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-800 mt-auto">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between text-xs text-zinc-600">
          <div>Data: Sleeper API for outcomes</div>
          <div>Accuracy calculated after each week&apos;s games complete</div>
        </div>
      </footer>

      <style jsx>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fadeIn {
          animation: fadeIn 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}
