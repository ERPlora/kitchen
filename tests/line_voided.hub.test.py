#!/usr/bin/env python3
"""A dish the till voids after sending it is struck on the KDS and is not cooked — against the REAL
kernel (kitchen#161, KITCHEN-F29).

Before kitchen#161 the till already voided a line sent to the kitchen (SALES-F20:
`sales.order.void_line`, with a reason and a manager's PIN) and announced `sales.order.line_voided`,
but nobody in the kitchen listened: the croquetas left the check and stayed «Por preparar» on the
screen, in the «Resumen» and in the station's count, and were cooked if nobody shouted.

What the market does (Toast, TouchBistro, LS Central, Odoo strike the voided item on the ticket) and
what this battery pins:

  1. Voiding one dish of a round strikes it on the KDS (`voided`, with the till's reason) and leaves
     the other dish of the round cooking; the round keeps its state. The same dish fired from
     ANOTHER open check is untouched. The «Resumen» stops counting it and the kitchen log says so.
  2. Voiding the last dish still to serve cancels the round (the same `kitchen.order.cancelled` the
     hub prints the VOID slip from, kitchen#168): it leaves the KDS.
  3. Voiding the only dish still cooking when the rest is ready sends the round to the pass.

Usage: `erplora test <dir> --against-hub [dev|stable|sha256:…]` (module-toolkit#110). Never on its
own: without a runtime it fails, it does not skip. Needs a `sales` with `sales.order.void_line`
(sales#521).
"""

import sys
import time

import hub_harness
from hub_harness import ONE, Hub, open_order, unique, wait_for_tickets

CROQUETAS = {"product_name": "Croquetas", "price": 800, "quantity": ONE}
CANA = {"product_name": "Caña", "price": 250, "quantity": ONE}
REASON = "Wrong table"


def lines(hub: Hub, ticket_id: str) -> dict:
    """`{product_name: (status, void_reason)}` of one ticket, as the ticket's lines read them."""
    return {
        r.get("product_name"): (r.get("status"), r.get("void_reason"))
        for r in hub.query("kitchen.orders.items", {"order_id": ticket_id})
    }


def sales_line(hub: Hub, ticket_id: str, product: str) -> str:
    row = next(
        r
        for r in hub.query("kitchen.orders.items", {"order_id": ticket_id})
        if r.get("product_name") == product
    )
    return row["sales_order_item_id"]


def round_status(hub: Hub, ticket_id: str) -> str | None:
    return next(
        (
            t.get("status")
            for t in hub.query("kitchen.orders.list")
            if t.get("id") == ticket_id
        ),
        None,
    )


def wait_until(probe, want, timeout: float = 10.0):
    """The sales event reaches kitchen through the outbox relay (~1 s tick), not inside the
    request: polls until `probe()` answers `want` and returns the last answer seen."""
    deadline = time.monotonic() + timeout
    seen = probe()
    while seen != want and time.monotonic() < deadline:
        time.sleep(0.25)
        seen = probe()
    return seen


def on_display(hub: Hub, ticket_id: str) -> dict:
    """`{product_name: item_status}` the KDS paints for that ticket ({} = not on the KDS)."""
    return {
        r.get("product_name"): (r.get("item_status"), r.get("void_reason"))
        for r in hub.query("kitchen.orders.display")
        if r.get("order_id") == ticket_id
    }


def all_day_quantity(hub: Hub, product: str) -> float:
    """How much of `product` the «Resumen» says is still to cook, across every round."""
    return sum(
        float(r.get("quantity") or 0)
        for r in hub.query("kitchen.orders.all_day")
        if r.get("product_name") == product
    )


def fire(hub: Hub, check: str, label: str) -> None:
    """Fires the check the way the till does: with `round_no`, so Ventas stamps each line as sent
    (`fired_at`) — the only lines `sales.order.void_line` accepts (a line not sent is removed)."""
    hub.run(
        "sales.order.fire",
        {"order_id": check, "label": label, "channel": "dine_in", "round_no": 1},
    )


def void_line(hub: Hub, check: str, line_id: str) -> None:
    hub.run(
        "sales.order.void_line",
        {"order_id": check, "line_id": line_id, "reason": REASON},
    )


def test_one_dish_is_struck_and_the_rest_keeps_cooking(hub: Hub) -> None:
    print("\n1 · voiding one sent dish strikes it on the KDS (kitchen#161)")
    check = open_order(hub, [CROQUETAS, CANA])
    fire(hub, check, label=unique("mesa-void"))
    ticket = wait_for_tickets(hub, check, 1)[0]["id"]
    neighbour = open_order(hub, [CROQUETAS])
    fire(hub, neighbour, label=unique("mesa-neighbour"))
    neighbour_ticket = wait_for_tickets(hub, neighbour, 1)[0]["id"]
    before = all_day_quantity(hub, "Croquetas")
    hub.check(
        "before: both dishes are to cook",
        {name: status for name, (status, _) in lines(hub, ticket).items()},
        {"Croquetas": "pending", "Caña": "pending"},
    )

    void_line(hub, check, sales_line(hub, ticket, "Croquetas"))
    hub.check(
        "the croquetas are struck, with the till's reason",
        wait_until(lambda: lines(hub, ticket).get("Croquetas"), ("voided", REASON)),
        ("voided", REASON),
    )
    hub.check("the caña keeps cooking", lines(hub, ticket).get("Caña"), ("pending", ""))
    hub.check("the round keeps its state", round_status(hub, ticket), "pending")
    hub.check(
        "the KDS paints the struck dish next to the live one",
        on_display(hub, ticket),
        {"Croquetas": ("voided", REASON), "Caña": ("pending", "")},
    )
    hub.check(
        "the «Resumen» stops counting those croquetas",
        all_day_quantity(hub, "Croquetas") < before,
        True,
    )
    hub.check(
        "the croquetas of the table next door are untouched",
        lines(hub, neighbour_ticket),
        {"Croquetas": ("pending", "")},
    )
    croquetas_line = next(
        r["id"]
        for r in hub.query("kitchen.orders.items", {"order_id": ticket})
        if r.get("product_name") == "Croquetas"
    )

    def voided_log():
        # `kitchen.item.voided` reaches the log through the outbox too: one more relay tick.
        return [
            (r.get("action"), r.get("notes"))
            for r in hub.query("kitchen.logs.list", {"f_order_item_id": croquetas_line})
            if r.get("action") == "item_voided"
        ]

    hub.check(
        "the kitchen log says the line was voided, and why",
        wait_until(voided_log, [("item_voided", REASON)]),
        [("item_voided", REASON)],
    )

    print("\n2 · voiding the last dish to serve cancels the round (kitchen#161)")
    void_line(hub, check, sales_line(hub, ticket, "Caña"))
    hub.check(
        "the round is cancelled",
        wait_until(lambda: round_status(hub, ticket), "cancelled"),
        "cancelled",
    )
    hub.check("it leaves the KDS", on_display(hub, ticket), {})
    hub.check(
        "both dishes say they were voided",
        lines(hub, ticket),
        {"Croquetas": ("voided", REASON), "Caña": ("voided", REASON)},
    )
    hub.check(
        "the round next door keeps cooking",
        round_status(hub, neighbour_ticket),
        "pending",
    )


def test_the_rest_ready_sends_the_round_to_the_pass(hub: Hub) -> None:
    print(
        "\n3 · voiding the only dish still cooking sends the round to the pass (kitchen#161)"
    )
    check = open_order(hub, [CROQUETAS, CANA])
    fire(hub, check, label=unique("mesa-pass"))
    ticket = wait_for_tickets(hub, check, 1)[0]["id"]
    cana = next(
        r["id"]
        for r in hub.query("kitchen.orders.items", {"order_id": ticket})
        if r.get("product_name") == "Caña"
    )
    hub.run("kitchen.items.bump", {"order_id": ticket, "item_ids": [cana]})
    hub.check("the round is cooking", round_status(hub, ticket), "preparing")

    void_line(hub, check, sales_line(hub, ticket, "Croquetas"))
    hub.check(
        "what is left is ready: the round goes to the pass",
        wait_until(lambda: round_status(hub, ticket), "ready"),
        "ready",
    )


def main() -> int:
    hub = Hub("line_voided.hub")
    print(
        f"Hub battery · a voided sent dish is struck (kitchen#161) · {hub_harness.BASE} · hub {hub.hub_id} · user {hub.user}"
    )
    test_one_dish_is_struck_and_the_rest_keeps_cooking(hub)
    test_the_rest_ready_sends_the_round_to_the_pass(hub)
    return hub.finish(
        "a dish the till voids is struck on the KDS, the round follows what is left, and the table "
        "next door keeps cooking, against the real kernel"
    )


if __name__ == "__main__":
    sys.exit(main())
