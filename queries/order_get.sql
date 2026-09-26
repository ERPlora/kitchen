-- Header of one order. Runtime injects :hub_id.
-- (The lines are obtained with order_items.sql.)
-- `label` + `round_number` are what gets PRINTED on paper: the opaque floor label
-- ("Table 4", "Pickup Ana") and which round of the order this is. Without the label, the ticket
-- comes out orphaned —food on the pass with no idea where it goes—, which is exactly what
-- ADR-0144 came to fix.
-- `rush_count` feeds the rush notice job id, so a repeated rush gets a fresh id (kitchen#99).
SELECT id, order_number, status, order_type, priority, rush_count,
       source_order_id, label,
       table_id, sale_id, customer_id, waiter_id,
       round_number, notes, subtotal, tax, discount, total,
       fired_at, ready_at, served_at, created_at
FROM kitchen_order
WHERE hub_id = :hub_id AND is_deleted = 0
  AND id = :order_id;
