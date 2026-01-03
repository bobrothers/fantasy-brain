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

// Week 18 2025 - CONFIRMED resting players from official sources
// Last updated: January 2026 from coach announcements
export const RESTING_PLAYERS_WEEK_18: RestingPlayer[] = [
  // Philadelphia Eagles - Coach Sirianni confirmed "most starters" sitting
  { name: 'Jalen Hurts', team: 'PHI', reason: 'Resting - PHI treating as bye week (Sirianni)', source: 'DraftKings Network' },
  { name: 'Saquon Barkley', team: 'PHI', reason: 'Resting - PHI treating as bye week (Sirianni)', source: 'DraftKings Network' },
  { name: 'A.J. Brown', team: 'PHI', reason: 'Resting - PHI treating as bye week (Sirianni)', source: 'DraftKings Network' },
  { name: 'DeVonta Smith', team: 'PHI', reason: 'Resting - PHI treating as bye week (Sirianni)', source: 'DraftKings Network' },
  { name: 'Dallas Goedert', team: 'PHI', reason: 'Resting - PHI treating as bye week (Sirianni)', source: 'DraftKings Network' },

  // Los Angeles Chargers - Coach Harbaugh confirmed Herbert sitting, Trey Lance starting
  { name: 'Justin Herbert', team: 'LAC', reason: 'Resting - Trey Lance starting (Harbaugh)', source: 'Rotoballer' },

  // Green Bay Packers - Coach LaFleur confirmed Love sitting despite clearing protocol
  { name: 'Jordan Love', team: 'GB', reason: 'Resting for playoffs (LaFleur)', source: 'Rotoballer' },
  { name: 'Josh Jacobs', team: 'GB', reason: 'Resting - GB locked into #7 seed', source: 'SI.com' },

  // Detroit Lions
  { name: 'Amon-Ra St. Brown', team: 'DET', reason: 'Resting for playoffs', source: 'SI.com' },

  // Seattle Seahawks
  { name: 'DK Metcalf', team: 'SEA', reason: 'Resting', source: 'SI.com' },

  // New York Jets
  { name: 'Davante Adams', team: 'NYJ', reason: 'Resting', source: 'SI.com' },
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
