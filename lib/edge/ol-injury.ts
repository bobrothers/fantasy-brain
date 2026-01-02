/**
 * Offensive Line Injury Edge Detector
 * 
 * Detects when OL injuries create fantasy-relevant signals:
 * - Missing LT: Impacts QB (blindside), affects passing game
 * - Missing RT: Impacts RB (running lanes), affects rush game  
 * - Missing C: Affects both pass pro and run blocking
 * - Multiple OL out: Cascading effect on entire offense
 * 
 * Research basis:
 * - QB sack rate increases ~30% when starting LT is out
 * - RB yards before contact drops ~15% with 2+ OL starters missing
 * - Pass attempts often decrease when OL is compromised (game script)
 */

import type { EdgeSignal, InjuryReport } from '@/types';
import { espn } from '../providers/espn';

// Position importance weights
const OL_POSITION_WEIGHTS: Record<string, number> = {
  LT: 1.0,   // Most important - protects QB blindside
  RT: 0.8,   // Important for run game
  C: 0.9,    // Pre-snap reads, line calls
  LG: 0.6,   // Interior protection
  RG: 0.6,   // Interior protection
  T: 0.9,    // Generic tackle
  G: 0.6,    // Generic guard
  OT: 0.9,   // Offensive tackle
  OG: 0.6,   // Offensive guard
};

// Injury status severity
const STATUS_SEVERITY: Record<string, number> = {
  Out: 1.0,
  IR: 1.0,
  Doubtful: 0.8,
  Questionable: 0.4, // Many questionable players play
  Probable: 0.1,
};

interface OLInjuryEdgeResult {
  signals: EdgeSignal[];
  summary: string;
  missingStarters: number;
  affectsPassGame: boolean;
  affectsRunGame: boolean;
}

/**
 * Analyze OL injury impact for a team
 */
export async function detectOLInjuryEdge(
  team: string,
  week: number
): Promise<OLInjuryEdgeResult> {
  const signals: EdgeSignal[] = [];
  
  // Fetch OL injuries from ESPN
  const olInjuries = await espn.getOLInjuries(team);
  
  if (olInjuries.length === 0) {
    return {
      signals: [],
      summary: 'No significant OL injuries reported',
      missingStarters: 0,
      affectsPassGame: false,
      affectsRunGame: false,
    };
  }
  
  // Filter to significant injuries (Out, Doubtful, or key Questionable)
  const significantInjuries = olInjuries.filter(inj => {
    const severity = STATUS_SEVERITY[inj.status] || 0;
    return severity >= 0.4; // Questionable or worse
  });
  
  if (significantInjuries.length === 0) {
    return {
      signals: [],
      summary: 'OL injuries minor (probable/healthy)',
      missingStarters: 0,
      affectsPassGame: false,
      affectsRunGame: false,
    };
  }
  
  // Track impact areas
  let affectsPassGame = false;
  let affectsRunGame = false;
  let totalImpact = 0;
  
  // Process each significant injury
  for (const injury of significantInjuries) {
    const position = injury.position.toUpperCase();
    const weight = OL_POSITION_WEIGHTS[position] || 0.5;
    const severity = STATUS_SEVERITY[injury.status] || 0.5;
    
    // Calculate magnitude (-5 to 0 scale, reduced from -6)
    const magnitude = Math.round(-4 * weight * severity);
    totalImpact += Math.abs(magnitude);
    
    // Determine impact type
    const isLeftSide = position.includes('L') || position === 'LT' || position === 'LG';
    const isTackle = position.includes('T');
    const isCenter = position === 'C';
    
    if (isTackle || isCenter) {
      affectsPassGame = true;
    }
    if (!isLeftSide || isCenter) {
      affectsRunGame = true;
    }
    
    // Determine signal type
    let signalType: EdgeSignal['type'] = 'ol_injury_multiple';
    if (position === 'LT' || position === 'T') {
      signalType = 'ol_injury_lt';
    } else if (position === 'RT') {
      signalType = 'ol_injury_rt';
    } else if (position === 'C') {
      signalType = 'ol_injury_c';
    }
    
    const confidence = injury.status === 'Out' || injury.status === 'IR' ? 90 : 60;
    
    signals.push({
      type: signalType,
      playerId: team, // Team-level signal
      week,
      impact: 'negative',
      magnitude,
      confidence,
      shortDescription: `${injury.playerName} (${position}) - ${injury.status}`,
      details: `${team} ${position} ${injury.playerName} is ${injury.status.toLowerCase()} with ${injury.injury}. ` +
        `${isTackle ? 'Tackle injuries affect pass protection significantly. ' : ''}` +
        `${isCenter ? 'Center injuries disrupt line communication and protection calls. ' : ''}` +
        `${isLeftSide ? 'Left side injury exposes QB blindside. ' : 'Right side injury impacts run game. '}` +
        `Practice status: ${injury.practiceStatus || 'Unknown'}.`,
      source: 'espn_injuries',
      timestamp: new Date(),
    });
  }
  
  // Add combined signal if multiple OL out
  if (significantInjuries.length >= 2) {
    const outCount = significantInjuries.filter(i => 
      i.status === 'Out' || i.status === 'IR'
    ).length;
    
    signals.push({
      type: 'ol_injury_multiple',
      playerId: team,
      week,
      impact: 'negative',
      magnitude: Math.min(-5, -2 * outCount), // Reduced from -8/-3
      confidence: 85,
      shortDescription: `${significantInjuries.length} OL starters questionable/out`,
      details: `${team} has ${significantInjuries.length} offensive linemen dealing with injuries. ` +
        `This cascading effect significantly impacts both pass protection and run blocking. ` +
        `Expect increased pressure on QB and reduced running lanes. ` +
        `Consider downgrading all offensive skill players on this team.`,
      source: 'espn_injuries',
      timestamp: new Date(),
    });
  }
  
  // Count likely missing starters
  const missingStarters = significantInjuries.filter(i => 
    STATUS_SEVERITY[i.status] >= 0.8
  ).length;
  
  // Generate summary
  let summary: string;
  if (missingStarters >= 2) {
    summary = `Major OL concerns: ${missingStarters} starters likely out`;
  } else if (significantInjuries.length >= 2) {
    summary = `OL depth tested: ${significantInjuries.length} players questionable+`;
  } else {
    const key = significantInjuries[0];
    summary = `OL watch: ${key.playerName} (${key.position}) ${key.status}`;
  }
  
  return {
    signals,
    summary,
    missingStarters,
    affectsPassGame,
    affectsRunGame,
  };
}

/**
 * Get fantasy impact recommendations based on OL injuries
 */
export function getOLInjuryFantasyImpact(result: OLInjuryEdgeResult): {
  qbImpact: 'downgrade' | 'monitor' | 'neutral';
  rbImpact: 'downgrade' | 'monitor' | 'neutral';
  wrImpact: 'downgrade' | 'monitor' | 'neutral';
  teImpact: 'downgrade' | 'monitor' | 'neutral';
  explanation: string;
} {
  if (result.missingStarters === 0 && result.signals.length === 0) {
    return {
      qbImpact: 'neutral',
      rbImpact: 'neutral',
      wrImpact: 'neutral',
      teImpact: 'neutral',
      explanation: 'No significant OL injuries affecting fantasy outlook.',
    };
  }
  
  if (result.missingStarters >= 2) {
    return {
      qbImpact: 'downgrade',
      rbImpact: 'downgrade',
      wrImpact: 'monitor',
      teImpact: 'monitor',
      explanation: `Multiple OL starters out creates major concern. QB faces more pressure (fewer deep shots). RB loses blocking (reduced efficiency). Quick-game WRs/TEs may see more targets but fewer big plays.`,
    };
  }
  
  if (result.affectsPassGame && !result.affectsRunGame) {
    return {
      qbImpact: 'downgrade',
      rbImpact: 'neutral',
      wrImpact: 'monitor',
      teImpact: 'neutral',
      explanation: `Pass protection compromised. QB may face increased pressure and take fewer shots downfield. RB workload could actually increase with quick handoffs.`,
    };
  }
  
  if (result.affectsRunGame && !result.affectsPassGame) {
    return {
      qbImpact: 'neutral',
      rbImpact: 'downgrade',
      wrImpact: 'neutral',
      teImpact: 'neutral',
      explanation: `Run blocking affected. RB efficiency expected to drop. Passing game may see increased volume to compensate.`,
    };
  }
  
  // Default case - some concern but not severe
  return {
    qbImpact: 'monitor',
    rbImpact: 'monitor',
    wrImpact: 'neutral',
    teImpact: 'neutral',
    explanation: `OL situation worth monitoring. Check game-day inactives for final assessment.`,
  };
}

/**
 * Get explanation text for an OL injury signal
 */
export function explainOLSignal(signal: EdgeSignal): string {
  return `OL Alert: ${signal.shortDescription}. ${signal.details} Impact: ${signal.magnitude} (confidence: ${signal.confidence}%)`;
}

export default {
  detectOLInjuryEdge,
  getOLInjuryFantasyImpact,
  explainOLSignal,
};
