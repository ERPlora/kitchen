# Kitchen — Concepts

The things people get wrong on their first day.

## The ticket is born when the waiter fires, not when the customer pays

This is the most important thing in the module. A kitchen ticket comes from the **order**, at the
moment the waiter sends it — an hour before anyone pays.

It used to come from the completed sale, which meant food left for the kitchen when the customer was
already finishing. If you remember that behaviour, it is gone.

## Every fire is a new round

Pressing send again does not resend the whole check. It sends **only the lines never fired before**,
as a new round, and creates a new ticket for it. Lines already fired carry their round number and the
moment they were sent, permanently.

This is why a line that has been fired never goes back to "pending" when checks are split or merged —
the same food would be cooked twice.

## Kitchen has no idea what a table is

All the module receives from the dining room is an **opaque label**: a string like "Mesa 4", "Barra"
or "Recogida Ana". It prints it exactly as it arrived and never interprets it.

That is deliberate. Kitchen does not depend on `tables`, so a takeaway pizzeria, a bakery or a
workshop can produce with no dining room at all. Turning `tables` off does **not** turn off Kitchen.

The same goes for the sale, the customer and the product: all of them are stored as opaque references,
never joined.

## The destination belongs to the station, not to the ticket

Whether work comes out on a screen, on paper, or both is configured **once per station** — "hot line
prints, bar is screen only" — rather than decided on every fire.

Each ticket line carries the destination of its station, which is what the printing code reads so it
never sends a display-only station to paper.

## Printing lives outside this module, and a printer failure never blocks anyone

The kitchen ticket is printed by the shell, not by Kitchen, so that it prints **even when the KDS
screen is not open** — a hot line is usually paper only.

Two consequences:

- Tickets going to the same **printer role** are grouped into one sheet. Two stations sharing a
  printer produce one page, not two.
- **The database is the source of truth; the paper is a copy.** If a printer fails, the ticket exists
  and the KDS shows it. You are warned and you can reprint. The waiter is never blocked.

## Routing is per product; per category is inert

A product is mapped to the station that prepares it, and the routing is resolved in SQL as the line is
inserted, in the same transaction.

**Category routing does not work.** The fallback exists but nothing can trigger it: the till does not
send a category, and a product can belong to several categories at once, so a single category value
cannot model the case. Do not rely on it.

## Status cascades from the ticket to its lines

Changing a ticket's status pushes that status down to its lines and stamps the timestamps. Lines also
have their own status, so a station can bump its part, but a header transition moves everything.

**Recall** is the way back: a ticket that was bumped too early can be pulled back onto the screen. It
is a first-class action with its own event, not an undo hack.

The path is fixed: **pending → preparing → ready → served**, recall from ready back to preparing,
cancel from anything not yet served; served and cancelled are final. The module checks the ticket's
real state before moving it — a transition outside the path is refused, writes nothing and emits no
event, so nobody downstream ever hears about a state that is not in the database.

## Deleting a ticket is guarded

You can only delete a ticket that is `pending` or `cancelled` **and** not tied to a sale. Anything
that has been cooked or charged is history and stays. Deletion is a soft delete everywhere in this
module.

The same idea protects stations: one with routings or lines in progress cannot be deleted.

## The audit log writes itself

You never write to the log. Every state change emits an event, and the module listens to its **own**
events to record what happened, who did it and when. That is why the log is complete even for actions
taken from the display.

## Auto-accept and auto-bump are settings, not behaviour yet

Both exist in the settings and describe what should happen over time. **Nothing runs on a timer to
enforce them** — there is no scheduled task in this module. Do not assume a ready ticket will clear
itself.

## Firing with Kitchen inactive loses the ticket

The till can currently fire an order while Kitchen is switched off. Sales marks the lines as sent, the
event is considered delivered, and **no kitchen ticket is ever created**. There is no guard yet.

Practical rule: fire only from Kitchen's own visible button, and never from an integration when the
module is inactive.

## Turning the module off hides it; it does not erase it

Deactivating Kitchen removes the *Comanda actual* segment, the send button and the KDS history from
the till. Stations, tickets and the audit log are untouched, and come back when it is reactivated.

Because the sell screen resolves its panels when it mounts, you must leave the till and come back for
the change to show.

## Prices are integer cents

Line prices, modifier prices and totals are **cents** (ADR-0123). `250` is 2,50 €.
