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
       status, seat_number, fired_at, started_at, completed_at,
       -- kitchen#161 · a dish the till voided is `voided`, with the till's reason.
       void_reason,
       -- kitchen#57 · el MENÚ al que pertenece la línea (ADR-0381). Congelado en la fila, como la
       -- estación: dos filas con el mismo `combo_ref` son un mismo menú de una misma mesa, y quien
       -- pinta —el KDS y la comanda de papel— las agrupa bajo `combo_name` en vez de soltarlas
       -- como tres platos sueltos que salen descompasados.
       combo_ref, combo_name, line_seq
FROM kitchen_order_item
WHERE hub_id = :hub_id AND is_deleted = 0
  AND order_id = :order_id
-- ORDEN DE ELECCIÓN. Todas las filas de un disparo se escriben en la misma transacción con el
-- MISMO `created_at`, así que ordenar solo por él deja el orden en manos del planificador: los
-- componentes de un menú saldrían barajados. `created_at` sigue detrás para las rondas anteriores
-- a la migración 008, que llevan `line_seq = 0` y conservan así su orden relativo.
ORDER BY line_seq ASC, created_at ASC, id ASC;
