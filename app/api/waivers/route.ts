/**
 * Waiver Wire Scanner API
 *
 * Uses REAL data only:
 * - Sleeper trending API for roster %/availability proxy
 * - Sleeper player data for team, position, injury status
 * - Actual edge detector for edge scores
 *
 * NO hardcoded guesses or fabricated data.
 */

import { NextRequest, NextResponse } from 'next/server';
import { sleeper } from '@/lib/providers/sleeper';
import edgeDetector from '@/lib/edge-detector';

interface WaiverTarget {
  player: {
    id: string;
    name: string;
    team: string | null;
    position: string;
    injuryStatus: string | null;
  };
  edgeScore: number;
  trendingAdds: number; // Real data from Sleeper
  isHiddenGem: boolean;
  keyFactors: string[]; // Extracted from real edge signals
  matchup: string;
}

// Week 18 schedule - this is factual
const WEEK_18_SCHEDULE: Record<string, { opponent: string; isHome: boolean }> = {
  CAR: { opponent: 'TB', isHome: false }, TB: { opponent: 'CAR', isHome: true },
  SEA: { opponent: 'SF', isHome: false }, SF: { opponent: 'SEA', isHome: true },
  NO: { opponent: 'ATL', isHome: false }, ATL: { opponent: 'NO', isHome: true },
  TEN: { opponent: 'JAX', isHome: false }, JAX: { opponent: 'TEN', isHome: true },
  IND: { opponent: 'HOU', isHome: false }, HOU: { opponent: 'IND', isHome: true },
  CLE: { opponent: 'CIN', isHome: false }, CIN: { opponent: 'CLE', isHome: true },
  GB: { opponent: 'MIN', isHome: false }, MIN: { opponent: 'GB', isHome: true },
  DAL: { opponent: 'NYG', isHome: false }, NYG: { opponent: 'DAL', isHome: true },
  NYJ: { opponent: 'BUF', isHome: false }, BUF: { opponent: 'NYJ', isHome: true },
  ARI: { opponent: 'LAR', isHome: false }, LAR: { opponent: 'ARI', isHome: true },
  DET: { opponent: 'CHI', isHome: false }, CHI: { opponent: 'DET', isHome: true },
  KC: { opponent: 'LV', isHome: false }, LV: { opponent: 'KC', isHome: true },
  LAC: { opponent: 'DEN', isHome: false }, DEN: { opponent: 'LAC', isHome: true },
  MIA: { opponent: 'NE', isHome: false }, NE: { opponent: 'MIA', isHome: true },
  WAS: { opponent: 'PHI', isHome: false }, PHI: { opponent: 'WAS', isHome: true },
  BAL: { opponent: 'PIT', isHome: false }, PIT: { opponent: 'BAL', isHome: true },
};

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const position = searchParams.get('position') || 'ALL';
  const limit = parseInt(searchParams.get('limit') || '15');

  try {
    // 1. Get REAL trending adds from Sleeper (players being added = likely available)
    const trendingAdds = await sleeper.getTrendingPlayers('add', 24, 50);

    // 2. Get all players for lookup
    const allPlayers = await sleeper.getAllPlayers();

    // 3. Build list of waiver candidates from trending data
    const candidates: Array<{
      player: NonNullable<Awaited<ReturnType<typeof sleeper.getPlayer>>>;
      addCount: number;
    }> = [];

    for (const trending of trendingAdds) {
      const player = allPlayers.get(trending.playerId);

      if (!player) continue;
      if (!player.team) continue; // No free agents
      if (position !== 'ALL' && player.position !== position) continue;

      // Skip players who are Out or on IR (not startable)
      if (player.injuryStatus === 'Out' || player.injuryStatus === 'IR') continue;

      candidates.push({
        player,
        addCount: trending.count,
      });
    }

    // 4. Analyze top candidates with REAL edge detector
    // Limit to top 15 to keep response time reasonable
    const topCandidates = candidates.slice(0, Math.min(limit + 5, 20));

    const targets: WaiverTarget[] = [];

    for (const candidate of topCandidates) {
      const { player, addCount } = candidate;

      // Run REAL edge detection
      let edgeScore = 0;
      let keyFactors: string[] = [];

      try {
        const analysis = await edgeDetector.analyzePlayer(player.name, 18);

        if (analysis) {
          edgeScore = analysis.overallImpact;

          // Extract key factors from REAL signals
          const significantSignals = analysis.signals
            .filter(s => Math.abs(s.magnitude) >= 2)
            .sort((a, b) => Math.abs(b.magnitude) - Math.abs(a.magnitude))
            .slice(0, 3);

          keyFactors = significantSignals.map(s => s.shortDescription);

          // If no significant signals, use summaries that have content
          if (keyFactors.length === 0) {
            const summaries = Object.entries(analysis.summary)
              .filter(([_, v]) => v && !v.includes('No ') && !v.includes('N/A'))
              .slice(0, 3)
              .map(([_, v]) => v);
            keyFactors = summaries;
          }
        }
      } catch (err) {
        // If edge detection fails, skip this player
        console.error(`Edge detection failed for ${player.name}:`, err);
        continue;
      }

      // Get matchup info
      const schedule = WEEK_18_SCHEDULE[player.team!];
      const matchup = schedule
        ? `${schedule.isHome ? 'vs' : '@'} ${schedule.opponent}`
        : 'BYE';

      // Hidden gem = high adds (people want them) + positive edge
      // High add count means they were available and people are grabbing them
      const isHiddenGem = addCount >= 500 && edgeScore >= 2;

      targets.push({
        player: {
          id: player.id,
          name: player.name,
          team: player.team,
          position: player.position,
          injuryStatus: player.injuryStatus || null,
        },
        edgeScore: Math.round(edgeScore * 10) / 10,
        trendingAdds: addCount,
        isHiddenGem,
        keyFactors: keyFactors.length > 0 ? keyFactors : ['Trending pickup - analyze for your league'],
        matchup,
      });
    }

    // Sort by edge score (best matchups first)
    targets.sort((a, b) => b.edgeScore - a.edgeScore);

    // Apply limit
    const limitedTargets = targets.slice(0, limit);

    return NextResponse.json({
      week: 18,
      position,
      targets: limitedTargets,
      hiddenGems: limitedTargets.filter(t => t.isHiddenGem),
      totalFound: targets.length,
      dataSource: 'Sleeper trending API + real edge detection',
    });
  } catch (error) {
    console.error('Waivers error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch waiver targets' },
      { status: 500 }
    );
  }
}
