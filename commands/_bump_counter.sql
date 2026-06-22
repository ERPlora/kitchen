-- Incrementa atómicamente el contador de comandas del día (upsert). Primera intención
-- de create_order / create_order_from_sale. Runtime inyecta :new_id, :hub_id.
-- :day (YYYYMMDD) lo aporta el handler WASM. Mismo patrón que sales._bump_counter.
INSERT INTO kitchen_order_counter (id, hub_id, day, last_number)
VALUES (:new_id, :hub_id, :day, 1)
ON CONFLICT (hub_id, day) DO UPDATE SET last_number = kitchen_order_counter.last_number + 1;
