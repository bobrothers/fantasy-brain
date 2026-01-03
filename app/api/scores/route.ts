import { NextResponse } from 'next/server';

interface GameScore {
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  status: 'scheduled' | 'in_progress' | 'final';
  statusDetail: string; // "Q1 5:23", "Final", "Sun 4:25 PM"
  slot?: string; // "SNF", "MNF", "TNF", etc.
}

function getTimeSlot(date: Date): string | undefined {
  const dayOfWeek = date.getUTCDay();
  const hour = date.getUTCHours();

  // Thursday Night Football (Thu 8:15 PM ET = Fri ~01:15 UTC)
  if (dayOfWeek === 5 && hour < 6) return 'TNF';

  // Sunday Night Football (Sun 8:20 PM ET = Mon ~01:20 UTC)
  if (dayOfWeek === 1 && hour < 6) return 'SNF';

  // Monday Night Football (Mon 8:15 PM ET = Tue ~01:15 UTC)
  if (dayOfWeek === 2 && hour < 6) return 'MNF';

  // Saturday games
  if (dayOfWeek === 6 || (dayOfWeek === 0 && hour < 6 && hour > 2)) return 'SAT';

  return undefined;
}

function formatGameTime(dateStr: string): string {
  const date = new Date(dateStr);
  const options: Intl.DateTimeFormatOptions = {
    weekday: 'short',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'America/New_York',
  };
  return date.toLocaleString('en-US', options).replace(',', '');
}

export async function GET() {
  try {
    const response = await fetch(
      'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard',
      { next: { revalidate: 60 } } // Cache for 60 seconds
    );

    if (!response.ok) {
      return NextResponse.json({ games: [] });
    }

    const data = await response.json();

    const games: GameScore[] = (data.events || []).map((event: {
      date: string;
      status: { type: { description: string; state: string; detail: string } };
      competitions: Array<{
        competitors: Array<{
          homeAway: string;
          team: { abbreviation: string };
          score: string;
        }>;
      }>;
    }) => {
      const comp = event.competitions[0];
      const home = comp.competitors.find(c => c.homeAway === 'home');
      const away = comp.competitors.find(c => c.homeAway === 'away');

      const statusType = event.status.type.state;
      let status: 'scheduled' | 'in_progress' | 'final' = 'scheduled';
      if (statusType === 'in') status = 'in_progress';
      else if (statusType === 'post') status = 'final';

      const gameDate = new Date(event.date);
      const slot = getTimeSlot(gameDate);

      // Status detail: either game time or quarter/time
      let statusDetail = event.status.type.detail;
      if (status === 'scheduled') {
        statusDetail = slot || formatGameTime(event.date);
      }

      return {
        homeTeam: home?.team.abbreviation || 'UNK',
        awayTeam: away?.team.abbreviation || 'UNK',
        homeScore: parseInt(home?.score || '0'),
        awayScore: parseInt(away?.score || '0'),
        status,
        statusDetail,
        slot,
      };
    });

    return NextResponse.json({ games });
  } catch (error) {
    console.error('Error fetching scores:', error);
    return NextResponse.json({ games: [] });
  }
}
