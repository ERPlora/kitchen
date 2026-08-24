#!/usr/bin/env python3
"""The comanda line freezes the LOCALIZED station name (kitchen#45).

`kitchen_order_item.station_name` is a HISTORICAL SNAPSHOT (ADR-0145): what the ticket, the KDS
and the printed vale read later. Until now `_insert_item` froze `kitchen_station.name` — the SEED
column, English («Bar», «Kitchen») — even on hubs whose locale is `es` and whose rows carry
`name_es` («Barra», «Cocina») filled in. Result: a KDS segment reading «Todas las estaciones |
Kitchen | Sin estación» — two labels in Spanish and one in English — and `Kitchen` under every
product, which is exactly what #23 («zero English strings on a Spanish hub») said would not
happen again.

The choice of column belongs HERE, at freeze time (the issue's own prescription): the KDS also
resolves by `station_id` when it paints, so comandas sent before the change render localized too,
but what is STORED from now on must already be the name of the hub's language.

What this pins, against a real Postgres built from this module's own migrations, running the
module's REAL `commands/_insert_item.sql` with the binds the runtime would inject:

  * a line routed to a station WITH `name_es` freezes the localized name;
  * a station WITHOUT `name_es` (empty) freezes its base `name` — never a blank;
  * an unrouted line still freezes '' (no station: the KDS groups it under «Sin estación»).

Usage: tests/station_name_freezes_localized.pg.test.py   (exit 0 = green)
  Uses the `erplora-test-pg-5433` container (override: KITCHEN_TEST_PG_CONTAINER).
"""

import json
import os
import pathlib
import subprocess
import sys
import uuid

from module_migrations import migration_entries, migration_sql

MODULE_DIR = pathlib.Path(__file__).resolve().parent.parent
MANIFEST = json.loads((MODULE_DIR / "module.json").read_text(encoding="utf-8"))
COMMAND_SQL = (MODULE_DIR / "commands/_insert_item.sql").read_text(encoding="utf-8")
CONTAINER = os.environ.get("KITCHEN_TEST_PG_CONTAINER", "erplora-test-pg-5433")

HUB = "hub-under-test"
OTHER_HUB = "hub-next-door"
USER = "user-1"
NOW = "2026-08-22T12:00:00Z"

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


def container_available() -> bool:
    try:
        subprocess.run(["docker", "inspect", CONTAINER], capture_output=True, check=True, text=True)
        return True
    except (subprocess.CalledProcessError, FileNotFoundError):
        return False


class ScratchDb:
    def __init__(self, prefix: str):
        self.name = f"{prefix}_{os.getpid()}_{uuid.uuid4().hex[:6]}"

    def psql(self, args, db=None, stdin=None) -> str:
        cmd = ["docker", "exec", "-i", CONTAINER, "psql", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-X"]
        if db:
            cmd += ["-d", db]
        res = subprocess.run(cmd + args, input=stdin, capture_output=True, text=True)
        if res.returncode != 0:
            raise RuntimeError(res.stderr.strip() or res.stdout.strip())
        return res.stdout

    def create(self) -> None:
        self.psql(["-c", f'DROP DATABASE IF EXISTS "{self.name}"'])
        self.psql(["-c", f'CREATE DATABASE "{self.name}"'])
        # Both shapes of `MigrationEntry`, and a `contract` translated the way the runtime
        # applies it — see `module_migrations`.
        for rel, kind in migration_entries():
            self.psql([], db=self.name, stdin=migration_sql(rel, kind))

    def drop(self) -> None:
        try:
            self.psql(["-c", f'DROP DATABASE IF EXISTS "{self.name}" WITH (FORCE)'])
        except RuntimeError as exc:
            print(f"  ! could not drop {self.name}: {exc}")

    def rows(self, sql: str) -> list[dict]:
        out = self.psql(["-tAc", f"SELECT COALESCE(json_agg(t), '[]'::json) FROM ({sql}) t"], db=self.name)
        return json.loads(out.strip() or "[]")


def insert_item(db: ScratchDb, item_id: str, order_id: str, product_id: str, category_id=None, station_id=None) -> None:
    """Run the module's REAL _insert_item SQL with this line, as the runtime would bind it."""
    binds = {
        "item_id": item_id,
        "order_id": order_id,
        "product_id": product_id,
        "product_name": f"product {product_id}",
        "category_id": category_id,
        "station_id": station_id,
        "sales_order_item_id": None,
        "unit_price": 500,
        "quantity": 1_000_000,
        "total": 500,
        "modifiers": "",
        "notes": "",
        "status": "pending",
        "seat_number": None,
        # kitchen#57 — `_insert_item` now also freezes the MENU the line belongs to
        # (ADR-0381). Not a menu here: NULL / '' / first line.
        "combo_ref": None,
        "combo_name": "",
        "line_seq": 1,
        "hub_id": HUB,
        "current_user_id": USER,
        "now": NOW,
    }
    sql = COMMAND_SQL
    for key, value in binds.items():
        sql = sql.replace(f":{key}", literal(value))
    db.psql([], db=db.name, stdin=sql)


def seed(db: ScratchDb) -> None:
    db.psql([], db=db.name, stdin=f"""
INSERT INTO kitchen_order (id, hub_id, order_number, status, order_type, priority, label, notes,
                           subtotal, tax, discount, total, round_number,
                           is_deleted, created_by, updated_by, created_at, updated_at)
VALUES ('k-1', '{HUB}', '20260822-0001', 'pending', 'dine_in', 'normal', 'Mesa 4', '',
        0, 0, 0, 0, 1, 0, '{USER}', '{USER}', '{NOW}', '{NOW}');

-- Bar carries the translation; Grill does not (the fallback case), and the neighbour's Bar is
-- irrelevant but carries the very same names.
INSERT INTO kitchen_station (id, hub_id, name, name_es, is_active, is_deleted, created_at)
VALUES ('st-bar',   '{HUB}', 'Bar',    'Barra',  1, 0, '{NOW}'),
       ('st-grill', '{HUB}', 'Grill',  '',       1, 0, '{NOW}'),
       ('st-bar-x', '{OTHER_HUB}', 'Bar', 'Barra del vecino', 1, 0, '{NOW}');

-- Routing: product p-caña → Bar (translated station), category cat-comida → Grill (no translation).
INSERT INTO kitchen_product_station (id, hub_id, product_id, station_id, is_deleted, created_at)
VALUES ('r1', '{HUB}', 'p-cana', 'st-bar', 0, '{NOW}');
INSERT INTO kitchen_category_station (id, hub_id, category_id, station_id, is_deleted, created_at)
VALUES ('r2', '{HUB}', 'cat-comida', 'st-grill', 0, '{NOW}');
""")


def main() -> int:
    if not container_available():
        print(f"⚠ container `{CONTAINER}` not running — skipping (start the test Postgres to run it)")
        return 0

    db = ScratchDb("kitchen_station_freeze")
    try:
        db.create()
        seed(db)

        # 1. Product routing → the localized name is what freezes.
        insert_item(db, "i1", "k-1", "p-cana")
        # 2. Category routing (station without name_es) → the base name, never a blank.
        insert_item(db, "i2", "k-1", "p-plato", category_id="cat-comida")
        # 3. Unrouted → no station, the KDS groups it under «Sin estación» (unchanged).
        insert_item(db, "i3", "k-1", "p-raro")

        rows = {str(r["id"]): r for r in db.rows(
            "SELECT id, station_id, station_name FROM kitchen_order_item"
        )}
        if len(rows) != 3:
            fail(f"expected 3 lines, found {len(rows)} — fixture wrong")
            raise SystemExit(report())

        got = rows["i1"]
        if got.get("station_name") != "Barra":
            fail(
                f"a line routed to a translated station froze {got.get('station_name')!r}, "
                "expected 'Barra' — the snapshot takes the SEED column, English on a Spanish hub (kitchen#45)"
            )
        if got.get("station_id") != "st-bar":
            fail(f"i1 routed to {got.get('station_id')!r}, expected 'st-bar' — fixture wrong")

        got = rows["i2"]
        if got.get("station_name") != "Grill":
            fail(
                f"a station without name_es froze {got.get('station_name')!r}, expected its base "
                "name 'Grill' — the fallback is the base name, never a blank"
            )

        got = rows["i3"]
        if got.get("station_id") is not None or got.get("station_name") != "":
            fail(
                f"an unrouted line froze station_id={got.get('station_id')!r} "
                f"station_name={got.get('station_name')!r}, expected none/'' — the «Sin estación» grouping changed"
            )

        # And the neighbour's identically-named station never routes this hub's lines.
        leak = db.rows(
            f"SELECT id FROM kitchen_order_item WHERE station_id = 'st-bar-x'"
        )
        if leak:
            fail("a line was routed to another hub's station — the routing join lost its scope")
    finally:
        db.drop()

    return report()


def report() -> int:
    if failures:
        for msg in failures:
            print(f"✗ {msg}")
        print(f"\nFAILED ({len(failures)}).")
        return 1
    print("✓ the line freezes the LOCALIZED station name (base name fallback, '' when unrouted, no cross-hub leak)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
