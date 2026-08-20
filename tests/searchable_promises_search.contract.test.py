#!/usr/bin/env python3
"""A table that shows a search box must be backed by a query that can search (ERPlora/kitchen#34).

WHY THIS EXISTS. Kitchen → Historial painted a search box with the placeholder «Buscar acción,
comanda o notas…». The user typed, the table reloaded, and it returned exactly the same rows. No
error, no warning, no hint that nothing had happened.

The two halves disagreed and nothing was watching:

  * the Web Component declared `.searchable=${true}` on its `ok-data-table`, so the box is painted
    and every keystroke ships a `search` parameter;
  * `kitchen.logs.list` declared no `search` block in the manifest, and the list engine ignores the
    parameter IN SILENCE when the query does not declare one:

        // hub/crates/runtime/src/queries.rs:230
        if !spec.search.is_empty() && has("search") {

    No `search` in the manifest → the condition is never built → the parameter is dropped on the
    floor.

This is the same shape of failure as `inventory`'s list-envelope test (inventory#57), and it is
checked the same way and for the same reason: the mismatch is invisible at runtime AND invisible in
the component's own vitest, because that test stubs `queryPage` and the stub happily "searches"
whatever the real runtime would not. So the check has to be made where BOTH halves are visible at
once — the UI source that turns the box on, and the manifest that says whether it can work.

Not hypothetical beyond this module either: the same silent drop was found in
`schedules.overrides.list` the day before.

SCOPE. One component file = one list. Every searchable table in this module builds exactly one
`createListController`, so a file that declares `.searchable` and names a query of this module is
asking that query to search. If a component ever hosts two tables, this pairing gets coarser and
the test should be told about it rather than left to guess.

Usage: tests/searchable_promises_search.contract.test.py   (exit 0 = green). No Postgres.
"""

import json
import pathlib
import re
import sys

MODULE_DIR = pathlib.Path(__file__).resolve().parent.parent
MANIFEST = json.loads((MODULE_DIR / "module.json").read_text(encoding="utf-8"))
UI_DIR = MODULE_DIR / "ui"

# `createListController<Row>(erplora(), 'query.name', …)` — type argument optional, line breaks
# allowed anywhere. Same expression `inventory` uses, kept identical on purpose.
LIST_CONTROLLER_RE = re.compile(
    r"createListController\s*(?:<[^>]*>)?\s*\(\s*[A-Za-z_$][\w$]*\(\)\s*,\s*['\"]([^'\"]+)['\"]",
    re.MULTILINE,
)

#: `.searchable=${true}` on an `ok-data-table`, with whitespace tolerated.
SEARCHABLE_RE = re.compile(r"\.searchable\s*=\s*\$\{\s*true\s*\}")

#: `.searchPlaceholder=${t('ui.key')}` — the promise made to the user, for the report.
PLACEHOLDER_RE = re.compile(
    r"\.searchPlaceholder\s*=\s*\$\{\s*t\(\s*['\"]([^'\"]+)['\"]"
)

failures: list[str] = []
checked = 0


def main() -> int:
    global checked
    module_id = MANIFEST["id"]
    queries = MANIFEST.get("queries", {})

    sources = [
        p for p in sorted(UI_DIR.rglob("*.ts")) if not p.name.endswith(".test.ts")
    ]
    searchable_files = 0

    for path in sources:
        text = path.read_text(encoding="utf-8")
        if not SEARCHABLE_RE.search(text):
            continue
        searchable_files += 1
        rel = path.relative_to(MODULE_DIR)
        placeholder = PLACEHOLDER_RE.search(text)
        promise = placeholder.group(1) if placeholder else "(no placeholder)"

        for name in LIST_CONTROLLER_RE.findall(text):
            # Another module's public query is that module's contract to keep, not ours.
            if not name.startswith(f"{module_id}."):
                continue
            checked += 1
            spec = queries.get(name)
            if spec is None:
                failures.append(
                    f"{rel}: searchable table reads `{name}`, undeclared in module.json"
                )
                continue
            search = (spec.get("list") or {}).get("search") or []
            if not search:
                failures.append(
                    f"{rel}: the table declares `.searchable` (placeholder `{promise}`) but "
                    f"`{name}` declares NO `search` block, so the runtime DROPS the parameter in "
                    f"silence and the box filters nothing (kitchen#34)"
                )

    # A check that matched nothing would pass for the worst possible reason.
    if not searchable_files:
        failures.append(
            "no `.searchable=${true}` found in ui/ — either no table offers search any more (then "
            "delete this test) or the regex went stale (then fix it)"
        )
    if not checked:
        failures.append(
            "no searchable table resolved to a query of this module — the pairing regex found "
            "nothing to check, which is not the same as everything being fine"
        )

    print(
        f"· {searchable_files} searchable table(s), {checked} query pairing(s) checked"
    )
    if failures:
        print(f"FAIL ({len(failures)}):")
        for f in failures:
            print(f"  - {f}")
        return 1
    print(
        "OK: every search box in this module is backed by a query that can actually search"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
