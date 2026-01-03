import { NextRequest, NextResponse } from 'next/server';
import { sleeper } from '@/lib/providers/sleeper';
import { calculateDynastyValue, DynastyValue } from '@/lib/trade/dynasty-value';
import { calculateRedraftValue, RedraftValue } from '@/lib/trade/redraft-value';

type TradeMode = 'dynasty' | 'redraft';

interface TradeAnalysis {
  player1: {
    dynasty: DynastyValue;
    redraft: RedraftValue;
  };
  player2: {
    dynasty: DynastyValue;
    redraft: RedraftValue;
  };
  verdict: {
    winner: 'player1' | 'player2' | 'even';
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
  const player1Name = searchParams.get('player1');
  const player2Name = searchParams.get('player2');
  const mode = (searchParams.get('mode') || 'dynasty') as TradeMode;

  if (!player1Name || !player2Name) {
    return NextResponse.json(
      { error: 'Both player1 and player2 names required' },
      { status: 400 }
    );
  }

  try {
    // Get all players
    const players = await sleeper.getAllPlayers();

    // Find player 1
    let player1 = players.get(player1Name);
    if (!player1) {
      const searchName1 = player1Name.toLowerCase();
      player1 = Array.from(players.values()).find(p =>
        p.name.toLowerCase().includes(searchName1)
      );
    }

    // Find player 2
    let player2 = players.get(player2Name);
    if (!player2) {
      const searchName2 = player2Name.toLowerCase();
      player2 = Array.from(players.values()).find(p =>
        p.name.toLowerCase().includes(searchName2)
      );
    }

    if (!player1) {
      return NextResponse.json({ error: `Player not found: ${player1Name}` }, { status: 404 });
    }
    if (!player2) {
      return NextResponse.json({ error: `Player not found: ${player2Name}` }, { status: 404 });
    }

    // Calculate values for both modes
    const dynasty1 = calculateDynastyValue(player1);
    const dynasty2 = calculateDynastyValue(player2);
    const redraft1 = await calculateRedraftValue(player1);
    const redraft2 = await calculateRedraftValue(player2);

    // Determine verdict based on mode
    const score1 = mode === 'dynasty' ? dynasty1.overallScore : redraft1.overallScore;
    const score2 = mode === 'dynasty' ? dynasty2.overallScore : redraft2.overallScore;
    const scoreDiff = score1 - score2;

    // Build reasoning
    const reasoning: string[] = [];
    const val1 = mode === 'dynasty' ? dynasty1 : redraft1;
    const val2 = mode === 'dynasty' ? dynasty2 : redraft2;

    // Add key factors from player you're getting
    if (val1.factors.positive.length > 0) {
      reasoning.push(`${player1.name}: ${val1.factors.positive[0]}`);
    }
    if (val1.factors.negative.length > 0) {
      reasoning.push(`${player1.name}: ${val1.factors.negative[0]}`);
    }

    // Add key factors from player you're giving up
    if (val2.factors.positive.length > 0) {
      reasoning.push(`${player2.name}: ${val2.factors.positive[0]}`);
    }
    if (val2.factors.negative.length > 0) {
      reasoning.push(`${player2.name}: ${val2.factors.negative[0]}`);
    }

    // Dynasty-specific reasoning
    if (mode === 'dynasty') {
      if (dynasty1.yearsOfEliteProduction > dynasty2.yearsOfEliteProduction + 2) {
        reasoning.push(`${player1.name} has ${dynasty1.yearsOfEliteProduction - dynasty2.yearsOfEliteProduction} more years of elite production`);
      } else if (dynasty2.yearsOfEliteProduction > dynasty1.yearsOfEliteProduction + 2) {
        reasoning.push(`${player2.name} has ${dynasty2.yearsOfEliteProduction - dynasty1.yearsOfEliteProduction} more years of elite production`);
      }

      if (dynasty1.injuryScore > dynasty2.injuryScore + 10) {
        reasoning.push(`${player1.name} is significantly more durable`);
      } else if (dynasty2.injuryScore > dynasty1.injuryScore + 10) {
        reasoning.push(`${player2.name} is significantly more durable`);
      }
    }

    // Redraft-specific reasoning
    if (mode === 'redraft') {
      if (redraft1.playoffScore > redraft2.playoffScore + 10) {
        reasoning.push(`${player1.name} has a much better playoff schedule`);
      } else if (redraft2.playoffScore > redraft1.playoffScore + 10) {
        reasoning.push(`${player2.name} has a much better playoff schedule`);
      }

      if (redraft1.availabilityScore < 15) {
        reasoning.push(`${player1.name} has injury concerns`);
      }
      if (redraft2.availabilityScore < 15) {
        reasoning.push(`${player2.name} has injury concerns`);
      }
    }

    // Determine action
    let winner: 'player1' | 'player2' | 'even';
    let action: 'ACCEPT' | 'REJECT' | 'SLIGHT EDGE' | 'TOSS-UP';
    let summary: string;
    let gunToHead: string;

    const absMargin = Math.abs(scoreDiff);

    // Build "gun to head" recommendation - always take a stance
    const p1Age = player1.age || 25;
    const p2Age = player2.age || 25;

    if (absMargin < 2) {
      // Dead even - use tiebreakers
      winner = 'even';
      action = 'TOSS-UP';
      summary = `Dead even. Both players grade within 2 points.`;

      // Tiebreakers for gun to head
      if (mode === 'dynasty') {
        if (player1.position === 'RB' && player2.position !== 'RB') {
          gunToHead = `Gun to head: ${player2.name} - non-RBs age better`;
        } else if (player2.position === 'RB' && player1.position !== 'RB') {
          gunToHead = `Gun to head: ${player1.name} - non-RBs age better`;
        } else if (p1Age < p2Age) {
          gunToHead = `Gun to head: ${player1.name} - younger by ${p2Age - p1Age} years`;
        } else if (p2Age < p1Age) {
          gunToHead = `Gun to head: ${player2.name} - younger by ${p1Age - p2Age} years`;
        } else {
          gunToHead = `Gun to head: ${player1.name} - take the upside`;
        }
      } else {
        // Redraft - prefer better playoff schedule
        if (redraft1.playoffScore > redraft2.playoffScore) {
          gunToHead = `Gun to head: ${player1.name} - better playoff schedule`;
        } else if (redraft2.playoffScore > redraft1.playoffScore) {
          gunToHead = `Gun to head: ${player2.name} - better playoff schedule`;
        } else {
          gunToHead = `Gun to head: ${player1.name} - take the upside`;
        }
      }
    } else if (absMargin < 10) {
      winner = scoreDiff > 0 ? 'player1' : 'player2';
      action = 'SLIGHT EDGE';
      summary = scoreDiff > 0
        ? `Slight edge to you. ${player1.name} grades ${absMargin.toFixed(0)} points higher.`
        : `Slight edge to them. ${player2.name} grades ${absMargin.toFixed(0)} points higher.`;
      gunToHead = scoreDiff > 0
        ? `Gun to head: ${player1.name} - the value is there`
        : `Gun to head: ${player2.name} - don't give up the better asset`;
    } else if (absMargin < 20) {
      winner = scoreDiff > 0 ? 'player1' : 'player2';
      action = scoreDiff > 0 ? 'ACCEPT' : 'REJECT';
      summary = scoreDiff > 0
        ? `Good trade for you. ${player1.name} is a clear upgrade (+${absMargin.toFixed(0)} pts).`
        : `Bad trade. You're giving up more value (-${absMargin.toFixed(0)} pts).`;
      gunToHead = scoreDiff > 0
        ? `Gun to head: Smash accept for ${player1.name}`
        : `Gun to head: Hard pass - keep ${player2.name}`;
    } else {
      winner = scoreDiff > 0 ? 'player1' : 'player2';
      action = scoreDiff > 0 ? 'ACCEPT' : 'REJECT';
      summary = scoreDiff > 0
        ? `Smash accept. ${player1.name} is significantly better (+${absMargin.toFixed(0)} pts).`
        : `Easy reject. You're getting fleeced (-${absMargin.toFixed(0)} pts).`;
      gunToHead = scoreDiff > 0
        ? `Gun to head: Accept immediately before they change their mind`
        : `Gun to head: Reject and block their number`;
    }

    // Calculate confidence based on data quality
    let confidence = 70;
    if (val1.factors.neutral.some(f => f.includes('No') || f.includes('Limited'))) confidence -= 10;
    if (val2.factors.neutral.some(f => f.includes('No') || f.includes('Limited'))) confidence -= 10;
    if (absMargin > 20) confidence += 10;
    confidence = Math.max(40, Math.min(95, confidence));

    const response: TradeAnalysis = {
      player1: {
        dynasty: dynasty1,
        redraft: redraft1,
      },
      player2: {
        dynasty: dynasty2,
        redraft: redraft2,
      },
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
