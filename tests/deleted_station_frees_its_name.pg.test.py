#!/usr/bin/env python3
"""A deleted station frees its name; a live one still holds it (kitchen#120).

Deleting a station is a soft delete (`is_deleted = 1`, ADR-0145 row contract), but the name was
unique over `(hub_id, name)` WITHOUT excluding the deleted rows: once «Barra» had been created and
deleted, «Barra» could never be created again in that hub — and the refusal reached the screen as
the platform's generic `db` failure, so the person re-sent the form without knowing why.

What this pins, against a real Postgres built from this module's own migrations, running the
module's REAL `commands/station_create.sql`, `station_update.sql` and `station_delete.sql` with the
binds the runtime would inject:

  1. a name whose station was deleted can be created again;
  2. a LIVE station still holds its name — and the violation is raised by an index the manifest
     maps in `on_unique` for both create and update, so the screen gets the module's domain code
     (`kitchen.station_name_taken`) and not `db`;
  3. renaming a station onto a live name is refused the same way; onto a deleted one it goes through;
  4. tenancy: a name deleted in hub A neither frees nor blocks hub B — hub B's live «Barra» still
     refuses a second «Barra» in hub B, and hub A creates «Barra» while hub B keeps its own;
  5. the migration is reversible: the documented `down` restores the old index on a hub with no
     reused name, and the `up` can be run again afterwards.

Usage: tests/deleted_station_frees_its_name.pg.test.py   (exit 0 = green)
  Uses the `erplora-test-pg-5433` container (override: KITCHEN_TEST_PG_CONTAINER).
"""

import json
import os
import pathlib
import re
import subprocess
import sys
import uuid

from module_migrations import migration_entries, migration_sql

MODULE_DIR = pathlib.Path(__file__).resolve().parent.parent
MANIFEST = json.loads((MODULE_DIR / "module.json").read_text(encoding="utf-8"))
CREATE_SQL = (MODULE_DIR / "commands/station_create.sql").read_text(encoding="utf-8")
UPDATE_SQL = (MODULE_DIR / "commands/station_update.sql").read_text(encoding="utf-8")
DELETE_SQL = (MODULE_DIR / "commands/station_delete.sql").read_text(encoding="utf-8")
MIGRATION = "migrations/postgres/012_station_name_ignores_deleted.sql"
CONTAINER = os.environ.get("KITCHEN_TEST_PG_CONTAINER", "erplora-test-pg-5433")

HUB_A = "hub-a"
HUB_B = "hub-b"
USER = "user-1"
NOW = "2026-09-28T09:00:00Z"
NAME_TAKEN = "kitchen.station_name_taken"

failures: list[str] = []


def fail(msg: str) -> None:
    failures.append(msg)


def literal(value) -> str:
    if value is None:
        return "NULL"
    if isinstance(value, bool):
        return "1" if value else "0"
    if isinstance(value, int):
        return str(value)
    return "'" + str(value).replace("'", "''") + "'"


def bind(sql: str, binds: dict) -> str:
    # Longest names first: `:name` must not eat the head of `:name_es`.
    for key in sorted(binds, key=len, reverse=True):
        sql = re.sub(rf":{key}\b", literal(binds[key]).replace("\\", "\\\\"), sql)
    return sql


def container_available() -> bool:
    try:
        subprocess.run(
            ["docker", "inspect", CONTAINER], capture_output=True, check=True, text=True
        )
        return True
    except (subprocess.CalledProcessError, FileNotFoundError):
        return False


class ScratchDb:
    def __init__(self, prefix: str):
        self.name = f"{prefix}_{os.getpid()}_{uuid.uuid4().hex[:6]}"

    def psql(self, args, db=None, stdin=None) -> str:
        cmd = [
            "docker",
            "exec",
            "-i",
            CONTAINER,
            "psql",
            "-v",
            "ON_ERROR_STOP=1",
            "-U",
            "postgres",
            "-X",
        ]
        if db:
            cmd += ["-d", db]
        res = subprocess.run(cmd + args, input=stdin, capture_output=True, text=True)
        if res.returncode != 0:
            raise RuntimeError(res.stderr.strip() or res.stdout.strip())
        return res.stdout

    def create(self) -> None:
        self.psql(["-c", f'DROP DATABASE IF EXISTS "{self.name}"'])
        self.psql(["-c", f'CREATE DATABASE "{self.name}"'])
        for rel, kind in migration_entries():
            self.psql([], db=self.name, stdin=migration_sql(rel, kind))

    def drop(self) -> None:
        try:
            self.psql(["-c", f'DROP DATABASE IF EXISTS "{self.name}" WITH (FORCE)'])
        except RuntimeError as exc:
            print(f"  ! could not drop {self.name}: {exc}")

    def run(self, sql: str) -> str | None:
        """None when the statement went through; the error text when Postgres refused it."""
        try:
            self.psql([], db=self.name, stdin=sql)
            return None
        except RuntimeError as exc:
            return str(exc)

    def rows(self, sql: str) -> list[dict]:
        out = self.psql(
            ["-tAc", f"SELECT COALESCE(json_agg(t), '[]'::json) FROM ({sql}) t"],
            db=self.name,
        )
        return json.loads(out.strip() or "[]")


def create_station(db: ScratchDb, hub: str, name: str) -> tuple[str, str | None]:
    new_id = f"st-{uuid.uuid4().hex[:8]}"
    err = db.run(
        bind(
            CREATE_SQL,
            {
                "new_id": new_id,
                "hub_id": hub,
                "name": name,
                "name_es": "",
                "description": "",
                "color": "#F97316",
                "icon": "flame-outline",
                "printer_name": "",
                "destination": "both",
                "printer_role": "kitchen",
                "sort_order": 0,
                "current_user_id": USER,
                "now": NOW,
            },
        )
    )
    return new_id, err


def rename_station(db: ScratchDb, hub: str, station_id: str, name: str) -> str | None:
    return db.run(
        bind(
            UPDATE_SQL,
            {
                "station_id": station_id,
                "hub_id": hub,
                "name": name,
                "color": None,
                "icon": None,
                "printer_name": None,
                "destination": None,
                "printer_role": None,
                "is_active": None,
                "current_user_id": USER,
                "now": NOW,
            },
        )
    )


def delete_station(db: ScratchDb, hub: str, station_id: str) -> None:
    err = db.run(
        bind(
            DELETE_SQL,
            {
                "station_id": station_id,
                "hub_id": hub,
                "current_user_id": USER,
                "now": NOW,
            },
        )
    )
    if err:
        raise RuntimeError(f"soft delete failed: {err}")
    gone = db.rows(f"SELECT is_deleted FROM kitchen_station WHERE id = '{station_id}'")
    if not gone or gone[0]["is_deleted"] != 1:
        raise RuntimeError(
            f"soft delete of {station_id} did not happen — fixture wrong: {gone}"
        )


def mapped_indexes(command: str) -> dict:
    return (MANIFEST.get("commands", {}).get(command) or {}).get("on_unique") or {}


def violated_index(err: str | None) -> str | None:
    m = re.search(r'unique constraint "([^"]+)"', err or "")
    return m.group(1) if m else None


def expect_name_taken(label: str, err: str | None, command: str) -> None:
    if err is None:
        fail(
            f"{label}: went through, expected a unique refusal — a LIVE station holds its name"
        )
        return
    index = violated_index(err)
    if index is None:
        fail(f"{label}: refused, but not by a unique index: {err}")
        return
    code = mapped_indexes(command).get(index)
    if code != NAME_TAKEN:
        fail(
            f"{label}: violated `{index}`, which `{command}`.on_unique maps to {code!r} — expected "
            f"{NAME_TAKEN!r}, or the screen gets the platform's `db` instead of the reason"
        )


def main() -> int:
    if not container_available():
        print(
            f"⚠ container `{CONTAINER}` not running — skipping (start the test Postgres to run it)"
        )
        return 0

    db = ScratchDb("kitchen_station_name_reuse")
    try:
        db.create()

        # 1. Created and deleted → the name is free again.
        barra, err = create_station(db, HUB_A, "Barra")
        if err:
            fail(f"fixture: the first «Barra» was refused: {err}")
            return report()
        delete_station(db, HUB_A, barra)
        again, err = create_station(db, HUB_A, "Barra")
        if err:
            fail(f"a deleted station's name cannot be reused (kitchen#120): {err}")

        # 2. A live one still holds it, through an index the manifest maps.
        _, err = create_station(db, HUB_A, "Barra")
        expect_name_taken(
            "a second live «Barra» in the same hub", err, "kitchen.stations.create"
        )

        # 3. Renaming: onto a live name refused, onto a deleted one allowed.
        plancha, err = create_station(db, HUB_A, "Plancha")
        if err:
            fail(f"fixture: «Plancha» was refused: {err}")
            return report()
        err = rename_station(db, HUB_A, plancha, "Barra")
        expect_name_taken(
            "renaming «Plancha» onto the live «Barra»", err, "kitchen.stations.update"
        )
        horno, err = create_station(db, HUB_A, "Horno")
        if err:
            fail(f"fixture: «Horno» was refused: {err}")
            return report()
        delete_station(db, HUB_A, horno)
        err = rename_station(db, HUB_A, plancha, "Horno")
        if err:
            fail(f"renaming onto a DELETED station's name was refused: {err}")

        # 4. Tenancy. Hub B has its own live «Barra»; hub A deletes its «Barra».
        _, err = create_station(db, HUB_B, "Barra")
        if err:
            fail(
                f"hub B could not create «Barra» because hub A has one — the index lost hub_id: {err}"
            )
        # Hub A deletes its live «Barra» (the one step 1 re-created, if it could).
        for row in db.rows(
            f"SELECT id FROM kitchen_station WHERE hub_id = '{HUB_A}' AND name = 'Barra' AND is_deleted = 0"
        ):
            delete_station(db, HUB_A, row["id"])
        _, err = create_station(db, HUB_B, "Barra")
        expect_name_taken(
            "hub A deleting its «Barra» freed hub B's live «Barra»",
            err,
            "kitchen.stations.create",
        )
        _, err = create_station(db, HUB_A, "Barra")
        if err:
            fail(
                f"hub B's live «Barra» blocks hub A from reusing its deleted name: {err}"
            )

        # 5. Reversible: the documented down, on a hub with no reused name, then the up again.
        down = db_down_sql() if (MODULE_DIR / MIGRATION).exists() else ""
        if not down:
            fail(f"{MIGRATION} does not document its `down` (a `-- DOWN` block)")
        else:
            rev = ScratchDb("kitchen_station_name_down")
            try:
                rev.create()
                _, e1 = create_station(rev, HUB_A, "Barra")
                _, e2 = create_station(rev, HUB_B, "Barra")
                if e1 or e2:
                    fail(f"fixture (down): {e1 or e2}")
                err = rev.run(down)
                if err:
                    fail(f"the documented down does not run: {err}")
                idx = {
                    r["indexname"]: r["indexdef"]
                    for r in rev.rows(
                        "SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'kitchen_station'"
                    )
                }
                old = idx.get("uq_kitchen_station_hub_name", "")
                if "WHERE" in old or "(hub_id, name)" not in old:
                    fail(f"after the down the old full index is not back: {idx}")
                err = rev.run((MODULE_DIR / MIGRATION).read_text(encoding="utf-8"))
                if err:
                    fail(f"the up does not run again after the down: {err}")
            finally:
                rev.drop()
    finally:
        db.drop()

    return report()


def db_down_sql() -> str:
    """The `-- DOWN:` block of the migration, uncommented: the reverse the runbook would run."""
    text = (MODULE_DIR / MIGRATION).read_text(encoding="utf-8")
    lines = text.splitlines()
    try:
        start = next(i for i, line in enumerate(lines) if line.strip().startswith("-- DOWN"))
    except StopIteration:
        return ""
    body = []
    for line in lines[start + 1 :]:
        if not line.startswith("--   "):
            break
        body.append(line[len("--   ") :])
    return "".join(f"{stmt};\n" for stmt in body)


def report() -> int:
    if failures:
        for msg in failures:
            print(f"✗ {msg}")
        print(f"\nFAILED ({len(failures)}).")
        return 1
    print(
        "✓ a deleted station frees its name, a live one holds it (mapped to kitchen.station_name_taken), per hub, reversibly"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
