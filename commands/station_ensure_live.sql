-- Liveness check before deleting a station (kitchen#126). Intention emitted by the WASM handler
-- (delete_station) BEFORE `kitchen._station_soft_delete`, in the same transaction. The runtime
-- injects :hub_id. It touches nothing (updated_at = updated_at): it only counts the row, so the
-- manifest's `expect_rows` can tell «this station does not exist in this hub or is already deleted»
-- (`kitchen.station_unavailable`) apart from «it is still in use» (`kitchen.station_in_use`, the
-- guards of the soft delete).
UPDATE kitchen_station
SET updated_at = updated_at
WHERE id = :station_id AND hub_id = :hub_id AND is_deleted = 0;
