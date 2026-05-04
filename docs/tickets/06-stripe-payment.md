# Ticket 06: Stripe Subscriptions and One-time Purchases

## Goal
Integrate Stripe for both subscription and coin purchases, with full webhook handling.

## Tasks
1. Set up Stripe SDK in NestJS
2. Create `payments` module:
   - `POST /payments/checkout/coins` - body: `{ packageId }`, returns Stripe Checkout URL
   - `POST /payments/checkout/subscription` - body: `{ plan: 'weekly'|'monthly' }`, returns URL
   - `GET /payments/portal` - returns Stripe Customer Portal URL for managing subscription
   - `POST /payments/webhook` - Stripe webhook handler
3. Coin packages (define as constants in `packages/shared`):
   - `pack_50`: $4.99 → 50 coins
   - `pack_120`: $9.99 → 120 coins (+20% bonus)
   - `pack_260`: $19.99 → 260 coins (+30% bonus)
   - `pack_700`: $49.99 → 700 coins (+40% bonus)
4. Create Stripe products + prices in setup script (`scripts/stripe-setup.ts`)
5. Webhook events to handle:
   - `checkout.session.completed` → grant coins or activate subscription, mark order completed
   - `customer.subscription.created`
   - `customer.subscription.updated` → sync status, period end
   - `customer.subscription.deleted` → mark canceled
   - `invoice.payment_succeeded` → renewal, log
   - `invoice.payment_failed` → mark past_due
   - `charge.refunded` → reverse coins if refund of coin purchase
6. Verify webhook signature with `STRIPE_WEBHOOK_SECRET`
7. Idempotency: store `event.id` in DB, skip duplicates
8. On successful purchase, trigger CAPI Purchase event (next ticket will wire this)
9. Use Stripe metadata to link sessions to userId, orderType, packageId
10. Tests with Stripe mock or test mode

## Acceptance Criteria
- End-to-end test passes: create checkout → simulate completion → coins granted
- Webhook signature verification rejects invalid signatures
- Duplicate webhook events handled idempotently
- Subscription state syncs correctly across all lifecycle events
- Customer Portal link works for active subscribers

## Out of Scope
- Frontend checkout buttons (separate ticket)
- Multi-currency (V2)
- Tax handling (V2, use Stripe Tax later)
