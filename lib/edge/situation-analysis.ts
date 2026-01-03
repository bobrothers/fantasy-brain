// Comprehensive situation analysis edge detector
// Covers: QB stability, target/touch competition, coaching changes, contract year, draft capital

import { Player, EdgeSignal } from '@/types';
import {
  QB_SITUATIONS,
  BACKFIELD_COMPETITION,
  TARGET_COMPETITION,
  COACHING_CHANGES,
  DRAFT_CAPITAL,
  getDraftCapitalDescription
} from '@/lib/data/situations';
import { CONTRACT_DATA, getContractSummary } from '@/lib/data/contracts';

export interface SituationAnalysis {
  qbStability: {
    rating: 'elite' | 'locked' | 'competition' | 'uncertain' | 'disaster';
    description: string;
    impact: number; // -10 to +10
  } | null;
  competition: {
    role: string;
    competitors: string[];
    description: string;
    impact: number;
  } | null;
  coaching: {
    type: string;
    description: string;
    schemeChange: boolean;
    impact: number;
  } | null;
  contractYear: {
    isContractYear: boolean;
    description: string;
    impact: number;
  } | null;
  draftCapital: {
    round: number;
    description: string;
    impact: number;
  } | null;
  contract: {
    summary: string;
    status: string;
    risk: 'low' | 'medium' | 'high';
    impact: number;
  } | null;
}

export function analyzeSituation(player: Player): SituationAnalysis {
  const team = player.team;
  const position = player.position;
  const result: SituationAnalysis = {
    qbStability: null,
    competition: null,
    coaching: null,
    contractYear: null,
    draftCapital: null,
    contract: null,
  };

  if (!team) return result;

  // 1. QB STABILITY (affects WR, TE, sometimes RB)
  if (position === 'WR' || position === 'TE' || position === 'RB') {
    const qb = QB_SITUATIONS[team];
    if (qb) {
      let impact = 0;
      switch (qb.stability) {
        case 'elite': impact = 8; break;
        case 'locked': impact = 4; break;
        case 'competition': impact = -2; break;
        case 'uncertain': impact = -4; break;
        case 'disaster': impact = -8; break;
      }
      // RBs affected less by QB
      if (position === 'RB') impact = Math.round(impact * 0.5);

      result.qbStability = {
        rating: qb.stability,
        description: `${qb.starter}: ${qb.description}`,
        impact,
      };
    }
  }

  // 2. COMPETITION (backfield or target)
  if (position === 'RB') {
    const comp = BACKFIELD_COMPETITION[player.name];
    if (comp) {
      let impact = 0;
      switch (comp.role) {
        case 'bellcow': impact = 8; break;
        case 'lead': impact = 4; break;
        case 'committee': impact = -2; break;
        case 'backup': impact = -6; break;
        case 'crowded': impact = -4; break;
      }
      result.competition = {
        role: comp.role,
        competitors: comp.competitors,
        description: comp.description,
        impact,
      };
    }
  } else if (position === 'WR' || position === 'TE') {
    const comp = TARGET_COMPETITION[player.name];
    if (comp) {
      let impact = 0;
      switch (comp.role) {
        case 'bellcow': impact = 8; break;
        case 'lead': impact = 4; break;
        case 'committee': impact = -2; break;
        case 'backup': impact = -6; break;
        case 'crowded': impact = -4; break;
      }
      result.competition = {
        role: comp.role,
        competitors: comp.competitors,
        description: comp.description,
        impact,
      };
    }
  }

  // 3. COACHING CHANGES
  const coaching = COACHING_CHANGES[team];
  if (coaching) {
    let impact = 0;
    if (coaching.impact === 'positive') impact = 3;
    else if (coaching.impact === 'negative') impact = -3;
    else if (coaching.impact === 'unknown' && coaching.schemeChange) impact = -2;

    result.coaching = {
      type: coaching.type,
      description: coaching.description,
      schemeChange: coaching.schemeChange,
      impact,
    };
  }

  // 4. DRAFT CAPITAL
  const capital = DRAFT_CAPITAL[player.name];
  if (capital) {
    let impact = 0;
    if (capital.round === 1 && capital.pick <= 10) impact = 5;
    else if (capital.round === 1) impact = 3;
    else if (capital.round === 2) impact = 1;
    else if (capital.round >= 5) impact = -2;

    result.draftCapital = {
      round: capital.round,
      description: getDraftCapitalDescription(capital),
      impact,
    };
  }

  // 5. CONTRACT INFO
  const contract = CONTRACT_DATA[player.name];
  if (contract) {
    let impact = 0;
    let risk: 'low' | 'medium' | 'high' = 'low';

    // Contract year motivation
    if (contract.contractYear) {
      result.contractYear = {
        isContractYear: true,
        description: 'Contract year - playing for new deal',
        impact: 4, // Motivation boost
      };
    }

    // Overall contract status
    switch (contract.status) {
      case 'elite':
        impact = 5;
        risk = 'low';
        break;
      case 'secure':
        impact = 3;
        risk = 'low';
        break;
      case 'tradeable':
        impact = 0;
        risk = 'medium';
        break;
      case 'cuttable':
        impact = -4;
        risk = 'high';
        break;
      case 'expiring':
        impact = -2;
        risk = 'high';
        break;
    }

    // Rookie deal bonus (surplus value)
    if (contract.isRookieDeal && position !== 'QB') {
      impact += 2;
    }

    // Recently extended (sometimes "got the bag" risk)
    if (contract.recentlyExtended && !contract.isRookieDeal) {
      impact -= 1;
      if (risk === 'low') risk = 'medium';
    }

    result.contract = {
      summary: getContractSummary(contract),
      status: contract.status,
      risk,
      impact,
    };
  }

  return result;
}

export function getSituationEdges(player: Player): EdgeSignal[] {
  const edges: EdgeSignal[] = [];
  const analysis = analyzeSituation(player);
  const team = player.team || 'FA';

  // QB Stability Edge
  if (analysis.qbStability) {
    const qb = analysis.qbStability;
    edges.push({
      type: 'scheme_new_coordinator', // Using existing type
      playerId: player.id,
      week: 18,
      impact: qb.impact >= 0 ? 'positive' : 'negative',
      magnitude: qb.impact,
      confidence: 85,
      shortDescription: `QB: ${qb.rating.toUpperCase()}`,
      details: qb.description,
      source: 'Situation Analysis',
      timestamp: new Date(),
    });
  }

  // Competition Edge
  if (analysis.competition) {
    const comp = analysis.competition;
    const compStr = comp.competitors.length > 0 ? ` (vs ${comp.competitors.slice(0, 2).join(', ')})` : '';
    edges.push({
      type: 'usage_target_share',
      playerId: player.id,
      week: 18,
      impact: comp.impact >= 0 ? 'positive' : 'negative',
      magnitude: comp.impact,
      confidence: 80,
      shortDescription: `Role: ${comp.role.toUpperCase()}${compStr}`,
      details: comp.description,
      source: 'Situation Analysis',
      timestamp: new Date(),
    });
  }

  // Coaching Edge (only if notable)
  if (analysis.coaching && (analysis.coaching.schemeChange || analysis.coaching.type !== 'stable')) {
    const coach = analysis.coaching;
    edges.push({
      type: 'scheme_new_coordinator',
      playerId: player.id,
      week: 18,
      impact: coach.impact >= 0 ? 'positive' : coach.impact < 0 ? 'negative' : 'neutral',
      magnitude: coach.impact,
      confidence: 70,
      shortDescription: `${coach.type}: ${coach.description.split(',')[0]}`,
      details: coach.description,
      source: 'Coaching Changes',
      timestamp: new Date(),
    });
  }

  // Contract Year Edge
  if (analysis.contractYear?.isContractYear) {
    edges.push({
      type: 'usage_trend',
      playerId: player.id,
      week: 18,
      impact: 'positive',
      magnitude: 4,
      confidence: 75,
      shortDescription: 'CONTRACT YEAR',
      details: 'Playing for a new deal - historically motivated',
      source: 'Contract Analysis',
      timestamp: new Date(),
    });
  }

  // Draft Capital Edge (for younger players)
  if (analysis.draftCapital && player.yearsExp !== undefined && player.yearsExp <= 3) {
    const dc = analysis.draftCapital;
    if (dc.round <= 2) {
      edges.push({
        type: 'usage_trend',
        playerId: player.id,
        week: 18,
        impact: 'positive',
        magnitude: dc.impact,
        confidence: 70,
        shortDescription: `Draft: Rd ${dc.round}`,
        details: dc.description,
        source: 'Draft Capital',
        timestamp: new Date(),
      });
    }
  }

  return edges;
}

// Get a summary for the trade analyzer
export function getSituationSummary(player: Player): string[] {
  const analysis = analyzeSituation(player);
  const factors: string[] = [];

  if (analysis.qbStability) {
    const emoji = analysis.qbStability.impact >= 4 ? '+' : analysis.qbStability.impact <= -4 ? '-' : '';
    factors.push(`${emoji}QB: ${analysis.qbStability.description}`);
  }

  if (analysis.competition) {
    const emoji = analysis.competition.impact >= 4 ? '+' : analysis.competition.impact <= -2 ? '-' : '';
    factors.push(`${emoji}Role: ${analysis.competition.role} - ${analysis.competition.description}`);
  }

  if (analysis.coaching && analysis.coaching.type !== 'stable') {
    factors.push(`Coaching: ${analysis.coaching.description}`);
  }

  if (analysis.contractYear?.isContractYear) {
    factors.push(`+Contract year - motivated`);
  }

  if (analysis.contract) {
    factors.push(`Contract: ${analysis.contract.summary}`);
  }

  if (analysis.draftCapital) {
    factors.push(`Draft capital: ${analysis.draftCapital.description}`);
  }

  return factors;
}
