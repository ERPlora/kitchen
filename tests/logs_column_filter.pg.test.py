#!/usr/bin/env python3
"""The Historial's Comanda column shows AND filters by the NUMBER, not the id (kitchen#44/#36).

kitchen#36 made the free-text box of the Comanda column filter by a FRAGMENT of the order_id —
the only thing the screen had. kitchen#44 changed what the screen SHOWS: the cell now paints the
ticket's `order_number` (`20260821-0001`, what the KDS displays), because a UUID cannot be matched
by eye against a ticket. A filter that reads what nobody sees is the same bug three times over
(#34, #36, #39): the user types what is on screen and the list empties. So the `like` MOVED to
`order_number`, and `kitchen.logs.list` resolves the number with a hub-scoped join.

WHAT IS REPRODUCED of the list engine (`hub/crates/runtime/src/queries.rs`), and only that: the
base SELECT wrapped as a derived table plus the per-column condition the engine emits FOR THE OP
THE MANIFEST DECLARES — `like` → `CAST(sub.<col> AS TEXT) LIKE '%' || CAST(:f_<col> AS TEXT) || '%'`.
Built from the manifest on purpose: move the op back and this test goes red, which is the point.

Also pinned here: the join resolves the number for THIS hub's log rows only (same-hub orders, the
neighbour's same-numbered ticket must not leak in), and the number survives a soft-deleted ticket
(the trail outlives the ticket it audits).

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


def order_row(id_: str, hub: str, number: str, deleted: int = 0) -> str:
    return ("(" + ",".join([
        literal(id_), literal(hub), literal(number), "'pending'", "'dine_in'", "'normal'", "''", "''",
        "0", "0", "0", "0", "1", literal(deleted), "'u1'", "'u1'", literal(NOW), literal(NOW),
    ]) + ")")


def seed(db: ScratchDb) -> None:
    # Tickets of this hub: the audit trail's rows point here. k-dead is soft-deleted — its trail
    # must still resolve the number (the trail outlives the ticket).
    db.psql([], db=db.name, stdin=(
        "INSERT INTO kitchen_order (id, hub_id, order_number, status, order_type, priority, label, notes,"
        " subtotal, tax, discount, total, round_number, is_deleted, created_by, updated_by, created_at, updated_at) VALUES "
        + ",".join([
            order_row("k-1", HUB, "20260821-0001"),
            order_row("k-2", HUB, "20260821-0002"),
            order_row("k-old", HUB, "20250101-0009"),
            order_row("k-dead", HUB, "20260821-0003", deleted=1),
            # The neighbour's ticket carries THE SAME NUMBER as k-1: the join must scope by hub.
            order_row("k-foreign", OTHER_HUB, "20260821-0001"),
        ]) + ";"
    ))
    rows = [
        # id,     order_id,   action,     notes,         hub
        ("l1", "k-1", "received", "mesa 4", HUB),
        ("l2", "k-1", "item_bumped", "", HUB),
        ("l3", "k-2", "bumped", "pase", HUB),
        ("l4", "k-old", "served", "terraza", HUB),
        ("l5", "k-dead", "cancelled", "anulada", HUB),
        ("l6", "k-foreign", "received", "vecino", OTHER_HUB),
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


def check_projection(db: ScratchDb) -> None:
    """The cell can only paint what the query projects: `order_number` must come back."""
    everything = list_query(db)
    if len(everything) != 5:
        fail(f"the unfiltered list returned {len(everything)} rows, expected 5 — fixture wrong")
        return
    by_id = {str(r["id"]): r for r in everything}
    for log_id, number in (("l1", "20260821-0001"), ("l4", "20250101-0009")):
        got = by_id[log_id].get("order_number")
        if got != number:
            fail(f"log {log_id} carries order_number={got!r}, expected {number!r} — the join did not resolve the number (kitchen#44)")
    # The trail outlives the ticket: a soft-deleted ticket still gives its number.
    if by_id["l5"].get("order_number") != "20260821-0003":
        fail(
            f"a soft-deleted ticket's log lost its number ({by_id['l5'].get('order_number')!r}) — "
            "the audit trail must outlive the ticket it audits"
        )


def check_behaviour(db: ScratchDb) -> None:
    # The symptom: the number is what the screen shows, so the number is what one types.
    for label, fragment, expected in (
        ("the tail of the number", "0001", ["l1", "l2"]),
        ("the year", "2026", ["l1", "l2", "l3", "l5"]),
        ("another year", "2025", ["l4"]),
    ):
        ids = sorted(str(r["id"]) for r in list_query(db, "order_number", fragment))
        if ids != expected:
            fail(
                f"filtering by {label} («{fragment}») returned {ids or 'nothing'}, expected {expected} — "
                "the Comanda column does not narrow by the number it shows (kitchen#44)"
            )

    # No regression: the whole number still matches, and only it.
    ids = sorted(str(r["id"]) for r in list_query(db, "order_number", "20260821-0002"))
    if ids != ["l3"]:
        fail(f"the full number returned {ids or 'nothing'}, expected ['l3'] — the exact match regressed")

    # It filters rather than passing through.
    if list_query(db, "order_number", "1999-"):
        fail("a fragment matching nothing returned rows: the filter is being ignored")

    # And it never reaches across hubs: the neighbour carries the very same number.
    if any(str(r["id"]) == "l6" for r in list_query(db, "order_number", "0001")):
        fail("the filter returned another hub's log — scoping lost")


def main() -> int:
    # The manifest-vs-box coherence check lives in
    # `tests/filter_boxes_match_the_manifest.contract.test.py`, which sweeps EVERY table of the
    # module (kitchen#39).
    if not container_available():
        print(f"SKIPPED: no Postgres in container {CONTAINER} (nothing was verified)")
        return 1 if failures else 0

    db = ScratchDb("kitchen_logs_column_filter")
    db.create()
    try:
        seed(db)
        check_projection(db)
        check_behaviour(db)
    finally:
        db.drop()

    if failures:
        print(f"FAIL ({len(failures)}):")
        for f in failures:
            print(f"  - {f}")
        return 1
    print("OK: the Comanda column shows and narrows by the NUMBER, a deleted ticket keeps its number, and it stays inside the hub")
    return 0


if __name__ == "__main__":
    sys.exit(main())
