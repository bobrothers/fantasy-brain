/**
 * nflfastR Data Provider
 * 
 * Fetches play-by-play and player stats from nflfastR's public data repository.
 * Data is updated weekly during the season.
 * 
 * Source: https://github.com/nflverse/nflverse-data/releases
 * 
 * This gives us REAL data for:
 * - Target share / carry share
 * - Snap counts
 * - Red zone usage
 * - Air yards
 * - Historical matchup performance
 */

import * as fs from 'fs';
import * as path from 'path';

// Lazy-resolved data directory to handle different execution contexts
let _dataDir: string | null = null;

function getDataDir(): string {
  if (_dataDir) return _dataDir;

  const cwd = process.cwd();
  const primaryPath = path.join(cwd, 'data', 'nflfastr');
  const csvPath = path.join(primaryPath, 'player_stats.csv');

  if (fs.existsSync(csvPath)) {
    _dataDir = primaryPath;
    return _dataDir;
  }

  // If not found, ensure directory exists for downloads
  if (!fs.existsSync(primaryPath)) {
    try {
      fs.mkdirSync(primaryPath, { recursive: true });
    } catch {
      // Ignore mkdir errors
    }
  }

  _dataDir = primaryPath;
  return _dataDir;
}

// DATA_DIR is now resolved lazily via getDataDir()
const CURRENT_SEASON = 2024; // nflverse only has data through 2024 season

// nflverse data URLs - updated format
// See: https://github.com/nflverse/nflverse-data/releases
const NFLVERSE_BASE = 'https://github.com/nflverse/nflverse-data/releases/download';
const DATA_URLS = {
  // Player stats by week - the main file we need
  playerStats: `${NFLVERSE_BASE}/player_stats/player_stats.csv`,
  // Alternative: season-specific file  
  playerStatsSeason: `${NFLVERSE_BASE}/player_stats/player_stats_season_${CURRENT_SEASON}.csv`,
  // Roster for player lookups
  roster: `${NFLVERSE_BASE}/rosters/roster_${CURRENT_SEASON}.csv`,
};

interface WeeklyPlayerStats {
  playerId: string;
  playerName: string;
  position: string;
  team: string;
  week: number;
  // Passing
  completions?: number;
  attempts?: number;
  passingYards?: number;
  passingTds?: number;
  interceptions?: number;
  // Rushing
  carries?: number;
  rushingYards?: number;
  rushingTds?: number;
  // Receiving
  targets?: number;
  receptions?: number;
  receivingYards?: number;
  receivingTds?: number;
  // Advanced
  airYards?: number;
  yardsAfterCatch?: number;
  // Usage
  snapCount?: number;
  snapShare?: number;
  // Red zone
  rzTargets?: number;
  rzCarries?: number;
  rzReceptions?: number;
}

interface TeamWeeklyStats {
  team: string;
  week: number;
  totalTargets: number;
  totalCarries: number;
  totalSnaps: number;
  rzTargets: number;
  rzCarries: number;
}

// Games/schedule data for home/away detection
interface GameSchedule {
  gameId: string;
  season: number;
  week: number;
  homeTeam: string;
  awayTeam: string;
}

// Contract data from OverTheCap
interface ContractData {
  player: string;
  position: string;
  team: string;
  isActive: boolean;
  yearSigned: number;
  years: number;
  totalValue: number;
  apy: number;
  guaranteed: number;
  apyCapPct: number;
  draftYear: number | null;
  draftRound: number | null;
  draftPick: number | null;
  draftTeam: string | null;
}

// Injury report data
interface InjuryReport {
  season: number;
  week: number;
  playerName: string;
  team: string;
  position: string;
  primaryInjury: string;
  secondaryInjury: string;
  status: string; // Out, Questionable, Doubtful
  practiceStatus: string;
}

// Aggregated injury history for a player
interface PlayerInjuryHistory {
  playerName: string;
  gamesPlayed: { [season: number]: number };
  gamesMissed: { [season: number]: number };
  injuries: Array<{
    season: number;
    week: number;
    type: string;
    status: string;
  }>;
  totalGamesPlayed: number;
  totalGamesMissed: number;
  availabilityRate: number;
}

// Cache for loaded data (in-memory for serverless compatibility)
let playerStatsCache: WeeklyPlayerStats[] | null = null;
let teamStatsCache: Map<string, TeamWeeklyStats[]> | null = null;
let gamesCache: GameSchedule[] | null = null;
let contractsCache: Map<string, ContractData> | null = null;
let injuryReportsCache: InjuryReport[] | null = null;
let csvDataCache: string | null = null;
let gamesCsvCache: string | null = null;
let contractsCsvCache: string | null = null;
let injuriesCsvCache: string | null = null;
let cacheTimestamp: number | null = null;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour in-memory cache
const GAMES_PER_SEASON = 17;

/**
 * Check if running in serverless environment (read-only filesystem)
 */
function isServerless(): boolean {
  return process.env.VERCEL === '1' || process.env.AWS_LAMBDA_FUNCTION_NAME !== undefined;
}

/**
 * Ensure data directory exists (skip in serverless)
 */
function ensureDataDir(): void {
  if (isServerless()) return;
  const dataDir = getDataDir();
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
}

/**
 * Download data file - uses memory cache in serverless, disk cache locally
 */
async function downloadDataFile(url: string, filename: string): Promise<string> {
  // In serverless, use in-memory cache
  if (isServerless()) {
    // Return cached data if fresh
    if (csvDataCache && cacheTimestamp && (Date.now() - cacheTimestamp) < CACHE_TTL_MS) {
      return 'memory';
    }

    console.log(`Fetching ${filename} from nflverse (serverless mode)...`);
    const response = await fetch(url, {
      headers: { 'User-Agent': 'fantasy-brain/1.0' },
      redirect: 'follow',
    });

    if (!response.ok) {
      throw new Error(`Failed to download: ${response.status} ${response.statusText}`);
    }

    csvDataCache = await response.text();
    cacheTimestamp = Date.now();
    console.log(`Fetched ${filename} (${(csvDataCache.length / 1024 / 1024).toFixed(2)} MB)`);
    return 'memory';
  }

  // Local development: use disk cache
  ensureDataDir();
  const filepath = path.join(getDataDir(), filename);

  // Check if we have a recent cached version (less than 24 hours old)
  if (fs.existsSync(filepath)) {
    const stats = fs.statSync(filepath);
    const ageHours = (Date.now() - stats.mtimeMs) / (1000 * 60 * 60);
    if (ageHours < 24) {
      return filepath;
    }
  }

  console.log(`Downloading ${filename} from nflverse...`);

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'fantasy-brain/1.0',
      },
      redirect: 'follow',
    });

    if (!response.ok) {
      throw new Error(`Failed to download: ${response.status} ${response.statusText}`);
    }

    const data = await response.text();
    fs.writeFileSync(filepath, data);
    console.log(`Downloaded ${filename} (${(data.length / 1024 / 1024).toFixed(2)} MB)`);

    return filepath;
  } catch (error) {
    // If download fails but we have cached data, use it
    if (fs.existsSync(filepath)) {
      console.log(`Download failed, using cached ${filename}`);
      return filepath;
    }
    throw error;
  }
}

/**
 * Parse CSV data
 */
function parseCSV(csvData: string): Record<string, string>[] {
  const lines = csvData.trim().split('\n');
  if (lines.length < 2) return [];
  
  const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim());
  const rows: Record<string, string>[] = [];
  
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.length !== headers.length) continue;
    
    const row: Record<string, string> = {};
    headers.forEach((header, index) => {
      row[header] = values[index].replace(/"/g, '').trim();
    });
    rows.push(row);
  }
  
  return rows;
}

/**
 * Parse a single CSV line (handling quoted commas)
 */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (const char of line) {
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  
  return result;
}

/**
 * Load player stats from nflverse
 */
async function loadPlayerStats(): Promise<WeeklyPlayerStats[]> {
  if (playerStatsCache) return playerStatsCache;

  // Serverless mode: fetch and use in-memory cache
  if (isServerless()) {
    try {
      const filepath = await downloadDataFile(DATA_URLS.playerStats, 'player_stats.csv');

      if (filepath === 'memory' && csvDataCache) {
        const rows = parseCSV(csvDataCache);
        const currentSeasonRows = rows.filter(row => {
          const season = parseInt(row.season) || 0;
          return season === CURRENT_SEASON;
        });

        console.log(`Loaded ${currentSeasonRows.length} player stat rows for ${CURRENT_SEASON} season (serverless)`);

        playerStatsCache = currentSeasonRows.map(row => ({
          playerId: row.player_id || row.gsis_id || '',
          playerName: row.player_display_name || row.player_name || '',
          position: row.position || row.position_group || '',
          team: row.recent_team || row.team || '',
          week: parseInt(row.week) || 0,
          completions: parseFloat(row.completions) || 0,
          attempts: parseFloat(row.attempts) || 0,
          passingYards: parseFloat(row.passing_yards) || 0,
          passingTds: parseFloat(row.passing_tds) || 0,
          interceptions: parseFloat(row.interceptions) || 0,
          carries: parseFloat(row.carries) || 0,
          rushingYards: parseFloat(row.rushing_yards) || 0,
          rushingTds: parseFloat(row.rushing_tds) || 0,
          targets: parseFloat(row.targets) || 0,
          receptions: parseFloat(row.receptions) || 0,
          receivingYards: parseFloat(row.receiving_yards) || 0,
          receivingTds: parseFloat(row.receiving_tds) || 0,
          airYards: parseFloat(row.air_yards_share) || parseFloat(row.receiving_air_yards) || 0,
          yardsAfterCatch: parseFloat(row.receiving_yards_after_catch) || 0,
        }));
        return playerStatsCache;
      }
    } catch (error) {
      console.error('Failed to load player stats (serverless):', error);
      return [];
    }
  }

  // Local development: use disk cache
  const dataDir = getDataDir();
  const localCsv = path.join(dataDir, 'player_stats.csv');

  // Check if local file exists first (skip download if already cached)
  if (fs.existsSync(localCsv)) {
    try {
      const csvData = fs.readFileSync(localCsv, 'utf-8');
      const rows = parseCSV(csvData);
      const currentSeasonRows = rows.filter(row => {
        const season = parseInt(row.season) || 0;
        return season === CURRENT_SEASON;
      });
      playerStatsCache = currentSeasonRows.map(row => ({
        playerId: row.player_id || row.gsis_id || '',
        playerName: row.player_display_name || row.player_name || '',
        position: row.position || row.position_group || '',
        team: row.recent_team || row.team || '',
        week: parseInt(row.week) || 0,
        completions: parseFloat(row.completions) || 0,
        attempts: parseFloat(row.attempts) || 0,
        passingYards: parseFloat(row.passing_yards) || 0,
        passingTds: parseFloat(row.passing_tds) || 0,
        interceptions: parseFloat(row.interceptions) || 0,
        carries: parseFloat(row.carries) || 0,
        rushingYards: parseFloat(row.rushing_yards) || 0,
        rushingTds: parseFloat(row.rushing_tds) || 0,
        targets: parseFloat(row.targets) || 0,
        receptions: parseFloat(row.receptions) || 0,
        receivingYards: parseFloat(row.receiving_yards) || 0,
        receivingTds: parseFloat(row.receiving_tds) || 0,
        airYards: parseFloat(row.air_yards_share) || parseFloat(row.receiving_air_yards) || 0,
        yardsAfterCatch: parseFloat(row.receiving_yards_after_catch) || 0,
      }));
      return playerStatsCache;
    } catch (err) {
      console.error(`  nflfastR: Error reading ${localCsv}:`, err);
    }
  }

  // If no local file, try to download
  try {
    let filepath: string;
    try {
      filepath = await downloadDataFile(DATA_URLS.playerStats, 'player_stats.csv');
    } catch {
      filepath = await downloadDataFile(DATA_URLS.playerStatsSeason, `player_stats_season_${CURRENT_SEASON}.csv`);
    }

    const csvData = fs.readFileSync(filepath, 'utf-8');
    const rows = parseCSV(csvData);
    
    // Filter to current season only
    const currentSeasonRows = rows.filter(row => {
      const season = parseInt(row.season) || 0;
      return season === CURRENT_SEASON;
    });
    
    console.log(`Loaded ${currentSeasonRows.length} player stat rows for ${CURRENT_SEASON} season`);
    
    playerStatsCache = currentSeasonRows.map(row => ({
      playerId: row.player_id || row.gsis_id || '',
      // Use display name (full name) as primary, fall back to abbreviated
      playerName: row.player_display_name || row.player_name || '',
      position: row.position || row.position_group || '',
      team: row.recent_team || row.team || '',
      week: parseInt(row.week) || 0,
      // Passing
      completions: parseFloat(row.completions) || 0,
      attempts: parseFloat(row.attempts) || 0,
      passingYards: parseFloat(row.passing_yards) || 0,
      passingTds: parseFloat(row.passing_tds) || 0,
      interceptions: parseFloat(row.interceptions) || 0,
      // Rushing
      carries: parseFloat(row.carries) || 0,
      rushingYards: parseFloat(row.rushing_yards) || 0,
      rushingTds: parseFloat(row.rushing_tds) || 0,
      // Receiving
      targets: parseFloat(row.targets) || 0,
      receptions: parseFloat(row.receptions) || 0,
      receivingYards: parseFloat(row.receiving_yards) || 0,
      receivingTds: parseFloat(row.receiving_tds) || 0,
      // Advanced
      airYards: parseFloat(row.air_yards_share) || parseFloat(row.receiving_air_yards) || 0,
      yardsAfterCatch: parseFloat(row.receiving_yards_after_catch) || 0,
    }));
    
    return playerStatsCache;
  } catch (error) {
    console.error('Failed to load player stats:', error);
    return [];
  }
}

/**
 * Get player's stats for recent weeks
 */
async function getPlayerRecentStats(
  playerName: string,
  numWeeks: number = 3
): Promise<WeeklyPlayerStats[]> {
  const allStats = await loadPlayerStats();
  
  // Find player by name (case-insensitive partial match)
  const playerStats = allStats.filter(s => 
    s.playerName.toLowerCase().includes(playerName.toLowerCase()) ||
    playerName.toLowerCase().includes(s.playerName.toLowerCase())
  );
  
  if (playerStats.length === 0) return [];
  
  // Get the most recent weeks
  const sortedStats = playerStats.sort((a, b) => b.week - a.week);
  return sortedStats.slice(0, numWeeks);
}

/**
 * Calculate target share for a player over recent weeks
 */
async function getTargetShare(
  playerName: string,
  numWeeks: number = 3
): Promise<{ share: number; trend: 'up' | 'down' | 'stable'; weeklyShares: number[] } | null> {
  const stats = await getPlayerRecentStats(playerName, numWeeks);
  
  if (stats.length < 2) return null;
  
  const allStats = await loadPlayerStats();
  const team = stats[0].team;
  
  const weeklyShares: number[] = [];
  
  for (const weekStat of stats) {
    // Get team total targets for that week
    const teamWeekStats = allStats.filter(s => s.team === team && s.week === weekStat.week);
    const teamTargets = teamWeekStats.reduce((sum, s) => sum + (s.targets || 0), 0);
    
    if (teamTargets > 0 && weekStat.targets) {
      weeklyShares.push((weekStat.targets / teamTargets) * 100);
    }
  }
  
  if (weeklyShares.length < 2) return null;
  
  const avgShare = weeklyShares.reduce((a, b) => a + b, 0) / weeklyShares.length;
  
  // Calculate trend (comparing first half to second half)
  const firstHalf = weeklyShares.slice(0, Math.floor(weeklyShares.length / 2));
  const secondHalf = weeklyShares.slice(Math.floor(weeklyShares.length / 2));
  const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
  const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
  
  let trend: 'up' | 'down' | 'stable' = 'stable';
  if (secondAvg > firstAvg * 1.15) trend = 'up';
  else if (secondAvg < firstAvg * 0.85) trend = 'down';
  
  return { share: avgShare, trend, weeklyShares };
}

/**
 * Calculate carry share for a player over recent weeks
 */
async function getCarryShare(
  playerName: string,
  numWeeks: number = 3
): Promise<{ share: number; trend: 'up' | 'down' | 'stable'; weeklyShares: number[] } | null> {
  const stats = await getPlayerRecentStats(playerName, numWeeks);
  
  if (stats.length < 2) return null;
  
  const allStats = await loadPlayerStats();
  const team = stats[0].team;
  
  const weeklyShares: number[] = [];
  
  for (const weekStat of stats) {
    // Get team total carries for that week
    const teamWeekStats = allStats.filter(s => s.team === team && s.week === weekStat.week);
    const teamCarries = teamWeekStats.reduce((sum, s) => sum + (s.carries || 0), 0);
    
    if (teamCarries > 0 && weekStat.carries) {
      weeklyShares.push((weekStat.carries / teamCarries) * 100);
    }
  }
  
  if (weeklyShares.length < 2) return null;
  
  const avgShare = weeklyShares.reduce((a, b) => a + b, 0) / weeklyShares.length;
  
  // Calculate trend
  const firstHalf = weeklyShares.slice(0, Math.floor(weeklyShares.length / 2));
  const secondHalf = weeklyShares.slice(Math.floor(weeklyShares.length / 2));
  const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
  const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
  
  let trend: 'up' | 'down' | 'stable' = 'stable';
  if (secondAvg > firstAvg * 1.15) trend = 'up';
  else if (secondAvg < firstAvg * 0.85) trend = 'down';
  
  return { share: avgShare, trend, weeklyShares };
}

/**
 * Get player's performance vs a specific team (historical)
 */
async function getPerformanceVsTeam(
  playerName: string,
  opponentTeam: string,
  seasons: number[] = [CURRENT_SEASON, CURRENT_SEASON - 1]
): Promise<{ games: number; avgPoints: number; avgYards: number; avgTds: number } | null> {
  // This would require play-by-play data with opponent info
  // For now, return null - would need more complex data join
  return null;
}

/**
 * Get all players with increasing target share (buy candidates)
 */
async function getEmergingReceivers(minTargetShare: number = 15): Promise<Array<{
  name: string;
  team: string;
  share: number;
  trend: string;
}>> {
  const allStats = await loadPlayerStats();
  const receivers = allStats.filter(s => s.position === 'WR' || s.position === 'TE');
  
  // Get unique player names
  const playerNames = [...new Set(receivers.map(s => s.playerName))];
  
  const emerging: Array<{ name: string; team: string; share: number; trend: string }> = [];
  
  for (const name of playerNames.slice(0, 50)) { // Limit to top 50 for performance
    const shareData = await getTargetShare(name, 3);
    if (shareData && shareData.trend === 'up' && shareData.share >= minTargetShare) {
      const recentStats = await getPlayerRecentStats(name, 1);
      if (recentStats.length > 0) {
        emerging.push({
          name,
          team: recentStats[0].team,
          share: Math.round(shareData.share * 10) / 10,
          trend: 'Target share UP',
        });
      }
    }
  }
  
  return emerging.sort((a, b) => b.share - a.share);
}

/**
 * Get red zone usage for a player (requires play-by-play data)
 * For now, returns estimated data based on TDs and usage
 */
async function getRedZoneUsage(playerName: string): Promise<{
  rzTargetsPerGame: number;
  rzCarriesPerGame: number;
  tdsLast5: number;
} | null> {
  const stats = await getPlayerRecentStats(playerName, 5);
  
  if (stats.length === 0) return null;
  
  // Estimate RZ usage from TD rate (rough approximation)
  // Real RZ data would need play-by-play with field position
  const totalTds = stats.reduce((sum, s) => 
    sum + (s.rushingTds || 0) + (s.receivingTds || 0), 0);
  
  const avgTargets = stats.reduce((sum, s) => sum + (s.targets || 0), 0) / stats.length;
  const avgCarries = stats.reduce((sum, s) => sum + (s.carries || 0), 0) / stats.length;
  
  // Rough estimate: RZ usage correlates with overall usage and TD rate
  const tdRate = totalTds / stats.length;
  const estimatedRzTargets = avgTargets * 0.15 * (1 + tdRate); // ~15% of targets in RZ
  const estimatedRzCarries = avgCarries * 0.2 * (1 + tdRate); // ~20% of carries in RZ
  
  return {
    rzTargetsPerGame: Math.round(estimatedRzTargets * 10) / 10,
    rzCarriesPerGame: Math.round(estimatedRzCarries * 10) / 10,
    tdsLast5: totalTds,
  };
}

/**
 * Get usage trend data for charting (6 weeks of data with week numbers)
 */
async function getUsageTrend(
  playerName: string,
  numWeeks: number = 6
): Promise<{
  position: string;
  team: string;
  weeks: Array<{
    week: number;
    targetShare?: number;
    carryShare?: number;
    targets?: number;
    carries?: number;
  }>;
  avgTargetShare?: number;
  avgCarryShare?: number;
  targetTrend?: 'up' | 'down' | 'stable';
  carryTrend?: 'up' | 'down' | 'stable';
  trendChange?: number; // Percentage change from first to last
} | null> {
  const stats = await getPlayerRecentStats(playerName, numWeeks);

  if (stats.length < 2) return null;

  const allStats = await loadPlayerStats();
  const team = stats[0].team;
  const position = stats[0].position;

  // Sort by week ascending for proper charting
  const sortedStats = [...stats].sort((a, b) => a.week - b.week);

  const weeks: Array<{
    week: number;
    targetShare?: number;
    carryShare?: number;
    targets?: number;
    carries?: number;
  }> = [];

  const targetShares: number[] = [];
  const carryShares: number[] = [];

  for (const weekStat of sortedStats) {
    const teamWeekStats = allStats.filter(s => s.team === team && s.week === weekStat.week);
    const teamTargets = teamWeekStats.reduce((sum, s) => sum + (s.targets || 0), 0);
    const teamCarries = teamWeekStats.reduce((sum, s) => sum + (s.carries || 0), 0);

    const weekData: typeof weeks[0] = { week: weekStat.week };

    if (teamTargets > 0 && weekStat.targets) {
      const share = (weekStat.targets / teamTargets) * 100;
      weekData.targetShare = Math.round(share * 10) / 10;
      weekData.targets = weekStat.targets;
      targetShares.push(share);
    }

    if (teamCarries > 0 && weekStat.carries) {
      const share = (weekStat.carries / teamCarries) * 100;
      weekData.carryShare = Math.round(share * 10) / 10;
      weekData.carries = weekStat.carries;
      carryShares.push(share);
    }

    weeks.push(weekData);
  }

  // Calculate averages and trends
  const avgTargetShare = targetShares.length > 0
    ? Math.round((targetShares.reduce((a, b) => a + b, 0) / targetShares.length) * 10) / 10
    : undefined;

  const avgCarryShare = carryShares.length > 0
    ? Math.round((carryShares.reduce((a, b) => a + b, 0) / carryShares.length) * 10) / 10
    : undefined;

  // Calculate trends
  let targetTrend: 'up' | 'down' | 'stable' | undefined;
  let carryTrend: 'up' | 'down' | 'stable' | undefined;
  let trendChange: number | undefined;

  if (targetShares.length >= 2) {
    const firstHalf = targetShares.slice(0, Math.floor(targetShares.length / 2));
    const secondHalf = targetShares.slice(Math.floor(targetShares.length / 2));
    const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;

    if (secondAvg > firstAvg * 1.15) targetTrend = 'up';
    else if (secondAvg < firstAvg * 0.85) targetTrend = 'down';
    else targetTrend = 'stable';

    trendChange = Math.round((secondAvg - firstAvg) * 10) / 10;
  }

  if (carryShares.length >= 2) {
    const firstHalf = carryShares.slice(0, Math.floor(carryShares.length / 2));
    const secondHalf = carryShares.slice(Math.floor(carryShares.length / 2));
    const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;

    if (secondAvg > firstAvg * 1.15) carryTrend = 'up';
    else if (secondAvg < firstAvg * 0.85) carryTrend = 'down';
    else carryTrend = 'stable';

    // Use carry trend change for RBs
    if (position === 'RB') {
      trendChange = Math.round((secondAvg - firstAvg) * 10) / 10;
    }
  }

  return {
    position,
    team,
    weeks,
    avgTargetShare,
    avgCarryShare,
    targetTrend,
    carryTrend,
    trendChange,
  };
}

/**
 * Get player's rank on their team for target/carry share
 */
async function getTeamRank(
  playerName: string,
  position: string
): Promise<{ rank: number; total: number } | null> {
  const allStats = await loadPlayerStats();

  // Find player's team
  const playerStats = allStats.filter(s =>
    s.playerName.toLowerCase().includes(playerName.toLowerCase()) ||
    playerName.toLowerCase().includes(s.playerName.toLowerCase())
  );

  if (playerStats.length === 0) return null;

  const team = playerStats[0].team;
  const latestWeek = Math.max(...playerStats.map(s => s.week));

  // Get all teammates with same position group in recent weeks
  const recentWeeks = [latestWeek, latestWeek - 1, latestWeek - 2].filter(w => w > 0);

  // Calculate average usage per player on team
  const playerUsage = new Map<string, { total: number; games: number }>();

  for (const stat of allStats) {
    if (stat.team !== team || !recentWeeks.includes(stat.week)) continue;

    // For RBs, use carries; for WR/TE use targets
    const usage = position === 'RB' ? (stat.carries || 0) : (stat.targets || 0);
    if (usage === 0) continue;

    // Only compare within position group for targets (WR/TE together)
    const isReceiver = ['WR', 'TE'].includes(stat.position);
    const playerIsReceiver = ['WR', 'TE'].includes(position);
    const isRB = stat.position === 'RB';
    const playerIsRB = position === 'RB';

    if ((playerIsReceiver && !isReceiver) || (playerIsRB && !isRB)) continue;

    const current = playerUsage.get(stat.playerName) || { total: 0, games: 0 };
    playerUsage.set(stat.playerName, {
      total: current.total + usage,
      games: current.games + 1,
    });
  }

  // Calculate averages and rank
  const rankings = Array.from(playerUsage.entries())
    .map(([name, data]) => ({
      name,
      avgUsage: data.total / data.games,
    }))
    .sort((a, b) => b.avgUsage - a.avgUsage);

  const playerRank = rankings.findIndex(r =>
    r.name.toLowerCase().includes(playerName.toLowerCase()) ||
    playerName.toLowerCase().includes(r.name.toLowerCase())
  );

  if (playerRank === -1) return null;

  return {
    rank: playerRank + 1,
    total: rankings.length,
  };
}

/**
 * Load games/schedule data for home/away detection
 */
async function loadGames(): Promise<GameSchedule[]> {
  if (gamesCache) return gamesCache;

  const dataDir = getDataDir();
  const localCsv = path.join(dataDir, 'games.csv');

  try {
    let csvData: string;

    if (isServerless()) {
      // Fetch from nflverse
      if (gamesCsvCache) {
        csvData = gamesCsvCache;
      } else {
        const response = await fetch(
          'https://github.com/nflverse/nflverse-data/releases/download/schedules/games.csv',
          { headers: { 'User-Agent': 'fantasy-brain/1.0' }, redirect: 'follow' }
        );
        if (!response.ok) throw new Error(`Failed to fetch games.csv: ${response.status}`);
        csvData = await response.text();
        gamesCsvCache = csvData;
      }
    } else if (fs.existsSync(localCsv)) {
      csvData = fs.readFileSync(localCsv, 'utf-8');
    } else {
      // Download if not cached
      const response = await fetch(
        'https://github.com/nflverse/nflverse-data/releases/download/schedules/games.csv',
        { headers: { 'User-Agent': 'fantasy-brain/1.0' }, redirect: 'follow' }
      );
      if (!response.ok) throw new Error(`Failed to fetch games.csv: ${response.status}`);
      csvData = await response.text();
      fs.writeFileSync(localCsv, csvData);
    }

    const rows = parseCSV(csvData);
    gamesCache = rows.map(row => ({
      gameId: row.game_id || '',
      season: parseInt(row.season) || 0,
      week: parseInt(row.week) || 0,
      homeTeam: row.home_team || '',
      awayTeam: row.away_team || '',
    }));

    return gamesCache;
  } catch (error) {
    console.error('Failed to load games data:', error);
    return [];
  }
}

/**
 * Calculate home/away fantasy point splits for a player
 * Returns PPR fantasy points averages at home vs away
 */
async function getHomeAwaySplits(
  playerName: string,
  seasons: number[] = [CURRENT_SEASON]
): Promise<{
  homeGames: number;
  awayGames: number;
  homePPG: number;
  awayPPG: number;
  splitPct: number; // Positive = better at home, negative = better away
} | null> {
  const [allStats, games] = await Promise.all([loadPlayerStats(), loadGames()]);

  // Find player stats
  const playerStats = allStats.filter(s =>
    (s.playerName.toLowerCase() === playerName.toLowerCase() ||
      s.playerName.toLowerCase().includes(playerName.toLowerCase())) &&
    seasons.includes(CURRENT_SEASON) // Stats are only for current season
  );

  if (playerStats.length < 4) return null; // Need at least 4 games

  // Build a lookup: (season, week, team) -> isHome
  const gameLocationMap = new Map<string, boolean>();
  for (const game of games) {
    if (!seasons.includes(game.season)) continue;
    // Home team key
    gameLocationMap.set(`${game.season}-${game.week}-${game.homeTeam}`, true);
    // Away team key
    gameLocationMap.set(`${game.season}-${game.week}-${game.awayTeam}`, false);
  }

  // Calculate PPR points and split by home/away
  const homePoints: number[] = [];
  const awayPoints: number[] = [];

  for (const stat of playerStats) {
    // Calculate PPR fantasy points
    const pprPoints =
      (stat.passingYards || 0) * 0.04 +
      (stat.passingTds || 0) * 4 +
      (stat.interceptions || 0) * -2 +
      (stat.rushingYards || 0) * 0.1 +
      (stat.rushingTds || 0) * 6 +
      (stat.receptions || 0) * 1 + // PPR
      (stat.receivingYards || 0) * 0.1 +
      (stat.receivingTds || 0) * 6;

    const key = `${CURRENT_SEASON}-${stat.week}-${stat.team}`;
    const isHome = gameLocationMap.get(key);

    if (isHome === undefined) continue; // Skip if we can't determine location

    if (isHome) {
      homePoints.push(pprPoints);
    } else {
      awayPoints.push(pprPoints);
    }
  }

  if (homePoints.length < 2 || awayPoints.length < 2) return null;

  const homePPG = homePoints.reduce((a, b) => a + b, 0) / homePoints.length;
  const awayPPG = awayPoints.reduce((a, b) => a + b, 0) / awayPoints.length;
  const avgPPG = (homePPG + awayPPG) / 2;
  const splitPct = avgPPG > 0 ? ((homePPG - awayPPG) / avgPPG) * 100 : 0;

  return {
    homeGames: homePoints.length,
    awayGames: awayPoints.length,
    homePPG: Math.round(homePPG * 10) / 10,
    awayPPG: Math.round(awayPPG * 10) / 10,
    splitPct: Math.round(splitPct * 10) / 10,
  };
}

/**
 * Load contract data from nflverse OverTheCap
 */
async function loadContracts(): Promise<Map<string, ContractData>> {
  if (contractsCache) return contractsCache;

  const dataDir = getDataDir();
  const localCsv = path.join(dataDir, 'contracts.csv');
  const CONTRACTS_URL = 'https://github.com/nflverse/nflverse-data/releases/download/contracts/historical_contracts.csv.gz';

  try {
    let csvData: string;

    if (isServerless()) {
      if (contractsCsvCache) {
        csvData = contractsCsvCache;
      } else {
        // Fetch gzipped file
        const response = await fetch(CONTRACTS_URL, {
          headers: { 'User-Agent': 'fantasy-brain/1.0' },
          redirect: 'follow',
        });
        if (!response.ok) throw new Error(`Failed to fetch contracts: ${response.status}`);

        // Decompress gzip
        const buffer = await response.arrayBuffer();
        const { gunzipSync } = await import('zlib');
        csvData = gunzipSync(Buffer.from(buffer)).toString('utf-8');
        contractsCsvCache = csvData;
      }
    } else if (fs.existsSync(localCsv)) {
      csvData = fs.readFileSync(localCsv, 'utf-8');
    } else {
      // Download and decompress
      const response = await fetch(CONTRACTS_URL, {
        headers: { 'User-Agent': 'fantasy-brain/1.0' },
        redirect: 'follow',
      });
      if (!response.ok) throw new Error(`Failed to fetch contracts: ${response.status}`);

      const buffer = await response.arrayBuffer();
      const { gunzipSync } = await import('zlib');
      csvData = gunzipSync(Buffer.from(buffer)).toString('utf-8');
      fs.writeFileSync(localCsv, csvData);
    }

    const rows = parseCSV(csvData);
    contractsCache = new Map();

    // Only keep active contracts, keyed by player name (lowercase)
    for (const row of rows) {
      if (row.is_active !== 'TRUE') continue;

      const playerName = row.player || '';
      const key = playerName.toLowerCase();

      // Skip if we already have this player (keep first/most recent active contract)
      if (contractsCache.has(key)) continue;

      contractsCache.set(key, {
        player: playerName,
        position: row.position || '',
        team: row.team || '',
        isActive: true,
        yearSigned: parseInt(row.year_signed) || 0,
        years: parseInt(row.years) || 0,
        totalValue: parseInt(row.value) || 0,
        apy: parseInt(row.apy) || 0,
        guaranteed: parseInt(row.guaranteed) || 0,
        apyCapPct: parseFloat(row.apy_cap_pct) || 0,
        draftYear: row.draft_year && row.draft_year !== 'NA' ? parseInt(row.draft_year) : null,
        draftRound: row.draft_round && row.draft_round !== 'NA' ? parseInt(row.draft_round) : null,
        draftPick: row.draft_overall && row.draft_overall !== 'NA' ? parseInt(row.draft_overall) : null,
        draftTeam: row.draft_team && row.draft_team !== 'NA' ? row.draft_team : null,
      });
    }

    console.log(`Loaded ${contractsCache.size} active player contracts`);
    return contractsCache;
  } catch (error) {
    console.error('Failed to load contracts:', error);
    return new Map();
  }
}

/**
 * Get contract data for a specific player
 */
async function getPlayerContract(playerName: string): Promise<ContractData | null> {
  const contracts = await loadContracts();
  return contracts.get(playerName.toLowerCase()) || null;
}

/**
 * Calculate years remaining on contract
 */
function getContractYearsRemaining(contract: ContractData): number {
  const currentYear = new Date().getFullYear();
  const endYear = contract.yearSigned + contract.years;
  return Math.max(0, endYear - currentYear);
}

/**
 * Determine if player is on rookie deal
 */
function isRookieDeal(contract: ContractData): boolean {
  if (!contract.draftYear) return false;
  // Rookie deals are 4-5 years (5th year option for 1st rounders)
  const maxRookieYears = contract.draftRound === 1 ? 5 : 4;
  const currentYear = new Date().getFullYear();
  return (currentYear - contract.draftYear) <= maxRookieYears;
}

/**
 * Load injury reports from nflverse (2022-2024)
 */
async function loadInjuryReports(seasons: number[] = [2022, 2023, 2024]): Promise<InjuryReport[]> {
  if (injuryReportsCache) return injuryReportsCache;

  const dataDir = getDataDir();
  const allReports: InjuryReport[] = [];

  for (const season of seasons) {
    try {
      let csvData: string;
      const localCsv = path.join(dataDir, `injuries_${season}.csv`);
      const url = `https://github.com/nflverse/nflverse-data/releases/download/injuries/injuries_${season}.csv`;

      if (isServerless()) {
        const response = await fetch(url, {
          headers: { 'User-Agent': 'fantasy-brain/1.0' },
          redirect: 'follow',
        });
        if (!response.ok) continue;
        csvData = await response.text();
      } else if (fs.existsSync(localCsv)) {
        csvData = fs.readFileSync(localCsv, 'utf-8');
      } else {
        const response = await fetch(url, {
          headers: { 'User-Agent': 'fantasy-brain/1.0' },
          redirect: 'follow',
        });
        if (!response.ok) continue;
        csvData = await response.text();
        fs.writeFileSync(localCsv, csvData);
      }

      const rows = parseCSV(csvData);
      for (const row of rows) {
        // Skip if no meaningful injury or resting
        if (row.report_status === '' && row.practice_status === '') continue;

        allReports.push({
          season: parseInt(row.season) || 0,
          week: parseInt(row.week) || 0,
          playerName: row.full_name || '',
          team: row.team || '',
          position: row.position || '',
          primaryInjury: row.report_primary_injury || row.practice_primary_injury || '',
          secondaryInjury: row.report_secondary_injury || row.practice_secondary_injury || '',
          status: row.report_status || '',
          practiceStatus: row.practice_status || '',
        });
      }
    } catch (error) {
      console.error(`Failed to load injuries for ${season}:`, error);
    }
  }

  injuryReportsCache = allReports;
  console.log(`Loaded ${allReports.length} injury reports from ${seasons.join(', ')}`);
  return allReports;
}

/**
 * Get injury history for a specific player
 * Returns games played/missed per season and injury types
 */
async function getPlayerInjuryHistory(
  playerName: string,
  seasons: number[] = [2022, 2023, 2024]
): Promise<PlayerInjuryHistory | null> {
  const reports = await loadInjuryReports(seasons);

  // Find all reports for this player
  const playerReports = reports.filter(r =>
    r.playerName.toLowerCase() === playerName.toLowerCase()
  );

  if (playerReports.length === 0) return null;

  // Track games missed per season (weeks with "Out" status)
  const gamesMissed: { [season: number]: Set<number> } = {};
  const injuries: PlayerInjuryHistory['injuries'] = [];

  for (const season of seasons) {
    gamesMissed[season] = new Set();
  }

  for (const report of playerReports) {
    // Count as missed if status is "Out"
    if (report.status === 'Out') {
      gamesMissed[report.season]?.add(report.week);
    }

    // Track injury types (dedupe by season+week)
    if (report.primaryInjury && report.primaryInjury !== 'Not injury related - resting player') {
      injuries.push({
        season: report.season,
        week: report.week,
        type: report.primaryInjury,
        status: report.status,
      });
    }
  }

  // Calculate games played (17 - missed, capped at 0)
  const gamesPlayed: { [season: number]: number } = {};
  let totalPlayed = 0;
  let totalMissed = 0;

  for (const season of seasons) {
    const missed = gamesMissed[season]?.size || 0;
    const played = Math.max(0, GAMES_PER_SEASON - missed);
    gamesPlayed[season] = played;
    totalPlayed += played;
    totalMissed += missed;
  }

  const totalPossible = seasons.length * GAMES_PER_SEASON;
  const availabilityRate = totalPossible > 0
    ? Math.round((totalPlayed / totalPossible) * 100)
    : 100;

  // Dedupe injuries by season+week
  const uniqueInjuries = injuries.filter((inj, idx, arr) =>
    arr.findIndex(i => i.season === inj.season && i.week === inj.week) === idx
  );

  return {
    playerName,
    gamesPlayed,
    gamesMissed: Object.fromEntries(
      Object.entries(gamesMissed).map(([s, set]) => [s, set.size])
    ),
    injuries: uniqueInjuries,
    totalGamesPlayed: totalPlayed,
    totalGamesMissed: totalMissed,
    availabilityRate,
  };
}

/**
 * Categorize injury type into our standard categories
 */
function categorizeInjury(injuryType: string): string {
  const injury = injuryType.toLowerCase();

  if (injury.includes('acl')) return 'knee_acl';
  if (injury.includes('knee') || injury.includes('mcl') || injury.includes('meniscus')) return 'knee_other';
  if (injury.includes('concussion') || injury.includes('head')) return 'concussion';
  if (injury.includes('ankle') || injury.includes('foot') || injury.includes('achilles') || injury.includes('toe')) return 'ankle_foot';
  if (injury.includes('hamstring') || injury.includes('quad') || injury.includes('groin') || injury.includes('calf') || injury.includes('thigh')) return 'soft_tissue';
  if (injury.includes('back') || injury.includes('spine')) return 'back';
  if (injury.includes('shoulder')) return 'shoulder';
  if (injury.includes('wrist') || injury.includes('hand') || injury.includes('finger') || injury.includes('thumb')) return 'wrist_hand';
  if (injury.includes('rib') || injury.includes('chest')) return 'ribs';
  if (injury.includes('illness') || injury.includes('flu') || injury.includes('covid')) return 'illness';

  return 'other';
}

/**
 * Get injury type counts for a player
 */
async function getInjuryTypeCounts(
  playerName: string
): Promise<Map<string, number> | null> {
  const history = await getPlayerInjuryHistory(playerName);
  if (!history) return null;

  const counts = new Map<string, number>();
  for (const injury of history.injuries) {
    const category = categorizeInjury(injury.type);
    counts.set(category, (counts.get(category) || 0) + 1);
  }

  return counts;
}

/**
 * Clear cached data (useful for refreshing)
 */
function clearCache(): void {
  playerStatsCache = null;
  teamStatsCache = null;
  gamesCache = null;
  gamesCsvCache = null;
  contractsCache = null;
  contractsCsvCache = null;
  injuryReportsCache = null;
  injuriesCsvCache = null;
  _dataDir = null; // Also reset data dir cache
}

export const nflfastr = {
  loadPlayerStats,
  loadGames,
  loadContracts,
  loadInjuryReports,
  getPlayerRecentStats,
  getTargetShare,
  getCarryShare,
  getUsageTrend,
  getTeamRank,
  getPerformanceVsTeam,
  getEmergingReceivers,
  getRedZoneUsage,
  getHomeAwaySplits,
  getPlayerContract,
  getContractYearsRemaining,
  isRookieDeal,
  getPlayerInjuryHistory,
  getInjuryTypeCounts,
  categorizeInjury,
  clearCache,
  getDataDir,
  CURRENT_SEASON,
  GAMES_PER_SEASON,
};

export default nflfastr;
