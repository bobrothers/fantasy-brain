/**
 * Supabase Client
 *
 * Provides both browser (anon) and server (service role) clients.
 * Server client has full access for inserting predictions/outcomes.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// Validate config
export function isSupabaseConfigured(): boolean {
  return !!(supabaseUrl && supabaseAnonKey);
}

// Browser/public client (read-only for most operations)
let browserClient: SupabaseClient | null = null;

export function getSupabaseBrowser(): SupabaseClient {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY');
  }

  if (!browserClient) {
    browserClient = createClient(supabaseUrl, supabaseAnonKey);
  }
  return browserClient;
}

// Server client with service role (full access)
let serverClient: SupabaseClient | null = null;

export function getSupabaseServer(): SupabaseClient {
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Supabase server not configured. Set SUPABASE_SERVICE_ROLE_KEY');
  }

  if (!serverClient) {
    serverClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }
  return serverClient;
}

// Type definitions for our tables
export interface PredictionRow {
  id?: string;
  player_id: string;
  player_name: string;
  position: string;
  team: string | null;
  week: number;
  season: number;
  edge_score: number;
  confidence: number;
  recommendation: string;
  edge_signals: Record<string, unknown>;
  game_time: string | null;
  opponent: string | null;
  is_home: boolean | null;
  created_at?: string;
}

export interface OutcomeRow {
  id?: string;
  player_id: string;
  player_name: string;
  position: string;
  week: number;
  season: number;
  fantasy_points: number;
  position_rank: number | null;
  stats: Record<string, unknown> | null;
  created_at?: string;
}

export interface EdgeAccuracyRow {
  id?: string;
  edge_type: string;
  season: number;
  total_predictions: number;
  correct_predictions: number;
  hit_rate: number | null;
  high_conf_total: number;
  high_conf_correct: number;
  med_conf_total: number;
  med_conf_correct: number;
  low_conf_total: number;
  low_conf_correct: number;
  qb_hit_rate: number | null;
  rb_hit_rate: number | null;
  wr_hit_rate: number | null;
  te_hit_rate: number | null;
  updated_at?: string;
}

// Combined prediction with outcome for analysis
export interface PredictionWithOutcome extends PredictionRow {
  outcomes: OutcomeRow;
}
