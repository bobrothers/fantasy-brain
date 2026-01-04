'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { setProStatus } from '@/lib/usage';

function ProSuccessContent() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('session_id');
  const [activated, setActivated] = useState(false);

  useEffect(() => {
    if (sessionId && !activated) {
      // Activate Pro status locally
      // In a full implementation, you would verify the session with Stripe
      const expiresAt = new Date();
      expiresAt.setFullYear(expiresAt.getFullYear() + 1); // 1 year from now

      setProStatus({
        isPro: true,
        subscriptionId: sessionId,
        expiresAt: expiresAt.toISOString(),
        plan: 'monthly', // Could detect from session
      });

      setActivated(true);
    }
  }, [sessionId, activated]);

  return (
    <div className="max-w-md w-full mx-4">
      <div className="bg-zinc-900 border-2 border-emerald-500 p-8 text-center">
        {/* Success Icon */}
        <div className="text-6xl mb-6">
          <span className="inline-block animate-bounce">🎉</span>
        </div>

        <h1 className="text-2xl font-bold mb-4">
          <span className="text-emerald-400">Welcome to</span>{' '}
          <span className="text-amber-400">Pro!</span>
        </h1>

        <p className="text-zinc-400 mb-6">
          Your subscription is now active. You have unlimited access to all Fantasy Brain features.
        </p>

        <div className="bg-zinc-800 border border-zinc-700 p-4 mb-6 text-left">
          <div className="text-xs text-zinc-500 uppercase tracking-wider mb-2">Your Pro Benefits</div>
          <ul className="space-y-2 text-sm">
            <li className="flex items-center gap-2 text-zinc-300">
              <span className="text-emerald-400">+</span>
              Unlimited player analyses
            </li>
            <li className="flex items-center gap-2 text-zinc-300">
              <span className="text-emerald-400">+</span>
              Unlimited trade analyses
            </li>
            <li className="flex items-center gap-2 text-zinc-300">
              <span className="text-emerald-400">+</span>
              Full team diagnosis
            </li>
            <li className="flex items-center gap-2 text-zinc-300">
              <span className="text-emerald-400">+</span>
              All 15 edge detectors
            </li>
            <li className="flex items-center gap-2 text-zinc-300">
              <span className="text-emerald-400">+</span>
              Priority support
            </li>
          </ul>
        </div>

        <div className="space-y-3">
          <Link
            href="/"
            className="block w-full bg-amber-400 text-zinc-900 px-6 py-3 font-bold hover:bg-amber-300 transition-colors"
          >
            Start Analyzing
          </Link>
          <Link
            href="/diagnose"
            className="block w-full bg-zinc-700 text-zinc-300 px-6 py-3 font-bold hover:bg-zinc-600 transition-colors"
          >
            Diagnose My Team
          </Link>
        </div>

        <div className="mt-6 text-xs text-zinc-600">
          A receipt has been sent to your email.
        </div>
      </div>

      {/* Pro Badge Preview */}
      <div className="mt-6 text-center">
        <div className="inline-flex items-center gap-2 bg-amber-400/10 border border-amber-500/30 px-4 py-2 text-sm">
          <span className="text-amber-400 font-bold">PRO</span>
          <span className="text-zinc-400">badge now visible in header</span>
        </div>
      </div>
    </div>
  );
}

function LoadingFallback() {
  return (
    <div className="max-w-md w-full mx-4 text-center">
      <div className="w-12 h-12 border-2 border-zinc-800 border-t-amber-400 rounded-full animate-spin mx-auto" />
      <p className="mt-4 text-zinc-500">Loading...</p>
    </div>
  );
}

export default function ProSuccessPage() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-mono flex items-center justify-center">
      <Suspense fallback={<LoadingFallback />}>
        <ProSuccessContent />
      </Suspense>
    </div>
  );
}
