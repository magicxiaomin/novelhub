/**
 * Hono `/payments/*` routes — mirror apps/api/src/modules/payments/payments.controller.ts.
 *
 * All routes require auth. `fbConsent` is hard-coded to false on the Worker
 * for now — the FB CAPI module is not yet ported (Task 10). Once the FB CAPI
 * client lands on Workers, the Worker can recover the consent + user-data
 * inputs from the request and forward them.
 *
 * Note: webhook is in routes/webhook.ts (different middleware: no auth, raw
 * body, no JSON parser). Keep separate so the prismaMiddleware mount in
 * worker.ts can scope each surface independently.
 */
import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import type { CoinPackageId, SubscriptionPlanId } from '@novelhub/shared';

import type { PrismaVariables } from '../db/prisma';
import { requireAuth, type AuthVariables } from '../middleware/auth';
import { validationHook } from '../middleware/validator';
import { makePaymentsService, type PaymentsWorkerEnv } from '../services/payments-factory';
import { checkoutCoinsBodySchema, checkoutSubscriptionBodySchema } from './payments.schemas';

type Bindings = PaymentsWorkerEnv;
type Variables = PrismaVariables & AuthVariables;

export const paymentsRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>()
  .use('*', requireAuth)
  .post(
    '/checkout/coins',
    zValidator('json', checkoutCoinsBodySchema, validationHook),
    async (c) => {
      const user = c.get('user');
      const { packageId } = c.req.valid('json');
      const payments = makePaymentsService(c.env, c.get('prisma'));
      const result = await payments.createCoinCheckout(user.id, packageId as CoinPackageId);
      return c.json(result, 201);
    },
  )
  .post(
    '/checkout/subscription',
    zValidator('json', checkoutSubscriptionBodySchema, validationHook),
    async (c) => {
      const user = c.get('user');
      const { plan } = c.req.valid('json');
      const payments = makePaymentsService(c.env, c.get('prisma'));
      const result = await payments.createSubscriptionCheckout(user.id, plan as SubscriptionPlanId);
      return c.json(result, 201);
    },
  )
  .get('/portal', async (c) => {
    const user = c.get('user');
    const payments = makePaymentsService(c.env, c.get('prisma'));
    return c.json(await payments.createPortalSession(user.id), 200);
  })
  .get('/subscription', async (c) => {
    const user = c.get('user');
    const payments = makePaymentsService(c.env, c.get('prisma'));
    return c.json(await payments.getActiveSubscription(user.id), 200);
  })
  .get('/orders/:sessionId', async (c) => {
    const user = c.get('user');
    const sessionId = c.req.param('sessionId');
    const payments = makePaymentsService(c.env, c.get('prisma'));
    return c.json(await payments.getOrderStatus(user.id, sessionId), 200);
  });
