#!/usr/bin/env python3
"""A settings form the user cannot save is worse than no form (kitchen#41).

`kitchen.settings.update` takes the **whole snapshot**: `settings_update.json` declares 16
properties and marks all 16 `required`. The shell's generic renderer
(`hub/apps/web/src/components/ModuleSettingsForm.vue`) builds its model as
**row value > schema `default` > empty**, so on a hub whose singleton row does not exist yet —
every new hub, since the row can only be born from this very form — a property without a `default`
starts as `null` / `false` / `''`. The user then presses Guardar and the payload carries five nulls
and an empty enum, which is exactly what `required` + `minimum` + `enum` refuse: **422**, and the
row can never be created. A dead end.

The same missing `default` is why the screen LIES before you even touch it: ten toggles read off
and six numbers read blank, when the real defaults of the module say `show_timer=1`,
`warning=15`, `critical=30`, `sound_enabled=1`, `color_coding_enabled=1`, `auto_print_tickets=1`,
`use_rounds=1`, `default_order_type='dine_in'`.

So the schema's `default` is not decoration: it is what the form shows and what makes the first
save valid. And it has to be the SAME value the column would have used, or the screen shows one
thing and a hub that skipped the form has another.

Contrast that proves the rule: `tables` declares `default` on its 3 fields and its Ajustes screen
loads with real values and saves; `kitchen` and `printing` declare none.

Its other half is the LANGUAGE. The shell labels each control `prop.title || humanize(key)`, so a
property with no `title` is shown to a Spanish cook as `Warning Time Minutes` — the column name,
literally. English is the source (`title` in the schema); the Spanish is the module's to provide,
under `settings.fields.<key>.label` in `locales/<lang>.json`, the same shape the module already
uses for `settings.title` and `navigation.<id>.label`. Whether the shell PREFERS the locale over
the schema is the shell's half (ERPlora/hub) — but if the module does not carry the strings, no
shell fix can ever make that screen Spanish, so they are pinned here.

🔴 THE COLUMN'S DEFAULT IS NOT ONLY 001's. It used to be read from the init migration alone, and
that was a trap with a fuse: a setting added later — or an old one whose `DEFAULT` a migration
changes — was invisible to this check, so the FIRST module that grew a setting after its init would
either be told the column does not exist (kitchen#72's `sound_volume`) or be compared against a
default the database stopped using two migrations ago (kitchen#70 lowers `auto_print_tickets` to 0
so the pass does not start printing paper nobody asked for). The scan now replays every DECLARED
postgres migration in order — `CREATE TABLE`, then each `ADD COLUMN … DEFAULT` and
`ALTER COLUMN … SET DEFAULT` — and compares against what the column's default IS today.

What this pins:
  · every `required` property of the settings schema carries a `default`;
  · that `default` EQUALS the `DEFAULT` the column has after ALL declared migrations have run
    (0/1 → false/true for booleans, so the two are compared after normalising);
  · every property carries an English `title` (never left to `humanize()`) and a label in EVERY
    `locales/<lang>.json` the module ships;
  · the check actually found the columns — a migration rename that made this test compare nothing
    would otherwise pass for the worst possible reason.
"""

import json
import pathlib
import re
import sys

MODULE_DIR = pathlib.Path(__file__).resolve().parent.parent
MANIFEST = json.loads((MODULE_DIR / "module.json").read_text(encoding="utf-8"))

#: `settings.schema` from the manifest — the file the shell actually fetches and renders.
SETTINGS = MANIFEST.get("settings") or {}
SCHEMA_PATH = MODULE_DIR / SETTINGS.get("schema", "")

#: The table behind the singleton, and the first postgres migration that creates it.
TABLE = f"{MANIFEST['id']}_settings"
INIT_SQL = MODULE_DIR / "migrations" / "postgres" / "001_init.sql"

#: `    column_name   TYPE ... DEFAULT <value>` inside a CREATE TABLE body.
COLUMN_RE = re.compile(
    r"^\s*(?P<name>[a-z_][a-z0-9_]*)\s+(?P<type>[A-Z]+)\b[^,]*?\bDEFAULT\s+(?P<default>'[^']*'|[-\w.]+)",
    re.MULTILINE,
)

#: `ALTER TABLE <table> ADD COLUMN [IF NOT EXISTS] name TYPE … DEFAULT <value>` — a setting born
#: after the init migration (kitchen#72's `sound_volume` / `sound_tone`).
ADD_COLUMN_RE = re.compile(
    rf"ALTER\s+TABLE\s+{TABLE}\s+ADD\s+COLUMN\s+(?:IF\s+NOT\s+EXISTS\s+)?"
    r"(?P<name>[a-z_][a-z0-9_]*)\s+(?P<type>[a-zA-Z]+)\b[^;]*?\bDEFAULT\s+(?P<default>'[^']*'|[-\w.]+)",
    re.IGNORECASE,
)

#: `ALTER TABLE <table> ALTER [COLUMN] name SET DEFAULT <value>` — the default of an EXISTING column
#: changing (kitchen#70 lowers `auto_print_tickets` to 0).
SET_DEFAULT_RE = re.compile(
    rf"ALTER\s+TABLE\s+{TABLE}\s+ALTER\s+(?:COLUMN\s+)?"
    r"(?P<name>[a-z_][a-z0-9_]*)\s+SET\s+DEFAULT\s+(?P<default>'[^']*'|[-\w.]+)",
    re.IGNORECASE,
)

#: The probe that proves the two ALTER scanners still read SQL — see `main`. A scanner that matched
#: nothing would clear every setting added after 001 for the worst possible reason.
PROBE_ALTER = (
    f"ALTER TABLE {TABLE} ADD COLUMN IF NOT EXISTS probe_col INTEGER NOT NULL DEFAULT 7;\n"
    f"ALTER TABLE {TABLE} ALTER COLUMN probe_col SET DEFAULT 9;\n"
)

failures: list[str] = []


def strip_sql_comments(sql: str) -> str:
    """`--` comments out. These migrations EXPLAIN what they change, at length and in prose that
    names columns and defaults; without this the header of 009 would be read as the DDL it
    describes."""
    return re.sub(r"--[^\n]*", "", sql)


def declared_migrations() -> list[pathlib.Path]:
    """The postgres migrations the manifest declares, IN ORDER. The manifest is the authority, not
    the directory listing: a `.sql` sitting in the folder undeclared never runs in any hub."""
    entries = (MANIFEST.get("migrations") or {}).get("postgres") or []
    paths: list[pathlib.Path] = []
    for entry in entries:
        rel = entry if isinstance(entry, str) else (entry or {}).get("file")
        if rel:
            paths.append(MODULE_DIR / rel)
    return paths


def coerce(raw: str, kind: str | None) -> object:
    """The SQL literal as the value it is: `'dine_in'` → str, `0` → int."""
    if raw.startswith("'"):
        return raw[1:-1]
    if (kind or "").upper() == "INTEGER" or re.fullmatch(r"-?\d+", raw):
        return int(raw)
    return raw


def apply_alters(sql: str, out: dict[str, object]) -> None:
    """Replays one migration's `ADD COLUMN`/`SET DEFAULT` onto the defaults built so far."""
    for m in ADD_COLUMN_RE.finditer(sql):
        out[m.group("name")] = coerce(m.group("default"), m.group("type"))
    for m in SET_DEFAULT_RE.finditer(sql):
        out[m.group("name")] = coerce(m.group("default"), None)


def column_defaults() -> dict[str, object]:
    """`{column: default}` of the settings table AS IT IS TODAY: the init migration's CREATE TABLE
    with every later declared migration replayed on top, in order."""
    sql = strip_sql_comments(INIT_SQL.read_text(encoding="utf-8"))
    start = sql.find(f"CREATE TABLE IF NOT EXISTS {TABLE}")
    if start < 0:
        start = sql.find(f"CREATE TABLE {TABLE}")
    if start < 0:
        return {}
    body = sql[start : sql.find(");", start)]

    out: dict[str, object] = {}
    for m in COLUMN_RE.finditer(body):
        raw, kind = m.group("default"), m.group("type")
        if raw.startswith("'"):
            out[m.group("name")] = raw[1:-1]
        elif kind == "INTEGER":
            out[m.group("name")] = int(raw)

    for path in declared_migrations():
        if path == INIT_SQL or not path.exists():
            continue
        apply_alters(strip_sql_comments(path.read_text(encoding="utf-8")), out)
    return out


def normalise(value: object) -> object:
    """A boolean in the schema is a 0/1 INTEGER in the column — compare them as the same thing."""
    if isinstance(value, bool):
        return 1 if value else 0
    return value


def main() -> int:
    if not SETTINGS.get("schema"):
        print(
            "kitchen declares no `settings` block — delete this test or fix the manifest"
        )
        return 1

    schema = json.loads(SCHEMA_PATH.read_text(encoding="utf-8"))
    properties = schema.get("properties") or {}
    required = schema.get("required") or []
    columns = column_defaults()

    if not columns:
        failures.append(
            f"no column DEFAULT found for `{TABLE}` in {INIT_SQL.name} — the check would pass "
            "comparing nothing; fix the regex or the table name"
        )

    # ── the ALTER scanners have to WORK before their silence means anything ────────────────────
    # A regex that matched nothing would report every setting added after 001 as «no column of that
    # name» — or, worse, silently compare against a default the database stopped using. Probed
    # against SQL that IS both shapes, so the check cannot pass by finding nothing.
    # Each scanner is probed ALONE: replaying both at once hides a broken `ADD COLUMN`, because the
    # `SET DEFAULT` that follows writes the same key and the result looks right. Found exactly that
    # way while checking this probe could still fail — it could not.
    added = {
        m.group("name"): coerce(m.group("default"), m.group("type"))
        for m in ADD_COLUMN_RE.finditer(PROBE_ALTER)
    }
    if added.get("probe_col") != 7:
        failures.append(
            "the `ADD COLUMN … DEFAULT` scanner cannot read the statement it is handed on purpose: "
            "every setting born after the init migration would be reported as a column that does "
            "not exist. Fix the scanner before trusting a single line below"
        )
    reset = {
        m.group("name"): coerce(m.group("default"), None)
        for m in SET_DEFAULT_RE.finditer(PROBE_ALTER)
    }
    if reset.get("probe_col") != 9:
        failures.append(
            "the `ALTER COLUMN … SET DEFAULT` scanner cannot read the statement it is handed on "
            "purpose: a column whose default a migration changed would still be compared against "
            "the one the database stopped using"
        )
    commented: dict[str, object] = {}
    apply_alters(
        strip_sql_comments(
            "".join(f"-- {line}\n" for line in PROBE_ALTER.splitlines())
        ),
        commented,
    )
    if commented:
        failures.append(
            "`strip_sql_comments` leaves prose in: a migration that DESCRIBES a default in its "
            "header would be read as the DDL that sets it"
        )
    if not declared_migrations():
        failures.append(
            "the manifest declares no postgres migrations — nothing to replay"
        )

    for key in required:
        prop = properties.get(key)
        if prop is None:
            failures.append(f"`{key}` is required but not declared in `properties`")
            continue
        if "default" not in prop:
            failures.append(
                f"`{key}` is required and has NO `default`: on a hub without the singleton row the "
                f"form starts it empty and the first Guardar is a 422 the user never sees (kitchen#41)"
            )
            continue
        if key not in columns:
            failures.append(
                f"`{key}` has a schema default but no column of that name in {TABLE}"
            )
            continue
        want, got = normalise(columns[key]), normalise(prop["default"])
        if want != got:
            failures.append(
                f"`{key}`: schema default {prop['default']!r} != column DEFAULT {columns[key]!r} — "
                "the screen would promise a value the database does not use"
            )

    # ── the language half ─────────────────────────────────────────────────────────────────────
    locales = sorted((MODULE_DIR / "locales").glob("*.json"))
    if not locales:
        failures.append(
            "the module ships no `locales/` — the settings screen can only be English"
        )

    for key in properties:
        if not (properties[key].get("title") or "").strip():
            failures.append(
                f"`{key}` has no `title`: the shell falls back to `humanize('{key}')` and shows the "
                "COLUMN NAME as the label (kitchen#41)"
            )

    for path in locales:
        fields = (
            json.loads(path.read_text(encoding="utf-8")).get("settings") or {}
        ).get("fields") or {}
        for key in properties:
            if not ((fields.get(key) or {}).get("label") or "").strip():
                failures.append(
                    f"locales/{path.name}: no `settings.fields.{key}.label` — that control can "
                    "never be shown in this language"
                )

    if failures:
        print(f"✗ {SCHEMA_PATH.relative_to(MODULE_DIR)} — {len(failures)} problem(s):")
        for f in failures:
            print(f"  · {f}")
        return 1

    print(
        f"✓ the {len(required)} required settings carry a default equal to their column "
        f"DEFAULT, an English title and a label in {len(locales)} locale(s)"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
