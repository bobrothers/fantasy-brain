/**
 * Travel/Rest Edge Detector
 * 
 * Detects situational disadvantages from:
 * - Timezone travel (East to West is harder than West to East)
 * - Short weeks (Thursday games after Sunday)
 * - London/International games
 * - Denver altitude (5,280 ft affects visiting teams)
 * - Bye week rust (first game back)
 * 
 * Research basis:
 * - West Coast teams traveling East perform ~1 point better vs spread
 * - Thursday games after Sunday: ~2.5 point decrease in scoring
 * - Denver altitude: visiting teams show ~3% decrease in offensive efficiency
 */

import type { EdgeSignal } from '@/types';
import { NFL_STADIUMS } from '../providers/weather';

// Timezone mapping for travel calculations
const TIMEZONE_OFFSETS: Record<string, number> = {
  'America/New_York': -5,
  'America/Indiana/Indianapolis': -5,
  'America/Detroit': -5,
  'America/Chicago': -6,
  'America/Denver': -7,
  'America/Phoenix': -7,
  'America/Los_Angeles': -8,
};

// Short week detection (days between games)
const SHORT_WEEK_THRESHOLD = 5;

// Altitude threshold
const HIGH_ALTITUDE_THRESHOLD = 5000;

interface TravelEdgeResult {
  signals: EdgeSignal[];
  summary: string;
}

interface GameContext {
  team: string;
  opponentTeam: string;
  isHome: boolean;
  gameTime: string;
  previousGameTime?: string;
  isAfterBye?: boolean;
  isLondonGame?: boolean;
}

function getTimezoneDifference(fromTeam: string, toTeam: string): number {
  const fromStadium = NFL_STADIUMS[fromTeam];
  const toStadium = NFL_STADIUMS[toTeam];
  
  if (!fromStadium || !toStadium) return 0;
  
  const fromOffset = TIMEZONE_OFFSETS[fromStadium.timezone] || -5;
  const toOffset = TIMEZONE_OFFSETS[toStadium.timezone] || -5;
  
  return toOffset - fromOffset;
}

function getDaysBetweenGames(previousGame: string, currentGame: string): number {
  const prev = new Date(previousGame);
  const curr = new Date(currentGame);
  const diffTime = Math.abs(curr.getTime() - prev.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

function isHighAltitude(team: string): boolean {
  const stadium = NFL_STADIUMS[team];
  return (stadium?.elevation || 0) >= HIGH_ALTITUDE_THRESHOLD;
}

export function detectTravelEdge(
  context: GameContext,
  week: number
): TravelEdgeResult {
  const signals: EdgeSignal[] = [];
  const { team, opponentTeam, isHome, gameTime, previousGameTime, isAfterBye, isLondonGame } = context;
  
  // 1. Timezone travel (only for away games)
  if (!isHome && !isLondonGame) {
    const tzDiff = getTimezoneDifference(team, opponentTeam);
    
    // East to West travel (negative diff means going west)
    if (tzDiff <= -2) {
      const magnitude = tzDiff <= -3 ? -4 : -2;
      
      signals.push({
        type: 'travel_timezone',
        playerId: team,
        week,
        impact: 'negative',
        magnitude,
        confidence: 75,
        shortDescription: `East-to-West travel: ${Math.abs(tzDiff)} timezone shift`,
        details: `${team} traveling from Eastern/Central to ${opponentTeam}'s stadium. ` +
          `Body clocks are 2-3 hours ahead, affecting afternoon games especially. ` +
          `Historical data shows ~2-3% decrease in offensive efficiency.`,
        source: 'schedule_analysis',
        timestamp: new Date(),
      });
    }
  }
  
  // 2. Short week detection
  if (previousGameTime) {
    const daysBetween = getDaysBetweenGames(previousGameTime, gameTime);
    
    if (daysBetween <= SHORT_WEEK_THRESHOLD) {
      const isThursday = new Date(gameTime).getDay() === 4;
      const magnitude = isThursday ? -5 : -3;
      
      signals.push({
        type: 'travel_short_week',
        playerId: team,
        week,
        impact: 'negative',
        magnitude,
        confidence: 80,
        shortDescription: `Short week: ${daysBetween} days rest`,
        details: `Only ${daysBetween} days since last game. ` +
          `${isThursday ? 'Thursday Night Football after Sunday = minimal recovery. ' : ''}` +
          `Injury risk elevated, game planning reduced. ` +
          `Scoring typically decreases 5-8% on short rest.`,
        source: 'schedule_analysis',
        timestamp: new Date(),
      });
    }
  }
  
  // 3. London/International game
  if (isLondonGame) {
    signals.push({
      type: 'travel_london',
      playerId: team,
      week,
      impact: 'negative',
      magnitude: -3,
      confidence: 70,
      shortDescription: 'International game: London',
      details: `Playing in London requires 5+ hour timezone adjustment. ` +
        `Teams typically arrive early but jet lag persists. ` +
        `Early kickoff (9:30am ET) affects player routines. ` +
        `Home teams playing in London are essentially neutral.`,
      source: 'schedule_analysis',
      timestamp: new Date(),
    });
  }
  
  // 4. Denver altitude (for visiting teams)
  if (!isHome && isHighAltitude(opponentTeam)) {
    signals.push({
      type: 'travel_altitude',
      playerId: team,
      week,
      impact: 'negative',
      magnitude: -3,
      confidence: 75,
      shortDescription: 'Altitude: Playing at Mile High (5,280 ft)',
      details: `Denver's elevation affects oxygen availability. ` +
        `Visiting teams show reduced stamina in 4th quarter. ` +
        `Kickers actually benefit from thin air (longer FGs). ` +
        `Teams that dont train at altitude see ~3% efficiency drop.`,
      source: 'stadium_data',
      timestamp: new Date(),
    });
  }
  
  // 5. Bye week rust (first game back)
  if (isAfterBye) {
    // Bye week is actually mixed - can be positive or negative
    signals.push({
      type: 'travel_short_week', // Using same type, different context
      playerId: team,
      week,
      impact: 'neutral',
      magnitude: 0,
      confidence: 60,
      shortDescription: 'First game after bye week',
      details: `Coming off bye week with extra rest and prep time. ` +
        `Historically mixed results - some teams sharp, some rusty. ` +
        `Monitor practice reports for how team used the time. ` +
        `Injured players may return, changing projected usage.`,
      source: 'schedule_analysis',
      timestamp: new Date(),
    });
  }
  
  // Generate summary
  const negativeSignals = signals.filter(s => s.impact === 'negative');
  let summary: string;
  
  if (negativeSignals.length === 0) {
    summary = 'No significant travel/rest concerns';
  } else {
    const concerns = negativeSignals.map(s => 
      s.type.replace('travel_', '').replace('_', ' ')
    ).join(', ');
    const totalMagnitude = negativeSignals.reduce((sum, s) => sum + Math.abs(s.magnitude), 0);
    summary = `Situational concerns: ${concerns} (combined impact: -${totalMagnitude})`;
  }
  
  return { signals, summary };
}

/**
 * Detect if a Thursday game is a "trap" game
 * (team played Monday night the week before)
 */
export function isThursdayTrap(
  previousGameTime: string,
  currentGameTime: string
): boolean {
  const prev = new Date(previousGameTime);
  const curr = new Date(currentGameTime);
  
  // Check if current game is Thursday (day 4)
  if (curr.getDay() !== 4) return false;
  
  // Check if previous game was Monday (day 1)
  if (prev.getDay() !== 1) return false;
  
  // Only 3 days between Monday and Thursday
  const daysBetween = getDaysBetweenGames(previousGameTime, currentGameTime);
  return daysBetween <= 4;
}

/**
 * Get explanation text for a travel signal
 */
export function explainTravelSignal(signal: EdgeSignal): string {
  const impactWord = signal.impact === 'negative' ? 'disadvantage' : 
                     signal.impact === 'positive' ? 'advantage' : 'factor';
  
  return `${signal.shortDescription} creates a ${impactWord}. ${signal.details}`;
}

export default {
  detectTravelEdge,
  isThursdayTrap,
  explainTravelSignal,
};
