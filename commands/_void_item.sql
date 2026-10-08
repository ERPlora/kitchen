-- Strikes ONE kitchen line the till voided (kitchen#161, KITCHEN-F29). Intention emitted by the
-- WASM handler (`void_lines_from_sales_line`). The runtime injects :hub_id, :current_user_id, :now.
-- The handler read the line (`kitchen.items.by_sales_line`) and pins the guard to that state, so a
-- dish bumped in between matches ZERO rows and `expect_rows` refuses the delivery, which is retried
-- with the new state (hub#1025 for handler operations).
--   :require_status  the line status the handler decided against.
--   :reason          the till's reason, painted on the KDS next to the struck dish.
-- The line stays scoped to its ticket (:order_id) and hub.
UPDATE kitchen_order_item
SET status      = 'voided',
    void_reason = :reason,
    updated_by  = :current_user_id,
    updated_at  = :now
WHERE id = :item_id AND order_id = :order_id AND hub_id = :hub_id AND is_deleted = 0
  AND status = :require_status;
