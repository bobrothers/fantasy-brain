-- Edge Weight Learning System
-- Stores learned weights for each edge type based on historical accuracy

CREATE TABLE edge_weights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  edge_type TEXT NOT NULL UNIQUE,

  -- Base and learned weights
  base_weight NUMERIC(4,2) DEFAULT 1.0,      -- Starting multiplier (never changes)
  current_weight NUMERIC(4,2) DEFAULT 1.0,   -- Learned overall weight

  -- Position-specific learned weights
  qb_weight NUMERIC(4,2) DEFAULT 1.0,
  rb_weight NUMERIC(4,2) DEFAULT 1.0,
  wr_weight NUMERIC(4,2) DEFAULT 1.0,
  te_weight NUMERIC(4,2) DEFAULT 1.0,

  -- Confidence calibration (add to confidence scores)
  confidence_adjustment INTEGER DEFAULT 0,

  -- Performance tracking
  total_predictions INTEGER DEFAULT 0,
  correct_predictions INTEGER DEFAULT 0,
  hit_rate NUMERIC(5,2),

  -- Position-specific performance
  qb_predictions INTEGER DEFAULT 0,
  qb_correct INTEGER DEFAULT 0,
  rb_predictions INTEGER DEFAULT 0,
  rb_correct INTEGER DEFAULT 0,
  wr_predictions INTEGER DEFAULT 0,
  wr_correct INTEGER DEFAULT 0,
  te_predictions INTEGER DEFAULT 0,
  te_correct INTEGER DEFAULT 0,

  -- Learning metadata
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Weight history for tracking changes over time
CREATE TABLE weight_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  edge_type TEXT NOT NULL,
  season INTEGER NOT NULL,
  week INTEGER NOT NULL,

  -- Weights at this point in time
  weight_before NUMERIC(4,2),
  weight_after NUMERIC(4,2),

  -- What triggered the change
  hit_rate_this_week NUMERIC(5,2),
  sample_size INTEGER,
  adjustment_reason TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for querying weight history
CREATE INDEX idx_weight_history_edge ON weight_history(edge_type, season, week);

-- Enable RLS
ALTER TABLE edge_weights ENABLE ROW LEVEL SECURITY;
ALTER TABLE weight_history ENABLE ROW LEVEL SECURITY;

-- Public read access
CREATE POLICY "Allow public read" ON edge_weights FOR SELECT USING (true);
CREATE POLICY "Allow public read" ON weight_history FOR SELECT USING (true);

-- Service role write access
CREATE POLICY "Allow service insert" ON edge_weights FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow service update" ON edge_weights FOR UPDATE USING (true);
CREATE POLICY "Allow service insert" ON weight_history FOR INSERT WITH CHECK (true);

-- Initialize with all known edge types
INSERT INTO edge_weights (edge_type) VALUES
  ('weather_wind'),
  ('weather_cold'),
  ('weather_rain'),
  ('weather_snow'),
  ('weather_dome'),
  ('travel_distance'),
  ('travel_timezone'),
  ('rest_advantage'),
  ('rest_short_week'),
  ('ol_injury'),
  ('betting_spread'),
  ('betting_total'),
  ('betting_line_move'),
  ('matchup_defense'),
  ('matchup_def_injury'),
  ('usage_target_share'),
  ('usage_snap_count'),
  ('usage_opportunity'),
  ('contract_incentive'),
  ('revenge_game'),
  ('redzone_usage'),
  ('home_away_split'),
  ('primetime_performance'),
  ('division_rivalry'),
  ('indoor_outdoor'),
  ('coverage_matchup')
ON CONFLICT (edge_type) DO NOTHING;
