# Kitchen — Overview

## What this module does

Kitchen is the single production module: the **kitchen display system** (KDS), the **kitchen tickets**
themselves, the **stations** that work is routed to, and the **audit log** of everything the kitchen
did. A ticket is born when a waiter **fires** an order — not when the customer pays — travels through
its states, and is bumped when it is served.

It also puts a "send order" button and a live order status into the sell screen, so a waiter never
has to leave the till to see how their food is doing.

## What this module does NOT do

- **It does not know about the dining room.** It has no idea what a table is. All it receives is an
  **opaque label** — "Mesa 4", "Barra", "Recogida Ana" — which it prints exactly as it arrived.
- **It does not print.** The kitchen ticket is printed by the shell, not by this module, so that it
  prints even when the KDS screen is not open — a hot line is often paper only.
- **It does not charge anything.** Money belongs to `sales`.
- **It does not decrease stock.** That is `inventory` reacting to the sale.
- **It does not manage recipes or ingredients.**
- **It does not run timed rules by itself.** Auto-accept and auto-bump exist as settings, but no
  scheduled task drives them yet.

## Modules it connects to

**Depends on `sales` and `inventory`** — installing Kitchen installs both. It needs `sales` for the
firing event, and it reads `inventory` public queries to resolve a product's name, price and category
when it builds a ticket line. It **never** reads another module's tables.

It does **not** depend on `tables` or `customers`. A takeaway pizzeria, a bakery or a workshop
produces without a dining room.

**Events it listens to**

| Event | Runs | Effect |
|---|---|---|
| `order.fired` (from `sales`) | `kitchen.orders.create_from_order` | Creates the kitchen ticket for that round |
| `kitchen.order.fired` / `.ready` / `.served` / `.recalled` / `.cancelled` | `kitchen.logs.create` | Writes the audit trail |

**Events it emits**

| Event | When |
|---|---|
| `kitchen.order.created` | a ticket is created |
| `kitchen.order.updated` | a ticket is edited |
| `kitchen.order.fired` / `.ready` / `.served` / `.recalled` / `.cancelled` | the status changes |
| `kitchen.order.deleted` | a ticket is deleted |
| `kitchen.station.created` / `.updated` / `.deleted` | stations change |
| `kitchen.routing.changed` | product routing is reconfigured |
| `kitchen.settings.updated` | the settings are saved |

**It fills two slots in the till.** A **"Enviar comanda"** (send order) button inside the *Comanda
actual* view, and a **status/history** panel showing the rounds already sent. Both disappear if the
module is inactive — and so does the whole kitchen surface in the POS.

## The vocabulary

| Concept | Values |
|---|---|
| **Ticket status** | `pending`, `preparing`, `ready`, `served`, `paid`, `cancelled` |
| **Order type** | `dine_in`, `takeaway`, `delivery` |
| **Priority** | `normal`, `rush`, `vip` |
| **Station destination** | `display`, `printer`, `both` |
| **Log action** | `received`, `accepted`, `started`, `bumped`, `completed`, `served`, `recalled`, `cancelled`, `priority_changed`, `item_bumped` |

## Where its numbers come from

- **Prices and modifier prices are integer cents** (ADR-0123).
- **Ticket numbers** are `YYYYMMDD-NNNN`, from an atomic per-day counter.
- **A round number** counts how many times the same order has been fired.
