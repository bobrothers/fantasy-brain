/**
 * Usage Tracking & Paywall System
 *
 * FREE TIER LIMITS:
 * - 3 player analyses per day
 * - 1 trade analysis per day
 * - Team diagnosis: limited to 5 players
 *
 * PRO TIER ($7.99/month):
 * - Unlimited everything
 */

// Feature types we track
export type FeatureType = 'player_analysis' | 'trade_analysis' | 'team_diagnosis';

// Free tier limits (temporarily unlimited for testing)
export const FREE_LIMITS: Record<FeatureType, number> = {
  player_analysis: 999,
  trade_analysis: 999,
  team_diagnosis: 999,
};

// Storage keys
const USAGE_KEY = 'fantasy_brain_usage';
const PRO_KEY = 'fantasy_brain_pro';
const LAST_RESET_KEY = 'fantasy_brain_last_reset';

interface UsageData {
  player_analysis: number;
  trade_analysis: number;
  team_diagnosis: number;
  lastReset: string; // ISO date string
}

interface ProStatus {
  isPro: boolean;
  subscriptionId?: string;
  expiresAt?: string;
  plan?: 'monthly' | 'yearly';
}

// Get today's date as YYYY-MM-DD
function getTodayString(): string {
  return new Date().toISOString().split('T')[0];
}

// Initialize or get usage data
function getUsageData(): UsageData {
  if (typeof window === 'undefined') {
    return {
      player_analysis: 0,
      trade_analysis: 0,
      team_diagnosis: 0,
      lastReset: getTodayString(),
    };
  }

  const stored = localStorage.getItem(USAGE_KEY);
  if (!stored) {
    const initial: UsageData = {
      player_analysis: 0,
      trade_analysis: 0,
      team_diagnosis: 0,
      lastReset: getTodayString(),
    };
    localStorage.setItem(USAGE_KEY, JSON.stringify(initial));
    return initial;
  }

  const data: UsageData = JSON.parse(stored);

  // Reset if it's a new day
  const today = getTodayString();
  if (data.lastReset !== today) {
    const reset: UsageData = {
      player_analysis: 0,
      trade_analysis: 0,
      team_diagnosis: 0,
      lastReset: today,
    };
    localStorage.setItem(USAGE_KEY, JSON.stringify(reset));
    return reset;
  }

  return data;
}

// Save usage data
function saveUsageData(data: UsageData): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(USAGE_KEY, JSON.stringify(data));
}

// Get Pro status
export function getProStatus(): ProStatus {
  if (typeof window === 'undefined') {
    return { isPro: false };
  }

  const stored = localStorage.getItem(PRO_KEY);
  if (!stored) {
    return { isPro: false };
  }

  const status: ProStatus = JSON.parse(stored);

  // Check if subscription has expired
  if (status.expiresAt) {
    const expires = new Date(status.expiresAt);
    if (expires < new Date()) {
      // Expired - clear Pro status
      localStorage.removeItem(PRO_KEY);
      return { isPro: false };
    }
  }

  return status;
}

// Set Pro status (called after successful Stripe checkout)
export function setProStatus(status: ProStatus): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(PRO_KEY, JSON.stringify(status));
}

// Clear Pro status (for testing or cancellation)
export function clearProStatus(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(PRO_KEY);
}

// Get current usage for a feature
export function getUsage(feature: FeatureType): number {
  const data = getUsageData();
  return data[feature];
}

// Get remaining uses for a feature
export function getRemainingUses(feature: FeatureType): number {
  const { isPro } = getProStatus();
  if (isPro) return Infinity;

  const used = getUsage(feature);
  const limit = FREE_LIMITS[feature];
  return Math.max(0, limit - used);
}

// Check if user can use a feature
export function canUseFeature(feature: FeatureType, count: number = 1): boolean {
  const { isPro } = getProStatus();
  if (isPro) return true;

  const remaining = getRemainingUses(feature);
  return remaining >= count;
}

// Record usage of a feature
export function recordUsage(feature: FeatureType, count: number = 1): boolean {
  const { isPro } = getProStatus();
  if (isPro) return true; // Pro users always succeed

  if (!canUseFeature(feature, count)) {
    return false; // Would exceed limit
  }

  const data = getUsageData();
  data[feature] += count;
  saveUsageData(data);
  return true;
}

// Get all usage stats for display
export function getUsageStats(): {
  isPro: boolean;
  plan?: 'monthly' | 'yearly';
  features: {
    [K in FeatureType]: {
      used: number;
      limit: number;
      remaining: number;
    };
  };
} {
  const proStatus = getProStatus();
  const usage = getUsageData();

  return {
    isPro: proStatus.isPro,
    plan: proStatus.plan,
    features: {
      player_analysis: {
        used: usage.player_analysis,
        limit: proStatus.isPro ? Infinity : FREE_LIMITS.player_analysis,
        remaining: proStatus.isPro ? Infinity : FREE_LIMITS.player_analysis - usage.player_analysis,
      },
      trade_analysis: {
        used: usage.trade_analysis,
        limit: proStatus.isPro ? Infinity : FREE_LIMITS.trade_analysis,
        remaining: proStatus.isPro ? Infinity : FREE_LIMITS.trade_analysis - usage.trade_analysis,
      },
      team_diagnosis: {
        used: usage.team_diagnosis,
        limit: proStatus.isPro ? Infinity : FREE_LIMITS.team_diagnosis,
        remaining: proStatus.isPro ? Infinity : FREE_LIMITS.team_diagnosis - usage.team_diagnosis,
      },
    },
  };
}

// Format limit message for display
export function getLimitMessage(feature: FeatureType): string {
  const remaining = getRemainingUses(feature);
  const limit = FREE_LIMITS[feature];

  if (remaining === Infinity) {
    return 'Unlimited (Pro)';
  }

  if (remaining === 0) {
    return `Daily limit reached (${limit}/${limit})`;
  }

  return `${remaining}/${limit} remaining today`;
}

// Check if user should see upgrade prompt
export function shouldShowUpgradePrompt(feature: FeatureType): boolean {
  const { isPro } = getProStatus();
  if (isPro) return false;

  const remaining = getRemainingUses(feature);
  return remaining <= 1; // Show when at last use or exhausted
}

export default {
  getProStatus,
  setProStatus,
  clearProStatus,
  getUsage,
  getRemainingUses,
  canUseFeature,
  recordUsage,
  getUsageStats,
  getLimitMessage,
  shouldShowUpgradePrompt,
  FREE_LIMITS,
};
