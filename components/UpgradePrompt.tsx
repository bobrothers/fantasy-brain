'use client';

import Link from 'next/link';
import { FeatureType, FREE_LIMITS, getRemainingUses } from '@/lib/usage';

interface UpgradePromptProps {
  feature: FeatureType;
  onClose?: () => void;
}

const FEATURE_NAMES: Record<FeatureType, string> = {
  player_analysis: 'player analyses',
  trade_analysis: 'trade analyses',
  team_diagnosis: 'players in diagnosis',
};

export default function UpgradePrompt({ feature, onClose }: UpgradePromptProps) {
  const remaining = getRemainingUses(feature);
  const limit = FREE_LIMITS[feature];
  const featureName = FEATURE_NAMES[feature];

  return (
    <div className="bg-amber-950/50 border border-amber-700 p-4 mb-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-amber-400 font-bold text-sm uppercase">
              {remaining === 0 ? 'Limit Reached' : 'Almost at Limit'}
            </span>
          </div>
          <p className="text-zinc-300 text-sm mb-3">
            {remaining === 0 ? (
              <>You've used all {limit} free {featureName} for today.</>
            ) : (
              <>You have {remaining} of {limit} free {featureName} remaining today.</>
            )}
          </p>
          <Link
            href="/pricing"
            className="inline-block bg-amber-400 text-zinc-900 px-4 py-2 text-sm font-bold hover:bg-amber-300 transition-colors"
          >
            Upgrade to Pro - Unlimited Access
          </Link>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-zinc-300"
          >
            x
          </button>
        )}
      </div>
    </div>
  );
}

// Inline version for tight spaces
export function UpgradePromptInline({ feature }: { feature: FeatureType }) {
  const remaining = getRemainingUses(feature);
  const limit = FREE_LIMITS[feature];

  if (remaining === Infinity) return null;

  return (
    <div className="flex items-center gap-3 text-sm">
      <span className={`${remaining === 0 ? 'text-red-400' : remaining <= 1 ? 'text-amber-400' : 'text-zinc-500'}`}>
        {remaining}/{limit} remaining
      </span>
      {remaining <= 1 && (
        <Link
          href="/pricing"
          className="text-amber-400 hover:text-amber-300 font-bold"
        >
          Upgrade
        </Link>
      )}
    </div>
  );
}

// Blocking overlay when limit is hit
export function LimitReachedOverlay({ feature, onClose }: UpgradePromptProps) {
  const featureName = FEATURE_NAMES[feature];

  return (
    <div className="fixed inset-0 bg-zinc-950/90 flex items-center justify-center z-50 p-4">
      <div className="bg-zinc-900 border-2 border-amber-500 p-8 max-w-md w-full text-center">
        <div className="text-5xl mb-4">🔒</div>
        <h2 className="text-xl font-bold text-white mb-2">
          Daily Limit Reached
        </h2>
        <p className="text-zinc-400 mb-6">
          You've used all your free {featureName} for today.
          Upgrade to Pro for unlimited access.
        </p>
        <div className="space-y-3">
          <Link
            href="/pricing"
            className="block w-full bg-amber-400 text-zinc-900 px-6 py-3 font-bold hover:bg-amber-300 transition-colors"
          >
            Upgrade to Pro - $7.99/mo
          </Link>
          {onClose && (
            <button
              onClick={onClose}
              className="block w-full bg-zinc-700 text-zinc-300 px-6 py-3 font-bold hover:bg-zinc-600 transition-colors"
            >
              Try Again Tomorrow
            </button>
          )}
        </div>
        <div className="mt-4 text-xs text-zinc-600">
          Limits reset at midnight
        </div>
      </div>
    </div>
  );
}
