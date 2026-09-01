#!/usr/bin/env python3
"""The chain of attribution of a round, pinned end to end — WHO fired it (kitchen#63).

`kitchen_order.waiter_id` has existed since migration 001, and the manifest already sorted and
filtered by it, but every ticket came back with `waiter_id: null`: the path that actually creates
the rounds (`order.fired`, ADR-0141) built its header from scratch and never filled the column. At
the pass nobody knew who to call when the plate was ready, and a void had nobody to attribute it to.

The FIX itself lives in `handler/src/lib.rs` and is pinned in Rust — but the module gate does not
compile or run the handler (the guest-sdk resolves by path into a hub checkout that CI does not
have), so those tests guard a developer's machine and nothing else. What this battery guards is the
half the gate CAN see, and it is the half a later edit is most likely to break in silence: every
door the waiter has to pass through between the event and the screen. Break any one of them and the
KDS header goes blank again with the whole suite green.

  · the event's schema DECLARES `waiter_id` and stays open (`additionalProperties: true`);
  · the insert BINDS it, so the column lands;
  · the KDS feed and the list queries SELECT it back;
  · the manifest keeps it sortable and filterable.

Usage: tests/the_ticket_says_who_fired_it.contract.test.py   (exit 0 = green)
  No Postgres, no Docker, no hub: it reads the module's own files.
"""

import json
import pathlib
import re
import sys

MODULE_DIR = pathlib.Path(__file__).resolve().parent.parent
MANIFEST = json.loads((MODULE_DIR / "module.json").read_text(encoding="utf-8"))

errors: list[str] = []


def fail(msg: str) -> None:
    errors.append(msg)


def read(rel: str) -> str:
    path = MODULE_DIR / rel
    if not path.exists():
        fail(
            f"{rel}: the file does not exist — the chain of attribution cannot be checked"
        )
        return ""
    return path.read_text(encoding="utf-8")


def mentions_waiter(sql: str) -> bool:
    """`waiter_id` outside SQL comments: a column named only in a `--` line is not selected."""
    live = "\n".join(line.split("--", 1)[0] for line in sql.splitlines())
    return re.search(r"\bwaiter_id\b", live) is not None


def check_event_schema() -> None:
    """`sales` emits `waiter_id` in `order.fired` (sales#179). Two ways to lose it here."""
    rel = MANIFEST["commands"]["kitchen.orders.create_from_order"]["schema"]
    schema = json.loads(read(rel) or "{}")
    props = schema.get("properties") or {}
    if "waiter_id" not in props:
        fail(
            f"{rel}: the payload of `order.fired` carries `waiter_id` (sales#179) and the schema "
            f"does not declare it — undocumented, it is one `additionalProperties: false` away "
            f"from being dropped without a word: {sorted(props)}"
        )
    # And the other way round: the day somebody closes the schema, an undeclared key stops the
    # WHOLE delivery (kitchen#29 — `execute_at` validates the payload against the command's
    # schema, so an extra key does not get ignored, it kills the listener).
    if schema.get("additionalProperties") is not True and "waiter_id" not in props:
        fail(
            f"{rel}: the schema is CLOSED and does not list `waiter_id` — the event that carries "
            f"it would be refused whole, and the kitchen would stop receiving rounds"
        )


def check_the_column_lands() -> None:
    sql = read("commands/_insert_order.sql")
    if sql and ":waiter_id" not in sql:
        fail(
            "commands/_insert_order.sql: the header insert does not bind `:waiter_id` — whatever "
            "the handler resolves never reaches the row"
        )


def check_the_column_comes_back() -> None:
    # The KDS feed is the one that matters most: this is the query behind the ticket header the
    # cook reads, and dropping the column from it blanks the waiter with every test still green.
    for rel, why in (
        (
            "queries/orders_display.sql",
            "the KDS feed — the ticket header the pass reads",
        ),
        ("queries/orders_list.sql", "the list the KDS and the batteries check"),
        ("queries/order_get.sql", "the single ticket's header"),
    ):
        sql = read(rel)
        if sql and not mentions_waiter(sql):
            fail(f"{rel}: does not bring `waiter_id` back ({why})")


def check_the_manifest_still_offers_it() -> None:
    lst = (MANIFEST["queries"]["kitchen.orders.list"] or {}).get("list") or {}
    if "waiter_id" not in (lst.get("sort") or []):
        fail("module.json: `kitchen.orders.list` no longer sorts by `waiter_id`")
    if "waiter_id" not in (lst.get("filters") or {}):
        fail("module.json: `kitchen.orders.list` no longer filters by `waiter_id`")


def check_the_screen_says_it_in_both_languages() -> None:
    """ADR-0055/0199: English is the source, Spanish is always shipped. A KDS header that falls
    back to the key (`ui.firedBy`) is a screen the cook cannot read."""
    for lang in ("en", "es"):
        catalog = json.loads(read(f"locales/{lang}.json") or "{}")
        text = ((catalog.get("ui") or {}).get("firedBy") or "").strip()
        if not text:
            fail(
                f"locales/{lang}.json: `ui.firedBy` is missing — the ticket header has no words in {lang}"
            )
        elif "{name}" not in text:
            fail(
                f"locales/{lang}.json: `ui.firedBy` = {text!r} drops the `{{name}}` placeholder"
            )


def main() -> int:
    check_event_schema()
    check_the_column_lands()
    check_the_column_comes_back()
    check_the_manifest_still_offers_it()
    check_the_screen_says_it_in_both_languages()

    for e in errors:
        print("FAIL:", e)
    print(
        "the round says who fired it, from `order.fired` to the KDS header:",
        "OK" if not errors else f"{len(errors)} error(s)",
    )
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
