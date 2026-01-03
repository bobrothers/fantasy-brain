/**
 * Revenge Games Edge Detector
 *
 * Identifies players facing their former teams.
 * Revenge games show statistically significant performance bumps.
 *
 * Research basis:
 * - Players average 12-15% higher fantasy scoring vs former teams
 * - Effect is strongest in first meeting after departure
 * - Emotional factor + familiarity with opponent's schemes
 * - Works both ways: former team may also game plan against them
 */

import type { EdgeSignal, Player } from '../../types';
import { getSchedule } from '../schedule';

interface RevengeGame {
  playerId: string;
  playerName: string;
  currentTeam: string;
  formerTeam: string;
  position: string;
  yearsDeparted: number; // How many years since they left
  circumstances: 'traded' | 'released' | 'free_agent' | 'retired_unretired';
  bitterDeparture: boolean; // Was it acrimonious?
  notes?: string;
}

// Week 18 2025 Revenge Games
const REVENGE_GAMES: RevengeGame[] = [
  // High-profile revenge games
  {
    playerId: '4034',
    playerName: 'Davante Adams',
    currentTeam: 'NYJ',
    formerTeam: 'LV',
    position: 'WR',
    yearsDeparted: 1,
    circumstances: 'traded',
    bitterDeparture: true,
    notes: 'Forced his way out of Vegas. First game back.',
  },
  {
    playerId: '6803',
    playerName: 'Saquon Barkley',
    currentTeam: 'PHI',
    formerTeam: 'NYG',
    position: 'RB',
    yearsDeparted: 1,
    circumstances: 'free_agent',
    bitterDeparture: true,
    notes: 'Giants let him walk. Joined rival Eagles. Already torched them once.',
  },
  {
    playerId: '4881',
    playerName: 'Derrick Henry',
    currentTeam: 'BAL',
    formerTeam: 'TEN',
    position: 'RB',
    yearsDeparted: 1,
    circumstances: 'free_agent',
    bitterDeparture: false,
    notes: 'Titans moved on. Not playing TEN this week.',
  },
  {
    playerId: '3321',
    playerName: 'Aaron Rodgers',
    currentTeam: 'NYJ',
    formerTeam: 'GB',
    position: 'QB',
    yearsDeparted: 2,
    circumstances: 'traded',
    bitterDeparture: true,
    notes: 'Messy divorce from Green Bay. Not playing GB this week.',
  },
  {
    playerId: '6786',
    playerName: 'Baker Mayfield',
    currentTeam: 'TB',
    formerTeam: 'CLE',
    position: 'QB',
    yearsDeparted: 3,
    circumstances: 'released',
    bitterDeparture: true,
    notes: 'Browns gave up on him. Has dominated them since.',
  },
  {
    playerId: '4035',
    playerName: 'Stefon Diggs',
    currentTeam: 'HOU',
    formerTeam: 'BUF',
    position: 'WR',
    yearsDeparted: 1,
    circumstances: 'traded',
    bitterDeparture: true,
    notes: 'Traded after drama. Not playing BUF this week.',
  },
  {
    playerId: '7547',
    playerName: 'Kenny Pickett',
    currentTeam: 'PHI',
    formerTeam: 'PIT',
    position: 'QB',
    yearsDeparted: 1,
    circumstances: 'traded',
    bitterDeparture: false,
    notes: 'Traded to Eagles. Backup role.',
  },
  // Add more as needed
];

interface RevengeGameResult {
  signals: EdgeSignal[];
  summary: string;
  isRevengeGame: boolean;
  revengeDetails?: RevengeGame;
}

/**
 * Detect revenge game edge for a player
 * Now uses dynamic schedule from ESPN API
 */
export async function detectRevengeGameEdge(
  player: Player,
  week: number
): Promise<RevengeGameResult> {
  const signals: EdgeSignal[] = [];

  // Find if player has a revenge game scenario
  const revenge = REVENGE_GAMES.find(
    r =>
      r.playerName.toLowerCase() === player.name.toLowerCase() ||
      r.playerId === player.id
  );

  if (!revenge) {
    return {
      signals: [],
      summary: 'No revenge game narrative',
      isRevengeGame: false,
    };
  }

  // Get dynamic schedule for this week
  const schedule = await getSchedule(week);
  const currentTeam = player.team || revenge.currentTeam;
  const gameInfo = schedule.get(currentTeam);
  const opponent = gameInfo?.opponent;

  if (!opponent || opponent !== revenge.formerTeam) {
    return {
      signals: [],
      summary: 'Revenge game vs ' + revenge.formerTeam + ' (not this week)',
      isRevengeGame: false,
    };
  }

  // This is an active revenge game!
  let magnitude = 2;
  let confidence = 70;

  // Boost for bitter departures
  if (revenge.bitterDeparture) {
    magnitude += 1;
    confidence += 5;
  }

  // Boost for first-year revenge (freshest wounds)
  if (revenge.yearsDeparted === 1) {
    magnitude += 1;
    confidence += 5;
  }

  // Cap magnitude
  magnitude = Math.min(4, magnitude);

  signals.push({
    type: 'matchup_defense', // Reusing - affects matchup motivation
    playerId: player.id,
    week,
    impact: 'positive',
    magnitude,
    confidence,
    shortDescription: 'REVENGE GAME vs ' + revenge.formerTeam,
    details:
      player.name +
      ' faces former team ' +
      revenge.formerTeam +
      '. ' +
      'Left via ' +
      revenge.circumstances.replace('_', ' ') +
      ' ' +
      revenge.yearsDeparted +
      ' year(s) ago. ' +
      (revenge.bitterDeparture
        ? 'Departure was acrimonious - extra motivation. '
        : '') +
      (revenge.notes || '') +
      ' ' +
      'Revenge games historically produce 12-15% fantasy scoring bumps.',
    source: 'revenge-games',
    timestamp: new Date(),
  });

  return {
    signals,
    summary:
      'REVENGE GAME vs ' +
      revenge.formerTeam +
      (revenge.bitterDeparture ? ' (bitter)' : ''),
    isRevengeGame: true,
    revengeDetails: revenge,
  };
}

/**
 * Get all active revenge games for a given week
 * Now uses dynamic schedule from ESPN API
 */
export async function getActiveRevengeGames(week?: number): Promise<RevengeGame[]> {
  const schedule = await getSchedule(week);
  return REVENGE_GAMES.filter(r => {
    const gameInfo = schedule.get(r.currentTeam);
    return gameInfo?.opponent === r.formerTeam;
  });
}

/**
 * Get bitter revenge games (highest motivation)
 */
export async function getBitterRevengeGames(week?: number): Promise<RevengeGame[]> {
  const active = await getActiveRevengeGames(week);
  return active.filter(r => r.bitterDeparture);
}

export default {
  detectRevengeGameEdge,
  getActiveRevengeGames,
  getBitterRevengeGames,
  REVENGE_GAMES,
};
