/**
 * Fuzzy Player Name Matcher
 *
 * Matches extracted player names from screenshots to our database.
 * Handles nicknames, abbreviations, and common misspellings.
 */

import { sleeper } from './providers/sleeper';

// Common nicknames and abbreviations
const PLAYER_ALIASES: Record<string, string> = {
  // RBs
  'cmc': 'Christian McCaffrey',
  'cmac': 'Christian McCaffrey',
  'saquon': 'Saquon Barkley',
  'chubb': 'Nick Chubb',
  'jt': 'Jonathan Taylor',
  'j taylor': 'Jonathan Taylor',
  'breece': 'Breece Hall',
  'bijan': 'Bijan Robinson',
  'gibbs': 'Jahmyr Gibbs',
  'ekeler': 'Austin Ekeler',
  'swift': "D'Andre Swift",
  'pacheco': 'Isiah Pacheco',
  'etienne': 'Travis Etienne',
  'pollard': 'Tony Pollard',
  'jacobs': 'Josh Jacobs',
  'mixon': 'Joe Mixon',
  'henry': 'Derrick Henry',
  'cook': 'Dalvin Cook',
  'kamara': 'Alvin Kamara',
  'aaron jones': 'Aaron Jones',
  'ajones': 'Aaron Jones',
  'rachaad white': 'Rachaad White',
  'rwhite': 'Rachaad White',
  'javonte': 'Javonte Williams',
  'ken walker': 'Kenneth Walker III',
  'kw3': 'Kenneth Walker III',
  'walker iii': 'Kenneth Walker III',
  'najee': 'Najee Harris',
  'rhamondre': 'Rhamondre Stevenson',

  // WRs
  'jamarr': "Ja'Marr Chase",
  'ja\'marr': "Ja'Marr Chase",
  'chase': "Ja'Marr Chase",
  'tyreek': 'Tyreek Hill',
  'cheetah': 'Tyreek Hill',
  'davante': 'Davante Adams',
  'ceedee': 'CeeDee Lamb',
  'cd lamb': 'CeeDee Lamb',
  'lamb': 'CeeDee Lamb',
  'amon-ra': 'Amon-Ra St. Brown',
  'amonra': 'Amon-Ra St. Brown',
  'arsb': 'Amon-Ra St. Brown',
  'sun god': 'Amon-Ra St. Brown',
  'st brown': 'Amon-Ra St. Brown',
  'ajb': 'A.J. Brown',
  'aj brown': 'A.J. Brown',
  'jefferson': 'Justin Jefferson',
  'jjetas': 'Justin Jefferson',
  'deebo': 'Deebo Samuel',
  'dk': 'DK Metcalf',
  'metcalf': 'DK Metcalf',
  'diggs': 'Stefon Diggs',
  'higgins': 'Tee Higgins',
  'waddle': 'Jaylen Waddle',
  'olave': 'Chris Olave',
  'wilson': 'Garrett Wilson',
  'g wilson': 'Garrett Wilson',
  'devonta': "DeVonta Smith",
  'd smith': "DeVonta Smith",
  'aiyuk': 'Brandon Aiyuk',
  'djm': 'DJ Moore',
  'dj moore': 'DJ Moore',
  'kupp': 'Cooper Kupp',
  'godwin': 'Chris Godwin',
  'evans': 'Mike Evans',
  'keenan': 'Keenan Allen',
  'amari': 'Amari Cooper',
  'terry': 'Terry McLaurin',
  'mclaurin': 'Terry McLaurin',
  'scary terry': 'Terry McLaurin',
  'lockett': 'Tyler Lockett',
  'mike williams': 'Mike Williams',
  'london': 'Drake London',
  'pittman': 'Michael Pittman Jr.',
  'pittman jr': 'Michael Pittman Jr.',
  'jeudy': 'Jerry Jeudy',
  'bateman': 'Rashod Bateman',
  'dotson': 'Jahan Dotson',
  'jsn': 'Jaxon Smith-Njigba',
  'smith-njigba': 'Jaxon Smith-Njigba',
  'pickens': 'George Pickens',
  'addison': 'Jordan Addison',
  'flowers': 'Zay Flowers',
  'dell': 'Tank Dell',
  'tank': 'Tank Dell',
  'rice': 'Rashee Rice',
  'nabers': 'Malik Nabers',

  // QBs
  'mahomes': 'Patrick Mahomes',
  'pat mahomes': 'Patrick Mahomes',
  'allen': 'Josh Allen',
  'jallen': 'Josh Allen',
  'lamar': 'Lamar Jackson',
  'burrow': 'Joe Burrow',
  'joey b': 'Joe Burrow',
  'herbert': 'Justin Herbert',
  'hurts': 'Jalen Hurts',
  'stroud': 'C.J. Stroud',
  'cj stroud': 'C.J. Stroud',
  'lawrence': 'Trevor Lawrence',
  't law': 'Trevor Lawrence',
  'tlaw': 'Trevor Lawrence',
  'dak': 'Dak Prescott',
  'prescott': 'Dak Prescott',
  'fields': 'Justin Fields',
  'tua': 'Tua Tagovailoa',
  'goff': 'Jared Goff',
  'kyler': 'Kyler Murray',
  'cousins': 'Kirk Cousins',
  'stafford': 'Matthew Stafford',
  'rodgers': 'Aaron Rodgers',
  'a-rod': 'Aaron Rodgers',
  'russ': 'Russell Wilson',
  'wilson qb': 'Russell Wilson',
  'geno': 'Geno Smith',
  'brock purdy': 'Brock Purdy',
  'purdy': 'Brock Purdy',
  'richardson': 'Anthony Richardson',
  'ar': 'Anthony Richardson',
  'daniels': 'Jayden Daniels',
  'caleb': 'Caleb Williams',
  'caleb williams': 'Caleb Williams',
  'drake maye': 'Drake Maye',
  'maye': 'Drake Maye',
  'bo nix': 'Bo Nix',

  // TEs
  'kelce': 'Travis Kelce',
  'kittle': 'George Kittle',
  'andrews': 'Mark Andrews',
  'mandrews': 'Mark Andrews',
  'goedert': 'Dallas Goedert',
  'hockenson': 'T.J. Hockenson',
  'tj hock': 'T.J. Hockenson',
  'pitts': 'Kyle Pitts',
  'waller': 'Darren Waller',
  'njoku': 'David Njoku',
  'freiermuth': 'Pat Freiermuth',
  'muth': 'Pat Freiermuth',
  'kmet': 'Cole Kmet',
  'ertz': 'Zach Ertz',
  'schultz': 'Dalton Schultz',
  'engram': 'Evan Engram',
  'mcbride': 'Trey McBride',
  'laporta': 'Sam LaPorta',
  'la porta': 'Sam LaPorta',
  'bowers': 'Brock Bowers',
};

// Normalize a name for comparison
function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[''`]/g, "'")
    .replace(/[^a-z0-9'\s-]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Calculate similarity between two strings (Levenshtein-based)
function similarity(s1: string, s2: string): number {
  const longer = s1.length > s2.length ? s1 : s2;
  const shorter = s1.length > s2.length ? s2 : s1;

  if (longer.length === 0) return 1.0;

  const editDistance = levenshtein(longer, shorter);
  return (longer.length - editDistance) / longer.length;
}

function levenshtein(s1: string, s2: string): number {
  const costs: number[] = [];
  for (let i = 0; i <= s1.length; i++) {
    let lastValue = i;
    for (let j = 0; j <= s2.length; j++) {
      if (i === 0) {
        costs[j] = j;
      } else if (j > 0) {
        let newValue = costs[j - 1];
        if (s1.charAt(i - 1) !== s2.charAt(j - 1)) {
          newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
        }
        costs[j - 1] = lastValue;
        lastValue = newValue;
      }
    }
    if (i > 0) costs[s2.length] = lastValue;
  }
  return costs[s2.length];
}

export interface MatchResult {
  extractedName: string;
  matchedName: string | null;
  matchedId: string | null;
  confidence: number;
  matchType: 'exact' | 'alias' | 'fuzzy' | 'not_found';
}

/**
 * Match extracted player names to our database
 */
export async function matchPlayerNames(extractedNames: string[]): Promise<MatchResult[]> {
  const results: MatchResult[] = [];

  // Get all players from Sleeper
  const allPlayersMap = await sleeper.getAllPlayers();
  const playerMap = new Map<string, { id: string; name: string }>();

  // Build lookup maps
  for (const [id, player] of allPlayersMap.entries()) {
    const normalized = normalizeName(player.name);
    playerMap.set(normalized, { id: player.id, name: player.name });

    // Also add last name only for common names
    const parts = player.name.split(' ');
    if (parts.length >= 2) {
      const lastName = normalizeName(parts[parts.length - 1]);
      // Only use last name if it's distinctive (more than 5 chars)
      if (lastName.length > 5 && !playerMap.has(lastName)) {
        playerMap.set(lastName, { id: player.id, name: player.name });
      }
    }
  }

  for (const extracted of extractedNames) {
    const normalized = normalizeName(extracted);
    let result: MatchResult = {
      extractedName: extracted,
      matchedName: null,
      matchedId: null,
      confidence: 0,
      matchType: 'not_found',
    };

    // 1. Check exact match
    const exactMatch = playerMap.get(normalized);
    if (exactMatch) {
      result = {
        extractedName: extracted,
        matchedName: exactMatch.name,
        matchedId: exactMatch.id,
        confidence: 100,
        matchType: 'exact',
      };
      results.push(result);
      continue;
    }

    // 2. Check aliases
    const aliasMatch = PLAYER_ALIASES[normalized];
    if (aliasMatch) {
      const player = playerMap.get(normalizeName(aliasMatch));
      if (player) {
        result = {
          extractedName: extracted,
          matchedName: player.name,
          matchedId: player.id,
          confidence: 95,
          matchType: 'alias',
        };
        results.push(result);
        continue;
      }
    }

    // 3. Fuzzy match
    let bestMatch: { name: string; id: string; score: number } | null = null;

    for (const [key, player] of playerMap.entries()) {
      const score = similarity(normalized, key);
      if (score > 0.7 && (!bestMatch || score > bestMatch.score)) {
        bestMatch = { name: player.name, id: player.id, score };
      }
    }

    if (bestMatch && bestMatch.score > 0.7) {
      result = {
        extractedName: extracted,
        matchedName: bestMatch.name,
        matchedId: bestMatch.id,
        confidence: Math.round(bestMatch.score * 100),
        matchType: 'fuzzy',
      };
    }

    results.push(result);
  }

  return results;
}

/**
 * Quick lookup for a single player name
 */
export async function findPlayer(name: string): Promise<{ id: string; name: string } | null> {
  const results = await matchPlayerNames([name]);
  if (results.length > 0 && results[0].matchedId) {
    return { id: results[0].matchedId, name: results[0].matchedName! };
  }
  return null;
}

export default { matchPlayerNames, findPlayer, PLAYER_ALIASES };
