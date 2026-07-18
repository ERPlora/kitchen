-- Inserta la cabecera de comanda. Intención emitida por el handler WASM (create_order /
-- create_order_from_sale). Runtime inyecta :hub_id, :current_user_id, :now.
-- :order_id (de context.new_ids), :day y los totales los aporta el handler.
-- order_number YYYYMMDD-NNNN se calcula leyendo el contador (recién incrementado por
-- kitchen._bump_counter) en la MISMA transacción. Padding portable: erp_pad(valor, ancho)
-- (ADR-0007) → printf/lpad por dialecto en el shim del runtime.
INSERT INTO kitchen_order
  (id, hub_id, order_number, table_id, sale_id, customer_id, waiter_id,
   source_order_id, label,
   order_type, status, priority, round_number, notes,
   subtotal, tax, discount, total,
   is_deleted, created_by, updated_by, created_at, updated_at)
VALUES
  (:order_id, :hub_id,
   :day || '-' || erp_pad((
       SELECT last_number FROM kitchen_order_counter WHERE hub_id = :hub_id AND day = :day
   ), 4),
   :table_id, :sale_id, :customer_id, :waiter_id,
   :source_order_id, :label,
   :order_type, :status, :priority,
   -- Ronda (ADR-0141): el handler WASM no puede leer la BD, así que manda 0 = «numérala tú» y se
   -- calcula aquí, en la MISMA transacción, contra las comandas ya disparadas de ESE pedido.
   -- Sin pedido de origen (flujo legacy) la subconsulta da NULL → 1.
   CASE WHEN :round_number > 0 THEN :round_number ELSE COALESCE((
       SELECT MAX(round_number) FROM kitchen_order
       WHERE hub_id = :hub_id AND source_order_id = :source_order_id AND is_deleted = 0
   ), 0) + 1 END,
   :notes,
   :subtotal, :tax, :discount, :total,
   0, :current_user_id, :current_user_id, :now, :now);
