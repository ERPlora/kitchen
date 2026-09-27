#!/usr/bin/env python3
"""The Comandas search box promises only the columns it really searches (ERPlora/kitchen#110).

WHY THIS EXISTS. Kitchen › Comandas painted «Buscar comanda o estado…». Typing «Pendiente» (or even
the raw key «pending») returned no order at all, with several pending ones in the list: the query
searched `order_number`, `customer_id` and `round_number` — no status, and two columns the table
does not even show. The cook read «no pending orders» when there were.

The market (Square, Toast, Odoo, Lightspeed) splits the two jobs: the box takes free text over what
the row SHOWS as text (number, destination), and a closed domain such as the status is PICKED in
its filter — which this table already has, translated. Searching a translated status in SQL would
need the server to translate, so the box stops promising it instead.

What is checked, with both halves visible at once (the component's `vitest` stubs the query and
would "search" anything):

  1. every column `kitchen.orders.list` searches is a column the table SHOWS — a hit on a hidden
     value (a customer UUID, a round number) is a row that matches for no visible reason;
  2. the destination (`label`, «Mesa 4», «Barra») is searched — it is what a cook types;
  3. no header of a shown-but-NOT-searched column appears in the placeholder, in `en` nor in `es`
     — that is the exact lie of kitchen#110 («estado»);
  4. every searched column is named in the placeholder, in `en` and in `es`: by its header, or by
     the word in `SENTENCE_WORD` when the header reads wrong in a sentence (the `en` header of
     `label` is the terse «Where»; the box says «destination»).

Usage: tests/orders_search_says_what_it_searches.contract.test.py   (exit 0 = green). No Postgres.
"""

import json
import pathlib
import re
import sys

MODULE_DIR = pathlib.Path(__file__).resolve().parent.parent
MANIFEST = json.loads((MODULE_DIR / "module.json").read_text(encoding="utf-8"))
COMPONENT = (
    MODULE_DIR / "ui/components/erp-kitchen-orders-active/erp-kitchen-orders-active.ts"
)
QUERY = "kitchen.orders.list"

#: `{ key: 'x', header: t('ui.colX'), …` — possibly split over lines inside `columns`.
COLUMN_RE = re.compile(
    r"key:\s*'([a-z_]+)'\s*,\s*header:\s*t\(\s*'([^']+)'\s*\)", re.MULTILINE
)
PLACEHOLDER_RE = re.compile(r"\.searchPlaceholder\s*=\s*\$\{\s*t\(\s*'([^']+)'")
#: (lang, column) → the word the box uses when the column header is not a sentence word.
SENTENCE_WORD = {("en", "label"): "destination"}

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


def main() -> int:
    src = COMPONENT.read_text(encoding="utf-8")
    columns_block = src[
        src.index("private get columns()") : src.index("get rowActions()")
    ]
    shown = dict(COLUMN_RE.findall(columns_block))  # key → header i18n key
    placeholder = PLACEHOLDER_RE.search(src)
    searched = (MANIFEST["queries"][QUERY].get("list") or {}).get("search") or []

    # Check the check: a fixture this thin would pass everything below for the wrong reason.
    if len(shown) < 5 or "status" not in shown or not placeholder or not searched:
        print(
            f"FAIL: parsing went stale — shown={shown} placeholder={placeholder} search={searched}"
        )
        return 1

    for col in searched:
        if col not in shown:
            failures.append(
                f"`{QUERY}` searches `{col}`, which the Comandas table does not show: a row would "
                f"match for no visible reason (kitchen#110)"
            )
    if "label" not in searched:
        failures.append(
            "the destination (`label`, «Mesa 4») is not searched (kitchen#110)"
        )

    for lang in ("en", "es"):
        cat = catalog(lang)
        promise = lookup(cat, placeholder.group(1))
        for col, header_key in shown.items():
            header = lookup(cat, header_key)
            if col not in searched and names(promise, header):
                failures.append(
                    f"[{lang}] the box says «{promise}» — it names «{header}» (`{col}`), which "
                    f"`{QUERY}` does not search (kitchen#110)"
                )
            word = SENTENCE_WORD.get((lang, col), header)
            if col in searched and not names(promise, word):
                failures.append(
                    f"[{lang}] the box says «{promise}» but does not name «{word}» (`{col}`), "
                    f"which it does search"
                )

    if failures:
        print(f"FAIL ({len(failures)}):")
        for f in failures:
            print(f"  - {f}")
        return 1
    print(f"OK: the Comandas box searches {searched} and promises exactly that")
    return 0


if __name__ == "__main__":
    sys.exit(main())
