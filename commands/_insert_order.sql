-- Inserta la cabecera de comanda. Intención emitida por el handler WASM (create_order /
-- create_order_from_sale). Runtime inyecta :hub_id, :current_user_id, :now.
-- :order_id (de context.new_ids), :day y los totales los aporta el handler.
-- order_number YYYYMMDD-NNNN se calcula leyendo el contador (recién incrementado por
-- kitchen._bump_counter) en la MISMA transacción. printf() es de SQLite; Postgres
-- usaría lpad() (portabilidad SQL §14, mismo caveat que sales._insert_sale).
INSERT INTO kitchen_order
  (id, hub_id, order_number, table_id, sale_id, customer_id, waiter_id,
   order_type, status, priority, round_number, notes,
   subtotal, tax, discount, total,
   is_deleted, created_by, updated_by, created_at, updated_at)
VALUES
  (:order_id, :hub_id,
   :day || '-' || printf('%04d', (
       SELECT last_number FROM kitchen_order_counter WHERE hub_id = :hub_id AND day = :day
   )),
   :table_id, :sale_id, :customer_id, :waiter_id,
   :order_type, :status, :priority, :round_number, :notes,
   :subtotal, :tax, :discount, :total,
   0, :current_user_id, :current_user_id, :now, :now);
