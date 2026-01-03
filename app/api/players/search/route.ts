/**
 * Player Search API
 * Returns matching players for autocomplete as user types.
 */

import { NextRequest, NextResponse } from 'next/server';
import { sleeper } from '@/lib/providers/sleeper';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get('q')?.toLowerCase() || '';
  const limit = parseInt(searchParams.get('limit') || '10');

  if (query.length < 2) {
    return NextResponse.json({ players: [] });
  }

  try {
    const allPlayers = await sleeper.getAllPlayers();

    // Filter and score matches
    const matches: Array<{
      id: string;
      name: string;
      team: string | null;
      position: string;
      injuryStatus: string | null;
      score: number;
    }> = [];

    for (const player of allPlayers.values()) {
      // Only include fantasy-relevant positions with teams
      if (!['QB', 'RB', 'WR', 'TE'].includes(player.position)) continue;

      const nameLower = player.name.toLowerCase();
      let score = 0;

      // Skip players without teams unless exact match
      const hasTeam = !!player.team;

      // Exact match gets highest score
      if (nameLower === query) {
        score = 100;
      }
      // Starts with query (first name match)
      else if (nameLower.startsWith(query)) {
        score = hasTeam ? 85 : 50; // Much lower for inactive
      }
      // Last name starts with query
      else if (nameLower.split(' ').pop()?.startsWith(query)) {
        score = hasTeam ? 80 : 45; // Priority for active last name matches
      }
      // Contains query
      else if (nameLower.includes(query)) {
        score = hasTeam ? 60 : 30;
      }
      // No match
      else {
        continue;
      }

      // Extra boost for active players
      if (hasTeam) {
        score += 15;
      }

      matches.push({
        id: player.id,
        name: player.name,
        team: player.team,
        position: player.position,
        injuryStatus: player.injuryStatus || null,
        score,
      });
    }

    // Sort by score and limit
    matches.sort((a, b) => b.score - a.score);
    const limited = matches.slice(0, limit);

    return NextResponse.json({ players: limited });
  } catch (error) {
    console.error('Player search error:', error);
    return NextResponse.json({ error: 'Search failed' }, { status: 500 });
  }
}
