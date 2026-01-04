/**
 * Draft Assistant Agent
 *
 * Provides real-time draft recommendations by:
 * - Tracking all picks and comparing to ADP
 * - Detecting position runs
 * - Finding value picks
 * - Analyzing roster needs
 * - Using Claude for smart recommendations
 */

import { createTrackedClient, calculateCost } from '../db/costs';
import { getSupabaseServer, isSupabaseConfigured } from '../db/supabase';
import { sleeper } from '../providers/sleeper';

const CLAUDE_MODEL = 'claude-sonnet-4-20250514';

// ADP data (2024 PPR - would normally come from an API)
const ADP_DATA: Record<string, { adp: number; name: string; position: string; team: string }> = {
  // Top 50 ADP for reference
  '4866': { adp: 1, name: 'CeeDee Lamb', position: 'WR', team: 'DAL' },
  '4034': { adp: 2, name: 'Christian McCaffrey', position: 'RB', team: 'SF' },
  '6794': { adp: 3, name: 'Ja\'Marr Chase', position: 'WR', team: 'CIN' },
  '6786': { adp: 4, name: 'Amon-Ra St. Brown', position: 'WR', team: 'DET' },
  '4881': { adp: 5, name: 'Tyreek Hill', position: 'WR', team: 'MIA' },
  '5849': { adp: 6, name: 'Bijan Robinson', position: 'RB', team: 'ATL' },
  '4988': { adp: 7, name: 'Breece Hall', position: 'RB', team: 'NYJ' },
  '5859': { adp: 8, name: 'Puka Nacua', position: 'WR', team: 'LAR' },
  '6770': { adp: 9, name: 'Garrett Wilson', position: 'WR', team: 'NYJ' },
  '5848': { adp: 10, name: 'Jahmyr Gibbs', position: 'RB', team: 'DET' },
  // Add more as needed...
};

interface DraftPick {
  pickNumber: number;
  round: number;
  ownerId: string;
  ownerName: string;
  playerId: string;
  playerName: string;
  position: string;
  team?: string;
  adp?: number;
  pickVsAdp?: number;
}

interface DraftState {
  draftId: string;
  leagueId?: string;
  numTeams: number;
  numRounds: number;
  draftType: 'snake' | 'linear';
  currentPick: number;
  picks: DraftPick[];
  availablePlayers: Map<string, { name: string; position: string; adp: number }>;
  rostersByOwner: Map<string, DraftPick[]>;
  positionRuns: Array<{ position: string; startPick: number; count: number }>;
  valuePicks: DraftPick[];
  reaches: DraftPick[];
}

interface DraftRecommendation {
  topPick: {
    playerId: string;
    playerName: string;
    position: string;
    reasoning: string;
  };
  alternatives: Array<{
    playerId: string;
    playerName: string;
    position: string;
    reasoning: string;
  }>;
  positionalScarcity: string;
  valueAnalysis: string;
  rosterFitAnalysis: string;
  aiReasoning: string;
}

export interface DraftAssistantResult {
  success: boolean;
  recommendation?: DraftRecommendation;
  draftState?: {
    currentPick: number;
    recentPicks: DraftPick[];
    positionRuns: DraftState['positionRuns'];
    valuePicks: DraftPick[];
    reaches: DraftPick[];
  };
  apiCostUsd: number;
  error?: string;
}

/**
 * Initialize or get draft session
 */
async function getOrCreateDraftSession(
  draftId: string,
  options?: { leagueId?: string; numTeams?: number; numRounds?: number; draftType?: 'snake' | 'linear' }
): Promise<DraftState> {
  const state: DraftState = {
    draftId,
    leagueId: options?.leagueId,
    numTeams: options?.numTeams || 12,
    numRounds: options?.numRounds || 15,
    draftType: options?.draftType || 'snake',
    currentPick: 0,
    picks: [],
    availablePlayers: new Map(),
    rostersByOwner: new Map(),
    positionRuns: [],
    valuePicks: [],
    reaches: [],
  };

  // Load existing picks from database
  if (isSupabaseConfigured()) {
    const supabase = getSupabaseServer();

    // Get session
    const { data: session } = await supabase
      .from('draft_sessions')
      .select('*')
      .eq('draft_id', draftId)
      .single();

    if (session) {
      state.numTeams = session.num_teams || state.numTeams;
      state.numRounds = session.num_rounds || state.numRounds;
      state.draftType = session.draft_type || state.draftType;
      state.currentPick = session.current_pick || 0;
      state.positionRuns = session.position_runs || [];
      state.valuePicks = session.value_picks || [];
      state.reaches = session.reaches || [];
    }

    // Get picks
    const { data: picks } = await supabase
      .from('draft_picks')
      .select('*')
      .eq('draft_id', draftId)
      .order('pick_number', { ascending: true });

    if (picks) {
      state.picks = picks.map(p => ({
        pickNumber: p.pick_number,
        round: p.round,
        ownerId: p.owner_id,
        ownerName: p.owner_name,
        playerId: p.player_id,
        playerName: p.player_name,
        position: p.position,
        team: p.team,
        adp: p.adp,
        pickVsAdp: p.pick_vs_adp,
      }));

      state.currentPick = picks.length;

      // Build rosters by owner
      for (const pick of state.picks) {
        const roster = state.rostersByOwner.get(pick.ownerId) || [];
        roster.push(pick);
        state.rostersByOwner.set(pick.ownerId, roster);
      }
    }
  }

  // Initialize available players from ADP data
  const pickedPlayerIds = new Set(state.picks.map(p => p.playerId));
  for (const [id, data] of Object.entries(ADP_DATA)) {
    if (!pickedPlayerIds.has(id)) {
      state.availablePlayers.set(id, {
        name: data.name,
        position: data.position,
        adp: data.adp,
      });
    }
  }

  // Also add players from Sleeper that might not be in ADP
  const players = await sleeper.getAllPlayers();
  for (const [id, player] of players) {
    if (
      !pickedPlayerIds.has(id) &&
      !state.availablePlayers.has(id) &&
      ['QB', 'RB', 'WR', 'TE'].includes(player.position || '')
    ) {
      state.availablePlayers.set(id, {
        name: player.full_name || `${player.first_name} ${player.last_name}`,
        position: player.position || 'Unknown',
        adp: 200, // Default high ADP for unlisted players
      });
    }
  }

  return state;
}

/**
 * Record a draft pick
 */
async function recordPick(
  state: DraftState,
  pick: Omit<DraftPick, 'pickNumber' | 'round' | 'adp' | 'pickVsAdp'>
): Promise<DraftPick> {
  const pickNumber = state.currentPick + 1;
  const round = Math.ceil(pickNumber / state.numTeams);

  // Get ADP info
  const adpInfo = ADP_DATA[pick.playerId];
  const adp = adpInfo?.adp;
  const pickVsAdp = adp ? pickNumber - adp : undefined;

  const fullPick: DraftPick = {
    ...pick,
    pickNumber,
    round,
    adp,
    pickVsAdp,
  };

  // Store in database
  if (isSupabaseConfigured()) {
    const supabase = getSupabaseServer();

    await supabase.from('draft_picks').upsert({
      draft_id: state.draftId,
      pick_number: pickNumber,
      round,
      owner_id: pick.ownerId,
      owner_name: pick.ownerName,
      player_id: pick.playerId,
      player_name: pick.playerName,
      position: pick.position,
      team: pick.team,
      adp,
      pick_vs_adp: pickVsAdp,
    }, {
      onConflict: 'draft_id,pick_number',
    });

    // Update session
    await supabase.from('draft_sessions').upsert({
      draft_id: state.draftId,
      league_id: state.leagueId,
      num_teams: state.numTeams,
      num_rounds: state.numRounds,
      draft_type: state.draftType,
      current_pick: pickNumber,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'draft_id',
    });
  }

  // Update state
  state.picks.push(fullPick);
  state.currentPick = pickNumber;
  state.availablePlayers.delete(pick.playerId);

  const roster = state.rostersByOwner.get(pick.ownerId) || [];
  roster.push(fullPick);
  state.rostersByOwner.set(pick.ownerId, roster);

  // Track value/reaches
  if (pickVsAdp !== undefined) {
    if (pickVsAdp <= -10) {
      state.valuePicks.push(fullPick);
    } else if (pickVsAdp >= 15) {
      state.reaches.push(fullPick);
    }
  }

  // Detect position runs
  detectPositionRuns(state);

  return fullPick;
}

/**
 * Detect position runs in recent picks
 */
function detectPositionRuns(state: DraftState): void {
  if (state.picks.length < 3) return;

  const recent = state.picks.slice(-10);
  const positionCounts: Record<string, number> = {};

  for (const pick of recent) {
    positionCounts[pick.position] = (positionCounts[pick.position] || 0) + 1;
  }

  // A "run" is 4+ of same position in last 10 picks
  for (const [position, count] of Object.entries(positionCounts)) {
    if (count >= 4) {
      // Find where run started
      let startPick = state.picks.length;
      let runCount = 0;
      for (let i = state.picks.length - 1; i >= Math.max(0, state.picks.length - 10); i--) {
        if (state.picks[i].position === position) {
          startPick = state.picks[i].pickNumber;
          runCount++;
        }
      }

      // Check if we already recorded this run
      const existing = state.positionRuns.find(
        r => r.position === position && r.startPick === startPick
      );

      if (!existing && runCount >= 4) {
        state.positionRuns.push({ position, startPick, count: runCount });
      }
    }
  }
}

/**
 * Get recommendation for next pick
 */
async function getRecommendation(
  state: DraftState,
  userPickPosition: number,
  userRoster: DraftPick[]
): Promise<{ recommendation: DraftRecommendation; costUsd: number }> {
  const client = createTrackedClient('agent/draft-assistant');

  // Get best available by position
  const availableByPosition: Record<string, Array<{ id: string; name: string; adp: number }>> = {
    QB: [],
    RB: [],
    WR: [],
    TE: [],
  };

  for (const [id, player] of state.availablePlayers) {
    if (availableByPosition[player.position]) {
      availableByPosition[player.position].push({
        id,
        name: player.name,
        adp: player.adp,
      });
    }
  }

  // Sort by ADP
  for (const pos of Object.keys(availableByPosition)) {
    availableByPosition[pos].sort((a, b) => a.adp - b.adp);
    availableByPosition[pos] = availableByPosition[pos].slice(0, 10); // Top 10 per position
  }

  // Analyze user roster needs
  const rosterNeeds: Record<string, number> = {
    QB: 1,
    RB: 4,
    WR: 4,
    TE: 1,
  };

  for (const pick of userRoster) {
    if (rosterNeeds[pick.position] !== undefined) {
      rosterNeeds[pick.position]--;
    }
  }

  const systemPrompt = `You are an expert fantasy football draft analyst. Your job is to recommend the best pick based on:
- Value (ADP vs pick position)
- Positional scarcity
- Roster needs
- Recent position runs

Be specific with recommendations and explain your reasoning.`;

  const userPrompt = `Recommend a pick for this draft situation:

DRAFT STATE:
- Current Pick: ${state.currentPick + 1}
- Round: ${Math.ceil((state.currentPick + 1) / state.numTeams)}
- Draft Type: ${state.draftType}
- Total Picks Made: ${state.picks.length}

RECENT PICKS (last 5):
${state.picks.slice(-5).map(p => `Pick ${p.pickNumber}: ${p.playerName} (${p.position}) - ${p.ownerName}${p.pickVsAdp ? ` [${p.pickVsAdp > 0 ? '+' : ''}${p.pickVsAdp} vs ADP]` : ''}`).join('\n') || 'No picks yet'}

POSITION RUNS DETECTED:
${state.positionRuns.length > 0 ? state.positionRuns.map(r => `${r.position} run: ${r.count} picks since pick ${r.startPick}`).join('\n') : 'None'}

YOUR CURRENT ROSTER:
${userRoster.length > 0 ? userRoster.map(p => `- ${p.playerName} (${p.position})`).join('\n') : 'Empty'}

ROSTER NEEDS:
${Object.entries(rosterNeeds).filter(([, need]) => need > 0).map(([pos, need]) => `${pos}: Need ${need} more`).join('\n')}

BEST AVAILABLE BY POSITION:
${Object.entries(availableByPosition).map(([pos, players]) =>
  `${pos}: ${players.slice(0, 5).map(p => `${p.name} (ADP ${p.adp})`).join(', ')}`
).join('\n')}

VALUE PICKS SO FAR:
${state.valuePicks.slice(-3).map(p => `${p.playerName} at ${p.pickNumber} (ADP ${p.adp})`).join(', ') || 'None'}

REACHES SO FAR:
${state.reaches.slice(-3).map(p => `${p.playerName} at ${p.pickNumber} (ADP ${p.adp})`).join(', ') || 'None'}

Return a JSON object with your recommendation:
{
  "topPick": {
    "playerId": "player_id",
    "playerName": "Player Name",
    "position": "POS",
    "reasoning": "Why this is the best pick"
  },
  "alternatives": [
    {
      "playerId": "player_id",
      "playerName": "Player Name",
      "position": "POS",
      "reasoning": "When to pick this instead"
    }
  ],
  "positionalScarcity": "Analysis of position scarcity",
  "valueAnalysis": "Current value opportunities",
  "rosterFitAnalysis": "How recommendation fits roster",
  "overallStrategy": "Brief strategy recommendation"
}`;

  const response = await client.createMessage({
    model: CLAUDE_MODEL,
    max_tokens: 1500,
    messages: [{ role: 'user', content: userPrompt }],
    system: systemPrompt,
  });

  const content = response.content[0];
  if (content.type !== 'text') {
    throw new Error('Unexpected response type');
  }

  // Parse JSON
  let jsonStr = content.text;
  const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    jsonStr = jsonMatch[1];
  }

  const parsed = JSON.parse(jsonStr);

  const costUsd = calculateCost(CLAUDE_MODEL, {
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
  });

  const recommendation: DraftRecommendation = {
    topPick: parsed.topPick,
    alternatives: parsed.alternatives || [],
    positionalScarcity: parsed.positionalScarcity,
    valueAnalysis: parsed.valueAnalysis,
    rosterFitAnalysis: parsed.rosterFitAnalysis,
    aiReasoning: parsed.overallStrategy,
  };

  // Store recommendation
  if (isSupabaseConfigured()) {
    const supabase = getSupabaseServer();

    await supabase.from('draft_recommendations').upsert({
      draft_id: state.draftId,
      pick_number: state.currentPick + 1,
      available_players: availableByPosition,
      roster_so_far: userRoster,
      roster_needs: rosterNeeds,
      top_recommendation: recommendation.topPick.playerId,
      top_recommendation_name: recommendation.topPick.playerName,
      alternative_picks: recommendation.alternatives,
      positional_scarcity: recommendation.positionalScarcity,
      value_analysis: recommendation.valueAnalysis,
      roster_fit_analysis: recommendation.rosterFitAnalysis,
      ai_reasoning: recommendation.aiReasoning,
      ai_analysis: recommendation,
      api_cost_usd: costUsd,
    }, {
      onConflict: 'draft_id,pick_number',
    });
  }

  return { recommendation, costUsd };
}

/**
 * Run the Draft Assistant Agent
 */
export async function runDraftAssistant(options: {
  draftId: string;
  leagueId?: string;
  userPickPosition: number;
  pickToRecord?: {
    ownerId: string;
    ownerName: string;
    playerId: string;
    playerName: string;
    position: string;
    team?: string;
  };
  numTeams?: number;
  numRounds?: number;
  draftType?: 'snake' | 'linear';
}): Promise<DraftAssistantResult> {
  console.log(`[DraftAssistant] Processing draft ${options.draftId}`);

  try {
    // Get or create draft state
    const state = await getOrCreateDraftSession(options.draftId, {
      leagueId: options.leagueId,
      numTeams: options.numTeams,
      numRounds: options.numRounds,
      draftType: options.draftType,
    });

    // Record pick if provided
    if (options.pickToRecord) {
      await recordPick(state, options.pickToRecord);
      console.log(`[DraftAssistant] Recorded pick ${state.currentPick}: ${options.pickToRecord.playerName}`);
    }

    // Get user's roster so far
    const userRoster = state.rostersByOwner.get(String(options.userPickPosition)) || [];

    // Get recommendation
    const { recommendation, costUsd } = await getRecommendation(
      state,
      options.userPickPosition,
      userRoster
    );

    return {
      success: true,
      recommendation,
      draftState: {
        currentPick: state.currentPick,
        recentPicks: state.picks.slice(-10),
        positionRuns: state.positionRuns,
        valuePicks: state.valuePicks.slice(-5),
        reaches: state.reaches.slice(-5),
      },
      apiCostUsd: costUsd,
    };
  } catch (error) {
    console.error('[DraftAssistant] Agent error:', error);
    return {
      success: false,
      apiCostUsd: 0,
      error: String(error),
    };
  }
}

/**
 * Get draft session state
 */
export async function getDraftState(draftId: string) {
  if (!isSupabaseConfigured()) return null;

  const supabase = getSupabaseServer();

  const { data: session } = await supabase
    .from('draft_sessions')
    .select('*')
    .eq('draft_id', draftId)
    .single();

  const { data: picks } = await supabase
    .from('draft_picks')
    .select('*')
    .eq('draft_id', draftId)
    .order('pick_number', { ascending: true });

  return {
    session,
    picks: picks || [],
  };
}
