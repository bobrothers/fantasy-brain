import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

import sleeper from '@/lib/providers/sleeper';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const player = searchParams.get('player');

  if (!player) {
    return NextResponse.json(
      { error: 'Player name required' },
      { status: 400 }
    );
  }

  try {
    const data = await sleeper.getDeepStats(player);

    if (!data) {
      return NextResponse.json({
        player,
        available: false,
        message: 'Deep stats not available for this player',
      });
    }

    return NextResponse.json({
      player,
      available: true,
      ...data,
    });
  } catch (error) {
    console.error('Error fetching deep stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch deep stats' },
      { status: 500 }
    );
  }
}
