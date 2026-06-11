-- Alta de una entrada de auditoría del KDS. Runtime inyecta :new_id, :hub_id,
-- :current_user_id, :now. Lo disparan los listeners de los eventos
-- kitchen.order.{fired,ready,served,recalled,cancelled} (events.listen) — el payload del
-- evento aporta order_id/action/notes — y también puede invocarse directamente.
-- order_item_id/station_id/performed_by_id opcionales (NULL si no vienen).
INSERT INTO kitchen_order_log
  (id, hub_id, order_id, order_item_id, station_id, action, performed_by_id, notes,
   is_deleted, created_by, updated_by, created_at, updated_at)
VALUES
  (:new_id, :hub_id, :order_id, :order_item_id, :station_id, :action, :performed_by_id,
   COALESCE(:notes, ''),
   0, :current_user_id, :current_user_id, :now, :now);
