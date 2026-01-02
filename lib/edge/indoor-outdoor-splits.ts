/**
 * Indoor/Outdoor Splits Edge Detector
 *
 * Some players (especially QBs/WRs) perform very differently in domes vs outdoor stadiums.
 * Flags significant indoor/outdoor performance splits.
 *
 * Research basis:
 * - Dome games average 2-3 more points total than outdoor
 * - Pass attempts ~5% higher in domes
 * - Some players show 20%+ splits between environments
 */

import type { EdgeSignal, Player } from '../../types';

// Teams with dome/retractable roof stadiums
const DOME_TEAMS: string[] = [
  'ARI', // State Farm Stadium (retractable)
  'ATL', // Mercedes-Benz Stadium (retractable)
  'DAL', // AT&T Stadium (retractable)
  'DET', // Ford Field
  'HOU', // NRG Stadium (retractable)
  'IND', // Lucas Oil Stadium (retractable)
  'LAC', // SoFi Stadium
  'LAR', // SoFi Stadium
  'LV',  // Allegiant Stadium
  'MIN', // U.S. Bank Stadium
  'NO',  // Caesars Superdome
];

interface IndoorOutdoorData {
  indoorAvg: number;
  outdoorAvg: number;
}

// Sample indoor/outdoor splits
// In production, would calculate from nflfastR by stadium type
const INDOOR_OUTDOOR_SPLITS: Record<string, IndoorOutdoorData> = {
  // Dome players who struggle outdoors
  'Kirk Cousins': { indoorAvg: 21.5, outdoorAvg: 16.8 },
  'Justin Jefferson': { indoorAvg: 22.8, outdoorAvg: 18.2 },
  'Chris Olave': { indoorAvg: 17.5, outdoorAvg: 13.8 },
  'Amon-Ra St. Brown': { indoorAvg: 21.2, outdoorAvg: 17.5 },
  'Derek Carr': { indoorAvg: 18.5, outdoorAvg: 14.2 },

  // Outdoor players who thrive in elements
  'Josh Allen': { indoorAvg: 24.2, outdoorAvg: 27.8 },
  'Derrick Henry': { indoorAvg: 16.5, outdoorAvg: 19.2 },
  'Saquon Barkley': { indoorAvg: 18.2, outdoorAvg: 21.5 },

  // QBs less affected
  'Patrick Mahomes': { indoorAvg: 23.5, outdoorAvg: 22.8 },
  'Lamar Jackson': { indoorAvg: 24.2, outdoorAvg: 23.8 },
};

interface IndoorOutdoorResult {
  signals: EdgeSignal[];
  summary: string;
  isIndoor: boolean;
  splitDifference: number;
}

/**
 * Check if game is played indoors
 */
function isGameIndoor(homeTeam: string): boolean {
  return DOME_TEAMS.includes(homeTeam);
}

/**
 * Detect indoor/outdoor split edge
 */
export function detectIndoorOutdoorEdge(
  player: Player,
  opponentTeam: string,
  isHome: boolean,
  week: number
): IndoorOutdoorResult {
  const signals: EdgeSignal[] = [];

  if (!player.team) {
    return {
      signals: [],
      summary: 'No team data',
      isIndoor: false,
      splitDifference: 0,
    };
  }

  const homeTeam = isHome ? player.team : opponentTeam;
  const isIndoor = isGameIndoor(homeTeam);

  const splitData = INDOOR_OUTDOOR_SPLITS[player.name];

  if (!splitData) {
    const venue = isIndoor ? 'Dome' : 'Outdoor';
    return {
      signals: [],
      summary: `${venue} game - no split data`,
      isIndoor,
      splitDifference: 0,
    };
  }

  const { indoorAvg, outdoorAvg } = splitData;
  const currentAvg = isIndoor ? indoorAvg : outdoorAvg;
  const otherAvg = isIndoor ? outdoorAvg : indoorAvg;
  const baseAvg = (indoorAvg + outdoorAvg) / 2;
  const splitDiff = ((currentAvg - otherAvg) / baseAvg) * 100;
  const absDiff = Math.abs(splitDiff);

  // Only flag if 15%+ difference
  if (absDiff >= 15) {
    const isPositive = currentAvg > otherAvg;
    const venue = isIndoor ? 'indoor' : 'outdoor';

    signals.push({
      type: 'indoor_outdoor_split',
      playerId: player.id,
      week,
      impact: isPositive ? 'positive' : 'negative',
      magnitude: isPositive ? Math.min(3, absDiff / 10) : -Math.min(3, absDiff / 10),
      confidence: 60,
      shortDescription: isPositive
        ? `${venue.charAt(0).toUpperCase() + venue.slice(1)} boost: ${currentAvg.toFixed(1)} vs ${otherAvg.toFixed(1)} PPG`
        : `${venue.charAt(0).toUpperCase() + venue.slice(1)} fade: ${currentAvg.toFixed(1)} vs ${otherAvg.toFixed(1)} PPG`,
      details: `${player.name} averages ${indoorAvg.toFixed(1)} PPG in domes vs ${outdoorAvg.toFixed(1)} PPG outdoors. ` +
        `Playing ${venue} this week ${isPositive ? 'favors' : 'hurts'} their projection. ` +
        `${isIndoor ? 'Dome games typically see higher passing volume.' : 'Weather elements can impact passing games.'}`,
      source: 'indoor-outdoor-splits',
      timestamp: new Date(),
    });
  }

  // Generate summary
  let summary: string;
  const venue = isIndoor ? 'Dome' : 'Outdoor';
  if (splitData && absDiff >= 15) {
    const trend = currentAvg > otherAvg ? 'boost' : 'fade';
    summary = `${venue} ${trend}: ${splitDiff > 0 ? '+' : ''}${splitDiff.toFixed(0)}%`;
  } else {
    summary = `${venue} game - neutral split`;
  }

  return {
    signals,
    summary,
    isIndoor,
    splitDifference: splitDiff,
  };
}

export default { detectIndoorOutdoorEdge };
