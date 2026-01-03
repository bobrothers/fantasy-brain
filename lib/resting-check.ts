/**
 * Resting Player Detection via News Search
 *
 * Checks current news to see if a player is confirmed resting.
 * Used for Week 17-18 when teams rest starters for playoffs.
 */

import { isConfirmedResting, RestingPlayer } from './data/resting-players';

interface RestingCheckResult {
  isResting: boolean;
  reason?: string;
  source?: string;
  confidence: 'confirmed' | 'likely' | 'unknown';
}

// Keywords that indicate a player is resting
const RESTING_KEYWORDS = [
  'resting',
  'sitting out',
  'won\'t play',
  'will not play',
  'not playing',
  'held out',
  'being rested',
  'rest for playoffs',
  'playoff rest',
  'sitting starters',
  'inactive',
  'ruled out',
];

// Keywords that indicate player IS playing
const PLAYING_KEYWORDS = [
  'will play',
  'expected to play',
  'will start',
  'confirmed to play',
  'playing sunday',
  'playing saturday',
  'in the lineup',
  'cleared to play',
];

/**
 * Check if a player is resting by searching news
 * Returns cached/manual list first, then can do live search
 */
export async function checkIfResting(
  playerName: string,
  team: string,
  week: number
): Promise<RestingCheckResult> {
  // First check our confirmed list (manual curation from verified sources)
  const confirmed = isConfirmedResting(playerName);
  if (confirmed) {
    return {
      isResting: true,
      reason: confirmed.reason,
      source: confirmed.source,
      confidence: 'confirmed',
    };
  }

  // Only do news search for Week 15+ (when resting typically happens)
  if (week < 15) {
    return { isResting: false, confidence: 'unknown' };
  }

  // For now, return unknown - the live search will be triggered separately
  // via the "Check Resting News" button to avoid slow API calls on every analysis
  return { isResting: false, confidence: 'unknown' };
}

/**
 * Search news for resting player updates
 * This is called by the dedicated resting-check API endpoint
 */
export function parseRestingFromNewsText(
  playerName: string,
  newsText: string
): RestingCheckResult {
  const textLower = newsText.toLowerCase();
  const nameLower = playerName.toLowerCase();

  // Check if the news mentions this player
  if (!textLower.includes(nameLower) && !textLower.includes(nameLower.split(' ')[1])) {
    return { isResting: false, confidence: 'unknown' };
  }

  // Look for resting indicators
  for (const keyword of RESTING_KEYWORDS) {
    if (textLower.includes(keyword)) {
      // Make sure it's about this player (within ~100 chars of their name)
      const nameIndex = textLower.indexOf(nameLower);
      const keywordIndex = textLower.indexOf(keyword);

      if (nameIndex !== -1 && Math.abs(nameIndex - keywordIndex) < 150) {
        return {
          isResting: true,
          reason: `News indicates player ${keyword}`,
          confidence: 'likely',
        };
      }
    }
  }

  // Check for explicit "will play" indicators (overrides resting)
  for (const keyword of PLAYING_KEYWORDS) {
    if (textLower.includes(keyword)) {
      const nameIndex = textLower.indexOf(nameLower);
      const keywordIndex = textLower.indexOf(keyword);

      if (nameIndex !== -1 && Math.abs(nameIndex - keywordIndex) < 150) {
        return {
          isResting: false,
          reason: `News indicates player ${keyword}`,
          confidence: 'likely',
        };
      }
    }
  }

  return { isResting: false, confidence: 'unknown' };
}

export default { checkIfResting, parseRestingFromNewsText };
