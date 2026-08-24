#!/usr/bin/env python3
"""Each component of a menu reaches ITS OWN station, grouped under the menu (kitchen#57, ADR-0381).

The failure this pins is the one two mature products ship today, and it is a failure of ROUTING,
not of model:

  * **TouchBistro** — a combo modelled with modifiers makes every component inherit the MAIN
    DISH's printer, so the salad inside the menu prints on the grill.
  * **Square** — the combo prints as one run-on paragraph, and a moderator confirms there is no
    way to get one component per line.

So the acceptance criterion is not that the menu is stored: it is that it ARRIVES. This battery
runs the module's REAL `commands/_insert_item.sql`, `queries/order_items.sql` and
`queries/orders_display.sql` against a real Postgres built from this module's own migrations,
with the binds the runtime would inject, and pins:

  1. three components of ONE menu land on THREE different stations, each resolved by ITS OWN
     article (product routing and category routing both), never by the combo's own id;
  2. the three rows come back carrying the SAME `combo_ref` and the same frozen `combo_name`, so
     the KDS and the paper can print a header with its lines under it;
  3. they come back IN THE ORDER THEY WERE CHOSEN — every row of one dispatch shares `created_at`,
     so without `line_seq` the planner decides, and catalogue order is useless in a kitchen;
  4. a supplement hangs from ITS component, not from the menu;
  5. an ordinary line still reads as «not a menu» (NULL / '' / flat), which is every line of every
     hub that does not sell menus;
  6. the KDS feed (`orders_display`) carries the group too — the WC cannot group what the query
     does not project.

Usage: tests/combo_components_reach_their_own_station.pg.test.py   (exit 0 = green)
  Uses the `erplora-test-pg-5433` container (override: KITCHEN_TEST_PG_CONTAINER).
"""

import json
import os
import pathlib
import subprocess
import sys
import uuid

from module_migrations import migration_entries, migration_sql

MODULE_DIR = pathlib.Path(__file__).resolve().parent.parent
INSERT_ITEM_SQL = (MODULE_DIR / "commands/_insert_item.sql").read_text(encoding="utf-8")
ORDER_ITEMS_SQL = (MODULE_DIR / "queries/order_items.sql").read_text(encoding="utf-8")
DISPLAY_SQL = (MODULE_DIR / "queries/orders_display.sql").read_text(encoding="utf-8")
CONTAINER = os.environ.get("KITCHEN_TEST_PG_CONTAINER", "erplora-test-pg-5433")

HUB = "hub-under-test"
USER = "user-1"
NOW = "2026-08-24T13:00:00Z"

failures: list[str] = []


def fail(msg: str) -> None:
    failures.append(msg)


def literal(value) -> str:
    if value is None:
        return "NULL"
    if isinstance(value, bool):
        return "1" if value else "0"
    if isinstance(value, int):
        return str(value)
    return "'" + str(value).replace("'", "''") + "'"


def container_available() -> bool:
    try:
        subprocess.run(["docker", "inspect", CONTAINER], capture_output=True, check=True, text=True)
        return True
    except (subprocess.CalledProcessError, FileNotFoundError):
        return False


class ScratchDb:
    def __init__(self, prefix: str):
        self.name = f"{prefix}_{os.getpid()}_{uuid.uuid4().hex[:6]}"

    def psql(self, args, db=None, stdin=None) -> str:
        cmd = ["docker", "exec", "-i", CONTAINER, "psql", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-X"]
        if db:
            cmd += ["-d", db]
        res = subprocess.run(cmd + args, input=stdin, capture_output=True, text=True)
        if res.returncode != 0:
            raise RuntimeError(res.stderr.strip() or res.stdout.strip())
        return res.stdout

    def create(self) -> None:
        self.psql(["-c", f'DROP DATABASE IF EXISTS "{self.name}"'])
        self.psql(["-c", f'CREATE DATABASE "{self.name}"'])
        for rel, kind in migration_entries():
            self.psql([], db=self.name, stdin=migration_sql(rel, kind))

    def drop(self) -> None:
        try:
            self.psql(["-c", f'DROP DATABASE IF EXISTS "{self.name}" WITH (FORCE)'])
        except RuntimeError as exc:
            print(f"  ! could not drop {self.name}: {exc}")

    def rows(self, sql: str) -> list[dict]:
        out = self.psql(["-tAc", f"SELECT COALESCE(json_agg(t), '[]'::json) FROM ({sql}) t"], db=self.name)
        return json.loads(out.strip() or "[]")

    def run_query(self, sql: str, binds: dict) -> list[dict]:
        for key, value in binds.items():
            sql = sql.replace(f":{key}", literal(value))
        return self.rows(sql.strip().rstrip(";"))


def insert_item(db: ScratchDb, **over) -> None:
    """The module's REAL `_insert_item.sql`, bound the way the runtime binds it."""
    binds = {
        "item_id": None, "order_id": "k-1", "product_id": None, "product_name": "",
        "category_id": None, "station_id": None, "sales_order_item_id": None,
        "unit_price": 0, "quantity": 1_000_000, "total": 0, "modifiers": "", "notes": "",
        "status": "pending", "seat_number": None,
        "combo_ref": None, "combo_name": "", "line_seq": 0,
        "hub_id": HUB, "current_user_id": USER, "now": NOW,
    }
    binds.update(over)
    sql = INSERT_ITEM_SQL
    for key, value in binds.items():
        sql = sql.replace(f":{key}", literal(value))
    db.psql([], db=db.name, stdin=sql)


def seed(db: ScratchDb) -> None:
    db.psql([], db=db.name, stdin=f"""
INSERT INTO kitchen_order (id, hub_id, order_number, status, order_type, priority, label, notes,
                           subtotal, tax, discount, total, round_number,
                           is_deleted, created_by, updated_by, created_at, updated_at)
VALUES ('k-1', '{HUB}', '20260824-0001', 'pending', 'dine_in', 'normal', 'Mesa 7', '',
        1350, 0, 0, 1350, 1, 0, '{USER}', '{USER}', '{NOW}', '{NOW}');

-- Three real stations of a restaurant: cold, grill and bar. Two of them share a printer role on
-- purpose (fríos and barra both print at the bar), because that is what a small local looks like.
INSERT INTO kitchen_station (id, hub_id, name, name_es, destination, printer_role, is_active, is_deleted, created_at)
VALUES ('st-frio',    '{HUB}', 'Cold',  'Fríos',   'both', 'bar',     1, 0, '{NOW}'),
       ('st-plancha', '{HUB}', 'Grill', 'Plancha', 'both', 'kitchen', 1, 0, '{NOW}'),
       ('st-barra',   '{HUB}', 'Bar',   'Barra',   'both', 'bar',     1, 0, '{NOW}');

-- The starter is routed by PRODUCT, the main and the drink by CATEGORY: the menu has to survive
-- both roads, because a real catalogue mixes them.
INSERT INTO kitchen_product_station (id, hub_id, product_id, station_id, is_deleted, created_at)
VALUES ('r-gaz', '{HUB}', 'p-gazpacho', 'st-frio', 0, '{NOW}');
INSERT INTO kitchen_category_station (id, hub_id, category_id, station_id, is_deleted, created_at)
VALUES ('r-pla', '{HUB}', 'cat-plancha', 'st-plancha', 0, '{NOW}'),
       ('r-bar', '{HUB}', 'cat-barra',   'st-barra',   0, '{NOW}');
""")


def main() -> int:
    if not container_available():
        print(f"⚠ container `{CONTAINER}` not running — skipping (start the test Postgres to run it)")
        return 0

    db = ScratchDb("kitchen_combo_routing")
    try:
        db.create()
        seed(db)

        # The menu del día of the first real customer, as the handler expands it: one row per
        # component, in the order it was chosen, all three carrying the same group.
        insert_item(db, item_id="i-1", product_id="p-gazpacho", category_id="cat-frio",
                    product_name="GAZPACHO", combo_ref="cg-1", combo_name="MENU", line_seq=1)
        insert_item(db, item_id="i-2", product_id="p-entrecot", category_id="cat-plancha",
                    product_name="ENTRECOT", combo_ref="cg-1", combo_name="MENU", line_seq=2,
                    modifiers="SIN CEBOLLA")
        insert_item(db, item_id="i-3", product_id="p-tinto", category_id="cat-barra",
                    product_name="Vino tinto", combo_ref="cg-1", combo_name="MENU", line_seq=3)
        # And an ordinary line fired in the same round: the control that matters.
        insert_item(db, item_id="i-4", product_id="p-croquetas", category_id="cat-plancha",
                    product_name="Croquetas", unit_price=350, total=700, quantity=2_000_000,
                    line_seq=4)

        lines = db.run_query(ORDER_ITEMS_SQL, {"hub_id": HUB, "order_id": "k-1"})
        by_id = {str(r["id"]): r for r in lines}
        if len(by_id) != 4:
            fail(f"expected 4 comanda lines, found {len(by_id)} — fixture wrong")
            return report()

        # 1 · THREE stations, each resolved by the component's OWN article.
        routed = {i: (by_id[i].get("station_id"), by_id[i].get("printer_role")) for i in ("i-1", "i-2", "i-3")}
        expected = {"i-1": ("st-frio", "bar"), "i-2": ("st-plancha", "kitchen"), "i-3": ("st-barra", "bar")}
        if routed != expected:
            fail(
                f"the components of one menu routed to {routed}, expected {expected} — a component "
                "must reach the station of ITS article, never the one of the dish next to it "
                "(the TouchBistro failure: the salad ends up on the grill)"
            )
        if len({s for s, _ in routed.values()}) != 3:
            fail("the three components share a station — the menu was routed as ONE line")

        # 2 · Grouped: same ref, same frozen name.
        for item in ("i-1", "i-2", "i-3"):
            got = by_id[item]
            if got.get("combo_ref") != "cg-1":
                fail(f"{item} came back with combo_ref={got.get('combo_ref')!r}, expected 'cg-1' — "
                     "without the group the cook sees three loose tickets and they leave the pass out of sync")
            if got.get("combo_name") != "MENU":
                fail(f"{item} came back with combo_name={got.get('combo_name')!r}, expected the frozen "
                     "'MENU' — the header of the group is a snapshot, not a live join")

        # 3 · In the order they were CHOSEN. Every row shares `created_at`, so this is the whole
        # point of `line_seq`: it must be the ORDER BY, not a column nobody sorts on.
        order = [str(r["id"]) for r in lines]
        if order != ["i-1", "i-2", "i-3", "i-4"]:
            fail(f"the lines came back as {order}, expected the order of choice "
                 "['i-1','i-2','i-3','i-4'] — the catalogue order is useless in a kitchen (Square forum)")

        # 4 · The supplement hangs from ITS component.
        if by_id["i-2"].get("modifiers") != "SIN CEBOLLA":
            fail("the supplement did not stay on its component")
        if by_id["i-1"].get("modifiers") or by_id["i-3"].get("modifiers"):
            fail("a supplement of one component leaked onto its siblings — «the main, no onion» "
                 "must not take the onion out of the gazpacho")

        # 5 · An ordinary line reads as «not a menu».
        plain = by_id["i-4"]
        if plain.get("combo_ref") is not None or plain.get("combo_name") != "":
            fail(f"an ordinary line came back as part of a menu ({plain.get('combo_ref')!r} / "
                 f"{plain.get('combo_name')!r}) — that is every line of every hub that sells no menus")

        # 6 · The KDS feed carries the group too: the WC cannot group what the query does not project.
        feed = db.run_query(DISPLAY_SQL, {"hub_id": HUB})
        feed_by_item = {str(r["item_id"]): r for r in feed if r.get("item_id")}
        missing = [k for k in ("combo_ref", "combo_name", "line_seq") if k not in (feed[0] if feed else {})]
        if missing:
            fail(f"`orders_display` does not project {missing} — the KDS cannot paint a header for a "
                 "group it cannot see, which is exactly how Square ends up with a run-on paragraph")
        else:
            if feed_by_item["i-2"].get("combo_ref") != "cg-1":
                fail("the KDS feed lost the group of a component")
            feed_order = [str(r["item_id"]) for r in feed if r.get("item_id")]
            if feed_order != ["i-1", "i-2", "i-3", "i-4"]:
                fail(f"the KDS feed came back as {feed_order}, expected the order of choice")
    finally:
        db.drop()

    return report()


def report() -> int:
    if failures:
        for msg in failures:
            print(f"✗ {msg}")
        print(f"\nFAILED ({len(failures)}).")
        return 1
    print("✓ every component of the menu reaches ITS station, grouped under the menu and in the order chosen")
    return 0


if __name__ == "__main__":
    sys.exit(main())
