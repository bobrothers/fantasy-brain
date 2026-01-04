-- Prediction Accuracy Tracking Schema
-- Run this in Supabase SQL Editor

-- Predictions table: Stores analysis snapshots before games
CREATE TABLE predictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id TEXT NOT NULL,
  player_name TEXT NOT NULL,
  position TEXT NOT NULL,
  team TEXT,
  week INTEGER NOT NULL,
  season INTEGER NOT NULL,

  -- Overall prediction
  edge_score NUMERIC(4,2) NOT NULL,
  confidence INTEGER NOT NULL,
  recommendation TEXT NOT NULL,

  -- Individual edge signals (JSONB for flexibility)
  edge_signals JSONB NOT NULL,

  -- Metadata
  game_time TIMESTAMPTZ,
  opponent TEXT,
  is_home BOOLEAN,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Unique constraint: one prediction per player per week
  UNIQUE(player_id, week, season)
);

-- Outcomes table: Actual fantasy points after games
CREATE TABLE outcomes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id TEXT NOT NULL,
  player_name TEXT NOT NULL,
  position TEXT NOT NULL,
  week INTEGER NOT NULL,
  season INTEGER NOT NULL,

  -- Fantasy performance
  fantasy_points NUMERIC(5,2) NOT NULL,
  position_rank INTEGER,

  -- Raw stats for analysis
  stats JSONB,

  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(player_id, week, season)
);

-- Edge accuracy cache: Pre-computed accuracy stats
CREATE TABLE edge_accuracy (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  edge_type TEXT NOT NULL,
  season INTEGER NOT NULL,

  -- Accuracy metrics
  total_predictions INTEGER DEFAULT 0,
  correct_predictions INTEGER DEFAULT 0,
  hit_rate NUMERIC(5,2),

  -- Breakdown by confidence
  high_conf_total INTEGER DEFAULT 0,
  high_conf_correct INTEGER DEFAULT 0,
  med_conf_total INTEGER DEFAULT 0,
  med_conf_correct INTEGER DEFAULT 0,
  low_conf_total INTEGER DEFAULT 0,
  low_conf_correct INTEGER DEFAULT 0,

  -- Breakdown by position
  qb_hit_rate NUMERIC(5,2),
  rb_hit_rate NUMERIC(5,2),
  wr_hit_rate NUMERIC(5,2),
  te_hit_rate NUMERIC(5,2),

  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(edge_type, season)
);

-- Indexes for common queries
CREATE INDEX idx_predictions_week ON predictions(season, week);
CREATE INDEX idx_predictions_player ON predictions(player_id);
CREATE INDEX idx_outcomes_week ON outcomes(season, week);
CREATE INDEX idx_outcomes_player ON outcomes(player_id);

-- Enable Row Level Security (optional but recommended)
ALTER TABLE predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE outcomes ENABLE ROW LEVEL SECURITY;
ALTER TABLE edge_accuracy ENABLE ROW LEVEL SECURITY;

-- Allow public read access (for the accuracy page)
CREATE POLICY "Allow public read" ON predictions FOR SELECT USING (true);
CREATE POLICY "Allow public read" ON outcomes FOR SELECT USING (true);
CREATE POLICY "Allow public read" ON edge_accuracy FOR SELECT USING (true);

-- Allow service role to insert/update (for the API)
CREATE POLICY "Allow service insert" ON predictions FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow service update" ON predictions FOR UPDATE USING (true);
CREATE POLICY "Allow service insert" ON outcomes FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow service update" ON outcomes FOR UPDATE USING (true);
CREATE POLICY "Allow service insert" ON edge_accuracy FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow service update" ON edge_accuracy FOR UPDATE USING (true);
