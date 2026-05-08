/**
 * Hono Stripe webhook route — mirrors
 * apps/api/src/modules/payments/webhook.controller.ts.
 *
 * Two non-obvious requirements:
 *
 *   1. NOT behind requireAuth — Stripe authenticates via signature, not JWT.
 *   2. Reads the request as raw bytes via `c.req.arrayBuffer()`. Any JSON
 *      re-serialization changes the bytes and breaks HMAC. Hono does not
 *      auto-parse bodies, so just calling `arrayBuffer()` is sufficient.
 *
 * Mounted at `/payments/webhook` in worker.ts so it shares the same path
 * shape as the Nest stack — the Stripe Dashboard webhook URL stays valid
 * across the cutover.
 */
import { Hono } from 'hono';

import type { PrismaVariables } from '../db/prisma';
import { makeWebhookService, type PaymentsWorkerEnv } from '../services/payments-factory';

type Bindings = PaymentsWorkerEnv;
type Variables = PrismaVariables;

export const webhookRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>().post(
  '/webhook',
  async (c) => {
    const signature = c.req.header('stripe-signature');
    // arrayBuffer() returns the unparsed body bytes — the only payload form
    // Stripe's signature was computed over.
    const body = new Uint8Array(await c.req.arrayBuffer());
    const webhook = makeWebhookService(c.env, c.get('prisma'));
    const result = await webhook.handleEvent(body, signature);
    return c.json(result, 200);
  },
);
