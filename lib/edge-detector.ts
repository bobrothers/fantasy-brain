/**
 * Combined Edge Detector
 */

import 'dotenv/config';

import type { Player, EdgeSignal } from '../types';
import { sleeper } from './providers/sleeper';
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
  };
  overallImpact: number;
  recommendation: string;
  confidence: number;
}

interface GameInfo {
  opponent: string;
  isHome: boolean;
  gameTime: string;
}

const WEEK_18_SCHEDULE: Record<string, GameInfo> = {
  // Saturday games
  CAR: { opponent: 'TB', isHome: false, gameTime: '2026-01-03T21:30:00Z' },
  TB: { opponent: 'CAR', isHome: true, gameTime: '2026-01-03T21:30:00Z' },
  SEA: { opponent: 'SF', isHome: false, gameTime: '2026-01-04T01:00:00Z' },
  SF: { opponent: 'SEA', isHome: true, gameTime: '2026-01-04T01:00:00Z' },
  
  // Sunday 1pm ET games
  NO: { opponent: 'ATL', isHome: false, gameTime: '2026-01-04T18:00:00Z' },
  ATL: { opponent: 'NO', isHome: true, gameTime: '2026-01-04T18:00:00Z' },
  TEN: { opponent: 'JAX', isHome: false, gameTime: '2026-01-04T18:00:00Z' },
  JAX: { opponent: 'TEN', isHome: true, gameTime: '2026-01-04T18:00:00Z' },
  IND: { opponent: 'HOU', isHome: false, gameTime: '2026-01-04T18:00:00Z' },
  HOU: { opponent: 'IND', isHome: true, gameTime: '2026-01-04T18:00:00Z' },
  CLE: { opponent: 'CIN', isHome: false, gameTime: '2026-01-04T18:00:00Z' },
  CIN: { opponent: 'CLE', isHome: true, gameTime: '2026-01-04T18:00:00Z' },
  GB: { opponent: 'MIN', isHome: false, gameTime: '2026-01-04T18:00:00Z' },
  MIN: { opponent: 'GB', isHome: true, gameTime: '2026-01-04T18:00:00Z' },
  DAL: { opponent: 'NYG', isHome: false, gameTime: '2026-01-04T18:00:00Z' },
  NYG: { opponent: 'DAL', isHome: true, gameTime: '2026-01-04T18:00:00Z' },
  
  // Sunday 4:25pm ET games
  NYJ: { opponent: 'BUF', isHome: false, gameTime: '2026-01-04T21:25:00Z' },
  BUF: { opponent: 'NYJ', isHome: true, gameTime: '2026-01-04T21:25:00Z' },
  ARI: { opponent: 'LAR', isHome: false, gameTime: '2026-01-04T21:25:00Z' },
  LAR: { opponent: 'ARI', isHome: true, gameTime: '2026-01-04T21:25:00Z' },
  DET: { opponent: 'CHI', isHome: false, gameTime: '2026-01-04T21:25:00Z' },
  CHI: { opponent: 'DET', isHome: true, gameTime: '2026-01-04T21:25:00Z' },
  KC: { opponent: 'LV', isHome: false, gameTime: '2026-01-04T21:25:00Z' },
  LV: { opponent: 'KC', isHome: true, gameTime: '2026-01-04T21:25:00Z' },
  LAC: { opponent: 'DEN', isHome: false, gameTime: '2026-01-04T21:25:00Z' },
  DEN: { opponent: 'LAC', isHome: true, gameTime: '2026-01-04T21:25:00Z' },
  MIA: { opponent: 'NE', isHome: false, gameTime: '2026-01-04T21:25:00Z' },
  NE: { opponent: 'MIA', isHome: true, gameTime: '2026-01-04T21:25:00Z' },
  WAS: { opponent: 'PHI', isHome: false, gameTime: '2026-01-04T21:25:00Z' },
  PHI: { opponent: 'WAS', isHome: true, gameTime: '2026-01-04T21:25:00Z' },
  
  // Sunday Night
  BAL: { opponent: 'PIT', isHome: false, gameTime: '2026-01-05T01:20:00Z' },
  PIT: { opponent: 'BAL', isHome: true, gameTime: '2026-01-05T01:20:00Z' },
};

export async function analyzePlayer(
  playerIdOrName: string,
  week: number = 18
): Promise<EdgeAnalysis | null> {
  
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
  
  const gameInfo = WEEK_18_SCHEDULE[player.team];
  if (!gameInfo) {
    console.error('No game found for ' + player.team);
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
  
  console.log('  Checking weather...');
  const weatherResult = await detectWeatherEdge(
    player, gameInfo.opponent, gameInfo.isHome, gameInfo.gameTime, week
  );
  allSignals.push(...weatherResult.signals);
  summaries.weather = weatherResult.summary;
  
  console.log('  Checking travel/rest...');
  const travelResult = detectTravelEdge(
    { team: player.team, opponentTeam: gameInfo.opponent, isHome: gameInfo.isHome, gameTime: gameInfo.gameTime },
    week
  );
  allSignals.push(...travelResult.signals);
  summaries.travel = travelResult.summary;
  
  console.log('  Checking OL injuries...');
  const olResult = await detectOLInjuryEdge(player.team, week);
  const playerOLSignals = olResult.signals.map(s => ({ ...s, playerId: player!.id }));
  allSignals.push(...playerOLSignals);
  summaries.olInjury = olResult.summary;
  
  console.log('  Checking betting signals...');
  const bettingResult = await detectBettingEdge(player.team, week);
  const playerBettingSignals = bettingResult.signals.map(s => ({ ...s, playerId: player!.id }));
  allSignals.push(...playerBettingSignals);
  summaries.betting = bettingResult.summary;
  
  // 5. Defense vs Position matchup
  console.log('  Checking defense matchup...');
  const defMatchupResult = detectDefenseMatchupEdge(player, gameInfo.opponent, week);
  allSignals.push(...defMatchupResult.signals);
  summaries.defenseMatchup = defMatchupResult.summary;
  
  // 6. Opposing Defense Injuries
  console.log('  Checking opposing D injuries...');
  const oppDefResult = await detectOpposingDefenseEdge(player, gameInfo.opponent, week);
  allSignals.push(...oppDefResult.signals);
  summaries.opposingDInjuries = oppDefResult.summary;
  
  // 7. Usage Trends (async - uses nflfastR data)
  console.log('  Checking usage trends...');
  const usageResult = await detectUsageTrendEdge(player, week);
  allSignals.push(...usageResult.signals);
  summaries.usageTrends = usageResult.summary;
  
  // 8. Contract Incentives
  console.log('  Checking contract incentives...');
  const incentiveResult = detectContractIncentiveEdge(player, week);
  allSignals.push(...incentiveResult.signals);
  summaries.contractIncentive = incentiveResult.summary;
  
  // 9. Revenge Games
  console.log('  Checking revenge games...');
  const revengeResult = detectRevengeGameEdge(player, week);
  allSignals.push(...revengeResult.signals);
  summaries.revengeGame = revengeResult.summary;
  
  // 10. Red Zone Usage
  console.log('  Checking red zone usage...');
  const rzResult = detectRedZoneEdge(player, week);
  allSignals.push(...rzResult.signals);
  summaries.redZone = rzResult.summary;

  // 11. Home/Away Splits
  console.log('  Checking home/away splits...');
  const homeAwayResult = detectHomeAwaySplitEdge(player, gameInfo.isHome, week);
  allSignals.push(...homeAwayResult.signals);
  summaries.homeAway = homeAwayResult.summary;

  // 12. Primetime Performance
  console.log('  Checking primetime performance...');
  const primetimeResult = detectPrimetimeEdge(player, week);
  allSignals.push(...primetimeResult.signals);
  summaries.primetime = primetimeResult.summary;

  // 13. Division Rivalry
  console.log('  Checking division rivalry...');
  const divisionResult = detectDivisionRivalryEdge(player, gameInfo.opponent, week);
  allSignals.push(...divisionResult.signals);
  summaries.divisionRivalry = divisionResult.summary;

  // 14. Rest Advantage
  console.log('  Checking rest advantage...');
  const restResult = detectRestAdvantageEdge(player, gameInfo.opponent, week);
  allSignals.push(...restResult.signals);
  summaries.restAdvantage = restResult.summary;

  // 15. Indoor/Outdoor Splits
  console.log('  Checking indoor/outdoor splits...');
  const indoorResult = detectIndoorOutdoorEdge(player, gameInfo.opponent, gameInfo.isHome, week);
  allSignals.push(...indoorResult.signals);
  summaries.indoorOutdoor = indoorResult.summary;

  const overallImpact = allSignals.reduce((sum, signal) => {
    const weight = signal.confidence / 100;
    return sum + (signal.magnitude * weight);
  }, 0);
  
  const recommendation = generateRecommendation(player, allSignals, overallImpact, olResult, bettingResult);
  
  const avgConfidence = allSignals.length > 0
    ? allSignals.reduce((sum, s) => sum + s.confidence, 0) / allSignals.length
    : 70;
  
  return {
    player,
    week,
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
  week: number = 18
): Promise<void> {
  console.log('\nComparing ' + playerNames.length + ' players for Week ' + week + '...\n');
  
  const analyses: EdgeAnalysis[] = [];
  
  for (const name of playerNames) {
    console.log('Analyzing ' + name + '...');
    const analysis = await analyzePlayer(name, week);
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
