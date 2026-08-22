-- Auditoría de acciones del KDS (más recientes primero). Runtime inyecta :hub_id.
-- Portado de KitchenLogService.list_logs. Los filtros opcionales (order_number/action/station_id)
-- se pasan como binds; usar '' para "sin filtro" (NULL-safe vía coalesce).
--
-- kitchen#44: la columna Comanda muestra el NÚMERO de la comanda (lo que el KDS enseña), no el
-- UUID de su fila. Se resuelve aquí con un JOIN contra la propia comanda, acotado POR HUB (la
-- lección de pm#89: unir por id a secas deja entrar al vecino) y SIN is_deleted — el rastro
-- sobrevive a la comanda que audita: una comanda borrada sigue teniendo su número aquí.
SELECT l.id, l.order_id, o.order_number, l.order_item_id, l.station_id, l.action,
       l.performed_by_id, l.notes, l.created_at
FROM kitchen_order_log l
LEFT JOIN kitchen_order o ON o.id = l.order_id AND o.hub_id = l.hub_id
WHERE l.hub_id = :hub_id AND l.is_deleted = 0
