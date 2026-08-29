#!/usr/bin/env python3
"""Kitchen does not know what a table or a customer is (ADR-0141). Ported from the hub's
`kitchen_e2e.rs::cocina_no_conoce_mesas_ni_clientes` (ERPlora/hub#1264, contract «El Hub se CIERRA
como KERNEL» §5): this assertion never needed a running kernel — it is a pure manifest check, and
the module carries its own manifest right here, so it never has to leave this repo.

A kitchen ticket is identified by an OPAQUE label ("Table 4", "Bar", "Pickup Ana") that whoever
fires the order supplies and kitchen prints verbatim — never by a foreign key to a table or a
customer. That is precisely what lets `kitchen` install in a shop that never installs `tables` (a
bakery counter) or `customers` (a walk-in grill): the moment `kitchen` names either module in
`depends_on`, or listens on the payment event instead of the firing one, this test catches it before
a single hub ever installs the pair.

It also pins the OTHER half of the same contract: kitchen no longer hangs off `sale.completed` — a
ticket used to be born at CHECKOUT, which is the end of the service; it has to be born when the
order is FIRED, an hour or more before any money moves (see `tests/tickets.hub.test.py` §1).

Usage: tests/agnostic_of_tables_and_customers.contract.test.py   (exit 0 = green)
  No Postgres, no Docker, no hub: it reads the manifest.
"""

import json
import pathlib
import sys

MODULE_DIR = pathlib.Path(__file__).resolve().parent.parent
MANIFEST = json.loads((MODULE_DIR / "module.json").read_text())

errors: list[str] = []


def fail(msg: str) -> None:
    errors.append(msg)


def main() -> int:
    deps = MANIFEST.get("depends_on") or []
    if "tables" in deps:
        fail(f"kitchen must not depend on tables: {deps}")
    if "customers" in deps:
        fail(f"kitchen must not depend on customers: {deps}")

    listen = (MANIFEST.get("events") or {}).get("listen") or {}
    if "sale.completed" in listen:
        fail(
            f"kitchen must not hang off the payment: a ticket fires when the order is taken, "
            f"not when it is charged — listen={listen}"
        )
    if "order.fired" not in listen:
        fail(
            f"kitchen must hang off the order being fired (`order.fired`): listen={listen}"
        )

    for e in errors:
        print("FAIL:", e)
    print(
        "kitchen stays agnostic of tables/customers and hangs off `order.fired`:",
        "OK" if not errors else f"{len(errors)} error(s)",
    )
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
