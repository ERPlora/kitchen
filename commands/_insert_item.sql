-- Inserta una línea de comanda. Intención emitida por el handler WASM (create_order /
-- create_order_from_sale). Runtime inyecta :hub_id, :current_user_id, :now.
-- :item_id/:order_id (de context.new_ids), snapshot de producto y :total los aporta el handler.
-- La estación se resuelve AQUÍ (misma transacción, tablas propias): override explícito
-- (:station_id) > mapeo producto→estación > mapeo categoría→estación (si el caller aporta
-- :category_id) > NULL. Solo se enruta a estaciones activas.
INSERT INTO kitchen_order_item
  (id, hub_id, order_id, station_id, product_id, product_name,
   unit_price, quantity, total, modifiers, notes, status, seat_number,
   is_deleted, created_by, updated_by, created_at, updated_at)
VALUES
  (:item_id, :hub_id, :order_id,
   COALESCE(
     :station_id,
     (SELECT ps.station_id
        FROM kitchen_product_station ps
        JOIN kitchen_station s ON s.id = ps.station_id AND s.is_active = 1 AND s.is_deleted = 0
       WHERE ps.hub_id = :hub_id AND ps.product_id = :product_id AND ps.is_deleted = 0),
     (SELECT cs.station_id
        FROM kitchen_category_station cs
        JOIN kitchen_station s ON s.id = cs.station_id AND s.is_active = 1 AND s.is_deleted = 0
       WHERE cs.hub_id = :hub_id AND cs.category_id = :category_id AND cs.is_deleted = 0)
   ),
   :product_id, :product_name,
   :unit_price, :quantity, :total, :modifiers, :notes, :status, :seat_number,
   0, :current_user_id, :current_user_id, :now, :now);
