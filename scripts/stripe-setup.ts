#!/usr/bin/env ts-node
/**
 * Provision Stripe Products + Prices for NovelHub's checkout flows.
 *
 * Idempotent: scans existing Products by metadata.novelhubId and reuses
 * matching ones; if a Product exists but its currently-active Price diverges
 * from the canonical priceUsd in `packages/shared`, a new Price is created
 * and the old one archived. Run as many times as you like — only diffs cause
 * writes.
 *
 * Coin packs (one-time) and subscription plans (recurring weekly/monthly)
 * are provisioned alike. The script prints a `.env` snippet you can paste
 * into `apps/api/.env` after running.
 *
 * Usage:
 *   STRIPE_SECRET_KEY=sk_test_... pnpm tsx scripts/stripe-setup.ts
 *   STRIPE_SECRET_KEY=sk_test_... pnpm tsx scripts/stripe-setup.ts --dry-run
 */
import {
  COIN_PACKAGE_IDS,
  COIN_PACKAGES,
  SUBSCRIPTION_PLAN_IDS,
  SUBSCRIPTION_PLANS,
  buildCoinPackageProductName,
} from '@novelhub/shared';
import Stripe from 'stripe';

const META_KEY = 'novelhubId';

type PrintLine = { envKey: string; value: string };

const usdMinor = (usd: number): number => Math.round(usd * 100);

const main = async (): Promise<void> => {
  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) {
    console.error('STRIPE_SECRET_KEY is required.');
    process.exit(1);
  }
  const dryRun = process.argv.includes('--dry-run');
  if (dryRun) console.log('[dry-run] no writes will be performed');

  const stripe = new Stripe(secret);
  const env: PrintLine[] = [];

  for (const id of COIN_PACKAGE_IDS) {
    const pkg = COIN_PACKAGES[id];
    const result = await ensureProductPrice(stripe, dryRun, {
      novelhubId: pkg.id,
      productName: buildCoinPackageProductName(pkg.label),
      unitAmount: usdMinor(pkg.priceUsd),
      currency: 'usd',
      recurring: null,
      metadata: { kind: 'coin_pack', coins: String(pkg.coins) },
    });
    env.push({
      envKey: `STRIPE_PRICE_${pkg.id.toUpperCase()}`,
      value: result.priceId,
    });
  }

  for (const id of SUBSCRIPTION_PLAN_IDS) {
    const plan = SUBSCRIPTION_PLANS[id];
    const result = await ensureProductPrice(stripe, dryRun, {
      novelhubId: plan.id,
      productName: `NovelHub — ${plan.label}`,
      unitAmount: usdMinor(plan.priceUsd),
      currency: 'usd',
      recurring: { interval: id === 'weekly' ? 'week' : 'month' },
      metadata: { kind: 'subscription_plan' },
    });
    env.push({
      envKey: `STRIPE_PRICE_${plan.id.toUpperCase()}`,
      value: result.priceId,
    });
  }

  console.log('\n# Append to apps/api/.env (or your secret store):');
  for (const line of env) {
    console.log(`${line.envKey}=${line.value}`);
  }
};

type EnsureSpec = {
  novelhubId: string;
  productName: string;
  unitAmount: number;
  currency: string;
  recurring: { interval: 'week' | 'month' } | null;
  metadata: Record<string, string>;
};

/**
 * Look up an existing Product by `metadata.novelhubId` and either reuse the
 * active price (if it matches) or replace it with a new one. Returns the
 * resulting Price id.
 */
const ensureProductPrice = async (
  stripe: Stripe,
  dryRun: boolean,
  spec: EnsureSpec,
): Promise<{ productId: string; priceId: string }> => {
  const search = await stripe.products.search({
    query: `metadata['${META_KEY}']:'${spec.novelhubId}'`,
  });

  let productId: string;
  if (search.data[0]) {
    productId = search.data[0].id;
    console.log(`[reuse] product ${productId} (${spec.productName})`);
  } else {
    if (dryRun) {
      console.log(`[dry-run] would create product ${spec.productName}`);
      productId = `prod_DRYRUN_${spec.novelhubId}`;
    } else {
      const product = await stripe.products.create({
        name: spec.productName,
        metadata: { ...spec.metadata, [META_KEY]: spec.novelhubId },
      });
      productId = product.id;
      console.log(`[create] product ${productId} (${spec.productName})`);
    }
  }

  // Prices are immutable, so we look for an active one matching the desired
  // shape. Stripe's `Price.search` doesn't expose unit_amount, so fall back
  // to listing active prices for the product and matching client-side.
  const prices = await stripe.prices.list({ product: productId, active: true, limit: 100 });
  const match = prices.data.find(
    (p) =>
      p.unit_amount === spec.unitAmount &&
      p.currency === spec.currency &&
      ((spec.recurring === null && p.recurring === null) ||
        (spec.recurring !== null && p.recurring?.interval === spec.recurring.interval)),
  );
  if (match) {
    console.log(`[reuse] price ${match.id} (${spec.unitAmount} ${spec.currency})`);
    return { productId, priceId: match.id };
  }

  // Archive any other active prices on this product so call sites that
  // expect "the active price" only see the new one.
  for (const p of prices.data) {
    if (dryRun) {
      console.log(`[dry-run] would archive stale price ${p.id}`);
    } else {
      await stripe.prices.update(p.id, { active: false });
      console.log(`[archive] stale price ${p.id}`);
    }
  }

  if (dryRun) {
    console.log(
      `[dry-run] would create price for ${spec.productName} (${spec.unitAmount} ${spec.currency})`,
    );
    return { productId, priceId: `price_DRYRUN_${spec.novelhubId}` };
  }
  const price = await stripe.prices.create({
    product: productId,
    unit_amount: spec.unitAmount,
    currency: spec.currency,
    recurring: spec.recurring ?? undefined,
    metadata: spec.metadata,
  });
  console.log(`[create] price ${price.id} (${spec.unitAmount} ${spec.currency})`);
  return { productId, priceId: price.id };
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
