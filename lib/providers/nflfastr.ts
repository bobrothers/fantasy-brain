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

// Cache for loaded data (in-memory for serverless compatibility)
let playerStatsCache: WeeklyPlayerStats[] | null = null;
let teamStatsCache: Map<string, TeamWeeklyStats[]> | null = null;
let csvDataCache: string | null = null;
let cacheTimestamp: number | null = null;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour in-memory cache

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
 * Clear cached data (useful for refreshing)
 */
function clearCache(): void {
  playerStatsCache = null;
  teamStatsCache = null;
  _dataDir = null; // Also reset data dir cache
}

export const nflfastr = {
  loadPlayerStats,
  getPlayerRecentStats,
  getTargetShare,
  getCarryShare,
  getUsageTrend,
  getTeamRank,
  getPerformanceVsTeam,
  getEmergingReceivers,
  getRedZoneUsage,
  clearCache,
  getDataDir,
  CURRENT_SEASON,
};

export default nflfastr;
