// Team and player situation data for dynasty/redraft analysis
// Source: Various reports (January 2025)

// QB SITUATION BY TEAM
export interface QBSituation {
  starter: string;
  stability: 'elite' | 'locked' | 'competition' | 'uncertain' | 'disaster';
  description: string;
  backupThreat?: string;
}

export const QB_SITUATIONS: Record<string, QBSituation> = {
  'ARI': { starter: 'Kyler Murray', stability: 'locked', description: 'Healthy and locked in' },
  'ATL': { starter: 'Kirk Cousins', stability: 'uncertain', description: 'Age concern, Penix waiting', backupThreat: 'Michael Penix Jr.' },
  'BAL': { starter: 'Lamar Jackson', stability: 'elite', description: 'MVP-caliber, elite rushing' },
  'BUF': { starter: 'Josh Allen', stability: 'elite', description: 'Perennial MVP candidate' },
  'CAR': { starter: 'Bryce Young', stability: 'uncertain', description: 'Benched once, job not safe' },
  'CHI': { starter: 'Caleb Williams', stability: 'locked', description: 'Franchise QB, growing pains' },
  'CIN': { starter: 'Joe Burrow', stability: 'elite', description: 'Elite when healthy' },
  'CLE': { starter: 'Deshaun Watson', stability: 'disaster', description: 'Season-ending injury, future unclear' },
  'DAL': { starter: 'Dak Prescott', stability: 'locked', description: 'Injury concern but locked in' },
  'DEN': { starter: 'Bo Nix', stability: 'locked', description: 'Rookie starter, developing' },
  'DET': { starter: 'Jared Goff', stability: 'locked', description: 'System fit, efficient' },
  'GB': { starter: 'Jordan Love', stability: 'locked', description: 'Franchise QB, big extension' },
  'HOU': { starter: 'C.J. Stroud', stability: 'elite', description: 'Star on the rise' },
  'IND': { starter: 'Anthony Richardson', stability: 'uncertain', description: 'Injury prone, benched once', backupThreat: 'Joe Flacco' },
  'JAX': { starter: 'Trevor Lawrence', stability: 'locked', description: 'Franchise QB, paid' },
  'KC': { starter: 'Patrick Mahomes', stability: 'elite', description: 'Best in the league' },
  'LAC': { starter: 'Justin Herbert', stability: 'elite', description: 'Elite arm, new system' },
  'LAR': { starter: 'Matthew Stafford', stability: 'uncertain', description: 'Age 37, retirement possible' },
  'LV': { starter: 'Aidan O\'Connell', stability: 'competition', description: 'No clear answer', backupThreat: 'Gardner Minshew' },
  'MIA': { starter: 'Tua Tagovailoa', stability: 'uncertain', description: 'Concussion history concern' },
  'MIN': { starter: 'Sam Darnold', stability: 'uncertain', description: 'Free agent 2025, J.J. McCarthy waiting', backupThreat: 'J.J. McCarthy' },
  'NE': { starter: 'Drake Maye', stability: 'locked', description: 'Franchise QB, developing' },
  'NO': { starter: 'Derek Carr', stability: 'uncertain', description: 'Could be cut, $51M dead cap concern' },
  'NYG': { starter: 'Tommy DeVito', stability: 'disaster', description: 'Looking for answer in draft' },
  'NYJ': { starter: 'Aaron Rodgers', stability: 'uncertain', description: 'Age 41, final year?' },
  'PHI': { starter: 'Jalen Hurts', stability: 'elite', description: 'Dual-threat star' },
  'PIT': { starter: 'Russell Wilson', stability: 'uncertain', description: 'Free agent 2025', backupThreat: 'Justin Fields' },
  'SEA': { starter: 'Geno Smith', stability: 'uncertain', description: 'Could be replaced in draft' },
  'SF': { starter: 'Brock Purdy', stability: 'locked', description: 'System QB, due extension' },
  'TB': { starter: 'Baker Mayfield', stability: 'locked', description: 'Proved himself, extended' },
  'TEN': { starter: 'Will Levis', stability: 'competition', description: 'On thin ice', backupThreat: '2025 Draft Pick' },
  'WAS': { starter: 'Jayden Daniels', stability: 'elite', description: 'ROTY frontrunner' },
};

// BACKFIELD/RECEIVING COMPETITION
export interface CompetitionInfo {
  role: 'bellcow' | 'lead' | 'committee' | 'backup' | 'crowded';
  competitors: string[];
  description: string;
  touchShare?: number; // estimated % of team touches
}

export const BACKFIELD_COMPETITION: Record<string, CompetitionInfo> = {
  // RBs with clear roles
  'Saquon Barkley': { role: 'bellcow', competitors: ['Kenneth Gainwell'], description: 'Workhorse role', touchShare: 80 },
  'Derrick Henry': { role: 'bellcow', competitors: ['Justice Hill'], description: 'Volume king', touchShare: 75 },
  'Bijan Robinson': { role: 'lead', competitors: ['Tyler Allgeier'], description: 'Lead back but committee', touchShare: 65 },
  'Breece Hall': { role: 'lead', competitors: ['Braelon Allen'], description: 'Bell cow when healthy', touchShare: 70 },
  'Jonathan Taylor': { role: 'bellcow', competitors: ['Trey Sermon'], description: 'Clear lead back', touchShare: 75 },
  'Josh Jacobs': { role: 'bellcow', competitors: ['Emanuel Wilson'], description: 'Workhorse role', touchShare: 75 },
  'Jahmyr Gibbs': { role: 'committee', competitors: ['David Montgomery'], description: 'Elite but split backfield', touchShare: 55 },
  'David Montgomery': { role: 'committee', competitors: ['Jahmyr Gibbs'], description: 'Goal line, but shared', touchShare: 45 },
  'De\'Von Achane': { role: 'lead', competitors: ['Raheem Mostert', 'Jeff Wilson'], description: 'Lead role emerging', touchShare: 60 },
  'Kyren Williams': { role: 'lead', competitors: ['Blake Corum'], description: 'Lead but Corum emerging', touchShare: 65 },
  'James Cook': { role: 'lead', competitors: ['Ray Davis'], description: 'Primary back', touchShare: 65 },
  'Kenneth Walker III': { role: 'lead', competitors: ['Zach Charbonnet'], description: 'Lead when healthy', touchShare: 60 },
  'Travis Etienne': { role: 'lead', competitors: ['Tank Bigsby'], description: 'Split carries', touchShare: 55 },
  'Tank Bigsby': { role: 'committee', competitors: ['Travis Etienne'], description: 'Vulturing TDs', touchShare: 45 },
  'Rachaad White': { role: 'committee', competitors: ['Bucky Irving'], description: 'Losing work to Irving', touchShare: 45 },
  'Bucky Irving': { role: 'committee', competitors: ['Rachaad White'], description: 'Taking over', touchShare: 55 },
  'Joe Mixon': { role: 'bellcow', competitors: ['Dare Ogunbowale'], description: 'Heavy volume', touchShare: 80 },
  'Alvin Kamara': { role: 'lead', competitors: ['Jamaal Williams'], description: 'Versatile but aging', touchShare: 70 },
  'Aaron Jones': { role: 'lead', competitors: ['Roschon Johnson'], description: 'Lead but older', touchShare: 60 },
  'Tony Pollard': { role: 'lead', competitors: ['Tyjae Spears'], description: 'Lead role', touchShare: 65 },
  'Tyjae Spears': { role: 'committee', competitors: ['Tony Pollard'], description: 'Change of pace', touchShare: 35 },
  'Chuba Hubbard': { role: 'lead', competitors: ['Jonathon Brooks'], description: 'Lead until Brooks healthy', touchShare: 65 },
  'Jonathon Brooks': { role: 'backup', competitors: ['Chuba Hubbard'], description: 'Injured, future lead?', touchShare: 0 },
  'Isiah Pacheco': { role: 'lead', competitors: ['Kareem Hunt'], description: 'Lead when healthy', touchShare: 60 },
  'Kareem Hunt': { role: 'committee', competitors: ['Isiah Pacheco'], description: 'Fills in, vultures TDs', touchShare: 40 },
  'Najee Harris': { role: 'lead', competitors: ['Jaylen Warren'], description: 'Lead back role', touchShare: 60 },
  'Jaylen Warren': { role: 'committee', competitors: ['Najee Harris'], description: 'Pass game back', touchShare: 40 },
};

// WR TARGET COMPETITION
export const TARGET_COMPETITION: Record<string, CompetitionInfo> = {
  // Clear alpha WRs
  'CeeDee Lamb': { role: 'bellcow', competitors: ['Brandin Cooks', 'Jalen Tolbert'], description: 'Target hog', touchShare: 35 },
  'Justin Jefferson': { role: 'bellcow', competitors: ['Jordan Addison'], description: 'Alpha WR', touchShare: 30 },
  "Ja'Marr Chase": { role: 'lead', competitors: ['Tee Higgins'], description: 'WR1 with elite WR2', touchShare: 28 },
  'Tee Higgins': { role: 'lead', competitors: ["Ja'Marr Chase"], description: 'Strong WR2, free agent', touchShare: 24 },
  "Amon-Ra St. Brown": { role: 'bellcow', competitors: ['Jameson Williams'], description: 'Target machine', touchShare: 30 },
  'Tyreek Hill': { role: 'lead', competitors: ['Jaylen Waddle'], description: 'WR1 but Waddle eats', touchShare: 26 },
  'Jaylen Waddle': { role: 'lead', competitors: ['Tyreek Hill'], description: 'Clear WR2', touchShare: 22 },
  'A.J. Brown': { role: 'lead', competitors: ['DeVonta Smith'], description: 'Elite duo', touchShare: 26 },
  'DeVonta Smith': { role: 'lead', competitors: ['A.J. Brown'], description: 'Strong WR2', touchShare: 24 },
  'Garrett Wilson': { role: 'bellcow', competitors: ['Davante Adams', 'Allen Lazard'], description: 'Target leader despite Adams trade', touchShare: 28 },
  'Davante Adams': { role: 'lead', competitors: ['Garrett Wilson'], description: 'New team, sharing targets', touchShare: 24 },
  'Malik Nabers': { role: 'bellcow', competitors: ['Darius Slayton', 'Wan\'Dale Robinson'], description: 'Clear alpha', touchShare: 32 },
  'Marvin Harrison Jr.': { role: 'bellcow', competitors: ['Michael Wilson', 'Trey McBride'], description: 'Alpha with TE competition', touchShare: 28 },
  'Chris Olave': { role: 'bellcow', competitors: ['Rashid Shaheed'], description: 'Clear WR1', touchShare: 30 },
  'Drake London': { role: 'lead', competitors: ['Darnell Mooney', 'Kyle Pitts'], description: 'Crowded passing game', touchShare: 25 },
  'Puka Nacua': { role: 'bellcow', competitors: ['Cooper Kupp'], description: 'Target leader', touchShare: 28 },
  'Cooper Kupp': { role: 'lead', competitors: ['Puka Nacua'], description: 'Still productive WR2', touchShare: 24 },
  'Nico Collins': { role: 'bellcow', competitors: ['Tank Dell', 'John Metchie'], description: 'Clear alpha WR1', touchShare: 30 },
  'Tank Dell': { role: 'lead', competitors: ['Nico Collins', 'John Metchie'], description: 'Strong WR2', touchShare: 24 },
  'Stefon Diggs': { role: 'lead', competitors: ['DeMario Douglas', 'Kendrick Bourne'], description: 'WR1 in NE with Maye', touchShare: 28 },
  'Terry McLaurin': { role: 'bellcow', competitors: ['Dyami Brown'], description: 'Clear target leader', touchShare: 28 },
  'Brian Thomas Jr.': { role: 'lead', competitors: ['Christian Kirk'], description: 'Emerging alpha', touchShare: 26 },
  'Ladd McConkey': { role: 'lead', competitors: ['Quentin Johnston', 'Joshua Palmer'], description: 'Slot role secured', touchShare: 24 },
  'Rome Odunze': { role: 'committee', competitors: ['DJ Moore', 'Keenan Allen'], description: 'Crowded WR room', touchShare: 18 },
  'DJ Moore': { role: 'lead', competitors: ['Keenan Allen', 'Rome Odunze'], description: 'WR1 but shared', touchShare: 24 },
  'Keenan Allen': { role: 'committee', competitors: ['DJ Moore', 'Rome Odunze'], description: 'Veteran WR2/3', touchShare: 20 },
  'Mike Evans': { role: 'bellcow', competitors: ['Chris Godwin'], description: 'Alpha when healthy', touchShare: 28 },
  'Chris Godwin': { role: 'lead', competitors: ['Mike Evans'], description: 'Strong WR2, PPR monster', touchShare: 26 },
  'DK Metcalf': { role: 'lead', competitors: ['Tyler Lockett', 'Jaxon Smith-Njigba'], description: 'Shared targets', touchShare: 24 },
  'Jaxon Smith-Njigba': { role: 'committee', competitors: ['DK Metcalf', 'Tyler Lockett'], description: 'Slot role developing', touchShare: 22 },
};

// COACHING CHANGES (2025 offseason)
export interface CoachingChange {
  type: 'HC' | 'OC' | 'DC' | 'stable';
  description: string;
  schemeChange: boolean;
  impact: 'positive' | 'negative' | 'neutral' | 'unknown';
}

export const COACHING_CHANGES: Record<string, CoachingChange> = {
  // Teams with notable changes (2024-2025)
  'CHI': { type: 'stable', description: 'Stability after rough season', schemeChange: false, impact: 'neutral' },
  'TEN': { type: 'HC', description: 'Brian Callahan new HC, passing scheme', schemeChange: true, impact: 'unknown' },
  'LAC': { type: 'HC', description: 'Jim Harbaugh, run-heavy expected', schemeChange: true, impact: 'negative' }, // Negative for pass catchers
  'NE': { type: 'stable', description: 'Consistency for Maye development', schemeChange: false, impact: 'positive' },
  'LV': { type: 'HC', description: 'Antonio Pierce second year', schemeChange: false, impact: 'neutral' },
  'WAS': { type: 'HC', description: 'Dan Quinn first year success', schemeChange: false, impact: 'positive' },
  'ATL': { type: 'OC', description: 'Zac Robinson OC, Penix threat', schemeChange: false, impact: 'neutral' },
  'CAR': { type: 'HC', description: 'Dave Canales rebuild', schemeChange: true, impact: 'unknown' },
  'SEA': { type: 'OC', description: 'Ryan Grubb new OC from UW', schemeChange: true, impact: 'unknown' },
  // Most teams stable
  'KC': { type: 'stable', description: 'Reid system locked in', schemeChange: false, impact: 'positive' },
  'SF': { type: 'stable', description: 'Shanahan scheme', schemeChange: false, impact: 'positive' },
  'DET': { type: 'stable', description: 'Ben Johnson staying (for now)', schemeChange: false, impact: 'positive' },
  'PHI': { type: 'stable', description: 'Kellen Moore OC', schemeChange: false, impact: 'positive' },
  'BAL': { type: 'stable', description: 'Todd Monken scheme', schemeChange: false, impact: 'positive' },
  'CIN': { type: 'stable', description: 'Consistent', schemeChange: false, impact: 'positive' },
  'BUF': { type: 'stable', description: 'Dorsey system', schemeChange: false, impact: 'positive' },
  'MIA': { type: 'stable', description: 'McDaniel scheme', schemeChange: false, impact: 'positive' },
  'HOU': { type: 'stable', description: 'Bobby Slowik success', schemeChange: false, impact: 'positive' },
  'GB': { type: 'stable', description: 'LaFleur system', schemeChange: false, impact: 'positive' },
  'DAL': { type: 'OC', description: 'Brian Schottenheimer promoted', schemeChange: false, impact: 'neutral' },
  'NYJ': { type: 'HC', description: 'Jeff Ulbrich interim, likely new HC', schemeChange: true, impact: 'unknown' },
  'NYG': { type: 'HC', description: 'Brian Daboll hot seat', schemeChange: false, impact: 'negative' },
  'CLE': { type: 'stable', description: 'Kevin Stefanski, but QB disaster', schemeChange: false, impact: 'negative' },
  'MIN': { type: 'stable', description: 'Kevin O\'Connell success', schemeChange: false, impact: 'positive' },
};

// DRAFT CAPITAL DATA
export interface DraftCapital {
  round: number;
  pick: number;
  year: number;
  team: string;
}

export const DRAFT_CAPITAL: Record<string, DraftCapital> = {
  // 2024 Class
  'Caleb Williams': { round: 1, pick: 1, year: 2024, team: 'CHI' },
  'Jayden Daniels': { round: 1, pick: 2, year: 2024, team: 'WAS' },
  'Drake Maye': { round: 1, pick: 3, year: 2024, team: 'NE' },
  'Marvin Harrison Jr.': { round: 1, pick: 4, year: 2024, team: 'ARI' },
  'Malik Nabers': { round: 1, pick: 6, year: 2024, team: 'NYG' },
  'Rome Odunze': { round: 1, pick: 9, year: 2024, team: 'CHI' },
  'Brock Bowers': { round: 1, pick: 13, year: 2024, team: 'LV' },
  'Brian Thomas Jr.': { round: 1, pick: 23, year: 2024, team: 'JAX' },
  'Ladd McConkey': { round: 2, pick: 34, year: 2024, team: 'LAC' },
  'Jonathon Brooks': { round: 2, pick: 46, year: 2024, team: 'CAR' },

  // 2023 Class
  'C.J. Stroud': { round: 1, pick: 2, year: 2023, team: 'HOU' },
  'Bryce Young': { round: 1, pick: 1, year: 2023, team: 'CAR' },
  'Anthony Richardson': { round: 1, pick: 4, year: 2023, team: 'IND' },
  'Bijan Robinson': { round: 1, pick: 8, year: 2023, team: 'ATL' },
  'Jahmyr Gibbs': { round: 1, pick: 12, year: 2023, team: 'DET' },
  'Quentin Johnston': { round: 1, pick: 21, year: 2023, team: 'LAC' },
  'Zay Flowers': { round: 1, pick: 22, year: 2023, team: 'BAL' },
  'Puka Nacua': { round: 5, pick: 177, year: 2023, team: 'LAR' },
  'De\'Von Achane': { round: 3, pick: 84, year: 2023, team: 'MIA' },
  'Sam LaPorta': { round: 2, pick: 34, year: 2023, team: 'DET' },

  // 2022 Class
  'Garrett Wilson': { round: 1, pick: 10, year: 2022, team: 'NYJ' },
  'Chris Olave': { round: 1, pick: 11, year: 2022, team: 'NO' },
  'Jameson Williams': { round: 1, pick: 12, year: 2022, team: 'DET' },
  'Drake London': { round: 1, pick: 8, year: 2022, team: 'ATL' },
  'Treylon Burks': { round: 1, pick: 18, year: 2022, team: 'TEN' },
  'Breece Hall': { round: 2, pick: 36, year: 2022, team: 'NYJ' },
  'Kenneth Walker III': { round: 2, pick: 41, year: 2022, team: 'SEA' },

  // 2021 Class
  'Trevor Lawrence': { round: 1, pick: 1, year: 2021, team: 'JAX' },
  'Justin Fields': { round: 1, pick: 11, year: 2021, team: 'CHI' },
  "Ja'Marr Chase": { round: 1, pick: 5, year: 2021, team: 'CIN' },
  'Jaylen Waddle': { round: 1, pick: 6, year: 2021, team: 'MIA' },
  'DeVonta Smith': { round: 1, pick: 10, year: 2021, team: 'PHI' },
  'Kyle Pitts': { round: 1, pick: 4, year: 2021, team: 'ATL' },
  'Najee Harris': { round: 1, pick: 24, year: 2021, team: 'PIT' },
  'Javonte Williams': { round: 2, pick: 35, year: 2021, team: 'DEN' },
  'Elijah Moore': { round: 2, pick: 34, year: 2021, team: 'NYJ' },
  'Amon-Ra St. Brown': { round: 4, pick: 112, year: 2021, team: 'DET' },

  // Earlier classes
  'Justin Jefferson': { round: 1, pick: 22, year: 2020, team: 'MIN' },
  'CeeDee Lamb': { round: 1, pick: 17, year: 2020, team: 'DAL' },
  'Tee Higgins': { round: 2, pick: 33, year: 2020, team: 'CIN' },
  'Joe Burrow': { round: 1, pick: 1, year: 2020, team: 'CIN' },
  'Jalen Hurts': { round: 2, pick: 53, year: 2020, team: 'PHI' },
  'Jonathan Taylor': { round: 2, pick: 41, year: 2020, team: 'IND' },
  'Kyler Murray': { round: 1, pick: 1, year: 2019, team: 'ARI' },
  'Josh Allen': { round: 1, pick: 7, year: 2018, team: 'BUF' },
  'Lamar Jackson': { round: 1, pick: 32, year: 2018, team: 'BAL' },
  'Patrick Mahomes': { round: 1, pick: 10, year: 2017, team: 'KC' },
};

// Helper functions
export function getQBSituation(team: string): QBSituation | null {
  return QB_SITUATIONS[team] || null;
}

export function getBackfieldCompetition(playerName: string): CompetitionInfo | null {
  return BACKFIELD_COMPETITION[playerName] || null;
}

export function getTargetCompetition(playerName: string): CompetitionInfo | null {
  return TARGET_COMPETITION[playerName] || null;
}

export function getCoachingChange(team: string): CoachingChange | null {
  return COACHING_CHANGES[team] || null;
}

export function getDraftCapital(playerName: string): DraftCapital | null {
  return DRAFT_CAPITAL[playerName] || null;
}

export function getDraftCapitalDescription(capital: DraftCapital): string {
  if (capital.round === 1) {
    if (capital.pick <= 10) return `Top 10 pick (#${capital.pick}) - very long leash`;
    return `1st round pick (#${capital.pick}) - long leash`;
  }
  if (capital.round === 2) return `2nd round pick - moderate leash`;
  if (capital.round === 3) return `3rd round pick - proving ground`;
  if (capital.round >= 4) return `Day 3 pick - must produce to stick`;
  return `Round ${capital.round}, Pick ${capital.pick}`;
}
