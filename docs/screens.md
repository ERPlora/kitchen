# Kitchen — Screens

The module contributes three tabs to the hub navigation — **Display**, **Commands** and
**Stations** — plus a **Kitchen** settings tab the shell generates from the declarative settings
block. It also injects two panels into the sell screen.

## Display — the kitchen screen

The KDS. It shows the live tickets and reloads by itself whenever any `kitchen.order.*` event
arrives — no polling, no refresh button. Requires `kitchen.view_order`.

This is the screen the line works from: tickets appear when a waiter fires an order, and are bumped
as they are cooked and served.

## Commands — the tickets

Every kitchen ticket with its status (`kitchen.orders.list`, 50 rows per page). Newest first.
Requires `kitchen.view_order`.

- **Search** by order number, customer or round number.
- **Sort and filter** by number, status, order type, priority, table, sale, customer, waiter, round,
  notes, totals, and the fired / ready / served timestamps.

Open a ticket to see its lines (`kitchen.orders.items`). Each line carries its own status, its seat
number, its modifiers and **the destination of its station** — which is what the printing code needs
to avoid sending a display-only station to paper.

### Move a ticket through its states

From the display or the ticket, apply one of: **fire**, **mark ready**, **mark served**, **recall**
or **cancel**. The change cascades from the ticket header down to its lines and stamps the
corresponding timestamp, then emits the matching event, which is also what writes the audit log.

The ticket moves **pending → preparing → ready → served**; *recall* takes a ready ticket back to
preparing; *cancel* works on anything not yet served. *Served* and *cancelled* are final. A
transition outside that path is refused (`kitchen.invalid_transition`) — nothing is written and no
event goes out — and the table only enables the buttons the ticket's state accepts. If your screen
was stale, the message tells you and the row refreshes to its real state.

Firing, marking ready and recalling need `kitchen.change_order`; marking served needs
`kitchen.complete_order` — the cook has both. Cancelling a fired ticket is a front-of-house decision
and needs `kitchen.cancel_order`, which the cook does not have. A verb you cannot run is not shown.

### Create a ticket by hand

Normally you never do this — firing an order in the till creates it. When you do:

1. Add the lines; the module resolves each product's name, price and station from `inventory`.
2. Pick the order type (`dine_in`, `takeaway`, `delivery`).
3. Save. The ticket gets its number `YYYYMMDD-NNNN` and its totals.

Requires `kitchen.add_order`.

### Delete a ticket

Refused unless the ticket is `pending` or `cancelled` and is not tied to a sale. Requires
`kitchen.delete_order`.

## Stations

The production points — Bar, Grill, Desserts (`kitchen.stations.list`, 50 rows per page). Sorted by
name. Requires `kitchen.view_order` to see; `kitchen.manage_settings` to change.

A station has a name, a colour, an icon, a sort order, an active flag, and two fields that decide how
its work comes out:

| Field | Meaning |
|---|---|
| **Destination** | `display` (screen only), `printer` (paper only) or `both` — default `both` |
| **Printer role** | Which printer role receives it — default `kitchen` |

### Route products to a station

1. Open **Stations** and configure routing.
2. Map each product to the station that prepares it.
3. Save. `kitchen.routing.changed` is emitted.

Every ticket line is routed to its station **when the line is inserted**, in the same transaction.

> ⚠️ **Routing by category does not work today.** The fallback exists but cannot fire: the till does
> not send a category, and a product can belong to several categories. Only **per-product** routing
> is live.

### Delete a station

Refused while it still has routings or lines in progress. Requires `kitchen.manage_settings`.

### See what is pending per station

`kitchen.stations.pending_counts` gives the number of pending lines grouped by station — the "how
buried is the grill right now" number.

## The audit log

Every state change is recorded (`kitchen.logs.list`, 50 rows per page, newest first). Reading it
requires `kitchen.view_log` — an employee has it. Adding an entry by hand (`kitchen.logs.create`)
requires `kitchen.add_log` (manager); the automatic entries are written by the module itself.

Each entry carries the ticket, the line, the station, the action, who did it and any notes. Filter by
any of those, or by date range.

## In the till: fire and follow an order

Two panels contributed by this module appear in the sell screen when Kitchen is installed:

### Send an order

1. Build the check normally.
2. Switch to **Comanda actual**. It lists only the lines not yet sent.
3. Press **Enviar comanda**. Those lines are fired as a new round and a kitchen ticket is created.

Requires `kitchen.add_order`.

### Follow what you sent

The order-info panel shows the rounds already sent and their live state — `pending`, `preparing`,
`ready`, `served` — refreshed by the kitchen events themselves. Requires `kitchen.view_order`.

## Kitchen — settings

Generated by the shell from the settings schema. Requires `kitchen.change_settings`; the module also
defines `kitchen.manage_settings` for stations and routing (admin only).

| Setting | What it controls |
|---|---|
| Auto-accept orders | Tickets are accepted without a manual step |
| Show timer, warning and critical minutes | The ageing colours on the display |
| Items per page, auto-refresh seconds | Display density and refresh cadence |
| Sound enabled, on new order, on rush | Audible alerts |
| Auto-bump enabled and its delay | Whether ready tickets clear themselves |
| Colour coding | Colour by state or ageing |
| Auto-print tickets | Whether a fired ticket goes to paper automatically |
| Use rounds, auto-fire on round | Round behaviour |
| Default order type | `dine_in`, `takeaway` or `delivery` |
