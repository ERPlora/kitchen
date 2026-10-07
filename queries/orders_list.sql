-- Comandas activas/recientes del hub con filtros opcionales. Runtime inyecta :hub_id.
-- Los filtros/orden/paginación los aporta el runtime según `list` del manifest.
SELECT id, order_number, status, order_type, priority,
       table_id, sale_id, customer_id, waiter_id,
       source_order_id, label,
       round_number, notes, subtotal, tax, discount, total,
       fired_at, ready_at, served_at, created_at,
       -- kitchen#153 · how many live lines of the ticket went to a SCREEN (frozen destination
       -- `display` or `both`). 0 = every line went to a printer-only station: nobody will mark it
       -- on a screen, so the charge serves it (`kitchen.orders.close_from_order`). No bind, so the
       -- batteries that feed this query to psql with `sed`-substituted binds keep working.
       (SELECT COUNT(*)
          FROM kitchen_order_item i
         WHERE i.order_id = kitchen_order.id AND i.hub_id = kitchen_order.hub_id
           AND i.is_deleted = 0 AND i.destination <> 'printer') AS screen_lines
FROM kitchen_order
WHERE hub_id = :hub_id AND is_deleted = 0
