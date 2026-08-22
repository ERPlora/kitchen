#!/usr/bin/env python3
"""A delivered `kitchen.order.received` writes its audit row (kitchen#43).

The Historial's «Recibida» filter always returned zero because the value only existed inside the
payload of `kitchen.order.created` — an event nobody routes to `kitchen.logs.create` (its payload
carries `total`/`items_count`/… that the log's `additionalProperties: false` schema refuses, so
routing it would end in the dead-letter, kitchen#29). The fix emits a narrow twin,
`kitchen.order.received`, whose payload is EXACTLY `schemas/log_create.json`.

The emitting half (the three creation paths really emit the twin, with exactly the schema's keys)
is pinned in Rust (`handler/src/lib.rs`). What THIS one adds is the landing half, against a real
Postgres built from this module's own migrations: run the module's REAL `commands/log_create.sql`
with the payload the handler emits — verbatim, as the relay binds it — and the `received` row is
there, attached to this hub's ticket.

  Uses the `erplora-test-pg-5433` container (override: KITCHEN_TEST_PG_CONTAINER).
"""

import json
import os
import pathlib
import subprocess
import sys
import uuid

MODULE_DIR = pathlib.Path(__file__).resolve().parent.parent
MANIFEST = json.loads((MODULE_DIR / "module.json").read_text(encoding="utf-8"))
COMMAND_SQL = (MODULE_DIR / MANIFEST["commands"]["kitchen.logs.create"]["sql"][0]).read_text(
    encoding="utf-8"
)
MIGRATIONS = MANIFEST["migrations"]["postgres"]
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
        for rel in MIGRATIONS:
            self.psql([], db=self.name, stdin=(MODULE_DIR / rel).read_text(encoding="utf-8"))

    def drop(self) -> None:
        try:
            self.psql(["-c", f'DROP DATABASE IF EXISTS "{self.name}" WITH (FORCE)'])
        except RuntimeError as exc:
            print(f"  ! could not drop {self.name}: {exc}")

    def rows(self, sql: str) -> list[dict]:
        out = self.psql(["-tAc", f"SELECT COALESCE(json_agg(t), '[]'::json) FROM ({sql}) t"], db=self.name)
        return json.loads(out.strip() or "[]")


def deliver(db: ScratchDb, payload: dict) -> None:
    """Run the module's REAL log SQL with this payload, as the runtime would bind it."""
    sql = COMMAND_SQL
    for key, value in payload.items():
        sql = sql.replace(f":{key}", literal(value))
    for key, value in {"new_id": str(uuid.uuid4()), "hub_id": HUB, "current_user_id": USER, "now": NOW}.items():
        sql = sql.replace(f":{key}", literal(value))
    db.psql([], db=db.name, stdin=sql)


def seed_ticket(db: ScratchDb, hub: str, ticket_id: str) -> None:
    """A kitchen_order row the way `_insert_order` leaves it (the columns the log joins on)."""
    db.psql([], db=db.name, stdin=f"""
INSERT INTO kitchen_order (id, hub_id, order_number, status, order_type, priority, label, notes,
                           subtotal, tax, discount, total, round_number,
                           is_deleted, created_by, updated_by, created_at, updated_at)
VALUES ('{ticket_id}', '{hub}', '20260822-0001', 'pending', 'dine_in', 'normal', 'Mesa 4', '',
        0, 0, 0, 0, 1, 0, '{USER}', '{USER}', '{NOW}', '{NOW}');
""")


def report() -> int:
    if failures:
        for msg in failures:
            print(f"✗ {msg}")
        print(f"\nFAILED ({len(failures)}).")
        return 1
    print("✓ a delivered kitchen.order.received lands as an audit row of its ticket (and only its own hub's)")
    return 0


def main() -> int:
    if not container_available():
        print(f"⚠ container `{CONTAINER}` not running — skipping (start the test Postgres to run it)")
        return 0

    db = ScratchDb("kitchen_received_log")
    try:
        db.create()
        seed_ticket(db, HUB, "k-own")
        seed_ticket(db, OTHER_HUB, "k-foreign")

        # The payload the handler emits for `kitchen.order.received` — verbatim (pinned in Rust:
        # every key is a property of schemas/log_create.json, nothing more).
        deliver(db, {
            "order_id": "k-own",
            "order_item_id": None,
            "station_id": None,
            "action": "received",
            "performed_by_id": USER,
            "notes": "",
        })

        rows = db.rows("SELECT action, order_id, performed_by_id, notes FROM kitchen_order_log")
        if len(rows) != 1:
            fail(f"the delivery wrote {len(rows)} rows, expected exactly 1")
        else:
            row = rows[0]
            if row.get("action") != "received":
                fail(f"the row came back with action {row.get('action')!r}, not 'received'")
            if row.get("order_id") != "k-own":
                fail(f"the row points at {row.get('order_id')!r}, not the ticket that was created")

        # pm#146 again, on the new event: a payload pointing at ANOTHER hub's ticket must write
        # nothing (the SQL resolves the order against the injected :hub_id).
        deliver(db, {
            "order_id": "k-foreign",
            "order_item_id": None,
            "station_id": None,
            "action": "received",
            "performed_by_id": None,
            "notes": "",
        })
        rows = db.rows("SELECT order_id FROM kitchen_order_log")
        if len(rows) != 1 or rows[0].get("order_id") != "k-own":
            fail("a delivery pointing at another hub's ticket wrote (or moved) a row — the log is corrupted")
    finally:
        db.drop()

    return report()


if __name__ == "__main__":
    sys.exit(main())
