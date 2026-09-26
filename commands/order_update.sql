-- Update of the editable fields of an order. Runtime injects :hub_id, :current_user_id, :now.
-- COALESCE leaves untouched the fields not sent (the SDK passes NULL for "do not change").
-- kitchen#99: rush_count bumps on every transition INTO 'rush' so the rush notice jobId gets a
-- fresh value each time — a round rushed, cleared and rushed again must print a second notice.
UPDATE kitchen_order
SET notes       = COALESCE(:notes, notes),
    priority    = COALESCE(:priority, priority),
    rush_count  = rush_count + CASE WHEN :priority = 'rush' AND priority <> 'rush' THEN 1 ELSE 0 END,
    order_type  = COALESCE(:order_type, order_type),
    table_id    = COALESCE(:table_id, table_id),
    waiter_id   = COALESCE(:waiter_id, waiter_id),
    customer_id = COALESCE(:customer_id, customer_id),
    updated_by  = :current_user_id,
    updated_at  = :now
WHERE id = :order_id AND hub_id = :hub_id AND is_deleted = 0;
