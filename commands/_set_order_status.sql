-- Fija el estado y marcas de tiempo de una comanda. Intención emitida por el handler WASM
-- (update_order_status). Runtime inyecta :hub_id, :current_user_id, :now.
-- El handler decide los modos según la transición (sin lecturas previas; los guardas de
-- estado van en el WHERE → si no se cumplen, la transición es un no-op):
--   :require_status  '' = sin guarda; 'ready' = solo si la comanda está ready (recall).
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
