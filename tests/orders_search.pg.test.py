#!/usr/bin/env python3
"""Typing a destination or an order number in the Comandas box narrows the list (ERPlora/kitchen#110).

The contract half is `search_box_says_what_it_searches.contract.test.py`: the box promises only
what `kitchen.orders.list` searches. This is the behaviour underneath, on a real Postgres with this
module's migrations and SQL: «mesa 4» finds the round sent to «Mesa 4» (case- and accent-folded like
every search box of the hub), a piece of the number still finds its order, a hidden value (the
customer UUID) no longer matches, and nothing crosses to another hub.

WHAT IS REPRODUCED of the list engine (`hub/crates/runtime/src/queries.rs`, `contains_ci`), and only
that: the base SELECT wrapped as a derived table and the OR-ed
`translate(lower(CAST(sub.<col> AS TEXT)), …) LIKE '%' || translate(lower(:search), …) || '%'`,
composed FROM THE MANIFEST — a wrong `search` block must fail here, not be papered over.

Usage: tests/orders_search.pg.test.py   (exit 0 = green)
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

QUERY = "kitchen.orders.list"
HUB = "hub-under-test"
OTHER_HUB = "hub-next-door"
NOW = "2026-09-27T10:00:00Z"
CUSTOMER = "c0ffee00-0000-4000-8000-000000000042"

#: Same fold as the runtime (`FOLD_FROM` / `FOLD_TO`).
FOLD_FROM = "áàâäãåéèêëíìîïóòôöõúùûüñçÁÀÂÄÃÅÉÈÊËÍÌÎÏÓÒÔÖÕÚÙÛÜÑÇ"
FOLD_TO = "aaaaaaeeeeiiiiooooouuuuncaaaaaaeeeeiiiiooooouuuunc"
IDENT = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*$")

failures: list[str] = []


def literal(value) -> str:
    if value is None:
        return "NULL"
    if isinstance(value, int):
        return str(value)
    return "'" + str(value).replace("'", "''") + "'"


def container_available() -> bool:
    try:
        subprocess.run(
            ["docker", "inspect", CONTAINER], capture_output=True, check=True
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


def fold(expr: str) -> str:
    return f"translate(lower({expr}), '{FOLD_FROM}', '{FOLD_TO}')"


def search_ids(db: ScratchDb, term: str | None) -> list[str]:
    spec = MANIFEST["queries"][QUERY]
    base = (
        (MODULE_DIR / spec["sql"])
        .read_text()
        .rstrip()
        .rstrip(";")
        .replace(":hub_id", literal(HUB))
    )
    columns = [
        c for c in (spec.get("list") or {}).get("search") or [] if IDENT.match(c)
    ]
    where = ""
    if columns and term is not None:
        likes = [
            f"{fold(f'CAST(sub.{c} AS TEXT)')} LIKE '%' || {fold(f'CAST({literal(term)} AS TEXT)')} || '%'"
            for c in columns
        ]
        where = " WHERE (" + " OR ".join(likes) + ")"
    return sorted(
        str(r["id"]) for r in db.rows(f"SELECT sub.* FROM ({base}) AS sub{where}")
    )


def seed(db: ScratchDb) -> None:
    orders = [
        # id,        hub,       number,           status,      label,          customer, round
        ("k-mesa4", HUB, "20260927-0001", "pending", "Mesa 4", None, 1),
        ("k-barra", HUB, "20260927-0002", "preparing", "Barra", CUSTOMER, 2),
        ("k-ana", HUB, "20260927-0003", "ready", "Recogida Ána", None, 1),
        ("k-mesa4-x", OTHER_HUB, "20260927-0009", "pending", "Mesa 4", None, 1),
    ]
    values = ",".join(
        "("
        + ",".join(
            [
                literal(i),
                literal(hub),
                literal(num),
                literal(st),
                "'dine_in'",
                "'normal'",
                literal(lab),
                literal(cust),
                "''",
                "0",
                "0",
                "0",
                "0",
                str(rnd),
                "0",
                "'u1'",
                "'u1'",
                literal(NOW),
                literal(NOW),
            ]
        )
        + ")"
        for i, hub, num, st, lab, cust, rnd in orders
    )
    db.psql(
        [],
        db=db.name,
        stdin=(
            "INSERT INTO kitchen_order (id, hub_id, order_number, status, order_type, priority, label,"
            " customer_id, notes, subtotal, tax, discount, total, round_number, is_deleted, created_by,"
            " updated_by, created_at, updated_at) VALUES " + values + ";"
        ),
    )


def check(db: ScratchDb) -> None:
    if search_ids(db, None) != ["k-ana", "k-barra", "k-mesa4"]:
        failures.append(
            f"unfiltered list = {search_ids(db, None)}, expected this hub's 3 — fixture wrong"
        )
        return
    for why, term, expected in (
        ("the DESTINATION, typed in lower case", "mesa 4", ["k-mesa4"]),
        ("the DESTINATION, typed without its accent", "ana", ["k-ana"]),
        ("a piece of the ORDER NUMBER", "0002", ["k-barra"]),
        # A hidden value is not a reason to match: the customer UUID is nowhere on the row.
        ("the CUSTOMER UUID the table never shows", CUSTOMER[:8], []),
        ("a term that matches nothing", "zzz-no-such-order", []),
    ):
        got = search_ids(db, term)
        if got != expected:
            failures.append(
                f"searching {why} («{term}») returned {got}, expected {expected} (kitchen#110)"
            )
    if "k-mesa4-x" in search_ids(db, "mesa"):
        failures.append("the search returned another hub's order — scoping lost")


def main() -> int:
    if not container_available():
        print(f"SKIPPED: no Postgres in container {CONTAINER} (nothing was verified)")
        return 0
    db = ScratchDb("kitchen_orders_search")
    db.create()
    try:
        seed(db)
        check(db)
    finally:
        db.drop()
    if failures:
        print(f"FAIL ({len(failures)}):")
        for f in failures:
            print(f"  - {f}")
        return 1
    print(
        f"OK: the Comandas search narrows by {MANIFEST['queries'][QUERY]['list']['search']} inside the hub"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
