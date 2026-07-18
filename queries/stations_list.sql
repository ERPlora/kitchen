-- Estaciones de producción del hub. Runtime inyecta :hub_id.
-- El recuento de líneas pendientes por estación se calcula con items_pending_by_station.
SELECT id, name, name_es, description, color, icon,
       printer_name, destination, printer_role, sort_order, is_active
FROM kitchen_station
WHERE hub_id = :hub_id AND is_deleted = 0
