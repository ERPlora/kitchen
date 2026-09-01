-- The KDS feed (kitchen#4): every ticket on the line (pending / preparing / ready) with its lines,
-- ONE ROW PER LINE (a ticket without lines still comes back once, with NULL line columns). The
-- Web Component groups by `order_id`, filters by station and derives elapsed time / the
-- green-amber-red semaphore CLIENT-SIDE against `kitchen_settings` — presentation, and the clock
-- must not depend on the latency of this query. Runtime injects :hub_id.
--
-- Station, destination and printer role come from the SNAPSHOT of the line, never from a live join
-- to `kitchen_station` (see order_items.sql): where a round went is a historical fact.
-- `ready` tickets stay in the feed so the KDS can RECALL them (bump/recall travel as a pair).
SELECT o.id            AS order_id,
       o.order_number,
       o.status        AS order_status,
       o.order_type,
       o.priority,
       o.label,
       -- kitchen#63 · WHO fired the round. An OPAQUE id (`hub_user.id`), never joined here: the
       -- name is presentation and the KDS resolves it through `hub.users.list`, the core's
       -- reserved namespace (ADR-0192). Joining a core table from a module query would tie the
       -- feed of the pass to the shape of the hub's own tables for a label.
       o.waiter_id,
       o.round_number,
       o.notes         AS order_notes,
       o.fired_at      AS order_fired_at,
       o.ready_at,
       o.created_at    AS order_created_at,
       i.id            AS item_id,
       i.station_id,
       i.station_name,
       i.destination,
       i.product_name,
       i.quantity,
       i.modifiers,
       i.notes         AS item_notes,
       i.status        AS item_status,
       i.seat_number,
       i.completed_at,
       -- kitchen#57 · the MENU this line belongs to (ADR-0381). The WC groups by `combo_ref` and
       -- paints `combo_name` as a header with its components listed under it — the cook has to
       -- see that those three dishes are ONE menu of ONE table, or they leave the pass out of
       -- sync. A run-on paragraph is the documented Square failure and is what this replaces.
       i.combo_ref,
       i.combo_name,
       i.line_seq
FROM kitchen_order o
LEFT JOIN kitchen_order_item i
       ON i.order_id = o.id AND i.hub_id = o.hub_id AND i.is_deleted = 0
WHERE o.hub_id = :hub_id AND o.is_deleted = 0
  AND o.status IN ('pending', 'preparing', 'ready')
-- ORDER OF CHOICE inside the ticket. Every line of one dispatch is written in the same
-- transaction with the SAME `created_at`, so sorting by it alone leaves the order to the planner
-- and the components of a menu come back shuffled. `created_at` stays behind it for rounds fired
-- before migration 008, which carry `line_seq = 0` and so keep their relative order.
ORDER BY o.created_at ASC, i.line_seq ASC, i.created_at ASC, i.id ASC;
