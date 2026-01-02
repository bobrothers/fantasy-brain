// Core player type (normalized from Sleeper)
export interface Player {
  id: string;                    // Sleeper player_id
  name: string;
  position: 'QB' | 'RB' | 'WR' | 'TE' | 'K' | 'DEF';
  team: string | null;           // NFL team abbreviation
  status: 'Active' | 'Injured Reserve' | 'Out' | 'Questionable' | 'Doubtful' | 'Inactive';
  injuryStatus?: string;
  age?: number;
  yearsExp?: number;
  college?: string;
}

// League settings from Sleeper
export interface League {
  id: string;
  name: string;
  season: string;
  totalRosters: number;
  scoringSettings: ScoringSettings;
  rosterPositions: string[];
  status: 'pre_draft' | 'drafting' | 'in_season' | 'complete';
}

export interface ScoringSettings {
  // Passing
  passYd: number;        // points per passing yard (usually 0.04)
  passTd: number;        // passing TD
  passInt: number;       // interception (negative)
  pass2pt: number;       // 2pt conversion
  
  // Rushing
  rushYd: number;        // points per rushing yard (usually 0.1)
  rushTd: number;        // rushing TD
  rush2pt: number;
  
  // Receiving
  rec: number;           // reception (0, 0.5, or 1 for PPR)
  recYd: number;         // points per receiving yard
  recTd: number;         // receiving TD
  rec2pt: number;
  
  // Misc
  fumble: number;        // fumble lost (negative)
  fumbleRecTd: number;   // fumble recovery TD
}

export interface Roster {
  odwnerId: string;
  leagueId: string;
  players: string[];      // player IDs
  starters: string[];     // player IDs in starting lineup
  reserve?: string[];     // IR slots
}

export interface Matchup {
  matchupId: number;
  rosterId: number;
  points: number;
  players: string[];
  starters: string[];
  startersPoints: number[];
}

// Edge detection types
export interface EdgeSignal {
  type: EdgeSignalType;
  playerId: string;
  week: number;
  impact: 'positive' | 'negative' | 'neutral';
  magnitude: number;        // -10 to +10 scale
  confidence: number;       // 0-100
  shortDescription: string; // e.g., "Wind 22mph at Soldier Field"
  details: string;          // Full explanation
  source: string;           // Data source
  timestamp: Date;
}

export type EdgeSignalType =
  | 'weather_wind'
  | 'weather_precip'
  | 'weather_cold'
  | 'weather_dome'
  | 'travel_timezone'
  | 'travel_short_week'
  | 'travel_london'
  | 'travel_altitude'
  | 'ol_injury_lt'
  | 'ol_injury_rt'
  | 'ol_injury_c'
  | 'ol_injury_multiple'
  | 'betting_line_move'
  | 'betting_implied_total'
  | 'usage_target_share'
  | 'usage_carry_share'
  | 'usage_trend'
  | 'usage_snaps'
  | 'usage_redzone'
  | 'matchup_defense'
  | 'matchup_def_injury'
  | 'scheme_new_coordinator'
  | 'scheme_pace_change'
  | 'scheme_pass_rate_change'
  | 'home_away_split'
  | 'primetime_performance'
  | 'division_rivalry'
  | 'rest_advantage'
  | 'indoor_outdoor_split';

// Player recommendation output
export interface PlayerRecommendation {
  playerId: string;
  player: Player;
  action: 'start' | 'sit' | 'add' | 'drop' | 'hold';
  startScore: number;         // 0-100
  confidence: number;         // 0-100
  projection: {
    median: number;
    floor: number;
    ceiling: number;
  };
  edgeSignals: EdgeSignal[];
  reasons: string[];          // Why bullets
  risks: string[];            // Risk bullets  
  whatChanges: string[];      // What would change the call
}

// Weekly stats from nflfastR
export interface WeeklyStats {
  playerId: string;
  season: number;
  week: number;
  team: string;
  opponent: string;
  
  // Passing
  passAttempts: number;
  passCompletions: number;
  passYards: number;
  passTds: number;
  passInts: number;
  
  // Rushing
  rushAttempts: number;
  rushYards: number;
  rushTds: number;
  
  // Receiving
  targets: number;
  receptions: number;
  recYards: number;
  recTds: number;
  
  // Advanced
  snapCount?: number;
  snapPct?: number;
  targetShare?: number;
  airYards?: number;
  yardsAfterCatch?: number;
  redZoneTargets?: number;
  redZoneCarries?: number;
}

// Weather data
export interface GameWeather {
  gameId: string;
  stadium: string;
  isDome: boolean;
  temperature: number;        // Fahrenheit
  windSpeed: number;          // mph
  windDirection: string;      // N, NE, E, etc.
  precipitation: number;      // inches
  precipProbability: number;  // 0-100
  conditions: string;         // Clear, Rain, Snow, etc.
}

// Betting data
export interface GameOdds {
  gameId: string;
  homeTeam: string;
  awayTeam: string;
  spread: number;             // negative = home favored
  total: number;              // over/under
  homeMoneyline: number;
  awayMoneyline: number;
  impliedHomeTotal: number;   // derived
  impliedAwayTotal: number;   // derived
  lastUpdate: Date;
}

// Injury status
export interface InjuryReport {
  playerId: string;
  playerName: string;
  team: string;
  position: string;
  status: 'Out' | 'Doubtful' | 'Questionable' | 'Probable' | 'IR';
  injury: string;             // e.g., "Hamstring"
  practiceStatus?: 'DNP' | 'Limited' | 'Full';
  lastUpdate: Date;
}

// Stadium info for weather lookups
export interface Stadium {
  team: string;
  name: string;
  city: string;
  state: string;
  lat: number;
  lng: number;
  isDome: boolean;
  isRetractable: boolean;
  surface: 'Grass' | 'Turf';
  timezone: string;
  elevation: number;          // feet (for Denver altitude)
}
