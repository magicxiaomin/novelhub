import { Logger, type Provider } from '@nestjs/common';
import Stripe from 'stripe';

import { STRIPE_CLIENT } from './stripe.constants';

const STRIPE_API_VERSION: Stripe.LatestApiVersion = '2025-02-24.acacia';

class LazyStripe {
  private readonly logger = new Logger(LazyStripe.name);
  private cached: Stripe | null = null;

  get(): Stripe {
    if (this.cached) return this.cached;
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) {
      throw new Error('Stripe is not configured (set STRIPE_SECRET_KEY in env).');
    }
    this.cached = new Stripe(key, { apiVersion: STRIPE_API_VERSION });
    this.logger.log('Stripe client initialized');
    return this.cached;
  }
}

/**
 * Provides a thin lazy wrapper around the Stripe SDK so the app can boot
 * without `STRIPE_SECRET_KEY` (CI / local dev) while still failing cleanly
 * on the first endpoint that actually needs Stripe.
 */
export const StripeClientProvider: Provider = {
  provide: STRIPE_CLIENT,
  useFactory: (): LazyStripe => new LazyStripe(),
};

export type StripeClient = LazyStripe;
