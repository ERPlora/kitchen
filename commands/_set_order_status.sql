-- Sets the status and timestamps of a kitchen order. Intention emitted by the WASM handler
-- (set_status / mark_served / cancel). The runtime injects :hub_id, :current_user_id, :now.
-- The handler validates the transition against the row it was handed (`reads`, kitchen#11) and
-- pins the guard to that state, so a row that moved in between matches ZERO rows instead of
-- jumping states; `expect_rows` on this command turns that into a rejection (hub#1025 for
-- handler operations).
--   :require_status  the status the handler validated against ('' = no guard, legacy).
--   :set_fired       1 = sella fired_at (si aún no estaba) con :now.
--   :ready_mode      'set' = ready_at = :now · 'clear' = NULL · 'keep' = no tocar.
--   :served_mode     'set' = served_at = :now · 'keep' = no tocar.
--   :append_note     texto a anexar a notes ('' = no tocar); :nl = separador de línea.
UPDATE kitchen_order
SET status     = :status,
    fired_at   = CASE WHEN :set_fired = 1 THEN COALESCE(fired_at, :now) ELSE fired_at END,
    ready_at   = CASE :ready_mode WHEN 'set' THEN :now WHEN 'clear' THEN NULL ELSE ready_at END,
    served_at  = CASE :served_mode WHEN 'set' THEN :now ELSE served_at END,
    notes      = CASE
                   WHEN :append_note = '' THEN notes
                   WHEN notes = '' THEN :append_note
                   ELSE notes || :nl || :append_note
                 END,
    updated_by = :current_user_id,
    updated_at = :now
WHERE id = :order_id AND hub_id = :hub_id AND is_deleted = 0
  AND (:require_status = '' OR status = :require_status);
