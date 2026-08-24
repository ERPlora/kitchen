#!/usr/bin/env python3
"""Typing a piece of it finds it — on the orders table and on the stations table (kitchen#39).

Sibling of `logs_column_filter.pg.test.py`, which proved the same thing for the Historial's Comanda
column (kitchen#36). The other three free-text boxes of the module were left demanding the whole
value, so the fix of the first screen did nothing for them:

    kitchen.orders.list    order_number   filterType: 'text'  →  op: eq
    kitchen.orders.list    label          filterType: 'text'  →  NOT DECLARED AT ALL
    kitchen.stations.list  printer_name   filterType: 'text'  →  op: eq

`label` is the worse one of the three: the column was painted `filterable` and `sortable` and the
`list` block declared neither, so the runtime dropped the parameter — the box accepted typing and
did nothing whatsoever (the shape of kitchen#34), and the header did not sort.

WHAT IS REPRODUCED of the list engine (`hub/crates/runtime/src/queries.rs`), and only that: the base
SELECT wrapped as a derived table plus the per-column condition the engine emits FOR THE OP THE
MANIFEST DECLARES — `eq` → `CAST(sub.<col> AS TEXT) = CAST(:f_<col> AS TEXT)`, `like` →
`CAST(sub.<col> AS TEXT) LIKE '%' || CAST(:f_<col> AS TEXT) || '%'`. Built from the manifest on
purpose: put the op back to `eq` and this test goes red, which is the whole point.

Whether every box MATCHES its column is the job of the sibling contract gate,
`filter_boxes_match_the_manifest.contract.test.py`, which sweeps the whole module. This one is the
behaviour underneath: that the operator the manifest now declares does what the user expects, still
respects the hub boundary, and did not lose the exact match on the way.

Usage: tests/text_filters_narrow_by_fragment.pg.test.py   (exit 0 = green)
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
MANIFEST = json.loads((MODULE_DIR / "module.json").read_text())
CONTAINER = os.environ.get("KITCHEN_TEST_PG_CONTAINER", "erplora-test-pg-5433")

HUB = "hub-under-test"
OTHER_HUB = "hub-next-door"
NOW = "2026-08-21T10:00:00Z"

#: A full order number. The last digits are what a cook actually types at the pass.
FULL_ORDER_NUMBER = "CMD-2026-000123"

IDENT = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*$")

failures: list[str] = []


def fail(msg: str) -> None:
    failures.append(msg)


def literal(value) -> str:
    if value is None:
        return "NULL"
    if isinstance(value, int):
        return str(value)
    return "'" + str(value).replace("'", "''") + "'"


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
        out = self.psql(
            ["-tAc", f"SELECT COALESCE(json_agg(t), '[]'::json) FROM ({sql}) t"],
            db=self.name,
        )
        return json.loads(out.strip() or "[]")


def column_condition(query: str, column: str, value: str) -> str:
    """The condition the engine emits for this column, given the op THE MANIFEST declares."""
    spec = (MANIFEST["queries"][query].get("list") or {}).get("filters") or {}
    op = (spec.get(column) or {}).get("op")
    if not IDENT.match(column):
        raise RuntimeError(f"{column} is not a plain identifier")
    if op == "eq":
        return f"CAST(sub.{column} AS TEXT) = CAST({literal(value)} AS TEXT)"
    if op == "like":
        return f"CAST(sub.{column} AS TEXT) LIKE '%' || CAST({literal(value)} AS TEXT) || '%'"
    raise RuntimeError(
        f"`{query}` declares no usable filter for `{column}` (op={op!r}) — the box is painted but "
        f"the runtime drops the parameter"
    )


def list_query(
    db: ScratchDb, query: str, column=None, value=None, hub: str = HUB
) -> list[dict]:
    spec = MANIFEST["queries"][query]
    base = (
        (MODULE_DIR / spec["sql"])
        .read_text()
        .rstrip()
        .rstrip(";")
        .replace(":hub_id", literal(hub))
    )
    where = f" WHERE {column_condition(query, column, value)}" if column else ""
    return db.rows(f"SELECT sub.* FROM ({base}) AS sub{where}")


def seed(db: ScratchDb) -> None:
    orders = [
        # id,  order_number,          label,             hub
        ("o1", FULL_ORDER_NUMBER, "Mesa 4", HUB),
        ("o2", "CMD-2026-000124", "Recogida Ana", HUB),
        ("o3", "CMD-2025-000999", "Barra", HUB),
        ("o4", FULL_ORDER_NUMBER, "Mesa 4", OTHER_HUB),
    ]
    db.psql(
        [],
        db=db.name,
        stdin=(
            "INSERT INTO kitchen_order (id, hub_id, order_number, label, status, order_type, priority, "
            "is_deleted, created_at) VALUES "
            + ",".join(
                "("
                + ",".join(
                    [
                        literal(i),
                        literal(hub),
                        literal(number),
                        literal(label),
                        "'pending'",
                        "'dine_in'",
                        "'normal'",
                        "0",
                        literal(NOW),
                    ]
                )
                + ")"
                for i, number, label, hub in orders
            )
            + ";"
        ),
    )
    stations = [
        ("s1", "Plancha", "IMPRESORA-COCINA-01", HUB),
        ("s2", "Frío", "IMPRESORA-BARRA-02", HUB),
        ("s3", "Postres", "", HUB),
        ("s4", "Plancha", "IMPRESORA-COCINA-01", OTHER_HUB),
    ]
    db.psql(
        [],
        db=db.name,
        stdin=(
            "INSERT INTO kitchen_station (id, hub_id, name, printer_name, is_deleted, created_at) VALUES "
            + ",".join(
                "("
                + ",".join(
                    [
                        literal(i),
                        literal(hub),
                        literal(name),
                        literal(printer),
                        "0",
                        literal(NOW),
                    ]
                )
                + ")"
                for i, name, printer, hub in stations
            )
            + ";"
        ),
    )


def check_column(
    db, query, column, fixtures, full_value, full_expected, nothing_value, neighbour_id
):
    """One free-text column: fragments narrow, the whole value still matches, and the hub holds."""
    # Check the check: without a filter this hub has its three rows and not the neighbour's.
    everything = list_query(db, query)
    if len(everything) != 3:
        fail(
            f"`{query}` unfiltered returned {len(everything)} rows, expected 3 — fixture wrong"
        )
        return

    for label, fragment, expected in fixtures:
        try:
            ids = sorted(str(r["id"]) for r in list_query(db, query, column, fragment))
        except RuntimeError as exc:
            # A column the `list` block does not declare has no condition to emit at all: that is a
            # finding, not a crash, and it has to read like one next to the others.
            fail(f"`{query}`.`{column}` cannot be filtered: {exc}")
            return
        if ids != expected:
            fail(
                f"`{query}`.`{column}` filtered by {label} («{fragment}») returned {ids or 'nothing'}, "
                f"expected {expected} — the column still demands the whole value (kitchen#39)"
            )

    ids = sorted(str(r["id"]) for r in list_query(db, query, column, full_value))
    if ids != full_expected:
        fail(
            f"`{query}`.`{column}`: the whole value returned {ids or 'nothing'}, expected {full_expected} — the exact match regressed"
        )

    if list_query(db, query, column, nothing_value):
        fail(
            f"`{query}`.`{column}`: a fragment matching nothing returned rows — the filter is being ignored"
        )

    if any(
        str(r["id"]) == neighbour_id for r in list_query(db, query, column, full_value)
    ):
        fail(f"`{query}`.`{column}` returned another hub's row — scoping lost")


def check_behaviour(db: ScratchDb) -> None:
    check_column(
        db,
        "kitchen.orders.list",
        "order_number",
        [
            ("the tail of the number", "000123", ["o1"]),
            ("the year", "2026", ["o1", "o2"]),
            ("a plain chunk", "CMD-2025", ["o3"]),
        ],
        FULL_ORDER_NUMBER,
        ["o1"],
        "CMD-1999",
        "o4",
    )
    check_column(
        db,
        "kitchen.orders.list",
        "label",
        [
            # The label is opaque free text somebody typed at the till (ADR-0141): a piece of it is
            # all anybody remembers. Before this it was not even declared — nothing was filtered.
            ("a piece of the table", "Mesa", ["o1"]),
            ("a piece of a pickup name", "Ana", ["o2"]),
        ],
        "Mesa 4",
        ["o1"],
        "Terraza",
        "o4",
    )
    check_column(
        db,
        "kitchen.stations.list",
        "printer_name",
        [
            ("the room", "COCINA", ["s1"]),
            ("the prefix every printer shares", "IMPRESORA", ["s1", "s2"]),
        ],
        "IMPRESORA-COCINA-01",
        ["s1"],
        "IMPRESORA-TERRAZA",
        "s4",
    )


def main() -> int:
    if not container_available():
        print(f"SKIPPED: no Postgres in container {CONTAINER} (nothing was verified)")
        return 0

    db = ScratchDb("kitchen_text_filters")
    db.create()
    try:
        seed(db)
        check_behaviour(db)
    finally:
        db.drop()

    if failures:
        print(f"FAIL ({len(failures)}):")
        for f in failures:
            print(f"  - {f}")
        return 1
    print(
        "OK: order_number, label and printer_name narrow by fragment, the whole value still "
        "matches, and no filter reaches across hubs"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
