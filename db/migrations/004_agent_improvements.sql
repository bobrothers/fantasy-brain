-- Agent Improvements: Audit log, rollback tracking
-- Run after 003_ai_agent.sql

-- Decision audit log - tracks every agent decision even if no action taken
CREATE TABLE agent_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Decision context
  decision_type TEXT NOT NULL, -- 'weight_adjustment', 'skip_insufficient_data', 'auto_rollback', 'proposal_created', 'no_action'
  edge_type TEXT, -- Which edge this decision was about (if applicable)

  -- What the agent analyzed
  data_analyzed JSONB NOT NULL, -- Summary of data that led to this decision
  patterns_considered JSONB, -- Patterns that influenced the decision
  sample_size INTEGER, -- How many predictions were in the sample

  -- The reasoning
  reasoning TEXT NOT NULL, -- Why this decision was made

  -- What action was taken
  action_taken TEXT, -- 'applied', 'skipped', 'deferred', 'rolled_back', 'none'
  action_details JSONB, -- Specific details of the action

  -- Related records
  improvement_id UUID REFERENCES applied_improvements(id),
  proposal_id UUID REFERENCES improvement_proposals(id),

  -- Metadata
  agent_version TEXT DEFAULT 'v1',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add rollback tracking columns to applied_improvements
ALTER TABLE applied_improvements
ADD COLUMN IF NOT EXISTS tagged_predictions UUID[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS evaluation_due_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS evaluation_complete BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS auto_rollback_triggered BOOLEAN DEFAULT FALSE;

-- Add improvement_id to predictions for tracking which improvement was active
ALTER TABLE predictions
ADD COLUMN IF NOT EXISTS active_improvements UUID[] DEFAULT '{}';

-- Indexes
CREATE INDEX idx_agent_decisions_type ON agent_decisions(decision_type);
CREATE INDEX idx_agent_decisions_edge ON agent_decisions(edge_type);
CREATE INDEX idx_agent_decisions_created ON agent_decisions(created_at DESC);
CREATE INDEX idx_applied_improvements_evaluation ON applied_improvements(evaluation_due_at) WHERE NOT evaluation_complete;

-- RLS
ALTER TABLE agent_decisions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read" ON agent_decisions FOR SELECT USING (true);
CREATE POLICY "Allow service write" ON agent_decisions FOR INSERT WITH CHECK (true);
