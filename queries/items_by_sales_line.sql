-- Every line of the round(s) that carry one sales line (kitchen#161): what the listener of
-- `sales.order.line_voided` needs to strike that dish AND to decide whether the round follows
-- (nothing left → cancelled; only ready dishes left → ready). One sales line opens one kitchen
-- line, or one per component of a menu (kitchen#57). Runtime injects :hub_id.
-- Each row carries the round's status and the check it hangs from: the handler re-checks both.
SELECT i.id,
       i.order_id,
       i.status,
       i.station_id,
       i.sales_order_item_id,
       o.status          AS order_status,
       o.source_order_id
FROM kitchen_order_item i
JOIN kitchen_order o
  ON o.id = i.order_id AND o.hub_id = i.hub_id AND o.is_deleted = 0
WHERE i.hub_id = :hub_id AND i.is_deleted = 0
  AND i.order_id IN (SELECT v.order_id
                       FROM kitchen_order_item v
                      WHERE v.hub_id = :hub_id AND v.is_deleted = 0
                        AND v.sales_order_item_id = :sales_order_item_id)
ORDER BY o.created_at ASC, i.line_seq ASC, i.created_at ASC, i.id ASC;
