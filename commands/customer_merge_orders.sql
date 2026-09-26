UPDATE kitchen_order
   SET customer_id = :surviving_id,
       updated_by  = :current_user_id,
       updated_at  = :now
 WHERE hub_id = :hub_id
   AND customer_id = :absorbed_id
   AND CAST(:surviving_id AS TEXT) <> CAST(:absorbed_id AS TEXT);

-- Kitchen · `customer.merged` — re-point a merged customer's kitchen orders to the survivor
-- (customers#86/customers#87).
--
-- Runs from the outbox relay: the payload IS the emitter's params (`surviving_id`, `absorbed_id`,
-- `hub_id`), so there is no `schema` on the command.
--
-- Listening is not depending: kitchen still does not declare `customers` in `depends_on`
-- (ADR-0141). Without the customers module the event never arrives and this never runs.
--
-- The `hub_id` guard is load-bearing: `customer_id` is an opaque id with no cross-module foreign
-- key, and the same string may name a different person in another hub.
--
-- ALL orders move — live and soft-deleted, any status — because this is the customer's history.
-- Nothing else on the order (number, table, sale, status, notes) is touched.
--
-- No unique index in this module includes `customer_id`, so this blind re-point cannot collide.
-- It never reads `customers`, so it does not require the absorbed sheet to still exist.
--
-- The surviving<>absorbed guard turns a degenerate event into a no-op instead of re-stamping rows
-- that are already correct.
--
-- IDEMPOTENT: the outbox is at-least-once, so a redelivery matches zero rows. No `expect_rows`:
-- merging a customer who never had a kitchen order is the ordinary case.
