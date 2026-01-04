-- Agent Tables Migration
-- Tables for Trade, Lineup, Draft, and League Context agents

-- ============================================
-- League Context Agent Tables
-- ============================================

CREATE TABLE IF NOT EXISTS league_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id TEXT NOT NULL UNIQUE,
  platform TEXT NOT NULL DEFAULT 'sleeper',

  -- League settings
  name TEXT,
  season INTEGER,
  roster_positions JSONB,
  scoring_settings JSONB,
  trade_deadline TEXT,
  waiver_type TEXT,

  -- League tendencies (AI analyzed)
  trade_volume TEXT,              -- 'high', 'medium', 'low'
  avg_trades_per_week NUMERIC(4,2),
  common_trade_patterns JSONB,    -- What types of trades happen often
  league_competitiveness TEXT,    -- 'very_competitive', 'competitive', 'casual'

  -- AI analysis
  ai_summary TEXT,
  ai_analysis JSONB,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS owner_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id TEXT NOT NULL,
  owner_id TEXT NOT NULL,
  platform TEXT NOT NULL DEFAULT 'sleeper',

  -- Basic info
  display_name TEXT,
  team_name TEXT,
  avatar TEXT,

  -- Roster analysis
  roster_strength NUMERIC(4,2),   -- 0-10 scale
  roster_needs JSONB,             -- Array of positions needed
  trade_assets JSONB,             -- Players likely to trade away

  -- Owner tendencies (AI analyzed)
  trading_style TEXT,             -- 'aggressive', 'moderate', 'passive'
  values_youth BOOLEAN,           -- Prefers young players
  values_veterans BOOLEAN,        -- Prefers proven vets
  position_preferences JSONB,     -- Which positions they prioritize
  buy_low_tendency NUMERIC(4,2),  -- 0-10 likelihood to buy low
  sell_high_tendency NUMERIC(4,2),-- 0-10 likelihood to sell high

  -- Historical data
  trades_made INTEGER DEFAULT 0,
  trades_won INTEGER DEFAULT 0,   -- Trades that worked in their favor

  -- AI analysis
  ai_summary TEXT,
  ai_analysis JSONB,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(league_id, owner_id)
);

-- ============================================
-- Trade Negotiation Agent Tables
-- ============================================

CREATE TABLE IF NOT EXISTS trade_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id TEXT NOT NULL,

  -- Trade context
  target_player_id TEXT NOT NULL,
  target_player_name TEXT NOT NULL,
  target_owner_id TEXT,
  user_roster JSONB,

  -- Tier suggestions
  lowball_offer JSONB,            -- Players to offer in lowball
  fair_offer JSONB,               -- Players for fair trade
  overpay_offer JSONB,            -- Players if desperate

  -- AI reasoning
  target_value_analysis TEXT,
  owner_tendency_notes TEXT,
  negotiation_tips TEXT,
  success_probability JSONB,      -- Probability for each tier

  -- Full AI response
  ai_reasoning TEXT,
  ai_analysis JSONB,

  -- Cost tracking
  api_cost_usd NUMERIC(10,6),

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- Lineup Optimizer Agent Tables
-- ============================================

CREATE TABLE IF NOT EXISTS lineup_recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id TEXT,
  user_id TEXT,

  -- Context
  season INTEGER NOT NULL,
  week INTEGER NOT NULL,
  risk_preference TEXT,           -- 'safe', 'balanced', 'aggressive'
  opponent_projection NUMERIC(6,2),

  -- Recommendations
  optimal_lineup JSONB,           -- Recommended starting lineup
  bench JSONB,                    -- Bench players
  flex_alternatives JSONB,        -- Alternative flex plays

  -- Per-player reasoning
  player_decisions JSONB,         -- Why each player was started/benched

  -- Projections
  projected_points NUMERIC(6,2),
  floor_projection NUMERIC(6,2),
  ceiling_projection NUMERIC(6,2),

  -- AI analysis
  key_matchups TEXT,
  risk_factors TEXT,
  ai_reasoning TEXT,
  ai_analysis JSONB,

  -- Cost tracking
  api_cost_usd NUMERIC(10,6),

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- Draft Assistant Agent Tables
-- ============================================

CREATE TABLE IF NOT EXISTS draft_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  draft_id TEXT NOT NULL UNIQUE,
  league_id TEXT,
  platform TEXT DEFAULT 'sleeper',

  -- Draft settings
  draft_type TEXT,                -- 'snake', 'auction', 'linear'
  num_teams INTEGER,
  num_rounds INTEGER,
  pick_time_limit INTEGER,
  scoring_type TEXT,

  -- Draft state
  current_pick INTEGER DEFAULT 0,
  is_complete BOOLEAN DEFAULT FALSE,

  -- Analysis
  adp_vs_actual JSONB,            -- Track ADP deviations
  position_runs JSONB,            -- Detected position runs
  value_picks JSONB,              -- Best value picks so far
  reaches JSONB,                  -- Biggest reaches

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS draft_picks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  draft_id TEXT NOT NULL,

  -- Pick info
  pick_number INTEGER NOT NULL,
  round INTEGER NOT NULL,
  owner_id TEXT,
  owner_name TEXT,

  -- Player picked
  player_id TEXT NOT NULL,
  player_name TEXT NOT NULL,
  position TEXT,
  team TEXT,

  -- Analysis
  adp NUMERIC(5,1),
  pick_vs_adp NUMERIC(5,1),       -- Positive = reach, negative = value
  was_recommended BOOLEAN,

  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(draft_id, pick_number)
);

CREATE TABLE IF NOT EXISTS draft_recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  draft_id TEXT NOT NULL,
  pick_number INTEGER NOT NULL,

  -- Context at time of pick
  available_players JSONB,        -- Top available at each position
  roster_so_far JSONB,
  roster_needs JSONB,

  -- Recommendations
  top_recommendation TEXT,        -- Player ID
  top_recommendation_name TEXT,
  alternative_picks JSONB,        -- Array of alternatives

  -- AI reasoning
  positional_scarcity TEXT,
  value_analysis TEXT,
  roster_fit_analysis TEXT,
  ai_reasoning TEXT,
  ai_analysis JSONB,

  -- Outcome
  actual_pick TEXT,               -- What was actually picked
  was_followed BOOLEAN,

  -- Cost tracking
  api_cost_usd NUMERIC(10,6),

  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(draft_id, pick_number)
);

-- ============================================
-- Indexes
-- ============================================

CREATE INDEX IF NOT EXISTS idx_league_profiles_league ON league_profiles(league_id);
CREATE INDEX IF NOT EXISTS idx_owner_profiles_league ON owner_profiles(league_id);
CREATE INDEX IF NOT EXISTS idx_trade_suggestions_league ON trade_suggestions(league_id);
CREATE INDEX IF NOT EXISTS idx_trade_suggestions_target ON trade_suggestions(target_player_id);
CREATE INDEX IF NOT EXISTS idx_lineup_recommendations_week ON lineup_recommendations(season, week);
CREATE INDEX IF NOT EXISTS idx_draft_sessions_draft ON draft_sessions(draft_id);
CREATE INDEX IF NOT EXISTS idx_draft_picks_draft ON draft_picks(draft_id);
CREATE INDEX IF NOT EXISTS idx_draft_recommendations_draft ON draft_recommendations(draft_id);

-- ============================================
-- RLS Policies
-- ============================================

ALTER TABLE league_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE owner_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE trade_suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE lineup_recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE draft_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE draft_picks ENABLE ROW LEVEL SECURITY;
ALTER TABLE draft_recommendations ENABLE ROW LEVEL SECURITY;

-- Allow public read
DO $$ BEGIN CREATE POLICY "league_profiles_read" ON league_profiles FOR SELECT USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "owner_profiles_read" ON owner_profiles FOR SELECT USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "trade_suggestions_read" ON trade_suggestions FOR SELECT USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "lineup_recommendations_read" ON lineup_recommendations FOR SELECT USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "draft_sessions_read" ON draft_sessions FOR SELECT USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "draft_picks_read" ON draft_picks FOR SELECT USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "draft_recommendations_read" ON draft_recommendations FOR SELECT USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Allow service write
DO $$ BEGIN CREATE POLICY "league_profiles_write" ON league_profiles FOR INSERT WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "owner_profiles_write" ON owner_profiles FOR INSERT WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "trade_suggestions_write" ON trade_suggestions FOR INSERT WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "lineup_recommendations_write" ON lineup_recommendations FOR INSERT WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "draft_sessions_write" ON draft_sessions FOR INSERT WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "draft_picks_write" ON draft_picks FOR INSERT WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "draft_recommendations_write" ON draft_recommendations FOR INSERT WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Allow service update
DO $$ BEGIN CREATE POLICY "league_profiles_update" ON league_profiles FOR UPDATE USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "owner_profiles_update" ON owner_profiles FOR UPDATE USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "draft_sessions_update" ON draft_sessions FOR UPDATE USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "draft_picks_update" ON draft_picks FOR UPDATE USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "draft_recommendations_update" ON draft_recommendations FOR UPDATE USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

SELECT 'Migration 006 complete!' as status;
