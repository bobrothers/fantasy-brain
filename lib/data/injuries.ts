/**
 * Injury History Data
 *
 * Tracks player injury history for dynasty durability analysis.
 * Data compiled from injury reports (2022-2024 seasons).
 *
 * Games per season: 17 regular season
 * 3-year total: 51 games
 */

export type InjuryType =
  | 'soft_tissue' // hamstring, quad, groin, calf - chronic concern
  | 'knee_acl'    // ACL tear - major, long recovery
  | 'knee_other'  // MCL, meniscus, PCL - moderate
  | 'ankle_foot'  // ankle sprains, Lisfranc, plantar - lingering
  | 'concussion'  // cumulative risk
  | 'shoulder'    // AC joint, labrum
  | 'back'        // disc, spine issues
  | 'wrist_hand'  // hand fractures
  | 'ribs'        // rib injuries
  | 'illness'     // non-contact (COVID, flu)
  | 'other';

export interface InjuryRecord {
  season: number;
  type: InjuryType;
  description: string;
  gamesMissed: number;
  isMajor: boolean; // Season-ending or 6+ weeks
}

export interface PlayerInjuryHistory {
  gamesPlayed: {
    2022: number;
    2023: number;
    2024: number;
  };
  injuries: InjuryRecord[];
  majorInjuryDate?: string; // For recovery tracking (YYYY-MM format)
  majorInjuryType?: string; // Description for display
  isCurrentlyInjured?: boolean;
  notes?: string;
}

// 17 games per season, 51 total over 3 years
export const GAMES_PER_SEASON = 17;
export const TOTAL_GAMES_3YR = 51;

export const INJURY_HISTORY: Record<string, PlayerInjuryHistory> = {
  // === IRON MEN (48+ games / 94%+) ===
  'Derrick Henry': {
    gamesPlayed: { 2022: 17, 2023: 17, 2024: 17 },
    injuries: [],
    notes: 'Incredible durability for high-usage RB',
  },
  'Josh Allen': {
    gamesPlayed: { 2022: 17, 2023: 17, 2024: 17 },
    injuries: [],
    notes: 'Iron man despite rushing workload',
  },
  'Patrick Mahomes': {
    gamesPlayed: { 2022: 17, 2023: 17, 2024: 16 },
    injuries: [
      { season: 2024, type: 'ankle_foot', description: 'Ankle sprain', gamesMissed: 1, isMajor: false },
    ],
  },
  'CeeDee Lamb': {
    gamesPlayed: { 2022: 17, 2023: 17, 2024: 16 },
    injuries: [
      { season: 2024, type: 'shoulder', description: 'AC joint sprain', gamesMissed: 1, isMajor: false },
    ],
  },
  "Ja'Marr Chase": {
    gamesPlayed: { 2022: 17, 2023: 17, 2024: 17 },
    injuries: [],
    notes: 'Very durable through 3 seasons',
  },
  'Justin Jefferson': {
    gamesPlayed: { 2022: 17, 2023: 10, 2024: 17 },
    injuries: [
      { season: 2023, type: 'soft_tissue', description: 'Hamstring strain', gamesMissed: 7, isMajor: true },
    ],
  },
  'Tyreek Hill': {
    gamesPlayed: { 2022: 17, 2023: 16, 2024: 17 },
    injuries: [
      { season: 2023, type: 'ankle_foot', description: 'Ankle sprain', gamesMissed: 1, isMajor: false },
    ],
  },
  'Lamar Jackson': {
    gamesPlayed: { 2022: 12, 2023: 16, 2024: 17 },
    injuries: [
      { season: 2022, type: 'knee_other', description: 'PCL sprain', gamesMissed: 5, isMajor: true },
      { season: 2023, type: 'illness', description: 'Illness', gamesMissed: 1, isMajor: false },
    ],
  },

  // === MODERATE CONCERN (38-47 games / 75-93%) ===
  'Saquon Barkley': {
    gamesPlayed: { 2022: 16, 2023: 14, 2024: 16 },
    injuries: [
      { season: 2022, type: 'shoulder', description: 'Shoulder sprain', gamesMissed: 1, isMajor: false },
      { season: 2023, type: 'ankle_foot', description: 'Ankle sprain', gamesMissed: 3, isMajor: false },
      { season: 2024, type: 'ankle_foot', description: 'Ankle sprain', gamesMissed: 1, isMajor: false },
    ],
    notes: 'Multiple ankle issues but plays through',
  },
  'Joe Burrow': {
    gamesPlayed: { 2022: 16, 2023: 10, 2024: 16 },
    injuries: [
      { season: 2022, type: 'wrist_hand', description: 'Calf strain', gamesMissed: 1, isMajor: false },
      { season: 2023, type: 'wrist_hand', description: 'Wrist ligament tear', gamesMissed: 7, isMajor: true },
      { season: 2024, type: 'wrist_hand', description: 'Wrist maintenance', gamesMissed: 1, isMajor: false },
    ],
    notes: 'Wrist concern but played well after recovery',
  },
  'A.J. Brown': {
    gamesPlayed: { 2022: 17, 2023: 13, 2024: 14 },
    injuries: [
      { season: 2023, type: 'knee_other', description: 'Knee contusion', gamesMissed: 4, isMajor: false },
      { season: 2024, type: 'soft_tissue', description: 'Hamstring strain', gamesMissed: 3, isMajor: false },
    ],
  },
  'Breece Hall': {
    gamesPlayed: { 2022: 7, 2023: 15, 2024: 15 },
    injuries: [
      { season: 2022, type: 'knee_acl', description: 'ACL tear', gamesMissed: 10, isMajor: true },
      { season: 2023, type: 'knee_other', description: 'Knee soreness', gamesMissed: 2, isMajor: false },
      { season: 2024, type: 'knee_other', description: 'Knee maintenance', gamesMissed: 2, isMajor: false },
    ],
    majorInjuryDate: '2022-10',
    majorInjuryType: 'ACL tear (Oct 2022)',
    notes: 'Recovered well from ACL but monitor knee long-term',
  },
  'Travis Kelce': {
    gamesPlayed: { 2022: 17, 2023: 15, 2024: 16 },
    injuries: [
      { season: 2023, type: 'back', description: 'Back tightness', gamesMissed: 2, isMajor: false },
      { season: 2024, type: 'knee_other', description: 'Knee sprain', gamesMissed: 1, isMajor: false },
    ],
    notes: 'Age 35 but still very durable',
  },
  'Davante Adams': {
    gamesPlayed: { 2022: 17, 2023: 13, 2024: 14 },
    injuries: [
      { season: 2023, type: 'shoulder', description: 'Shoulder sprain', gamesMissed: 4, isMajor: false },
      { season: 2024, type: 'soft_tissue', description: 'Hamstring strain', gamesMissed: 3, isMajor: false },
    ],
  },

  // === HIGH CONCERN (30-37 games / 59-72%) ===
  'Christian McCaffrey': {
    gamesPlayed: { 2022: 17, 2023: 16, 2024: 4 },
    injuries: [
      { season: 2023, type: 'soft_tissue', description: 'Calf strain', gamesMissed: 1, isMajor: false },
      { season: 2024, type: 'soft_tissue', description: 'Achilles tendinitis', gamesMissed: 8, isMajor: true },
      { season: 2024, type: 'knee_other', description: 'PCL sprain', gamesMissed: 5, isMajor: true },
    ],
    isCurrentlyInjured: true,
    notes: 'Chronic soft tissue issues - major red flag',
  },
  'Jonathan Taylor': {
    gamesPlayed: { 2022: 11, 2023: 10, 2024: 15 },
    injuries: [
      { season: 2022, type: 'ankle_foot', description: 'Ankle sprain', gamesMissed: 6, isMajor: true },
      { season: 2023, type: 'ankle_foot', description: 'Ankle surgery', gamesMissed: 7, isMajor: true },
      { season: 2024, type: 'ankle_foot', description: 'Ankle soreness', gamesMissed: 2, isMajor: false },
    ],
    notes: 'Recurring ankle issues - structural concern',
  },
  'Nick Chubb': {
    gamesPlayed: { 2022: 17, 2023: 2, 2024: 7 },
    injuries: [
      { season: 2023, type: 'knee_acl', description: 'ACL + MCL tear', gamesMissed: 15, isMajor: true },
      { season: 2024, type: 'knee_other', description: 'Knee recovery', gamesMissed: 10, isMajor: true },
    ],
    majorInjuryDate: '2023-09',
    majorInjuryType: 'ACL/MCL tear (Sept 2023)',
    notes: '2nd major knee injury - high risk',
  },
  'Cooper Kupp': {
    gamesPlayed: { 2022: 9, 2023: 12, 2024: 12 },
    injuries: [
      { season: 2022, type: 'ankle_foot', description: 'High ankle sprain', gamesMissed: 8, isMajor: true },
      { season: 2023, type: 'soft_tissue', description: 'Hamstring strain', gamesMissed: 5, isMajor: true },
      { season: 2024, type: 'ankle_foot', description: 'Ankle sprain', gamesMissed: 5, isMajor: false },
    ],
    notes: 'Chronic soft tissue + ankle issues',
  },
  'Javonte Williams': {
    gamesPlayed: { 2022: 4, 2023: 12, 2024: 14 },
    injuries: [
      { season: 2022, type: 'knee_acl', description: 'ACL + LCL + MCL tear', gamesMissed: 13, isMajor: true },
      { season: 2023, type: 'knee_other', description: 'Knee recovery', gamesMissed: 5, isMajor: false },
      { season: 2024, type: 'knee_other', description: 'Knee soreness', gamesMissed: 3, isMajor: false },
    ],
    majorInjuryDate: '2022-09',
    majorInjuryType: 'ACL/LCL/MCL tear (Sept 2022)',
    notes: 'Multi-ligament knee tear - explosiveness concern',
  },
  'Tua Tagovailoa': {
    gamesPlayed: { 2022: 13, 2023: 13, 2024: 13 },
    injuries: [
      { season: 2022, type: 'concussion', description: 'Multiple concussions', gamesMissed: 4, isMajor: true },
      { season: 2023, type: 'concussion', description: 'Concussion', gamesMissed: 4, isMajor: true },
      { season: 2024, type: 'concussion', description: 'Concussion', gamesMissed: 4, isMajor: true },
    ],
    notes: 'SERIOUS concussion history - career risk',
  },
  'Michael Thomas': {
    gamesPlayed: { 2022: 3, 2023: 10, 2024: 8 },
    injuries: [
      { season: 2022, type: 'ankle_foot', description: 'Foot surgery', gamesMissed: 14, isMajor: true },
      { season: 2023, type: 'soft_tissue', description: 'Calf strain', gamesMissed: 7, isMajor: true },
      { season: 2024, type: 'soft_tissue', description: 'Hamstring strain', gamesMissed: 9, isMajor: true },
    ],
    notes: 'Body breaking down - avoid',
  },
  'Mark Andrews': {
    gamesPlayed: { 2022: 15, 2023: 10, 2024: 13 },
    injuries: [
      { season: 2022, type: 'shoulder', description: 'Shoulder sprain', gamesMissed: 2, isMajor: false },
      { season: 2023, type: 'ankle_foot', description: 'Ankle/Achilles injury', gamesMissed: 7, isMajor: true },
      { season: 2024, type: 'ankle_foot', description: 'Ankle recovery', gamesMissed: 4, isMajor: false },
    ],
    notes: 'Serious ankle/Achilles concern at TE',
  },
  'Dalvin Cook': {
    gamesPlayed: { 2022: 11, 2023: 15, 2024: 8 },
    injuries: [
      { season: 2022, type: 'shoulder', description: 'Shoulder sprain', gamesMissed: 6, isMajor: true },
      { season: 2023, type: 'soft_tissue', description: 'Hamstring strain', gamesMissed: 2, isMajor: false },
      { season: 2024, type: 'knee_other', description: 'Knee sprain', gamesMissed: 9, isMajor: true },
    ],
    notes: 'Age + injury history = very high risk',
  },

  // === SEVERE CONCERN (<30 games / <59%) ===
  'Anthony Richardson': {
    gamesPlayed: { 2022: 0, 2023: 4, 2024: 10 },
    injuries: [
      { season: 2023, type: 'shoulder', description: 'Shoulder sprain', gamesMissed: 13, isMajor: true },
      { season: 2024, type: 'shoulder', description: 'Shoulder soreness', gamesMissed: 5, isMajor: false },
      { season: 2024, type: 'other', description: 'Benched', gamesMissed: 2, isMajor: false },
    ],
    notes: 'Shoulder concern + durability questions',
  },
  'Keenan Allen': {
    gamesPlayed: { 2022: 10, 2023: 13, 2024: 13 },
    injuries: [
      { season: 2022, type: 'soft_tissue', description: 'Hamstring strain', gamesMissed: 7, isMajor: true },
      { season: 2023, type: 'soft_tissue', description: 'Heel issue', gamesMissed: 4, isMajor: false },
      { season: 2024, type: 'soft_tissue', description: 'Calf strain', gamesMissed: 4, isMajor: false },
    ],
    notes: 'Chronic soft tissue at age 32',
  },

  // === RECENT ACL/MAJOR INJURY RECOVERIES ===
  'Jahmyr Gibbs': {
    gamesPlayed: { 2022: 0, 2023: 15, 2024: 16 },
    injuries: [
      { season: 2023, type: 'soft_tissue', description: 'Hamstring strain', gamesMissed: 2, isMajor: false },
      { season: 2024, type: 'ankle_foot', description: 'Ankle sprain', gamesMissed: 1, isMajor: false },
    ],
    notes: 'Good durability early in career',
  },
  'Bijan Robinson': {
    gamesPlayed: { 2022: 0, 2023: 16, 2024: 17 },
    injuries: [
      { season: 2023, type: 'soft_tissue', description: 'Hamstring tightness', gamesMissed: 1, isMajor: false },
    ],
    notes: 'Very durable through 2 seasons',
  },
  'Puka Nacua': {
    gamesPlayed: { 2022: 0, 2023: 17, 2024: 11 },
    injuries: [
      { season: 2024, type: 'knee_other', description: 'Knee sprain', gamesMissed: 6, isMajor: true },
    ],
    notes: 'First major injury - monitor',
  },
  'Chris Godwin': {
    gamesPlayed: { 2022: 3, 2023: 15, 2024: 14 },
    injuries: [
      { season: 2022, type: 'knee_acl', description: 'ACL tear', gamesMissed: 14, isMajor: true },
      { season: 2023, type: 'knee_other', description: 'Knee soreness', gamesMissed: 2, isMajor: false },
      { season: 2024, type: 'ankle_foot', description: 'Ankle dislocation', gamesMissed: 3, isMajor: true },
    ],
    majorInjuryDate: '2024-10',
    majorInjuryType: 'Ankle dislocation (Oct 2024)',
    notes: 'New ankle injury is major concern',
  },
  'De\'Von Achane': {
    gamesPlayed: { 2022: 0, 2023: 11, 2024: 13 },
    injuries: [
      { season: 2023, type: 'knee_acl', description: 'Knee sprain', gamesMissed: 4, isMajor: false },
      { season: 2023, type: 'shoulder', description: 'Shoulder sprain', gamesMissed: 2, isMajor: false },
      { season: 2024, type: 'knee_other', description: 'Knee soreness', gamesMissed: 2, isMajor: false },
      { season: 2024, type: 'concussion', description: 'Concussion', gamesMissed: 2, isMajor: false },
    ],
    notes: 'Small frame - durability concern',
  },
  'Kyren Williams': {
    gamesPlayed: { 2022: 6, 2023: 12, 2024: 15 },
    injuries: [
      { season: 2022, type: 'ankle_foot', description: 'Ankle sprain', gamesMissed: 11, isMajor: true },
      { season: 2023, type: 'ankle_foot', description: 'Ankle sprain', gamesMissed: 5, isMajor: false },
      { season: 2024, type: 'ankle_foot', description: 'Ankle soreness', gamesMissed: 2, isMajor: false },
    ],
    notes: 'Chronic ankle issues',
  },
  'DK Metcalf': {
    gamesPlayed: { 2022: 17, 2023: 16, 2024: 14 },
    injuries: [
      { season: 2023, type: 'ribs', description: 'Rib injury', gamesMissed: 1, isMajor: false },
      { season: 2024, type: 'knee_other', description: 'MCL sprain', gamesMissed: 3, isMajor: false },
    ],
    notes: 'Generally durable big body',
  },
  'Kenneth Walker III': {
    gamesPlayed: { 2022: 15, 2023: 15, 2024: 12 },
    injuries: [
      { season: 2022, type: 'ankle_foot', description: 'Ankle sprain', gamesMissed: 2, isMajor: false },
      { season: 2023, type: 'soft_tissue', description: 'Groin strain', gamesMissed: 2, isMajor: false },
      { season: 2024, type: 'soft_tissue', description: 'Calf strain', gamesMissed: 5, isMajor: true },
    ],
    notes: 'Soft tissue concerns emerging',
  },

  // === YOUNG PLAYERS WITH CLEAN BILLS ===
  'Malik Nabers': {
    gamesPlayed: { 2022: 0, 2023: 0, 2024: 14 },
    injuries: [
      { season: 2024, type: 'concussion', description: 'Concussion', gamesMissed: 3, isMajor: false },
    ],
    notes: 'Rookie - monitor concussion history',
  },
  'Marvin Harrison Jr.': {
    gamesPlayed: { 2022: 0, 2023: 0, 2024: 17 },
    injuries: [],
    notes: 'Clean rookie season',
  },
  'Brian Thomas Jr.': {
    gamesPlayed: { 2022: 0, 2023: 0, 2024: 17 },
    injuries: [],
    notes: 'Clean rookie season',
  },
  'Ladd McConkey': {
    gamesPlayed: { 2022: 0, 2023: 0, 2024: 16 },
    injuries: [
      { season: 2024, type: 'knee_other', description: 'Knee soreness', gamesMissed: 1, isMajor: false },
    ],
    notes: 'Durable rookie season',
  },
  'Brock Bowers': {
    gamesPlayed: { 2022: 0, 2023: 0, 2024: 17 },
    injuries: [],
    notes: 'Iron man rookie - excellent sign',
  },
  'Jayden Daniels': {
    gamesPlayed: { 2022: 0, 2023: 0, 2024: 15 },
    injuries: [
      { season: 2024, type: 'ribs', description: 'Rib injury', gamesMissed: 2, isMajor: false },
    ],
    notes: 'Minor rib injury - good durability',
  },
  'Caleb Williams': {
    gamesPlayed: { 2022: 0, 2023: 0, 2024: 17 },
    injuries: [],
    notes: 'Played every game as rookie',
  },

  // === ADDITIONAL NOTABLE PLAYERS ===
  'Amon-Ra St. Brown': {
    gamesPlayed: { 2022: 16, 2023: 16, 2024: 16 },
    injuries: [
      { season: 2022, type: 'concussion', description: 'Concussion', gamesMissed: 1, isMajor: false },
      { season: 2023, type: 'ankle_foot', description: 'Ankle sprain', gamesMissed: 1, isMajor: false },
      { season: 2024, type: 'knee_other', description: 'Knee soreness', gamesMissed: 1, isMajor: false },
    ],
    notes: 'Minor injuries only - very durable',
  },
  'Garrett Wilson': {
    gamesPlayed: { 2022: 17, 2023: 17, 2024: 17 },
    injuries: [],
    notes: 'Iron man - never missed a game',
  },
  'DeVonta Smith': {
    gamesPlayed: { 2022: 17, 2023: 17, 2024: 14 },
    injuries: [
      { season: 2024, type: 'soft_tissue', description: 'Hamstring strain', gamesMissed: 3, isMajor: false },
    ],
    notes: 'First injury concern in 2024',
  },
  'Tee Higgins': {
    gamesPlayed: { 2022: 14, 2023: 12, 2024: 12 },
    injuries: [
      { season: 2022, type: 'soft_tissue', description: 'Hamstring strain', gamesMissed: 3, isMajor: false },
      { season: 2023, type: 'soft_tissue', description: 'Hamstring strain', gamesMissed: 5, isMajor: true },
      { season: 2024, type: 'soft_tissue', description: 'Quad strain', gamesMissed: 5, isMajor: true },
    ],
    notes: 'Chronic soft tissue - recurring hamstrings',
  },
  'Chris Olave': {
    gamesPlayed: { 2022: 15, 2023: 16, 2024: 9 },
    injuries: [
      { season: 2022, type: 'concussion', description: 'Concussion', gamesMissed: 2, isMajor: false },
      { season: 2023, type: 'concussion', description: 'Concussion', gamesMissed: 1, isMajor: false },
      { season: 2024, type: 'concussion', description: 'Multiple concussions', gamesMissed: 8, isMajor: true },
    ],
    notes: 'SERIOUS concussion history - career concern',
  },
  'Drake London': {
    gamesPlayed: { 2022: 17, 2023: 17, 2024: 15 },
    injuries: [
      { season: 2024, type: 'soft_tissue', description: 'Hip flexor', gamesMissed: 2, isMajor: false },
    ],
    notes: 'Generally very durable',
  },
  'Tank Dell': {
    gamesPlayed: { 2022: 0, 2023: 11, 2024: 14 },
    injuries: [
      { season: 2023, type: 'ankle_foot', description: 'Fibula fracture', gamesMissed: 6, isMajor: true },
      { season: 2024, type: 'knee_acl', description: 'Knee injury', gamesMissed: 3, isMajor: false },
    ],
    notes: 'Leg injuries early in career - monitor',
  },
  'Nico Collins': {
    gamesPlayed: { 2022: 16, 2023: 15, 2024: 8 },
    injuries: [
      { season: 2022, type: 'soft_tissue', description: 'Calf strain', gamesMissed: 1, isMajor: false },
      { season: 2023, type: 'soft_tissue', description: 'Hamstring strain', gamesMissed: 2, isMajor: false },
      { season: 2024, type: 'soft_tissue', description: 'Hamstring strain', gamesMissed: 9, isMajor: true },
    ],
    notes: 'Soft tissue issues developing',
  },
  'Jaylen Waddle': {
    gamesPlayed: { 2022: 17, 2023: 15, 2024: 16 },
    injuries: [
      { season: 2023, type: 'soft_tissue', description: 'Hip/groin strain', gamesMissed: 2, isMajor: false },
      { season: 2024, type: 'knee_other', description: 'Knee sprain', gamesMissed: 1, isMajor: false },
    ],
    notes: 'Minor injuries - good durability',
  },
  'George Kittle': {
    gamesPlayed: { 2022: 9, 2023: 16, 2024: 15 },
    injuries: [
      { season: 2022, type: 'soft_tissue', description: 'Groin strain', gamesMissed: 8, isMajor: true },
      { season: 2023, type: 'ribs', description: 'Rib injury', gamesMissed: 1, isMajor: false },
      { season: 2024, type: 'soft_tissue', description: 'Hamstring strain', gamesMissed: 2, isMajor: false },
    ],
    notes: 'History of injuries but productive',
  },
  'Sam LaPorta': {
    gamesPlayed: { 2022: 0, 2023: 17, 2024: 15 },
    injuries: [
      { season: 2024, type: 'shoulder', description: 'Shoulder sprain', gamesMissed: 2, isMajor: false },
    ],
    notes: 'Durable through 2 seasons',
  },
  'Kyle Pitts': {
    gamesPlayed: { 2022: 10, 2023: 17, 2024: 16 },
    injuries: [
      { season: 2022, type: 'knee_other', description: 'MCL tear', gamesMissed: 7, isMajor: true },
      { season: 2024, type: 'soft_tissue', description: 'Hamstring strain', gamesMissed: 1, isMajor: false },
    ],
    notes: 'Recovered well from knee injury',
  },
  'Josh Jacobs': {
    gamesPlayed: { 2022: 17, 2023: 13, 2024: 16 },
    injuries: [
      { season: 2023, type: 'soft_tissue', description: 'Quad strain', gamesMissed: 4, isMajor: false },
      { season: 2024, type: 'ankle_foot', description: 'Ankle sprain', gamesMissed: 1, isMajor: false },
    ],
    notes: 'Good durability for volume back',
  },
  'Joe Mixon': {
    gamesPlayed: { 2022: 14, 2023: 9, 2024: 13 },
    injuries: [
      { season: 2022, type: 'concussion', description: 'Concussion', gamesMissed: 3, isMajor: false },
      { season: 2023, type: 'ankle_foot', description: 'Ankle sprain', gamesMissed: 8, isMajor: true },
      { season: 2024, type: 'ankle_foot', description: 'Ankle sprain', gamesMissed: 4, isMajor: false },
    ],
    notes: 'Recurring ankle issues',
  },
  'Travis Etienne': {
    gamesPlayed: { 2022: 17, 2023: 16, 2024: 10 },
    injuries: [
      { season: 2023, type: 'soft_tissue', description: 'Quad strain', gamesMissed: 1, isMajor: false },
      { season: 2024, type: 'soft_tissue', description: 'Hamstring strain', gamesMissed: 7, isMajor: true },
    ],
    notes: 'Soft tissue concern emerging',
  },
  'Alvin Kamara': {
    gamesPlayed: { 2022: 15, 2023: 13, 2024: 15 },
    injuries: [
      { season: 2022, type: 'ribs', description: 'Rib injury', gamesMissed: 2, isMajor: false },
      { season: 2023, type: 'other', description: 'Suspension', gamesMissed: 3, isMajor: false },
      { season: 2023, type: 'knee_other', description: 'Knee sprain', gamesMissed: 1, isMajor: false },
      { season: 2024, type: 'soft_tissue', description: 'Groin strain', gamesMissed: 2, isMajor: false },
    ],
    notes: 'Age 29 but still relatively durable',
  },
};

// Helper to get injury history
export function getInjuryHistory(playerName: string): PlayerInjuryHistory | null {
  return INJURY_HISTORY[playerName] || null;
}
