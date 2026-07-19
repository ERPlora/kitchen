-- Líneas de una comanda concreta. Runtime inyecta :hub_id.
-- Destino, rol de impresora y nombre de estación se leen del SNAPSHOT de la propia línea, NO de
-- `kitchen_station`: el destino de una ronda ya disparada es un hecho histórico. Antes esto era un
-- JOIN vivo, y si el jefe reconfiguraba la plancha, la ronda de ayer se reimprimía por otro sitio
-- —y el vale de anulación acababa en una estación que no estaba cocinando eso—.
-- La configuración de hoy vale para los envíos NUEVOS (`_insert_item.sql`), nunca para reconstruir
-- los pasados.
SELECT id, order_id, station_id, station_name, destination, printer_role,
       sales_order_item_id, sales_dispatch_item_id,
       product_id, product_name,
       unit_price, quantity, total, modifiers, notes,
       status, seat_number, fired_at, started_at, completed_at
FROM kitchen_order_item
WHERE hub_id = :hub_id AND is_deleted = 0
  AND order_id = :order_id
ORDER BY created_at ASC;
