#!/usr/bin/env python3
"""Charging a check in full takes its rounds off the KDS — against the REAL kernel (kitchen#79).

`kitchen#61` wired `order.completed` → `kitchen.orders.close_from_order`, and both of its halves
were green: the contract test read the manifest, the Postgres battery applied what the handler
emits. Neither ran the READ the command declares, and that read was the broken link — it passed
`source_order_id` to `kitchen.orders.list`, a LIST query whose filters travel as `f_<column>`. The
runtime refuses an unprefixed name it does not know (it would return the whole line as if it had
filtered), the `required` read aborts the command with `read_unavailable`, and every `order.completed`
ended in the dead-letter after 7 attempts while the rounds of a paid table kept cooking on the KDS
(banco-pre, 09/09 and 13/09).

Only a running hub resolves `reads`, so this is where the chain is proven end to end:

  1. The full charge of an order (`sales.complete_sale` with its `order_id`) reaches kitchen: the
     round the pass already bumped becomes `served`, the one still in the queue becomes
     `cancelled` — both leave the line.
  2. The round of ANOTHER table that is still eating is untouched. This is the half an unfiltered
     read would break (one table paying would clear the whole line), and the positive control that
     the filter actually filters.

Usage: `erplora test <dir> --against-hub [dev|stable|sha256:…]` (module-toolkit#110). Never on its
own: without a runtime it fails, it does not skip.
"""

import sys
import time
import uuid

import hub_harness
from hub_harness import ONE, Hub, fire, open_order, unique, wait_for_tickets

CANA = {"product_name": "Caña", "price": 250, "quantity": ONE}


def cash_method_id(hub: Hub) -> str:
    """Id of the CASH method from the hub's seeded catalogue, through the public query."""
    rows = hub.query("sales.payment_methods")
    cash = next((r for r in rows if r.get("type") == "cash"), None)
    if cash is None:
        raise AssertionError(
            f"the hub's catalogue must carry the `cash` method: {rows}"
        )
    return cash["id"]


def statuses(hub: Hub, order_id: str) -> dict:
    """`{round_number: status}` of every ticket `order_id` fired."""
    return {
        t.get("round_number"): t.get("status")
        for t in hub.query("kitchen.orders.list")
        if t.get("source_order_id") == order_id
    }


def wait_for(hub: Hub, order_id: str, want: dict, timeout: float = 10.0) -> dict:
    """Polls until the rounds of `order_id` reach `want` — `order.completed` reaches kitchen through
    the outbox relay (~1 s tick), not inside the request that charged the check. Returns the last
    state seen so the caller's `check()` names the mismatch instead of a bare timeout."""
    deadline = time.monotonic() + timeout
    seen = statuses(hub, order_id)
    while seen != want and time.monotonic() < deadline:
        time.sleep(0.25)
        seen = statuses(hub, order_id)
    return seen


def test_charging_the_check_in_full_clears_its_rounds(hub: Hub, cash: str) -> None:
    print("\n1 · charging the check in FULL takes its rounds off the line (kitchen#79)")
    paid = open_order(hub, [CANA])
    fire(hub, paid, label=unique("mesa-paid"))
    first = wait_for_tickets(hub, paid, 1)[0]
    hub.run(
        "kitchen.orders.set_status",
        {"order_id": first["id"], "action_name": "mark_ready"},
    )
    fire(hub, paid, label=unique("mesa-paid"))
    wait_for_tickets(hub, paid, 2)

    eating = open_order(hub, [CANA])
    fire(hub, eating, label=unique("mesa-eating"))
    wait_for_tickets(hub, eating, 1)

    hub.check(
        "before the charge both rounds of the paid check are on the line (positive control)",
        statuses(hub, paid),
        {1: "ready", 2: "pending"},
    )

    hub.run(
        "sales.complete_sale",
        {
            "idempotency_key": f"hub-battery-close-{uuid.uuid4().hex[:8]}",
            "payment_method_id": cash,
            "order_id": paid,
            "amount_tendered": 250,
            "tax_included": True,
            "items": [dict(CANA, tax_rate=21.0)],
        },
    )

    hub.check(
        "the bumped round is served and the queued one cancelled: both leave the KDS",
        wait_for(hub, paid, {1: "served", 2: "cancelled"}),
        {1: "served", 2: "cancelled"},
    )
    hub.check(
        "the round of the table still eating is untouched",
        statuses(hub, eating),
        {1: "pending"},
    )


def main() -> int:
    hub = Hub("closed_check.hub")
    print(
        f"Hub battery · closed check (kitchen#79) · {hub_harness.BASE} · hub {hub.hub_id} · user {hub.user}"
    )
    test_charging_the_check_in_full_clears_its_rounds(hub, cash_method_id(hub))
    return hub.finish(
        "a check charged in full takes its own rounds off the line, and only its own, against the "
        "real kernel"
    )


if __name__ == "__main__":
    sys.exit(main())
