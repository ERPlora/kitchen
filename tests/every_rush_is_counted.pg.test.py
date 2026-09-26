#!/usr/bin/env python3
"""Every time a round TURNS rush it is counted, so each rush gets its own sheet (kitchen#99).

The rush notice on paper (kitchen#93) is queued with a job id per (order, role), and the hub's
print queue drops a repeated job id as `Duplicate` — which the shell reports as success. So a round
marked rush, cleared, and marked rush AGAIN never printed its second notice: same id, silently
swallowed. The id has to move with every transition to rush, and it has to be the SAME for every
screen that asks for that transition (KDS and TPV both print it; kitchen#98/#102 rely on the queue
to turn those into ONE sheet per station).

The only value every screen reads identically is a column of the round, so `kitchen.orders.update`
bumps `rush_count` when (and only when) the priority goes from not-rush to rush, and
`kitchen.orders.get` returns it. This battery pins, on a real Postgres built from the module's own
migrations and with the command's SQL verbatim:

  * normal → rush counts 1; rush → normal leaves it; normal → rush again counts 2;
  * saving rush on a round that already is rush does NOT count (a second screen repeating the
    gesture, or an edit of the notes that re-sends the priority, is not a new rush);
  * an update that does not send a priority (NULL) does not count;
  * vip → rush counts (it is a transition to rush);
  * another hub aiming at our round id never moves it (tenancy: the WHERE hub_id of the command);
  * `kitchen.orders.get` returns the counter the notice builds its job id from.

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

UPDATE_SQL = (
    MODULE_DIR / MANIFEST["commands"]["kitchen.orders.update"]["sql"][0]
).read_text(encoding="utf-8")
GET_SQL = (MODULE_DIR / MANIFEST["queries"]["kitchen.orders.get"]["sql"]).read_text(
    encoding="utf-8"
)

HUB = "hub-under-test"
OTHER_HUB = "hub-next-door"
USER = "user-1"
NOW = "2026-09-26T10:00:00Z"
ROUND = "round-1"
NEIGHBOUR_ROUND = "round-next-door"

failures: list[str] = []


def check(label: str, expected, actual) -> None:
    if expected == actual:
        print(f"  ✓ {label}")
    else:
        print(f"  ✗ {label}: expected {expected!r}, got {actual!r}")
        failures.append(label)


def literal(value) -> str:
    if value is None:
        return "NULL"
    if isinstance(value, int):
        return str(value)
    return "'" + str(value).replace("'", "''") + "'"


def bind(sql: str, params: dict) -> str:
    """Longest name first, like the other batteries: a short name can be the prefix of a long one."""
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


def seed_round(db: ScratchDb, hub: str, round_id: str = ROUND, priority: str = "normal") -> None:
    db.psql(
        [],
        db=db.name,
        stdin=f"""
INSERT INTO kitchen_order (id, hub_id, order_number, source_order_id, label, status, order_type,
                           priority, round_number, notes, subtotal, tax, discount, total,
                           fired_at, is_deleted, created_by, updated_by, created_at, updated_at)
VALUES ({literal(round_id)}, {literal(hub)}, '20260926-0001', 'sale-1', 'Mesa 4', 'preparing', 'dine_in',
        {literal(priority)}, 1, '', 0, 0, 0, 0, {literal(NOW)}, 0,
        {literal(USER)}, {literal(USER)}, {literal(NOW)}, {literal(NOW)});
""",
    )


def update(db: ScratchDb, priority, hub: str = HUB, notes=None, round_id: str = ROUND) -> None:
    """`kitchen.orders.update` as the runtime runs it: every field of the schema bound, NULL = keep."""
    params = {
        "order_id": round_id,
        "notes": notes,
        "priority": priority,
        "order_type": None,
        "table_id": None,
        "waiter_id": None,
        "customer_id": None,
        "hub_id": hub,
        "current_user_id": USER,
        "now": NOW,
    }
    db.psql([], db=db.name, stdin=bind(UPDATE_SQL, params))


def got(db: ScratchDb, hub: str = HUB, round_id: str = ROUND) -> dict:
    rows = db.rows(bind(GET_SQL, {"order_id": round_id, "hub_id": hub}))
    return rows[0] if rows else {}


def main() -> int:
    if not container_available():
        print(f"SKIPPED: container {CONTAINER} not available")
        return 0

    db = ScratchDb("kitchen_rush_count")
    try:
        db.create()
        seed_round(db, HUB)
        seed_round(db, OTHER_HUB, NEIGHBOUR_ROUND)

        print("kitchen.orders.get returns the counter")
        check("a round that was never rushed reads 0", 0, got(db).get("rush_count"))

        print("each transition to rush counts once")
        update(db, "rush")
        check("normal → rush counts 1", 1, got(db).get("rush_count"))
        # Positive control of the effect, not only the counter: the priority did move.
        check("…and the round is rush", "rush", got(db).get("priority"))
        update(db, "rush")
        check(
            "rush → rush (a second screen repeating the gesture) does not count",
            1,
            got(db).get("rush_count"),
        )
        update(db, None, notes="sin cebolla")
        check(
            "an edit that sends no priority does not count",
            1,
            got(db).get("rush_count"),
        )
        update(db, "normal")
        check("rush → normal keeps the counter", 1, got(db).get("rush_count"))
        update(db, "rush")
        check("normal → rush AGAIN counts 2 (kitchen#99)", 2, got(db).get("rush_count"))
        update(db, "vip")
        update(db, "rush")
        check("vip → rush is a transition to rush too", 3, got(db).get("rush_count"))

        print("tenancy")
        check("the neighbour hub's round never moved", 0, got(db, OTHER_HUB, NEIGHBOUR_ROUND).get("rush_count"))
        # The neighbour aims at OUR round id: the command's WHERE hub_id must leave it alone.
        update(db, "normal", hub=OTHER_HUB)
        update(db, "rush", hub=OTHER_HUB)
        check("a rush sent by another hub at our round id does not count on our row", 3, got(db).get("rush_count"))
        check("…nor move our priority", "rush", got(db).get("priority"))
        update(db, "rush", hub=OTHER_HUB, round_id=NEIGHBOUR_ROUND)
        check("the neighbour's own rush counts on its row", 1, got(db, OTHER_HUB, NEIGHBOUR_ROUND).get("rush_count"))
        check("…and not on ours", 3, got(db).get("rush_count"))
    finally:
        db.drop()

    if failures:
        print(f"\n{len(failures)} failure(s)")
        return 1
    print("\nall green")
    return 0


if __name__ == "__main__":
    sys.exit(main())
