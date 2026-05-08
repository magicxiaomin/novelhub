/**
 * Zod schemas for the Hono `/payments/*` routes. Mirror the class-validator
 * constraints in apps/api/src/modules/payments/dto/checkout.dto.ts.
 */
import { COIN_PACKAGE_IDS, SUBSCRIPTION_PLAN_IDS } from '@novelhub/shared';
import { z } from 'zod';

// `z.enum` requires a non-empty literal tuple — assert the shared arrays
// satisfy that contract (they're defined as Object.keys of literal-keyed
// objects, so this is safe at runtime).
const coinPackageIdEnum = z.enum(COIN_PACKAGE_IDS as [string, ...string[]]);
const subscriptionPlanIdEnum = z.enum(SUBSCRIPTION_PLAN_IDS as [string, ...string[]]);

export const checkoutCoinsBodySchema = z.object({
  packageId: coinPackageIdEnum,
});

export const checkoutSubscriptionBodySchema = z.object({
  plan: subscriptionPlanIdEnum,
});

export type CheckoutCoinsBody = z.infer<typeof checkoutCoinsBodySchema>;
export type CheckoutSubscriptionBody = z.infer<typeof checkoutSubscriptionBodySchema>;
