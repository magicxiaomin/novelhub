# Ticket 05: Coins and Chapter Unlock

## Goal
Implement coin balance management and chapter unlock mechanism.

## Tasks
1. Create `coins` module:
   - `GET /coins/balance` - current user balance
   - `GET /coins/transactions` - transaction history (paginated)
2. Create `unlocks` module:
   - `POST /unlocks/chapter/:chapterId` - unlock with coins
   - `GET /unlocks` - list user's unlocked chapters
3. Unlock logic:
   - Check if already unlocked → return existing
   - Check if user has active subscription → unlock with method=SUBSCRIPTION, no coin charge
   - Check if user has enough coins → deduct, create unlock record + coin transaction in DB transaction
   - Else throw 402 Payment Required with paywall info
4. All coin balance changes MUST go through a `CoinService.adjustBalance(userId, amount, type, relatedId)` method that:
   - Uses Prisma `$transaction`
   - Updates `user.coinBalance`
   - Creates `CoinTransaction` row with `balanceAfter`
   - Throws if balance would go negative (except admin adjustments)
5. Tests for race conditions (concurrent unlocks should not double-spend)

## Acceptance Criteria
- Cannot unlock same chapter twice (idempotent)
- Subscription users bypass coin check
- Insufficient balance returns 402 with clear error
- Concurrent unlock requests don't allow negative balance (test with parallel requests)
- All coin changes traceable in `coin_transactions`

## Out of Scope
- Stripe integration (next ticket)
- Refunds
