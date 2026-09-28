-- Kitchen · 012 — kitchen#120: a DELETED station frees its name.
DROP INDEX IF EXISTS uq_kitchen_station_hub_name;
CREATE UNIQUE INDEX IF NOT EXISTS uq_kitchen_station_hub_name_live
    ON kitchen_station (hub_id, name) WHERE is_deleted = 0;

-- (Prose at the end on purpose: a semicolon inside a leading `--` block is what splits a migration
-- in the wrong place, so this prose carries none.)
--
-- WHAT CHANGES. Deleting a station is a soft delete (`is_deleted = 1`), but `001_init.sql` made the
-- name unique over `(hub_id, name)` counting the deleted rows too: once «Barra» had been created and
-- deleted, «Barra» could never be created again in that hub. The name is now unique among the LIVE
-- stations of a hub only. The index gets a new name so that `IF NOT EXISTS` cannot mistake the old
-- full index for this one, and so the manifest's `on_unique` (create and update) names exactly the
-- index that refuses — `kitchen.station_name_taken` instead of the platform's `db`.
--
-- WHY DROPPING IS SAFE. An index keeps no rows, and `DROP INDEX` is not translated by the migration
-- guard on purpose (ADR-0387). A hub where 001 has just created the old index drops it here.
--
-- Re-entrant: `DROP INDEX IF EXISTS` / `CREATE … IF NOT EXISTS` are no-ops on the second boot.
--
-- REVERSIBLE. Only on a hub where no deleted name has been reused yet (otherwise the full index
-- cannot be built and the boot aborts — look first with
-- `SELECT hub_id, name FROM kitchen_station GROUP BY hub_id, name HAVING count(*) > 1`):
-- DOWN (one statement per line, run in this order):
--   DROP INDEX IF EXISTS uq_kitchen_station_hub_name_live
--   CREATE UNIQUE INDEX IF NOT EXISTS uq_kitchen_station_hub_name ON kitchen_station (hub_id, name)
