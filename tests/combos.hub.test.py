#!/usr/bin/env python3
"""A combo expands into its components, and they stay ONE menu — against the REAL kernel. Ported
from the hub's `kitchen_e2e.rs` (ERPlora/hub#1264, contract «El Hub se CIERRA como KERNEL» §5,
ADR-0381).

The sector's headline failure here is not a modelling bug, it is ROUTING, and it is documented in
two mature products: in TouchBistro a component inherits the MAIN DISH's printer — the salad of a
menu comes out on the grill — and in Square the combo prints as a RUN-ON PARAGRAPH, with a
moderator confirming there is no way to get it out as a list.

These tests enter through the listener command (`kitchen.orders.create_from_order`) instead of
through `sales.order.fire` ON PURPOSE: the `sales` half (the fired set menu carrying the chosen
dishes, ERPlora/sales#522) is proven by sales' own `combo_fire.hub.test.py`; what has to be proven
here is kitchen's half on its own — that the compiled WASM, the runtime's binder and
`_insert_item.sql` actually agree with each other — which neither the handler's own unit tests nor
the module's Postgres battery can say on their own.

  1. A menu at a closed price is ONE line at checkout, but its components are what the kitchen
     cooks: each one has to land on the station of ITS OWN article — never the neighbouring dish's
     station (the TouchBistro failure) — while the ticket still shows them as one menu (same
     `combo_ref`, the frozen kitchen name, in the order the diner chose them, not whatever order the
     planner returns them in). The closed price is counted exactly once, never as a free parent line
     (the Odoo failure) and never repeated on every component (the same lie with the sign flipped).
     A per-component modifier hangs off ITS component only — "the second one, no onion" does not
     touch the gazpacho.
  2. A menu fired with NOTHING chosen is refused — loudly, by a domain code, and nothing is written.
     The authoritative gate on `min_choices` belongs to `sales` (it is the one that reads
     `combos.*`), but kitchen cannot depend on every caller of `order.fired` getting it right (a
     flow, the assistant, a third-party integration) — same reasoning, same door as kitchen#54.

Usage: `erplora test <dir> --against-hub [dev|stable|sha256:…]` (module-toolkit#110). Never on its
own: without a runtime it fails, it does not skip.
"""

import sys

import hub_harness
from hub_harness import ONE, Hub, unique


def create_station(hub: Hub, name: str, product_id: str) -> str:
    out = hub.run(
        "kitchen.stations.create",
        {"name": name, "destination": "both", "printer_role": "kitchen"},
    )
    station_id = out["new_ids"][0]
    hub.run(
        "kitchen.stations.set_routing",
        {"station_id": station_id, "product_id": product_id},
    )
    return station_id


def test_each_component_reaches_its_station_and_they_stay_one_menu(hub: Hub) -> None:
    print(
        "\n1 · each component of the menu lands on ITS station, and they stay ONE menu"
    )
    tag = unique("menu")
    gazpacho_id, entrecot_id, tinto_id = (
        f"p-gazpacho-{tag}",
        f"p-entrecot-{tag}",
        f"p-tinto-{tag}",
    )
    cold_station = create_station(hub, f"Fríos {tag}", gazpacho_id)
    grill_station = create_station(hub, f"Plancha {tag}", entrecot_id)
    bar_station = create_station(hub, f"Barra {tag}", tinto_id)

    order_id = unique("ord-menu")
    combo_ref = unique("cg")
    hub.run(
        "kitchen.orders.create_from_order",
        {
            "order_id": order_id,
            "label": "Mesa 7",
            "channel": "dine_in",
            "items": [
                {
                    "order_item_id": "li-1",
                    "product_id": "combo-menu",
                    "product_name": "Menú del día",
                    "quantity": ONE,
                    "unit_price": 1350,
                    "combo_group_ref": combo_ref,
                    "combo_name": "Menú del día",
                    "combo_kitchen_name": "MENÚ",
                    "combo_components": [
                        {
                            "product_id": gazpacho_id,
                            "product_name": "Gazpacho",
                            "kitchen_name": "GAZPACHO",
                            "quantity": ONE,
                        },
                        {
                            "product_id": entrecot_id,
                            "product_name": "Entrecot",
                            "kitchen_name": "ENTRECOT",
                            "quantity": ONE,
                            "modifiers": [
                                {
                                    "option_id": "o1",
                                    "name": "Sin cebolla",
                                    "kitchen_name": "SIN CEBOLLA",
                                }
                            ],
                        },
                        {
                            "product_id": tinto_id,
                            "product_name": "Vino tinto",
                            "quantity": ONE,
                        },
                    ],
                }
            ],
        },
    )

    tickets = [
        c
        for c in hub.query("kitchen.orders.list")
        if c.get("source_order_id") == order_id
    ]
    hub.check("a menu is ONE ticket", len(tickets), 1)
    ticket = tickets[0]
    hub.check(
        "the closed price counts ONCE — never a free parent line, never repeated per component",
        ticket.get("total"),
        1350,
    )

    lines = hub.query("kitchen.orders.items", {"order_id": ticket["id"]})
    hub.check("three components, THREE ticket lines", len(lines), 3)

    station_by_product = {l.get("product_name"): l.get("station_id") for l in lines}
    hub.check(
        "each component reaches the station of ITS OWN article, never the dish next to it "
        "(the TouchBistro failure: the salad ends up on the grill)",
        station_by_product,
        {"GAZPACHO": cold_station, "ENTRECOT": grill_station, "Vino tinto": bar_station},
    )

    for l in lines:
        hub.check(
            f"{l.get('product_name')}: the group is not lost",
            l.get("combo_ref"),
            combo_ref,
        )
        hub.check(
            f"{l.get('product_name')}: the kitchen name wins",
            l.get("combo_name"),
            "MENÚ",
        )

    names = [l.get("product_name") for l in lines]
    hub.check(
        "the order of CHOICE, not whatever the planner returns",
        names,
        ["GAZPACHO", "ENTRECOT", "Vino tinto"],
    )
    seqs = [l.get("line_seq") for l in lines]
    hub.check("line_seq keeps the choice order", seqs, [1, 2, 3])

    by_name = {l.get("product_name"): l.get("modifiers") for l in lines}
    hub.check(
        "the modifier hangs off its OWN component",
        by_name.get("ENTRECOT"),
        "SIN CEBOLLA",
    )
    hub.check("…never the one before it", by_name.get("GAZPACHO"), "")
    hub.check("…nor the one after it", by_name.get("Vino tinto"), "")

    # The KDS feed has to see it too, or the WC cannot paint header + list.
    feed = hub.query("kitchen.orders.display")
    del_menu = [r for r in feed if r.get("combo_ref") == combo_ref]
    hub.check(
        "the KDS feed can group what this menu wrote — the query has to project combo_ref",
        len(del_menu),
        3,
    )


def test_a_menu_fired_with_nothing_chosen_is_refused(hub: Hub) -> None:
    print(
        "\n2 · a menu fired with NOTHING chosen is refused, loudly, and writes nothing"
    )
    order_id = unique("ord-empty-menu")
    combo_ref = unique("cg")
    hub.refused(
        "an empty combo",
        "kitchen.orders.create_from_order",
        {
            "order_id": order_id,
            "label": "Mesa 3",
            "channel": "dine_in",
            "items": [
                {
                    "order_item_id": "li-1",
                    "product_id": "combo-menu",
                    "product_name": "Menú del día",
                    "quantity": ONE,
                    "unit_price": 1350,
                    "combo_group_ref": combo_ref,
                    "combo_name": "Menú del día",
                    "combo_components": [],
                }
            ],
        },
        "kitchen.combo_without_components",
    )
    tickets = [
        c
        for c in hub.query("kitchen.orders.list")
        if c.get("source_order_id") == order_id
    ]
    hub.check("an empty menu never opens a blank ticket", tickets, [])


def main() -> int:
    hub = Hub("combos.hub")
    print(
        f"Hub battery · combos (hub#1264 ← kitchen_e2e.rs, ADR-0381) · {hub_harness.BASE} · hub {hub.hub_id} · user {hub.user}"
    )
    test_each_component_reaches_its_station_and_they_stay_one_menu(hub)
    test_a_menu_fired_with_nothing_chosen_is_refused(hub)
    return hub.finish(
        "a combo expands into its components without losing the menu, against the real kernel"
    )


if __name__ == "__main__":
    sys.exit(main())
