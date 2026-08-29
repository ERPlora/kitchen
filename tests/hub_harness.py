"""Plumbing shared by the `*.hub.test.py` batteries — the ones that talk to a REAL kernel.

`erplora test <dir> --against-hub` (module-toolkit#110) starts the published hub image with its
own Postgres, installs the module through `POST /api/modules/install` and hands the url over in
`ERPLORA_HUB_BASE_URL`. Everything below is the thin layer between a battery and that runtime:
the two doors (`/api/query`, `/api/command`), the error envelope, the event shape, and the one
piece of bookkeeping every battery needs — a `check()` that records a failure instead of dying on
it, so a red run names EVERY broken assertion and not just the first.

Why HTTP and not a scratch Postgres: these batteries replace the hub's own `kitchen_e2e.rs`
(ERPlora/hub#1264, contract «El Hub se CIERRA como KERNEL» §5). What they assert is what the WASM
handler does INSIDE the runtime — ids minted by the host, `reads` pre-loaded by the dispatcher
(`sales_order_item` for a fired order), the transaction, the outbox that carries `order.fired` from
`sales` into `kitchen.orders.create_from_order` — and none of that exists in a hand-written harness
that binds `:hub_id` itself. Ported from the identical `tests/hub_harness.py` of ERPlora/sales#239
(same shape, same design notes, one file per module on purpose — a shared package would couple two
modules that only agree by convention, never by import).

Two facts of the runtime a battery has to know, both resolved here so no battery hard-codes them:

  * THE TENANT. Module seeds land under the RUNTIME's own `hub_id`, not under whatever `X-Hub-Id` a
    request carries (hub#594). `GET /api/hub/context` says which id that is, and every request goes
    out under it.
  * THE SESSION USER. Dev auth trusts `X-User-Id`. Each run mints its own, because batteries share
    one hub for the length of the run and a fixed id would let one battery see rows another one
    wrote under the same identity by accident.

A third fact is specific to `kitchen`: `sales.order.fire` carries `order.fired` through the
OUTBOX, and `kitchen.orders.create_from_order` only runs when the relay delivers it — the Rust e2e
this replaces called `rt.drain_outbox().await` after every fire, and there is no HTTP door that
forces a drain (draining on demand is a test-only shortcut the runtime does not owe anyone). The
relay ticks every second (`crates/server/src/lib.rs`), so `wait_for_tickets` below polls instead of
asserting the instant after firing — the boring, standard way to check an eventually-consistent
side effect, not a sleep sized by guesswork.

It refuses to skip. Without a runtime a battery FAILS: a check that excuses itself is the green
that proves nothing this whole toolkit exists to remove (module-toolkit#50).
"""

import json
import os
import sys
import time
import urllib.error
import urllib.request
import uuid

BASE = (
    os.environ.get("KITCHEN_HUB_BASE_URL")
    or os.environ.get("ERPLORA_HUB_BASE_URL")
    or ""
).rstrip("/")

# Quantities travel in 10^6 fixed point (ADR-0147); money in integer cents (ADR-0007/0123).
ONE = 1_000_000


def cents(value) -> int:
    """A money aggregate the way Postgres hands it back: `SUM(bigint)` is NUMERIC, so a total may
    arrive as a JSON string (`"5000"`) instead of a number. Either form is the same cents."""
    if isinstance(value, bool):
        raise AssertionError(f"not a money amount: {value!r}")
    if isinstance(value, (int, float)):
        return int(round(value))
    if isinstance(value, str):
        return int(round(float(value)))
    raise AssertionError(f"not a money amount: {value!r}")


class Hub:
    """One battery's view of the live runtime."""

    def __init__(
        self,
        battery: str,
        needs: tuple[str, ...] = ("taxes", "inventory", "sales", "kitchen"),
    ):
        self.battery = battery
        self.failures: list[str] = []
        if not BASE:
            print(
                f"{battery}: no runtime at the other end (ERPLORA_HUB_BASE_URL is empty)."
            )
            print(
                "Run it with `erplora test <dir> --against-hub`; without a hub this is NOT a skip, "
                "it is a failure."
            )
            sys.exit(1)
        self.user = f"u-{uuid.uuid4().hex[:8]}"
        self.hub_id = self._runtime_hub_id()
        self._require_installed(needs)

    # ── transport ────────────────────────────────────────────────────────────────────────

    def _request(self, method: str, path: str, body=None):
        data = None if body is None else json.dumps(body).encode()
        req = urllib.request.Request(
            f"{BASE}{path}",
            data=data,
            headers={
                "content-type": "application/json",
                "x-hub-id": self.hub_id,
                "x-user-id": self.user,
            },
            method=method,
        )
        try:
            with urllib.request.urlopen(req, timeout=60) as res:
                return res.status, json.loads(res.read().decode() or "null")
        except urllib.error.HTTPError as err:
            raw = err.read().decode()
            try:
                return err.code, json.loads(raw or "null")
            except json.JSONDecodeError:
                return err.code, {"raw": raw}

    def _runtime_hub_id(self) -> str:
        req = urllib.request.Request(f"{BASE}/api/hub/context", method="GET")
        with urllib.request.urlopen(req, timeout=60) as res:
            body = json.loads(res.read().decode())
        hub_id = body.get("hub_id")
        if not hub_id:
            print(
                f"{self.battery}: GET /api/hub/context did not say the hub_id: {body}"
            )
            sys.exit(1)
        return hub_id

    def _require_installed(self, needs: tuple[str, ...]) -> None:
        status, body = self._request("GET", "/api/modules")
        installed = (
            {m["id"] for m in (body or {}).get("data", [])} if status == 200 else set()
        )
        missing = [m for m in needs if m not in installed]
        if missing:
            print(
                f"{self.battery}: the runtime at {BASE} does not have {missing} installed "
                f"(installed: {sorted(installed)}). `kitchen` declares "
                '`depends_on: ["sales", "inventory"]`, and `sales` declares `depends_on: '
                '["taxes"]`, so the harness has to install every dependency through the same '
                "door before `kitchen`. Not a skip: nothing below can be trusted without them."
            )
            sys.exit(1)

    # ── the two doors ────────────────────────────────────────────────────────────────────

    def query(self, name: str, params: dict | None = None) -> list:
        """Rows of a query. A query with a `list` block answers `{rows,total,…}`; the rest answer
        the bare array. Both come back as the list of rows."""
        status, body = self._request(
            "POST", "/api/query", {"name": name, "params": params or {}}
        )
        if status != 200 or not (body or {}).get("ok"):
            raise AssertionError(f"query {name} answered {status}: {body}")
        data = body["data"]
        if isinstance(data, dict) and "rows" in data:
            return data["rows"]
        return data

    def command(self, name: str, payload: dict):
        """`(status, body)` of a command, whatever the runtime answered."""
        return self._request("POST", "/api/command", {"name": name, "payload": payload})

    def run(self, name: str, payload: dict) -> dict:
        """A command that MUST succeed. Its `data` (`operations`, `new_ids`, …)."""
        status, body = self.command(name, payload)
        if status != 200 or not (body or {}).get("ok"):
            raise AssertionError(f"command {name} answered {status}: {body}")
        return body["data"]

    def refused(self, label: str, name: str, payload: dict, code: str) -> None:
        """The runtime must REFUSE the command with exactly this domain code — the code, never the
        prose (ADR-0398 §6): the till translates the code, nobody reads the sentence."""
        status, body = self.command(name, payload)
        got = (
            ((body or {}).get("error") or {}).get("code")
            if isinstance(body, dict)
            else None
        )
        if status == 200:
            self.failures.append(
                f"{label} — expected refusal `{code}`, the command SUCCEEDED: {body}"
            )
            print(f"  FAIL: {label} — expected refusal `{code}`, got success: {body}")
        elif got != code:
            self.failures.append(
                f"{label} — expected code [{code}], got [{got}] (HTTP {status}: {body})"
            )
            print(
                f"  FAIL: {label} — expected code [{code}], got [{got}] (HTTP {status})"
            )
        else:
            print(f"  ok: {label} refused with `{code}` (HTTP {status})")

    # ── what the hub says about its events ───────────────────────────────────────────────

    def event_shape(self, event_name: str) -> dict | None:
        """`GET /api/hub/events/shape?name=…` — the fields of the NEWEST events of that name in this
        hub, each with one sample unless withheld (hub#715). `None` when the hub has never heard of
        the event."""
        status, body = self._request(
            "GET", f"/api/hub/events/shape?name={event_name}&limit=1"
        )
        if status == 404:
            return None
        if status != 200 or not (body or {}).get("ok"):
            raise AssertionError(f"events/shape {event_name} answered {status}: {body}")
        return body["data"]

    def event_field(self, event_name: str, path: str) -> dict | None:
        shape = self.event_shape(event_name)
        if shape is None:
            return None
        return next((f for f in shape.get("fields", []) if f.get("path") == path), None)

    # ── bookkeeping ──────────────────────────────────────────────────────────────────────

    def check(self, label: str, got, want) -> None:
        if got != want:
            self.failures.append(f"{label} — expected [{want!r}], got [{got!r}]")
            print(f"  FAIL: {label} — expected [{want!r}], got [{got!r}]")
        else:
            print(f"  ok: {label} = {got!r}")

    def check_true(self, label: str, condition: bool, detail="") -> None:
        if not condition:
            self.failures.append(f"{label} — {detail}" if detail else label)
            print(f"  FAIL: {label} {detail}")
        else:
            print(f"  ok: {label}")

    def finish(self, verdict: str) -> int:
        print()
        if self.failures:
            print(f"✗ {self.battery}: {len(self.failures)} failure(s):")
            for f in self.failures:
                print(f"  - {f}")
            return 1
        print(f"✓ {self.battery}: {verdict}")
        return 0


def unique(tag: str) -> str:
    """A value unique to THIS run — order ids, station names, combo refs — so two runs against the
    same shared hub (or a re-run after a positive-control mutation) never collide on a row the
    previous run already wrote."""
    return f"hub-battery-{tag}-{uuid.uuid4().hex[:8]}"


def catalog_product(hub: Hub, name: str, sku: str, price: int) -> str:
    """Seeds a product in the REAL catalogue and returns its id.

    A `product_id` can no longer be made up (sales#175): opening an order FREEZES the price of its
    lines from the trusted catalogue, so `sales.order.open` prices any line naming a `product_id`
    from `inventory.products.for_sale` and REJECTS one that is not there with
    `sales.product_not_available`. A line with only `product_name` is a free-price line and the
    catalogue has nothing to say about it — which is why a test that never routes a product to a
    station can open an order without seeding anything. A test that DOES need product→station
    routing has to seed the product for real; `price` is what the order line ends up frozen at."""
    hub.run(
        "inventory.products.create",
        {
            "name": name,
            "sku": sku,
            "price": price,
            "cost": 0,
            "stock": 100_000_000,
            "low_stock_threshold": 0,
            "product_type": "physical",
            "ean13": None,
            "description": "",
            "tax_category_key": "product.generic",
            "image": "",
        },
    )
    rows = hub.query("inventory.products.list")
    match = next((r for r in rows if r.get("name") == name), None)
    if match is None:
        raise AssertionError(f"`{name}` must be in the catalogue just seeded: {rows}")
    return match["id"]


def open_order(hub: Hub, items: list[dict]) -> str:
    """Opens a `sales` order with the given lines and returns its id. Every ticket in this module
    is born from an order (ADR-0141): kitchen never invents one of its own."""
    out = hub.run("sales.order.open", {"items": items})
    order_id = (out.get("new_ids") or [None])[0]
    if not isinstance(order_id, str) or not order_id:
        raise AssertionError(
            f"sales.order.open did not answer the order id in new_ids[0]: {out}"
        )
    return order_id


def fire(
    hub: Hub, order_id: str, label: str = "Mesa 4", channel: str = "dine_in"
) -> None:
    """Fires the order to production — `sales.order.fire` reads the lines from `sales_order_item`
    itself (kitchen#54): nothing sent here can fake what actually got sent to the kitchen."""
    hub.run(
        "sales.order.fire",
        {"order_id": order_id, "label": label, "channel": channel},
    )


def wait_for_tickets(
    hub: Hub, order_id: str, count: int, timeout: float = 8.0, interval: float = 0.1
) -> list:
    """Polls `kitchen.orders.list` until `order_id` has fired exactly `count` tickets.

    `order.fired` reaches `kitchen.orders.create_from_order` through the outbox relay (see the
    module docstring above), so the row this asks for may not exist the instant `fire()` returns.
    Fails LOUDLY on timeout, naming what it actually saw — a `wait_for_tickets` that gave up quietly
    with fewer rows than asked would be indistinguishable from the listener never firing at all."""
    deadline = time.monotonic() + timeout
    seen: list = []
    while time.monotonic() < deadline:
        seen = [
            c
            for c in hub.query("kitchen.orders.list")
            if c.get("source_order_id") == order_id
        ]
        if len(seen) >= count:
            return seen
        time.sleep(interval)
    raise AssertionError(
        f"timed out after {timeout}s waiting for {count} kitchen ticket(s) of order "
        f"{order_id}, saw {len(seen)}: {seen}"
    )


def the_one_ticket(hub: Hub, order_id: str, timeout: float = 8.0) -> dict:
    """The single kitchen ticket a `source_order_id` fired — fails loudly if it fired zero or more
    than one, which is always a battery bug (each test fires its own fresh order)."""
    rows = wait_for_tickets(hub, order_id, 1, timeout=timeout)
    if len(rows) != 1:
        raise AssertionError(
            f"expected exactly one kitchen ticket for order {order_id}, got {len(rows)}: {rows}"
        )
    return rows[0]
