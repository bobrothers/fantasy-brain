/**
 * Combined Edge Detector
 *
 * Now uses dynamic schedule from ESPN API instead of hardcoded Week 18 matchups.
 */

import 'dotenv/config';

import type { Player, EdgeSignal } from '../types';
import { sleeper } from './providers/sleeper';
import { getSchedule, getCurrentWeek } from './schedule';
import { detectWeatherEdge } from './edge/weather-impact';
import { detectTravelEdge } from './edge/travel-rest';
import { detectOLInjuryEdge, getOLInjuryFantasyImpact } from './edge/ol-injury';
import { detectBettingEdge } from './edge/betting-signals';
import { detectDefenseMatchupEdge } from './edge/defense-vs-position';
import { detectOpposingDefenseEdge } from './edge/opposing-defense-injuries';
import { detectUsageTrendEdge } from './edge/usage-trends';
import { detectContractIncentiveEdge } from './edge/contract-incentives';
import { detectRevengeGameEdge } from './edge/revenge-games';
import { detectRedZoneEdge } from './edge/red-zone-usage';
import { detectHomeAwaySplitEdge } from './edge/home-away-splits';
import { detectPrimetimeEdge } from './edge/primetime-performance';
import { detectDivisionRivalryEdge } from './edge/division-rivalry';
import { detectRestAdvantageEdge } from './edge/rest-advantage';
import { detectIndoorOutdoorEdge } from './edge/indoor-outdoor-splits';

const SYMBOLS = {
  positive: '✓',
  negative: '⚠️',
  neutral: '○',
};

interface EdgeAnalysis {
  player: Player;
  week: number;
  signals: EdgeSignal[];
  summary: {
    weather: string;
    travel: string;
    olInjury: string;
    betting: string;
    defenseMatchup: string;
    opposingDInjuries: string;
    usageTrends: string;
    contractIncentive: string;
    revengeGame: string;
    redZone: string;
    homeAway: string;
    primetime: string;
    divisionRivalry: string;
    restAdvantage: string;
    indoorOutdoor: string;
  };
  overallImpact: number;
  recommendation: string;
  confidence: number;
}

export async function analyzePlayer(
  playerIdOrName: string,
  week?: number
): Promise<EdgeAnalysis | null> {
  // Get current week dynamically if not specified
  const targetWeek = week ?? (await getCurrentWeek()).week;

  const players = await sleeper.getAllPlayers();
  let player: Player | undefined;

  player = players.get(playerIdOrName);

  if (!player) {
    const searchName = playerIdOrName.toLowerCase();
    player = Array.from(players.values()).find(p =>
      p.name.toLowerCase().includes(searchName)
    );
  }

  if (!player) {
    console.error('Player not found: ' + playerIdOrName);
    return null;
  }

  if (!player.team) {
    console.error('Player ' + player.name + ' has no team');
    return null;
  }

  // Get dynamic schedule from ESPN API
  const schedule = await getSchedule(targetWeek);
  const gameInfo = schedule.get(player.team);

  if (!gameInfo) {
    console.error('No game found for ' + player.team + ' in week ' + targetWeek);
    return null;
  }
  
  const allSignals: EdgeSignal[] = [];
  const summaries = {
    weather: '',
    travel: '',
    olInjury: '',
    betting: '',
    defenseMatchup: '',
    opposingDInjuries: '',
    usageTrends: '',
    contractIncentive: '',
    revengeGame: '',
    redZone: '',
    homeAway: '',
    primetime: '',
    divisionRivalry: '',
    restAdvantage: '',
    indoorOutdoor: '',
  };

  // Use date from schedule (or fallback to current time)
  const gameTime = gameInfo.date || new Date().toISOString();

  console.log('  Checking weather...');
  const weatherResult = await detectWeatherEdge(
    player,
    gameInfo.opponent,
    gameInfo.isHome,
    gameTime,
    targetWeek
  );
  allSignals.push(...weatherResult.signals);
  summaries.weather = weatherResult.summary;

  console.log('  Checking travel/rest...');
  const travelResult = detectTravelEdge(
    {
      team: player.team,
      opponentTeam: gameInfo.opponent,
      isHome: gameInfo.isHome,
      gameTime: gameTime,
    },
    targetWeek
  );
  allSignals.push(...travelResult.signals);
  summaries.travel = travelResult.summary;

  console.log('  Checking OL injuries...');
  const olResult = await detectOLInjuryEdge(player.team, targetWeek);
  const playerOLSignals = olResult.signals.map(s => ({ ...s, playerId: player!.id }));
  allSignals.push(...playerOLSignals);
  summaries.olInjury = olResult.summary;

  console.log('  Checking betting signals...');
  const bettingResult = await detectBettingEdge(player.team, targetWeek);
  const playerBettingSignals = bettingResult.signals.map(s => ({
    ...s,
    playerId: player!.id,
  }));
  allSignals.push(...playerBettingSignals);
  summaries.betting = bettingResult.summary;

  // 5. Defense vs Position matchup (NOW LIVE from Sleeper + ESPN)
  console.log('  Checking defense matchup...');
  const defMatchupResult = await detectDefenseMatchupEdge(player, gameInfo.opponent, targetWeek);
  allSignals.push(...defMatchupResult.signals);
  summaries.defenseMatchup = defMatchupResult.summary;

  // 6. Opposing Defense Injuries
  console.log('  Checking opposing D injuries...');
  const oppDefResult = await detectOpposingDefenseEdge(player, gameInfo.opponent, targetWeek);
  allSignals.push(...oppDefResult.signals);
  summaries.opposingDInjuries = oppDefResult.summary;

  // 7. Usage Trends (async - uses nflfastR data)
  console.log('  Checking usage trends...');
  const usageResult = await detectUsageTrendEdge(player, targetWeek);
  allSignals.push(...usageResult.signals);
  summaries.usageTrends = usageResult.summary;

  // 8. Contract Incentives
  console.log('  Checking contract incentives...');
  const incentiveResult = detectContractIncentiveEdge(player, targetWeek);
  allSignals.push(...incentiveResult.signals);
  summaries.contractIncentive = incentiveResult.summary;

  // 9. Revenge Games (now async)
  console.log('  Checking revenge games...');
  const revengeResult = await detectRevengeGameEdge(player, targetWeek);
  allSignals.push(...revengeResult.signals);
  summaries.revengeGame = revengeResult.summary;

  // 10. Red Zone Usage
  console.log('  Checking red zone usage...');
  const rzResult = detectRedZoneEdge(player, targetWeek);
  allSignals.push(...rzResult.signals);
  summaries.redZone = rzResult.summary;

  // 11. Home/Away Splits
  console.log('  Checking home/away splits...');
  const homeAwayResult = detectHomeAwaySplitEdge(player, gameInfo.isHome, targetWeek);
  allSignals.push(...homeAwayResult.signals);
  summaries.homeAway = homeAwayResult.summary;

  // 12. Primetime Performance (now async)
  console.log('  Checking primetime performance...');
  const primetimeResult = await detectPrimetimeEdge(player, targetWeek);
  allSignals.push(...primetimeResult.signals);
  summaries.primetime = primetimeResult.summary;

  // 13. Division Rivalry
  console.log('  Checking division rivalry...');
  const divisionResult = detectDivisionRivalryEdge(player, gameInfo.opponent, targetWeek);
  allSignals.push(...divisionResult.signals);
  summaries.divisionRivalry = divisionResult.summary;

  // 14. Rest Advantage (now async)
  console.log('  Checking rest advantage...');
  const restResult = await detectRestAdvantageEdge(player, gameInfo.opponent, targetWeek);
  allSignals.push(...restResult.signals);
  summaries.restAdvantage = restResult.summary;

  // 15. Indoor/Outdoor Splits
  console.log('  Checking indoor/outdoor splits...');
  const indoorResult = detectIndoorOutdoorEdge(
    player,
    gameInfo.opponent,
    gameInfo.isHome,
    targetWeek
  );
  allSignals.push(...indoorResult.signals);
  summaries.indoorOutdoor = indoorResult.summary;

  const overallImpact = allSignals.reduce((sum, signal) => {
    const weight = signal.confidence / 100;
    return sum + signal.magnitude * weight;
  }, 0);

  const recommendation = generateRecommendation(
    player,
    allSignals,
    overallImpact,
    olResult,
    bettingResult
  );

  const avgConfidence =
    allSignals.length > 0
      ? allSignals.reduce((sum, s) => sum + s.confidence, 0) / allSignals.length
      : 70;

  return {
    player,
    week: targetWeek,
    signals: allSignals,
    summary: summaries,
    overallImpact: Math.round(overallImpact * 10) / 10,
    recommendation,
    confidence: Math.round(avgConfidence),
  };
}

function generateRecommendation(
  player: Player,
  signals: EdgeSignal[],
  overallImpact: number,
  olResult: Awaited<ReturnType<typeof detectOLInjuryEdge>>,
  bettingResult: Awaited<ReturnType<typeof detectBettingEdge>>
): string {
  const negativeSignals = signals.filter(s => s.impact === 'negative');
  const positiveSignals = signals.filter(s => s.impact === 'positive');
  
  let rec = '';
  
  if (overallImpact >= 4) {
    rec = 'Strong environment for ' + player.name + '. ';
  } else if (overallImpact >= 1) {
    rec = 'Favorable setup for ' + player.name + '. ';
  } else if (overallImpact <= -8) {
    rec = 'Significant concerns for ' + player.name + '. ';
  } else if (overallImpact <= -4) {
    rec = 'Some headwinds for ' + player.name + '. ';
  } else {
    rec = 'Neutral environment for ' + player.name + '. ';
  }
  
  const olImpact = getOLInjuryFantasyImpact(olResult);
  if (player.position === 'QB' && olImpact.qbImpact === 'downgrade') {
    rec += 'OL issues limit upside. ';
  } else if (player.position === 'RB' && olImpact.rbImpact === 'downgrade') {
    rec += 'Running lanes compromised. ';
  }
  
  const hasWindIssue = signals.some(s => s.type === 'weather_wind' && s.magnitude <= -3);
  if (hasWindIssue && (player.position === 'QB' || player.position === 'WR')) {
    rec += 'Wind limits deep ball upside. ';
  }
  
  if (bettingResult.isShootout) {
    rec += 'Shootout potential boosts ceiling. ';
  } else if (bettingResult.isBlowoutRisk) {
    rec += 'Blowout risk may cap touches. ';
  }
  
  if (overallImpact >= 3) {
    rec += 'Start with confidence.';
  } else if (overallImpact <= -6) {
    rec += 'Consider alternatives if available.';
  } else if (negativeSignals.length > positiveSignals.length) {
    rec += 'Floor play - temper expectations.';
  } else {
    rec += 'Proceed as normal.';
  }
  
  return rec;
}

export function printAnalysis(analysis: EdgeAnalysis): void {
  const { player, signals, summary, overallImpact, recommendation, confidence } = analysis;
  
  console.log('\n' + '='.repeat(60));
  console.log('EDGE ANALYSIS: ' + player.name + ' (' + player.team + ' ' + player.position + ')');
  console.log('='.repeat(60));
  
  console.log('\n📊 EDGE SIGNALS:');
  
  const weatherSig = signals.find(s => s.type.startsWith('weather_'));
  const weatherSymbol = weatherSig ? SYMBOLS[weatherSig.impact] : SYMBOLS.neutral;
  console.log('  ' + weatherSymbol + ' Weather: ' + summary.weather);
  
  const travelSig = signals.find(s => s.type.startsWith('travel_'));
  const travelSymbol = travelSig ? SYMBOLS[travelSig.impact] : SYMBOLS.neutral;
  console.log('  ' + travelSymbol + ' Travel/Rest: ' + summary.travel);
  
  const olSig = signals.find(s => s.type.startsWith('ol_'));
  const olSymbol = olSig ? SYMBOLS[olSig.impact] : SYMBOLS.neutral;
  console.log('  ' + olSymbol + ' OL Health: ' + summary.olInjury);
  
  const bettingSig = signals.find(s => s.type.startsWith('betting_'));
  const bettingSymbol = bettingSig ? SYMBOLS[bettingSig.impact] : SYMBOLS.neutral;
  console.log('  ' + bettingSymbol + ' Betting: ' + summary.betting);
  
  const matchupSig = signals.find(s => s.type === 'matchup_defense');
  const matchupSymbol = matchupSig ? SYMBOLS[matchupSig.impact] : SYMBOLS.neutral;
  console.log('  ' + matchupSymbol + ' Matchup: ' + (summary as any).defenseMatchup);
  
  const oppDefSig = signals.find(s => s.type === 'matchup_def_injury');
  const oppDefSymbol = oppDefSig ? SYMBOLS[oppDefSig.impact] : SYMBOLS.neutral;
  console.log('  ' + oppDefSymbol + ' Opp D Injuries: ' + (summary as any).opposingDInjuries);
  
  const usageSig = signals.find(s => s.type.startsWith('usage_') && !s.source?.includes('redzone') && !s.source?.includes('contract'));
  const usageSymbol = usageSig ? SYMBOLS[usageSig.impact] : SYMBOLS.neutral;
  console.log('  ' + usageSymbol + ' Usage: ' + (summary as any).usageTrends);
  
  const incentiveSig = signals.find(s => s.source === 'contract-incentives');
  const incentiveSymbol = incentiveSig ? SYMBOLS[incentiveSig.impact] : SYMBOLS.neutral;
  console.log('  ' + incentiveSymbol + ' Contract: ' + (summary as any).contractIncentive);
  
  const revengeSig = signals.find(s => s.source === 'revenge-games');
  const revengeSymbol = revengeSig ? SYMBOLS[revengeSig.impact] : SYMBOLS.neutral;
  console.log('  ' + revengeSymbol + ' Revenge: ' + (summary as any).revengeGame);
  
  const rzSig = signals.find(s => s.source === 'redzone-usage');
  const rzSymbol = rzSig ? SYMBOLS[rzSig.impact] : SYMBOLS.neutral;
  console.log('  ' + rzSymbol + ' Red Zone: ' + (summary as any).redZone);

  const homeAwaySig = signals.find(s => s.type === 'home_away_split');
  const homeAwaySymbol = homeAwaySig ? SYMBOLS[homeAwaySig.impact] : SYMBOLS.neutral;
  console.log('  ' + homeAwaySymbol + ' Home/Away: ' + (summary as any).homeAway);

  const primetimeSig = signals.find(s => s.type === 'primetime_performance');
  const primetimeSymbol = primetimeSig ? SYMBOLS[primetimeSig.impact] : SYMBOLS.neutral;
  console.log('  ' + primetimeSymbol + ' Primetime: ' + (summary as any).primetime);

  const divisionSig = signals.find(s => s.type === 'division_rivalry');
  const divisionSymbol = divisionSig ? SYMBOLS[divisionSig.impact] : SYMBOLS.neutral;
  console.log('  ' + divisionSymbol + ' Division: ' + (summary as any).divisionRivalry);

  const restSig = signals.find(s => s.type === 'rest_advantage');
  const restSymbol = restSig ? SYMBOLS[restSig.impact] : SYMBOLS.neutral;
  console.log('  ' + restSymbol + ' Rest: ' + (summary as any).restAdvantage);

  const indoorSig = signals.find(s => s.type === 'indoor_outdoor_split');
  const indoorSymbol = indoorSig ? SYMBOLS[indoorSig.impact] : SYMBOLS.neutral;
  console.log('  ' + indoorSymbol + ' Venue: ' + (summary as any).indoorOutdoor);

  const impactStr = overallImpact > 0 ? '+' + overallImpact : String(overallImpact);
  console.log('\n📈 OVERALL IMPACT: ' + impactStr);
  console.log('🎯 CONFIDENCE: ' + confidence + '%');
  
  console.log('\n💡 RECOMMENDATION:');
  console.log('  ' + recommendation);
  
  const significantSignals = signals.filter(s => Math.abs(s.magnitude) >= 3);
  if (significantSignals.length > 0) {
    console.log('\n⚠️  KEY FACTORS:');
    for (const sig of significantSignals) {
      console.log('  • ' + sig.shortDescription);
    }
  }
  
  console.log('\n' + '='.repeat(60));
}

export async function comparePlayers(
  playerNames: string[],
  week?: number
): Promise<void> {
  // Get current week dynamically if not specified
  const targetWeek = week ?? (await getCurrentWeek()).week;
  console.log(
    '\nComparing ' + playerNames.length + ' players for Week ' + targetWeek + '...\n'
  );

  const analyses: EdgeAnalysis[] = [];

  for (const name of playerNames) {
    console.log('Analyzing ' + name + '...');
    const analysis = await analyzePlayer(name, targetWeek);
    if (analysis) {
      analyses.push(analysis);
    }
  }
  
  analyses.sort((a, b) => b.overallImpact - a.overallImpact);
  
  console.log('\n' + '='.repeat(60));
  console.log('COMPARISON RESULTS (sorted by edge score)');
  console.log('='.repeat(60));
  
  for (const analysis of analyses) {
    const impact = analysis.overallImpact > 0 
      ? '+' + analysis.overallImpact 
      : String(analysis.overallImpact);
    console.log('\n' + analysis.player.name + ' (' + analysis.player.team + ' ' + analysis.player.position + ')');
    console.log('  Edge Score: ' + impact + ' | Confidence: ' + analysis.confidence + '%');
    console.log('  ' + analysis.recommendation);
  }
}

export default { analyzePlayer, printAnalysis, comparePlayers };
