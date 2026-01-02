/**
 * Opposing Defense Injuries Edge Detector
 * 
 * Analyzes injuries on the opposing defense to find exploitable matchups:
 * - Missing CB1/CB2 = boost for WRs
 * - Missing star pass rusher = boost for QB
 * - Missing run-stuffing DT = boost for RB
 * - Missing LB = boost for TE (coverage mismatches)
 * 
 * DATA SOURCE: Sleeper API (more complete than ESPN for defensive players)
 * 
 * Research basis:
 * - Elite CB injuries correlate with 15-20% boost to opposing WR1 production
 * - Missing pass rushers reduce sack rate by ~25%
 * - Interior DL injuries increase RB yards before contact
 */

import type { EdgeSignal, Player } from '../../types';
import { sleeper } from '../providers/sleeper';

// Defensive position impact weights
// Higher = more impactful when missing
const DEFENSIVE_POSITION_IMPACT: Record<string, {
  boostsQB: number;
  boostsRB: number;
  boostsWR: number;
  boostsTE: number;
}> = {
  // Cornerbacks - huge impact on WRs
  CB: { boostsQB: 0.3, boostsRB: 0.0, boostsWR: 1.0, boostsTE: 0.2 },
  
  // Safeties - moderate impact across passing game
  S: { boostsQB: 0.3, boostsRB: 0.2, boostsWR: 0.5, boostsTE: 0.6 },
  FS: { boostsQB: 0.3, boostsRB: 0.1, boostsWR: 0.6, boostsTE: 0.5 },
  SS: { boostsQB: 0.2, boostsRB: 0.3, boostsWR: 0.4, boostsTE: 0.5 },
  DB: { boostsQB: 0.3, boostsRB: 0.1, boostsWR: 0.7, boostsTE: 0.4 },
  
  // Linebackers - impact TEs and RBs most
  LB: { boostsQB: 0.2, boostsRB: 0.6, boostsWR: 0.2, boostsTE: 0.8 },
  MLB: { boostsQB: 0.2, boostsRB: 0.7, boostsWR: 0.1, boostsTE: 0.7 },
  ILB: { boostsQB: 0.2, boostsRB: 0.7, boostsWR: 0.1, boostsTE: 0.7 },
  OLB: { boostsQB: 0.5, boostsRB: 0.4, boostsWR: 0.2, boostsTE: 0.5 },
  
  // Defensive line - pass rush affects QB, interior affects RB
  DE: { boostsQB: 0.8, boostsRB: 0.3, boostsWR: 0.4, boostsTE: 0.2 },
  DT: { boostsQB: 0.4, boostsRB: 0.9, boostsWR: 0.2, boostsTE: 0.1 },
  NT: { boostsQB: 0.2, boostsRB: 1.0, boostsWR: 0.1, boostsTE: 0.1 },
  DL: { boostsQB: 0.5, boostsRB: 0.6, boostsWR: 0.3, boostsTE: 0.2 },
  EDGE: { boostsQB: 0.9, boostsRB: 0.2, boostsWR: 0.4, boostsTE: 0.2 },
};

// Injury status weights
const STATUS_WEIGHTS: Record<string, number> = {
  Out: 1.0,
  IR: 1.0,
  Doubtful: 0.8,
  Questionable: 0.3, // Lower weight - many play
  Probable: 0.05,
};

interface DefenseInjuryResult {
  signals: EdgeSignal[];
  summary: string;
  boostForQB: number;
  boostForRB: number;
  boostForWR: number;
  boostForTE: number;
  keyMissing: string[];
}

/**
 * Analyze opposing defense injuries for exploitable matchups
 */
export async function detectOpposingDefenseEdge(
  player: Player,
  opponentTeam: string,
  week: number
): Promise<DefenseInjuryResult> {
  const signals: EdgeSignal[] = [];
  
  // Fetch defensive injuries from Sleeper (more complete than ESPN)
  const injuries = await sleeper.getTeamDefensiveInjuries(opponentTeam);
  
  // Map Sleeper injury status to our weights
  const sleeperStatusMap: Record<string, string> = {
    'Out': 'Out',
    'IR': 'IR',
    'Doubtful': 'Doubtful',
    'Questionable': 'Questionable',
    'PUP': 'IR',
    'Sus': 'Out',
  };
  
  // Convert to our format and filter by status weight
  const defensiveInjuries = injuries
    .map(inj => ({
      playerName: inj.name,
      position: inj.position,
      status: sleeperStatusMap[inj.injuryStatus] || inj.injuryStatus,
    }))
    .filter(inj => {
      const statusWeight = STATUS_WEIGHTS[inj.status] || 0;
      return statusWeight >= 0.3;
    });
  
  if (defensiveInjuries.length === 0) {
    return {
      signals: [],
      summary: 'No significant ' + opponentTeam + ' D injuries',
      boostForQB: 0,
      boostForRB: 0,
      boostForWR: 0,
      boostForTE: 0,
      keyMissing: [],
    };
  }
  
  // Calculate cumulative boosts by position
  let boostForQB = 0;
  let boostForRB = 0;
  let boostForWR = 0;
  let boostForTE = 0;
  const keyMissing: string[] = [];
  
  for (const injury of defensiveInjuries) {
    const pos = injury.position.toUpperCase();
    const impact = DEFENSIVE_POSITION_IMPACT[pos];
    const statusWeight = STATUS_WEIGHTS[injury.status] || 0;
    
    if (impact) {
      boostForQB += impact.boostsQB * statusWeight;
      boostForRB += impact.boostsRB * statusWeight;
      boostForWR += impact.boostsWR * statusWeight;
      boostForTE += impact.boostsTE * statusWeight;
      
      // Track key missing players:
      // Include IR/Out/Doubtful AND Questionable players with high impact
      const maxImpact = Math.max(impact.boostsQB, impact.boostsRB, impact.boostsWR, impact.boostsTE);
      const isDefinitelyOut = injury.status === 'IR' || injury.status === 'Out' || injury.status === 'Doubtful';
      const isQuestionableStar = injury.status === 'Questionable' && maxImpact >= 0.7;
      const isImpactful = maxImpact >= 0.7; // Only high-impact positions (EDGE, CB, LB, DT)
      
      if (isDefinitelyOut && isImpactful) {
        keyMissing.push(injury.playerName + ' (' + pos + ')');
      } else if (isQuestionableStar) {
        keyMissing.push(injury.playerName + ' (' + pos + ') GTD');
      }
    }
  }
  
  // Normalize boosts to reasonable scale (0-5)
  boostForQB = Math.min(5, Math.round(boostForQB * 10) / 10);
  boostForRB = Math.min(5, Math.round(boostForRB * 10) / 10);
  boostForWR = Math.min(5, Math.round(boostForWR * 10) / 10);
  boostForTE = Math.min(5, Math.round(boostForTE * 10) / 10);
  
  // Get boost relevant to this player's position
  const playerPosition = player.position || 'WR';
  let relevantBoost = 0;
  switch (playerPosition) {
    case 'QB': relevantBoost = boostForQB; break;
    case 'RB': relevantBoost = boostForRB; break;
    case 'WR': relevantBoost = boostForWR; break;
    case 'TE': relevantBoost = boostForTE; break;
  }
  
  // Generate signal if boost is significant
  // Require either:
  // - 2+ key players actually OUT/Doubtful, OR
  // - 1 key player out with boost >= 1.5 (suggests star player)
  // This filters out noise from practice squad players and depth pieces
  const hasSignificantInjuries = keyMissing.length >= 2 || (keyMissing.length >= 1 && relevantBoost >= 1.5);
  
  if (relevantBoost >= 1.0 && hasSignificantInjuries) {
    const isSignificant = relevantBoost >= 2.0 && keyMissing.length >= 2;
    
    signals.push({
      type: 'matchup_def_injury',
      playerId: player.id,
      week,
      impact: 'positive',
      magnitude: Math.round(relevantBoost * 10) / 10,
      confidence: isSignificant ? 75 : 60,
      shortDescription: isSignificant
        ? 'KEY D INJURIES: ' + opponentTeam + ' missing ' + keyMissing.join(', ')
        : opponentTeam + ' D depleted: ' + keyMissing.join(', '),
      details: opponentTeam + ' defense has key players missing: ' + keyMissing.join(', ') + '. ' +
        'Boost by position - QB: +' + boostForQB.toFixed(1) + ', RB: +' + boostForRB.toFixed(1) + 
        ', WR: +' + boostForWR.toFixed(1) + ', TE: +' + boostForTE.toFixed(1) + '. ' +
        'This creates a favorable matchup for ' + playerPosition + 's.',
      source: 'sleeper_injuries',
      timestamp: new Date(),
    });
  }
  
  // Generate summary - show counts instead of names (names shown in Key Factors)
  let summary: string;
  if (keyMissing.length >= 1) {
    const outCount = keyMissing.filter(p => !p.includes('GTD')).length;
    const gtdCount = keyMissing.filter(p => p.includes('GTD')).length;
    const parts: string[] = [];
    if (outCount > 0) parts.push(outCount + ' out');
    if (gtdCount > 0) parts.push(gtdCount + ' GTD');
    summary = opponentTeam + ' missing ' + keyMissing.length + ' defenders (' + parts.join(', ') + ')';
  } else {
    summary = 'No significant ' + opponentTeam + ' D injuries';
  }
  
  return {
    signals,
    summary,
    boostForQB,
    boostForRB,
    boostForWR,
    boostForTE,
    keyMissing,
  };
}

/**
 * Get specific matchup boost for a position against a team
 */
export async function getPositionBoostVsTeam(
  position: string,
  opponentTeam: string
): Promise<{ boost: number; reason: string }> {
  const injuries = await sleeper.getTeamDefensiveInjuries(opponentTeam);
  
  // Map Sleeper status to our weights
  const sleeperStatusMap: Record<string, string> = {
    'Out': 'Out',
    'IR': 'IR',
    'Doubtful': 'Doubtful',
    'Questionable': 'Questionable',
    'PUP': 'IR',
    'Sus': 'Out',
  };
  
  let boost = 0;
  const reasons: string[] = [];
  
  for (const injury of injuries) {
    const pos = injury.position.toUpperCase();
    const status = sleeperStatusMap[injury.injuryStatus] || injury.injuryStatus;
    const statusWeight = STATUS_WEIGHTS[status] || 0;
    
    if (statusWeight < 0.3) continue;
    
    const impact = DEFENSIVE_POSITION_IMPACT[pos];
    if (!impact) continue;
    
    let posBoost = 0;
    switch (position) {
      case 'QB': posBoost = impact.boostsQB; break;
      case 'RB': posBoost = impact.boostsRB; break;
      case 'WR': posBoost = impact.boostsWR; break;
      case 'TE': posBoost = impact.boostsTE; break;
    }
    
    const contribution = posBoost * statusWeight;
    if (contribution >= 0.3) {
      boost += contribution;
      if (statusWeight >= 0.8) {
        reasons.push(injury.name + ' (' + pos + ') out');
      }
    }
  }
  
  return {
    boost: Math.min(5, Math.round(boost * 10) / 10),
    reason: reasons.length > 0 ? reasons.join(', ') : 'Minor injuries only',
  };
}

export default {
  detectOpposingDefenseEdge,
  getPositionBoostVsTeam,
};
