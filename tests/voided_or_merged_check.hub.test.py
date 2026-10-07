#!/usr/bin/env python3
"""A check that is deleted, or absorbed by another, does not leave its rounds on the KDS for ever —
against the REAL kernel (kitchen#162, KITCHEN-F28).

Before kitchen#162 Cocina heard of a check only when it was charged (`order.completed`). Deleting an
open check (SALES-F18) raised `sales.order.voided` and nobody in the kitchen listened; joining two
tables (SALES-F24) moved the lines into the check that stays and raised nothing at all. Either way
the rounds already fired kept their clock on the screen, kept counting in the «Resumen» and in Caja's
«Comandas sin servir» (`kitchen.orders.display`), and — since the charge only closes the rounds of
the check charged — no charge would ever close them.

What the market does, and what this battery pins:

  1. Deleting an open check cancels its live rounds (Toast voids the ticket on the KDS): Por
     preparar, En preparación and Lista become Canceladas and leave `kitchen.orders.display`. The
     round of ANOTHER open check is still in the queue — a state the cancel moves — so a leak
     between checks would show.
  2. A void that reaches a check already CHARGED changes nothing in the kitchen: `sales.order.void`
     answers fine and raises the event anyway (SALES-F18), so Cocina reads the check's header and
     only cancels when it really is voided. Paying is not a reason to stop cooking (kitchen#145):
     the round still on the stove keeps cooking.
  3. Joining two checks hands the rounds of the absorbed one to the one that stays, numbered after
     its own (they follow their dishes, which moved too), and charging that check closes them like
     its own (kitchen#145: the bumped one is served).
  4. A replayed join moves and stamps nothing.

Usage: `erplora test <dir> --against-hub [dev|stable|sha256:…]` (module-toolkit#110). Never on its
own: without a runtime it fails, it does not skip. Needs a `sales` that raises
`sales.order.merged` (kitchen#162).
"""

import sys
import time
import uuid

import hub_harness
from hub_harness import ONE, Hub, fire, open_order, unique, wait_for_tickets

CANA = {"product_name": "Caña", "price": 250, "quantity": ONE}


def cash_method_id(hub: Hub) -> str:
    rows = hub.query("sales.payment_methods")
    cash = next((r for r in rows if r.get("type") == "cash"), None)
    if cash is None:
        raise AssertionError(
            f"the hub's catalogue must carry the `cash` method: {rows}"
        )
    return cash["id"]


def statuses(hub: Hub, order_id: str) -> dict:
    """`{round_number: status}` of every round hanging from check `order_id`."""
    return {
        t.get("round_number"): t.get("status")
        for t in hub.query("kitchen.orders.list")
        if t.get("source_order_id") == order_id
    }


def wait_for(hub: Hub, order_id: str, want: dict, timeout: float = 10.0) -> dict:
    """The sales events reach kitchen through the outbox relay (~1 s tick), not inside the request:
    polls until the rounds of `order_id` reach `want` and returns the last state seen."""
    deadline = time.monotonic() + timeout
    seen = statuses(hub, order_id)
    while seen != want and time.monotonic() < deadline:
        time.sleep(0.25)
        seen = statuses(hub, order_id)
    return seen


def on_display(hub: Hub, ticket_ids: set) -> set:
    """Which of `ticket_ids` the KDS — and Caja's cash-close review — still paints."""
    return {r.get("order_id") for r in hub.query("kitchen.orders.display")} & ticket_ids


def settle(hub: Hub) -> None:
    """Waits until every event emitted so far reached kitchen: the outbox delivers in creation
    order, so once the round of a probe fired NOW exists, what was emitted before it was handled.
    Without it, «nothing changed» would also be true of an event that had not landed yet."""
    probe = open_order(hub, [CANA])
    fire(hub, probe, label=unique("probe"))
    wait_for_tickets(hub, probe, 1)


def bump(hub: Hub, ticket_id: str) -> None:
    hub.run(
        "kitchen.orders.set_status",
        {"order_id": ticket_id, "action_name": "mark_ready"},
    )


def charge(hub: Hub, cash: str, order_id: str, tendered: int) -> None:
    hub.run(
        "sales.complete_sale",
        {
            "idempotency_key": f"hub-battery-voided-{uuid.uuid4().hex[:8]}",
            "payment_method_id": cash,
            "order_id": order_id,
            "amount_tendered": tendered,
            "tax_included": True,
            "items": [dict(CANA, tax_rate=21.0)],
        },
    )


def test_a_deleted_check_cancels_its_rounds(hub: Hub) -> None:
    print("\n1 · deleting an open check cancels its live rounds (kitchen#162)")
    deleted = open_order(hub, [CANA])
    fire(hub, deleted, label=unique("mesa-deleted"))
    first = wait_for_tickets(hub, deleted, 1)[0]
    bump(hub, first["id"])
    fire(hub, deleted, label=unique("mesa-deleted"))
    tickets = {t["id"] for t in wait_for_tickets(hub, deleted, 2)}
    neighbour = open_order(hub, [CANA])
    fire(hub, neighbour, label=unique("mesa-neighbour"))
    neighbour_ticket = wait_for_tickets(hub, neighbour, 1)[0]
    hub.check(
        "before: both rounds are on the KDS",
        on_display(hub, tickets),
        tickets,
    )

    hub.run("sales.order.void", {"order_id": deleted})
    hub.check(
        "the bumped round and the one in the queue are cancelled",
        wait_for(hub, deleted, {1: "cancelled", 2: "cancelled"}),
        {1: "cancelled", 2: "cancelled"},
    )
    hub.check("they leave the KDS and Caja's review", on_display(hub, tickets), set())
    hub.check(
        "the round of another open check keeps cooking",
        statuses(hub, neighbour),
        {1: "pending"},
    )
    hub.check(
        "and stays on the KDS",
        on_display(hub, {neighbour_ticket["id"]}),
        {neighbour_ticket["id"]},
    )


def test_a_void_after_the_charge_leaves_the_kitchen_alone(hub: Hub, cash: str) -> None:
    print(
        "\n2 · a void that reaches a check already charged changes nothing (kitchen#162)"
    )
    paid = open_order(hub, [CANA])
    fire(hub, paid, label=unique("mesa-paid"))
    wait_for_tickets(hub, paid, 1)
    charge(hub, cash, paid, tendered=250)
    settle(hub)
    hub.check(
        "charged: the round keeps cooking (kitchen#145)",
        statuses(hub, paid),
        {1: "pending"},
    )

    hub.run("sales.order.void", {"order_id": paid})
    settle(hub)
    hub.check(
        "the void of a charged check does not cancel what is cooking",
        statuses(hub, paid),
        {1: "pending"},
    )


def test_a_merged_check_hands_its_rounds(hub: Hub, cash: str) -> None:
    print(
        "\n3 · joining two checks hands the absorbed rounds to the one that stays (kitchen#162)"
    )
    stays = open_order(hub, [CANA])
    fire(hub, stays, label=unique("mesa-4"))
    wait_for_tickets(hub, stays, 1)
    absorbed = open_order(hub, [CANA])
    fire(hub, absorbed, label=unique("mesa-5"))
    absorbed_ticket = wait_for_tickets(hub, absorbed, 1)[0]
    bump(hub, absorbed_ticket["id"])

    hub.run("sales.order.merge", {"from_order_id": absorbed, "to_order_id": stays})
    hub.check(
        "the check that stays holds its round and then the absorbed one",
        wait_for(hub, stays, {1: "pending", 2: "ready"}),
        {1: "pending", 2: "ready"},
    )
    hub.check("nothing hangs from the absorbed check", statuses(hub, absorbed), {})

    print("\n4 · a replayed join moves nothing (kitchen#162)")
    hub.run("sales.order.merge", {"from_order_id": absorbed, "to_order_id": stays})
    settle(hub)
    hub.check(
        "the rounds stay as they were",
        statuses(hub, stays),
        {1: "pending", 2: "ready"},
    )

    charge(hub, cash, stays, tendered=500)
    hub.check(
        "charging the check that stays serves the absorbed round the pass bumped",
        wait_for(hub, stays, {1: "pending", 2: "served"}),
        {1: "pending", 2: "served"},
    )


def main() -> int:
    hub = Hub("voided_or_merged_check.hub")
    print(
        f"Hub battery · deleted or merged check (kitchen#162) · {hub_harness.BASE} · hub {hub.hub_id} · user {hub.user}"
    )
    cash = cash_method_id(hub)
    test_a_deleted_check_cancels_its_rounds(hub)
    test_a_void_after_the_charge_leaves_the_kitchen_alone(hub, cash)
    test_a_merged_check_hands_its_rounds(hub, cash)
    return hub.finish(
        "a deleted check cancels its rounds, a charged one keeps cooking, and a merged check hands "
        "its rounds to the one that stays, against the real kernel"
    )


if __name__ == "__main__":
    sys.exit(main())
