/**
 * Betting Signals Edge Detector
 * 
 * Uses betting market data to identify fantasy-relevant signals:
 * - Implied team totals: Higher = more scoring expected
 * - Large spreads: Blowout risk affects late-game usage
 * - Game totals: High totals = shootout, good for all offenses
 * - Line movement: Sharp money can indicate information
 * 
 * Research basis:
 * - Implied totals correlate strongly with fantasy scoring
 * - Teams favored by 14+ often rest starters in 4th quarter
 * - High game totals (49+) increase QB/WR upside significantly
 */

import type { EdgeSignal, GameOdds } from '@/types';
import { odds } from '../providers/odds';

// Thresholds for edge detection
const THRESHOLDS = {
  HIGH_TOTAL: 48,           // Shootout territory
  LOW_TOTAL: 38,            // Defensive game
  BLOWOUT_SPREAD: 10,       // 10+ point favorite
  LARGE_BLOWOUT_SPREAD: 14, // 2 TD favorite
  HIGH_IMPLIED: 26,         // Strong offensive game expected (was 27)
  LOW_IMPLIED: 19,          // Offensive struggle expected (was 18)
};

interface BettingEdgeResult {
  signals: EdgeSignal[];
  summary: string;
  impliedTotal: number | null;
  isShootout: boolean;
  isBlowoutRisk: boolean;
}

/**
 * Detect betting-based edge signals for a team
 */
export async function detectBettingEdge(
  team: string,
  week: number
): Promise<BettingEdgeResult> {
  const signals: EdgeSignal[] = [];
  
  // Check if odds API is configured
  if (!odds.isConfigured()) {
    return {
      signals: [],
      summary: 'Odds data unavailable (API key not configured)',
      impliedTotal: null,
      isShootout: false,
      isBlowoutRisk: false,
    };
  }
  
  // Get all NFL odds
  const allOdds = await odds.getNFLOdds();
  
  // Find game where team is playing
  const gameOdds = allOdds.find(g => g.homeTeam === team || g.awayTeam === team);
  
  if (!gameOdds) {
    return {
      signals: [],
      summary: 'No odds data found for this matchup',
      impliedTotal: null,
      isShootout: false,
      isBlowoutRisk: false,
    };
  }
  
  const isHome = gameOdds.homeTeam === team;
  const impliedTotal = isHome ? gameOdds.impliedHomeTotal : gameOdds.impliedAwayTotal;
  const opponentImplied = isHome ? gameOdds.impliedAwayTotal : gameOdds.impliedHomeTotal;
  
  let isShootout = false;
  let isBlowoutRisk = false;
  
  // 1. High implied team total (positive signal)
  if (impliedTotal >= THRESHOLDS.HIGH_IMPLIED) {
    signals.push({
      type: 'betting_implied_total',
      playerId: team,
      week,
      impact: 'positive',
      magnitude: Math.min(5, Math.round((impliedTotal - 24) / 2)),
      confidence: 80,
      shortDescription: `High implied total: ${impliedTotal} points`,
      details: `Vegas expects ${team} to score ${impliedTotal} points. ` +
        `This is above average (24 pts) and suggests a favorable offensive environment. ` +
        `All offensive players get a slight boost in expected scoring. ` +
        `Game total: ${gameOdds.total}, Spread: ${gameOdds.spread > 0 ? '+' : ''}${gameOdds.spread}.`,
      source: 'the-odds-api',
      timestamp: new Date(),
    });
  }
  
  // 2. Low implied team total (negative signal)
  if (impliedTotal <= THRESHOLDS.LOW_IMPLIED) {
    signals.push({
      type: 'betting_implied_total',
      playerId: team,
      week,
      impact: 'negative',
      magnitude: Math.max(-5, Math.round((impliedTotal - 22) / 2)),
      confidence: 75,
      shortDescription: `Low implied total: ${impliedTotal} points`,
      details: `Vegas expects ${team} to score only ${impliedTotal} points. ` +
        `This is below average and suggests a tough offensive matchup. ` +
        `Consider alternatives if you have them. ` +
        `Game total: ${gameOdds.total}, Spread: ${gameOdds.spread > 0 ? '+' : ''}${gameOdds.spread}.`,
      source: 'the-odds-api',
      timestamp: new Date(),
    });
  }
  
  // 3. High game total (shootout potential)
  if (gameOdds.total >= THRESHOLDS.HIGH_TOTAL) {
    isShootout = true;
    
    signals.push({
      type: 'betting_implied_total',
      playerId: team,
      week,
      impact: 'positive',
      magnitude: 3,
      confidence: 75,
      shortDescription: `Shootout alert: O/U ${gameOdds.total}`,
      details: `Game total of ${gameOdds.total} suggests a high-scoring affair. ` +
        `Both offenses expected to produce. ` +
        `QBs and WRs have elevated ceilings. ` +
        `Consider stacking (QB + pass catcher from same team).`,
      source: 'the-odds-api',
      timestamp: new Date(),
    });
  }
  
  // 4. Low game total (defensive battle)
  if (gameOdds.total <= THRESHOLDS.LOW_TOTAL) {
    signals.push({
      type: 'betting_implied_total',
      playerId: team,
      week,
      impact: 'negative',
      magnitude: -2,
      confidence: 70,
      shortDescription: `Low total: O/U ${gameOdds.total}`,
      details: `Game total of ${gameOdds.total} suggests a defensive struggle. ` +
        `Scoring opportunities will be limited for both teams. ` +
        `Floor-based players may be safer than ceiling plays. ` +
        `Consider pivoting to players in higher-total games.`,
      source: 'the-odds-api',
      timestamp: new Date(),
    });
  }
  
  // 5. Blowout risk (team is big underdog)
  const teamSpread = isHome ? gameOdds.spread : -gameOdds.spread;
  
  if (teamSpread >= THRESHOLDS.LARGE_BLOWOUT_SPREAD) {
    // Team is big underdog - might abandon run, throw more
    signals.push({
      type: 'betting_line_move',
      playerId: team,
      week,
      impact: 'neutral', // Mixed - more passing but negative game script
      magnitude: 0,
      confidence: 70,
      shortDescription: `Big underdog: +${teamSpread} spread`,
      details: `${team} is a ${teamSpread}-point underdog. ` +
        `Negative game script likely means more passing attempts. ` +
        `RBs may lose work if team falls behind early. ` +
        `WRs/TEs could see increased volume but in garbage time. ` +
        `QB ceiling elevated but floor is lower.`,
      source: 'the-odds-api',
      timestamp: new Date(),
    });
  }
  
  if (teamSpread <= -THRESHOLDS.LARGE_BLOWOUT_SPREAD) {
    // Team is big favorite - might rest starters late
    isBlowoutRisk = true;
    
    signals.push({
      type: 'betting_line_move',
      playerId: team,
      week,
      impact: 'negative',
      magnitude: -2,
      confidence: 65,
      shortDescription: `Blowout risk: ${teamSpread} spread`,
      details: `${team} is a ${Math.abs(teamSpread)}-point favorite. ` +
        `If game goes as expected, starters may rest in 4th quarter. ` +
        `RBs often lose goal-line work to backups in blowouts. ` +
        `Consider this a ceiling limiter for skill position players.`,
      source: 'the-odds-api',
      timestamp: new Date(),
    });
  }
  
  // Generate summary
  let summary: string;
  const positiveSignals = signals.filter(s => s.impact === 'positive');
  const negativeSignals = signals.filter(s => s.impact === 'negative');
  
  if (positiveSignals.length > negativeSignals.length) {
    summary = `Favorable betting environment: implied ${impliedTotal} pts`;
  } else if (negativeSignals.length > positiveSignals.length) {
    summary = `Challenging betting environment: implied ${impliedTotal} pts`;
  } else if (signals.length === 0) {
    summary = `Neutral betting environment: implied ${impliedTotal} pts`;
  } else {
    summary = `Mixed betting signals: implied ${impliedTotal} pts`;
  }
  
  return {
    signals,
    summary,
    impliedTotal,
    isShootout,
    isBlowoutRisk,
  };
}

/**
 * Get fantasy impact based on implied total
 */
export function getImpliedTotalImpact(impliedTotal: number): {
  adjustment: number;
  tier: 'elite' | 'good' | 'neutral' | 'bad' | 'avoid';
  explanation: string;
} {
  if (impliedTotal >= 30) {
    return {
      adjustment: 5,
      tier: 'elite',
      explanation: 'Elite offensive environment. All skill players get a boost.',
    };
  } else if (impliedTotal >= 27) {
    return {
      adjustment: 3,
      tier: 'good',
      explanation: 'Above average scoring expected. Good environment.',
    };
  } else if (impliedTotal >= 22) {
    return {
      adjustment: 0,
      tier: 'neutral',
      explanation: 'Average scoring environment. No adjustment needed.',
    };
  } else if (impliedTotal >= 18) {
    return {
      adjustment: -3,
      tier: 'bad',
      explanation: 'Below average scoring expected. Consider alternatives.',
    };
  } else {
    return {
      adjustment: -5,
      tier: 'avoid',
      explanation: 'Poor offensive environment. Avoid if possible.',
    };
  }
}

/**
 * Get all high-scoring game environments for the week
 */
export async function getShootoutGames(): Promise<Array<{
  homeTeam: string;
  awayTeam: string;
  total: number;
  homeImplied: number;
  awayImplied: number;
}>> {
  if (!odds.isConfigured()) return [];
  
  const allOdds = await odds.getNFLOdds();
  
  return allOdds
    .filter(g => g.total >= THRESHOLDS.HIGH_TOTAL)
    .map(g => ({
      homeTeam: g.homeTeam,
      awayTeam: g.awayTeam,
      total: g.total,
      homeImplied: g.impliedHomeTotal,
      awayImplied: g.impliedAwayTotal,
    }))
    .sort((a, b) => b.total - a.total);
}

/**
 * Get explanation text for a betting signal
 */
export function explainBettingSignal(signal: EdgeSignal): string {
  return `Betting insight: ${signal.shortDescription}. ${signal.details}`;
}

export default {
  detectBettingEdge,
  getImpliedTotalImpact,
  getShootoutGames,
  explainBettingSignal,
};
