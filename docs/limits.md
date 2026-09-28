# Kitchen — Limits and troubleshooting

## Known limitations you should know about

- **Category routing uses the product's PRIMARY category.** A product in several categories routes by
  the first one the till knows; map the product itself when that is not the station you want.
- **Firing with Kitchen inactive silently loses the ticket.** The lines are marked as sent and no
  ticket is created. There is no guard yet — do not fire from an integration when the module is off.
- **Auto-accept and auto-bump do nothing on their own.** They are settings; no scheduled task drives
  them.
- **Slots do not refresh in a mounted screen.** After activating or deactivating the module, leave
  the till and come back.
- **`printer_name` on a station is obsolete.** The field is kept but nothing reads it; the printer
  **role** is what matters.

## Refusals you will actually see

| Refusal | What happened | What to do |
|---|---|---|
| `kitchen.invalid_transition` | The ticket is not in a state that accepts that action (e.g. serving one that is not ready, bumping one already served) | Refresh — the row shows its real state — and pick an action it accepts |
| `kitchen.order_unavailable` | The ticket does not exist in this business or was deleted | Refresh the list |
| Ticket delete refused | It is not `pending` or `cancelled`, or it is tied to a sale | Cancel it instead; cooked or charged work is history |
| `kitchen.station_in_use` | The station still has products or categories routed to it, or lines being prepared | Move the routings to another station and finish the work first |
| `kitchen.station_name_taken` | Another LIVE station of this business already has that name (a deleted station does not hold its name) | Choose a different name |
| Routing rejected | The target station is inactive or does not exist | Activate or create the station |
| Invalid order type | Something other than `dine_in`, `takeaway`, `delivery` | Use one of the three |

## Accepted values

| Field | Values |
|---|---|
| Ticket status | `pending` (To prepare), `preparing`, `ready`, `served`, `cancelled` |
| Order type | `dine_in`, `takeaway`, `delivery` |
| Priority | `normal`, `rush`, `vip` |
| Station destination | `display`, `printer`, `both` |
| Log action | `received`, `accepted`, `started`, `bumped`, `completed`, `served`, `recalled`, `cancelled`, `priority_changed`, `item_bumped` |

## Caps and sizes

| Limit | Value |
|---|---|
| Rows per page (tickets, stations, log) | 50 |
| Maximum rows a paginated request may ask for | 500 |
| Tickets per day per hub, by numbering | 9999 |
| Stations sharing one printer role | unlimited — they are grouped into one sheet |

## Permissions per action

| To do this | You need |
|---|---|
| See tickets, lines, stations and pending counts | `kitchen.view_order` |
| Create a ticket, fire from the till | `kitchen.add_order` |
| Edit a ticket, fire it, mark it ready, recall it | `kitchen.change_order` |
| Mark a ticket served | `kitchen.complete_order` |
| Delete a ticket | `kitchen.delete_order` |
| Cancel a ticket | `kitchen.cancel_order` |
| See the audit log | `kitchen.view_log` |
| Write an entry in the audit log by hand | `kitchen.add_log` |
| See / change the KDS settings | `kitchen.view_settings` / `kitchen.change_settings` |
| Create, edit or delete a station; configure routing | `kitchen.manage_settings` (admin only) |

By role: **admin** has everything. **manager** manages tickets and settings, cancels tickets and may
annotate the audit log by hand. **employee** (the cook) can **see, create, fire, bump, recall and
serve** tickets and read the settings and the log — an employee **cannot** cancel a fired ticket,
cannot delete, cannot write in the audit log by hand, and cannot touch stations or routing.

## Dependencies — what breaks if something is missing

**`sales` and `inventory` are required** and are installed automatically with Kitchen. You cannot
uninstall either while Kitchen is installed.

- Without `sales`, nothing emits `order.fired`, so no ticket is ever created from the floor.
- Without `inventory`, a ticket line cannot resolve the product's name, price or station.

**`tables` and `customers` are NOT dependencies.** Kitchen works with no dining room and no CRM; the
room reference is just a label.

**Nothing depends on Kitchen.** Turning it off removes the kitchen surface from the till and the KDS;
sales, tables, customers and checks keep working, and Kitchen's own data is preserved.

## When something looks wrong

**"I fired an order and nothing appeared in the kitchen."** In this order: is Kitchen **installed and
active**? Did you press send from Kitchen's own button? Were there actually **unfired** lines — a
second press with nothing new sends nothing. And if Kitchen was inactive when you fired, the ticket
was lost: the lines are marked sent but no ticket exists.

**"The same dish was cooked twice."** Check the rounds on the ticket. A fired line does not return to
pending, so this normally means it was added twice on the check, not fired twice.

**"A product goes to the wrong station."** Open Stations and check the product's mapping first (it
beats the category); then the mapping of the product's primary category.

**"Nothing prints for a station."** Its destination is probably `display`. Set it to `printer` or
`both`. Also check the printer role — `printer_name` is obsolete and read by nobody.

**"The printer failed and the order is lost."** It is not. The ticket is in the database and on the
KDS; reprint it.

**"Two stations printed the same sheet."** They share a printer role, and grouping is deliberate —
one printer, one sheet.

**"The display does not refresh."** It reloads on `kitchen.order.*` events. If it is stale, the
events are not arriving; check that the ticket actually changed state.

**"Ready tickets pile up."** Auto-bump is a setting but nothing enforces it. Bump them.

**"I turned Kitchen off and the check still shows sent lines."** Those marks belong to `sales`, not
Kitchen, and are kept on purpose.

**"The kitchen surface did not disappear after deactivating the module."** Leave the till screen and
come back — panels are resolved when the screen mounts.
