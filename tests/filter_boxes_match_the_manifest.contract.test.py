#!/usr/bin/env python3
"""Every filter box of this module has to mean what it looks like (kitchen#39).

A column header carries a promise: a free-text box says «type a piece of it», a dropdown says
«choose one of these». The manifest is what actually happens — `op: "like"` narrows by fragment,
`op: "eq"` demands the whole value, and a column the `list` block never declares is a box that does
**nothing at all**. When the two disagree the user gets no error: the list simply empties, or the
typing is ignored, and there is nothing on screen to explain it.

This has now happened three times in this module — kitchen#34 (the UI promising a filter the query
did not concede), kitchen#36 (the Historial's Comanda demanding the exact id), kitchen#39 (four more
columns) — which is why the check that used to live inside `logs_column_filter.pg.test.py`, scoped
to one screen, lives here and sweeps **every table of the module**. Scoping it was what let the
other four survive the fix of the first one.

## The rules, and why each one

| The box says | The manifest must say | Because |
|---|---|---|
| `filterType: 'text'` | `op: 'like'` | a free-text box invites a fragment; `eq` empties the list unless the user types the value whole |
| `filterType: 'select'` | `op: 'eq'` | a closed domain is CHOSEN, and the value chosen is exact — `like` would silently match `rush` inside another value |
| `filterType: 'range'` / `'daterange'` | `op: 'range'` | two bounds need the operator that takes two bounds |
| `filterable: true` | the column IS in `list.filters` | otherwise the runtime drops the parameter and the box does nothing (kitchen#34) |
| `sortable: true` | the column IS in `list.sort` | the sort whitelist is a SECOND door: a header outside it does not sort, silently |

The pairs (screen → query) are DISCOVERED from the source, not listed here: a new table has to be
covered by this gate the day it is written, without anybody remembering to add it.

Usage: tests/filter_boxes_match_the_manifest.contract.test.py   (exit 0 = green)
  No Postgres, no Docker: it reads the manifest and the Web Components.
"""

import json
import pathlib
import re
import sys

MODULE_DIR = pathlib.Path(__file__).resolve().parent.parent
MANIFEST = json.loads((MODULE_DIR / "module.json").read_text())

#: What the manifest has to declare for each kind of box the table paints.
EXPECTED_OP = {
    "text": "like",
    "select": "eq",
    "range": "range",
    "daterange": "range",
}

#: Why each one, in the words the failure message uses.
WHY = {
    "text": "a free-text box invites a FRAGMENT; with `eq` anything short of the whole value empties the list",
    "select": "a closed domain is CHOSEN, so the match is exact; `like` would match the value inside another one",
    "range": "two bounds need the operator that takes two bounds",
    "daterange": "two bounds need the operator that takes two bounds",
}

failures: list[str] = []


def fail(msg: str) -> None:
    failures.append(msg)


def components():
    """Every Web Component of the module that drives a paginated `list` query, and its query.

    Discovered, never listed: `createListController(erplora(), '<query>', …)` is the one way a
    screen binds itself to a list, so a new table cannot be born outside this gate.
    """
    found = []
    for path in sorted((MODULE_DIR / "ui/components").rglob("*.ts")):
        if path.name.endswith(".test.ts"):
            continue
        src = path.read_text()
        for query in re.findall(
            r"createListController[^(]*\(\s*erplora\(\)\s*,\s*'([^']+)'", src
        ):
            found.append((path, query, src))
    return found


def declared_columns(src: str):
    """`(column, filterType|None, filterable, sortable)` for every column the component paints."""
    out = []
    for chunk in src.split("key: '")[1:]:
        column = chunk.split("'")[0]
        kind = re.search(r"filterType: '(\w+)'", chunk)
        out.append(
            (
                column,
                kind.group(1) if kind else None,
                "filterable: true" in chunk,
                "sortable: true" in chunk,
            )
        )
    return out


def check(path, query, src) -> None:
    screen = path.relative_to(MODULE_DIR)
    spec = MANIFEST["queries"].get(query)
    if spec is None:
        fail(f"{screen} drives `{query}`, which the manifest does not declare")
        return
    block = spec.get("list") or {}
    filters = block.get("filters") or {}
    sortable_whitelist = set(block.get("sort") or [])
    if not block:
        fail(f"`{query}` has no `list` block, but {screen} paginates it")
        return

    for column, kind, filterable, sortable in declared_columns(src):
        if filterable and column not in filters:
            fail(
                f"{screen} paints a filter box on `{column}` but `{query}` declares no filter for it: "
                f"the runtime drops the parameter and the box does nothing (kitchen#34)"
            )
        elif kind:
            op = (filters.get(column) or {}).get("op")
            expected = EXPECTED_OP.get(kind)
            if expected is None:
                fail(
                    f"{screen} paints `{column}` as `filterType: '{kind}'`, which this gate does not know — teach it"
                )
            elif op != expected:
                fail(
                    f"{screen} paints `{column}` as `filterType: '{kind}'` but `{query}` filters it with "
                    f"`op: {op!r}` (expected `{expected}`) — {WHY[kind]}"
                )
        if sortable and column not in sortable_whitelist:
            fail(
                f"{screen} paints `{column}` as sortable but `{query}` does not whitelist it in `list.sort`: "
                f"clicking that header does nothing"
            )


def main() -> int:
    pairs = components()
    # Check the check: if the discovery stops finding screens, this gate would pass by knowing
    # nothing. Three tables today (orders, stations, history) — fewer means the sweep broke.
    if len(pairs) < 3:
        print(
            f"FAIL: only {len(pairs)} list screen(s) discovered; this module has at least three "
            "(orders, stations, history). The discovery is broken, and a broken sweep passes."
        )
        return 1

    for path, query, src in pairs:
        check(path, query, src)

    if failures:
        print(f"FAIL ({len(failures)}):")
        for f in failures:
            print(f"  - {f}")
        return 1

    covered = ", ".join(sorted({q for _, q, _ in pairs}))
    print(
        f"OK: every filter box and every sortable header of {len(pairs)} screen(s) matches what the manifest concedes ({covered})"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
