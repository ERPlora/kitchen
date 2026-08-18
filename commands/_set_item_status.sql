-- Sets the status of ONE kitchen line (bump / recall per line, kitchen#4). Intention emitted by
-- the WASM handler (bump_items / recall_items). The runtime injects :hub_id, :current_user_id, :now.
-- The handler validated the transition against the rows it was handed (`reads`) and pins the
-- guard to that state, so a line that moved in between matches ZERO rows instead of jumping
-- states; `expect_rows` on this command turns that into a rejection (hub#1025 for handler ops).
--   :require_status  the line status the handler validated against.
--   :completed_mode  'set' = completed_at = :now (bump) · 'clear' = NULL (recall) · 'keep'.
-- The line stays scoped to its ticket (:order_id) and hub: a forged item_id of another ticket
-- matches nothing.
UPDATE kitchen_order_item
SET status       = :status,
    started_at   = COALESCE(started_at, :now),
    fired_at     = COALESCE(fired_at, :now),
    completed_at = CASE :completed_mode WHEN 'set' THEN :now WHEN 'clear' THEN NULL ELSE completed_at END,
    updated_by   = :current_user_id,
    updated_at   = :now
WHERE id = :item_id AND order_id = :order_id AND hub_id = :hub_id AND is_deleted = 0
  AND status = :require_status;
