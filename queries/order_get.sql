-- Cabecera de una comanda concreta. Runtime inyecta :hub_id.
-- (Las líneas se obtienen con order_items.sql.)
-- `label` + `round_number` son lo que se IMPRIME en el papel: la etiqueta opaca de sala
-- ("Mesa 4", "Recogida Ana") y qué ronda del pedido es. Sin la etiqueta, el ticket sale huérfano
-- —comida en el pase sin saber a dónde va—, que es justo lo que ADR-0144 vino a arreglar.
SELECT id, order_number, status, order_type, priority,
       source_order_id, label,
       table_id, sale_id, customer_id, waiter_id,
       round_number, notes, subtotal, tax, discount, total,
       fired_at, ready_at, served_at, created_at
FROM kitchen_order
WHERE hub_id = :hub_id AND is_deleted = 0
  AND id = :order_id;
