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

Only a running hub resolves `reads`, so this is where the chain is proven end to end.

kitchen#145 changed WHAT the charge does to the rounds: paying is not a reason to stop cooking
(Toast, Square, Lightspeed). Only the round the pass already bumped is closed (`served`); a round
still in the queue or on the stove keeps cooking and leaves the KDS when it is served. Every case
below was a cancelled round before kitchen#145:

  1. A table that pays before it finished: the bumped round becomes `served`, the one on the stove
     stays `preparing` and the one fired in the same gesture as the charge stays `pending`. The
     round of ANOTHER table still eating is untouched — two filters stand in the way: the
     manifest's read (`f_source_order_id`) and the handler, which re-checks `source_order_id` on
     every round it is handed. That neighbour's round is bumped (`ready`) before the charge on
     purpose: `ready` is the only state the charge moves, so a round still in the queue would
     stay put with both filters gone and the check would prove nothing. Measured on 06/10 against
     the real kernel: dropping BOTH filters turns it red with `got {1: 'served'}`.
  2. The bar («pide y paga»): the till fires the round and charges at once. The round reaches the
     cook — and, in the other delivery order (the close lands before the round exists), it is born
     in the queue and still leaves the line once it is served.
  3. A split check: charging the original keeps the round whose dishes moved to the new check.

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


def charge(hub: Hub, cash: str, order_id: str) -> None:
    """The full charge of `order_id`, the call the till makes: it emits `order.completed`."""
    hub.run(
        "sales.complete_sale",
        {
            "idempotency_key": f"hub-battery-close-{uuid.uuid4().hex[:8]}",
            "payment_method_id": cash,
            "order_id": order_id,
            "amount_tendered": 250,
            "tax_included": True,
            "items": [dict(CANA, tax_rate=21.0)],
        },
    )


def settle(hub: Hub) -> None:
    """Waits until every event emitted so far reached kitchen: the outbox delivers in creation
    order, so once the round of a probe order fired NOW exists, the `order.completed` emitted
    before it was handled too. Without it, «still pending» would also be true of a close that
    simply had not landed yet."""
    probe = open_order(hub, [CANA])
    fire(hub, probe, label=unique("probe"))
    wait_for_tickets(hub, probe, 1)


def test_a_table_that_pays_early_keeps_what_is_cooking(hub: Hub, cash: str) -> None:
    print("\n1 · a table pays before it finished: only the bumped round leaves (kitchen#145)")
    paid = open_order(hub, [CANA])
    fire(hub, paid, label=unique("mesa-paid"))
    first = wait_for_tickets(hub, paid, 1)[0]
    hub.run(
        "kitchen.orders.set_status",
        {"order_id": first["id"], "action_name": "mark_ready"},
    )
    fire(hub, paid, label=unique("mesa-paid"))
    second = next(
        t for t in wait_for_tickets(hub, paid, 2) if t.get("round_number") == 2
    )
    hub.run(
        "kitchen.orders.set_status", {"order_id": second["id"], "action_name": "fire"}
    )

    eating = open_order(hub, [CANA])
    fire(hub, eating, label=unique("mesa-eating"))
    waiting = wait_for_tickets(hub, eating, 1)[0]
    # Bumped on purpose: the charge only moves `ready` rounds, so this is the state that would
    # leak if one table paying reached the rounds of another.
    hub.run(
        "kitchen.orders.set_status",
        {"order_id": waiting["id"], "action_name": "mark_ready"},
    )

    hub.check(
        "before the charge the two rounds of the paid check are on the line (positive control)",
        statuses(hub, paid),
        {1: "ready", 2: "preparing"},
    )

    # The last round is fired and charged in the same gesture, as the till does.
    fire(hub, paid, label=unique("mesa-paid"))
    charge(hub, cash, paid)

    hub.check(
        "the bumped round is served; the one on the stove and the one just fired keep cooking",
        wait_for(hub, paid, {1: "served", 2: "preparing", 3: "pending"}),
        {1: "served", 2: "preparing", 3: "pending"},
    )
    hub.check(
        "the bumped round of the table still eating is untouched",
        statuses(hub, eating),
        {1: "ready"},
    )


def test_pay_and_go_reaches_the_cook(hub: Hub, cash: str) -> None:
    print("\n2 · the bar fires and charges at once: the round reaches the cook (kitchen#145)")
    bar = open_order(hub, [CANA])
    fire(hub, bar, label=unique("barra"), channel="takeaway")
    charge(hub, cash, bar)
    settle(hub)
    hub.check(
        "the round fired with the charge is still waiting for the cook",
        statuses(hub, bar),
        {1: "pending"},
    )

    print("   · the other delivery order: the close lands before the round exists")
    late = open_order(hub, [CANA])
    hub.run("kitchen.orders.close_from_order", {"order_id": late})
    fire(hub, late, label=unique("barra"), channel="takeaway")
    ticket = wait_for_tickets(hub, late, 1)[0]
    hub.check("the late round is born in the queue", ticket.get("status"), "pending")
    hub.run(
        "kitchen.orders.set_status",
        {"order_id": ticket["id"], "action_name": "mark_ready"},
    )
    hub.run("kitchen.orders.mark_served", {"order_id": ticket["id"]})
    hub.check(
        "and leaves the line when it is served, not never",
        statuses(hub, late),
        {1: "served"},
    )


def test_a_split_check_keeps_the_round_of_the_moved_dishes(hub: Hub, cash: str) -> None:
    print("\n3 · a split check: charging the original keeps the moved dishes cooking (kitchen#145)")
    original = open_order(hub, [CANA, dict(CANA, product_name="Tapa")])
    fire(hub, original, label=unique("mesa-split"))
    wait_for_tickets(hub, original, 1)
    lines = hub.query("sales.order.lines", {"order_id": original})
    moved = [line["id"] for line in lines if line.get("product_name") == "Tapa"]
    hub.check_true("the dish to move is on the check", len(moved) == 1, lines)
    hub.run("sales.order.split", {"order_id": original, "line_ids": moved})

    charge(hub, cash, original)
    settle(hub)
    hub.check(
        "the round with the dishes that moved to the new check is still cooking",
        statuses(hub, original),
        {1: "pending"},
    )


def main() -> int:
    hub = Hub("closed_check.hub")
    print(
        f"Hub battery · closed check (kitchen#79, kitchen#145) · {hub_harness.BASE} · hub {hub.hub_id} · user {hub.user}"
    )
    cash = cash_method_id(hub)
    test_a_table_that_pays_early_keeps_what_is_cooking(hub, cash)
    test_pay_and_go_reaches_the_cook(hub, cash)
    test_a_split_check_keeps_the_round_of_the_moved_dishes(hub, cash)
    return hub.finish(
        "a check charged in full serves its bumped rounds and keeps cooking the rest, and touches "
        "only its own, against the real kernel"
    )


if __name__ == "__main__":
    sys.exit(main())
