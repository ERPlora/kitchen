-- Borrado lógico (soft-delete) de una estación. Intención emitida por el handler WASM
-- (delete_station). Runtime inyecta :hub_id, :current_user_id, :now.
-- Guardas EN EL WHERE (el handler no tiene lecturas previas): sin enrutados activos
-- (producto o categoría) y sin líneas en curso. Si no se cumplen, no-op.
UPDATE kitchen_station
SET is_deleted = 1,
    deleted_at = :now,
    updated_by = :current_user_id,
    updated_at = :now
WHERE id = :station_id AND hub_id = :hub_id AND is_deleted = 0
  AND NOT EXISTS (SELECT 1 FROM kitchen_product_station ps
                   WHERE ps.hub_id = :hub_id AND ps.station_id = :station_id AND ps.is_deleted = 0)
  AND NOT EXISTS (SELECT 1 FROM kitchen_category_station cs
                   WHERE cs.hub_id = :hub_id AND cs.station_id = :station_id AND cs.is_deleted = 0)
  AND NOT EXISTS (SELECT 1 FROM kitchen_order_item oi
                   WHERE oi.hub_id = :hub_id AND oi.station_id = :station_id
                     AND oi.is_deleted = 0 AND oi.status IN ('pending', 'preparing'));
