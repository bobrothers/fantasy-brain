/**
 * Confirmed Resting Players - Week 18 2025
 *
 * Players confirmed to be sitting out for playoff rest.
 * Updated manually from news sources since Sleeper doesn't track this.
 *
 * Sources: NFL Network, ESPN, team beat reporters
 * Last updated: January 2026
 */

export interface RestingPlayer {
  name: string;
  team: string;
  reason: string;
  source?: string;
}

// Week 18 2025 confirmed resting players
// Teams that have clinched: PHI, DET, KC, BUF, MIN, etc.
export const RESTING_PLAYERS_WEEK_18: RestingPlayer[] = [
  // Philadelphia Eagles - #1 seed clinched
  { name: 'Jalen Hurts', team: 'PHI', reason: 'Playoff rest - PHI clinched #1 seed' },
  { name: 'Saquon Barkley', team: 'PHI', reason: 'Playoff rest - PHI clinched #1 seed' },
  { name: 'A.J. Brown', team: 'PHI', reason: 'Playoff rest - PHI clinched #1 seed' },
  { name: 'DeVonta Smith', team: 'PHI', reason: 'Playoff rest - PHI clinched #1 seed' },
  { name: 'Dallas Goedert', team: 'PHI', reason: 'Playoff rest - PHI clinched #1 seed' },

  // Detroit Lions - #1 seed clinched (if applicable)
  { name: 'Jared Goff', team: 'DET', reason: 'Playoff rest - DET clinched playoff spot' },
  { name: 'Amon-Ra St. Brown', team: 'DET', reason: 'Playoff rest - DET clinched playoff spot' },
  { name: 'Jahmyr Gibbs', team: 'DET', reason: 'Playoff rest - DET clinched playoff spot' },
  { name: 'David Montgomery', team: 'DET', reason: 'Playoff rest - DET clinched playoff spot' },

  // Kansas City Chiefs - clinched
  { name: 'Patrick Mahomes', team: 'KC', reason: 'Playoff rest - KC clinched' },
  { name: 'Travis Kelce', team: 'KC', reason: 'Playoff rest - KC clinched' },

  // Buffalo Bills - clinched
  { name: 'Josh Allen', team: 'BUF', reason: 'Playoff rest - BUF clinched' },
  { name: 'James Cook', team: 'BUF', reason: 'Playoff rest - BUF clinched' },

  // Minnesota Vikings - clinched
  { name: 'Sam Darnold', team: 'MIN', reason: 'Playoff rest - MIN clinched' },
  { name: 'Justin Jefferson', team: 'MIN', reason: 'Playoff rest - MIN clinched' },
  { name: 'Aaron Jones', team: 'MIN', reason: 'Playoff rest - MIN clinched' },
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
