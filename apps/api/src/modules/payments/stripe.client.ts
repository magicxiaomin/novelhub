import Stripe from 'stripe';

const STRIPE_API_VERSION: Stripe.LatestApiVersion = '2025-02-24.acacia';

const log = {
  log(msg: string): void {
    // eslint-disable-next-line no-console
    console.log(`[StripeClient] ${msg}`);
  },
};

/**
 * Lazy Stripe client wrapper. Constructed with an optional secret key so the
 * Nest factory (Phase 0) can read from `process.env.STRIPE_SECRET_KEY` and
 * the Worker factory can read from the per-request env bag — neither stack
 * has to plumb an injected key through the service constructors.
 *
 * `get()` throws if no key was provided when the wrapper was built. The Nest
 * boot path tolerates a missing key (CI / local dev without billing) by
 * deferring this throw until the first method that actually calls Stripe.
 */
export class LazyStripe {
  private cached: Stripe | null = null;

  constructor(private readonly secretKey: string | undefined) {}

  get(): Stripe {
    if (this.cached) return this.cached;
    if (!this.secretKey) {
      throw new Error('Stripe is not configured (set STRIPE_SECRET_KEY in env).');
    }
    this.cached = new Stripe(this.secretKey, { apiVersion: STRIPE_API_VERSION });
    log.log('Stripe client initialized');
    return this.cached;
  }
}

export type StripeClient = LazyStripe;
