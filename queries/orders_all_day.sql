-- All-Day view (kitchen#4, Toast's "All Day"): how many of each product are still to be made,
-- summed across every ticket on the line, per station snapshot — so the fryer fires ONE batch of
-- twelve croquetas instead of six batches of two. Only lines still cooking (pending/preparing) of
-- tickets still on the line count; a bumped line leaves the count at once.
-- `quantity` is fixed-point 10⁶ (ADR-0147): the WC divides to render. Runtime injects :hub_id.
SELECT i.product_name,
       i.station_name,
       SUM(i.quantity) AS quantity,
       COUNT(*)        AS lines
FROM kitchen_order_item i
JOIN kitchen_order o
  ON o.id = i.order_id AND o.hub_id = i.hub_id AND o.is_deleted = 0
 AND o.status IN ('pending', 'preparing')
WHERE i.hub_id = :hub_id AND i.is_deleted = 0
  AND i.status IN ('pending', 'preparing')
GROUP BY i.product_name, i.station_name
ORDER BY SUM(i.quantity) DESC, i.product_name ASC;
