-- Escribe una entrada del rastro de auditoría de cocina, resolviendo la comanda contra el hub
-- inyectado (pm#146).
--
-- `kitchen.logs.create` es un command PÚBLICO: sus ids llegan de quien llama, y antes se metían tal
-- cual. Los `_`-prefijados del módulo no tienen ese problema —el runtime los rechaza para cualquier
-- caller externo (gate de origen, hub#131/#145)— pero este no lleva prefijo.
--
-- Una fila que apunta a la comanda de otro negocio no rompe un cobro, pero corrompe justo el
-- registro al que se acude cuando algo salió mal, y lo hace en silencio.
--
-- `order_item_id` y `station_id` se dejan como vienen a propósito: son opcionales, y ambos cuelgan
-- de la comanda que aquí ya queda acotada. Exigirlos convertiría un log incompleto —que es
-- legítimo: no toda acción es sobre una línea ni sobre una estación— en un error.
INSERT INTO kitchen_order_log
  (id, hub_id, order_id, order_item_id, station_id, action, performed_by_id, notes,
   is_deleted, created_by, updated_by, created_at, updated_at)
SELECT
  :new_id, :hub_id, o.id, :order_item_id, :station_id, :action, :performed_by_id,
  COALESCE(:notes, ''),
  0, :current_user_id, :current_user_id, :now, :now
FROM kitchen_order o
WHERE o.id = :order_id AND o.hub_id = :hub_id AND o.is_deleted = 0;
