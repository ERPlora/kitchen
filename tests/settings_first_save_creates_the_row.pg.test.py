#!/usr/bin/env python3
"""The first Guardar of a brand-new hub has to WRITE the row (kitchen#41).

`kitchen_settings` is a singleton born from the Ajustes screen and nowhere else: no migration
seeds it, and `kitchen.settings.get` on a fresh hub returns `[]`. So if the very first save cannot
go through, the configuration of the KDS is not "hard to change" — it is **impossible to create**.
That is what happened: the schema marked its 16 properties `required` and gave none of them a
`default`, the shell's generic form therefore started them at `null`/`false`/`''`, and Guardar came
back **422** with no message on screen.

The unit half of that (every `required` carries a `default` equal to its column DEFAULT) is pinned
by `settings_defaults_match_the_column.contract.test.py`. What THIS one adds is the other half,
against a real Postgres built from this module's own migrations: that the snapshot the form now
sends —the schema defaults, verbatim— actually lands as a row, that a changed value survives a
re-read, and that the two thresholds of the semaphore cannot be saved crossed.

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
SCHEMA = json.loads(
    (MODULE_DIR / MANIFEST["settings"]["schema"]).read_text(encoding="utf-8")
)
COMMAND_SQL = (MODULE_DIR / MANIFEST["commands"]["kitchen.settings.update"]["sql"][0]).read_text(
    encoding="utf-8"
)
CONTAINER = os.environ.get("KITCHEN_TEST_PG_CONTAINER", "erplora-test-pg-5433")

HUB = "hub-under-test"
USER = "user-1"
NOW = "2026-08-22T10:00:00Z"

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
        out = self.psql(["-tAc", f"SELECT COALESCE(json_agg(t), '[]'::json) FROM ({sql}) t"], db=self.name)
        return json.loads(out.strip() or "[]")


def save(db: ScratchDb, payload: dict) -> None:
    """Run the module's REAL command SQL with this payload, as the runtime would bind it."""
    sql = COMMAND_SQL
    for key, value in payload.items():
        sql = sql.replace(f":{key}", literal(value))
    for key, value in {"new_id": str(uuid.uuid4()), "hub_id": HUB, "current_user_id": USER, "now": NOW}.items():
        sql = sql.replace(f":{key}", literal(value))
    db.psql([], db=db.name, stdin=sql)


def defaults() -> dict:
    """Exactly what the shell's form now proposes on a hub with no row: the schema defaults."""
    return {key: prop["default"] for key, prop in SCHEMA["properties"].items() if "default" in prop}


def main() -> int:
    if not container_available():
        print(f"⚠ container `{CONTAINER}` not running — skipping (start the test Postgres to run it)")
        return 0

    db = ScratchDb("kitchen_settings_first_save")
    try:
        db.create()

        # The hub is new: the singleton does not exist. This is the state every hub starts in.
        if db.rows("SELECT id FROM kitchen_settings"):
            fail("the migrations seed a settings row — this test's premise is gone, rewrite it")

        snapshot = defaults()
        missing = [k for k in SCHEMA["required"] if k not in snapshot]
        if missing:
            # Stop here on purpose: without a complete snapshot there is nothing to save, which is
            # the bug itself. Going on would only bind `:auto_accept_orders` to nothing and drown
            # the real finding in a psql syntax error.
            fail(
                f"{len(missing)} of {len(SCHEMA['required'])} required properties carry no "
                f"`default` ({', '.join(missing[:4])}…), so the form of a hub with no row cannot "
                "propose a complete snapshot and its first Guardar is a 422 (kitchen#41)"
            )
            raise SystemExit(report())

        # 1) The first save writes the row.
        save(db, snapshot)
        rows = db.rows("SELECT * FROM kitchen_settings")
        if len(rows) != 1:
            fail(f"the first save left {len(rows)} rows, expected exactly 1")
        else:
            row = rows[0]
            for key, want in snapshot.items():
                got = row.get(key)
                got = bool(got) if isinstance(want, bool) else got
                if got != want:
                    fail(f"`{key}` was saved as {got!r}, the form proposed {want!r}")

        # 2) A changed value survives a re-read (criterion of #3, unreachable until now).
        save(db, {**snapshot, "warning_time_minutes": 7})
        rows = db.rows("SELECT warning_time_minutes FROM kitchen_settings")
        if len(rows) != 1:
            fail(f"the upsert created a second row ({len(rows)} total) instead of updating")
        elif rows[0]["warning_time_minutes"] != 7:
            fail(f"the changed value did not persist: {rows[0]['warning_time_minutes']!r} != 7")

        # 3) The semaphore's two thresholds cannot be saved crossed: with `critical <= warning`
        #    the amber step does not exist and the ticket goes straight to red (or is born red).
        #    JSON Schema cannot compare two properties, so the rule lives in the column.
        try:
            save(db, {**snapshot, "warning_time_minutes": 30, "critical_time_minutes": 20})
            fail(
                "a crossed pair (warning=30, critical=20) was accepted — the amber step of the KDS "
                "semaphore silently disappears (kitchen#41, criterion of #23)"
            )
        except RuntimeError as exc:
            if "ck_kitchen_settings_thresholds" not in str(exc):
                fail(f"the crossed pair was refused, but not by the threshold CHECK: {exc}")
    finally:
        db.drop()

    return report()


def report() -> int:
    if failures:
        print(f"✗ kitchen.settings.update — {len(failures)} problem(s):")
        for f in failures:
            print(f"  · {f}")
        return 1

    print("✓ the first save writes the singleton, a change persists, and crossed thresholds are refused")
    return 0


if __name__ == "__main__":
    sys.exit(main())
