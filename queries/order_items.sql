-- Líneas de una comanda concreta. Runtime inyecta :hub_id.
-- La estación se resolvió al INSERTAR (`_insert_item.sql`: producto→estación); aquí se acompaña
-- del **destino** de esa estación, que es lo que necesita quien imprime para agrupar por papel y
-- no mandar a la impresora lo que es solo de pantalla. JOIN a tabla PROPIA del módulo (ADR-0127
-- prohíbe tocar las de otro módulo, no las de uno mismo).
-- Una línea sin estación (producto sin enrutar) sale con destino `both`: en la duda se ve Y se
-- imprime — perder una comanda en cocina es peor que gastar papel.
SELECT i.id, i.order_id, i.station_id, i.product_id, i.product_name,
       i.unit_price, i.quantity, i.total, i.modifiers, i.notes,
       i.status, i.seat_number, i.fired_at, i.started_at, i.completed_at,
       s.name                              AS station_name,
       COALESCE(s.destination,  'both')    AS destination,
       COALESCE(s.printer_role, 'kitchen') AS printer_role
FROM kitchen_order_item i
LEFT JOIN kitchen_station s
       ON s.id = i.station_id AND s.hub_id = i.hub_id AND s.is_deleted = 0
WHERE i.hub_id = :hub_id AND i.is_deleted = 0
  AND i.order_id = :order_id
ORDER BY i.created_at ASC;
