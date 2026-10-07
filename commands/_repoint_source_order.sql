UPDATE kitchen_order
   SET source_order_id = :to_order_id,
       round_number    = round_number + COALESCE((
           SELECT MAX(s.round_number) FROM kitchen_order s
            WHERE s.hub_id = :hub_id AND s.source_order_id = :to_order_id AND s.is_deleted = 0
       ), 0),
       updated_by      = :current_user_id,
       updated_at      = :now
 WHERE hub_id = :hub_id
   AND source_order_id = :from_order_id
   AND is_deleted = 0
   AND CAST(:from_order_id AS TEXT) <> CAST(:to_order_id AS TEXT);

-- Kitchen · `sales.order.merged` — the rounds of the absorbed check follow its dishes (kitchen#162).
--
-- Intention of `kitchen._on_sales_order_merged`, which only emits it once `sales.order.get` says the
-- absorbed check IS voided (the merge really happened). From here on the rounds are the surviving
-- check's: the TPV sheet of that check lists them and charging it closes them (KITCHEN-F27).
--
-- RENUMBERED, not just re-pointed: `uq_kitchen_order_source_round` is unique on
-- (hub_id, source_order_id, round_number) for live rows and both checks have a «round 1». The
-- absorbed rounds go after the last round of the surviving check, keeping their own order, and the
-- next round it fires is numbered after them (`_insert_order` takes the MAX). The subquery reads the
-- statement's snapshot, so every moved row is shifted by the same amount and none collides.
--
-- Only live rows: a soft-deleted round is outside the index and every list, and moving it could
-- collide with nothing but would rewrite history for no one. Label, status, number and dishes stay
-- as they were sent («lo que se envió se queda como se envió»).
--
-- The `hub_id` guard is load-bearing: `source_order_id` is an opaque id with no cross-module key.
-- IDEMPOTENT: a redelivery finds no live row left on the absorbed check. No `expect_rows`: a merged
-- check that never fired a round is the ordinary case.
