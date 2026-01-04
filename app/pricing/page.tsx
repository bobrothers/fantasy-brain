'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { PLANS, STRIPE_PRICES, redirectToCheckout } from '@/lib/stripe';
import { getProStatus, getUsageStats } from '@/lib/usage';

export default function PricingPage() {
  const [loading, setLoading] = useState<'monthly' | 'yearly' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPro, setIsPro] = useState(false);
  const [billingInterval, setBillingInterval] = useState<'monthly' | 'yearly'>('monthly');

  useEffect(() => {
    const status = getProStatus();
    setIsPro(status.isPro);
  }, []);

  const handleSubscribe = async (plan: 'monthly' | 'yearly') => {
    setLoading(plan);
    setError(null);

    try {
      const priceId = plan === 'monthly'
        ? STRIPE_PRICES.PRO_MONTHLY
        : STRIPE_PRICES.PRO_YEARLY;

      if (!priceId) {
        throw new Error('Stripe not configured. Please contact support.');
      }

      await redirectToCheckout(priceId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start checkout');
      setLoading(null);
    }
  };

  const monthlyPrice = PLANS.pro_monthly.price;
  const yearlyPrice = PLANS.pro_yearly.price;
  const yearlyMonthly = (yearlyPrice / 12).toFixed(2);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-mono">
      {/* Header */}
      <header className="border-b border-zinc-800 bg-zinc-900/80 backdrop-blur-sm sticky top-0 z-40">
        <div className="flex items-center justify-between px-4 py-2 max-w-6xl mx-auto">
          <div className="flex items-center gap-6">
            <Link href="/" className="text-lg tracking-tight hover:opacity-80 transition-opacity">
              <span className="text-amber-400 font-bold">FANTASY</span>
              <span className="text-zinc-400">BRAIN</span>
            </Link>
            <nav className="flex items-center gap-4 text-sm">
              <Link href="/" className="text-zinc-400 hover:text-white transition-colors">Analysis</Link>
              <Link href="/trade" className="text-zinc-400 hover:text-white transition-colors">Trade</Link>
              <Link href="/diagnose" className="text-zinc-400 hover:text-white transition-colors">Diagnose</Link>
              <Link href="/pricing" className="text-white">Pricing</Link>
            </nav>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-3xl font-bold mb-4">
            <span className="text-amber-400">UPGRADE</span> TO PRO
          </h1>
          <p className="text-zinc-400 max-w-xl mx-auto">
            Unlock unlimited access to all Fantasy Brain features.
            Make smarter decisions all season long.
          </p>
        </div>

        {/* Already Pro */}
        {isPro && (
          <div className="bg-emerald-950/30 border border-emerald-700 p-6 text-center mb-8">
            <div className="text-emerald-400 text-xl font-bold mb-2">
              You're a Pro Member!
            </div>
            <p className="text-zinc-400 mb-4">
              You have unlimited access to all features.
            </p>
            <Link
              href="/"
              className="inline-block bg-emerald-500 text-zinc-900 px-6 py-2 font-bold hover:bg-emerald-400 transition-colors"
            >
              Start Analyzing
            </Link>
          </div>
        )}

        {/* Billing Toggle */}
        {!isPro && (
          <div className="flex justify-center mb-8">
            <div className="bg-zinc-900 border border-zinc-700 p-1 inline-flex">
              <button
                onClick={() => setBillingInterval('monthly')}
                className={`px-6 py-2 text-sm font-bold transition-colors ${
                  billingInterval === 'monthly'
                    ? 'bg-amber-400 text-zinc-900'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                Monthly
              </button>
              <button
                onClick={() => setBillingInterval('yearly')}
                className={`px-6 py-2 text-sm font-bold transition-colors ${
                  billingInterval === 'yearly'
                    ? 'bg-amber-400 text-zinc-900'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                Yearly <span className="text-emerald-400 ml-1">Save 17%</span>
              </button>
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="bg-red-950/50 border border-red-800 px-4 py-3 mb-8 text-center">
            <span className="text-red-400">{error}</span>
          </div>
        )}

        {/* Pricing Cards */}
        <div className="grid md:grid-cols-2 gap-6 max-w-3xl mx-auto">
          {/* Free Tier */}
          <div className="bg-zinc-900 border border-zinc-700 p-6">
            <div className="text-center mb-6">
              <h2 className="text-xl font-bold text-zinc-300 mb-2">Free</h2>
              <div className="text-4xl font-black text-zinc-400">
                $0
                <span className="text-lg font-normal">/month</span>
              </div>
            </div>

            <ul className="space-y-3 mb-6">
              {PLANS.free.features.map((feature, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-zinc-400">
                  <span className="text-zinc-600">-</span>
                  {feature}
                </li>
              ))}
            </ul>

            <div className="border-t border-zinc-800 pt-4 mb-6">
              <div className="text-xs text-zinc-600 uppercase tracking-wider mb-2">Limitations</div>
              <ul className="space-y-1">
                {PLANS.free.limitations.map((limit, i) => (
                  <li key={i} className="text-xs text-zinc-500">
                    {limit}
                  </li>
                ))}
              </ul>
            </div>

            <Link
              href="/"
              className="block w-full text-center bg-zinc-700 text-zinc-300 px-6 py-3 font-bold hover:bg-zinc-600 transition-colors"
            >
              Current Plan
            </Link>
          </div>

          {/* Pro Tier */}
          <div className="bg-zinc-900 border-2 border-amber-500 p-6 relative">
            {/* Popular badge */}
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-amber-400 text-zinc-900 px-4 py-1 text-xs font-bold uppercase">
              Most Popular
            </div>

            <div className="text-center mb-6">
              <h2 className="text-xl font-bold text-amber-400 mb-2">Pro</h2>
              <div className="text-4xl font-black text-white">
                ${billingInterval === 'monthly' ? monthlyPrice : yearlyMonthly}
                <span className="text-lg font-normal text-zinc-400">/month</span>
              </div>
              {billingInterval === 'yearly' && (
                <div className="text-sm text-emerald-400 mt-1">
                  ${yearlyPrice}/year (save ${(monthlyPrice * 12 - yearlyPrice).toFixed(2)})
                </div>
              )}
            </div>

            <ul className="space-y-3 mb-6">
              {PLANS.pro_monthly.features.map((feature, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-zinc-200">
                  <span className="text-emerald-400">+</span>
                  {feature}
                </li>
              ))}
            </ul>

            <button
              onClick={() => handleSubscribe(billingInterval)}
              disabled={loading !== null || isPro}
              className="w-full bg-amber-400 text-zinc-900 px-6 py-3 font-bold hover:bg-amber-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading === billingInterval ? (
                <span className="inline-flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-zinc-900 border-t-transparent rounded-full animate-spin" />
                  Processing...
                </span>
              ) : isPro ? (
                'Current Plan'
              ) : (
                `Subscribe - $${billingInterval === 'monthly' ? monthlyPrice : yearlyPrice}/${billingInterval === 'monthly' ? 'mo' : 'yr'}`
              )}
            </button>
          </div>
        </div>

        {/* Feature Comparison */}
        <div className="mt-16">
          <h2 className="text-xl font-bold text-center mb-8">Feature Comparison</h2>
          <div className="bg-zinc-900 border border-zinc-700 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-700 bg-zinc-800/50">
                  <th className="text-left px-4 py-3 text-zinc-400">Feature</th>
                  <th className="text-center px-4 py-3 text-zinc-400">Free</th>
                  <th className="text-center px-4 py-3 text-amber-400">Pro</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-zinc-800">
                  <td className="px-4 py-3 text-zinc-300">Player Analysis</td>
                  <td className="px-4 py-3 text-center text-zinc-500">3/day</td>
                  <td className="px-4 py-3 text-center text-emerald-400">Unlimited</td>
                </tr>
                <tr className="border-b border-zinc-800">
                  <td className="px-4 py-3 text-zinc-300">Trade Analysis</td>
                  <td className="px-4 py-3 text-center text-zinc-500">1/day</td>
                  <td className="px-4 py-3 text-center text-emerald-400">Unlimited</td>
                </tr>
                <tr className="border-b border-zinc-800">
                  <td className="px-4 py-3 text-zinc-300">Team Diagnosis</td>
                  <td className="px-4 py-3 text-center text-zinc-500">5 players max</td>
                  <td className="px-4 py-3 text-center text-emerald-400">Full roster</td>
                </tr>
                <tr className="border-b border-zinc-800">
                  <td className="px-4 py-3 text-zinc-300">Screenshot Upload</td>
                  <td className="px-4 py-3 text-center text-emerald-400">Yes</td>
                  <td className="px-4 py-3 text-center text-emerald-400">Yes</td>
                </tr>
                <tr className="border-b border-zinc-800">
                  <td className="px-4 py-3 text-zinc-300">Edge Detectors</td>
                  <td className="px-4 py-3 text-center text-zinc-500">Basic</td>
                  <td className="px-4 py-3 text-center text-emerald-400">All 15</td>
                </tr>
                <tr className="border-b border-zinc-800">
                  <td className="px-4 py-3 text-zinc-300">Dynasty Valuations</td>
                  <td className="px-4 py-3 text-center text-emerald-400">Yes</td>
                  <td className="px-4 py-3 text-center text-emerald-400">Yes</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 text-zinc-300">Priority Support</td>
                  <td className="px-4 py-3 text-center text-zinc-600">-</td>
                  <td className="px-4 py-3 text-center text-emerald-400">Yes</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* FAQ */}
        <div className="mt-16 max-w-2xl mx-auto">
          <h2 className="text-xl font-bold text-center mb-8">FAQ</h2>
          <div className="space-y-4">
            <div className="bg-zinc-900 border border-zinc-700 p-4">
              <h3 className="font-bold text-zinc-200 mb-2">Can I cancel anytime?</h3>
              <p className="text-sm text-zinc-400">
                Yes! You can cancel your subscription at any time. You'll continue to have Pro access until the end of your billing period.
              </p>
            </div>
            <div className="bg-zinc-900 border border-zinc-700 p-4">
              <h3 className="font-bold text-zinc-200 mb-2">What payment methods do you accept?</h3>
              <p className="text-sm text-zinc-400">
                We accept all major credit cards (Visa, Mastercard, American Express) through Stripe's secure payment processing.
              </p>
            </div>
            <div className="bg-zinc-900 border border-zinc-700 p-4">
              <h3 className="font-bold text-zinc-200 mb-2">Do you offer refunds?</h3>
              <p className="text-sm text-zinc-400">
                If you're not satisfied within the first 7 days, contact us for a full refund. No questions asked.
              </p>
            </div>
            <div className="bg-zinc-900 border border-zinc-700 p-4">
              <h3 className="font-bold text-zinc-200 mb-2">What happens to my data if I cancel?</h3>
              <p className="text-sm text-zinc-400">
                Your usage data resets to free tier limits. We don't store your roster or analysis data permanently.
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-800 mt-16">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between text-xs text-zinc-600">
          <div>Secure payments by Stripe</div>
          <div>Fantasy Brain - Not financial advice</div>
        </div>
      </footer>
    </div>
  );
}
