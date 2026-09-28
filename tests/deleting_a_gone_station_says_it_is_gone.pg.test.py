#!/usr/bin/env python3
"""Deleting a station that no longer exists says so; one that is in use still says «in use» (kitchen#126).

Since kitchen#124 the soft delete (`kitchen._station_soft_delete`) carries `expect_rows {min 1,
kitchen.station_in_use}`. Its guards live in the WHERE and the handler reads nothing first, so 0
rows was ALWAYS read as «still has routings or lines being prepared» — also when the station had
already been deleted (someone else deleted it on another device, or the trash can was pressed twice
before the list refreshed). The screen gave a false reason.

The fix: `delete_station` emits a first intention, `kitchen._station_ensure_live`, that touches the
station only if it is alive in this hub, with its own `expect_rows {min 1, kitchen.station_unavailable}`.
Both run in one transaction; the first intention that affects 0 rows reverts it and names its code.
The handler's order is pinned by its Rust test (`deleting_a_station_first_proves_it_is_still_there`).

What this pins, against a real Postgres built from this module's own migrations, running the
module's REAL SQL files (resolved from `module.json`, like the runtime) with the binds the runtime
injects, and taking each refusal code from the manifest's `expect_rows`:

  1. a live, unused station: both intentions affect 1 row — it is deleted;
  2. deleting it AGAIN: the liveness check affects 0 rows → `kitchen.station_unavailable`;
  3. an id that never existed → `kitchen.station_unavailable`;
  4. a live station with a routing: the liveness check passes and the soft delete refuses →
     `kitchen.station_in_use` (kitchen#124 keeps its real refusal) and the station stays alive;
  5. tenancy: hub A asking to delete hub B's live station → `kitchen.station_unavailable`, and hub
     B's station is untouched (not deleted, `updated_at` unchanged).

Usage: tests/deleting_a_gone_station_says_it_is_gone.pg.test.py   (exit 0 = green)
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
CATEGORY_ROUTE_SQL = (MODULE_DIR / "commands/category_route_set.sql").read_text(
    encoding="utf-8"
)
CONTAINER = os.environ.get("KITCHEN_TEST_PG_CONTAINER", "erplora-test-pg-5433")

# The intentions `delete_station` emits, in the order it emits them (pinned by the handler test).
DELETE_INTENTIONS = ["kitchen._station_ensure_live", "kitchen._station_soft_delete"]
UNAVAILABLE = "kitchen.station_unavailable"
IN_USE = "kitchen.station_in_use"

HUB_A = "hub-a"
HUB_B = "hub-b"
USER = "user-1"
CREATED_AT = "2026-09-28T09:00:00Z"
NOW = "2026-09-28T10:00:00Z"

failures: list[str] = []


def fail(msg: str) -> None:
    failures.append(msg)


def literal(value) -> str:
    if value is None:
        return "NULL"
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

    def rows(self, sql: str) -> list[dict]:
        out = self.psql(
            ["-tAc", f"SELECT COALESCE(json_agg(t), '[]'::json) FROM ({sql}) t"],
            db=self.name,
        )
        return json.loads(out.strip() or "[]")


def intention(name: str) -> tuple[str, str | None]:
    """The SQL the runtime runs for an intention and the code its `expect_rows` refuses with."""
    cmd = (MANIFEST.get("commands") or {}).get(name)
    if not cmd:
        raise LookupError(f"`{name}` is not declared in module.json")
    sql = "\n".join(
        (MODULE_DIR / rel).read_text(encoding="utf-8") for rel in cmd.get("sql") or []
    )
    return sql, (cmd.get("expect_rows") or {}).get("error")


def delete(db: ScratchDb, hub: str, station_id: str) -> str | None:
    """Runs the delete intentions in ONE transaction, as the runtime does: the first that affects 0
    rows (below its `expect_rows` minimum) rolls everything back and names its code. None = deleted."""
    binds = {
        "station_id": station_id,
        "hub_id": hub,
        "current_user_id": USER,
        "now": NOW,
    }
    stmts = [
        (name, bind(intention(name)[0], binds).strip().rstrip(";") + ";")
        for name in DELETE_INTENTIONS
    ]
    # Measured inside a transaction that is rolled back: psql prints each statement's tag
    # (`UPDATE n`), and the marker echoed after it says which intention it belongs to.
    probe = ["BEGIN;"]
    for name, sql in stmts:
        probe += [sql, f"\\echo ::{name}"]
    probe.append("ROLLBACK;")
    affected: dict[str, int] = {}
    last = None
    for line in db.psql([], db=db.name, stdin="\n".join(probe)).splitlines():
        m = re.match(r"UPDATE (\d+)$", line.strip())
        if m:
            last = int(m.group(1))
        elif line.startswith("::") and last is not None:
            affected[line[2:]] = last
            last = None
    for name in DELETE_INTENTIONS:
        if affected.get(name, 0) < 1:
            return intention(name)[1] or f"<{name} declares no expect_rows code>"
    # Nothing refused: run it for real so the next step sees the station deleted.
    db.psql(
        [],
        db=db.name,
        stdin="\n".join(["BEGIN;"] + [sql for _, sql in stmts] + ["COMMIT;"]),
    )
    return None


def create_station(db: ScratchDb, hub: str, name: str) -> str:
    new_id = f"st-{uuid.uuid4().hex[:8]}"
    db.psql(
        [],
        db=db.name,
        stdin=bind(
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
                "now": CREATED_AT,
            },
        ),
    )
    return new_id


def route_category(db: ScratchDb, hub: str, station_id: str) -> None:
    db.psql(
        [],
        db=db.name,
        stdin=bind(
            CATEGORY_ROUTE_SQL,
            {
                "new_id": f"cs-{uuid.uuid4().hex[:8]}",
                "hub_id": hub,
                "station_id": station_id,
                "category_id": f"cat-{uuid.uuid4().hex[:6]}",
                "current_user_id": USER,
                "now": NOW,
            },
        ),
    )
    routed = db.rows(
        f"SELECT 1 FROM kitchen_category_station WHERE station_id = '{station_id}' AND is_deleted = 0"
    )
    if not routed:
        raise RuntimeError(f"fixture: the routing of {station_id} was not written")


def station(db: ScratchDb, station_id: str) -> dict:
    got = db.rows(
        f"SELECT is_deleted, updated_at::text AS updated_at FROM kitchen_station WHERE id = '{station_id}'"
    )
    return got[0] if got else {}


def expect(label: str, got: str | None, want: str | None) -> None:
    if got != want:
        fail(f"{label}: expected {want or 'deleted'}, got {got or 'deleted'}")


def main() -> int:
    if not container_available():
        print(
            f"⚠ container `{CONTAINER}` not running — skipping (start the test Postgres to run it)"
        )
        return 0
    try:
        for name in DELETE_INTENTIONS:
            intention(name)
    except LookupError as exc:
        fail(str(exc))
        return report()
    _, live_code = intention("kitchen._station_ensure_live")
    if live_code != UNAVAILABLE:
        fail(
            f"`kitchen._station_ensure_live` refuses with {live_code!r}, expected {UNAVAILABLE!r}"
        )

    db = ScratchDb("kitchen_station_gone")
    try:
        db.create()

        # 1. A live, unused station is deleted.
        barra = create_station(db, HUB_A, "Barra")
        expect("deleting a live, unused station", delete(db, HUB_A, barra), None)
        if station(db, barra).get("is_deleted") != 1:
            fail(f"the live, unused station was not deleted: {station(db, barra)}")

        # 2. Deleting it again: it is gone, not «in use».
        expect(
            "deleting the same station a second time",
            delete(db, HUB_A, barra),
            UNAVAILABLE,
        )

        # 3. An id that never existed.
        expect(
            "deleting a station that never existed",
            delete(db, HUB_A, "st-nope"),
            UNAVAILABLE,
        )

        # 4. In use: the real refusal of kitchen#124 survives, and the station stays alive.
        freidora = create_station(db, HUB_A, "Freidora")
        route_category(db, HUB_A, freidora)
        expect("deleting a station with a routing", delete(db, HUB_A, freidora), IN_USE)
        if station(db, freidora).get("is_deleted") != 0:
            fail(f"a refused delete still deleted the station: {station(db, freidora)}")

        # 5. Tenancy: hub A cannot see — nor touch — hub B's station.
        ajena = create_station(db, HUB_B, "Plancha")
        before = station(db, ajena)
        expect(
            "hub A deleting hub B's live station", delete(db, HUB_A, ajena), UNAVAILABLE
        )
        after = station(db, ajena)
        if after != before:
            fail(f"hub A's delete touched hub B's station: {before} → {after}")
    finally:
        db.drop()

    return report()


def report() -> int:
    if failures:
        for msg in failures:
            print(f"✗ {msg}")
        print(f"\nFAILED ({len(failures)}).")
        return 1
    print(
        "✓ a gone station says it is gone, a station in use says it is in use, per hub"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
