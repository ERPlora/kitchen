#!/usr/bin/env python3
"""The Historial's Comanda column must filter by a FRAGMENT, not by the exact id (ERPlora/kitchen#36).

The two halves did not agree, again. `erp-kitchen-history.ts` declares the column with
`filterType: 'text'` — a free-text box, i.e. "type a piece of it" — while `module.json` filtered it
with `"order_id": {"op": "eq"}`, so the runtime emitted
`CAST(sub.order_id AS TEXT) = CAST(:f_order_id AS TEXT)`: an exact match. Anything short of the whole
id emptied the list, with nothing on screen saying why.

Same shape as kitchen#34 (the UI promising more than the manifest concedes), except here the
parameter is not dropped: it IS applied, as equality.

WHAT IS REPRODUCED of the list engine (`hub/crates/runtime/src/queries.rs`), and only that: the base
SELECT wrapped as a derived table plus the per-column condition the engine emits FOR THE OP THE
MANIFEST DECLARES — `eq` → `CAST(sub.<col> AS TEXT) = CAST(:f_<col> AS TEXT)`, `like` →
`CAST(sub.<col> AS TEXT) LIKE '%' || CAST(:f_<col> AS TEXT) || '%'`. Built from the manifest on
purpose: change the op back and this test goes red, which is the whole point.

The coherence check that used to live here — «a column the WC paints as a free-text box must not be
filtered by equality» — was **scoped to this screen**, which is exactly why the same mismatch
survived in `kitchen.orders.list` and `kitchen.stations.list` after this file went green. It now
sweeps the whole module from `tests/filter_boxes_match_the_manifest.contract.test.py` (kitchen#39),
and the behaviour of the other columns is proved by `tests/text_filters_narrow_by_fragment.pg.test.py`.
This file keeps what it was written for: that the Comanda column really narrows by a fragment.

Usage: tests/logs_column_filter.pg.test.py   (exit 0 = green)
  Uses the `erplora-test-pg-5433` container (override: KITCHEN_TEST_PG_CONTAINER).
"""

import json
import os
import pathlib
import re
import subprocess
import sys
import uuid

MODULE_DIR = pathlib.Path(__file__).resolve().parent.parent
MANIFEST = json.loads((MODULE_DIR / "module.json").read_text())
CONTAINER = os.environ.get("KITCHEN_TEST_PG_CONTAINER", "erplora-test-pg-5433")

QUERY = "kitchen.logs.list"
HUB = "hub-under-test"
OTHER_HUB = "hub-next-door"
NOW = "2026-08-21T10:00:00Z"
#: The full id of one of this hub's rows. A parcial of it is what anybody actually types.
FULL_ORDER_ID = "ORD-2026-000123"

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
        for rel in MANIFEST["migrations"]["postgres"]:
            self.psql([], db=self.name, stdin=(MODULE_DIR / rel).read_text())

    def drop(self) -> None:
        try:
            self.psql(["-c", f'DROP DATABASE IF EXISTS "{self.name}" WITH (FORCE)'])
        except RuntimeError as exc:
            print(f"  ! could not drop {self.name}: {exc}")

    def rows(self, sql: str) -> list[dict]:
        out = self.psql(
            ["-tAc", f"SELECT COALESCE(json_agg(t), '[]'::json) FROM ({sql}) t"], db=self.name
        )
        return json.loads(out.strip() or "[]")


def column_condition(column: str, value: str) -> str:
    """The condition the engine emits for this column, given the op THE MANIFEST declares."""
    spec = (MANIFEST["queries"][QUERY].get("list") or {}).get("filters") or {}
    op = (spec.get(column) or {}).get("op")
    if not IDENT.match(column):
        raise RuntimeError(f"{column} is not a plain identifier")
    if op == "eq":
        return f"CAST(sub.{column} AS TEXT) = CAST({literal(value)} AS TEXT)"
    if op == "like":
        return f"CAST(sub.{column} AS TEXT) LIKE '%' || CAST({literal(value)} AS TEXT) || '%'"
    raise RuntimeError(f"`{QUERY}` declares no usable filter for `{column}` (op={op!r})")


def list_query(db: ScratchDb, column: str | None = None, value: str | None = None, hub: str = HUB) -> list[dict]:
    spec = MANIFEST["queries"][QUERY]
    base = (MODULE_DIR / spec["sql"]).read_text().rstrip().rstrip(";").replace(":hub_id", literal(hub))
    where = f" WHERE {column_condition(column, value)}" if column else ""
    return db.rows(f"SELECT sub.* FROM ({base}) AS sub{where}")


def seed(db: ScratchDb) -> None:
    rows = [
        # id,   order_id,             action,     notes,             hub
        ("l1", FULL_ORDER_ID, "fired", "sin cebolla", HUB),
        ("l2", "ORD-2026-000124", "bumped", "mesa 7", HUB),
        ("l3", "ORD-2025-000999", "served", "terraza", HUB),
        ("l4", FULL_ORDER_ID, "fired", "sin cebolla", OTHER_HUB),
    ]
    values = ",".join(
        "(" + ",".join([literal(i), literal(hub), literal(order), "NULL", "NULL",
                        literal(action), "NULL", literal(notes), "0", literal(NOW)]) + ")"
        for i, order, action, notes, hub in rows
    )
    db.psql([], db=db.name, stdin=(
        "INSERT INTO kitchen_order_log (id, hub_id, order_id, order_item_id, station_id, "
        "action, performed_by_id, notes, is_deleted, created_at) VALUES " + values + ";"
    ))


def check_behaviour(db: ScratchDb) -> None:
    # --- check the check: unfiltered, this hub has its three rows (not the neighbour's). ---
    everything = list_query(db)
    if len(everything) != 3:
        fail(f"the unfiltered list returned {len(everything)} rows, expected 3 — fixture wrong")
        return

    # The symptom: the last digits are what anybody types at a KDS, not the whole id.
    for label, fragment, expected in (
        ("the tail of the id", "000123", ["l1"]),
        ("the year", "2026", ["l1", "l2"]),
        ("a lowercase-insensitive-free plain chunk", "ORD-2025", ["l3"]),
    ):
        ids = sorted(str(r["id"]) for r in list_query(db, "order_id", fragment))
        if ids != expected:
            fail(
                f"filtering by {label} («{fragment}») returned {ids or 'nothing'}, expected {expected} — "
                "the column still demands the exact id (kitchen#36)"
            )

    # No regression: whoever pastes the whole id still finds it, and only it.
    ids = sorted(str(r["id"]) for r in list_query(db, "order_id", FULL_ORDER_ID))
    if ids != ["l1"]:
        fail(f"the full id returned {ids or 'nothing'}, expected ['l1'] — the exact match regressed")

    # It filters rather than passing through.
    if list_query(db, "order_id", "ORD-1999"):
        fail("a fragment matching nothing returned rows: the filter is being ignored")

    # And it never reaches across hubs: the neighbour carries the very same order_id.
    if any(str(r["id"]) == "l4" for r in list_query(db, "order_id", "000123")):
        fail("the filter returned another hub's log — scoping lost")


def main() -> int:
    # The manifest-vs-box coherence check moved to
    # `tests/filter_boxes_match_the_manifest.contract.test.py`, which sweeps EVERY table of the
    # module (kitchen#39). Keeping a screen-scoped copy here is what let four other columns keep
    # the bug this file closed.
    if not container_available():
        print(f"SKIPPED: no Postgres in container {CONTAINER} (nothing was verified)")
        return 1 if failures else 0

    db = ScratchDb("kitchen_logs_column_filter")
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
    print("OK: the Comanda column narrows by a fragment, the full id still matches, and it stays inside the hub")
    return 0


if __name__ == "__main__":
    sys.exit(main())
