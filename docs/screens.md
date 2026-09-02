# Kitchen — Screens

The module contributes four tabs to the hub navigation — **Display**, **Commands**, **Stations**
and **History** — plus a **Kitchen** settings tab the shell generates from the declarative settings
block. It also injects two panels into the sell screen.

## Display — the KDS

A grid of tickets, one card per order (kitchen#4). Each card shows the label the waiter sent
("Table 4", "Bar", "Pickup Ana"), the ticket number, the round, a rush/VIP badge and its lines with
quantity, modifiers, notes and seat. Requires `kitchen.view_order`; bumping needs
`kitchen.change_order`, serving `kitchen.complete_order`.

- **One command bar** (kitchen#60). A single row, ~50 px: the three views (**Tickets** ·
  **Ready** · **All-Day**, each with its live count), the full-screen button, and the station
  chips. It sticks to the top, so a busy board never scrolls the station filter out of reach.
- **Stations.** The chips filter the cards by the station frozen on each line; the first entry is
  the expo/pass view (every station). A card only shows the lines of the station you are on.
- **One tap = bump.** Tap a line to mark it ready (it is struck through); tap a struck line to
  recall it. Tap the card header (or **Bump**) to bump every line on screen still cooking — only
  those: a bump on the bar never clears the grill's lines from the expo. When no line of the ticket
  is left cooking, the ticket goes **ready** by itself and **leaves the active board** for the
  **Ready** view, where **Recall** brings it back and **Served** hands it over. There is never a
  confirmation dialog: recall is the undo.
- **Ready is a view, not a section.** It used to be a second grid painted under the first one, so a
  finished ticket dropped *below* the one still cooking instead of leaving the line. Every KDS
  reviewed moves it out of the active board — a tab in Square and Loyverse, a recall bar in Toast
  and Fresh — and this is the tab, one tap away with its count.
- **Full screen.** The KDS is the one screen of this module that is a wall display, so its
  navigation entry declares `chrome: ["fullscreen"]` and the bar offers the control. The shell
  hides its sidebar, topbar and tabbar and calls the Fullscreen API; the module only asks
  (ADR-0048). Against a shell that does not announce the capability, no button is painted.
- **Semaphore.** Each card ages from the moment it was fired: green, then amber past
  `warning_time_minutes`, then red past `critical_time_minutes` (settings). The clock keeps
  counting in red; `show_timer` hides the clock and `color_coding_enabled` turns the colours off.
- **All-Day.** The third view sums what is left to cook per product (and per station in the expo
  view), so the fryer fires one batch instead of six.
- **Read from a metre away.** Equal columns sized against the viewport (`clamp(15rem, 22vw, 22rem)`
  — four tickets across a 1440 screen, one on a phone) and type at kitchen size: the dish 1.4 rem,
  the quantity 1.6 rem, the station 1 rem. The ticket header wraps rather than shrink, so the table
  and the waiter who fired the round always read in full.
- **The pass on paper** (kitchen#70). With «Print the pass when marked ready» on, the moment a
  ticket goes `ready` the plates leaving the kitchen are queued to the printer of **their own
  station** — one sheet per printer role, screen-only stations left out. It is the sheet the runner
  takes with the food, and it is NOT the kitchen order of the fire, which station routing already
  prints. The job id carries the (ticket, role) pair, so the same bump reaching three mounted boards
  is one sheet, not three; a printer that refuses it leaves a warning on the board and never blocks
  the screen. Off by default.
- **The chime** (kitchen#48, kitchen#72). An arriving ticket rings — the arrival, not the presence:
  the board reloads on every bump, and the first feed after opening never rings. «Sound volume» and
  «Sound tone» (`chime`, `bell`, `buzzer`, all synthesised) are the two controls the kitchen forums
  ask for; their defaults are exactly the chime that rang before they existed.
- Reloads by itself on every `kitchen.order.*` / `kitchen.item.*` event — no polling.

## History — the audit trail

Every action the kitchen recorded (`kitchen.logs.list`): received, fired, line ready, line
recalled, ready, served, recalled, cancelled. Requires `kitchen.view_log`.

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

> Routing by category is live (sales#12): the till sends the product's **primary** category with each
> fired line. A product mapping beats the category mapping; an unmapped product of an unmapped
> category has no station and shows under «No station» on the KDS.

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

**Nine controls, and every one of them moves something** (kitchen#48). The screen used to publish
sixteen and only five reached any code — a manager switched «Sound» on so the line would hear the
tickets and nothing ever beeped. The nine that survived are pinned by
`tests/every_setting_moves_something.contract.test.py`, which fails if a setting is published
without a reader.

| Setting | What it controls |
|---|---|
| Show timer | Whether the ticket carries its clock |
| Amber warning / red alert (minutes) | The two steps of the ageing semaphore |
| Colour semaphore | Whether the ticket is coloured by how long it has been waiting |
| Sound on a new ticket | Whether an arriving ticket rings (kitchen#48) |
| Sound volume (0-100) | How loud it rings. Default = the volume the module has always rung at |
| Sound tone | `chime`, `bell` or `buzzer`, all synthesised — no file to upload, like the market (kitchen#72) |
| Print the pass when marked ready | Every bump prints the plates going out on their station's printer (kitchen#70). **Off by default**: it is new paper, and Toast, Fresh KDS and MobiPOS ship it off too |
| Default order type | `dine_in`, `takeaway` or `delivery` |

The retired controls (`auto_accept_orders`, `items_per_page`, `auto_refresh_seconds`,
`sound_on_new_order`, `sound_on_rush`, `auto_bump_enabled`, `auto_bump_delay_seconds`, `use_rounds`,
`auto_fire_on_round`) keep their COLUMN and their saved value — dropping a column needs a
`kind: contract` migration no module can publish — the form just stops offering them.
