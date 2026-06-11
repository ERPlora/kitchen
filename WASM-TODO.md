# kitchen — estado Tier 2 (WASM) y lógica pendiente

Módulo único de cocina (fusión `kitchen` + `kitchen_orders`, ADR-0014). El handler WASM
(`handler/src/lib.rs` → `dist/handler.wasm`) está **implementado** para los 6 commands Tier 2:
`create_order`, `update_order_status`, `delete_order`, `create_order_from_sale`,
`delete_station`, `set_routing`.

> Regla hub: el WASM **nunca toca la BD**. Recibe `{payload, context}` y devuelve
> *intenciones* (commands `_`-prefijados del propio módulo) que el runtime valida y
> persiste en UNA transacción, más los eventos a emitir. Importes `quantize(0.01)`
> (redondeo half-even, igual que sales).

## Adaptaciones al runtime actual (sin lecturas pre-cargadas)

El diseño original preveía que el handler leyera datos (comanda, líneas,
`inventory.products.get`) antes de decidir. El runtime de hoy solo pasa
`{payload, context{hub_id, current_user_id, now, new_ids}}`, así que:

1. **Snapshot de producto en el payload** (patrón `sales`): `product_name`/`unit_price` y
   (para enrutado por categoría) `category_id` los aporta el caller en `items[]`.
   Cuando el runtime soporte lecturas pre-cargadas, `create_order` podrá resolverlos vía
   la query pública `inventory.products.get`.
2. **Routing en SQL**: `_insert_item` resuelve la estación en la misma transacción
   (override explícito > mapeo producto > mapeo categoría > NULL; solo estaciones activas).
3. **Guardas de estado en el WHERE** de la intención (no-op si no se cumplen, sin mensaje
   de error): recall solo desde `ready`; delete_order solo `pending|cancelled` y sin
   `sale_id`; delete_station sin routings ni líneas en curso; route_set solo a estación
   activa. Mejora futura: con lecturas pre-cargadas, devolver errores tipados
   (`cannot_delete_status`, `station_has_routings`, …).
4. **Cascada set-based**: `_cascade_item_status` actualiza las líneas por
   `order_id`+`from_status` (no 1 intención por línea).
5. **order_number atómico** `YYYYMMDD-NNNN`: `_bump_counter` (upsert sobre
   `kitchen_order_counter`) + subquery en `_insert_order` (patrón `sales`; `printf()`
   es SQLite — en Postgres sería `lpad()`, portabilidad §14).
6. **Idempotencia create_from_sale**: índice único parcial `uq_kitchen_order_sale`
   (`hub_id, sale_id`) + marcador `_event_delivery` del runtime (exactly-once).
7. **Eventos por transición**: los commands WASM NO declaran `emit` (el runtime emitiría
   todos en cada llamada); el evento correcto (`kitchen.order.fired|ready|served|recalled|
   cancelled|created|deleted`) lo devuelve el handler con el payload que espera el
   listener `kitchen.logs.create` (order_id/action/notes/performed_by_id).

## Pendiente (NO cubierto por el handler actual)

1. **Display agregado** (`get_display` legacy): comandas activas agrupadas por estación con
   `elapsed_minutes`/`is_delayed` (umbrales de `kitchen_settings`) y cola de `ready`.
   Lógica de presentación → WC/queries propias; los campos calculados pueden derivarse
   en el cliente con `kitchen.orders.list` + `kitchen.stations.pending_counts`.
2. **Bump/recall a nivel LÍNEA** (`bump_item` con auto-bump del pedido si todas listas):
   necesita lecturas pre-cargadas (estado del resto de líneas) o un command SQL set-based
   adicional. Hoy el bump es a nivel comanda (`mark_ready`).
3. **Auto-accept / auto-bump temporizados** (`auto_accept_orders`, `auto_bump_enabled` +
   `auto_bump_delay_seconds`): reglas de background → scheduled task / handler del runtime.
4. **Permisos finos por acción** en `set_status` (cancel→`cancel_order`,
   mark_served→`complete_order`): el manifest gatea todo con `change_order`; honrar el
   permiso por acción requiere un check adicional del runtime.
5. **PATCH por-campo de settings** con `updated_fields`: el command declarativo persiste el
   snapshot completo (la UI envía todo); un merge real necesitaría leer la fila.
6. **Push WS en vivo + sonidos**: responsabilidad del transporte/runtime y de la UI
   (`erplora.on`), no del módulo.
