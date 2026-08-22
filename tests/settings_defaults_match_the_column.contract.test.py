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

What this pins:
  · every `required` property of the settings schema carries a `default`;
  · that `default` EQUALS the `DEFAULT` of the column of the same name in the init migration
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

failures: list[str] = []


def column_defaults() -> dict[str, object]:
    """`{column: default}` of the settings table, read from the init migration."""
    sql = INIT_SQL.read_text(encoding="utf-8")
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
    return out


def normalise(value: object) -> object:
    """A boolean in the schema is a 0/1 INTEGER in the column — compare them as the same thing."""
    if isinstance(value, bool):
        return 1 if value else 0
    return value


def main() -> int:
    if not SETTINGS.get("schema"):
        print("kitchen declares no `settings` block — delete this test or fix the manifest")
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
            failures.append(f"`{key}` has a schema default but no column of that name in {TABLE}")
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
        failures.append("the module ships no `locales/` — the settings screen can only be English")

    for key in properties:
        if not (properties[key].get("title") or "").strip():
            failures.append(
                f"`{key}` has no `title`: the shell falls back to `humanize('{key}')` and shows the "
                "COLUMN NAME as the label (kitchen#41)"
            )

    for path in locales:
        fields = ((json.loads(path.read_text(encoding="utf-8")).get("settings") or {}).get("fields") or {})
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
