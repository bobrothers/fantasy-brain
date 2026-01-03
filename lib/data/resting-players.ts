/**
 * Confirmed Resting Players - Week 18 2025
 *
 * IMPORTANT: This list should ONLY contain players who are CONFIRMED
 * to be resting by official team announcements or credible reporters.
 *
 * DO NOT add players speculatively. Empty list is better than wrong data.
 *
 * Sources: Official team injury reports, beat reporter confirmations
 * Last updated: Check news before each week
 */

export interface RestingPlayer {
  name: string;
  team: string;
  reason: string;
  source?: string;
}

// Week 18 2025 - ONLY add players with confirmed reports
// Check official sources before adding anyone
export const RESTING_PLAYERS_WEEK_18: RestingPlayer[] = [
  // Add players here ONLY when officially confirmed
  // Example format:
  // { name: 'Player Name', team: 'TEAM', reason: 'Resting - confirmed by [source]', source: 'URL or reporter name' },
];

/**
 * Check if a player is confirmed to be resting
 */
export function isConfirmedResting(playerName: string): RestingPlayer | null {
  const nameLower = playerName.toLowerCase().trim();

  for (const player of RESTING_PLAYERS_WEEK_18) {
    if (player.name.toLowerCase() === nameLower) {
      return player;
    }
  }

  return null;
}

/**
 * Get all resting players for a team
 */
export function getRestingPlayersForTeam(team: string): RestingPlayer[] {
  return RESTING_PLAYERS_WEEK_18.filter(p => p.team === team);
}

export default {
  RESTING_PLAYERS_WEEK_18,
  isConfirmedResting,
  getRestingPlayersForTeam,
};
