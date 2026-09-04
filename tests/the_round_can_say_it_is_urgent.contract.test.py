#!/usr/bin/env python3
"""The chain that lets a round go out URGENT, pinned end to end (hub#1411).

`kitchen_order.priority` has existed since migration 001 and the KDS already sorts and filters by
it, but the path that actually creates the rounds (`order.fired`, ADR-0141) wrote `"normal"`
hard-coded: no matter what the till sent, no check could ever come out urgent. The fix reads the
word off the fire and degrades an unknown one to `normal`.

The fix itself lives in `handler/src/lib.rs` and is pinned in Rust — but **the module gate never
compiles the handler** (`erplora-guest-sdk` resolves by path into a hub checkout CI does not have;
`erplora validate` says so out loud: "handler WASM SIN VERIFICAR"). Those Rust tests guard a
developer's machine and nothing else. What this battery guards is the half the gate CAN see, and
it is the half a later edit breaks in silence:

  · the event's schema DECLARES `priority` and stays OPEN, and grows no `enum`;
  · the insert BINDS it, so the column lands;
  · the KDS feed and the list queries SELECT it back;
  · the manifest keeps it sortable and filterable;
  · the vocabulary stays `normal`/`rush`/`vip` in lowercase in all four places that spell it out;
  · the button has words in both languages.

Usage: tests/the_round_can_say_it_is_urgent.contract.test.py   (exit 0 = green)
  No Postgres, no Docker, no hub: it reads the module's own files.
"""

import json
import pathlib
import re
import sys

MODULE_DIR = pathlib.Path(__file__).resolve().parent.parent
MANIFEST = json.loads((MODULE_DIR / "module.json").read_text(encoding="utf-8"))

# kitchen#39: the vocabulary is a DATA contract — lowercase, and these three words. It is written
# out in four places CI can reach; they have to agree or the KDS filters on words nobody writes.
VOCABULARY = ["normal", "rush", "vip"]

errors: list[str] = []


def fail(msg: str) -> None:
    errors.append(msg)


def read(rel: str) -> str:
    path = MODULE_DIR / rel
    if not path.exists():
        fail(f"{rel}: the file does not exist — the urgent chain cannot be checked")
        return ""
    return path.read_text(encoding="utf-8")


def mentions_priority(sql: str) -> bool:
    """`priority` outside SQL comments: a column named only in a `--` line is not selected."""
    live = "\n".join(line.split("--", 1)[0] for line in sql.splitlines())
    return re.search(r"\bpriority\b", live) is not None


def check_event_schema() -> None:
    """The door the word comes through. Two ways to lose it, and they fail in opposite directions."""
    rel = MANIFEST["commands"]["kitchen.orders.create_from_order"]["schema"]
    schema = json.loads(read(rel) or "{}")
    props = schema.get("properties") or {}

    if "priority" not in props:
        fail(
            f"{rel}: the payload of `order.fired` carries `priority` (hub#1411 <- sales#258) and "
            f"the schema does not declare it — undocumented, it is one `additionalProperties: "
            f"false` away from being dropped without a word: {sorted(props)}"
        )

    if schema.get("additionalProperties") is not True:
        fail(
            f"{rel}: the schema is CLOSED. `execute_at` validates the payload against the "
            f"command's schema BEFORE the handler (kitchen#29), so any key it does not list stops "
            f"the WHOLE delivery — the kitchen would stop receiving rounds, not just lose a field"
        )

    # The trap this battery exists for. `order_create.json` (the direct command) IS closed and DOES
    # enumerate, so sooner or later somebody "harmonises" the two. They are different doors: that
    # one has a known caller (our UI) and can refuse a bad word; this one is fed by an EVENT whose
    # emitters kitchen does not control. An `enum` here does not tighten anything — it converts
    # `create_order_from_order`'s degrade-to-`normal` into a round that never gets cooked. And the
    # Rust test that pins the degrade exercises the PURE FUNCTION: it would stay green throughout.
    if "enum" in (props.get("priority") or {}):
        fail(
            f"{rel}: `priority` has grown an `enum`. The handler degrades an unknown word to "
            f"`normal` on purpose (kitchen#54's ladder); enumerating it here refuses the payload "
            f"one layer ABOVE the handler, so the round is lost instead of cooked as normal"
        )


def check_the_column_lands() -> None:
    sql = read("commands/_insert_order.sql")
    if sql and ":priority" not in sql:
        fail(
            "commands/_insert_order.sql: the header insert does not bind `:priority` — whatever "
            "the handler resolves never reaches the row"
        )


def check_the_column_comes_back() -> None:
    for rel, why in (
        ("queries/orders_display.sql", "the KDS feed — the ticket header the pass reads"),
        ("queries/orders_list.sql", "the list the KDS and the batteries check"),
        ("queries/order_get.sql", "the single ticket's header, which the paper is rendered from"),
    ):
        sql = read(rel)
        if sql and not mentions_priority(sql):
            fail(f"{rel}: does not bring `priority` back ({why})")


def check_the_manifest_still_offers_it() -> None:
    lst = (MANIFEST["queries"]["kitchen.orders.list"] or {}).get("list") or {}
    if "priority" not in (lst.get("sort") or []):
        fail("module.json: `kitchen.orders.list` no longer sorts by `priority`")
    if "priority" not in (lst.get("filters") or {}):
        fail("module.json: `kitchen.orders.list` no longer filters by `priority`")


def check_the_vocabulary_does_not_move() -> None:
    """kitchen#39. Four copies spell these words out; CI can read all four, so it should."""
    # 1. The strict sibling schema: the only place the vocabulary is enumerated as data.
    strict = json.loads(read("schemas/order_create.json") or "{}")
    enum = ((strict.get("properties") or {}).get("priority") or {}).get("enum")
    if enum != VOCABULARY:
        fail(
            f"schemas/order_create.json: `priority.enum` = {enum!r}, expected {VOCABULARY!r} — "
            f"the KDS filters and sorts by this column and the paper keys off `rush`"
        )

    # 2. The Rust constant. CI never compiles the handler, so reading it as TEXT is the only guard
    #    there is: a reorder or a rename here silently stops matching everything else.
    rust = read("handler/src/lib.rs")
    m = re.search(r'const PRIORITIES:\s*\[&str;\s*3\]\s*=\s*\[([^\]]*)\]', rust)
    if not m:
        fail("handler/src/lib.rs: `PRIORITIES` is gone or reshaped — the ladder cannot be checked")
    else:
        words = re.findall(r'"([^"]+)"', m.group(1))
        if words != VOCABULARY:
            fail(f"handler/src/lib.rs: `PRIORITIES` = {words!r}, expected {VOCABULARY!r}")

    # 3. The UI's label map: one entry per word, or the KDS shows a raw key.
    labels = re.findall(r'^\s*(\w+):\s*.ui\.priority_\w+.', read("ui/lib/enums.ts"), re.M)
    if sorted(labels) != sorted(VOCABULARY):
        fail(f"ui/lib/enums.ts: `PRIORITY_KEY` covers {sorted(labels)!r}, expected {VOCABULARY!r}")

    # 4. The word the fire button actually puts on the wire. `rush` is what the shell maps to the
    #    paper's `HIGH`; anything else and the flame is decoration.
    filler = read("ui/components/erp-kitchen-pos-fire/erp-kitchen-pos-fire.ts")
    fired = set(re.findall(r"priority:\s*'([^']+)'", filler))
    if not fired:
        fail("erp-kitchen-pos-fire.ts: the fire no longer carries a `priority` at all")
    elif not fired <= set(VOCABULARY):
        fail(
            f"erp-kitchen-pos-fire.ts: fires {sorted(fired)!r}, a word outside the vocabulary — "
            f"the handler would degrade it to `normal` and the flame would do nothing"
        )


def check_the_button_says_it_in_both_languages() -> None:
    """ADR-0055/0199: English is the source, Spanish is always shipped. A button that falls back
    to its key (`ui.fireUrgent`) is a button the waiter cannot read."""
    for lang in ("en", "es"):
        catalog = json.loads(read(f"locales/{lang}.json") or "{}")
        for key in ("fireUrgent", "markUrgent"):
            if not ((catalog.get("ui") or {}).get(key) or "").strip():
                fail(f"locales/{lang}.json: `ui.{key}` is missing — the urgent button has no words in {lang}")


def main() -> int:
    check_event_schema()
    check_the_column_lands()
    check_the_column_comes_back()
    check_the_manifest_still_offers_it()
    check_the_vocabulary_does_not_move()
    check_the_button_says_it_in_both_languages()

    for e in errors:
        print("FAIL:", e)
    print(
        "the round can say it is urgent, from `order.fired` to the paper:",
        "OK" if not errors else f"{len(errors)} error(s)",
    )
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
