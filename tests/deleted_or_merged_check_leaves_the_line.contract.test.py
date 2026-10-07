#!/usr/bin/env python3
"""A deleted check cancels its rounds; a merged one hands them over — the WIRING half (kitchen#162).

The bug: a check the till deletes (SALES-F18) or one absorbed when two tables merge (SALES-F24) is
never charged, and charging is the only thing that ever took rounds off the KDS (KITCHEN-F27). Its
rounds stayed on the line for ever and turned up as «not served» in the cash close (KITCHEN-F31).

The Rust tests of the handler prove what it decides from its inputs; what this pins is everything
the behaviour depends on that lives in the MANIFEST, where those tests cannot see it:

  * both events are routed, each to the listener that implements it — swapping them would cancel
    the food of two tables that just merged;
  * each listener points at its own handler export;
  * each PRE-LOADS the check's header from `sales` (`reads` of `sales.order.get`) by the right key.
    Both events can announce something that did not happen (a void of a check already charged, a
    refused merge): the header is the only thing that tells. A listener without the read never
    acts (the handler refuses a missing read), and one keyed by the wrong field reads the wrong
    check — for the merge, the check that stays is open, so the rounds would never move;
  * the void listener pre-loads the rounds FILTERED by the deleted check (`f_source_order_id`):
    unfiltered it would hand the handler every ticket of the hub;
  * the reads are `required`: a read that fails gracefully looks like «no such check» and the
    zombies stay;
  * the payload schemas tolerate the event's extra keys (`sender`, kitchen#29);
  * `kitchen._repoint_source_order`, the merge's intention, exists.

Usage: tests/deleted_or_merged_check_leaves_the_line.contract.test.py   (exit 0 = green)
  No Postgres, no Docker, no hub: it reads the manifest.
"""

import json
import pathlib
import re
import sys

MODULE_DIR = pathlib.Path(__file__).resolve().parent.parent
MANIFEST = json.loads((MODULE_DIR / "module.json").read_text(encoding="utf-8"))

VOIDED = (
    "sales.order.voided",
    "kitchen._on_sales_order_voided",
    "cancel_orders_from_voided_order",
)
MERGED = (
    "sales.order.merged",
    "kitchen._on_sales_order_merged",
    "repoint_orders_from_merged_order",
)
HEADER_QUERY = "sales.order.get"
ROUNDS_QUERY = "kitchen.orders.list"
REPOINT = "kitchen._repoint_source_order"
ENGINE_BINDS = {"limit", "offset", "search", "sort", "dir"}

errors: list[str] = []


def fail(msg: str) -> None:
    errors.append(msg)


def read_of(cmd: dict, query: str):
    return next((r for r in cmd.get("reads") or [] if r.get("query") == query), None)


def list_vocabulary(query_name: str) -> set[str]:
    """What the list engine accepts for `query_name` (same rule as
    closed_check_clears_the_line.contract.test.py)."""
    query = (MANIFEST.get("queries") or {}).get(query_name) or {}
    accepted = set(ENGINE_BINDS)
    for col, spec in ((query.get("list") or {}).get("filters") or {}).items():
        if spec.get("op") == "range":
            accepted.update({f"f_{col}_from", f"f_{col}_to"})
        else:
            accepted.add(f"f_{col}")
    sql = (
        (MODULE_DIR / query["sql"]).read_text(encoding="utf-8")
        if query.get("sql")
        else ""
    )
    sql = re.sub(r"--[^\n]*", "", sql)
    sql = re.sub(r"'(?:[^']|'')*'", "''", sql)
    accepted.update(re.findall(r"(?<!:):([a-zA-Z_][a-zA-Z0-9_]*)", sql))
    return accepted


def check_listener(
    event: str, command: str, export: str, header_key: str, required_keys: list
):
    listen = (MANIFEST.get("events") or {}).get("listen") or {}
    route = listen.get(event)
    if not route:
        fail(
            f"kitchen does not listen to `{event}`: those rounds stay on the KDS for ever"
        )
        return None
    if route.get("command") != command:
        fail(f"`{event}` must route to `{command}`, it routes to {route!r}")
    cmd = (MANIFEST.get("commands") or {}).get(command)
    if not cmd:
        fail(f"the listener `{command}` is not declared")
        return None
    handler = cmd.get("handler") or {}
    if handler.get("function") != export:
        fail(
            f"`{command}` must run the handler export `{export}`, it declares {handler!r}"
        )
    declared = {
        p if isinstance(p, str) else p.get("codename")
        for p in MANIFEST.get("permissions", [])
    }
    if cmd.get("permission") not in declared:
        fail(
            f"`{command}` declares a permission the module does not: {cmd.get('permission')!r}"
        )

    header = read_of(cmd, HEADER_QUERY)
    if not header:
        fail(
            f"`{command}` does not read `{HEADER_QUERY}`: it cannot tell a real void/merge from "
            "one that did not happen, and the handler refuses to act without it"
        )
    else:
        if header.get("params") != {"order_id": header_key}:
            fail(
                f"the read of `{HEADER_QUERY}` in `{command}` must be keyed by "
                f"`order_id = {header_key}`; it declares {header.get('params')!r}"
            )
        if not header.get("required"):
            fail(f"the read of `{HEADER_QUERY}` in `{command}` must be `required`")
    if HEADER_QUERY.split(".")[0] not in (MANIFEST.get("depends_on") or []):
        fail(
            f"`{HEADER_QUERY}` is out of the reads scope: kitchen must depend on `sales`"
        )

    rel = cmd.get("schema")
    if not rel or not (MODULE_DIR / rel).exists():
        fail(f"`{command}` declares no schema (or it does not exist): {rel!r}")
    else:
        schema = json.loads((MODULE_DIR / rel).read_text(encoding="utf-8"))
        if schema.get("additionalProperties") is False:
            fail(
                f"{rel} is `additionalProperties: false`: the relay's `sender` key would send "
                "every delivery to the dead-letter (kitchen#29)"
            )
        missing = [k for k in required_keys if k not in (schema.get("required") or [])]
        if missing:
            fail(f"{rel} must require {missing}")
    return cmd


def check_void_rounds(cmd: dict) -> None:
    rounds = read_of(cmd, ROUNDS_QUERY)
    if not rounds:
        fail(f"`{VOIDED[1]}` does not read `{ROUNDS_QUERY}`: it would cancel nothing")
        return
    if rounds.get("params", {}).get("f_source_order_id") != "payload.order_id":
        fail(
            f"the read of `{ROUNDS_QUERY}` must be filtered by `f_source_order_id = "
            f"payload.order_id`; it declares {rounds.get('params')!r}"
        )
    accepted = list_vocabulary(ROUNDS_QUERY)
    for param in rounds.get("params") or {}:
        if param not in accepted:
            fail(
                f"the read of `{ROUNDS_QUERY}` passes `{param}`, which the list does not accept"
            )
    if not rounds.get("required"):
        fail(f"the read of `{ROUNDS_QUERY}` in `{VOIDED[1]}` must be `required`")


def check_repoint() -> None:
    cmd = (MANIFEST.get("commands") or {}).get(REPOINT)
    if not cmd or not cmd.get("sql"):
        fail(f"`{REPOINT}` (the merge's intention) is not declared with its SQL")


def main() -> int:
    voided = check_listener(*VOIDED, "payload.order_id", ["order_id"])
    if voided:
        check_void_rounds(voided)
    check_listener(*MERGED, "payload.from_order_id", ["from_order_id", "to_order_id"])
    check_repoint()

    for e in errors:
        print("FAIL:", e)
    print(
        "a deleted or merged check is wired to leave the line:",
        "OK" if not errors else f"{len(errors)} error(s)",
    )
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
