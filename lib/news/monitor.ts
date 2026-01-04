/**
 * News Monitoring System
 *
 * Monitors player news from Sleeper and ESPN.
 * Creates alerts when news significantly impacts edge scores.
 */

import { getSupabaseServer, isSupabaseConfigured } from '../db/supabase';
import { sleeper } from '../providers/sleeper';
import { getTeamsPlayingSoon, markPreGameCheckDone } from './schedule';

// Alert thresholds
const ALERT_THRESHOLD = 1.0; // Create alert if edge score changes by this much

interface PlayerNews {
  playerId: string;
  playerName: string;
  headline: string;
  details?: string;
  source: string;
  sourceUrl?: string;
  timestamp: Date;
  injuryStatus?: string;
}

interface MonitorResult {
  playersChecked: number;
  alertsCreated: number;
  newsItemsProcessed: number;
  durationMs: number;
  errors: string[];
}

/**
 * Fetch player news from Sleeper API
 */
async function fetchSleeperNews(playerIds?: string[]): Promise<PlayerNews[]> {
  const news: PlayerNews[] = [];

  try {
    // Sleeper trending players endpoint
    const response = await fetch('https://api.sleeper.app/v1/players/nfl/trending/add?lookback_hours=24&limit=50');
    if (!response.ok) return news;

    const trending = await response.json();

    // Get player details for trending players
    const players = await sleeper.getAllPlayers();

    for (const trend of trending) {
      const player = players.get(trend.player_id);
      if (!player) continue;

      // Filter by team if we have specific teams to check
      if (playerIds && !playerIds.includes(trend.player_id)) continue;

      // Check if player has recent injury update
      if (player.injuryStatus) {
        news.push({
          playerId: trend.player_id,
          playerName: player.full_name || player.name || `${player.first_name} ${player.last_name}`,
          headline: `${player.injuryStatus || 'Status update'}`,
          details: undefined,
          source: 'sleeper',
          timestamp: new Date(),
          injuryStatus: player.injuryStatus,
        });
      }
    }
  } catch (error) {
    console.error('[News] Error fetching Sleeper news:', error);
  }

  return news;
}

/**
 * Fetch injury updates from ESPN
 */
async function fetchESPNInjuries(teams: string[]): Promise<PlayerNews[]> {
  const news: PlayerNews[] = [];

  try {
    // ESPN doesn't have a direct injuries API, but we can check team pages
    // For now, we'll rely on Sleeper which aggregates well
    // This is a placeholder for future ESPN integration
  } catch (error) {
    console.error('[News] Error fetching ESPN injuries:', error);
  }

  return news;
}

/**
 * Check if a news item is significant enough to create an alert
 */
function isSignificantNews(news: PlayerNews): boolean {
  const significantStatuses = ['Out', 'Doubtful', 'IR', 'PUP', 'Suspended'];

  if (news.injuryStatus && significantStatuses.includes(news.injuryStatus)) {
    return true;
  }

  // Check headline for significant keywords
  const significantKeywords = [
    'out', 'inactive', 'ruled out', 'will not play',
    'doubtful', 'unlikely', 'limited', 'dnp',
    'ir', 'injured reserve', 'season-ending',
    'suspended', 'trade', 'released', 'signed',
  ];

  const lowerHeadline = (news.headline + ' ' + (news.details || '')).toLowerCase();
  return significantKeywords.some(keyword => lowerHeadline.includes(keyword));
}

/**
 * Determine alert severity based on injury status
 */
function determineAlertSeverity(news: PlayerNews): 'critical' | 'high' | 'medium' | 'low' {
  const status = news.injuryStatus?.toLowerCase();

  if (['out', 'ir', 'pup', 'suspended'].includes(status || '')) {
    return 'critical';
  }
  if (status === 'doubtful') {
    return 'high';
  }
  if (status === 'questionable') {
    return 'medium';
  }
  return 'low';
}

/**
 * Create an alert for significant news
 */
async function createAlert(
  news: PlayerNews,
  season: number,
  week: number
): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;

  const supabase = getSupabaseServer();

  // Check if we already have a similar alert
  const { data: existing } = await supabase
    .from('alerts')
    .select('id')
    .eq('player_id', news.playerId)
    .eq('headline', news.headline)
    .eq('is_active', true)
    .single();

  if (existing) {
    // Already have this alert
    return false;
  }

  const severity = determineAlertSeverity(news);

  const { error } = await supabase.from('alerts').insert({
    player_id: news.playerId,
    player_name: news.playerName,
    alert_type: news.injuryStatus ? 'injury' : 'news',
    severity,
    headline: news.headline,
    details: news.details,
    source: news.source,
    source_url: news.sourceUrl,
    season,
    week,
    raw_data: news,
  });

  if (error) {
    console.error('[News] Error creating alert:', error);
    return false;
  }

  console.log(`[News] Created ${severity} alert for ${news.playerName}: ${news.headline}`);
  return true;
}

/**
 * Run the news monitoring check
 */
export async function runNewsMonitor(options: {
  season: number;
  week: number;
  runType: 'scheduled' | 'pre_game' | 'manual';
  gameSlot?: string;
  prioritizeTeams?: string[];
}): Promise<MonitorResult> {
  const startTime = Date.now();
  const result: MonitorResult = {
    playersChecked: 0,
    alertsCreated: 0,
    newsItemsProcessed: 0,
    durationMs: 0,
    errors: [],
  };

  if (!isSupabaseConfigured()) {
    result.errors.push('Supabase not configured');
    result.durationMs = Date.now() - startTime;
    return result;
  }

  const supabase = getSupabaseServer();

  try {
    // Get teams playing soon for prioritization
    const teamsPriority = options.prioritizeTeams || await getTeamsPlayingSoon(60);

    console.log(`[News] Running ${options.runType} monitor, prioritizing teams: ${teamsPriority.join(', ')}`);

    // Fetch news from sources
    const sleeperNews = await fetchSleeperNews();
    result.newsItemsProcessed += sleeperNews.length;

    // Process significant news
    for (const news of sleeperNews) {
      result.playersChecked++;

      if (isSignificantNews(news)) {
        const created = await createAlert(news, options.season, options.week);
        if (created) {
          result.alertsCreated++;
        }
      }
    }

    // Log the monitor run
    result.durationMs = Date.now() - startTime;

    await supabase.from('news_monitor_state').insert({
      run_type: options.runType,
      game_slot: options.gameSlot,
      players_checked: result.playersChecked,
      alerts_created: result.alertsCreated,
      news_items_processed: result.newsItemsProcessed,
      started_at: new Date(startTime).toISOString(),
      completed_at: new Date().toISOString(),
      duration_ms: result.durationMs,
    });

    console.log(`[News] Monitor complete: ${result.alertsCreated} alerts from ${result.newsItemsProcessed} news items`);

  } catch (error) {
    result.errors.push(String(error));
    console.error('[News] Monitor error:', error);
  }

  result.durationMs = Date.now() - startTime;
  return result;
}

/**
 * Get recent alerts
 */
export async function getRecentAlerts(limit: number = 20): Promise<Array<{
  id: string;
  playerName: string;
  alertType: string;
  severity: string;
  headline: string;
  createdAt: Date;
}>> {
  if (!isSupabaseConfigured()) return [];

  const supabase = getSupabaseServer();

  const { data } = await supabase
    .from('alerts')
    .select('*')
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(limit);

  return (data || []).map(a => ({
    id: a.id,
    playerName: a.player_name,
    alertType: a.alert_type,
    severity: a.severity,
    headline: a.headline,
    createdAt: new Date(a.created_at),
  }));
}

/**
 * Deactivate old alerts (older than 48 hours)
 */
export async function deactivateOldAlerts(): Promise<number> {
  if (!isSupabaseConfigured()) return 0;

  const supabase = getSupabaseServer();
  const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000);

  const { data, error } = await supabase
    .from('alerts')
    .update({ is_active: false })
    .eq('is_active', true)
    .lt('created_at', cutoff.toISOString())
    .select('id');

  if (error) return 0;
  return data?.length || 0;
}
