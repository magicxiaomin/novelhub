-- Defense-in-depth backstop for the 10-coin PUSH_REWARD grant. Even if the
-- application-side findFirst guard or the SERIALIZABLE transaction isolation
-- drift in the future, the database itself will reject a second
-- (user_id, type='PUSH_REWARD') row. The service catches the resulting
-- P2002 and treats it the same as the existing P2034 / 40001 paths
-- (return `already_granted`). Partial index keeps every other coin
-- transaction type unaffected.

CREATE UNIQUE INDEX IF NOT EXISTS "coin_transactions_push_reward_user_idx"
  ON "coin_transactions" ("user_id")
  WHERE "type" = 'PUSH_REWARD';
