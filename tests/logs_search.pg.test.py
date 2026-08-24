#!/usr/bin/env python3
"""Typing in the Historial search box must REDUCE the list (ERPlora/kitchen#34).

The contract half is `tests/searchable_promises_search.contract.test.py`: the manifest must declare
a `search` block for a table that paints a box. This is the other half — that the block actually
works against a real Postgres, on this module's own migrations and this module's own SQL.

Why both. Declaring `search: ["action", "order_id", "notes"]` and calling it done would leave two
ways to still be broken, and neither raises anything the contract test can see:

  * a column that is NOT in the base SELECT. The engine emits `CAST(sub.<col> AS TEXT) LIKE …`
    against the derived table, so a name that the SELECT does not project is a SQL ERROR at query
    time — the Historial would stop loading altogether, which is worse than not searching.
  * a column that is there but never matches what the placeholder promised.

WHAT IS REPRODUCED of the list engine (`hub/crates/runtime/src/queries.rs`), and only that: the base
SELECT wrapped as a derived table, the OR-ed `CAST(sub.<col> AS TEXT) LIKE '%' || :search || '%'`
composed FROM THE MANIFEST (never hardcoded here — a wrong manifest must fail this test, not be
papered over by it), and the `hub_id` scoping the base SQL already carries.

Usage: tests/logs_search.pg.test.py   (exit 0 = green)
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

QUERY = "kitchen.logs.list"
HUB = "hub-under-test"
OTHER_HUB = "hub-next-door"
NOW = "2026-08-18T10:00:00Z"

#: The engine only emits a condition for a syntactically safe identifier (`is_ident`).
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


def list_query(db: ScratchDb, search: str | None, hub: str = HUB) -> list[dict]:
    """Run `kitchen.logs.list` the way the runtime composes it, search included."""
    spec = MANIFEST["queries"][QUERY]
    base = (MODULE_DIR / spec["sql"]).read_text().rstrip().rstrip(";")
    base = base.replace(":hub_id", literal(hub))

    conds: list[str] = []
    # Composed FROM THE MANIFEST on purpose: a typo there must surface here.
    columns = [
        c for c in (spec.get("list") or {}).get("search") or [] if IDENT.match(c)
    ]
    if columns and search is not None:
        likes = [
            f"CAST(sub.{c} AS TEXT) LIKE '%' || CAST({literal(search)} AS TEXT) || '%'"
            for c in columns
        ]
        conds.append("(" + " OR ".join(likes) + ")")

    where = (" WHERE " + " AND ".join(conds)) if conds else ""
    return db.rows(f"SELECT sub.* FROM ({base}) AS sub{where}")


def seed(db: ScratchDb) -> None:
    """Three logs of this hub, each carrying its distinctive term in a DIFFERENT promised field.

    Since kitchen#44 the Comanda column shows (and searches) the ticket's NUMBER, so each log
    points at a ticket of its own hub whose number carries the distinctive token.
    """
    orders = [
        # id,        hub,      order_number
        ("k-alpha", HUB, "20260821-0001"),
        ("k-beta", HUB, "20260821-0002"),
        ("k-gamma", HUB, "20260821-0003"),
        ("k-alpha-x", OTHER_HUB, "20260821-0001"),
    ]
    db.psql(
        [],
        db=db.name,
        stdin=(
            "INSERT INTO kitchen_order (id, hub_id, order_number, status, order_type, priority, label, notes,"
            " subtotal, tax, discount, total, round_number, is_deleted, created_by, updated_by, created_at, updated_at) VALUES "
            + ",".join(
                "("
                + ",".join(
                    [
                        literal(i),
                        literal(hub),
                        literal(number),
                        "'pending'",
                        "'dine_in'",
                        "'normal'",
                        "''",
                        "''",
                        "0",
                        "0",
                        "0",
                        "0",
                        "1",
                        "0",
                        "'u1'",
                        "'u1'",
                        literal(NOW),
                        literal(NOW),
                    ]
                )
                + ")"
                for i, hub, number in orders
            )
            + ";"
        ),
    )
    rows = [
        # id,     order_id,      action,     notes,                 hub
        ("l1", "k-alpha", "fired", "sin cebolla", HUB),
        ("l2", "k-beta", "bumped", "mesa 7 con prisa", HUB),
        ("l3", "k-gamma", "recalled", "plato devuelto", HUB),
        ("l4", "k-alpha-x", "fired", "sin cebolla", OTHER_HUB),
    ]
    values = ",".join(
        "("
        + ",".join(
            [
                literal(i),
                literal(hub),
                literal(order),
                "NULL",
                "NULL",
                literal(action),
                "NULL",
                literal(notes),
                "0",
                literal(NOW),
            ]
        )
        + ")"
        for i, order, action, notes, hub in rows
    )
    db.psql(
        [],
        db=db.name,
        stdin=(
            "INSERT INTO kitchen_order_log (id, hub_id, order_id, order_item_id, station_id, "
            "action, performed_by_id, notes, is_deleted, created_at) VALUES "
            + values
            + ";"
        ),
    )


def check_manifest() -> list[str]:
    spec = MANIFEST["queries"][QUERY]
    columns = (spec.get("list") or {}).get("search") or []
    if not columns:
        fail(
            f"`{QUERY}` declares no `search` block: the Historial paints a box and the runtime "
            "drops the parameter in silence (kitchen#34)"
        )
        return []

    # The placeholder promises three things; the block must cover all three.
    base = (MODULE_DIR / spec["sql"]).read_text()
    for promised in ("action", "order_number", "notes"):
        if promised not in columns:
            fail(
                f"the placeholder promises `{promised}` but `search` does not cover it: {columns}"
            )
    for c in columns:
        if not IDENT.match(c):
            fail(f"`{c}` is not a plain identifier — the engine skips it silently")
        elif not re.search(rf"\b{re.escape(c)}\b", base):
            fail(
                f"`search` names `{c}`, which the base SELECT does not project → SQL error at query time"
            )
    return columns


def check_behaviour(db: ScratchDb) -> None:
    # --- check the check: without a term the list must show this hub's three rows (not the 4th). --
    everything = list_query(db, None)
    if len(everything) != 3:
        fail(
            f"the unfiltered list returned {len(everything)} rows, expected this hub's 3 — fixture wrong"
        )
        return

    # One term per promised field, each matching exactly one row.
    for label, term, expected_id in (
        ("by ACTION", "recalled", "l3"),
        ("by ORDER number", "0002", "l2"),
        ("by NOTES", "cebolla", "l1"),
    ):
        got = list_query(db, term)
        ids = sorted(str(r["id"]) for r in got)
        if ids != [expected_id]:
            fail(
                f"searching {label} («{term}») returned {ids or 'nothing'}, expected ['{expected_id}'] — "
                f"the box does not narrow the list (kitchen#34)"
            )

    # A term that matches nothing must empty the list — proves it filters rather than passing through.
    noise = list_query(db, "zzz-no-such-term")
    if noise:
        fail(
            f"a term matching nothing returned {len(noise)} rows: the search is being ignored"
        )

    # And the search must never reach across hubs: 'cebolla' is also in the neighbour's row.
    for row in list_query(db, "cebolla"):
        if str(row["id"]) == "l4":
            fail("the search returned another hub's log — scoping lost")


def main() -> int:
    columns = check_manifest()

    if not container_available():
        print(f"SKIPPED: no Postgres in container {CONTAINER} (nothing was verified)")
        return 1 if failures else 0

    db = ScratchDb("kitchen_logs_search")
    db.create()
    try:
        seed(db)
        if columns:
            check_behaviour(db)
        else:
            # Still prove the box currently filters NOTHING — that is the reported symptom.
            unfiltered = len(list_query(db, None))
            typed = len(list_query(db, "recalled"))
            if unfiltered == typed:
                fail(
                    f"typing a term left the list at {typed} rows: it filters nothing (kitchen#34)"
                )
    finally:
        db.drop()

    if failures:
        print(f"FAIL ({len(failures)}):")
        for f in failures:
            print(f"  - {f}")
        return 1
    print(
        f"OK: the Historial search narrows the list across {columns}, and stays inside the hub"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
