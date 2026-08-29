#!/usr/bin/env python3
"""Stations say WHERE a ticket comes out — against the REAL kernel. Ported from the hub's
`kitchen_e2e.rs` (ERPlora/hub#1264, contract «El Hub se CIERRA como KERNEL» §5).

Firing an order used to only WRITE the ticket to the database — nobody printed it, nobody
guaranteed it showed up on a screen. A real restaurant has several stations and each one comes out
where it can: on the grill nobody watches a screen with their hands full (paper), and at the bar
printing is throwing away paper because the bartender serves themself (screen). The destination
belongs to the STATION, not to the ticket, so "hot station prints, bar only shows" is configured
once instead of on every single fire. Product→station routing already existed (`_insert_item.sql`);
what was missing was the station saying WHERE.

  1. Each station says where ITS ticket comes out: a product routed to a `printer` station prints,
     one routed to a `display` station only shows — and the line knows which printer ROLE, so
     whoever prints can group by paper and never send a screen-only line to the printer.
  2. A ticket ALREADY fired is a historical fact, not a query against today's configuration: if the
     grill is reassigned to the fryer tomorrow, yesterday's round still went out through the grill —
     and reprinting it, or cancelling one of its lines, has to reach the station that actually
     cooked it, not the one that would today.
  3. A station with no destination configured defaults to `both` (screen AND paper): the default
     cannot be "screen only" or a hub that upgrades would silently stop printing, and the kitchen
     finds out with cold food. When in doubt: paper is wasted, but no ticket is lost.

Usage: `erplora test <dir> --against-hub [dev|stable|sha256:…]` (module-toolkit#110). Never on its
own: without a runtime it fails, it does not skip.
"""

import sys

import hub_harness
from hub_harness import (
    ONE,
    Hub,
    catalog_product,
    fire,
    open_order,
    the_one_ticket,
    unique,
)


def create_station(hub: Hub, **fields) -> str:
    out = hub.run("kitchen.stations.create", fields)
    return out["new_ids"][0]


def route(hub: Hub, station_id: str, product_id: str) -> None:
    hub.run(
        "kitchen.stations.set_routing",
        {"station_id": station_id, "product_id": product_id},
    )


def test_each_station_says_where_its_ticket_comes_out(hub: Hub) -> None:
    print("\n1 · routed products land on THEIR station's destination and printer role")
    tag = unique("routing")
    kitchen_station = create_station(
        hub,
        name=f"Cocina caliente {tag}",
        destination="printer",
        printer_role="kitchen",
    )
    bar_station = create_station(hub, name=f"Barra {tag}", destination="display")

    # Routed products must EXIST in the real catalogue: `sales.order.open` prices a `product_id`
    # from `inventory.products.for_sale` and rejects one that is not there (sales#175).
    croquetas_id = catalog_product(hub, f"Croquetas {tag}", f"CROQ-{tag}", 350)
    canas_id = catalog_product(hub, f"Cañas {tag}", f"CANA-{tag}", 250)
    route(hub, kitchen_station, croquetas_id)
    route(hub, bar_station, canas_id)

    oid = open_order(
        hub,
        [
            {
                "product_id": croquetas_id,
                "product_name": "Croquetas",
                "price": 350,
                "quantity": 2 * ONE,
            },
            {
                "product_id": canas_id,
                "product_name": "Cañas",
                "price": 250,
                "quantity": 2 * ONE,
            },
        ],
    )
    fire(hub, oid)

    ticket = the_one_ticket(hub, oid)
    items = hub.query("kitchen.orders.items", {"order_id": ticket["id"]})
    hub.check("both lines reach the kitchen", len(items), 2)

    croquetas = next((i for i in items if i.get("product_name") == "Croquetas"), {})
    hub.check("croquetas go to the grill", croquetas.get("station_id"), kitchen_station)
    hub.check("the hot station prints", croquetas.get("destination"), "printer")
    hub.check(
        "…through the `kitchen` printer role", croquetas.get("printer_role"), "kitchen"
    )

    canas = next((i for i in items if i.get("product_name") == "Cañas"), {})
    hub.check("cañas go to the bar", canas.get("station_id"), bar_station)
    hub.check(
        "the bar does NOT print: screen only", canas.get("destination"), "display"
    )


def test_an_old_round_reprints_where_it_actually_went(hub: Hub) -> None:
    print(
        "\n2 · a fired ticket's destination is a historical fact, not today's configuration"
    )
    tag = unique("history")
    station = create_station(
        hub, name=f"Plancha {tag}", destination="printer", printer_role="kitchen"
    )
    # Routed products must EXIST in the real catalogue (sales#175, see test 1).
    product_id = catalog_product(hub, f"Croquetas {tag}", f"CROQ-{tag}", 350)
    route(hub, station, product_id)

    oid = open_order(
        hub,
        [
            {
                "product_id": product_id,
                "product_name": "Croquetas",
                "price": 350,
                "quantity": 2 * ONE,
            }
        ],
    )
    fire(hub, oid)
    # Wait for the round to actually land BEFORE reconfiguring: `_insert_item.sql` snapshots the
    # station's CURRENT configuration through the outbox relay (see the module docstring on
    # `wait_for_tickets`), so reconfiguring before it lands would freeze the NEW values instead of
    # the ones this test means to prove survive a later change.
    ticket = the_one_ticket(hub, oid)

    # The boss reconfigures the station AFTER the round went out: the grill becomes screen-only and
    # changes printer role. Changing the ROUTING alone would not expose this — `station_id` is
    # already frozen on the line at insert time. What comes from a LIVE join, and therefore travels
    # in time if left alone, is the station's configuration.
    hub.run(
        "kitchen.stations.update",
        {
            "station_id": station,
            "name": f"Plancha retirada {tag}",
            "destination": "display",
            "printer_role": "bar",
        },
    )

    items = hub.query("kitchen.orders.items", {"order_id": ticket["id"]})
    hub.check(
        "the round went out through the grill", items[0].get("station_id"), station
    )
    hub.check(
        "…and on PAPER, as it went out — not today's fryer screen",
        items[0].get("destination"),
        "printer",
    )
    hub.check(
        "…through the printer that received it", items[0].get("printer_role"), "kitchen"
    )
    # Exact name, not a prefix: the renamed station is `Plancha retirada {tag}`, which STILL starts
    # with "Plancha " — a prefix check stayed green with `station_name` read from a live join on
    # `kitchen_station` (verified by mutation in the review of kitchen#65).
    hub.check(
        "…with the name it had back then",
        items[0].get("station_name"),
        f"Plancha {tag}",
    )


def test_a_station_with_no_destination_prints_and_shows(hub: Hub) -> None:
    print(
        "\n3 · an unconfigured station defaults to BOTH — paper is wasted, never a lost ticket"
    )
    tag = unique("default")
    out = hub.run("kitchen.stations.create", {"name": f"Pase {tag}"})
    station_id = out["new_ids"][0]

    rows = hub.query("kitchen.stations.list")
    pase = next((s for s in rows if s.get("id") == station_id), {})
    hub.check("unconfigured: screen AND paper", pase.get("destination"), "both")
    hub.check("…through the kitchen printer role", pase.get("printer_role"), "kitchen")


def main() -> int:
    hub = Hub("stations.hub")
    print(
        f"Hub battery · stations (hub#1264 ← kitchen_e2e.rs) · {hub_harness.BASE} · hub {hub.hub_id} · user {hub.user}"
    )
    test_each_station_says_where_its_ticket_comes_out(hub)
    test_an_old_round_reprints_where_it_actually_went(hub)
    test_a_station_with_no_destination_prints_and_shows(hub)
    return hub.finish(
        "a station's destination routes the ticket, and history never rewrites itself, against the real kernel"
    )


if __name__ == "__main__":
    sys.exit(main())
