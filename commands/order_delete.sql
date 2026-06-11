-- Borrado lógico (soft-delete) de una comanda. Intención emitida por el handler WASM
-- (delete_order). Runtime inyecta :hub_id, :current_user_id, :now.
-- Guardas EN EL WHERE (el handler no tiene lecturas previas): solo comandas
-- pending/cancelled y sin venta enlazada (anula/reembolsa la venta primero).
-- Si la guarda no se cumple, el borrado es un no-op.
UPDATE kitchen_order
SET is_deleted = 1,
    deleted_at = :now,
    updated_by = :current_user_id,
    updated_at = :now
WHERE id = :order_id AND hub_id = :hub_id AND is_deleted = 0
  AND status IN ('pending', 'cancelled')
  AND sale_id IS NULL;
