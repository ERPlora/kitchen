#!/usr/bin/env python3
"""kitchen#162 — two checks merge: the rounds of the absorbed one follow its dishes, against Postgres.

`sales.order.merge` (SALES-F24) moves every unpaid line of the absorbed check to the check that stays
and voids the absorbed one; `sales.order.merged` tells kitchen. The handler of
`kitchen._on_sales_order_merged` decides (only when the absorbed check really is voided) and emits ONE
intention, `kitchen._repoint_source_order`, whose SQL is what this battery runs.

The trap it exists for: `kitchen_order` is unique on `(hub_id, source_order_id, round_number)` for live
rows (`uq_kitchen_order_source_round`). Both checks have a «round 1», so a blind re-point of
`source_order_id` breaks the index and the delivery dies in the dead-letter. The absorbed rounds are
numbered AFTER the last round of the check that stays, keeping their own order.

WHAT IS PROVEN HERE, against a REAL Postgres:

  1. The live rounds of the absorbed check — any status — now hang from the check that stays,
     renumbered after its last round, in their original order; label, status and notes unchanged.
  2. Into a check with no rounds of its own, they keep their numbers.
  3. A soft-deleted round stays where it was (it is outside the index and outside every list).
  4. Rounds of other checks are untouched.
  5. TENANCY — the hub next door, with rounds under the SAME check ids, is not touched.
  6. IDEMPOTENT — a redelivery finds nothing left on the absorbed check and changes nothing.
  7. A degenerate event (absorbed = stays) is a no-op.
  8. The next round the check that stays fires is numbered after all of them (`_insert_order`).

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
INTENT = "kitchen._repoint_source_order"
HUB = "hub-test"
OTHER_HUB = "hub-other"
ABSORBED = "sales-o-5"
STAYS = "sales-o-4"
EMPTY = "sales-o-9"
CREATED = "2026-10-01T00:00:00+00:00"
NOW = "2026-10-07T10:00:00+00:00"
LATER = "2026-10-07T11:00:00+00:00"

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
    if isinstance(v, (int, float)):
        return str(v)
    return "'" + str(v).replace("'", "''") + "'"


PARAM = re.compile(r"(?<!:):([a-z_][a-z0-9_]*)")  # `::` is a cast, never a bind


def run_sql(db, rels, params):
    script = ["BEGIN;"]
    for rel in rels:
        script.append(
            PARAM.sub(
                lambda m: literal(params.get(m.group(1))),
                (MODULE_DIR / rel).read_text(),
            )
        )
    script.append("COMMIT;")
    psql(db, "\n".join(script))


def repoint(db, hub=HUB, absorbed=ABSORBED, stays=STAYS, now=NOW):
    """Apply the intention the handler emits, bound the way the runtime binds it."""
    run_sql(
        db,
        MANIFEST["commands"][INTENT]["sql"],
        {
            "from_order_id": absorbed,
            "to_order_id": stays,
            "hub_id": hub,
            "current_user_id": "user-merger",
            "now": now,
        },
    )


def round_(db, oid, hub, source, number, status="pending", label="Mesa", deleted=0):
    psql(
        db,
        "INSERT INTO kitchen_order (id, hub_id, order_number, source_order_id, label, status, "
        "round_number, notes, is_deleted, created_at) VALUES "
        f"({literal(oid)}, {literal(hub)}, {literal('K-' + oid)}, {literal(source)}, {literal(label)}, "
        f"{literal(status)}, {number}, 'no onion', {deleted}, '{CREATED}')",
    )


def row(db, oid) -> dict:
    out = psql(
        db,
        "SELECT row_to_json(r) FROM (SELECT source_order_id, round_number, label, status, notes, "
        f"order_number, updated_by, updated_at FROM kitchen_order WHERE id = '{oid}') r;",
    )
    return json.loads(out.strip()) if out.strip() else {}


def rounds_of(db, hub, source) -> list:
    """`[(round_number, id)]` of the live rounds of one check, in round order."""
    out = psql(
        db,
        "SELECT COALESCE(json_agg(json_build_array(round_number, id) ORDER BY round_number), '[]') "
        f"FROM kitchen_order WHERE hub_id = '{hub}' AND source_order_id = '{source}' AND is_deleted = 0;",
    )
    return [tuple(x) for x in json.loads(out.strip())]


def fingerprint(db, hub) -> str:
    return psql(
        db,
        "SELECT COALESCE(string_agg(x, '|' ORDER BY x COLLATE \"C\"), '') FROM ("
        " SELECT id || ':' || COALESCE(source_order_id, '-') || ':' || round_number || ':'"
        " || COALESCE(updated_by, '-') || ':' || COALESCE(updated_at, '-') AS x"
        f"   FROM kitchen_order WHERE hub_id = '{hub}') t;",
    ).strip()


def manifest_half() -> bool:
    print("== the manifest declares the intention ==")
    cmd = MANIFEST["commands"].get(INTENT)
    check(f"`{INTENT}` exists", True, cmd is not None)
    if cmd is None:
        return False
    check(
        "it is internal (leading `_`)", True, INTENT.rsplit(".", 1)[1].startswith("_")
    )
    check("it carries SQL", True, bool(cmd.get("sql")))
    check("it emits nothing", None, cmd.get("emit"))
    check(
        "it has no expect_rows (a merged check that never fired a round is normal)",
        None,
        cmd.get("expect_rows"),
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

    db = f"kitchen_order_merge_{uuid.uuid4().hex[:8]}"
    subprocess.run(
        ["docker", "exec", CONTAINER, "createdb", "-U", "postgres", db], check=True
    )
    try:
        for rel, kind in migration_entries():
            psql(db, migration_sql(rel, kind))
        # `_insert_order.sql` numbers the round with `erp_pad`, a bridge function the runtime
        # lowers per dialect (hub crates/db): the width is a floor, never a ceiling (hub#1393).
        psql(
            db,
            "CREATE FUNCTION erp_pad(v anyelement, w integer) RETURNS text LANGUAGE sql AS "
            "$$ SELECT CASE WHEN length(v::text) >= w THEN v::text "
            "ELSE lpad(v::text, w, '0') END $$;",
        )

        # Table 4 (stays) fired two rounds and had a ninth one deleted; table 5 (absorbed) fired
        # two, one already served, and had a third one deleted. Another check of this hub, and the
        # hub next door with the SAME check ids, sit beside them. The deleted round 9 and the
        # neighbour's round 7 on table 4 are there to be IGNORED when the absorbed rounds are
        # numbered: only the live rounds of this hub count, as when a round is fired.
        round_(db, "s1", HUB, STAYS, 1, label="Mesa 4")
        round_(db, "s2", HUB, STAYS, 2, status="ready", label="Mesa 4")
        round_(db, "s-del", HUB, STAYS, 9, status="cancelled", label="Mesa 4", deleted=1)
        round_(db, "a1", HUB, ABSORBED, 1, status="served", label="Mesa 5")
        round_(db, "a2", HUB, ABSORBED, 2, status="preparing", label="Mesa 5")
        round_(
            db, "a-del", HUB, ABSORBED, 3, status="cancelled", label="Mesa 5", deleted=1
        )
        round_(db, "x1", HUB, "sales-o-7", 1, label="Mesa 7")
        round_(db, "n1", OTHER_HUB, ABSORBED, 1, label="Mesa 5")
        round_(db, "n2", OTHER_HUB, STAYS, 7, label="Mesa 4")
        neighbour_before = fingerprint(db, OTHER_HUB)

        print(
            "\n== the absorbed rounds follow their dishes, after the last round of the check =="
        )
        repoint(db)
        check(
            "the check that stays holds its rounds and then the absorbed ones, in their order",
            [(1, "s1"), (2, "s2"), (3, "a1"), (4, "a2")],
            rounds_of(db, HUB, STAYS),
        )
        check(
            "nothing live is left on the absorbed check",
            [],
            rounds_of(db, HUB, ABSORBED),
        )
        a2 = row(db, "a2")
        check(
            "label, status, notes and number of the moved round are unchanged",
            ("Mesa 5", "preparing", "no onion", "K-a2"),
            tuple(a2.get(k) for k in ("label", "status", "notes", "order_number")),
        )
        check(
            "the moved round stamps who merged",
            ("user-merger", NOW),
            (a2.get("updated_by"), a2.get("updated_at")),
        )
        check(
            "the check that stays keeps its rounds unstamped",
            None,
            row(db, "s1").get("updated_at"),
        )
        check(
            "the deleted round stays where it was",
            (ABSORBED, 3, None),
            tuple(
                row(db, "a-del").get(k)
                for k in ("source_order_id", "round_number", "updated_at")
            ),
        )
        check(
            "another check's round is untouched",
            ("sales-o-7", 1, None),
            tuple(
                row(db, "x1").get(k)
                for k in ("source_order_id", "round_number", "updated_at")
            ),
        )

        print("\n== tenancy: the hub next door is not touched ==")
        check(
            "hub B rows under the same check ids are NOT re-pointed",
            neighbour_before,
            fingerprint(db, OTHER_HUB),
        )

        print("\n== idempotent: a redelivery changes nothing ==")
        after_first = fingerprint(db, HUB)
        repoint(db, now=LATER)
        check(
            "a second delivery moves nothing and stamps nothing",
            after_first,
            fingerprint(db, HUB),
        )

        print("\n== a degenerate event (absorbed = stays) is a no-op ==")
        repoint(db, absorbed=STAYS, stays=STAYS, now=LATER)
        check(
            "the rounds of the check are not re-stamped",
            after_first,
            fingerprint(db, HUB),
        )

        print("\n== into a check with no rounds, they keep their numbers ==")
        repoint(db, absorbed=STAYS, stays=EMPTY, now=LATER)
        check(
            "the four rounds move with their numbers",
            [(1, "s1"), (2, "s2"), (3, "a1"), (4, "a2")],
            rounds_of(db, HUB, EMPTY),
        )

        print("\n== the next round of the check is numbered after all of them ==")
        insert = MANIFEST["commands"]["kitchen._insert_order"]["sql"]
        run_sql(
            db,
            ["commands/_bump_counter.sql"],
            {"new_id": "cnt-1", "hub_id": HUB, "day": "20261007"},
        )
        run_sql(
            db,
            insert,
            {
                "order_id": "s-next",
                "hub_id": HUB,
                "day": "20261007",
                "table_id": None,
                "sale_id": None,
                "customer_id": None,
                "waiter_id": None,
                "source_order_id": EMPTY,
                "label": "",
                "order_type": "dine_in",
                "status": "pending",
                "priority": "normal",
                "round_number": 0,
                "notes": "",
                "subtotal": 0,
                "tax": 0,
                "discount": 0,
                "total": 0,
                "current_user_id": "user-waiter",
                "now": LATER,
            },
        )
        check(
            "the round fired after the merge is round 5",
            5,
            row(db, "s-next").get("round_number"),
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
        "PASS — a merged check hands its rounds to the check that stays (kitchen#162)"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
