/**
 * Rest Advantage Edge Detector
 *
 * Detects rest advantages from bye weeks.
 * Team coming off bye vs opponent who played = edge.
 *
 * Research basis:
 * - Teams off bye week win ~54% of games
 * - Extra rest = fresher legs, more prep time
 * - Especially impacts older players and teams with injuries
 */

import type { EdgeSignal, Player } from '../../types';

// Week 17 bye teams (for Week 18 rest advantage)
// In 2025, no byes in Week 17/18 but keeping structure for flexibility
const WEEK_17_BYE_TEAMS: string[] = [];

// Teams that played Thursday Night in Week 17 (short rest)
const WEEK_17_TNF_TEAMS: string[] = [];

// Teams that played Monday Night in Week 17 (less rest)
const WEEK_17_MNF_TEAMS: string[] = [];

interface RestAdvantageResult {
  signals: EdgeSignal[];
  summary: string;
  restDays: number;
  opponentRestDays: number;
  hasAdvantage: boolean;
}

/**
 * Calculate approximate rest days based on previous week schedule
 */
function getRestDays(team: string): number {
  if (WEEK_17_BYE_TEAMS.includes(team)) {
    return 14; // Two weeks rest
  }
  if (WEEK_17_MNF_TEAMS.includes(team)) {
    return 6; // Monday to Sunday
  }
  if (WEEK_17_TNF_TEAMS.includes(team)) {
    return 10; // Thursday to Sunday
  }
  return 7; // Standard Sunday to Sunday
}

/**
 * Detect rest advantage edge
 */
export function detectRestAdvantageEdge(
  player: Player,
  opponentTeam: string,
  week: number
): RestAdvantageResult {
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

  const teamRest = getRestDays(player.team);
  const oppRest = getRestDays(opponentTeam);
  const restDiff = teamRest - oppRest;

  // No advantage in Week 18 typically (no byes)
  if (restDiff === 0) {
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
      ? `Rest edge: +${restDiff} days vs ${opponentTeam}`
      : `Short rest: ${restDiff} days vs ${opponentTeam}`;
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
