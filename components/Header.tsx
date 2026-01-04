'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { getProStatus, getUsageStats, FeatureType, FREE_LIMITS } from '@/lib/usage';

interface HeaderProps {
  currentPage?: 'analysis' | 'trade' | 'waivers' | 'diagnose' | 'pricing';
  showUsage?: FeatureType;
}

export default function Header({ currentPage, showUsage }: HeaderProps) {
  const [time, setTime] = useState<Date | null>(null);
  const [isPro, setIsPro] = useState(false);
  const [usage, setUsage] = useState<ReturnType<typeof getUsageStats> | null>(null);

  useEffect(() => {
    setTime(new Date());
    const timer = setInterval(() => setTime(new Date()), 1000);

    // Check Pro status
    const status = getProStatus();
    setIsPro(status.isPro);

    // Get usage stats
    setUsage(getUsageStats());

    return () => clearInterval(timer);
  }, []);

  const getUsageDisplay = () => {
    if (!showUsage || !usage) return null;
    if (isPro) return null;

    const feature = usage.features[showUsage];
    const remaining = feature.remaining;
    const limit = FREE_LIMITS[showUsage];

    return (
      <div className={`text-xs ${remaining === 0 ? 'text-red-400' : remaining <= 1 ? 'text-amber-400' : 'text-zinc-500'}`}>
        {remaining}/{limit}
      </div>
    );
  };

  return (
    <header className="border-b border-zinc-800 bg-zinc-900/80 backdrop-blur-sm sticky top-0 z-40">
      <div className="flex items-center justify-between px-4 py-2">
        <div className="flex items-center gap-6">
          <Link href="/" className="text-lg tracking-tight hover:opacity-80 transition-opacity flex items-center gap-2">
            <span className="text-amber-400 font-bold">FANTASY</span>
            <span className="text-zinc-400">BRAIN</span>
            {isPro && (
              <span className="bg-amber-400 text-zinc-900 text-xs font-bold px-1.5 py-0.5">
                PRO
              </span>
            )}
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            <Link
              href="/"
              className={currentPage === 'analysis' ? 'text-white' : 'text-zinc-400 hover:text-white transition-colors'}
            >
              Analysis
            </Link>
            <Link
              href="/trade"
              className={currentPage === 'trade' ? 'text-white' : 'text-zinc-400 hover:text-white transition-colors'}
            >
              Trade
            </Link>
            <Link
              href="/waivers"
              className={currentPage === 'waivers' ? 'text-white' : 'text-zinc-400 hover:text-white transition-colors'}
            >
              Waivers
            </Link>
            <Link
              href="/diagnose"
              className={currentPage === 'diagnose' ? 'text-white' : 'text-zinc-400 hover:text-white transition-colors'}
            >
              Diagnose
            </Link>
            {!isPro && (
              <Link
                href="/pricing"
                className={`${currentPage === 'pricing' ? 'text-amber-400' : 'text-amber-400/70 hover:text-amber-400'} transition-colors font-bold`}
              >
                Upgrade
              </Link>
            )}
          </nav>
        </div>
        <div className="flex items-center gap-4 text-xs">
          {/* Usage counter */}
          {getUsageDisplay()}

          <div className="flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-zinc-500">LIVE</span>
          </div>
          <div className="text-zinc-400 tabular-nums">
            {time?.toLocaleTimeString('en-US', { hour12: false }) ?? '--:--:--'}
          </div>
        </div>
      </div>
    </header>
  );
}

// Compact usage counter for inline display
export function UsageCounter({ feature }: { feature: FeatureType }) {
  const [usage, setUsage] = useState<ReturnType<typeof getUsageStats> | null>(null);

  useEffect(() => {
    setUsage(getUsageStats());
  }, []);

  if (!usage) return null;
  if (usage.isPro) {
    return (
      <span className="text-xs text-emerald-400">
        Unlimited
      </span>
    );
  }

  const featureData = usage.features[feature];
  const remaining = featureData.remaining;
  const limit = FREE_LIMITS[feature];

  return (
    <span className={`text-xs ${remaining === 0 ? 'text-red-400' : remaining <= 1 ? 'text-amber-400' : 'text-zinc-500'}`}>
      {remaining}/{limit} remaining
    </span>
  );
}
