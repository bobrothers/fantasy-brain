import { NextRequest, NextResponse } from 'next/server';
import { nflfastr } from '@/lib/providers/nflfastr';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const player = searchParams.get('player');
  const weeks = parseInt(searchParams.get('weeks') || '6');

  if (!player) {
    return NextResponse.json(
      { error: 'Player name required' },
      { status: 400 }
    );
  }

  try {
    const trendData = await nflfastr.getUsageTrend(player, weeks);

    if (!trendData) {
      return NextResponse.json({
        player,
        available: false,
        message: 'Usage data not available for this player',
      });
    }

    return NextResponse.json({
      player,
      available: true,
      ...trendData,
    });
  } catch (error) {
    console.error('Error fetching usage trend:', error);
    return NextResponse.json(
      { error: 'Failed to fetch usage trend data' },
      { status: 500 }
    );
  }
}
