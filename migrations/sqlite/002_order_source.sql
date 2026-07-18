-- ADR-0141 — la comanda nace del PEDIDO, no de la venta.
--
-- Antes la comanda colgaba de `sale_id` (venta cobrada) y de `table_id` (mesa): cocina conocía a
-- otros dos módulos y, peor, la comida salía **al cobrar**, que en un restaurante es el final del
-- servicio. Ahora cuelga del pedido, que es la entidad viva mientras se sirve, y lo único que sabe
-- de la sala es una **etiqueta opaca** que imprime tal cual ("Mesa 4", "Barra", "Recogida Ana").
--
-- Aditiva: `table_id`/`sale_id`/`customer_id` siguen ahí para las comandas ya existentes; el flujo
-- nuevo no las escribe.
ALTER TABLE kitchen_order ADD COLUMN source_order_id TEXT;
ALTER TABLE kitchen_order ADD COLUMN label TEXT NOT NULL DEFAULT '';

-- Rondas: un pedido dispara varias veces (bebidas primero, comida después). Cada disparo es una
-- comanda con su `round_number`, así que el índice es por (pedido, ronda), no por pedido.
CREATE UNIQUE INDEX IF NOT EXISTS uq_kitchen_order_source_round
    ON kitchen_order (hub_id, source_order_id, round_number)
    WHERE source_order_id IS NOT NULL AND is_deleted = 0;
CREATE INDEX IF NOT EXISTS ix_kitchen_order_source
    ON kitchen_order (hub_id, source_order_id);
