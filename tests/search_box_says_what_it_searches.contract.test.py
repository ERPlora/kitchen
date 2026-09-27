#!/usr/bin/env python3
"""Every kitchen search box promises exactly the columns it really searches (ERPlora/kitchen#110, #113).

WHY THIS EXISTS. Kitchen › Comandas painted «Buscar comanda o estado…». Typing «Pendiente» (or even
the raw key «pending») returned no order at all, with several pending ones in the list: the query
searched `order_number`, `customer_id` and `round_number` — no status, and two columns the table
does not even show. The cook read «no pending orders» when there were (kitchen#110).

Kitchen › Historial had the same lie (kitchen#113): «Buscar acción, comanda o notas…» while the
query searched the INTERNAL action key (`started`, `bumped`) — typing the translated label the
column shows («Lanzadas», «Listas (bump)») emptied the list.

The market (Square, Toast, Odoo, Lightspeed) splits the two jobs: the box takes free text over what
the row SHOWS as text (number, destination, notes), and a closed domain such as a status or an
action is PICKED in its filter — which both tables already have, translated. Searching a translated
label in SQL would need the server to translate, so the box stops promising it instead.

What is checked, per table, with both halves visible at once (the component's `vitest` stubs the
query and would "search" anything):

  1. every column the query searches is a column the table SHOWS — a hit on a hidden value (a
     customer UUID, a round number) is a row that matches for no visible reason;
  2. the columns a person types are searched (`required`): the destination in Comandas, the order
     number and the notes in Historial;
  3. no header of a shown-but-NOT-searched column appears in the placeholder, in `en` nor in `es`
     — that is the exact lie of kitchen#110 («estado») and kitchen#113 («acción»);
  4. every searched column is named in the placeholder, in `en` and in `es`: by its header, or by
     the word in `sentence_word` when the header reads wrong in a sentence (the `en` header of
     `label` is the terse «Where»; the box says «destination»);
  5. no ENUMERATED column (one picked from a `select` filter, whose cell paints a translated
     label) is searched: the engine compares the stored key, not the label the row shows — the
     root cause of kitchen#113 (`action` searched as `started` while the row reads «Lanzadas»).

Usage: tests/search_box_says_what_it_searches.contract.test.py   (exit 0 = green). No Postgres.
"""

import json
import pathlib
import re
import sys

MODULE_DIR = pathlib.Path(__file__).resolve().parent.parent
MANIFEST = json.loads((MODULE_DIR / "module.json").read_text(encoding="utf-8"))

#: One entry per search box of the module.
TABLES = [
    {
        "name": "Comandas",
        "issue": "kitchen#110",
        "query": "kitchen.orders.list",
        "component": "ui/components/erp-kitchen-orders-active/erp-kitchen-orders-active.ts",
        "min_columns": 5,
        "closed_domain": "status",
        "required": ["label"],
        #: (lang, column) → the word the box uses when the column header is not a sentence word.
        "sentence_word": {("en", "label"): "destination"},
    },
    {
        "name": "Historial",
        "issue": "kitchen#113",
        "query": "kitchen.logs.list",
        "component": "ui/components/erp-kitchen-history/erp-kitchen-history.ts",
        "min_columns": 4,
        "closed_domain": "action",
        "required": ["order_number", "notes"],
        "sentence_word": {},
    },
]

#: `{ key: 'x', header: t('ui.colX'), …` — possibly split over lines inside `columns`.
COLUMN_RE = re.compile(
    r"key:\s*'([a-z_]+)'\s*,\s*header:\s*t\(\s*'([^']+)'\s*\)", re.MULTILINE
)
PLACEHOLDER_RE = re.compile(r"\.searchPlaceholder\s*=\s*\$\{\s*t\(\s*'([^']+)'")

failures: list[str] = []


def catalog(lang: str) -> dict:
    return json.loads((MODULE_DIR / "locales" / f"{lang}.json").read_text("utf-8"))


def lookup(cat: dict, dotted: str) -> str:
    node = cat
    for part in dotted.split("."):
        node = node[part]
    return str(node)


def names(text: str, word: str) -> bool:
    return (
        re.search(rf"(?<!\w){re.escape(word.lower())}(?!\w)", text.lower()) is not None
    )


def check(table: dict) -> bool:
    """Append this table's failures; False when parsing went stale (nothing was verified)."""
    name, issue, query = table["name"], table["issue"], table["query"]
    src = (MODULE_DIR / table["component"]).read_text(encoding="utf-8")
    columns_block = src[src.index("private get columns()") :]
    columns_block = columns_block[: columns_block.index("\n  }\n")]
    shown = dict(COLUMN_RE.findall(columns_block))  # key → header i18n key
    matches = list(COLUMN_RE.finditer(columns_block))
    enumerated = {
        m.group(1)
        for i, m in enumerate(matches)
        if "filterType: 'select'"
        in columns_block[m.end() : matches[i + 1].start() if i + 1 < len(matches) else None]
    }
    placeholder = PLACEHOLDER_RE.search(src)
    searched = (MANIFEST["queries"][query].get("list") or {}).get("search") or []

    # Check the check: a fixture this thin would pass everything below for the wrong reason.
    if (
        len(shown) < table["min_columns"]
        or table["closed_domain"] not in enumerated
        or not placeholder
        or not searched
    ):
        print(
            f"FAIL: {name} parsing went stale — shown={shown} placeholder={placeholder} "
            f"enumerated={enumerated} search={searched}"
        )
        return False

    for col in searched:
        if col not in shown:
            failures.append(
                f"`{query}` searches `{col}`, which the {name} table does not show: a row would "
                f"match for no visible reason ({issue})"
            )
    for col in searched:
        if col in enumerated:
            failures.append(
                f"`{query}` searches `{col}`, a closed list the {name} row paints TRANSLATED: the "
                f"engine compares the stored key, so typing the label the row shows finds nothing "
                f"— pick it in the column filter instead ({issue})"
            )
    for col in table["required"]:
        if col not in searched:
            failures.append(
                f"`{query}` does not search `{col}`, which a person types in the {name} box ({issue})"
            )

    for lang in ("en", "es"):
        cat = catalog(lang)
        promise = lookup(cat, placeholder.group(1))
        for col, header_key in shown.items():
            header = lookup(cat, header_key)
            if col not in searched and names(promise, header):
                failures.append(
                    f"[{lang}] the {name} box says «{promise}» — it names «{header}» (`{col}`), "
                    f"which `{query}` does not search ({issue})"
                )
            word = table["sentence_word"].get((lang, col), header)
            if col in searched and not names(promise, word):
                failures.append(
                    f"[{lang}] the {name} box says «{promise}» but does not name «{word}» "
                    f"(`{col}`), which it does search"
                )
    return True


def main() -> int:
    parsed = [check(table) for table in TABLES]
    if not all(parsed):
        return 1
    if failures:
        print(f"FAIL ({len(failures)}):")
        for f in failures:
            print(f"  - {f}")
        return 1
    for table in TABLES:
        searched = MANIFEST["queries"][table["query"]]["list"]["search"]
        print(
            f"OK: the {table['name']} box searches {searched} and promises exactly that"
        )
    return 0


if __name__ == "__main__":
    sys.exit(main())
