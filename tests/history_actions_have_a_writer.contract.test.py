#!/usr/bin/env python3
"""Every action the Historial offers must have someone who writes it (kitchen#43).

The Acción dropdown of `erp-kitchen-history` offered «Recibida» as its FIRST option while no
code path on earth wrote a `received` row: the value only existed inside the payload of
`kitchen.order.created`, which nobody routed to `kitchen.logs.create` — and could not be,
because that payload travels with keys of its own (`total`, `items_count`…) that
`schemas/log_create.json` (`additionalProperties: false`) refuses: the delivery would retry and
die in the dead-letter (kitchen#29). A filter that always returns zero is worse than no filter:
it looks like the Historial is broken.

This gate walks the options the UI ACTUALLY offers (parsed from the source, not listed here) and
requires, for each one, an event that

  1. is emitted by this module (`events.emits` — hub#240/2b: an undeclared event fails the
     command that emits it), and
  2. is routed by `events.listen` to `kitchen.logs.create`, and
  3. carries that action, per the ACTION_WRITERS table below (each row is pinned by a Rust unit
     test in `handler/src/lib.rs`, which knows what the handler really emits).

It also sweeps the other direction — every event this module routes to its OWN log must be a
declared emission — so a listener wired to an event nobody publishes cannot come back.

Usage: tests/history_actions_have_a_writer.contract.test.py   (exit 0 = green)
  No Postgres, no Docker: it reads the manifest, the schema and the Web Component.
"""

import json
import pathlib
import re
import sys

MODULE_DIR = pathlib.Path(__file__).resolve().parent.parent
MANIFEST = json.loads((MODULE_DIR / "module.json").read_text(encoding="utf-8"))
LOG_SCHEMA = json.loads((MODULE_DIR / "schemas/log_create.json").read_text(encoding="utf-8"))
HISTORY_TS = (MODULE_DIR / "ui/components/erp-kitchen-history/erp-kitchen-history.ts").read_text(
    encoding="utf-8"
)

LOG_QUERY = "kitchen.logs.list"

#: action → the event whose delivery to kitchen.logs.create writes that action. Every row is
#: pinned on the emitting side by a Rust unit test (`handler/src/lib.rs`), which knows the real
#: payload; this table is the ROUTING half of the same contract.
ACTION_WRITERS = {
    "received": "kitchen.order.received",  # kitchen#43 — the twin of created, log-shaped
    "started": "kitchen.order.fired",
    "bumped": "kitchen.order.ready",
    "item_bumped": "kitchen.item.bumped",
    "item_recalled": "kitchen.item.recalled",
    "item_voided": "kitchen.item.voided",  # kitchen#161 — the till voided a fired line
    "served": "kitchen.order.served",
    "recalled": "kitchen.order.recalled",
    "cancelled": "kitchen.order.cancelled",
}

failures: list[str] = []


def fail(msg: str) -> None:
    failures.append(msg)


def offered_actions() -> list[tuple[str, str]]:
    """(value, label key) of every option of the Acción dropdown, in the order the UI offers them.

    Reads whichever shape the source uses: the literal `options: [{ value, label }, …]` list, or
    the single ACTION_LABEL_KEY map the cells and the dropdown share since kitchen#44 (one map,
    not two that drift). If neither is found the parser has rotted and the test says so instead of
    passing vacuously.
    """
    src = HISTORY_TS
    if "ACTION_LABEL_KEY" in src:
        block = src[src.index("ACTION_LABEL_KEY") : src.index("}", src.index("ACTION_LABEL_KEY"))]
        return re.findall(r"(\w+):\s*'(ui\.action\w+)'", block)
    start = src.index("key: 'action'")
    end = src.index("{ key: 'order", start)
    return re.findall(r"\{\s*value:\s*'([a-z_]+)',\s*label:\s*t\('([a-zA-Z.]+)'\)\s*\}", src[start:end])


def main() -> int:
    emits = set(MANIFEST["events"]["emits"])
    listen = MANIFEST["events"]["listen"]
    log_writers = {
        event for event, route in listen.items() if route.get("command") == "kitchen.logs.create"
    }

    actions = offered_actions()
    if not actions:
        fail("no options found for the Acción column of erp-kitchen-history.ts — the parser rotted")

    # Every enum value the log schema accepts but nobody writes. They are legitimate for API
    # callers; they only become a LIE when the UI offers them as a filter.
    written = set(ACTION_WRITERS)
    enum = set(LOG_SCHEMA["properties"]["action"]["enum"])
    dead = enum - written
    offered = {value for value, _ in actions}
    for value in sorted(offered & dead):
        fail(
            f"the UI offers the action '{value}' but ACTION_WRITERS has no producer for it: "
            "either route an event that writes it or take it out of the dropdown"
        )

    for value, label_key in actions:
        writer = ACTION_WRITERS.get(value)
        if writer is None:
            fail(f"action '{value}' ({label_key}) has no entry in ACTION_WRITERS")
            continue
        if writer not in emits:
            fail(
                f"action '{value}' is written by '{writer}', but the manifest does not declare it "
                "in events.emits — hub#240/2b: an undeclared event fails the command that emits it"
            )
        if writer not in log_writers:
            fail(
                f"action '{value}' is written by '{writer}', but events.listen does not route it "
                "to kitchen.logs.create — the row never lands (kitchen#43)"
            )

    # The sweep in the other direction: nothing may listen to a kitchen event this module
    # never emits (a routing that can only produce silence).
    for event in sorted(log_writers):
        if event.startswith("kitchen.") and event not in emits:
            fail(
                f"events.listen routes '{event}' to kitchen.logs.create, but events.emits does not "
                "declare it: nobody publishes it"
            )

    # The payload contract: only the schema's own keys ever reach the listener. The key set
    # itself is pinned in Rust (`LOG_CREATE_KEYS`); here the schema side — the moment someone
    # widens or renames a property, the Rust test and this reminder face each other.
    declared = set(LOG_SCHEMA["properties"])
    if declared != {"order_id", "order_item_id", "station_id", "action", "performed_by_id", "notes"}:
        fail(
            "schemas/log_create.json changed its properties — the events routed to the log carry "
            "exactly the previous set (see LOG_CREATE_KEYS in handler/src/lib.rs): align both or "
            "the delivery dies in the dead-letter"
        )

    if failures:
        for msg in failures:
            print(f"✗ {msg}")
        print(f"\nFAILED ({len(failures)}): the Historial offers filters nobody writes.")
        return 1

    print(
        f"OK: each of the {len(actions)} actions the Historial offers is written by a declared, "
        "routed event (kitchen.logs.create)"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
