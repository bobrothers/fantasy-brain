-- Cost Tracking and News Monitoring Tables
-- Run after 004_agent_improvements.sql

-- ============================================
-- API Cost Tracking
-- ============================================

CREATE TABLE IF NOT EXISTS api_costs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Request context
  endpoint TEXT NOT NULL,           -- '/api/analyze', '/api/agent/improve', etc.
  model TEXT NOT NULL,              -- 'claude-3-opus', 'claude-3-sonnet', etc.

  -- Token usage
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  cache_creation_tokens INTEGER DEFAULT 0,
  cache_read_tokens INTEGER DEFAULT 0,

  -- Cost
  cost_usd NUMERIC(10,6) NOT NULL,  -- 6 decimal places for precision

  -- Optional user tracking
  user_id TEXT,                     -- If authenticated
  session_id TEXT,                  -- To group related calls

  -- Metadata
  request_metadata JSONB,           -- Any additional info
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for cost queries
CREATE INDEX IF NOT EXISTS idx_api_costs_created ON api_costs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_api_costs_endpoint ON api_costs(endpoint);
CREATE INDEX IF NOT EXISTS idx_api_costs_model ON api_costs(model);
CREATE INDEX IF NOT EXISTS idx_api_costs_user ON api_costs(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_api_costs_daily ON api_costs(DATE(created_at));

-- RLS
ALTER TABLE api_costs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read" ON api_costs FOR SELECT USING (true);
CREATE POLICY "Allow service write" ON api_costs FOR INSERT WITH CHECK (true);

-- ============================================
-- Weekly NFL Schedule
-- ============================================

CREATE TABLE IF NOT EXISTS weekly_schedule (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Game identification
  season INTEGER NOT NULL,
  week INTEGER NOT NULL,
  game_id TEXT NOT NULL,            -- ESPN/Sleeper game ID

  -- Teams
  home_team TEXT NOT NULL,
  away_team TEXT NOT NULL,

  -- Timing
  kickoff_time TIMESTAMPTZ NOT NULL,
  game_slot TEXT,                   -- 'TNF', 'early_sunday', 'late_sunday', 'SNF', 'MNF', 'saturday'

  -- Status
  game_status TEXT DEFAULT 'scheduled', -- 'scheduled', 'in_progress', 'final', 'postponed'

  -- Monitoring flags
  pre_game_check_done BOOLEAN DEFAULT FALSE,

  -- Metadata
  venue TEXT,
  weather_data JSONB,               -- Cache weather for game
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(season, week, game_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_weekly_schedule_kickoff ON weekly_schedule(kickoff_time);
CREATE INDEX IF NOT EXISTS idx_weekly_schedule_week ON weekly_schedule(season, week);
CREATE INDEX IF NOT EXISTS idx_weekly_schedule_status ON weekly_schedule(game_status) WHERE game_status = 'scheduled';

-- RLS
ALTER TABLE weekly_schedule ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read" ON weekly_schedule FOR SELECT USING (true);
CREATE POLICY "Allow service write" ON weekly_schedule FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow service update" ON weekly_schedule FOR UPDATE USING (true);

-- ============================================
-- Player Alerts
-- ============================================

CREATE TABLE IF NOT EXISTS alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Player info
  player_id TEXT NOT NULL,
  player_name TEXT NOT NULL,

  -- Alert details
  alert_type TEXT NOT NULL,         -- 'injury', 'inactive', 'weather', 'depth_chart', 'news'
  severity TEXT NOT NULL,           -- 'critical', 'high', 'medium', 'low'

  -- Score impact
  old_edge_score NUMERIC(4,2),
  new_edge_score NUMERIC(4,2),
  score_change NUMERIC(4,2),

  -- Details
  headline TEXT NOT NULL,
  details TEXT,
  source TEXT,                      -- 'sleeper', 'espn', 'manual'
  source_url TEXT,

  -- Game context
  game_id TEXT,
  season INTEGER,
  week INTEGER,

  -- Status
  is_active BOOLEAN DEFAULT TRUE,   -- False when news is outdated
  processed BOOLEAN DEFAULT FALSE,  -- True after users notified

  -- Metadata
  raw_data JSONB,                   -- Original news data
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_alerts_player ON alerts(player_id);
CREATE INDEX IF NOT EXISTS idx_alerts_active ON alerts(is_active, created_at DESC) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_alerts_type ON alerts(alert_type);
CREATE INDEX IF NOT EXISTS idx_alerts_severity ON alerts(severity);
CREATE INDEX IF NOT EXISTS idx_alerts_week ON alerts(season, week);

-- RLS
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read" ON alerts FOR SELECT USING (true);
CREATE POLICY "Allow service write" ON alerts FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow service update" ON alerts FOR UPDATE USING (true);

-- ============================================
-- News Monitor State
-- ============================================

CREATE TABLE IF NOT EXISTS news_monitor_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Monitor run info
  run_type TEXT NOT NULL,           -- 'scheduled', 'pre_game', 'manual'
  game_slot TEXT,                   -- If pre_game: 'TNF', 'early_sunday', etc.

  -- Results
  players_checked INTEGER DEFAULT 0,
  alerts_created INTEGER DEFAULT 0,
  news_items_processed INTEGER DEFAULT 0,

  -- Timing
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  duration_ms INTEGER,

  -- Errors
  error TEXT,

  -- Cost
  api_cost_usd NUMERIC(10,6)
);

-- Index for recent runs
CREATE INDEX IF NOT EXISTS idx_news_monitor_started ON news_monitor_state(started_at DESC);

-- RLS
ALTER TABLE news_monitor_state ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read" ON news_monitor_state FOR SELECT USING (true);
CREATE POLICY "Allow service write" ON news_monitor_state FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow service update" ON news_monitor_state FOR UPDATE USING (true);

-- Done
SELECT 'Migration 005 complete!' as status;
