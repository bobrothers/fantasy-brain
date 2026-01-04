/**
 * Weights API
 *
 * Returns current edge weights for display on the accuracy page.
 */

import { NextResponse } from 'next/server';
import { getAllWeights, getWeightHistory } from '@/lib/db/learning';

export async function GET() {
  try {
    const weights = await getAllWeights();

    return NextResponse.json({
      weights,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Weights] API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch weights' },
      { status: 500 }
    );
  }
}
