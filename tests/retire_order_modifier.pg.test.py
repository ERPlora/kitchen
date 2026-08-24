#!/usr/bin/env python3
"""kitchen#55 — `kitchen_order_modifier` is retired, and retiring it DESTROYS NOTHING.

The table was born in `001_init.sql` and never got a door: no command writes it, no query reads
it, no JSON Schema names it, the WASM handler and the KDS Web Component ignore it. What actually
carries the supplements of a line is the JSON snapshot `kitchen_order_item.modifiers`, written by
`commands/_insert_item.sql` and painted by `erp-kitchen-display.ts` — and that is the RIGHT call:
the snapshot is immutable by contract (ADR-0376, rule 4), so a normalized table with a FK adds
nothing and adds one more write that can end up half done.

A table nobody writes is a false promise in the schema: the next reader assumes there are rows in
it, or writes against it thinking it is the good road while the KDS keeps reading the JSON.

A table name is a CONTRACT with every hub that already created it, so the interesting assertions
here are not «the table is gone» but the three around it:

  1. **It is SET ASIDE, not destroyed.** The manifest declares the retirement `kind:"contract"`
     (hub#542/#1093), the only declaration under which the runtime accepts a `DROP` — and it
     accepts it by TRANSLATING it: `DROP TABLE t` is applied as `ALTER TABLE t RENAME TO
     _deprecated_t`. Metadata only, no lock, no byte copied, the rows stay.

  2. **Reverting is a rename back.** Not a restore from a backup, not a re-`CREATE` that would
     come back empty: the same row, under the original name.

  3. 🔴 **The `DROP`s carry no prose in front of them.** This is not style. The runtime's
     translator matches `DROP TABLE ` at the START of the statement text
     (`migration_guard::set_aside_instead_of_dropping`) and its splitter keeps a comment INSIDE
     the statement it precedes — so a header comment above the first `DROP` makes the translation
     silently miss and the hub runs a REAL, irreversible `DROP TABLE` on a customer database.
     That is why the prose of the retirement sits at the BOTTOM of its file, and why this test
     goes red if anyone tidies it back to the top. The hub-side fix is ERPlora/hub#1137, open.

And, so the module is not merely amputated: what is left has to work — the snapshot road still
carries a supplement from the command that writes it to the query the KDS reads.

The Postgres half needs the workspace container (`erplora-test-pg-5433`); without it that half
reports SKIPPED. The contract half needs nothing and always runs.

Usage: tests/retire_order_modifier.pg.test.py   (exit 0 = green)
"""

import json
import os
import pathlib
import subprocess
import sys
import uuid

from module_migrations import (
    migration_entries,
    migration_sql,
    set_aside_instead_of_dropping,
    split_statements,
    strip_comments,
)

MODULE_DIR = pathlib.Path(__file__).resolve().parent.parent
MANIFEST = json.loads((MODULE_DIR / "module.json").read_text(encoding="utf-8"))
CONTAINER = os.environ.get("KITCHEN_TEST_PG_CONTAINER", "erplora-test-pg-5433")

RETIRED = "kitchen_order_modifier"
ALIVE = "kitchen_order_item"  # the positive control: the table that DID get a door
INIT_FILE = "migrations/postgres/001_init.sql"
CONTRACT_FILE = "migrations/postgres/007_retire_order_modifier.sql"

# The only two files allowed to say the name: the one that CREATED the table and the one that
# retires it. `001_init.sql` keeps its `CREATE TABLE` on purpose — `_hub_migrations` records by
# FILE NAME, so editing an already-applied migration re-runs nothing where it is applied and only
# rewrites the story where it is not. History is append-only; the retirement is 007.
MAY_NAME_IT = (INIT_FILE, CONTRACT_FILE)

HUB = "hub-under-test"
USER = "user-1"
NOW = "2026-08-24T10:00:00Z"

failures: list[str] = []


def check(label: str, expected, actual) -> None:
    good = expected == actual
    print(
        f"  {'ok' if good else 'FAIL'}: {label} = {actual!r}"
        + ("" if good else f" (expected {expected!r})")
    )
    if not good:
        failures.append(f"{label}: expected {expected!r}, got {actual!r}")


def ok(label: str, condition: bool, detail: str = "") -> None:
    print(f"  {'ok' if condition else 'FAIL'}: {label}{'' if condition else f' — {detail}'}")
    if not condition:
        failures.append(f"{label}{f' — {detail}' if detail else ''}")


def literal(value) -> str:
    if value is None:
        return "NULL"
    if isinstance(value, bool):
        return "1" if value else "0"
    if isinstance(value, (int, float)):
        return str(value)
    return "'" + str(value).replace("'", "''") + "'"


# ── 1 · The manifest declares the retirement the only way the runtime accepts ─────────────


def check_declaration() -> None:
    entries = migration_entries()
    contracts = [(f, k) for f, k in entries if k == "contract"]
    ok(
        "the retirement is declared, and as a `contract`",
        contracts == [(CONTRACT_FILE, "contract")],
        f"contract entries = {contracts!r}",
    )

    declared = {
        e["file"]: e for e in MANIFEST["migrations"]["postgres"] if isinstance(e, dict)
    }
    entry = declared.get(CONTRACT_FILE, {})
    ok(
        "the contract carries `since` (the version that stopped using what it retires)",
        isinstance(entry.get("since"), str) and bool(entry.get("since")),
        f"since = {entry.get('since')!r}",
    )
    ok(
        "the declared file is in the package",
        (MODULE_DIR / CONTRACT_FILE).is_file(),
        f"{CONTRACT_FILE} missing",
    )
    files = [f for f, _ in entries]
    ok(
        "the migration chain is still ordered and gapless",
        # `in`, not `files[-1] ==`: the retirement being the LAST migration was true the day it
        # was written and says nothing about what this battery guards. Pinning it made the next
        # additive migration (008, kitchen#57) go red for existing — which is a battery that
        # answers a question nobody asked, and the kind that gets disabled instead of read.
        files == sorted(files) and CONTRACT_FILE in files,
        f"{files!r}",
    )


# ── 2 · Nothing in the module names the table any more ────────────────────────────────────


def check_no_statement_names_it() -> None:
    swept = 0
    guilty: list[str] = []
    for path in sorted(MODULE_DIR.rglob("*")):
        if not path.is_file():
            continue
        rel = path.relative_to(MODULE_DIR).as_posix()
        if rel.startswith(("node_modules/", ".git/", "build/", "tests/", "dist/", "docs/")):
            continue
        if path.suffix not in (".sql", ".json", ".rs", ".ts"):
            continue
        if rel in MAY_NAME_IT:
            continue
        swept += 1
        if RETIRED in path.read_text(errors="ignore"):
            guilty.append(rel)

    # A search that finds nothing proves nothing until it has found the thing that IS there:
    # `kitchen_order_item` is alive and has to light up the very same sweep.
    positive = [
        path.relative_to(MODULE_DIR).as_posix()
        for path in sorted(MODULE_DIR.rglob("*.sql"))
        if not path.relative_to(MODULE_DIR).as_posix().startswith(("node_modules/", "tests/"))
        and ALIVE in path.read_text(errors="ignore")
    ]
    ok(
        f"the sweep detects the positive (`{ALIVE}` is alive)",
        len(positive) > 1,
        f"found {positive!r}",
    )
    ok(
        f"only the birth and the retirement name `{RETIRED}` ({swept} other files swept)",
        not guilty,
        f"{guilty!r}",
    )


# ── 3 · The `DROP`s are translated, not executed ──────────────────────────────────────────


def check_the_drops_are_translated() -> None:
    path = MODULE_DIR / CONTRACT_FILE
    if not path.is_file():
        failures.append(f"{CONTRACT_FILE} does not exist — nothing to translate")
        print(f"  FAIL: {CONTRACT_FILE} does not exist")
        return
    sql = path.read_text(encoding="utf-8")
    applied = [set_aside_instead_of_dropping(s) for s in split_statements(sql)]
    # On the SQL, not on the prose: this file EXPLAINS the translation, so the words «DROP TABLE»
    # appear in its comments and a raw text match would fail on its own documentation.
    dropping = [s for s in applied if "DROP TABLE" in strip_comments(s).upper()]
    ok(
        "no statement reaches the database as a real DROP TABLE",
        not dropping,
        f"{dropping!r} — prose above a DROP defeats the runtime's translation (hub#1137)",
    )
    ok(
        "the table is set aside by rename",
        any(f"RENAME TO _deprecated_{RETIRED}" in s for s in applied),
        f"{applied!r}",
    )
    # A `DROP INDEX` is NOT translated by the guard: it would be the one genuinely destructive
    # line in a migration whose whole point is that nothing is destroyed. Postgres carries an
    # index along with its table through a rename, so the two indexes need no statement at all.
    ok(
        "no DROP INDEX (the guard does not translate it — it would really drop)",
        not any("DROP INDEX" in strip_comments(s).upper() for s in applied),
        f"{applied!r}",
    )


# ── 4 · Against a real Postgres: the rows survive, and coming back is a rename ─────────────


def container_available() -> bool:
    try:
        subprocess.run(["docker", "inspect", CONTAINER], capture_output=True, check=True, text=True)
        return True
    except (subprocess.CalledProcessError, FileNotFoundError):
        return False


class ScratchDb:
    """A throwaway database built from the manifest's migrations, applied THROUGH THE GUARD."""

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

    def create(self, through: str | None = None) -> None:
        self.psql(["-c", f'DROP DATABASE IF EXISTS "{self.name}"'])
        self.psql(["-c", f'CREATE DATABASE "{self.name}"'])
        for rel, kind in migration_entries():
            self.apply(rel, kind)
            if through is not None and rel == through:
                return

    def apply(self, rel: str, kind: str | None = None) -> None:
        if kind is None:
            kind = dict(migration_entries()).get(rel, "expand")
        self.psql([], db=self.name, stdin=migration_sql(rel, kind))

    def drop(self) -> None:
        try:
            self.psql(["-c", f'DROP DATABASE IF EXISTS "{self.name}" WITH (FORCE)'])
        except RuntimeError as exc:
            print(f"  ! could not drop {self.name}: {exc}")

    def scalar(self, sql: str) -> str:
        return self.psql(["-tAc", sql], db=self.name).strip()

    def rows(self, sql: str) -> list[dict]:
        out = self.psql(
            ["-tAc", f"SELECT COALESCE(json_agg(t), '[]'::json) FROM ({sql}) t"], db=self.name
        )
        return json.loads(out.strip() or "[]")

    def run_command(self, name: str, payload: dict) -> None:
        """Execute a manifest command's `sql[]` the way the runtime does (one transaction)."""
        params = dict(payload)
        params.setdefault("hub_id", HUB)
        params.setdefault("current_user_id", USER)
        params.setdefault("now", NOW)
        script = ["BEGIN;"]
        for rel in MANIFEST["commands"][name]["sql"]:
            stmt = dict(params)
            stmt.setdefault("new_id", str(uuid.uuid4()))
            sql = (MODULE_DIR / rel).read_text(encoding="utf-8")
            # One pass, longest name first: a value carrying a colon is never rescanned and
            # `:order_id` never eats the head of `:order_item_id`.
            for key in sorted(stmt, key=len, reverse=True):
                sql = sql.replace(f":{key}", literal(stmt[key]))
            script.append(sql)
        script.append("COMMIT;")
        self.psql([], db=self.name, stdin="\n".join(script))


def table_exists(db: ScratchDb, table: str) -> bool:
    return (
        db.scalar(
            "SELECT COUNT(*) FROM information_schema.tables "
            f"WHERE table_schema = current_schema() AND table_name = '{table}'"
        )
        == "1"
    )


MODIFIER_ID = "mod-extra-cheese"
ITEM_ID = "item-burger"
ORDER_ID = "ord-42"


def seed_a_row_in_the_doomed_table(db: ScratchDb) -> None:
    """A hub that somehow DID get a row in — the case the retirement must not lose."""
    db.psql(
        [],
        db=db.name,
        stdin=(
            "INSERT INTO kitchen_order (id, hub_id, order_number, status, created_at) "
            f"VALUES ('{ORDER_ID}', '{HUB}', 42, 'pending', '{NOW}');\n"
            "INSERT INTO kitchen_order_item (id, hub_id, order_id, product_name, created_at) "
            f"VALUES ('{ITEM_ID}', '{HUB}', '{ORDER_ID}', 'Burger', '{NOW}');\n"
            "INSERT INTO kitchen_order_modifier (id, hub_id, order_item_id, name, price, created_at) "
            f"VALUES ('{MODIFIER_ID}', '{HUB}', '{ITEM_ID}', 'Extra cheese', 100, '{NOW}');\n"
        ),
    )


def run_against_postgres() -> None:
    db = ScratchDb("kitchen55_retire")
    try:
        # Everything up to (not including) the retirement — the schema a live hub runs today.
        db.create(through="migrations/postgres/006_settings_thresholds.sql")
        ok(f"`{RETIRED}` exists before the retirement", table_exists(db, RETIRED), "not created")
        seed_a_row_in_the_doomed_table(db)

        db.apply(CONTRACT_FILE)

        ok(f"`{RETIRED}` is gone from the live schema", not table_exists(db, RETIRED), "still there")
        ok(
            f"`_deprecated_{RETIRED}` holds it instead",
            table_exists(db, f"_deprecated_{RETIRED}"),
            "the rename did not happen — the table was DESTROYED",
        )
        check(
            "the row is still there, set aside",
            "Extra cheese|100",
            db.scalar(
                f"SELECT name || '|' || price FROM _deprecated_{RETIRED} WHERE id = '{MODIFIER_ID}'"
            ),
        )

        # Re-running the contract cannot break a boot that died halfway through it.
        db.apply(CONTRACT_FILE)
        ok("applying the retirement twice does not raise", True)

        # Reverting is a rename back — the same row, not an empty re-CREATE.
        db.psql(
            [],
            db=db.name,
            stdin=f"ALTER TABLE _deprecated_{RETIRED} RENAME TO {RETIRED};\n",
        )
        check(
            "reverting is a rename back, with the data intact",
            "Extra cheese",
            db.scalar(f"SELECT name FROM {RETIRED} WHERE id = '{MODIFIER_ID}'"),
        )
    except (RuntimeError, KeyError, OSError) as exc:
        failures.append(f"the retirement run aborted: {exc}")
        print(f"\n  ABORTED: {exc}")
    finally:
        db.drop()


def run_the_snapshot_road_without_it() -> None:
    """Amputating is not enough: the road that DOES carry the supplements has to still work."""
    db = ScratchDb("kitchen55_snapshot")
    try:
        db.create()
        ok(f"a NEW hub never keeps `{RETIRED}`", not table_exists(db, RETIRED), "created anyway")
        ok(
            f"a NEW hub sets it aside as `_deprecated_{RETIRED}`",
            table_exists(db, f"_deprecated_{RETIRED}"),
            "the table was destroyed instead of renamed",
        )

        db.psql(
            [],
            db=db.name,
            stdin=(
                "INSERT INTO kitchen_order (id, hub_id, order_number, status, created_at) "
                f"VALUES ('{ORDER_ID}', '{HUB}', 42, 'pending', '{NOW}');\n"
            ),
        )
        db.run_command(
            "kitchen._insert_item",
            {
                "item_id": ITEM_ID,
                "order_id": ORDER_ID,
                "station_id": None,
                "category_id": None,
                "sales_order_item_id": None,
                "product_id": "prod-burger",
                "product_name": "Burger",
                "unit_price": 950,
                "quantity": 1000000,
                "total": 1050,
                "modifiers": json.dumps([{"name": "Extra cheese", "price": 100}]),
                "notes": "",
                "status": "pending",
                "seat_number": None,
                # kitchen#57 — `_insert_item` now also freezes the MENU the line belongs to
                # (ADR-0381). Not a menu here: NULL / '' / first line.
                "combo_ref": None,
                "combo_name": "",
                "line_seq": 1,
            },
        )
        rows = db.rows(
            f"SELECT modifiers FROM kitchen_order_item WHERE order_id = '{ORDER_ID}'"
        )
        check("the snapshot road still writes one line", 1, len(rows))
        check(
            "and the supplement travels in `kitchen_order_item.modifiers`",
            "Extra cheese",
            json.loads(rows[0]["modifiers"] or "[]")[0]["name"] if rows else None,
        )
    except (RuntimeError, KeyError, OSError, ValueError, IndexError) as exc:
        failures.append(f"the snapshot run aborted: {exc}")
        print(f"\n  ABORTED: {exc}")
    finally:
        db.drop()


def main() -> int:
    print(f"kitchen#55 — retiring {RETIRED}\n")

    print("contract — the manifest declares it the way the runtime accepts:")
    check_declaration()
    print("\ncontract — nothing names the retired table any more:")
    check_no_statement_names_it()
    print("\ncontract — the DROPs are translated into renames, not executed:")
    check_the_drops_are_translated()

    if container_available():
        print("\npostgres — the row survives the retirement:")
        run_against_postgres()
        print("\npostgres — the snapshot road works without it:")
        run_the_snapshot_road_without_it()
    else:
        print(f"\nSKIPPED — container `{CONTAINER}` not running (the contract half above ran)")

    print()
    if failures:
        print(f"FAILED — {len(failures)} point(s):")
        for f in failures:
            print(f"  - {f}")
        return 1
    print(f"PASS — `{RETIRED}` is retired, set aside rather than destroyed")
    return 0


if __name__ == "__main__":
    sys.exit(main())
