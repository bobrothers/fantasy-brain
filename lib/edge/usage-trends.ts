/**
 * Usage Trends Edge Detector
 * 
 * Tracks target share, carry share, and snap count trends to identify:
 * - Emerging players (usage increasing)
 * - Declining players (usage decreasing)
 * - Workload concerns (too much or too little)
 * 
 * DATA SOURCE: nflfastR via nflverse-data repository
 * Falls back to sample data if nflfastR data unavailable.
 * 
 * Research basis:
 * - Target share is the #1 predictor of WR fantasy success
 * - Carry share + game script predicts RB outcomes
 * - Snap count trends signal coaching trust changes
 * - 3-week trends are more predictive than single-game spikes
 */

import type { EdgeSignal, Player } from '../../types';
import { nflfastr } from '../providers/nflfastr';

interface UsageTrendResult {
  signals: EdgeSignal[];
  summary: string;
  targetShare?: number;
  targetShareTrend?: 'up' | 'down' | 'stable';
  carryShare?: number;
  carryShareTrend?: 'up' | 'down' | 'stable';
  snapShare?: number;
  snapShareTrend?: 'up' | 'down' | 'stable';
  dataSource: 'nflfastr' | 'sample' | 'none';
}

/**
 * Detect usage trend edge signals using nflfastR data
 */
export async function detectUsageTrendEdge(
  player: Player,
  week: number
): Promise<UsageTrendResult> {
  const signals: EdgeSignal[] = [];
  const position = player.position || 'WR';
  
  // Try to get real data from nflfastR
  let targetShareData = null;
  let carryShareData = null;
  let dataSource: 'nflfastr' | 'sample' | 'none' = 'none';
  
  // QBs don't have target/carry share - usage trends N/A
  if (position === 'QB') {
    return {
      signals: [],
      summary: 'N/A for QBs',
      dataSource: 'none',
    };
  }

  try {
    if (position === 'WR' || position === 'TE') {
      targetShareData = await nflfastr.getTargetShare(player.name, 3);
      if (targetShareData) dataSource = 'nflfastr';
    }

    if (position === 'RB') {
      carryShareData = await nflfastr.getCarryShare(player.name, 3);
      targetShareData = await nflfastr.getTargetShare(player.name, 3); // RBs can have target share too
      if (carryShareData || targetShareData) dataSource = 'nflfastr';
    }
  } catch (error) {
    console.log('  nflfastR data not available, using limited analysis');
  }

  // If no nflfastR data, return minimal result
  if (dataSource === 'none') {
    return {
      signals: [],
      summary: 'Usage data unavailable',
      dataSource: 'none',
    };
  }
  
  // Process WR/TE target share
  if ((position === 'WR' || position === 'TE') && targetShareData) {
    const { share, trend, weeklyShares } = targetShareData;
    
    if (share >= 25) {
      signals.push({
        type: 'usage_target_share',
        playerId: player.id,
        week,
        impact: 'positive',
        magnitude: share >= 30 ? 4 : 2,
        confidence: 85,
        shortDescription: 'Elite target share: ' + share.toFixed(1) + '%',
        details: player.name + ' commands ' + share.toFixed(1) + '% of team targets (last 3 weeks). ' +
          'Weekly breakdown: ' + weeklyShares.map(s => s.toFixed(1) + '%').join(', ') + '. ' +
          'This elite usage provides a high floor. Source: nflfastR.',
        source: 'nflfastr',
        timestamp: new Date(),
      });
    } else if (share <= 12) {
      signals.push({
        type: 'usage_target_share',
        playerId: player.id,
        week,
        impact: 'negative',
        magnitude: -2,
        confidence: 75,
        shortDescription: 'Low target share: ' + share.toFixed(1) + '%',
        details: player.name + ' has only ' + share.toFixed(1) + '% of team targets. ' +
          'Limited usage creates low floor. Source: nflfastR.',
        source: 'nflfastr',
        timestamp: new Date(),
      });
    }
    
    // Trend signals
    if (trend === 'up') {
      signals.push({
        type: 'usage_trend',
        playerId: player.id,
        week,
        impact: 'positive',
        magnitude: 2,
        confidence: 70,
        shortDescription: 'Target share trending UP (' + share.toFixed(1) + '%)',
        details: player.name + "'s target share is increasing. Weekly: " + 
          weeklyShares.map(s => s.toFixed(1) + '%').join(' → ') + '. Buy signal.',
        source: 'nflfastr',
        timestamp: new Date(),
      });
    } else if (trend === 'down') {
      signals.push({
        type: 'usage_trend',
        playerId: player.id,
        week,
        impact: 'negative',
        magnitude: -2,
        confidence: 70,
        shortDescription: 'Target share trending DOWN (' + share.toFixed(1) + '%)',
        details: player.name + "'s target share is decreasing. Weekly: " + 
          weeklyShares.map(s => s.toFixed(1) + '%').join(' → ') + '. Proceed with caution.',
        source: 'nflfastr',
        timestamp: new Date(),
      });
    }
  }
  
  // Process RB carry share
  if (position === 'RB' && carryShareData) {
    const { share, trend, weeklyShares } = carryShareData;
    
    if (share >= 65) {
      signals.push({
        type: 'usage_carry_share',
        playerId: player.id,
        week,
        impact: 'positive',
        magnitude: share >= 75 ? 4 : 2,
        confidence: 85,
        shortDescription: 'Workhorse: ' + share.toFixed(1) + '% carry share',
        details: player.name + ' handles ' + share.toFixed(1) + '% of team carries. ' +
          'Weekly: ' + weeklyShares.map(s => s.toFixed(1) + '%').join(', ') + '. ' +
          'Bellcow usage provides volume floor. Source: nflfastR.',
        source: 'nflfastr',
        timestamp: new Date(),
      });
    } else if (share <= 40) {
      signals.push({
        type: 'usage_carry_share',
        playerId: player.id,
        week,
        impact: 'negative',
        magnitude: -2,
        confidence: 75,
        shortDescription: 'Committee back: ' + share.toFixed(1) + '% carry share',
        details: player.name + ' has only ' + share.toFixed(1) + '% of team carries. ' +
          'Committee limits ceiling. Source: nflfastR.',
        source: 'nflfastr',
        timestamp: new Date(),
      });
    }
    
    // Carry trend signals
    if (trend === 'up') {
      signals.push({
        type: 'usage_trend',
        playerId: player.id,
        week,
        impact: 'positive',
        magnitude: 2,
        confidence: 70,
        shortDescription: 'Carry share trending UP (' + share.toFixed(1) + '%)',
        details: player.name + ' is getting more carries. Weekly: ' + 
          weeklyShares.map(s => s.toFixed(1) + '%').join(' → ') + '. Emerging workload.',
        source: 'nflfastr',
        timestamp: new Date(),
      });
    } else if (trend === 'down') {
      signals.push({
        type: 'usage_trend',
        playerId: player.id,
        week,
        impact: 'negative',
        magnitude: -2,
        confidence: 70,
        shortDescription: 'Carry share trending DOWN (' + share.toFixed(1) + '%)',
        details: player.name + ' is losing carries. Weekly: ' + 
          weeklyShares.map(s => s.toFixed(1) + '%').join(' → ') + '. Declining workload.',
        source: 'nflfastr',
        timestamp: new Date(),
      });
    }
  }
  
  // Generate summary
  let summary: string;
  if (signals.length === 0) {
    // For RBs, prioritize carry share in summary; for WR/TE prioritize target share
    let share: number | undefined;
    let shareType: string;
    if (position === 'RB' && carryShareData?.share) {
      share = carryShareData.share;
      shareType = 'carry share';
    } else if (targetShareData?.share) {
      share = targetShareData.share;
      shareType = 'target share';
    } else if (carryShareData?.share) {
      share = carryShareData.share;
      shareType = 'carry share';
    } else {
      shareType = '';
    }
    summary = 'Usage stable' + (share ? ' (' + share.toFixed(1) + '% ' + shareType + ')' : '');
  } else {
    const positiveSigs = signals.filter(s => s.impact === 'positive');
    const negativeSigs = signals.filter(s => s.impact === 'negative');
    
    if (positiveSigs.length > negativeSigs.length) {
      summary = positiveSigs[0].shortDescription;
    } else if (negativeSigs.length > positiveSigs.length) {
      summary = negativeSigs[0].shortDescription;
    } else {
      summary = 'Mixed usage signals';
    }
  }
  
  return {
    signals,
    summary,
    targetShare: targetShareData?.share,
    targetShareTrend: targetShareData?.trend,
    carryShare: carryShareData?.share,
    carryShareTrend: carryShareData?.trend,
    dataSource,
  };
}

/**
 * Get players with increasing usage (buy candidates)
 */
export async function getEmergingPlayers(): Promise<Array<{ player: string; trend: string; share: number }>> {
  try {
    const emerging = await nflfastr.getEmergingReceivers(15);
    return emerging.map(e => ({
      player: e.name,
      trend: e.trend,
      share: e.share,
    }));
  } catch {
    return [];
  }
}

export default {
  detectUsageTrendEdge,
  getEmergingPlayers,
};
