/**
 * Division Rivalry Edge Detector
 *
 * Flags division matchups where intensity is higher and game scripts
 * can be unpredictable. Division games tend to be closer regardless of talent.
 *
 * Research basis:
 * - Division games are 3-4 points closer on average
 * - Underdogs cover more often in division games
 * - Game scripts less predictable = volatile fantasy outcomes
 */

import type { EdgeSignal, Player } from '../../types';

// NFL Division mappings
const NFL_DIVISIONS: Record<string, string[]> = {
  // AFC East
  AFC_EAST: ['BUF', 'MIA', 'NE', 'NYJ'],
  // AFC North
  AFC_NORTH: ['BAL', 'CIN', 'CLE', 'PIT'],
  // AFC South
  AFC_SOUTH: ['HOU', 'IND', 'JAX', 'TEN'],
  // AFC West
  AFC_WEST: ['DEN', 'KC', 'LV', 'LAC'],
  // NFC East
  NFC_EAST: ['DAL', 'NYG', 'PHI', 'WAS'],
  // NFC North
  NFC_NORTH: ['CHI', 'DET', 'GB', 'MIN'],
  // NFC South
  NFC_SOUTH: ['ATL', 'CAR', 'NO', 'TB'],
  // NFC West
  NFC_WEST: ['ARI', 'LAR', 'SF', 'SEA'],
};

// Intense rivalries (extra volatility)
const INTENSE_RIVALRIES: Array<[string, string]> = [
  ['BAL', 'PIT'],
  ['GB', 'CHI'],
  ['DAL', 'PHI'],
  ['DAL', 'NYG'],
  ['KC', 'LV'],
  ['SF', 'SEA'],
  ['NO', 'ATL'],
  ['DEN', 'LV'],
  ['NE', 'NYJ'],
  ['MIN', 'GB'],
];

interface DivisionRivalryResult {
  signals: EdgeSignal[];
  summary: string;
  isDivisionGame: boolean;
  isIntenseRivalry: boolean;
}

/**
 * Check if two teams are in the same division
 */
function areInSameDivision(team1: string, team2: string): boolean {
  for (const teams of Object.values(NFL_DIVISIONS)) {
    if (teams.includes(team1) && teams.includes(team2)) {
      return true;
    }
  }
  return false;
}

/**
 * Check if matchup is an intense rivalry
 */
function isIntenseRivalry(team1: string, team2: string): boolean {
  return INTENSE_RIVALRIES.some(
    ([a, b]) => (a === team1 && b === team2) || (a === team2 && b === team1)
  );
}

/**
 * Detect division rivalry edge
 */
export function detectDivisionRivalryEdge(
  player: Player,
  opponentTeam: string,
  week: number
): DivisionRivalryResult {
  const signals: EdgeSignal[] = [];

  if (!player.team) {
    return {
      signals: [],
      summary: 'No team data',
      isDivisionGame: false,
      isIntenseRivalry: false,
    };
  }

  const isDivisionGame = areInSameDivision(player.team, opponentTeam);
  const isRivalry = isIntenseRivalry(player.team, opponentTeam);

  if (!isDivisionGame) {
    return {
      signals: [],
      summary: 'Non-division game',
      isDivisionGame: false,
      isIntenseRivalry: false,
    };
  }

  // Division games = more variance, generally neutral impact
  // Intense rivalries = extra motivation but also extra game planning
  const magnitude = isRivalry ? 1 : 0;
  const confidence = isRivalry ? 60 : 50;

  signals.push({
    type: 'division_rivalry',
    playerId: player.id,
    week,
    impact: 'neutral',
    magnitude,
    confidence,
    shortDescription: isRivalry
      ? `Intense rivalry: ${player.team} vs ${opponentTeam}`
      : `Division game: ${player.team} vs ${opponentTeam}`,
    details: `Division games are historically 3-4 points closer than the spread suggests. ` +
      `${isRivalry ? 'This is an intense rivalry with extra motivation on both sides. ' : ''}` +
      `Expect a competitive game with less predictable game script. ` +
      `This can create variance in fantasy outcomes - both ceiling and floor games are possible.`,
    source: 'division-rivalry',
    timestamp: new Date(),
  });

  // Generate summary
  let summary: string;
  if (isRivalry) {
    summary = `Rivalry game vs ${opponentTeam} - high variance`;
  } else {
    summary = `Division game vs ${opponentTeam}`;
  }

  return {
    signals,
    summary,
    isDivisionGame,
    isIntenseRivalry: isRivalry,
  };
}

export default { detectDivisionRivalryEdge };
