#!/usr/bin/env python3
"""A switch that moves nothing is worse than no switch at all (kitchen#48).

Ajustes de Cocina used to publish 16 controls and only FIVE of them reached any code. The manager
turned «Sonido» on so the line would hear the tickets come in, walked away, and nothing ever beeped
— no error, no warning. The system had said yes. Same family of failure as kitchen#41 (a screen
claiming a state that is not real) and kitchen#34/#36/#39 (a filter box promising something the
manifest never granted): **a control that lies**.

The fix is not a one-off deletion, it is this test. It pins the whole chain of a setting so a
future one cannot be born dead:

  1. **Somebody READS it.** Every property of `schemas/settings_update.json` — the file the shell
     renders as the form — has to appear in code that runs: the module's Web Components
     (`ui/**`, tests excluded) or its WASM handler (`handler/src/**`). Both spellings count: the
     column name (`show_timer`) and the camelCase a TS field may use (`showTimer`).
  2. **The three doors agree.** The schema, the `:params` of `commands/settings_update.sql` and
     the columns of `queries/settings_get.sql` name the SAME set. Removing a property from the
     schema alone would leave a `:param` nothing binds, and a declarative command with an unbound
     param DOES NOT EXIST in any hub — the settings screen would stop saving altogether.
  3. **The scan works.** A reader search that silently matches nothing would pass this test for
     the worst possible reason, so it is probed first against a token that IS in the corpus.

RETIRING a setting (kitchen#48 retired eight) means: out of the schema, out of the command, out of
the query, out of both `locales/*.json`. The COLUMN stays — dropping it needs a `kind: contract`
migration no module can publish today, and it keeps its `DEFAULT` for the day the KDS does read it.
"""

import json
import pathlib
import re
import sys

MODULE_DIR = pathlib.Path(__file__).resolve().parent.parent
MANIFEST = json.loads((MODULE_DIR / "module.json").read_text(encoding="utf-8"))

SETTINGS = MANIFEST.get("settings") or {}
SCHEMA_PATH = MODULE_DIR / SETTINGS.get("schema", "")
UPDATE_SQL = MODULE_DIR / "commands" / "settings_update.sql"
GET_SQL = MODULE_DIR / "queries" / "settings_get.sql"

#: Bound by the runtime on every command, never by the settings form (`../architecture/hub/tenancy.md`).
RUNTIME_PARAMS = {"new_id", "hub_id", "current_user_id", "now"}

#: A token that lives in the sources for sure — the probe that proves the reader scan reads them.
PROBE = "kitchen.settings.get"

failures: list[str] = []


def strip_comments(code: str) -> str:
    """Comments out. A key NAMED IN PROSE is not a reader — and these files explain themselves at
    length, so without this the note «`sound_on_rush` was retired» would count as the very reader
    whose absence justified retiring it. Found the hard way while checking this test could still
    fail: it could not. `//` preceded by `:` is left alone so an `https://` URL does not eat the
    rest of its line."""
    code = re.sub(r"/\*.*?\*/", " ", code, flags=re.DOTALL)
    return re.sub(r"(?<!:)//[^\n]*", " ", code)


def sources() -> dict[pathlib.Path, str]:
    """The code that RUNS: the module's Web Components and its WASM handler, comments stripped.
    Tests are excluded on purpose — a setting named only by its own test is still a setting
    nobody reads."""
    out: dict[pathlib.Path, str] = {}
    for path in sorted((MODULE_DIR / "ui").rglob("*.ts")):
        if path.name.endswith(".test.ts"):
            continue
        out[path] = strip_comments(path.read_text(encoding="utf-8"))
    for path in sorted((MODULE_DIR / "handler" / "src").rglob("*.rs")):
        out[path] = strip_comments(path.read_text(encoding="utf-8"))
    return out


def camel(key: str) -> str:
    head, *rest = key.split("_")
    return head + "".join(word.capitalize() for word in rest)


def readers(corpus: dict[pathlib.Path, str], key: str) -> list[str]:
    """Files naming `key` in either spelling, as relative paths."""
    needles = {key, camel(key)}
    return [
        str(path.relative_to(MODULE_DIR))
        for path, text in corpus.items()
        if any(needle in text for needle in needles)
    ]


def command_params() -> set[str]:
    """`:param` placeholders of the settings upsert, minus the ones the runtime injects.

    Comments are stripped first: these files EXPLAIN what a `:param` is, and a scanner that counts
    the prose finds parameters the database never sees."""
    sql = re.sub(r"--[^\n]*", "", UPDATE_SQL.read_text(encoding="utf-8"))
    return set(re.findall(r":([a-z_][a-z0-9_]*)", sql)) - RUNTIME_PARAMS


def selected_columns() -> set[str]:
    """Columns of the `SELECT` in `settings_get.sql`, `id` aside (the row's own key, not a setting)."""
    sql = GET_SQL.read_text(encoding="utf-8")
    sql = re.sub(r"--[^\n]*", "", sql)
    match = re.search(r"\bSELECT\b(.*?)\bFROM\b", sql, re.IGNORECASE | re.DOTALL)
    if not match:
        return set()
    columns = {part.strip() for part in match.group(1).split(",")}
    return {c for c in columns if re.fullmatch(r"[a-z_][a-z0-9_]*", c or "")} - {"id"}


def main() -> int:
    if not SETTINGS.get("schema"):
        print(
            "kitchen declares no `settings` block — delete this test or fix the manifest"
        )
        return 1

    schema = json.loads(SCHEMA_PATH.read_text(encoding="utf-8"))
    properties = set(schema.get("properties") or {})
    corpus = sources()

    # ── the scan has to work before anything it says means anything ───────────────────────────
    if not corpus:
        failures.append(
            "no sources under `ui/` or `handler/src/` — the scan would clear everything"
        )
    elif not any(PROBE in text for text in corpus.values()):
        failures.append(
            f"the reader scan cannot find {PROBE!r}, which IS in the sources: the scan is broken, "
            "not the module — fix it before trusting a single line below"
        )
    if "retired_key" in strip_comments(
        "// this file used to read retired_key\nconst a = 1;"
    ):
        failures.append(
            "`strip_comments` leaves prose in: a key merely NAMED in a comment would count as its "
            "own reader, and this whole test would pass while the switch moves nothing"
        )

    # ── 1. somebody reads it ──────────────────────────────────────────────────────────────────
    for key in sorted(properties):
        if not readers(corpus, key):
            failures.append(
                f"`{key}` is published in the settings form and NOTHING reads it: not the Web "
                f"Components, not the handler. Wire it, or retire it from the schema, the command, "
                f"the query and the locales (kitchen#48)"
            )

    # ── 2. the three doors agree ──────────────────────────────────────────────────────────────
    params = command_params()
    if not params:
        failures.append(
            f"no `:param` found in {UPDATE_SQL.name} — the param scan is broken"
        )
    for key in sorted(properties - params):
        failures.append(
            f"`{key}` is in the schema but {UPDATE_SQL.name} never binds it: saving the form would "
            "silently drop it"
        )
    for key in sorted(params - properties):
        failures.append(
            f"`{key}` is bound by {UPDATE_SQL.name} and NOT declared in the schema: the form never "
            "sends it, the param stays unbound and `kitchen.settings.update` stops existing"
        )

    columns = selected_columns()
    if not columns:
        failures.append(
            f"no column found in {GET_SQL.name} — the SELECT scan is broken"
        )
    for key in sorted(properties - columns):
        failures.append(
            f"`{key}` is in the schema but {GET_SQL.name} never returns it: the form opens it blank"
        )
    for key in sorted(columns - properties):
        failures.append(
            f"`{key}` is returned by {GET_SQL.name} and is not a setting any more — take it out of "
            "the SELECT so the three doors keep saying the same thing"
        )

    if failures:
        print(f"✗ kitchen settings — {len(failures)} problem(s):")
        for f in failures:
            print(f"  · {f}")
        return 1

    print(
        f"✓ the {len(properties)} published settings are each read by real code, and the schema, "
        f"{UPDATE_SQL.name} and {GET_SQL.name} name the same set"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
