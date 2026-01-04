'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import PlayerAutocomplete from '@/components/PlayerAutocomplete';

type InputMode = 'upload' | 'manual';

interface ExtractedPlayer {
  name: string;
  id: string;
  extractedAs: string;
  confidence: number;
  matchType: string;
}

interface ParseResult {
  success: boolean;
  extractedNames: string[];
  matchedPlayers: ExtractedPlayer[];
  notMatched: Array<{ extractedName: string; reason: string }>;
  message: string;
}

interface PositionGroup {
  starters: Array<{
    name: string;
    position: string;
    age: number;
    dynastyValue: { overallScore: number; tier: string };
    sellWindow: { urgency: string; reason: string };
  }>;
  depth: Array<{
    name: string;
    position: string;
    age: number;
    dynastyValue: { overallScore: number; tier: string };
    sellWindow: { urgency: string; reason: string };
  }>;
  totalValue: number;
  avgAge: number;
  avgScore: number;
  strengthRating: 'elite' | 'strong' | 'average' | 'weak' | 'dire';
}

// Production-based position group for Win Now
interface ProductionPositionGroup {
  starters: Array<{
    name: string;
    position: string;
    seasonPPG: number;
    last4PPG: number;
    gamesPlayed: number;
    trend: 'hot' | 'warm' | 'neutral' | 'cold' | 'ice';
  }>;
  avgPPG: number;
  avgLast4PPG: number;
  strengthRating: 'elite' | 'strong' | 'average' | 'weak' | 'dire';
  positionRank: string;
}

// Win Now Assessment
interface WinNowAssessment {
  verdict: 'CHAMPIONSHIP READY' | 'PLAYOFF TEAM' | 'BUBBLE TEAM' | 'NOT COMPETING';
  confidence: number;
  summary: string;
  positions: {
    QB: ProductionPositionGroup;
    RB: ProductionPositionGroup;
    WR: ProductionPositionGroup;
    TE: ProductionPositionGroup;
  };
  metrics: {
    projectedWeeklyPoints: number;
    avgStarterPPG: number;
    avgLast4PPG: number;
    hotPlayers: number;
    coldPlayers: number;
    injuredStarters: number;
  };
  issues: string[];
  strengths: string[];
}

// Dynasty Outlook
interface DynastyOutlook {
  classification: 'CONTENDER' | 'REBUILD' | 'STUCK IN THE MIDDLE';
  confidence: number;
  summary: string;
  positions: {
    QB: PositionGroup;
    RB: PositionGroup;
    WR: PositionGroup;
    TE: PositionGroup;
  };
  metrics: {
    totalRosterValue: number;
    avgStarterAge: number;
    avgStarterScore: number;
    eliteAssets: number;
    youngAssets: number;
    agingAssets: number;
    draftCapital: number;
  };
  recommendations: {
    moves: string[];
    targets: string[];
    sells: string[];
    holds: string[];
  };
  strengths: string[];
  weaknesses: string[];
  outlook: string;
}

interface TeamDiagnosis {
  // New two-mode structure
  dynastyOutlook?: DynastyOutlook;
  winNow?: WinNowAssessment;
  comparison?: {
    dynastyRating: 'elite' | 'strong' | 'average' | 'weak' | 'dire';
    winNowRating: 'elite' | 'strong' | 'average' | 'weak' | 'dire';
    gap: string;
  };

  // Legacy fields
  classification: 'CONTENDER' | 'REBUILD' | 'STUCK IN THE MIDDLE';
  confidence: number;
  summary: string;
  positions: {
    QB: PositionGroup;
    RB: PositionGroup;
    WR: PositionGroup;
    TE: PositionGroup;
  };
  metrics: {
    totalRosterValue: number;
    avgStarterAge: number;
    avgStarterScore: number;
    eliteAssets: number;
    youngAssets: number;
    agingAssets: number;
    draftCapital: number;
  };
  recommendations: {
    moves: string[];
    targets: string[];
    sells: string[];
    holds: string[];
  };
  strengths: string[];
  weaknesses: string[];
  outlook: string;
}

type ViewMode = 'win-now' | 'dynasty';

interface DiagnoseResult {
  diagnosis: TeamDiagnosis;
  foundPlayers: number;
  notFound?: string[];
}

export default function DiagnosePage() {
  const [players, setPlayers] = useState<string[]>([]);
  const [newPlayer, setNewPlayer] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<DiagnoseResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [time, setTime] = useState<Date | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('win-now');

  // Image upload states
  const [inputMode, setInputMode] = useState<InputMode>('upload');
  const [isDragging, setIsDragging] = useState(false);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  useEffect(() => {
    setTime(new Date());
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Handle file drop
  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      await processImage(file);
    } else {
      setError('Please drop an image file (PNG, JPG, or WebP)');
    }
  }, []);

  // Handle file select
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await processImage(file);
    }
  };

  // Process uploaded image
  const processImage = async (file: File) => {
    setUploadLoading(true);
    setError(null);
    setParseResult(null);

    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => setImagePreview(e.target?.result as string);
    reader.readAsDataURL(file);

    try {
      const formData = new FormData();
      formData.append('image', file);

      const res = await fetch('/api/parse-roster-image', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to parse image');
      }

      setParseResult(data);

      // Auto-populate players if we found matches
      if (data.matchedPlayers && data.matchedPlayers.length > 0) {
        const names = data.matchedPlayers.map((p: ExtractedPlayer) => p.name);
        setPlayers(names);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process image');
    } finally {
      setUploadLoading(false);
    }
  };

  // Remove extracted player
  const removeExtractedPlayer = (name: string) => {
    setPlayers(players.filter(p => p !== name));
    if (parseResult) {
      setParseResult({
        ...parseResult,
        matchedPlayers: parseResult.matchedPlayers.filter(p => p.name !== name),
      });
    }
  };

  // Clear upload and start over
  const clearUpload = () => {
    setImagePreview(null);
    setParseResult(null);
    setPlayers([]);
    setError(null);
  };

  const addPlayer = () => {
    if (newPlayer.trim() && !players.includes(newPlayer.trim())) {
      setPlayers([...players, newPlayer.trim()]);
      setNewPlayer('');
    }
  };

  const removePlayer = (index: number) => {
    setPlayers(players.filter((_, i) => i !== index));
  };

  const handleDiagnose = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (players.length < 3) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/diagnose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ players }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Diagnosis failed');
      }

      const data = await res.json();
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Diagnosis failed');
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  const getClassificationStyle = (classification: TeamDiagnosis['classification']) => {
    switch (classification) {
      case 'CONTENDER': return 'bg-emerald-500 text-white';
      case 'REBUILD': return 'bg-purple-500 text-white';
      default: return 'bg-amber-500 text-zinc-900';
    }
  };

  const getStrengthColor = (rating: PositionGroup['strengthRating']) => {
    switch (rating) {
      case 'elite': return 'text-emerald-400 bg-emerald-950/30 border-emerald-500/50';
      case 'strong': return 'text-lime-400 bg-lime-950/30 border-lime-500/50';
      case 'average': return 'text-amber-400 bg-amber-950/30 border-amber-500/50';
      case 'weak': return 'text-orange-400 bg-orange-950/30 border-orange-500/50';
      default: return 'text-red-400 bg-red-950/30 border-red-500/50';
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-emerald-400';
    if (score >= 65) return 'text-lime-400';
    if (score >= 50) return 'text-amber-400';
    if (score >= 35) return 'text-orange-400';
    return 'text-red-400';
  };

  const getVerdictStyle = (verdict: WinNowAssessment['verdict']) => {
    switch (verdict) {
      case 'CHAMPIONSHIP READY': return 'bg-emerald-500 text-white';
      case 'PLAYOFF TEAM': return 'bg-lime-500 text-zinc-900';
      case 'BUBBLE TEAM': return 'bg-amber-500 text-zinc-900';
      default: return 'bg-red-500 text-white';
    }
  };

  const getTrendColor = (trend: 'hot' | 'warm' | 'neutral' | 'cold' | 'ice') => {
    switch (trend) {
      case 'hot': return 'text-emerald-400';
      case 'warm': return 'text-lime-400';
      case 'neutral': return 'text-zinc-400';
      case 'cold': return 'text-orange-400';
      case 'ice': return 'text-red-400';
    }
  };

  const getTrendIcon = (trend: 'hot' | 'warm' | 'neutral' | 'cold' | 'ice') => {
    switch (trend) {
      case 'hot': return '🔥';
      case 'warm': return '📈';
      case 'neutral': return '➖';
      case 'cold': return '📉';
      case 'ice': return '🧊';
    }
  };

  const getRatingColor = (rating: 'elite' | 'strong' | 'average' | 'weak' | 'dire') => {
    switch (rating) {
      case 'elite': return 'text-emerald-400 border-emerald-500';
      case 'strong': return 'text-lime-400 border-lime-500';
      case 'average': return 'text-amber-400 border-amber-500';
      case 'weak': return 'text-orange-400 border-orange-500';
      case 'dire': return 'text-red-400 border-red-500';
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
              <Link href="/trade" className="text-zinc-400 hover:text-white transition-colors">Trade</Link>
              <Link href="/waivers" className="text-zinc-400 hover:text-white transition-colors">Waivers</Link>
              <Link href="/diagnose" className="text-white">Diagnose</Link>
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
        {/* Title */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold mb-2">
            <span className="text-amber-400">TEAM</span> DIAGNOSIS
          </h1>
          <p className="text-zinc-500 text-sm">
            Analyze your roster with TWO perspectives: Win Now (this season) and Dynasty (long-term)
          </p>
        </div>

        {/* Input Mode Toggle */}
        <div className="flex mb-4 border border-zinc-700 bg-zinc-900/50">
          <button
            type="button"
            onClick={() => setInputMode('upload')}
            className={`flex-1 px-4 py-3 text-sm font-bold uppercase tracking-wider transition-colors flex items-center justify-center gap-2 ${
              inputMode === 'upload'
                ? 'bg-amber-400 text-zinc-900'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <span>📷</span> Upload Screenshot
          </button>
          <button
            type="button"
            onClick={() => setInputMode('manual')}
            className={`flex-1 px-4 py-3 text-sm font-bold uppercase tracking-wider transition-colors flex items-center justify-center gap-2 ${
              inputMode === 'manual'
                ? 'bg-amber-400 text-zinc-900'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <span>✏️</span> Manual Entry
          </button>
        </div>

        {/* Upload Mode */}
        {inputMode === 'upload' && (
          <div className="mb-8">
            {/* Drag & Drop Zone */}
            {!imagePreview && (
              <div
                className={`border-2 border-dashed p-8 text-center transition-colors ${
                  isDragging
                    ? 'border-amber-400 bg-amber-400/10'
                    : 'border-zinc-700 hover:border-zinc-500'
                }`}
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
              >
                {uploadLoading ? (
                  <div className="space-y-4">
                    <div className="inline-block w-12 h-12 border-2 border-zinc-800 border-t-amber-400 rounded-full animate-spin" />
                    <div className="text-zinc-400">Analyzing roster screenshot...</div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="text-5xl opacity-50">📷</div>
                    <div className="text-zinc-300">
                      Drag & drop your roster screenshot here
                    </div>
                    <div className="text-zinc-500 text-sm">
                      or
                    </div>
                    <label className="inline-block px-6 py-2 bg-zinc-700 text-zinc-300 hover:bg-zinc-600 cursor-pointer transition-colors">
                      Choose File
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleFileSelect}
                      />
                    </label>
                    <div className="text-zinc-600 text-xs mt-4">
                      Supports Sleeper, ESPN, Yahoo screenshots
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Image Preview & Results */}
            {imagePreview && (
              <div className="space-y-4">
                {/* Preview */}
                <div className="bg-zinc-900 border border-zinc-700 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs text-zinc-400 uppercase tracking-wider">Uploaded Screenshot</span>
                    <button
                      type="button"
                      onClick={clearUpload}
                      className="text-xs text-zinc-500 hover:text-red-400"
                    >
                      Clear & Start Over
                    </button>
                  </div>
                  <img
                    src={imagePreview}
                    alt="Roster screenshot"
                    className="max-h-48 mx-auto object-contain opacity-75"
                  />
                </div>

                {/* Parse Results */}
                {parseResult && (
                  <div className="bg-zinc-900 border border-zinc-700 p-4">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs text-zinc-400 uppercase tracking-wider">
                        Extracted Players ({parseResult.matchedPlayers.length} found)
                      </span>
                      {parseResult.notMatched.length > 0 && (
                        <span className="text-xs text-amber-400">
                          {parseResult.notMatched.length} not matched
                        </span>
                      )}
                    </div>

                    {/* Matched Players */}
                    {parseResult.matchedPlayers.length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-3">
                        {parseResult.matchedPlayers.map((player, i) => (
                          <div
                            key={i}
                            className={`inline-flex items-center gap-2 px-3 py-1.5 border text-sm ${
                              player.confidence >= 95
                                ? 'bg-emerald-950/30 border-emerald-700 text-emerald-300'
                                : player.confidence >= 80
                                ? 'bg-zinc-800 border-zinc-600 text-zinc-300'
                                : 'bg-amber-950/30 border-amber-700 text-amber-300'
                            }`}
                          >
                            <span>{player.name}</span>
                            {player.extractedAs !== player.name && (
                              <span className="text-xs text-zinc-500">
                                ({player.extractedAs})
                              </span>
                            )}
                            <button
                              type="button"
                              onClick={() => removeExtractedPlayer(player.name)}
                              className="text-zinc-500 hover:text-red-400"
                            >
                              ×
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Not Matched */}
                    {parseResult.notMatched.length > 0 && (
                      <div className="border-t border-zinc-800 pt-3 mt-3">
                        <div className="text-xs text-zinc-500 mb-2">Not matched:</div>
                        <div className="flex flex-wrap gap-2">
                          {parseResult.notMatched.map((item, i) => (
                            <span key={i} className="text-xs text-zinc-600 bg-zinc-800 px-2 py-1">
                              {item.extractedName}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Add more players manually */}
                    <div className="border-t border-zinc-800 pt-3 mt-3">
                      <div className="flex gap-2">
                        <div className="flex-1">
                          <PlayerAutocomplete
                            value={newPlayer}
                            onChange={setNewPlayer}
                            placeholder="Add missing player..."
                            onSelect={(player) => {
                              if (!players.includes(player.name)) {
                                setPlayers([...players, player.name]);
                                setNewPlayer('');
                              }
                            }}
                          />
                        </div>
                        <button
                          type="button"
                          onClick={addPlayer}
                          disabled={!newPlayer.trim()}
                          className="px-4 py-2 bg-zinc-700 text-zinc-300 hover:bg-zinc-600 disabled:opacity-30 text-sm"
                        >
                          Add
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Diagnose Button */}
            <button
              type="button"
              onClick={handleDiagnose}
              disabled={loading || players.length < 3}
              className="w-full mt-4 bg-amber-400 text-zinc-900 px-6 py-3 text-sm font-bold tracking-wider hover:bg-amber-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'DIAGNOSING...' : `DIAGNOSE MY TEAM (${players.length} players)`}
            </button>
          </div>
        )}

        {/* Manual Mode */}
        {inputMode === 'manual' && (
          <form onSubmit={handleDiagnose} className="mb-8">
            <div className="bg-zinc-900/50 border border-zinc-700 p-4 mb-4">
              <label className="block text-xs text-zinc-400 uppercase tracking-wider mb-2">
                Your Roster ({players.length} players)
              </label>

              {/* Added players */}
              {players.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-3">
                  {players.map((name, i) => (
                    <div key={i} className="inline-flex items-center gap-2 px-3 py-1.5 bg-zinc-800 border border-zinc-700 text-zinc-300">
                      <span className="text-sm">{name}</span>
                      <button
                        type="button"
                        onClick={() => removePlayer(i)}
                        className="text-zinc-500 hover:text-red-400"
                      >
                        x
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Add player input */}
              <div className="flex gap-2">
                <div className="flex-1">
                  <PlayerAutocomplete
                    value={newPlayer}
                    onChange={setNewPlayer}
                    placeholder="Search player to add..."
                    onSelect={(player) => {
                      if (!players.includes(player.name)) {
                        setPlayers([...players, player.name]);
                        setNewPlayer('');
                      }
                    }}
                  />
                </div>
                <button
                  type="button"
                  onClick={addPlayer}
                  disabled={!newPlayer.trim()}
                  className="px-4 py-2 bg-zinc-700 text-zinc-300 hover:bg-zinc-600 disabled:opacity-30 text-sm"
                >
                  Add
                </button>
              </div>

              <div className="text-xs text-zinc-600 mt-2">
                Add at least 3 players for diagnosis. Include your starters for best results.
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || players.length < 3}
              className="w-full bg-amber-400 text-zinc-900 px-6 py-3 text-sm font-bold tracking-wider hover:bg-amber-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'DIAGNOSING...' : 'DIAGNOSE MY TEAM'}
            </button>
          </form>
        )}

        {/* Error */}
        {error && (
          <div className="bg-red-950/50 border border-red-800 px-4 py-3 mb-8">
            <span className="text-red-400">{error}</span>
          </div>
        )}

        {/* Results */}
        {result && (
          <div className="space-y-6 animate-fadeIn">
            {/* Comparison Banner - Shows both ratings side by side */}
            {result.diagnosis.comparison && (
              <div className="bg-zinc-900 border border-zinc-700 p-4">
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="text-center">
                    <div className="text-xs text-zinc-500 uppercase tracking-wider mb-2">Win Now</div>
                    <div className={`inline-block px-3 py-1 text-lg font-bold uppercase border-2 ${getRatingColor(result.diagnosis.comparison.winNowRating)}`}>
                      {result.diagnosis.comparison.winNowRating}
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-xs text-zinc-500 uppercase tracking-wider mb-2">Dynasty</div>
                    <div className={`inline-block px-3 py-1 text-lg font-bold uppercase border-2 ${getRatingColor(result.diagnosis.comparison.dynastyRating)}`}>
                      {result.diagnosis.comparison.dynastyRating}
                    </div>
                  </div>
                </div>
                <div className="text-center text-sm text-zinc-400 bg-zinc-800/50 px-3 py-2">
                  {result.diagnosis.comparison.gap}
                </div>
              </div>
            )}

            {/* Mode Toggle */}
            <div className="flex border-b border-zinc-700">
              <button
                onClick={() => setViewMode('win-now')}
                className={`flex-1 px-4 py-3 text-sm font-bold uppercase tracking-wider transition-colors ${
                  viewMode === 'win-now'
                    ? 'bg-zinc-800 text-amber-400 border-b-2 border-amber-400'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                Win Now Analysis
              </button>
              <button
                onClick={() => setViewMode('dynasty')}
                className={`flex-1 px-4 py-3 text-sm font-bold uppercase tracking-wider transition-colors ${
                  viewMode === 'dynasty'
                    ? 'bg-zinc-800 text-amber-400 border-b-2 border-amber-400'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                Dynasty Outlook
              </button>
            </div>

            {/* Win Now View */}
            {viewMode === 'win-now' && result.diagnosis.winNow && (
              <div className="space-y-6">
                {/* Win Now Banner */}
                <div className={`border-4 p-6 ${
                  result.diagnosis.winNow.verdict === 'CHAMPIONSHIP READY' ? 'border-emerald-500 bg-emerald-950/30' :
                  result.diagnosis.winNow.verdict === 'PLAYOFF TEAM' ? 'border-lime-500 bg-lime-950/30' :
                  result.diagnosis.winNow.verdict === 'BUBBLE TEAM' ? 'border-amber-500 bg-amber-950/30' :
                  'border-red-500 bg-red-950/30'
                }`}>
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <div className="text-xs text-zinc-500 uppercase tracking-wider mb-2">This Season</div>
                      <div className={`inline-block px-4 py-2 text-2xl font-black ${getVerdictStyle(result.diagnosis.winNow.verdict)}`}>
                        {result.diagnosis.winNow.verdict}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-zinc-500">Projected Weekly</div>
                      <div className="text-3xl font-black text-amber-400 tabular-nums">
                        {result.diagnosis.winNow.metrics.projectedWeeklyPoints}
                        <span className="text-sm text-zinc-500 ml-1">pts</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-zinc-300 text-sm">{result.diagnosis.winNow.summary}</div>
                </div>

                {/* Win Now Metrics */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <MetricCard label="Avg Starter PPG" value={result.diagnosis.winNow.metrics.avgStarterPPG} suffix=" ppg" />
                  <MetricCard label="Last 4 Weeks" value={result.diagnosis.winNow.metrics.avgLast4PPG} suffix=" ppg" />
                  <MetricCard label="Hot Starters" value={result.diagnosis.winNow.metrics.hotPlayers} suffix=" players" />
                  <MetricCard label="Cold Starters" value={result.diagnosis.winNow.metrics.coldPlayers} suffix=" players" />
                </div>

                {/* Production Position Groups */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {(['QB', 'RB', 'WR', 'TE'] as const).map(pos => {
                    const group = result.diagnosis.winNow!.positions[pos];
                    return (
                      <div key={pos} className="bg-zinc-900 border border-zinc-800 p-4">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-lg font-bold text-white">{pos}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-zinc-500">{group.positionRank}</span>
                            <span className={`px-2 py-1 text-xs font-bold uppercase border ${getStrengthColor(group.strengthRating)}`}>
                              {group.strengthRating}
                            </span>
                          </div>
                        </div>
                        <div className="text-xs text-zinc-500 mb-2">
                          Avg: {group.avgPPG} PPG | Last 4: {group.avgLast4PPG} PPG
                        </div>
                        <div className="space-y-1">
                          {group.starters.map((p, i) => (
                            <div key={i} className="flex items-center justify-between text-sm">
                              <span className="text-zinc-300 flex items-center gap-2">
                                {p.name}
                                <span className={getTrendColor(p.trend)}>{getTrendIcon(p.trend)}</span>
                              </span>
                              <span className="text-zinc-400 tabular-nums">
                                {p.seasonPPG.toFixed(1)} <span className="text-zinc-600">ppg</span>
                              </span>
                            </div>
                          ))}
                          {group.starters.length === 0 && (
                            <div className="text-sm text-zinc-600">No production data available</div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Win Now Strengths & Issues */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-zinc-900 border border-emerald-900/50 p-4">
                    <div className="text-xs text-emerald-400 uppercase tracking-wider mb-2">Strengths</div>
                    <ul className="space-y-1">
                      {result.diagnosis.winNow.strengths.map((s, i) => (
                        <li key={i} className="text-sm text-zinc-300 flex items-start gap-2">
                          <span className="text-emerald-400">+</span> {s}
                        </li>
                      ))}
                      {result.diagnosis.winNow.strengths.length === 0 && (
                        <li className="text-sm text-zinc-500">No significant strengths</li>
                      )}
                    </ul>
                  </div>
                  <div className="bg-zinc-900 border border-red-900/50 p-4">
                    <div className="text-xs text-red-400 uppercase tracking-wider mb-2">Issues</div>
                    <ul className="space-y-1">
                      {result.diagnosis.winNow.issues.map((w, i) => (
                        <li key={i} className="text-sm text-zinc-300 flex items-start gap-2">
                          <span className="text-red-400">!</span> {w}
                        </li>
                      ))}
                      {result.diagnosis.winNow.issues.length === 0 && (
                        <li className="text-sm text-zinc-500">No significant issues</li>
                      )}
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {/* Dynasty View (Original) */}
            {viewMode === 'dynasty' && (
              <div className="space-y-6">
                {/* Classification Banner */}
                <div className={`border-4 p-6 ${
                  result.diagnosis.classification === 'CONTENDER' ? 'border-emerald-500 bg-emerald-950/30' :
                  result.diagnosis.classification === 'REBUILD' ? 'border-purple-500 bg-purple-950/30' :
                  'border-amber-500 bg-amber-950/30'
                }`}>
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <div className="text-xs text-zinc-500 uppercase tracking-wider mb-2">Dynasty Classification</div>
                      <div className={`inline-block px-4 py-2 text-2xl font-black ${getClassificationStyle(result.diagnosis.classification)}`}>
                        {result.diagnosis.classification}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-zinc-500">Confidence</div>
                      <div className="text-3xl font-black text-amber-400 tabular-nums">
                        {result.diagnosis.confidence}%
                      </div>
                    </div>
                  </div>
                  <div className="text-zinc-300 text-sm mb-4">{result.diagnosis.summary}</div>

                  {/* Outlook */}
                  <div className="bg-zinc-800/50 px-3 py-2 border-l-2 border-amber-400">
                    <span className="text-amber-400 font-bold text-sm">{result.diagnosis.outlook}</span>
                  </div>
                </div>

                {/* Key Metrics */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <MetricCard label="Total Value" value={result.diagnosis.metrics.totalRosterValue} suffix=" pts" />
                  <MetricCard label="Avg Starter" value={result.diagnosis.metrics.avgStarterScore} suffix=" pts" />
                  <MetricCard label="Elite Assets" value={result.diagnosis.metrics.eliteAssets} suffix=" players" />
                  <MetricCard label="Avg Age" value={result.diagnosis.metrics.avgStarterAge} suffix=" yrs" />
                </div>

                {/* Position Groups */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {(['QB', 'RB', 'WR', 'TE'] as const).map(pos => {
                    const group = result.diagnosis.positions[pos];
                    return (
                      <div key={pos} className="bg-zinc-900 border border-zinc-800 p-4">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-lg font-bold text-white">{pos}</span>
                          <span className={`px-2 py-1 text-xs font-bold uppercase border ${getStrengthColor(group.strengthRating)}`}>
                            {group.strengthRating}
                          </span>
                        </div>
                        <div className="text-xs text-zinc-500 mb-2">
                          Avg Score: {group.avgScore} | Avg Age: {group.avgAge}
                        </div>
                        <div className="space-y-1">
                          {group.starters.map((p, i) => (
                            <div key={i} className="flex items-center justify-between text-sm">
                              <span className="text-zinc-300">{p.name}</span>
                              <span className={`font-bold ${getScoreColor(p.dynastyValue.overallScore)}`}>
                                {p.dynastyValue.overallScore}
                              </span>
                            </div>
                          ))}
                          {group.depth.length > 0 && (
                            <div className="border-t border-zinc-800 pt-1 mt-2">
                              <div className="text-xs text-zinc-600 mb-1">Depth</div>
                              {group.depth.slice(0, 2).map((p, i) => (
                                <div key={i} className="flex items-center justify-between text-xs text-zinc-500">
                                  <span>{p.name}</span>
                                  <span>{p.dynastyValue.overallScore}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Strengths & Weaknesses */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-zinc-900 border border-emerald-900/50 p-4">
                    <div className="text-xs text-emerald-400 uppercase tracking-wider mb-2">Strengths</div>
                    <ul className="space-y-1">
                      {result.diagnosis.strengths.map((s, i) => (
                        <li key={i} className="text-sm text-zinc-300 flex items-start gap-2">
                          <span className="text-emerald-400">+</span> {s}
                        </li>
                      ))}
                      {result.diagnosis.strengths.length === 0 && (
                        <li className="text-sm text-zinc-500">No significant strengths identified</li>
                      )}
                    </ul>
                  </div>
                  <div className="bg-zinc-900 border border-red-900/50 p-4">
                    <div className="text-xs text-red-400 uppercase tracking-wider mb-2">Weaknesses</div>
                    <ul className="space-y-1">
                      {result.diagnosis.weaknesses.map((w, i) => (
                        <li key={i} className="text-sm text-zinc-300 flex items-start gap-2">
                          <span className="text-red-400">-</span> {w}
                        </li>
                      ))}
                      {result.diagnosis.weaknesses.length === 0 && (
                        <li className="text-sm text-zinc-500">No significant weaknesses identified</li>
                      )}
                    </ul>
                  </div>
                </div>

                {/* Recommendations */}
                <div className="bg-zinc-900 border border-amber-900/50 p-4">
                  <div className="text-xs text-amber-400 uppercase tracking-wider mb-3">Strategic Recommendations</div>

                  <div className="space-y-4">
                    {/* Moves */}
                    <div>
                      <div className="text-sm font-bold text-zinc-300 mb-1">Suggested Moves</div>
                      <ul className="space-y-1">
                        {result.diagnosis.recommendations.moves.map((m, i) => (
                          <li key={i} className="text-sm text-zinc-400 flex items-start gap-2">
                            <span className="text-amber-400">*</span> {m}
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Targets */}
                    <div>
                      <div className="text-sm font-bold text-zinc-300 mb-1">Acquisition Targets</div>
                      <ul className="space-y-1">
                        {result.diagnosis.recommendations.targets.map((t, i) => (
                          <li key={i} className="text-sm text-emerald-400 flex items-start gap-2">
                            <span>+</span> {t}
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Sells */}
                    {result.diagnosis.recommendations.sells.length > 0 && (
                      <div>
                        <div className="text-sm font-bold text-zinc-300 mb-1">Consider Selling</div>
                        <ul className="space-y-1">
                          {result.diagnosis.recommendations.sells.map((s, i) => (
                            <li key={i} className="text-sm text-red-400 flex items-start gap-2">
                              <span>-</span> {s}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Holds */}
                    {result.diagnosis.recommendations.holds.length > 0 && (
                      <div>
                        <div className="text-sm font-bold text-zinc-300 mb-1">Core Assets (Hold)</div>
                        <ul className="space-y-1">
                          {result.diagnosis.recommendations.holds.map((h, i) => (
                            <li key={i} className="text-sm text-zinc-400 flex items-start gap-2">
                              <span className="text-zinc-500">=</span> {h}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Not found warning */}
            {result.notFound && result.notFound.length > 0 && (
              <div className="bg-amber-950/30 border border-amber-700/50 px-4 py-3 text-sm">
                <span className="text-amber-400 font-bold">Note:</span>
                <span className="text-amber-300 ml-2">
                  Could not find: {result.notFound.join(', ')}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Empty state */}
        {!result && !loading && !error && (
          <div className="text-center py-16">
            <div className="text-zinc-700 text-6xl mb-4">
              {players.length >= 3 ? '🔬' : '📋'}
            </div>
            <div className="text-zinc-500 text-sm uppercase tracking-widest mb-2">
              {players.length >= 3 ? 'Ready to Diagnose' : 'Enter Your Roster'}
            </div>
            <div className="mt-4 text-xs text-zinc-600 max-w-md mx-auto">
              {players.length < 3
                ? 'Add at least 3 players from your dynasty roster to get your team classification and strategic recommendations.'
                : 'Click "Diagnose My Team" to analyze your roster and receive your classification.'}
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
              Analyzing {players.length} players...
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-800 mt-auto">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between text-xs text-zinc-600">
          <div>Dynasty values from player analysis</div>
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

function MetricCard({ label, value, suffix }: { label: string; value: number; suffix: string }) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 p-3 text-center">
      <div className="text-xs text-zinc-500 uppercase tracking-wider">{label}</div>
      <div className="text-2xl font-black text-amber-400 tabular-nums">
        {typeof value === 'number' && value % 1 !== 0 ? value.toFixed(1) : value}
        <span className="text-sm text-zinc-500">{suffix}</span>
      </div>
    </div>
  );
}
