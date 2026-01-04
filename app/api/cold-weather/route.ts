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
    const data = await sleeper.getColdWeatherPerformance(player);

    if (!data || data.coldGameCount === 0) {
      return NextResponse.json({
        player,
        available: false,
        message: 'No cold weather games this season',
      });
    }

    return NextResponse.json({
      player,
      available: true,
      ...data,
    });
  } catch (error) {
    console.error('Error fetching cold weather performance:', error);
    return NextResponse.json(
      { error: 'Failed to fetch cold weather data' },
      { status: 500 }
    );
  }
}
