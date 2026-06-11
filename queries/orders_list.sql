-- Comandas activas/recientes del hub con filtros opcionales. Runtime inyecta :hub_id.
-- Los filtros/orden/paginación los aporta el runtime según `list` del manifest.
SELECT id, order_number, status, order_type, priority,
       table_id, sale_id, customer_id, waiter_id,
       round_number, notes, subtotal, tax, discount, total,
       fired_at, ready_at, served_at, created_at
FROM kitchen_order
WHERE hub_id = :hub_id AND is_deleted = 0
