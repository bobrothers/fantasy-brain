-- Combined Migration: AI Agent + Improvements
-- Run this single file in Supabase SQL Editor

-- ============================================
-- PART 1: AI Agent Tables (003)
-- ============================================

CREATE TABLE IF NOT EXISTS prediction_analysis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prediction_id UUID NOT NULL REFERENCES predictions(id),
  was_hit BOOLEAN NOT NULL,
  severity TEXT,
  predicted_rank INTEGER,
  actual_rank INTEGER,
  rank_diff INTEGER,
  edge_signals_used JSONB,
  strongest_signal TEXT,
  weakest_signal TEXT,
  actual_game_data JSONB,
  data_discrepancies JSONB,
  miss_reason TEXT,
  contributing_factors JSONB,
  improvement_suggestions JSONB,
  analyzed_at TIMESTAMPTZ DEFAULT NOW(),
  analysis_version TEXT DEFAULT 'v1'
);

CREATE TABLE IF NOT EXISTS detected_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pattern_type TEXT NOT NULL,
  pattern_key TEXT NOT NULL,
  total_predictions INTEGER NOT NULL,
  correct_predictions INTEGER NOT NULL,
  hit_rate NUMERIC(5,2) NOT NULL,
  sample_predictions UUID[],
  date_range_start DATE,
  date_range_end DATE,
  pattern_description TEXT,
  severity TEXT,
  root_cause_analysis TEXT,
  recommended_action TEXT,
  first_detected_at TIMESTAMPTZ DEFAULT NOW(),
  last_updated_at TIMESTAMPTZ DEFAULT NOW(),
  times_detected INTEGER DEFAULT 1,
  addressed BOOLEAN DEFAULT FALSE,
  UNIQUE(pattern_type, pattern_key)
);

CREATE TABLE IF NOT EXISTS improvement_proposals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pattern_id UUID REFERENCES detected_patterns(id),
  prediction_ids UUID[],
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL,
  priority TEXT NOT NULL,
  evidence JSONB NOT NULL,
  affected_edge_types TEXT[],
  proposed_code_changes JSONB,
  proposed_weight_changes JSONB,
  expected_improvement TEXT,
  status TEXT DEFAULT 'pending',
  github_issue_url TEXT,
  github_issue_number INTEGER,
  auto_applicable BOOLEAN DEFAULT FALSE,
  applied_at TIMESTAMPTZ,
  applied_by TEXT,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS applied_improvements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id UUID REFERENCES improvement_proposals(id),
  change_type TEXT NOT NULL,
  change_description TEXT NOT NULL,
  change_details JSONB NOT NULL,
  state_before JSONB NOT NULL,
  state_after JSONB NOT NULL,
  predictions_before INTEGER DEFAULT 0,
  predictions_after INTEGER DEFAULT 0,
  accuracy_before NUMERIC(5,2),
  accuracy_after NUMERIC(5,2),
  improvement_detected BOOLEAN,
  improvement_percentage NUMERIC(5,2),
  rolled_back BOOLEAN DEFAULT FALSE,
  rolled_back_at TIMESTAMPTZ,
  rollback_reason TEXT,
  applied_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for 003
CREATE INDEX IF NOT EXISTS idx_prediction_analysis_prediction ON prediction_analysis(prediction_id);
CREATE INDEX IF NOT EXISTS idx_prediction_analysis_severity ON prediction_analysis(severity);
CREATE INDEX IF NOT EXISTS idx_detected_patterns_type ON detected_patterns(pattern_type);
CREATE INDEX IF NOT EXISTS idx_detected_patterns_severity ON detected_patterns(severity);
CREATE INDEX IF NOT EXISTS idx_improvement_proposals_status ON improvement_proposals(status);
CREATE INDEX IF NOT EXISTS idx_applied_improvements_proposal ON applied_improvements(proposal_id);

-- RLS for 003
ALTER TABLE prediction_analysis ENABLE ROW LEVEL SECURITY;
ALTER TABLE detected_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE improvement_proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE applied_improvements ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Allow public read" ON prediction_analysis FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Allow public read" ON detected_patterns FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Allow public read" ON improvement_proposals FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Allow public read" ON applied_improvements FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Allow service write" ON prediction_analysis FOR INSERT WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Allow service update" ON prediction_analysis FOR UPDATE USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Allow service write" ON detected_patterns FOR INSERT WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Allow service update" ON detected_patterns FOR UPDATE USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Allow service write" ON improvement_proposals FOR INSERT WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Allow service update" ON improvement_proposals FOR UPDATE USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Allow service write" ON applied_improvements FOR INSERT WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Allow service update" ON applied_improvements FOR UPDATE USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================
-- PART 2: Agent Improvements (004)
-- ============================================

CREATE TABLE IF NOT EXISTS agent_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  decision_type TEXT NOT NULL,
  edge_type TEXT,
  data_analyzed JSONB NOT NULL,
  patterns_considered JSONB,
  sample_size INTEGER,
  reasoning TEXT NOT NULL,
  action_taken TEXT,
  action_details JSONB,
  improvement_id UUID REFERENCES applied_improvements(id),
  proposal_id UUID REFERENCES improvement_proposals(id),
  agent_version TEXT DEFAULT 'v1',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE applied_improvements
ADD COLUMN IF NOT EXISTS tagged_predictions UUID[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS evaluation_due_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS evaluation_complete BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS auto_rollback_triggered BOOLEAN DEFAULT FALSE;

ALTER TABLE predictions
ADD COLUMN IF NOT EXISTS active_improvements UUID[] DEFAULT '{}';

-- Indexes for 004
CREATE INDEX IF NOT EXISTS idx_agent_decisions_type ON agent_decisions(decision_type);
CREATE INDEX IF NOT EXISTS idx_agent_decisions_edge ON agent_decisions(edge_type);
CREATE INDEX IF NOT EXISTS idx_agent_decisions_created ON agent_decisions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_applied_improvements_evaluation ON applied_improvements(evaluation_due_at) WHERE NOT evaluation_complete;

-- RLS for 004
ALTER TABLE agent_decisions ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Allow public read" ON agent_decisions FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Allow service write" ON agent_decisions FOR INSERT WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Done!
SELECT 'Migration complete!' as status;
