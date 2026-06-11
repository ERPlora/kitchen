-- Upsert de enrutado categoría → estación. Intención emitida por el handler WASM
-- (set_routing). Runtime inyecta :new_id, :hub_id, :current_user_id, :now.
-- Guarda EN EL WHERE: la estación debe existir, ser del hub y estar activa
-- (si no, no-op). category_id único por hub (uq_kitchen_category_station_hub_category).
INSERT INTO kitchen_category_station
  (id, hub_id, category_id, station_id, is_deleted, created_by, updated_by, created_at, updated_at)
SELECT :new_id, :hub_id, :category_id, :station_id, 0, :current_user_id, :current_user_id, :now, :now
WHERE EXISTS (SELECT 1 FROM kitchen_station st
               WHERE st.id = :station_id AND st.hub_id = :hub_id
                 AND st.is_active = 1 AND st.is_deleted = 0)
ON CONFLICT (hub_id, category_id) DO UPDATE SET
  station_id = excluded.station_id,
  is_deleted = 0,
  deleted_at = NULL,
  updated_by = :current_user_id,
  updated_at = :now;
