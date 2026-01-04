/**
 * Stripe Configuration
 *
 * Products:
 * - Pro Monthly: $7.99/month
 * - Pro Yearly: $79.99/year (save ~17%)
 */

// Price IDs from Stripe Dashboard
// These will be set after creating products in Stripe
export const STRIPE_PRICES = {
  PRO_MONTHLY: process.env.NEXT_PUBLIC_STRIPE_PRICE_MONTHLY || '',
  PRO_YEARLY: process.env.NEXT_PUBLIC_STRIPE_PRICE_YEARLY || '',
};

// Plan details for display
export const PLANS = {
  free: {
    name: 'Free',
    price: 0,
    interval: null,
    features: [
      '3 player analyses per day',
      '1 trade analysis per day',
      'Team diagnosis (5 players max)',
      'Basic edge detection',
    ],
    limitations: [
      'Limited daily usage',
      'No priority support',
    ],
  },
  pro_monthly: {
    name: 'Pro',
    price: 7.99,
    interval: 'month' as const,
    priceId: STRIPE_PRICES.PRO_MONTHLY,
    features: [
      'Unlimited player analyses',
      'Unlimited trade analyses',
      'Full team diagnosis',
      'All edge detectors',
      'Priority support',
      'All future features',
    ],
    limitations: [],
  },
  pro_yearly: {
    name: 'Pro (Annual)',
    price: 79.99,
    interval: 'year' as const,
    priceId: STRIPE_PRICES.PRO_YEARLY,
    savings: '17%',
    features: [
      'Everything in Pro Monthly',
      'Save 17% vs monthly',
      '2 months free',
    ],
    limitations: [],
  },
};

// Create checkout session
export async function createCheckoutSession(
  priceId: string,
  successUrl: string,
  cancelUrl: string
): Promise<{ sessionId: string; url: string } | { error: string }> {
  try {
    const response = await fetch('/api/stripe/create-checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        priceId,
        successUrl,
        cancelUrl,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return { error: data.error || 'Failed to create checkout session' };
    }

    return { sessionId: data.sessionId, url: data.url };
  } catch (error) {
    return { error: 'Failed to connect to payment server' };
  }
}

// Redirect to Stripe Checkout
export async function redirectToCheckout(priceId: string): Promise<void> {
  const successUrl = `${window.location.origin}/pro/success?session_id={CHECKOUT_SESSION_ID}`;
  const cancelUrl = `${window.location.origin}/pricing`;

  const result = await createCheckoutSession(priceId, successUrl, cancelUrl);

  if ('error' in result) {
    throw new Error(result.error);
  }

  // Redirect to Stripe checkout URL
  if (result.url) {
    window.location.href = result.url;
  } else {
    throw new Error('No checkout URL returned');
  }
}

// Customer portal for managing subscription
export async function redirectToCustomerPortal(): Promise<void> {
  try {
    const response = await fetch('/api/stripe/create-portal', {
      method: 'POST',
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to create portal session');
    }

    window.location.href = data.url;
  } catch (error) {
    throw error;
  }
}

export default {
  PLANS,
  STRIPE_PRICES,
  createCheckoutSession,
  redirectToCheckout,
  redirectToCustomerPortal,
};
