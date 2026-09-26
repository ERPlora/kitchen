#!/usr/bin/env python3
"""A round already on the line can be marked RUSH — against the REAL kernel (kitchen#76).

The KDS card now offers «Mark rush» / «Remove rush» on a ticket that is cooking. The button calls
`kitchen.orders.update` with `{order_id, priority}` — a declarative SQL command that existed for
months and that no screen called. The unit tests pin what the board does with the answer; only a
running hub can prove the door itself:

  1. `kitchen.orders.update {priority: "rush"}` on a FIRED round reaches the row, and the board's
     own feed (`kitchen.orders.display`) says `rush` on every line of that ticket — which is what
     puts it at the front of every station's board.
  2. Undoing it is the same door with `normal`, and nothing else on the ticket moves (label, round).
  3. TENANCY: another hub sending the same order id can neither see the ticket on its board nor
     change its priority — the command's `WHERE hub_id = :hub_id` is applied by the dispatcher.
  4. kitchen#99: every turn TO rush bumps `rush_count` (read by `kitchen.orders.get`, the value the
     rush notice's job id is built from), so marked → cleared → marked again reads 2; repeating
     rush or editing only the notes (priority bound as NULL by the real dispatcher) does not count.

Usage: `erplora test <dir> --against-hub [dev|stable|sha256:…]` (module-toolkit#110). Never on its
own: without a runtime it fails, it does not skip.
"""

import sys

import hub_harness
from hub_harness import ONE, Hub, fire, open_order, the_one_ticket, unique

FOREIGN_HUB = "00000000-0000-0000-0000-00000000f076"


def display_priorities(hub: Hub, ticket_id: str) -> set:
    return {
        r.get("priority")
        for r in hub.query("kitchen.orders.display")
        if r.get("order_id") == ticket_id
    }


def fired_round(hub: Hub) -> dict:
    oid = open_order(
        hub, [{"product_name": "Chuletón", "price": 2800, "quantity": ONE}]
    )
    fire(hub, oid, label=unique("mesa"))
    return the_one_ticket(hub, oid)


def test_a_fired_round_can_be_marked_rush(hub: Hub) -> None:
    print("\n1 · a round already on the line turns rush, and the board's feed says so")
    ticket = fired_round(hub)
    hub.check("the round was fired as a normal one", ticket.get("priority"), "normal")
    hub.run("kitchen.orders.update", {"order_id": ticket["id"], "priority": "rush"})
    hub.check(
        "every line of the ticket on the board now reads rush",
        display_priorities(hub, ticket["id"]),
        {"rush"},
    )


def test_undo_is_the_same_door_and_touches_nothing_else(hub: Hub) -> None:
    print("\n2 · removing rush is the same door, and the rest of the ticket stays put")
    ticket = fired_round(hub)
    hub.run("kitchen.orders.update", {"order_id": ticket["id"], "priority": "rush"})
    hub.run("kitchen.orders.update", {"order_id": ticket["id"], "priority": "normal"})
    after = the_one_ticket(hub, ticket["source_order_id"])
    hub.check("the priority is back to normal", after.get("priority"), "normal")
    hub.check("the label did not move", after.get("label"), ticket.get("label"))
    hub.check(
        "the round did not move", after.get("round_number"), ticket.get("round_number")
    )


def test_another_hub_cannot_rush_or_see_the_ticket(hub: Hub) -> None:
    print("\n3 · tenancy: another hub neither sees the ticket nor changes its priority")
    ticket = fired_round(hub)
    home = hub.hub_id
    hub.hub_id = FOREIGN_HUB
    try:
        foreign_board = {r.get("order_id") for r in hub.query("kitchen.orders.display")}
        hub.check_true(
            "the ticket is not on another hub's board",
            ticket["id"] not in foreign_board,
            str(sorted(foreign_board)),
        )
        # Whatever the runtime answers (ok with nothing touched, or a refusal), the row must not move.
        hub.command(
            "kitchen.orders.update", {"order_id": ticket["id"], "priority": "rush"}
        )
    finally:
        hub.hub_id = home
    hub.check(
        "the foreign write did not reach this hub's row",
        display_priorities(hub, ticket["id"]),
        {"normal"},
    )


def rush_count(hub: Hub, ticket_id: str):
    rows = hub.query("kitchen.orders.get", {"order_id": ticket_id})
    return rows[0].get("rush_count") if rows else None


def test_every_turn_to_rush_is_counted(hub: Hub) -> None:
    print("\n4 · every turn to rush is counted, so the second rush gets its own notice (kitchen#99)")
    ticket = fired_round(hub)
    hub.check("a round fired normal was never rushed", rush_count(hub, ticket["id"]), 0)
    hub.run("kitchen.orders.update", {"order_id": ticket["id"], "priority": "rush"})
    hub.check("normal → rush counts 1", rush_count(hub, ticket["id"]), 1)
    hub.run("kitchen.orders.update", {"order_id": ticket["id"], "priority": "rush"})
    hub.check("rush → rush does not count", rush_count(hub, ticket["id"]), 1)
    hub.run("kitchen.orders.update", {"order_id": ticket["id"], "notes": "sin cebolla"})
    hub.check("an edit without a priority does not count", rush_count(hub, ticket["id"]), 1)
    hub.run("kitchen.orders.update", {"order_id": ticket["id"], "priority": "normal"})
    hub.run("kitchen.orders.update", {"order_id": ticket["id"], "priority": "rush"})
    hub.check("cleared and marked again counts 2", rush_count(hub, ticket["id"]), 2)


def main() -> int:
    hub = Hub("rush_after_fire.hub")
    print(
        f"Hub battery · rush after fire (kitchen#76) · {hub_harness.BASE} · hub {hub.hub_id} · user {hub.user}"
    )
    test_a_fired_round_can_be_marked_rush(hub)
    test_undo_is_the_same_door_and_touches_nothing_else(hub)
    test_another_hub_cannot_rush_or_see_the_ticket(hub)
    test_every_turn_to_rush_is_counted(hub)
    return hub.finish(
        "a fired round turns rush and back through its own hub's door only, against the real kernel"
    )


if __name__ == "__main__":
    sys.exit(main())
