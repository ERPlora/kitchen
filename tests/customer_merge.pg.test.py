#!/usr/bin/env python3
"""customers#86 (kitchen layer) — when two customer sheets are merged, the kitchen orders follow the survivor.

`customers.merge` retires the absorbed sheet (soft delete) and publishes `customer.merged` with
`{surviving_id, absorbed_id, hub_id}` (customers#87). `kitchen` stores the customer as an OPAQUE id
in `kitchen_order` (it never depends on `customers`, ADR-0141), so unless this module re-points it,
the survivor's history misses every order taken under the duplicate sheet.

WHAT IS PROVEN HERE, against a REAL Postgres:

  1. The manifest listens to `customer.merged` with an internal, transactional command that emits
     nothing and has no `expect_rows` (merging a customer who never had a kitchen order is normal),
     and kitchen still does not DEPEND on `customers` (listening is not depending).
  2. Orders — live and soft-deleted, any status — move to the survivor; nothing else on the order
     (number, table, sale, status, notes) changes.
  3. It does not require the absorbed sheet to exist: no `customers` table in this database.
  4. Orders of other customers, and orders without a customer, are untouched.
  5. IDEMPOTENCE — the outbox is at-least-once; a redelivery changes nothing (not even updated_at).
  6. A degenerate event (`surviving_id = absorbed_id`) is a no-op.
  7. TENANCY — orders of the hub next door carrying the absorbed id (or the survivor's) are NOT
     re-pointed: an opaque id has no cross-module foreign key, the same string may name someone else.

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
EVENT = "customer.merged"
LISTENER = "kitchen._on_customer_merged"
HUB = "hub-test"
OTHER_HUB = "hub-other"
SURVIVOR = "cust-ana"
ABSORBED = "cust-ana-dup"
CREATED = "2026-08-01T00:00:00+00:00"
NOW = "2026-09-26T10:00:00+00:00"
LATER = "2026-09-26T11:00:00+00:00"

failures: list[str] = []


def check(label, expected, actual):
    if expected != actual:
        failures.append(f"{label} — expected [{expected}], got [{actual}]")
        print(f"  FAIL: {label} — expected [{expected}], got [{actual}]")
    else:
        print(f"  ok: {label} = {expected}")


def psql(db, sql):
    r = subprocess.run(
        [
            "docker",
            "exec",
            "-i",
            CONTAINER,
            "psql",
            "-U",
            "postgres",
            "-d",
            db,
            "-v",
            "ON_ERROR_STOP=1",
            "-q",
            "-X",
            "-tA",
        ],
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


def merge(db, hub=HUB, surviving=SURVIVOR, absorbed=ABSORBED, now=NOW):
    """Deliver `customer.merged` the way the outbox relay does: the payload IS the emitter's params."""
    cmd = MANIFEST["commands"][LISTENER]
    params = {
        "surviving_id": surviving,
        "absorbed_id": absorbed,
        "hub_id": hub,
        "current_user_id": "user-merger",
        "now": now,
    }
    script = ["BEGIN;"]
    for rel in cmd["sql"]:
        script.append(
            PARAM.sub(
                lambda m: literal(params.get(m.group(1))),
                (MODULE_DIR / rel).read_text(),
            )
        )
    script.append("COMMIT;")
    psql(db, "\n".join(script))


def order(db, oid, hub, customer, status="pending", deleted=0):
    psql(
        db,
        "INSERT INTO kitchen_order (id, hub_id, order_number, table_id, sale_id, customer_id, status, "
        f"notes, is_deleted, created_at) VALUES ({literal(oid)}, {literal(hub)}, {literal('K-' + oid)}, "
        f"'table-4', {literal('sale-' + oid)}, {literal(customer)}, {literal(status)}, 'no onion', "
        f"{deleted}, '{CREATED}')",
    )


def row(db, oid) -> dict:
    out = psql(
        db,
        "SELECT row_to_json(r) FROM (SELECT customer_id, order_number, table_id, sale_id, status, notes, "
        f"updated_by, updated_at FROM kitchen_order WHERE id = '{oid}') r;",
    )
    return json.loads(out.strip()) if out.strip() else {}


def fingerprint(db, hub) -> str:
    """Every order of one hub, in a byte-stable order (COLLATE "C", not the locale)."""
    return psql(
        db,
        "SELECT COALESCE(string_agg(x, '|' ORDER BY x COLLATE \"C\"), '') FROM ("
        " SELECT id || ':' || COALESCE(customer_id, '-') || ':' || COALESCE(updated_by, '-') || ':'"
        " || COALESCE(updated_at, '-') AS x"
        f"   FROM kitchen_order WHERE hub_id = '{hub}') t;",
    ).strip()


def manifest_half():
    print("== the manifest declares the ear ==")
    check(
        "kitchen still does not depend on customers (listening is not depending)",
        False,
        "customers" in (MANIFEST.get("depends_on") or []),
    )
    listen = MANIFEST["events"].get("listen", {})
    check(
        f"`{EVENT}` is listened to", LISTENER, (listen.get(EVENT) or {}).get("command")
    )
    cmd = MANIFEST["commands"].get(LISTENER)
    check(f"`{LISTENER}` exists", True, cmd is not None)
    if cmd is None:
        return False
    check(
        "it is internal (leading `_`)", True, LISTENER.rsplit(".", 1)[1].startswith("_")
    )
    check("it is transactional", True, cmd.get("transaction"))
    check("it carries SQL", True, bool(cmd.get("sql")))
    check("it emits nothing", None, cmd.get("emit"))
    check(
        "it has no expect_rows (a customer without kitchen orders is normal)",
        None,
        cmd.get("expect_rows"),
    )
    declared = {
        p if isinstance(p, str) else p.get("codename")
        for p in MANIFEST.get("permissions", [])
    }
    check(
        "its permission is declared by the module",
        True,
        cmd.get("permission") in declared,
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

    db = f"kitchen_merge_{uuid.uuid4().hex[:8]}"
    subprocess.run(
        ["docker", "exec", CONTAINER, "createdb", "-U", "postgres", db], check=True
    )
    try:
        for rel, kind in migration_entries():
            psql(db, migration_sql(rel, kind))

        # This hub: the survivor ordered once; the duplicate sheet ordered under the other spelling.
        order(db, "o-surv", HUB, SURVIVOR)
        order(db, "o-abs-live", HUB, ABSORBED, status="preparing")
        order(db, "o-abs-done", HUB, ABSORBED, status="served")
        order(db, "o-abs-deleted", HUB, ABSORBED, status="cancelled", deleted=1)
        order(db, "o-someone", HUB, "cust-luis")
        order(db, "o-walk-in", HUB, None)
        # The hub next door: the SAME opaque ids name other people there.
        order(db, "n-abs", OTHER_HUB, ABSORBED)
        order(db, "n-abs-deleted", OTHER_HUB, ABSORBED, deleted=1)
        order(db, "n-surv", OTHER_HUB, SURVIVOR)
        neighbour_before = fingerprint(db, OTHER_HUB)
        check(
            "no `customers` table here: the listener cannot depend on the absorbed sheet",
            "",
            psql(db, "SELECT to_regclass('customers_customer');").strip(),
        )

        print("\n== the kitchen orders follow the survivor ==")
        merge(db)
        for oid in ("o-abs-live", "o-abs-done", "o-abs-deleted"):
            r = row(db, oid)
            check(f"{oid} now belongs to the survivor", SURVIVOR, r.get("customer_id"))
            check(
                f"{oid} stamps updated_at with the server clock",
                NOW,
                r.get("updated_at"),
            )
            check(f"{oid} stamps who merged", "user-merger", r.get("updated_by"))
        live = row(db, "o-abs-live")
        check(
            "nothing else on the order changes",
            ("K-o-abs-live", "table-4", "sale-o-abs-live", "preparing", "no onion"),
            tuple(
                live.get(k)
                for k in ("order_number", "table_id", "sale_id", "status", "notes")
            ),
        )
        check(
            "the survivor's own order is untouched",
            None,
            row(db, "o-surv").get("updated_at"),
        )
        check(
            "another customer's order is untouched",
            ("cust-luis", None),
            tuple(row(db, "o-someone").get(k) for k in ("customer_id", "updated_at")),
        )
        check(
            "a walk-in order stays without customer",
            (None, None),
            tuple(row(db, "o-walk-in").get(k) for k in ("customer_id", "updated_at")),
        )
        check(
            "nothing is left on the absorbed id in this hub",
            "0",
            psql(
                db,
                f"SELECT count(*) FROM kitchen_order WHERE hub_id = '{HUB}' AND customer_id = '{ABSORBED}';",
            ).strip(),
        )

        print("\n== tenancy: the hub next door is not touched ==")
        check(
            "hub B rows pointing at the absorbed id are NOT re-pointed",
            neighbour_before,
            fingerprint(db, OTHER_HUB),
        )

        print("\n== idempotent: a redelivery changes nothing ==")
        after_first = fingerprint(db, HUB)
        merge(db, now=LATER)
        check(
            "a second delivery moves nothing and stamps nothing",
            after_first,
            fingerprint(db, HUB),
        )

        print("\n== a degenerate event (surviving = absorbed) is a no-op ==")
        merge(db, surviving=SURVIVOR, absorbed=SURVIVOR, now=LATER)
        check(
            "the survivor's rows are not re-stamped", after_first, fingerprint(db, HUB)
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
    print("PASS — a merged customer keeps every kitchen order (customers#86)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
