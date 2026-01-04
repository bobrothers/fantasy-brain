import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

import { sleeper } from '@/lib/providers/sleeper';
import { calculateDynastyValue, DynastyValue } from '@/lib/trade/dynasty-value';
import { calculateRedraftValue, RedraftValue } from '@/lib/trade/redraft-value';
import { calculatePickValue, formatPick, DraftPick, PickValue } from '@/lib/trade/pick-values';
import { getSellWindowAlert, SellWindowAlert } from '@/lib/trade/sell-window';
import { analyzeConsolidation, ConsolidationAnalysis } from '@/lib/trade/consolidation';

type TradeMode = 'dynasty' | 'redraft';

interface TradeSide {
  players: Array<{
    name: string;
    dynasty: DynastyValue;
    redraft: RedraftValue;
    sellWindow?: SellWindowAlert;
  }>;
  picks: Array<{
    pick: DraftPick;
    value: PickValue;
  }>;
  totalDynastyValue: number;
  totalRedraftValue: number;
}

interface TradeAnalysis {
  side1: TradeSide;
  side2: TradeSide;
  consolidation?: ConsolidationAnalysis;
  // Legacy fields for backwards compatibility
  player1?: {
    dynasty: DynastyValue;
    redraft: RedraftValue;
  };
  player2?: {
    dynasty: DynastyValue;
    redraft: RedraftValue;
  };
  verdict: {
    winner: 'side1' | 'side2' | 'even';
    action: 'ACCEPT' | 'REJECT' | 'SLIGHT EDGE' | 'TOSS-UP';
    margin: number;
    confidence: number;
    reasoning: string[];
    summary: string;
    gunToHead: string;
  };
  mode: TradeMode;
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  // Support both single player (player1) and multiple (players1)
  const player1Name = searchParams.get('player1');
  const player2Name = searchParams.get('player2');
  const players1Str = searchParams.get('players1');
  const players2Str = searchParams.get('players2');
  const picks1Str = searchParams.get('picks1');
  const picks2Str = searchParams.get('picks2');
  const mode = (searchParams.get('mode') || 'dynasty') as TradeMode;

  // Parse players and picks
  let playerNames1: string[] = [];
  let playerNames2: string[] = [];
  let picks1: DraftPick[] = [];
  let picks2: DraftPick[] = [];
  try {
    // Support both single player and array of players
    if (players1Str) playerNames1 = JSON.parse(players1Str);
    else if (player1Name) playerNames1 = [player1Name];

    if (players2Str) playerNames2 = JSON.parse(players2Str);
    else if (player2Name) playerNames2 = [player2Name];

    if (picks1Str) picks1 = JSON.parse(picks1Str);
    if (picks2Str) picks2 = JSON.parse(picks2Str);
  } catch {
    return NextResponse.json({ error: 'Invalid format' }, { status: 400 });
  }

  // Need at least one asset on each side
  if (playerNames1.length === 0 && picks1.length === 0) {
    return NextResponse.json({ error: 'Side 1 needs at least one player or pick' }, { status: 400 });
  }
  if (playerNames2.length === 0 && picks2.length === 0) {
    return NextResponse.json({ error: 'Side 2 needs at least one player or pick' }, { status: 400 });
  }

  try {
    const players = await sleeper.getAllPlayers();

    // Build side 1
    const side1: TradeSide = {
      players: [],
      picks: [],
      totalDynastyValue: 0,
      totalRedraftValue: 0,
    };

    for (const playerName of playerNames1) {
      let player = players.get(playerName);
      if (!player) {
        const searchName = playerName.toLowerCase();
        player = Array.from(players.values()).find(p =>
          p.name.toLowerCase().includes(searchName)
        );
      }
      if (!player) {
        return NextResponse.json({ error: `Player not found: ${playerName}` }, { status: 404 });
      }
      const dynasty = calculateDynastyValue(player);
      const redraft = await calculateRedraftValue(player);
      const sellWindow = getSellWindowAlert(player);
      side1.players.push({ name: player.name, dynasty, redraft, sellWindow });
      side1.totalDynastyValue += dynasty.overallScore;
      side1.totalRedraftValue += redraft.overallScore;
    }

    for (const pick of picks1) {
      const pickValue = calculatePickValue(pick);
      side1.picks.push({ pick, value: pickValue });
      side1.totalDynastyValue += pickValue.dynastyScore;
      // Picks have no redraft value
    }

    // Build side 2
    const side2: TradeSide = {
      players: [],
      picks: [],
      totalDynastyValue: 0,
      totalRedraftValue: 0,
    };

    for (const playerName of playerNames2) {
      let player = players.get(playerName);
      if (!player) {
        const searchName = playerName.toLowerCase();
        player = Array.from(players.values()).find(p =>
          p.name.toLowerCase().includes(searchName)
        );
      }
      if (!player) {
        return NextResponse.json({ error: `Player not found: ${playerName}` }, { status: 404 });
      }
      const dynasty = calculateDynastyValue(player);
      const redraft = await calculateRedraftValue(player);
      const sellWindow = getSellWindowAlert(player);
      side2.players.push({ name: player.name, dynasty, redraft, sellWindow });
      side2.totalDynastyValue += dynasty.overallScore;
      side2.totalRedraftValue += redraft.overallScore;
    }

    for (const pick of picks2) {
      const pickValue = calculatePickValue(pick);
      side2.picks.push({ pick, value: pickValue });
      side2.totalDynastyValue += pickValue.dynastyScore;
    }

    // Calculate scores based on mode
    const score1 = mode === 'dynasty' ? side1.totalDynastyValue : side1.totalRedraftValue;
    const score2 = mode === 'dynasty' ? side2.totalDynastyValue : side2.totalRedraftValue;
    const scoreDiff = score1 - score2;
    const absMargin = Math.abs(scoreDiff);

    // Build reasoning
    const reasoning: string[] = [];

    // Add player factors
    for (const p of side1.players) {
      const val = mode === 'dynasty' ? p.dynasty : p.redraft;
      if (val.factors.positive.length > 0) {
        reasoning.push(`${p.name}: ${val.factors.positive[0]}`);
      }
      if (val.factors.negative.length > 0) {
        reasoning.push(`${p.name}: ${val.factors.negative[0]}`);
      }
    }
    for (const p of side2.players) {
      const val = mode === 'dynasty' ? p.dynasty : p.redraft;
      if (val.factors.positive.length > 0) {
        reasoning.push(`${p.name}: ${val.factors.positive[0]}`);
      }
      if (val.factors.negative.length > 0) {
        reasoning.push(`${p.name}: ${val.factors.negative[0]}`);
      }
    }

    // Add pick reasoning
    if (side1.picks.length > 0) {
      const pickTotal = side1.picks.reduce((sum, p) => sum + p.value.dynastyScore, 0);
      const pickLabels = side1.picks.map(p => formatPick(p.pick)).join(' + ');
      reasoning.push(`Getting ${pickLabels} (${pickTotal} pts total)`);
    }
    if (side2.picks.length > 0) {
      const pickTotal = side2.picks.reduce((sum, p) => sum + p.value.dynastyScore, 0);
      const pickLabels = side2.picks.map(p => formatPick(p.pick)).join(' + ');
      reasoning.push(`Giving up ${pickLabels} (${pickTotal} pts total)`);
    }

    // Build summary labels
    const side1Label = [...side1.players.map(p => p.name), ...side1.picks.map(p => formatPick(p.pick))].join(' + ') || 'their side';
    const side2Label = [...side2.players.map(p => p.name), ...side2.picks.map(p => formatPick(p.pick))].join(' + ') || 'your side';

    // Determine verdict
    let winner: 'side1' | 'side2' | 'even';
    let action: 'ACCEPT' | 'REJECT' | 'SLIGHT EDGE' | 'TOSS-UP';
    let summary: string;
    let gunToHead: string;

    if (absMargin < 5) {
      winner = 'even';
      action = 'TOSS-UP';
      summary = `Dead even. Both sides grade within 5 points.`;
      gunToHead = scoreDiff >= 0
        ? `Gun to head: Take the ${side1Label} side - upside wins toss-ups`
        : `Gun to head: Keep ${side2Label} - don't trade for marginal gains`;
    } else if (absMargin < 15) {
      winner = scoreDiff > 0 ? 'side1' : 'side2';
      action = 'SLIGHT EDGE';
      summary = scoreDiff > 0
        ? `Slight edge to you (+${absMargin.toFixed(0)} pts).`
        : `Slight edge to them (-${absMargin.toFixed(0)} pts).`;
      gunToHead = scoreDiff > 0
        ? `Gun to head: Accept - the value favors you`
        : `Gun to head: Counter-offer or pass`;
    } else if (absMargin < 30) {
      winner = scoreDiff > 0 ? 'side1' : 'side2';
      action = scoreDiff > 0 ? 'ACCEPT' : 'REJECT';
      summary = scoreDiff > 0
        ? `Good trade for you (+${absMargin.toFixed(0)} pts).`
        : `Bad trade. You're giving up more value (-${absMargin.toFixed(0)} pts).`;
      gunToHead = scoreDiff > 0
        ? `Gun to head: Smash accept`
        : `Gun to head: Hard pass`;
    } else {
      winner = scoreDiff > 0 ? 'side1' : 'side2';
      action = scoreDiff > 0 ? 'ACCEPT' : 'REJECT';
      summary = scoreDiff > 0
        ? `Smash accept! Huge value difference (+${absMargin.toFixed(0)} pts).`
        : `Easy reject. You're getting fleeced (-${absMargin.toFixed(0)} pts).`;
      gunToHead = scoreDiff > 0
        ? `Gun to head: Accept before they change their mind`
        : `Gun to head: Reject and block their number`;
    }

    // Calculate confidence
    let confidence = 70;
    if (absMargin > 20) confidence += 10;
    if (side1.picks.length + side2.picks.length > 0) confidence -= 5; // Picks are uncertain
    confidence = Math.max(40, Math.min(95, confidence));

    // Consolidation analysis (dynasty mode only)
    let consolidation: ConsolidationAnalysis | undefined;
    if (mode === 'dynasty') {
      const side1PlayerValues = side1.players.map(p => p.dynasty.overallScore);
      const side2PlayerValues = side2.players.map(p => p.dynasty.overallScore);

      consolidation = analyzeConsolidation(
        side1.players.length,
        side1.picks.length,
        side1.totalDynastyValue,
        side1PlayerValues,
        side2.players.length,
        side2.picks.length,
        side2.totalDynastyValue,
        side2PlayerValues
      );

      // Add consolidation warning to reasoning if applicable
      if (consolidation.warning) {
        reasoning.push(consolidation.warning);
      }

      // Add sell window alerts to reasoning (dynasty mode)
      for (const p of [...side1.players, ...side2.players]) {
        if (p.sellWindow && (p.sellWindow.urgency === 'SELL NOW' || p.sellWindow.urgency === 'SELL SOON')) {
          reasoning.push(`${p.name}: ${p.sellWindow.urgency} - ${p.sellWindow.reason}`);
        }
      }
    }

    // Build response with backwards compatibility
    const response: TradeAnalysis = {
      side1,
      side2,
      consolidation,
      // Legacy fields for backwards compatibility
      player1: side1.players[0] ? { dynasty: side1.players[0].dynasty, redraft: side1.players[0].redraft } : undefined,
      player2: side2.players[0] ? { dynasty: side2.players[0].dynasty, redraft: side2.players[0].redraft } : undefined,
      verdict: {
        winner,
        action,
        margin: absMargin,
        confidence,
        reasoning,
        summary,
        gunToHead,
      },
      mode,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Trade analysis error:', error);
    return NextResponse.json(
      { error: 'Trade analysis failed' },
      { status: 500 }
    );
  }
}
