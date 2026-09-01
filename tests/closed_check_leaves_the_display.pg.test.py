#!/usr/bin/env python3
"""A closed check disappears from the KDS — the EFFECT half (kitchen#61).

The symptom the issue reports is not «a column is null»: it is that `/m/kitchen/display` keeps
painting «Mesa S1» with the clock running minutes after that table paid and was released. The feed
of that screen is `queries/orders_display.sql`, so this battery asserts against THAT query, on a
real Postgres built from this module's own migrations, before and after applying what the handler
emits for `order.completed` — its operations, verbatim, with the parameters it binds.

  * BEFORE: the two rounds of the paid order are on the feed (the zombies). This is the positive
    control: without it a green run would prove nothing but that the query returns little.
  * AFTER:  they are gone, the round of the table STILL EATING is untouched, and the round of
    another hub with the same `source_order_id` never moved (pm#146 — a hub cannot clear its
    neighbour's line).
  * The lines of a cancelled round stop cooking too, or the station grid and All-Day keep counting
    food nobody is going to make.
  * A REDELIVERY (the outbox retries) matches zero rows instead of dragging an already-served round
    somewhere else: `_set_order_status` is pinned to `require_status`, the state the handler
    decided against (kitchen#11).

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
MIGRATIONS = migration_entries()
CONTAINER = os.environ.get("KITCHEN_TEST_PG_CONTAINER", "erplora-test-pg-5433")

SET_STATUS_SQL = (
    MODULE_DIR / MANIFEST["commands"]["kitchen._set_order_status"]["sql"][0]
).read_text(encoding="utf-8")
CASCADE_SQL = (
    MODULE_DIR / MANIFEST["commands"]["kitchen._cascade_item_status"]["sql"][0]
).read_text(encoding="utf-8")
DISPLAY_SQL = (
    MODULE_DIR / MANIFEST["queries"]["kitchen.orders.display"]["sql"]
).read_text(encoding="utf-8")

HUB = "hub-under-test"
OTHER_HUB = "hub-next-door"
USER = "user-1"
FIRED = "2026-08-25T11:40:00Z"
NOW = "2026-08-25T11:56:39Z"

PAID_ORDER = "sales-order-paid"
LIVE_ORDER = "sales-order-still-eating"

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
    text = str(value).replace("'", "''")
    if "\n" in text or "\\" in text:
        # `:nl` is bound with a real newline, and one of the placeholders lives inside a `--`
        # comment of the module's own SQL: a literal line break there ends the comment and turns
        # the rest of the statement into garbage. The runtime binds values out of band and never
        # has this problem; this emulation says the same thing with an escape string instead.
        return "E'" + text.replace("\\", "\\\\").replace("\n", "\\n") + "'"
    return "'" + text + "'"


def bind(sql: str, params: dict) -> str:
    """Binds `:name` placeholders the way the runtime does.

    LONGEST NAME FIRST, and that is not a detail: `:status` is a prefix of `:require_status`,
    `:from_status` and `:to_status`, so binding in dictionary order rewrites the middle of another
    placeholder and the statement stops being the module's SQL."""
    for key in sorted(params, key=len, reverse=True):
        sql = sql.replace(f":{key}", literal(params[key]))
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
        for rel, kind in MIGRATIONS:
            self.psql([], db=self.name, stdin=migration_sql(rel, kind))

    def drop(self) -> None:
        try:
            self.psql(["-c", f'DROP DATABASE IF EXISTS "{self.name}" WITH (FORCE)'])
        except RuntimeError as exc:
            print(f"  ! could not drop {self.name}: {exc}")

    def rows(self, sql: str) -> list[dict]:
        out = self.psql(
            [
                "-tAc",
                f"SELECT COALESCE(json_agg(t), '[]'::json) FROM ({sql.rstrip().rstrip(';')}) t",
            ],
            db=self.name,
        )
        return json.loads(out.strip() or "[]")

    def run(self, sql: str) -> int:
        """Runs a statement and answers how many rows it touched (`UPDATE n`)."""
        out = self.psql([], db=self.name, stdin=sql)
        for line in reversed(out.strip().splitlines()):
            if line.startswith("UPDATE "):
                return int(line.split()[1])
        return 0


def seed_round(
    db: ScratchDb,
    hub: str,
    ticket_id: str,
    source_order_id: str,
    status: str,
    round_number: int = 1,
) -> None:
    """A round the way `_insert_order` + `_insert_item` leave it, with one line in the same state.

    `round_number` is not decoration: `uq_kitchen_order_source_round` is `(hub, source_order_id,
    round_number)`, which is exactly the shape of the bug — one order fires SEVERAL rounds, and
    every one of them has to come off the line."""
    ready_at = literal(NOW) if status == "ready" else "NULL"
    db.psql(
        [],
        db=db.name,
        stdin=f"""
INSERT INTO kitchen_order (id, hub_id, order_number, source_order_id, label, status, order_type,
                           priority, round_number, notes, subtotal, tax, discount, total,
                           fired_at, ready_at, is_deleted, created_by, updated_by, created_at, updated_at)
VALUES ({literal(ticket_id)}, {literal(hub)}, '20260825-000{round_number}', {literal(source_order_id)}, 'Mesa S1',
        {literal(status)}, 'dine_in', 'normal', {round_number}, '', 0, 0, 0, 0,
        {literal(FIRED)}, {ready_at}, 0, {literal(USER)}, {literal(USER)}, {literal(FIRED)}, {literal(FIRED)});
INSERT INTO kitchen_order_item (id, hub_id, order_id, station_id, product_id, product_name,
                                unit_price, quantity, total, modifiers, notes, status,
                                is_deleted, created_by, updated_by, created_at, updated_at)
VALUES ({literal(ticket_id + "-line")}, {literal(hub)}, {literal(ticket_id)}, NULL, NULL, 'Aros de cebolla',
        450, 1, 450, '', '', {literal(status)}, 0, {literal(USER)}, {literal(USER)}, {literal(FIRED)}, {literal(FIRED)});
""",
    )


def set_status(
    db: ScratchDb, ticket_id: str, status: str, require: str, served_mode: str
) -> int:
    """`kitchen._set_order_status` with exactly the parameters the handler binds for this ticket."""
    return db.run(
        bind(
            SET_STATUS_SQL,
            {
                "order_id": ticket_id,
                "status": status,
                "require_status": require,
                "set_fired": 0,
                "ready_mode": "keep",
                "served_mode": served_mode,
                "append_note": "",
                "nl": "\n",
                "hub_id": HUB,
                "current_user_id": USER,
                "now": NOW,
            },
        )
    )


def cascade(db: ScratchDb, ticket_id: str) -> int:
    return db.run(
        bind(
            CASCADE_SQL,
            {
                "order_id": ticket_id,
                "from_status": "",
                "to_status": "cancelled",
                "set_fired": 0,
                "completed_mode": "keep",
                "hub_id": HUB,
                "current_user_id": USER,
                "now": NOW,
            },
        )
    )


def on_the_line(db: ScratchDb, hub: str) -> set:
    """The tickets `queries/orders_display.sql` paints for this hub — the KDS feed itself."""
    return {r["order_id"] for r in db.rows(bind(DISPLAY_SQL, {"hub_id": hub}))}


def main() -> int:
    if not container_available():
        print(
            f"⚠ container `{CONTAINER}` not running — skipping (start the test Postgres to run it)"
        )
        return 0

    db = ScratchDb("kitchen_closed_check")
    try:
        db.create()
        # The paid check: round 1 bumped and waiting to be handed over, round 2 never finished.
        seed_round(db, HUB, "k-ready", PAID_ORDER, "ready", round_number=1)
        seed_round(db, HUB, "k-pending", PAID_ORDER, "pending", round_number=2)
        # The table next to it, still eating.
        seed_round(db, HUB, "k-other-order", LIVE_ORDER, "pending")
        # Another business whose order happens to carry the same id.
        seed_round(db, OTHER_HUB, "k-other-hub", PAID_ORDER, "pending")

        # Positive control: the zombies ARE on the screen before the fix runs.
        before = on_the_line(db, HUB)
        if not {"k-ready", "k-pending"} <= before:
            fail(
                f"the rounds of the paid check were not on the KDS to begin with: {before}"
            )

        # What the handler emits for `order.completed`, verbatim.
        if set_status(db, "k-ready", "served", "ready", "set") != 1:
            fail("the bumped round was not marked served")
        if set_status(db, "k-pending", "cancelled", "pending", "keep") != 1:
            fail("the round still cooking was not cancelled")
        if cascade(db, "k-pending") != 1:
            fail("the lines of the cancelled round kept cooking")

        after = on_the_line(db, HUB)
        if after != {"k-other-order"}:
            fail(
                f"the KDS still paints {sorted(after - {'k-other-order'})} after the check closed "
                f"(and it must still paint the table that is still eating): {sorted(after)}"
            )

        rows = {
            r["id"]: r
            for r in db.rows("SELECT id, hub_id, status, served_at FROM kitchen_order")
        }
        if rows["k-ready"]["status"] != "served" or not rows["k-ready"]["served_at"]:
            fail(
                f"the bumped round did not land as served with its timestamp: {rows['k-ready']}"
            )
        if rows["k-pending"]["status"] != "cancelled":
            fail(f"the unfinished round did not land as cancelled: {rows['k-pending']}")
        if rows["k-other-hub"]["status"] != "pending":
            fail(
                "a check closing in one business moved another business' round — "
                f"{rows['k-other-hub']}"
            )
        if rows["k-other-order"]["status"] != "pending":
            fail(f"the table still eating lost its round: {rows['k-other-order']}")

        lines = {
            r["order_id"]: r["status"]
            for r in db.rows(
                f"SELECT order_id, status FROM kitchen_order_item WHERE hub_id = {literal(HUB)}"
            )
        }
        if lines.get("k-pending") != "cancelled":
            fail(f"the line of the cancelled round is still {lines.get('k-pending')!r}")
        if lines.get("k-other-order") != "pending":
            fail("the cascade reached the lines of a ticket that was not closing")

        # The outbox retries: the same delivery must match nothing the second time.
        if set_status(db, "k-ready", "served", "ready", "set") != 0:
            fail(
                "a redelivered close moved an already-served round: the guard is not pinned"
            )
    finally:
        db.drop()

    if failures:
        for msg in failures:
            print(f"✗ {msg}")
        print(f"\nFAILED ({len(failures)}).")
        return 1
    print("✓ a closed check takes its rounds off the KDS, and only its own")
    return 0


if __name__ == "__main__":
    sys.exit(main())
