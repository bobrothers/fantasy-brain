import { NextRequest, NextResponse } from 'next/server';
import sleeper from '@/lib/providers/sleeper';

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
    // Use Sleeper API for live 2025 season data
    const trendData = await sleeper.getUsageTrend(player, weeks);

    if (!trendData) {
      return NextResponse.json({
        player,
        available: false,
        message: 'Usage data not available for this player',
      });
    }

    // Get team rank
    const teamRankData = await sleeper.getTeamRank(player, trendData.position);

    return NextResponse.json({
      player,
      available: true,
      ...trendData,
      teamRank: teamRankData?.rank,
      teamTotal: teamRankData?.total,
    });
  } catch (error) {
    console.error('Error fetching usage trend:', error);
    return NextResponse.json(
      { error: 'Failed to fetch usage trend data' },
      { status: 500 }
    );
  }
}
