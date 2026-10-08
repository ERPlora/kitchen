-- Cascades a status to the lines of a kitchen order (set-based, no prior reads).
-- Intention emitted by the WASM handler (update_order_status). The runtime injects
-- :hub_id, :current_user_id, :now.
--   :from_status     '' = every live line (cancel) except a dish the till voided, which keeps
--                    saying so (kitchen#161); 'pending' (fire); 'ready' (recall).
--   :to_status       the target status of the lines.
--   :set_fired       1 = stamps fired_at (if not stamped yet) with :now (fire).
--   :completed_mode  'set' = completed_at = :now · 'clear' = NULL (recall) · 'keep' = untouched.
UPDATE kitchen_order_item
SET status       = :to_status,
    fired_at     = CASE WHEN :set_fired = 1 THEN COALESCE(fired_at, :now) ELSE fired_at END,
    completed_at = CASE :completed_mode WHEN 'set' THEN :now WHEN 'clear' THEN NULL ELSE completed_at END,
    updated_by   = :current_user_id,
    updated_at   = :now
WHERE hub_id = :hub_id AND is_deleted = 0
  AND order_id = :order_id
  AND ((:from_status = '' AND status <> 'voided') OR status = :from_status);
