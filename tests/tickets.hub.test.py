#!/usr/bin/env python3
"""The ticket is born from the ORDER, not the sale — against the REAL kernel. Ported from the
hub's `kitchen_e2e.rs` (ERPlora/hub#1264, contract «El Hub se CIERRA como KERNEL» §5: the module
proves its own behaviour; the hub keeps only the conformance of its fixture).

Before: `kitchen` listened to `sale.completed`. In a restaurant that sends the food to the kitchen
at CHECKOUT, which is the end of the service — the ticket has to fire when the waiter TAKES the
order, and an order can sit open for an hour before any sale exists. The contract these tests pin:
`sales` emits `order.fired` with an `order_id`, an OPAQUE label (a string kitchen prints verbatim —
"Table 4", "Bar", "Pickup Ana") and a channel (`dine_in|takeaway|delivery`); kitchen never learns
what a table or a customer is, so the label stays opaque on purpose.

`kitchen.orders.create_from_order` is a Tier 2 (WASM) handler reached only through the listener
`sales.order.fire` emits into, so the only place its promises can be checked is a running hub:

  1. Firing an order creates ONE ticket, hanging off the order (`source_order_id`), carrying the
     opaque label verbatim — and NO sale exists yet: the food leaves long before anyone pays.
  2. Every fire of the SAME order is a new ROUND, never a duplicate — the drinks go first, the food
     twenty minutes later, and the kitchen sees round 1 and round 2 of the same table.
  3. A fractional quantity (half a portion) survives as the same fixed-point integer everywhere:
     `sales_order_item.quantity` is REAL (half a kilo of shrimp is a real quantity in a bar), and
     kitchen used to store it in an INTEGER column, truncating `0.5` to `0` — the cook saw "0 ×
     Shrimp" (kitchen#5). The delta-based re-send would then never converge, either.
  4. The ticket's header carries what has to be printed: the label (an orphaned destination is
     exactly what ADR-0144 came to fix), the round number, and an order number the paper is
     identified by.
  5. A round that fires without a label inherits the order's own — the waiter fires the drinks with
     "Table 4", then resumes the order later from a different tablet where the label was never
     reloaded; the second ticket must not go out blank.

Usage: `erplora test <dir> --against-hub [dev|stable|sha256:…]` (module-toolkit#110). Never on its
own: without a runtime it fails, it does not skip.
"""

import sys

import hub_harness
from hub_harness import (
    ONE,
    Hub,
    fire,
    open_order,
    the_one_ticket,
    unique,
    wait_for_tickets,
)


def test_firing_creates_one_ticket_with_no_sale_needed(hub: Hub) -> None:
    print("\n1 · firing an order creates ONE ticket, hanging off it — no sale needed")
    oid = open_order(
        hub, [{"product_name": "Croquetas", "price": 350, "quantity": 2 * ONE}]
    )
    label = unique("mesa")
    fire(hub, oid, label=label)

    ticket = the_one_ticket(hub, oid)
    hub.check("the ticket hangs off the order", ticket.get("source_order_id"), oid)
    hub.check(
        "the label travels opaque and prints verbatim", ticket.get("label"), label
    )
    hub.check("the channel", ticket.get("order_type"), "dine_in")

    sales = [s for s in hub.query("sales.list") if s.get("id") not in (None, "")]
    hub.check_true(
        "no sale is required to fire a ticket — this order never checked out",
        not any(s.get("order_id") == oid for s in sales),
        str([s.get("id") for s in sales]),
    )


def test_every_fire_of_the_same_order_is_a_new_round(hub: Hub) -> None:
    print("\n2 · each fire of the SAME order is a round, never a duplicate")
    oid = open_order(
        hub, [{"product_name": "Cañas", "price": 250, "quantity": 2 * ONE}]
    )
    label = unique("mesa")

    # Drinks first, food twenty minutes later: two fires of the SAME order.
    fire(hub, oid, label=label)
    fire(hub, oid, label=label)

    tickets = wait_for_tickets(hub, oid, 2)
    rounds = [c.get("round_number") for c in tickets]
    hub.check("two fires, two tickets", len(rounds), 2)
    hub.check("rounds numbered per order", sorted(rounds), [1, 2])


def test_a_fractional_quantity_survives_as_the_same_fixed_point_integer(
    hub: Hub,
) -> None:
    print(
        "\n3 · half a portion reaches the kitchen as 500000, never 0 or 1000000 (kitchen#5)"
    )
    oid = open_order(
        hub, [{"product_name": "Gambas", "price": 2400, "quantity": ONE // 2}]
    )
    fire(hub, oid)

    ticket = the_one_ticket(hub, oid)
    items = hub.query("kitchen.orders.items", {"order_id": ticket["id"]})
    hub.check("the line reaches the kitchen", len(items), 1)
    hub.check(
        "half a portion is 500000 µ — not 0 (as-i64 of 0.5) nor 1000000",
        items[0].get("quantity"),
        ONE // 2,
    )


def test_the_ticket_header_carries_what_gets_printed(hub: Hub) -> None:
    print(
        "\n4 · the header carries the label, the round and an order number — or the paper is orphaned"
    )
    oid = open_order(
        hub, [{"product_name": "Croquetas", "price": 350, "quantity": 2 * ONE}]
    )
    label = unique("mesa")
    fire(hub, oid, label=label)

    ticket = the_one_ticket(hub, oid)
    header = hub.query("kitchen.orders.get", {"order_id": ticket["id"]})
    hub.check("the header exists", len(header), 1)
    h = header[0] if header else {}
    hub.check("without a label the ticket prints orphaned", h.get("label"), label)
    hub.check(
        "the round travels on the paper: is it the 1st or the 3rd?",
        h.get("round_number"),
        1,
    )
    hub.check_true(
        "the ticket is identified by an order number",
        bool(h.get("order_number")),
        str(h.get("order_number")),
    )


def test_a_round_without_a_label_inherits_the_orders(hub: Hub) -> None:
    print("\n5 · a round fired without a label inherits the order's own — never blank")
    oid = open_order(
        hub, [{"product_name": "Cañas", "price": 250, "quantity": 2 * ONE}]
    )
    label = unique("mesa")

    fire(hub, oid, label=label)
    fire(hub, oid, label="")

    tickets = wait_for_tickets(hub, oid, 2)
    labels = [c.get("label") for c in tickets]
    hub.check("two rounds of the same order", len(labels), 2)
    hub.check_true(
        "every round of the order carries the SAME table, none blank",
        all(l == label for l in labels),
        str(labels),
    )


def main() -> int:
    hub = Hub("tickets.hub")
    print(
        f"Hub battery · tickets (hub#1264 ← kitchen_e2e.rs) · {hub_harness.BASE} · hub {hub.hub_id} · user {hub.user}"
    )
    test_firing_creates_one_ticket_with_no_sale_needed(hub)
    test_every_fire_of_the_same_order_is_a_new_round(hub)
    test_a_fractional_quantity_survives_as_the_same_fixed_point_integer(hub)
    test_the_ticket_header_carries_what_gets_printed(hub)
    test_a_round_without_a_label_inherits_the_orders(hub)
    return hub.finish(
        "a ticket is born from the order, survives its fractions and keeps its label, against the real kernel"
    )


if __name__ == "__main__":
    sys.exit(main())
