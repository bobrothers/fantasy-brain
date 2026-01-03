/**
 * Rest Advantage Edge Detector
 *
 * Detects rest advantages from bye weeks and game timing.
 * Team coming off bye vs opponent who played = edge.
 * TNF teams get extra rest, MNF teams get less.
 *
 * Research basis:
 * - Teams off bye week win ~54% of games
 * - Extra rest = fresher legs, more prep time
 * - Especially impacts older players and teams with injuries
 *
 * Now uses dynamic schedule from ESPN API to calculate rest days.
 */

import type { EdgeSignal, Player } from '../../types';
import { getSchedule, getByeTeams } from '../schedule';

interface RestAdvantageResult {
  signals: EdgeSignal[];
  summary: string;
  restDays: number;
  opponentRestDays: number;
  hasAdvantage: boolean;
}

/**
 * Calculate rest days based on previous week's game date
 * Uses dynamic schedule from ESPN API
 */
async function getRestDays(
  team: string,
  currentWeek: number,
  currentGameDate: Date
): Promise<number> {
  // Check if team was on bye last week
  const byeTeams = await getByeTeams(currentWeek - 1);
  if (byeTeams.includes(team)) {
    return 14; // Two weeks rest
  }

  // Get previous week's schedule to find game date
  const prevSchedule = await getSchedule(currentWeek - 1);
  const prevGame = prevSchedule.get(team);

  if (!prevGame || !prevGame.date) {
    return 7; // Default to standard rest if no data
  }

  // Calculate days between previous game and current game
  const prevGameDate = new Date(prevGame.date);
  const diffMs = currentGameDate.getTime() - prevGameDate.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  return Math.max(3, Math.min(14, diffDays)); // Clamp to reasonable range
}

/**
 * Detect rest advantage edge
 * Now uses dynamic schedule from ESPN API
 */
export async function detectRestAdvantageEdge(
  player: Player,
  opponentTeam: string,
  week: number
): Promise<RestAdvantageResult> {
  const signals: EdgeSignal[] = [];

  if (!player.team) {
    return {
      signals: [],
      summary: 'No team data',
      restDays: 7,
      opponentRestDays: 7,
      hasAdvantage: false,
    };
  }

  // Get current week's game date for this team
  const schedule = await getSchedule(week);
  const gameInfo = schedule.get(player.team);
  const currentGameDate = gameInfo?.date ? new Date(gameInfo.date) : new Date();

  // Calculate rest days for both teams
  const teamRest = await getRestDays(player.team, week, currentGameDate);
  const oppRest = await getRestDays(opponentTeam, week, currentGameDate);
  const restDiff = teamRest - oppRest;

  // No significant advantage
  if (Math.abs(restDiff) < 1) {
    return {
      signals: [],
      summary: 'Equal rest',
      restDays: teamRest,
      opponentRestDays: oppRest,
      hasAdvantage: false,
    };
  }

  const hasAdvantage = restDiff > 0;
  const magnitude = Math.min(3, Math.abs(restDiff) / 3);

  // Significant rest differential (bye week or TNF vs MNF)
  if (Math.abs(restDiff) >= 3) {
    signals.push({
      type: 'rest_advantage',
      playerId: player.id,
      week,
      impact: hasAdvantage ? 'positive' : 'negative',
      magnitude: hasAdvantage ? magnitude : -magnitude,
      confidence: 65,
      shortDescription: hasAdvantage
        ? `Rest edge: ${teamRest} days vs opponent's ${oppRest}`
        : `Rest disadvantage: ${teamRest} days vs opponent's ${oppRest}`,
      details: hasAdvantage
        ? `${player.team} has ${restDiff} extra days of rest compared to ${opponentTeam}. ` +
          `This typically translates to fresher legs and better game planning. ` +
          `Teams with rest advantages win 54% of games historically.`
        : `${player.team} has ${Math.abs(restDiff)} fewer days of rest compared to ${opponentTeam}. ` +
          `Short rest can impact performance, especially for older players.`,
      source: 'rest-advantage',
      timestamp: new Date(),
    });
  }

  // Generate summary
  let summary: string;
  if (Math.abs(restDiff) >= 3) {
    summary = hasAdvantage
      ? `Rest edge: ${teamRest} days vs ${opponentTeam}'s ${oppRest}`
      : `Rest disadvantage: ${teamRest} days vs ${opponentTeam}'s ${oppRest}`;
  } else {
    summary = 'Equal rest';
  }

  return {
    signals,
    summary,
    restDays: teamRest,
    opponentRestDays: oppRest,
    hasAdvantage,
  };
}

export default { detectRestAdvantageEdge };
