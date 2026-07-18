-- Alta de estación de producción. Runtime inyecta :new_id, :hub_id, :current_user_id, :now.
-- (name único por hub: uq_kitchen_station_hub_name.)
INSERT INTO kitchen_station
  (id, hub_id, name, name_es, description, color, icon, printer_name,
   destination, printer_role,
   sort_order, is_active, is_deleted, created_by, updated_by, created_at, updated_at)
VALUES
  (:new_id, :hub_id, :name, :name_es, :description, :color, :icon, :printer_name,
   :destination, :printer_role,
   :sort_order, 1, 0, :current_user_id, :current_user_id, :now, :now);
