-- Cascada de estado a las líneas de una comanda (set-based, sin lecturas previas).
-- Intención emitida por el handler WASM (update_order_status). Runtime inyecta
-- :hub_id, :current_user_id, :now.
--   :from_status     '' = todas las líneas no borradas (cancel); 'pending' (fire); 'ready' (recall).
--   :to_status       estado destino de las líneas.
--   :set_fired       1 = sella fired_at (si aún no estaba) con :now (fire).
--   :completed_mode  'set' = completed_at = :now · 'clear' = NULL (recall) · 'keep' = no tocar.
UPDATE kitchen_order_item
SET status       = :to_status,
    fired_at     = CASE WHEN :set_fired = 1 THEN COALESCE(fired_at, :now) ELSE fired_at END,
    completed_at = CASE :completed_mode WHEN 'set' THEN :now WHEN 'clear' THEN NULL ELSE completed_at END,
    updated_by   = :current_user_id,
    updated_at   = :now
WHERE hub_id = :hub_id AND is_deleted = 0
  AND order_id = :order_id
  AND (:from_status = '' OR status = :from_status);
