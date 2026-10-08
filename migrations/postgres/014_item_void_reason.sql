-- kitchen#161 · why the till took a dish back.
--
-- The till voids a line already sent (SALES-F20) with a mandatory reason and announces it with
-- `sales.order.line_voided`. The kitchen strikes that dish (`status = 'voided'`, its own state, not
-- `cancelled`) and keeps the reason next to it, so the KDS can say why the croquetas are struck.
--
-- Additive and reversible: `ALTER TABLE kitchen_order_item DROP COLUMN void_reason` undoes it;
-- a row voided meanwhile keeps `status = 'voided'` and simply loses the reason.
ALTER TABLE kitchen_order_item ADD COLUMN IF NOT EXISTS void_reason TEXT NOT NULL DEFAULT '';
