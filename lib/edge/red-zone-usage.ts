/**
 * Red Zone Usage Edge Detector
 * 
 * Analyzes red zone target share and carry share to identify TD equity.
 * Red zone usage is the #1 predictor of touchdown scoring.
 * 
 * ⚠️ DATA DISCLAIMER: The usage data below is SAMPLE/APPROXIMATE data.
 * In production, this would pull from nflfastR or similar verified source.
 * Use directionally but verify specific numbers before making decisions.
 * 
 * Research basis:
 * - RZ target share correlates 0.7+ with receiving TDs
 * - RZ carry share correlates 0.8+ with rushing TDs
 * - Goal line (inside 5) usage is even more predictive
 * - Some players dominate RZ work despite lower overall usage
 */

import type { EdgeSignal, Player } from '../../types';

interface RedZoneUsage {
  playerId: string;
  playerName: string;
  team: string;
  position: string;
  // Red zone stats (last 5 games average)
  rzTargets: number;      // avg per game
  rzCarries: number;      // avg per game
  teamRzTargets: number;  // team avg per game
  teamRzCarries: number;  // team avg per game
  // Goal line (inside 5)
  glCarries: number;      // avg per game
  teamGlCarries: number;  // team avg per game
  // Calculated shares
  rzTargetShare?: number;
  rzCarryShare?: number;
  glCarryShare?: number;
  // TD production
  tdsLast5: number;
  notes?: string;
}

// Red Zone Usage Data (last 5 games) - would be from nflfastR in production
const RED_ZONE_USAGE: RedZoneUsage[] = [
  // Elite RZ backs
  {
    playerId: '6803',
    playerName: 'Saquon Barkley',
    team: 'PHI',
    position: 'RB',
    rzTargets: 1.2,
    rzCarries: 5.4,
    teamRzTargets: 6,
    teamRzCarries: 7,
    glCarries: 2.8,
    teamGlCarries: 3.2,
    tdsLast5: 6,
    notes: 'Dominates goal line. 88% GL carry share is elite.',
  },
  {
    playerId: '4881',
    playerName: 'Derrick Henry',
    team: 'BAL',
    position: 'RB',
    rzTargets: 0.4,
    rzCarries: 4.8,
    teamRzTargets: 5,
    teamRzCarries: 6.5,
    glCarries: 2.4,
    teamGlCarries: 2.8,
    tdsLast5: 5,
    notes: 'Classic goal line back. Gets the rock inside the 5.',
  },
  {
    playerId: '6794',
    playerName: 'James Cook',
    team: 'BUF',
    position: 'RB',
    rzTargets: 1.0,
    rzCarries: 2.8,
    teamRzTargets: 6,
    teamRzCarries: 4,
    glCarries: 1.2,
    teamGlCarries: 2.0,
    glCarryShare: 60,
    tdsLast5: 4,
    notes: 'Shares GL work with Allen. Pass-catching RZ role too.',
  },
  
  // Elite RZ receivers
  {
    playerId: '4866',
    playerName: "Ja'Marr Chase",
    team: 'CIN',
    position: 'WR',
    rzTargets: 3.2,
    rzCarries: 0,
    teamRzTargets: 8,
    teamRzCarries: 4,
    glCarries: 0,
    teamGlCarries: 2,
    tdsLast5: 4,
    notes: 'Burrow looks for him in RZ. Elite target share.',
  },
  {
    playerId: '5859',
    playerName: 'DeVonta Smith',
    team: 'PHI',
    position: 'WR',
    rzTargets: 1.4,
    rzCarries: 0,
    teamRzTargets: 6,
    teamRzCarries: 7,
    glCarries: 0,
    teamGlCarries: 3.2,
    tdsLast5: 2,
    notes: 'Second option behind AJ Brown in RZ.',
  },
  {
    playerId: '4034',
    playerName: 'Davante Adams',
    team: 'NYJ',
    position: 'WR',
    rzTargets: 2.8,
    rzCarries: 0,
    teamRzTargets: 7,
    teamRzCarries: 5,
    glCarries: 0,
    teamGlCarries: 2.5,
    tdsLast5: 3,
    notes: 'Primary RZ target for Rodgers. 40% RZ target share.',
  },
  
  // Tight ends
  {
    playerId: '4973',
    playerName: 'George Kittle',
    team: 'SF',
    position: 'TE',
    rzTargets: 2.0,
    rzCarries: 0,
    teamRzTargets: 7,
    teamRzCarries: 6,
    glCarries: 0,
    teamGlCarries: 3,
    tdsLast5: 3,
    notes: 'Elite RZ weapon. 29% RZ target share for a TE is massive.',
  },
  {
    playerId: '6804',
    playerName: 'Brock Bowers',
    team: 'LV',
    position: 'TE',
    rzTargets: 2.4,
    rzCarries: 0,
    teamRzTargets: 6,
    teamRzCarries: 4,
    glCarries: 0,
    teamGlCarries: 2,
    tdsLast5: 2,
    notes: 'Rookie TE leading team in RZ targets. 40% share.',
  },
];

interface RedZoneResult {
  signals: EdgeSignal[];
  summary: string;
  hasEliteUsage: boolean;
  rzTargetShare?: number;
  rzCarryShare?: number;
  glCarryShare?: number;
}

/**
 * Detect red zone usage edge for a player
 */
export function detectRedZoneEdge(
  player: Player,
  week: number
): RedZoneResult {
  const signals: EdgeSignal[] = [];
  
  // Find RZ usage data for player
  const usage = RED_ZONE_USAGE.find(u => 
    u.playerName.toLowerCase() === player.name.toLowerCase() ||
    u.playerId === player.id
  );
  
  if (!usage) {
    return {
      signals: [],
      summary: 'No red zone usage data available',
      hasEliteUsage: false,
    };
  }
  
  // Calculate shares
  const rzTargetShare = usage.teamRzTargets > 0 
    ? Math.round((usage.rzTargets / usage.teamRzTargets) * 100) 
    : 0;
  const rzCarryShare = usage.teamRzCarries > 0 
    ? Math.round((usage.rzCarries / usage.teamRzCarries) * 100) 
    : 0;
  const glCarryShare = usage.teamGlCarries > 0 
    ? Math.round((usage.glCarries / usage.teamGlCarries) * 100) 
    : 0;
  
  const position = player.position || usage.position;
  let hasEliteUsage = false;
  
  // RB red zone analysis
  if (position === 'RB') {
    if (rzCarryShare >= 70 || glCarryShare >= 75) {
      hasEliteUsage = true;
      const magnitude = glCarryShare >= 80 ? 4 : 3;
      
      signals.push({
        type: 'usage_redzone',
        playerId: player.id,
        week,
        impact: 'positive',
        magnitude,
        confidence: 80,
        shortDescription: 'GOAL LINE BACK: ' + glCarryShare + '% GL carry share',
        details: player.name + ' dominates goal line work with ' + glCarryShare + '% of carries inside the 5. ' +
          'Red zone carry share: ' + rzCarryShare + '%. ' +
          'TDs last 5 games: ' + usage.tdsLast5 + '. ' +
          (usage.notes || '') + ' ' +
          'Elite TD equity provides scoring floor.',
        source: 'redzone-usage',
        timestamp: new Date(),
      });
    } else if (rzCarryShare >= 50) {
      signals.push({
        type: 'usage_redzone',
        playerId: player.id,
        week,
        impact: 'positive',
        magnitude: 2,
        confidence: 70,
        shortDescription: 'Solid RZ role: ' + rzCarryShare + '% RZ carries',
        details: player.name + ' has ' + rzCarryShare + '% of team RZ carries. ' +
          'Goal line share: ' + glCarryShare + '%. ' +
          'TDs last 5: ' + usage.tdsLast5 + '. ' +
          'Good TD equity but not dominant.',
        source: 'redzone-usage',
        timestamp: new Date(),
      });
    } else if (rzCarryShare <= 30 && usage.rzCarries < 2) {
      signals.push({
        type: 'usage_redzone',
        playerId: player.id,
        week,
        impact: 'negative',
        magnitude: -2,
        confidence: 70,
        shortDescription: 'Limited RZ role: ' + rzCarryShare + '% RZ carries',
        details: player.name + ' only has ' + rzCarryShare + '% of team RZ carries. ' +
          'May cede goal line work to another back. ' +
          'TD equity is limited - ceiling capped.',
        source: 'redzone-usage',
        timestamp: new Date(),
      });
    }
  }
  
  // WR/TE red zone analysis
  if (position === 'WR' || position === 'TE') {
    if (rzTargetShare >= 30) {
      hasEliteUsage = true;
      const magnitude = rzTargetShare >= 40 ? 3 : 2;
      
      signals.push({
        type: 'usage_redzone',
        playerId: player.id,
        week,
        impact: 'positive',
        magnitude,
        confidence: 75,
        shortDescription: 'RZ TARGET HOG: ' + rzTargetShare + '% RZ targets',
        details: player.name + ' commands ' + rzTargetShare + '% of team RZ targets. ' +
          'Averaging ' + usage.rzTargets.toFixed(1) + ' RZ targets/game. ' +
          'TDs last 5: ' + usage.tdsLast5 + '. ' +
          (usage.notes || '') + ' ' +
          'Elite RZ target share = TD upside.',
        source: 'redzone-usage',
        timestamp: new Date(),
      });
    } else if (rzTargetShare >= 20) {
      signals.push({
        type: 'usage_redzone',
        playerId: player.id,
        week,
        impact: 'positive',
        magnitude: 1,
        confidence: 65,
        shortDescription: 'Solid RZ target share: ' + rzTargetShare + '%',
        details: player.name + ' sees ' + rzTargetShare + '% of team RZ targets. ' +
          'TDs last 5: ' + usage.tdsLast5 + '. ' +
          'Decent TD equity.',
        source: 'redzone-usage',
        timestamp: new Date(),
      });
    } else if (rzTargetShare <= 10 && usage.rzTargets < 1) {
      signals.push({
        type: 'usage_redzone',
        playerId: player.id,
        week,
        impact: 'negative',
        magnitude: -1,
        confidence: 60,
        shortDescription: 'Low RZ involvement: ' + rzTargetShare + '%',
        details: player.name + ' only ' + rzTargetShare + '% of RZ targets. ' +
          'TD upside limited without red zone usage.',
        source: 'redzone-usage',
        timestamp: new Date(),
      });
    }
  }
  
  // Generate summary
  let summary: string;
  if (hasEliteUsage) {
    if (position === 'RB') {
      summary = 'Elite GL back: ' + glCarryShare + '% goal line share';
    } else {
      summary = 'RZ target hog: ' + rzTargetShare + '% RZ targets';
    }
  } else if (signals.length > 0) {
    summary = signals[0].shortDescription;
  } else {
    summary = 'Average RZ usage (' + (position === 'RB' ? rzCarryShare : rzTargetShare) + '%)';
  }
  
  return {
    signals,
    summary,
    hasEliteUsage,
    rzTargetShare,
    rzCarryShare,
    glCarryShare,
  };
}

/**
 * Get elite goal line backs
 */
export function getGoalLineBacks(): RedZoneUsage[] {
  return RED_ZONE_USAGE
    .filter(u => u.position === 'RB' && u.glCarries >= 2)
    .sort((a, b) => {
      const aShare = a.glCarries / a.teamGlCarries;
      const bShare = b.glCarries / b.teamGlCarries;
      return bShare - aShare;
    });
}

/**
 * Get elite RZ target hogs
 */
export function getRedZoneTargetLeaders(): RedZoneUsage[] {
  return RED_ZONE_USAGE
    .filter(u => (u.position === 'WR' || u.position === 'TE') && u.rzTargets >= 2)
    .sort((a, b) => {
      const aShare = a.rzTargets / a.teamRzTargets;
      const bShare = b.rzTargets / b.teamRzTargets;
      return bShare - aShare;
    });
}

export default {
  detectRedZoneEdge,
  getGoalLineBacks,
  getRedZoneTargetLeaders,
  RED_ZONE_USAGE,
};
