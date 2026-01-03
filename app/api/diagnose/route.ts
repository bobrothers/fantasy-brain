import { NextRequest, NextResponse } from 'next/server';
import { sleeper } from '@/lib/providers/sleeper';
import { analyzeRoster, TeamDiagnosis } from '@/lib/team-diagnosis';
import type { Player } from '@/types';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { players: playerNames } = body as { players: string[] };

    if (!playerNames || !Array.isArray(playerNames) || playerNames.length === 0) {
      return NextResponse.json(
        { error: 'Please provide an array of player names' },
        { status: 400 }
      );
    }

    // Get all players from Sleeper
    const allPlayers = await sleeper.getAllPlayers();

    // Find each player
    const foundPlayers: Player[] = [];
    const notFound: string[] = [];

    for (const name of playerNames) {
      let player = allPlayers.get(name);

      // Try fuzzy match if exact match fails
      if (!player) {
        const searchName = name.toLowerCase();
        player = Array.from(allPlayers.values()).find(p =>
          p.name.toLowerCase().includes(searchName) ||
          searchName.includes(p.name.toLowerCase())
        );
      }

      if (player) {
        foundPlayers.push(player);
      } else {
        notFound.push(name);
      }
    }

    if (foundPlayers.length === 0) {
      return NextResponse.json(
        { error: 'No players found. Please check player names.' },
        { status: 404 }
      );
    }

    // Run diagnosis
    const diagnosis = await analyzeRoster(foundPlayers);

    return NextResponse.json({
      diagnosis,
      foundPlayers: foundPlayers.length,
      notFound: notFound.length > 0 ? notFound : undefined,
    });
  } catch (error) {
    console.error('Team diagnosis error:', error);
    return NextResponse.json(
      { error: 'Team diagnosis failed' },
      { status: 500 }
    );
  }
}
