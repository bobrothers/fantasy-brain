-- AI Self-Improvement Agent Tables
-- Enables deep analysis of predictions and self-improving recommendations

-- Detailed analysis of each prediction after outcome
CREATE TABLE prediction_analysis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prediction_id UUID NOT NULL REFERENCES predictions(id),

  -- Outcome classification
  was_hit BOOLEAN NOT NULL,
  severity TEXT, -- 'minor_miss', 'major_miss', 'bad_miss', 'hit', 'smash_hit'
  predicted_rank INTEGER, -- What we expected (based on recommendation)
  actual_rank INTEGER, -- Where they actually finished
  rank_diff INTEGER, -- How far off we were

  -- What edges contributed
  edge_signals_used JSONB, -- Copy of signals from prediction
  strongest_signal TEXT, -- Edge type with highest magnitude
  weakest_signal TEXT, -- Edge type that contributed least

  -- Post-game data comparison
  actual_game_data JSONB, -- Final score, actual weather, etc.
  data_discrepancies JSONB, -- What was different from prediction time

  -- AI-generated analysis
  miss_reason TEXT, -- Claude's analysis of why we missed
  contributing_factors JSONB, -- Array of factors that led to miss
  improvement_suggestions JSONB, -- Specific suggestions for this case

  -- Metadata
  analyzed_at TIMESTAMPTZ DEFAULT NOW(),
  analysis_version TEXT DEFAULT 'v1'
);

-- Patterns detected across multiple predictions
CREATE TABLE detected_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pattern_type TEXT NOT NULL, -- 'team', 'edge_type', 'archetype', 'game_script', 'time_slot', etc.
  pattern_key TEXT NOT NULL, -- e.g., 'IND' for team, 'primetime_performance' for edge

  -- Statistics
  total_predictions INTEGER NOT NULL,
  correct_predictions INTEGER NOT NULL,
  hit_rate NUMERIC(5,2) NOT NULL,

  -- Context
  sample_predictions UUID[], -- IDs of predictions in this pattern
  date_range_start DATE,
  date_range_end DATE,

  -- Pattern details
  pattern_description TEXT, -- Human-readable description
  severity TEXT, -- 'critical' (<40%), 'concerning' (40-50%), 'notable' (50-55%)

  -- AI analysis
  root_cause_analysis TEXT, -- Claude's analysis of why this pattern exists
  recommended_action TEXT, -- What to do about it

  -- Tracking
  first_detected_at TIMESTAMPTZ DEFAULT NOW(),
  last_updated_at TIMESTAMPTZ DEFAULT NOW(),
  times_detected INTEGER DEFAULT 1,
  addressed BOOLEAN DEFAULT FALSE,

  UNIQUE(pattern_type, pattern_key)
);

-- Proposed improvements (for structural changes needing human review)
CREATE TABLE improvement_proposals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- What triggered this
  pattern_id UUID REFERENCES detected_patterns(id),
  prediction_ids UUID[], -- Related predictions

  -- Proposal details
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL, -- 'weight_adjustment', 'new_edge', 'data_source', 'threshold', 'code_change'
  priority TEXT NOT NULL, -- 'critical', 'high', 'medium', 'low'

  -- Evidence
  evidence JSONB NOT NULL, -- Supporting data for the proposal
  affected_edge_types TEXT[], -- Which edges this would change

  -- Proposed changes
  proposed_code_changes JSONB, -- Actual code diffs if applicable
  proposed_weight_changes JSONB, -- Weight adjustments
  expected_improvement TEXT, -- What we expect to happen

  -- Implementation status
  status TEXT DEFAULT 'pending', -- 'pending', 'approved', 'applied', 'rejected', 'rolled_back'
  github_issue_url TEXT, -- If we created an issue for it
  github_issue_number INTEGER,

  -- Review
  auto_applicable BOOLEAN DEFAULT FALSE, -- Can be applied without human review
  applied_at TIMESTAMPTZ,
  applied_by TEXT, -- 'auto' or user
  rejection_reason TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Track applied improvements and their impact
CREATE TABLE applied_improvements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id UUID REFERENCES improvement_proposals(id),

  -- What was changed
  change_type TEXT NOT NULL, -- 'weight', 'threshold', 'code', 'new_edge'
  change_description TEXT NOT NULL,
  change_details JSONB NOT NULL, -- Specific values changed

  -- Before state
  state_before JSONB NOT NULL, -- Weights/thresholds before change

  -- After state
  state_after JSONB NOT NULL, -- Weights/thresholds after change

  -- Impact tracking
  predictions_before INTEGER DEFAULT 0, -- Predictions made before this change
  predictions_after INTEGER DEFAULT 0, -- Predictions made after this change
  accuracy_before NUMERIC(5,2), -- Hit rate before
  accuracy_after NUMERIC(5,2), -- Hit rate after

  -- Effectiveness
  improvement_detected BOOLEAN, -- Did it help?
  improvement_percentage NUMERIC(5,2), -- How much better/worse

  -- Rollback info
  rolled_back BOOLEAN DEFAULT FALSE,
  rolled_back_at TIMESTAMPTZ,
  rollback_reason TEXT,

  applied_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_prediction_analysis_prediction ON prediction_analysis(prediction_id);
CREATE INDEX idx_prediction_analysis_severity ON prediction_analysis(severity);
CREATE INDEX idx_detected_patterns_type ON detected_patterns(pattern_type);
CREATE INDEX idx_detected_patterns_severity ON detected_patterns(severity);
CREATE INDEX idx_improvement_proposals_status ON improvement_proposals(status);
CREATE INDEX idx_applied_improvements_proposal ON applied_improvements(proposal_id);

-- RLS
ALTER TABLE prediction_analysis ENABLE ROW LEVEL SECURITY;
ALTER TABLE detected_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE improvement_proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE applied_improvements ENABLE ROW LEVEL SECURITY;

-- Read access
CREATE POLICY "Allow public read" ON prediction_analysis FOR SELECT USING (true);
CREATE POLICY "Allow public read" ON detected_patterns FOR SELECT USING (true);
CREATE POLICY "Allow public read" ON improvement_proposals FOR SELECT USING (true);
CREATE POLICY "Allow public read" ON applied_improvements FOR SELECT USING (true);

-- Write access (service role)
CREATE POLICY "Allow service write" ON prediction_analysis FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow service update" ON prediction_analysis FOR UPDATE USING (true);
CREATE POLICY "Allow service write" ON detected_patterns FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow service update" ON detected_patterns FOR UPDATE USING (true);
CREATE POLICY "Allow service write" ON improvement_proposals FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow service update" ON improvement_proposals FOR UPDATE USING (true);
CREATE POLICY "Allow service write" ON applied_improvements FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow service update" ON applied_improvements FOR UPDATE USING (true);
