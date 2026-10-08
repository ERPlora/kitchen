#!/usr/bin/env python3
"""kitchen#161 — the SQL half of a dish the till voids: it is struck on the line, it never comes back.

The till voids a line already sent (SALES-F20, `sales.order.void_line`) and announces
`sales.order.line_voided` with the check, the line and the reason. The WASM handler
(`void_lines_from_sales_line`) decides; this battery pins what its intentions do in a REAL Postgres:

  1. The manifest listens to `sales.order.line_voided` with an internal command that reads
     `kitchen.items.by_sales_line`, and routes `kitchen.item.voided` to the kitchen log.
  2. `kitchen.items.by_sales_line` returns EVERY line of the rounds that carry that sales line
     (the handler needs the siblings to decide whether the round follows), with the round's status
     and its check — and nothing of another round, another hub or a deleted line.
  3. `kitchen._void_item` strikes ONE line: `voided` with its reason and who did it. Pinned to the
     state the handler read (a dish bumped in between matches zero rows → `expect_rows` refuses
     and the delivery retries); never a line of another ticket or another hub.
  4. A later cancel of the round (`_cascade_item_status` with every line, KITCHEN-F22/F28) leaves
     the voided line saying «voided»: the till took it back, the kitchen did not throw it away.
  5. The KDS feed and the ticket's lines carry the status and the reason; the «Resumen» and the
     station's «in progress» count leave the voided dish out.
  6. Migration 014 is additive and reversible.

Runs the SQL the way the runtime does (`:name` bound). Uses `erplora-test-pg-5433` (override:
ERPLORA_TEST_PG_CONTAINER); scratch DB dropped at the end. Missing Docker = SKIPPED, never PASS.
"""

import json
import os
import pathlib
import re
import subprocess
import sys
import uuid

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from module_migrations import migration_entries, migration_sql  # noqa: E402

MODULE_DIR = pathlib.Path(__file__).resolve().parent.parent
MANIFEST = json.loads((MODULE_DIR / "module.json").read_text())
CONTAINER = os.environ.get("ERPLORA_TEST_PG_CONTAINER", "erplora-test-pg-5433")
EVENT = "sales.order.line_voided"
LISTENER = "kitchen._on_sales_order_line_voided"
READ = "kitchen.items.by_sales_line"
VOID = "kitchen._void_item"
HUB = "hub-test"
OTHER_HUB = "hub-other"
CREATED = "2026-10-08T09:00:00+00:00"
NOW = "2026-10-08T12:00:00+00:00"

failures: list[str] = []


def check(label, expected, actual):
    if expected != actual:
        failures.append(f"{label} — expected [{expected}], got [{actual}]")
        print(f"  FAIL: {label} — expected [{expected}], got [{actual}]")
    else:
        print(f"  ok: {label} = {expected}")


def psql(db, sql):
    r = subprocess.run(
        ["docker", "exec", "-i", CONTAINER, "psql", "-U", "postgres", "-d", db]
        + ["-v", "ON_ERROR_STOP=1", "-q", "-X", "-tA"],
        input=sql,
        capture_output=True,
        text=True,
    )
    if r.returncode != 0:
        raise RuntimeError(r.stderr.strip())
    return r.stdout


def literal(v):
    if v is None:
        return "NULL"
    if isinstance(v, bool):
        return "1" if v else "0"
    if isinstance(v, (int, float)):
        return str(v)
    return "'" + str(v).replace("'", "''") + "'"


PARAM = re.compile(r"(?<!:):([a-z_][a-z0-9_]*)")  # `::` is a cast, never a bind


def bind(rel: str, params: dict) -> str:
    sql = (MODULE_DIR / rel).read_text()
    return PARAM.sub(lambda m: literal(params.get(m.group(1))), sql)


def rows_of(db, rel: str, params: dict) -> list:
    """Runs a query file and returns its rows as dicts, in the query's own order."""
    body = bind(rel, params).strip().rstrip(";")
    out = psql(
        db,
        f"SELECT COALESCE(json_agg(q), '[]') FROM ({body}) q;",
    )
    return json.loads(out.strip())


def affected(db, rel: str, params: dict) -> int:
    """Runs a one-statement command file and answers how many rows it wrote — what `expect_rows`
    reads (hub#1025)."""
    body = bind(rel, params).strip().rstrip(";")
    out = psql(db, f"WITH w AS ({body} RETURNING 1) SELECT count(*) FROM w;")
    return int(out.strip())


def void_item(db, item_id, order_id, require_status, hub=HUB, reason="Wrong table"):
    (rel,) = MANIFEST["commands"][VOID]["sql"]
    return affected(
        db,
        rel,
        {
            "item_id": item_id,
            "order_id": order_id,
            "require_status": require_status,
            "reason": reason,
            "hub_id": hub,
            "current_user_id": "user-manager",
            "now": NOW,
        },
    )


def order(db, oid, hub, check_id, status="pending", round_number=1):
    psql(
        db,
        "INSERT INTO kitchen_order (id, hub_id, order_number, status, source_order_id, round_number, "
        f"is_deleted, created_at) VALUES ({literal(oid)}, {literal(hub)}, {literal('K-' + oid)}, "
        f"{literal(status)}, {literal(check_id)}, {round_number}, 0, '{CREATED}')",
    )


def item(
    db, iid, oid, hub, sales_line, status="pending", seq=0, deleted=0, name="Croquetas"
):
    psql(
        db,
        "INSERT INTO kitchen_order_item (id, hub_id, order_id, product_name, quantity, status, "
        "sales_order_item_id, station_id, station_name, line_seq, is_deleted, created_at) VALUES "
        f"({literal(iid)}, {literal(hub)}, {literal(oid)}, {literal(name)}, 1, {literal(status)}, "
        f"{literal(sales_line)}, {literal('st-' + hub)}, 'Plancha', {seq}, {deleted}, '{CREATED}')",
    )


def line(db, iid) -> dict:
    out = psql(
        db,
        "SELECT row_to_json(r) FROM (SELECT status, void_reason, updated_by, updated_at "
        f"FROM kitchen_order_item WHERE id = '{iid}') r;",
    )
    return json.loads(out.strip()) if out.strip() else {}


def manifest_half() -> bool:
    print("== the manifest declares the ear ==")
    listen = MANIFEST["events"].get("listen", {})
    check(
        f"`{EVENT}` is listened to", LISTENER, (listen.get(EVENT) or {}).get("command")
    )
    check(
        "`kitchen.item.voided` is written to the kitchen log",
        "kitchen.logs.create",
        (listen.get("kitchen.item.voided") or {}).get("command"),
    )
    check(
        "`kitchen.item.voided` is declared as emitted",
        True,
        "kitchen.item.voided" in MANIFEST["events"].get("emits", []),
    )
    cmd = MANIFEST["commands"].get(LISTENER)
    void = MANIFEST["commands"].get(VOID)
    query = MANIFEST["queries"].get(READ)
    check(f"`{LISTENER}` exists", True, cmd is not None)
    check(f"`{VOID}` exists", True, void is not None)
    check(f"`{READ}` exists", True, query is not None)
    if cmd is None or void is None or query is None:
        return False
    check(
        "the listener runs the WASM decision",
        "void_lines_from_sales_line",
        (cmd.get("handler") or {}).get("function"),
    )
    reads = {r.get("query"): r for r in cmd.get("reads", [])}
    check(
        "it reads the rounds of the voided line by the line id",
        {"sales_order_item_id": "payload.line_id"},
        (reads.get(READ) or {}).get("params"),
    )
    check("the read is required", True, (reads.get(READ) or {}).get("required"))
    check(
        "a line that moved in between is REFUSED (the delivery retries)",
        ("min", 1, "kitchen.invalid_transition"),
        tuple((void.get("expect_rows") or {}).get(k) for k in ("op", "n", "error")),
    )
    declared = {
        p if isinstance(p, str) else p.get("codename")
        for p in MANIFEST.get("permissions", [])
    }
    for name, c in ((LISTENER, cmd), (VOID, void), (READ, query)):
        check(
            f"{name}: its permission is declared", True, c.get("permission") in declared
        )
    return True


def main() -> int:
    wired = manifest_half()
    ready = subprocess.run(
        ["docker", "exec", CONTAINER, "pg_isready", "-U", "postgres"],
        capture_output=True,
        text=True,
    )
    if ready.returncode != 0:
        print(
            f"SKIPPED: no Postgres in container {CONTAINER} (the SQL half was not verified)"
        )
        return 1 if failures else 0
    if not wired:
        print(f"\nFAILED — {len(failures)} assertion(s)")
        return 1

    db = f"kitchen_void_{uuid.uuid4().hex[:8]}"
    subprocess.run(
        ["docker", "exec", CONTAINER, "createdb", "-U", "postgres", db], check=True
    )
    try:
        for rel, kind in migration_entries():
            psql(db, migration_sql(rel, kind))

        for hub in (HUB, OTHER_HUB):
            psql(
                db,
                "INSERT INTO kitchen_station (id, hub_id, name, created_at) VALUES "
                f"({literal('st-' + hub)}, {literal(hub)}, 'Plancha', '{CREATED}')",
            )
        # Check o1 fired two rounds; round 1 carries L1 (croquetas) and L2 (caña); round 2 only L3.
        order(db, "k1", HUB, "o1", status="preparing")
        item(db, "i1", "k1", HUB, "L1", status="preparing", seq=1)
        item(db, "i2", "k1", HUB, "L2", status="pending", seq=2, name="Caña")
        item(db, "i-gone", "k1", HUB, "L9", status="pending", seq=3, deleted=1)
        order(db, "k2", HUB, "o1", round_number=2)
        item(db, "i3", "k2", HUB, "L3", name="Bravas")
        # The hub next door: the SAME opaque ids name another dish there.
        order(db, "n1", OTHER_HUB, "o1")
        item(db, "n-i1", "n1", OTHER_HUB, "L1")

        print("\n== the read hands the handler the whole round of that line ==")
        (qrel,) = [MANIFEST["queries"][READ]["sql"]]
        got = rows_of(db, qrel, {"sales_order_item_id": "L1", "hub_id": HUB})
        check(
            "every live line of the round that carries L1, in the round's order",
            [("i1", "k1", "preparing", "L1"), ("i2", "k1", "pending", "L2")],
            [
                (r["id"], r["order_id"], r["status"], r["sales_order_item_id"])
                for r in got
            ],
        )
        check(
            "each row carries the round's status and its check",
            {("preparing", "o1")},
            {(r["order_status"], r["source_order_id"]) for r in got},
        )
        check(
            "the hub next door sees only its own round",
            ["n-i1"],
            [
                r["id"]
                for r in rows_of(
                    db, qrel, {"sales_order_item_id": "L1", "hub_id": OTHER_HUB}
                )
            ],
        )
        check(
            "a line that never reached the kitchen reads nothing",
            [],
            rows_of(db, qrel, {"sales_order_item_id": "L-none", "hub_id": HUB}),
        )

        print(
            "\n== `_void_item` strikes ONE line, pinned to the state the handler read =="
        )
        check(
            "a dish bumped in between matches nothing",
            0,
            void_item(db, "i1", "k1", "pending"),
        )
        check(
            "a line of another ticket matches nothing",
            0,
            void_item(db, "i1", "k2", "preparing"),
        )
        check(
            "the hub next door cannot strike this hub's dish",
            0,
            void_item(db, "i1", "k1", "preparing", hub=OTHER_HUB),
        )
        check("nothing moved", "preparing", line(db, "i1").get("status"))
        check(
            "the dish read as `preparing` is struck",
            1,
            void_item(db, "i1", "k1", "preparing"),
        )
        check(
            "voided, with its reason, who and when",
            {
                "status": "voided",
                "void_reason": "Wrong table",
                "updated_by": "user-manager",
                "updated_at": NOW,
            },
            line(db, "i1"),
        )
        check("its sibling keeps cooking", "pending", line(db, "i2").get("status"))
        check(
            "the dish of the next door hub is untouched",
            ("pending", ""),
            tuple(line(db, "n-i1").get(k) for k in ("status", "void_reason")),
        )
        check("a redelivery matches nothing", 0, void_item(db, "i1", "k1", "preparing"))

        print(
            "\n== the KDS feed and the ticket carry the strike; the counts leave it out =="
        )
        feed = {
            r["item_id"]: (r["item_status"], r.get("void_reason"))
            for r in rows_of(db, "queries/orders_display.sql", {"hub_id": HUB})
        }
        check(
            "the KDS paints the voided dish with its reason",
            ("voided", "Wrong table"),
            feed.get("i1"),
        )
        check("and its sibling as it was", ("pending", ""), feed.get("i2"))
        ticket = {
            r["id"]: (r["status"], r.get("void_reason"))
            for r in rows_of(
                db, "queries/order_items.sql", {"order_id": "k1", "hub_id": HUB}
            )
        }
        check(
            "the ticket's lines carry the reason",
            ("voided", "Wrong table"),
            ticket.get("i1"),
        )
        all_day = rows_of(db, "queries/orders_all_day.sql", {"hub_id": HUB})
        check(
            "the «Resumen» does not count the voided croquetas",
            0,
            sum(1 for r in all_day if r.get("product_name") == "Croquetas"),
        )
        pending = rows_of(db, "queries/items_pending_by_station.sql", {"hub_id": HUB})
        check(
            "nor does the station's «in progress» count (i2 and i3 are left)",
            [{"station_id": "st-" + HUB, "pending_count": 2}],
            pending,
        )

        print("\n== cancelling the round later keeps the void as a void ==")
        cascade = MANIFEST["commands"]["kitchen._cascade_item_status"]["sql"][0]
        affected(
            db,
            cascade,
            {
                "order_id": "k1",
                "from_status": "",
                "to_status": "cancelled",
                "set_fired": 0,
                "completed_mode": "keep",
                "hub_id": HUB,
                "current_user_id": "user-manager",
                "now": NOW,
            },
        )
        check(
            "the voided dish still says voided",
            ("voided", "Wrong table"),
            tuple(line(db, "i1").get(k) for k in ("status", "void_reason")),
        )
        check(
            "the rest of the round is cancelled",
            "cancelled",
            line(db, "i2").get("status"),
        )
        check(
            "the other round of the check is untouched",
            "pending",
            line(db, "i3").get("status"),
        )

        print("\n== migration 014 is reversible ==")
        psql(db, "ALTER TABLE kitchen_order_item DROP COLUMN void_reason;")
        check(
            "down: the column is gone",
            "",
            psql(
                db,
                "SELECT column_name FROM information_schema.columns WHERE table_name = "
                "'kitchen_order_item' AND column_name = 'void_reason';",
            ).strip(),
        )
        (rel014,) = [(r, k) for r, k in migration_entries() if "014_" in r]
        psql(db, migration_sql(*rel014))
        check(
            "up again: the voided row is back to the default reason",
            "",
            line(db, "i1").get("void_reason"),
        )
    finally:
        subprocess.run(
            ["docker", "exec", CONTAINER, "dropdb", "-U", "postgres", "--force", db]
        )

    print()
    if failures:
        print(f"FAILED — {len(failures)} assertion(s):")
        for f in failures:
            print(f"  - {f}")
        return 1
    print(
        "PASS — a dish the till voids is struck on the line and stays struck (kitchen#161)"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
