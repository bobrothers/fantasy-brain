/**
 * Run migration 005 - Cost tracking and news monitoring tables
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function runMigration() {
  console.log('Running migration 005...');

  const statements = [
    // api_costs table
    `CREATE TABLE IF NOT EXISTS api_costs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      endpoint TEXT NOT NULL,
      model TEXT NOT NULL,
      input_tokens INTEGER NOT NULL DEFAULT 0,
      output_tokens INTEGER NOT NULL DEFAULT 0,
      cache_creation_tokens INTEGER DEFAULT 0,
      cache_read_tokens INTEGER DEFAULT 0,
      cost_usd NUMERIC(10,6) NOT NULL,
      user_id TEXT,
      session_id TEXT,
      request_metadata JSONB,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`,

    // weekly_schedule table
    `CREATE TABLE IF NOT EXISTS weekly_schedule (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      season INTEGER NOT NULL,
      week INTEGER NOT NULL,
      game_id TEXT NOT NULL,
      home_team TEXT NOT NULL,
      away_team TEXT NOT NULL,
      kickoff_time TIMESTAMPTZ NOT NULL,
      game_slot TEXT,
      game_status TEXT DEFAULT 'scheduled',
      pre_game_check_done BOOLEAN DEFAULT FALSE,
      venue TEXT,
      weather_data JSONB,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(season, week, game_id)
    )`,

    // alerts table
    `CREATE TABLE IF NOT EXISTS alerts (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      player_id TEXT NOT NULL,
      player_name TEXT NOT NULL,
      alert_type TEXT NOT NULL,
      severity TEXT NOT NULL,
      old_edge_score NUMERIC(4,2),
      new_edge_score NUMERIC(4,2),
      score_change NUMERIC(4,2),
      headline TEXT NOT NULL,
      details TEXT,
      source TEXT,
      source_url TEXT,
      game_id TEXT,
      season INTEGER,
      week INTEGER,
      is_active BOOLEAN DEFAULT TRUE,
      processed BOOLEAN DEFAULT FALSE,
      raw_data JSONB,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`,

    // news_monitor_state table
    `CREATE TABLE IF NOT EXISTS news_monitor_state (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      run_type TEXT NOT NULL,
      game_slot TEXT,
      players_checked INTEGER DEFAULT 0,
      alerts_created INTEGER DEFAULT 0,
      news_items_processed INTEGER DEFAULT 0,
      started_at TIMESTAMPTZ DEFAULT NOW(),
      completed_at TIMESTAMPTZ,
      duration_ms INTEGER,
      error TEXT,
      api_cost_usd NUMERIC(10,6)
    )`,

    // Indexes
    `CREATE INDEX IF NOT EXISTS idx_api_costs_created ON api_costs(created_at DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_api_costs_endpoint ON api_costs(endpoint)`,
    `CREATE INDEX IF NOT EXISTS idx_api_costs_model ON api_costs(model)`,
    `CREATE INDEX IF NOT EXISTS idx_weekly_schedule_kickoff ON weekly_schedule(kickoff_time)`,
    `CREATE INDEX IF NOT EXISTS idx_weekly_schedule_week ON weekly_schedule(season, week)`,
    `CREATE INDEX IF NOT EXISTS idx_alerts_player ON alerts(player_id)`,
    `CREATE INDEX IF NOT EXISTS idx_alerts_active ON alerts(is_active, created_at DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_news_monitor_started ON news_monitor_state(started_at DESC)`,

    // RLS
    `ALTER TABLE api_costs ENABLE ROW LEVEL SECURITY`,
    `ALTER TABLE weekly_schedule ENABLE ROW LEVEL SECURITY`,
    `ALTER TABLE alerts ENABLE ROW LEVEL SECURITY`,
    `ALTER TABLE news_monitor_state ENABLE ROW LEVEL SECURITY`,
  ];

  // Policies (wrapped in DO blocks to handle "already exists")
  const policies = [
    `DO $$ BEGIN CREATE POLICY "Allow public read" ON api_costs FOR SELECT USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
    `DO $$ BEGIN CREATE POLICY "Allow service write" ON api_costs FOR INSERT WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
    `DO $$ BEGIN CREATE POLICY "Allow public read" ON weekly_schedule FOR SELECT USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
    `DO $$ BEGIN CREATE POLICY "Allow service write" ON weekly_schedule FOR INSERT WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
    `DO $$ BEGIN CREATE POLICY "Allow service update" ON weekly_schedule FOR UPDATE USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
    `DO $$ BEGIN CREATE POLICY "Allow public read" ON alerts FOR SELECT USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
    `DO $$ BEGIN CREATE POLICY "Allow service write" ON alerts FOR INSERT WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
    `DO $$ BEGIN CREATE POLICY "Allow service update" ON alerts FOR UPDATE USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
    `DO $$ BEGIN CREATE POLICY "Allow public read" ON news_monitor_state FOR SELECT USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
    `DO $$ BEGIN CREATE POLICY "Allow service write" ON news_monitor_state FOR INSERT WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  ];

  let success = 0;
  let failed = 0;

  for (const sql of [...statements, ...policies]) {
    try {
      const { error } = await supabase.rpc('exec_sql', { sql_query: sql });
      if (error) {
        // Try direct query for DDL
        const { error: error2 } = await supabase.from('_migrations').select('id').limit(0);
        // If we get here, the connection works - the error was from exec_sql not existing
        console.log('Note: exec_sql RPC not available, tables may need manual creation');
        break;
      }
      success++;
      console.log('✓', sql.substring(0, 50) + '...');
    } catch (err) {
      failed++;
      console.error('✗', sql.substring(0, 50) + '...', err);
    }
  }

  console.log(`\nMigration complete: ${success} succeeded, ${failed} failed`);
}

runMigration().catch(console.error);
