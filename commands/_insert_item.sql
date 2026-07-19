-- Inserta una línea de comanda. Intención emitida por el handler WASM (create_order /
-- create_order_from_sale). Runtime inyecta :hub_id, :current_user_id, :now.
-- :item_id/:order_id (de context.new_ids), snapshot de producto y :total los aporta el handler.
-- La estación se resuelve AQUÍ (misma transacción, tablas propias): override explícito
-- (:station_id) > mapeo producto→estación > mapeo categoría→estación (si el caller aporta
-- :category_id) > NULL. Solo se enruta a estaciones activas.
-- El DESTINO se congela AQUÍ, junto a la estación. `destination`/`printer_role`/`station_name` son
-- un HECHO HISTÓRICO de este envío, no una consulta a la configuración de mañana: si la plancha
-- pasa a solo-pantalla, la ronda que salió hoy por papel se reimprime por papel, y el vale de
-- anulación llega a la estación que de verdad está cocinando eso.
WITH ruta AS (
  SELECT COALESCE(
    :station_id,
    (SELECT ps.station_id
       FROM kitchen_product_station ps
       JOIN kitchen_station s ON s.id = ps.station_id AND s.is_active = 1 AND s.is_deleted = 0
      WHERE ps.hub_id = :hub_id AND ps.product_id = :product_id AND ps.is_deleted = 0),
    (SELECT cs.station_id
       FROM kitchen_category_station cs
       JOIN kitchen_station s ON s.id = cs.station_id AND s.is_active = 1 AND s.is_deleted = 0
      WHERE cs.hub_id = :hub_id AND cs.category_id = :category_id AND cs.is_deleted = 0)
  ) AS station_id
)
INSERT INTO kitchen_order_item
  (id, hub_id, order_id, station_id, station_name, destination, printer_role,
   sales_order_item_id, product_id, product_name,
   unit_price, quantity, total, modifiers, notes, status, seat_number,
   is_deleted, created_by, updated_by, created_at, updated_at)
SELECT
   :item_id, :hub_id, :order_id, r.station_id,
   -- Sin estación (producto sin enrutar) el destino cae a `both`: en la duda se ve Y se imprime,
   -- porque perder una comanda en cocina es peor que gastar papel.
   COALESCE(st.name,         ''),
   COALESCE(st.destination,  'both'),
   COALESCE(st.printer_role, 'kitchen'),
   :sales_order_item_id, :product_id, :product_name,
   :unit_price, :quantity, :total, :modifiers, :notes, :status, :seat_number,
   0, :current_user_id, :current_user_id, :now, :now
FROM ruta r
LEFT JOIN kitchen_station st
       ON st.id = r.station_id AND st.hub_id = :hub_id AND st.is_deleted = 0;
