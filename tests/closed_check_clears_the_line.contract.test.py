#!/usr/bin/env python3
"""A check that closes takes its rounds off the KDS — the WIRING half (kitchen#61).

The bug: the guest paid, `tables` released the table, and the KDS kept painting «Mesa S1» with the
clock still running, because `kitchen` listened to nothing that says «this check is over».

The seam is `order.completed`, NOT `sale.completed` (ADR-0146, and
`agnostic_of_tables_and_customers.contract.test.py` forbids the payment event outright): `sales`
emits `sale.completed` on EVERY leg of a split bill — the order is still open and the table still
seated — and emits `order.completed` exactly once, when the order is finally closed. `tables`
already hangs its `_session_close_by_order` off that same event; kitchen joins it there.

What this pins is everything the behaviour depends on that lives in the MANIFEST, where the Rust
tests of the handler cannot see it:

  * the route exists and points at the command that implements it;
  * the command PRE-LOADS the rounds it is going to close (`reads`, ADR-0069) — a listener that
    reuses a handler without declaring its reads compiles, passes CI and breaks in production
    (ERPlora/appointments#100), and here it would break MUTE: no rows, no operations, "delivered";
  * the read is FILTERED by this order. Without the filter the read is «every ticket of the hub»
    and one table paying its bill would clear the whole line — the worst possible regression of a
    fix for zombies;
  * the payload schema tolerates the event's extra keys (`sender`). `execute_at` validates the
    relayed payload against the destination command's schema, and an `additionalProperties: false`
    there sends every delivery to the dead-letter without a word (kitchen#29).

Usage: tests/closed_check_clears_the_line.contract.test.py   (exit 0 = green)
  No Postgres, no Docker, no hub: it reads the manifest.
"""

import json
import pathlib
import sys

MODULE_DIR = pathlib.Path(__file__).resolve().parent.parent
MANIFEST = json.loads((MODULE_DIR / "module.json").read_text(encoding="utf-8"))

CLOSER = "kitchen.orders.close_from_order"
ROUNDS_QUERY = "kitchen.orders.list"

errors: list[str] = []


def fail(msg: str) -> None:
    errors.append(msg)


def check_route() -> None:
    listen = (MANIFEST.get("events") or {}).get("listen") or {}
    route = listen.get("order.completed")
    if not route:
        fail(
            "kitchen does not listen to `order.completed`: a paid and closed check leaves its "
            f"rounds live on the KDS forever — listen={sorted(listen)}"
        )
        return
    if route.get("command") != CLOSER:
        fail(f"`order.completed` must route to `{CLOSER}`, it routes to {route!r}")
    if "sale.completed" in listen:
        fail(
            "kitchen must not hang off the payment: `sale.completed` also fires on a PARTIAL leg "
            "of a split bill, where the check is still open and the table still seated"
        )


def check_reads() -> None:
    cmd = (MANIFEST.get("commands") or {}).get(CLOSER)
    if not cmd:
        fail(f"the command `{CLOSER}` is not declared")
        return
    reads = cmd.get("reads") or []
    rounds = next((r for r in reads if r.get("query") == ROUNDS_QUERY), None)
    if not rounds:
        fail(
            f"`{CLOSER}` does not declare a read of `{ROUNDS_QUERY}`: the handler would see no "
            "rounds and report a delivery that changed nothing (appointments#100)"
        )
        return
    if rounds.get("params", {}).get("source_order_id") != "payload.order_id":
        fail(
            f"the read of `{ROUNDS_QUERY}` must be filtered by `source_order_id = "
            f"payload.order_id`; it declares {rounds.get('params')!r} — unfiltered it hands the "
            "handler EVERY ticket of the hub"
        )
    if not rounds.get("required"):
        fail(
            f"the read of `{ROUNDS_QUERY}` must be `required`: a graceful failure here is "
            "indistinguishable from «this check had no rounds» and the zombies stay"
        )
    owner = ROUNDS_QUERY.split(".")[0]
    in_scope = owner == MANIFEST["id"] or owner in (MANIFEST.get("depends_on") or [])
    if not in_scope:
        fail(f"`{ROUNDS_QUERY}` is out of the reads scope of `{MANIFEST['id']}`")


def check_filter_exists() -> None:
    query = (MANIFEST.get("queries") or {}).get(ROUNDS_QUERY) or {}
    filters = (query.get("list") or {}).get("filters") or {}
    if "source_order_id" not in filters:
        fail(
            f"`{ROUNDS_QUERY}` does not declare the `source_order_id` filter, so the read cannot "
            "narrow to one order and would return the whole line"
        )
    elif filters["source_order_id"].get("op") != "eq":
        fail(
            f"`source_order_id` must filter by equality, it declares "
            f"{filters['source_order_id']!r}"
        )


def check_schema() -> None:
    cmd = (MANIFEST.get("commands") or {}).get(CLOSER) or {}
    rel = cmd.get("schema")
    if not rel:
        fail(
            f"`{CLOSER}` declares no schema: the relayed payload would not be validated at all"
        )
        return
    path = MODULE_DIR / rel
    if not path.exists():
        fail(f"the schema of `{CLOSER}` does not exist: {rel}")
        return
    schema = json.loads(path.read_text(encoding="utf-8"))
    if schema.get("additionalProperties") is False:
        fail(
            f"{rel} is `additionalProperties: false`, so the relay would refuse the event's own "
            "`sender` key and every delivery would die in the dead-letter (kitchen#29)"
        )
    if "order_id" not in (schema.get("required") or []):
        fail(f"{rel} must require `order_id`: it is the only thing the event carries")


def main() -> int:
    check_route()
    check_reads()
    check_filter_exists()
    check_schema()

    for e in errors:
        print("FAIL:", e)
    print(
        "a closed check is wired to clear its rounds off the line:",
        "OK" if not errors else f"{len(errors)} error(s)",
    )
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
