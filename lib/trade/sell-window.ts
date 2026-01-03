/**
 * Sell Window Alert System
 *
 * Identifies players approaching their decline window based on:
 * - Age relative to position curve
 * - Contract status (expiring, final years)
 * - Injury history concerns
 */

import type { Player } from '@/types';
import { CONTRACT_DATA } from '@/lib/data/contracts';

export interface SellWindowAlert {
  urgency: 'SELL NOW' | 'SELL SOON' | 'HOLD' | 'BUY LOW' | 'BUY NOW';
  reason: string;
  eliteYearsLeft: number;
  windowDescription: string;
  actionAdvice: string;
}

// Position-specific age cliffs
const AGE_CLIFFS = {
  QB: { warning: 36, cliff: 38, elite: 35 },
  RB: { warning: 27, cliff: 28, elite: 26 },
  WR: { warning: 30, cliff: 32, elite: 29 },
  TE: { warning: 31, cliff: 33, elite: 30 },
  K: { warning: 38, cliff: 40, elite: 37 },
  DEF: { warning: 99, cliff: 99, elite: 99 },
};

// Players with known injury concerns that accelerate sell window
const INJURY_ACCELERATORS: Record<string, { concern: string; yearsDeducted: number }> = {
  'Christian McCaffrey': { concern: 'Chronic soft tissue issues', yearsDeducted: 2 },
  'Tua Tagovailoa': { concern: 'Multiple concussions', yearsDeducted: 3 },
  'Jonathan Taylor': { concern: 'Recurring ankle issues', yearsDeducted: 1 },
  'Nick Chubb': { concern: 'Multiple knee surgeries', yearsDeducted: 2 },
  'Javonte Williams': { concern: 'ACL/LCL/MCL tear', yearsDeducted: 2 },
  'Cooper Kupp': { concern: 'Recurring soft tissue', yearsDeducted: 1 },
  'Michael Thomas': { concern: 'Chronic ankle issues', yearsDeducted: 3 },
  'Dalvin Cook': { concern: 'Age + injury history', yearsDeducted: 2 },
  'Derrick Henry': { concern: 'High mileage RB', yearsDeducted: 1 },
  'Travis Kelce': { concern: 'Age 35 TE', yearsDeducted: 1 },
  'Mark Andrews': { concern: 'Major ankle/achilles injury', yearsDeducted: 1 },
};

export function getSellWindowAlert(player: Player): SellWindowAlert {
  const age = player.age || 25;
  const position = player.position;
  const cliffs = AGE_CLIFFS[position] || AGE_CLIFFS.WR;
  const contract = CONTRACT_DATA[player.name];
  const injuryAccel = INJURY_ACCELERATORS[player.name];

  // Calculate base elite years remaining
  let eliteYearsLeft = Math.max(0, cliffs.elite - age + 1);

  // RBs have much tighter windows
  if (position === 'RB') {
    if (age <= 24) eliteYearsLeft = 27 - age;
    else if (age <= 26) eliteYearsLeft = Math.max(1, 27 - age);
    else if (age === 27) eliteYearsLeft = 1;
    else eliteYearsLeft = 0;
  }

  // Apply injury deduction
  if (injuryAccel) {
    eliteYearsLeft = Math.max(0, eliteYearsLeft - injuryAccel.yearsDeducted);
  }

  // Determine urgency
  let urgency: SellWindowAlert['urgency'];
  let reason: string;
  let windowDescription: string;
  let actionAdvice: string;

  // SELL NOW conditions
  if (position === 'RB' && age >= 28) {
    urgency = 'SELL NOW';
    reason = `Age ${age} RB - past the cliff`;
    windowDescription = 'Elite production window CLOSED';
    actionAdvice = 'Accept any reasonable offer. Value only decreases from here.';
  } else if (position === 'RB' && age === 27) {
    urgency = 'SELL NOW';
    reason = `Age ${age} RB - final elite season`;
    windowDescription = '1 elite season remaining (maybe)';
    actionAdvice = 'Sell for a young WR or 1st round pick while value exists.';
  } else if (eliteYearsLeft === 0 && age >= cliffs.cliff) {
    urgency = 'SELL NOW';
    reason = `Age ${age} ${position} - past prime`;
    windowDescription = 'Elite production window CLOSED';
    actionAdvice = 'Sell for whatever you can get. Redraft-only value.';
  } else if (contract?.contractYear && age >= cliffs.warning - 1) {
    urgency = 'SELL NOW';
    reason = `Contract year + age ${age}`;
    windowDescription = `${eliteYearsLeft} elite year${eliteYearsLeft !== 1 ? 's' : ''} left, uncertain future`;
    actionAdvice = 'Maximize value before contract uncertainty tanks it.';
  } else if (injuryAccel && eliteYearsLeft <= 1) {
    urgency = 'SELL NOW';
    reason = injuryAccel.concern;
    windowDescription = `${eliteYearsLeft} elite year${eliteYearsLeft !== 1 ? 's' : ''} left (injury-adjusted)`;
    actionAdvice = 'Injury history shortens window. Sell while productive.';
  }
  // SELL SOON conditions
  else if (position === 'RB' && age === 26) {
    urgency = 'SELL SOON';
    reason = `Age ${age} RB - 1-2 elite seasons left`;
    windowDescription = '1-2 elite seasons remaining';
    actionAdvice = 'Start shopping. Peak value window closing.';
  } else if (eliteYearsLeft <= 2 && eliteYearsLeft > 0) {
    urgency = 'SELL SOON';
    reason = `Age ${age} ${position} - approaching decline`;
    windowDescription = `${eliteYearsLeft} elite year${eliteYearsLeft !== 1 ? 's' : ''} remaining`;
    actionAdvice = 'Consider selling if contending window doesn\'t align.';
  } else if (contract?.status === 'expiring' && !contract.isRookieDeal) {
    urgency = 'SELL SOON';
    reason = 'Contract expiring - future uncertain';
    windowDescription = `${eliteYearsLeft} elite years left, but may change teams`;
    actionAdvice = 'Sell before free agency uncertainty if rebuilding.';
  }
  // BUY LOW conditions
  else if (injuryAccel && age <= cliffs.warning - 3) {
    urgency = 'BUY LOW';
    reason = `Injury concerns depressing value`;
    windowDescription = `${eliteYearsLeft} elite years if healthy`;
    actionAdvice = 'Buy at discount if you believe in talent.';
  } else if (contract?.status === 'tradeable' && age <= cliffs.warning - 2) {
    urgency = 'BUY LOW';
    reason = 'Team may move on, depressing value';
    windowDescription = `${eliteYearsLeft} elite years left`;
    actionAdvice = 'Situation uncertainty creates buying opportunity.';
  }
  // BUY NOW conditions
  else if (age <= 24 && (position === 'WR' || position === 'TE')) {
    urgency = 'BUY NOW';
    reason = `Age ${age} ${position} - ascending`;
    windowDescription = `${eliteYearsLeft}+ elite years ahead`;
    actionAdvice = 'Pay up for young elite talent. Long runway.';
  } else if (position === 'RB' && age <= 23) {
    urgency = 'BUY NOW';
    reason = `Age ${age} RB - full window ahead`;
    windowDescription = `${eliteYearsLeft} elite years remaining`;
    actionAdvice = 'Young RBs with talent are scarce. Acquire now.';
  } else if (contract?.isRookieDeal && contract.status === 'elite') {
    urgency = 'BUY NOW';
    reason = 'Elite on rookie deal - surplus value';
    windowDescription = `${eliteYearsLeft} elite years + cheap contract`;
    actionAdvice = 'Premium asset. Pay the price.';
  }
  // HOLD (default)
  else {
    urgency = 'HOLD';
    reason = `Age ${age} ${position} - productive years remaining`;
    windowDescription = `${eliteYearsLeft} elite year${eliteYearsLeft !== 1 ? 's' : ''} projected`;
    actionAdvice = 'Hold unless overwhelmed with an offer.';
  }

  return {
    urgency,
    reason,
    eliteYearsLeft,
    windowDescription,
    actionAdvice,
  };
}

export function getSellWindowColor(urgency: SellWindowAlert['urgency']): string {
  switch (urgency) {
    case 'SELL NOW': return 'text-red-400 bg-red-950/30 border-red-500/50';
    case 'SELL SOON': return 'text-orange-400 bg-orange-950/30 border-orange-500/50';
    case 'HOLD': return 'text-zinc-400 bg-zinc-800/50 border-zinc-600/50';
    case 'BUY LOW': return 'text-amber-400 bg-amber-950/30 border-amber-500/50';
    case 'BUY NOW': return 'text-emerald-400 bg-emerald-950/30 border-emerald-500/50';
  }
}
