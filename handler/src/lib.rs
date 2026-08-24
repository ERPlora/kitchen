//! Handler WASM (Tier 2) del módulo `kitchen` — comandas de cocina (fusión ADR-0014).
//!
//! Lógica pura, sin BD: cada función recibe `{payload, context}`, calcula y devuelve
//! **intenciones** (commands `_`-prefijados del propio módulo) que el host valida y
//! ejecuta en UNA transacción, más los eventos `kitchen.*` a emitir.
//!
//! Restricciones del runtime actual:
//! * el snapshot de producto (`product_name`/`unit_price`/`category_id`) viaja en el
//!   payload (patrón `sales`); la resolución de estación (routing) se aplica EN EL SQL de la
//!   intención. Las transiciones de estado leen la fila pre-cargada (`reads`, ADR-0069) y
//!   rechazan con error de negocio lo que la matriz no permite (kitchen#11);
//! * ids: el host pasa `context.new_ids` (autoridad de ids); el guest solo los reparte;
//! * `order_number` atómico `YYYYMMDD-NNNN`: `_bump_counter` (upsert) + `_insert_order`
//!   leyendo el contador con subquery en la misma transacción (patrón `sales`).

use erplora_guest_sdk::money::{self, Qty};
use erplora_guest_sdk::units::QUANTITY_SCALE;
use erplora_guest_sdk::{DomainError, Event, Operation, Output};
use rust_decimal::Decimal;
use serde_json::{json, Map, Value};

#[cfg(feature = "guest")]
use extism_pdk::*;

// ── Exports WASM ───────────────────────────────────────────────────────────

#[cfg(feature = "guest")]
#[plugin_fn]
pub fn create_order(input: Json<erplora_guest_sdk::Input>) -> FnResult<Json<Output>> {
    to_fn_result(create_order_pure(input.into_inner().into_value()))
}

#[cfg(feature = "guest")]
#[plugin_fn]
pub fn update_order_status(input: Json<erplora_guest_sdk::Input>) -> FnResult<Json<Output>> {
    to_fn_result(update_order_status_pure(input.into_inner().into_value()))
}

/// kitchen#5: served is `complete_order`, its own command → its own export.
#[cfg(feature = "guest")]
#[plugin_fn]
pub fn mark_order_served(input: Json<erplora_guest_sdk::Input>) -> FnResult<Json<Output>> {
    to_fn_result(mark_order_served_pure(input.into_inner().into_value()))
}

/// kitchen#5: cancelling is `cancel_order`, its own command → its own export.
#[cfg(feature = "guest")]
#[plugin_fn]
pub fn cancel_order(input: Json<erplora_guest_sdk::Input>) -> FnResult<Json<Output>> {
    to_fn_result(cancel_order_pure(input.into_inner().into_value()))
}

/// kitchen#4: bump per LINE (the KDS gesture); the ticket follows its lines.
#[cfg(feature = "guest")]
#[plugin_fn]
pub fn bump_items(input: Json<erplora_guest_sdk::Input>) -> FnResult<Json<Output>> {
    to_fn_result(bump_items_pure(input.into_inner().into_value()))
}

/// kitchen#4: recall per LINE — the undo of the bump, never behind a dialog.
#[cfg(feature = "guest")]
#[plugin_fn]
pub fn recall_items(input: Json<erplora_guest_sdk::Input>) -> FnResult<Json<Output>> {
    to_fn_result(recall_items_pure(input.into_inner().into_value()))
}

#[cfg(feature = "guest")]
#[plugin_fn]
pub fn delete_order(input: Json<erplora_guest_sdk::Input>) -> FnResult<Json<Output>> {
    to_fn_result(delete_order_pure(input.into_inner().into_value()))
}

/// ADR-0141: la comanda nace del PEDIDO. Ver `create_order_from_order_pure`.
#[cfg(feature = "guest")]
#[plugin_fn]
pub fn create_order_from_order(input: Json<erplora_guest_sdk::Input>) -> FnResult<Json<Output>> {
    to_fn_result(create_order_from_order_pure(
        input.into_inner().into_value(),
    ))
}

#[cfg(feature = "guest")]
#[plugin_fn]
pub fn create_order_from_sale(input: Json<erplora_guest_sdk::Input>) -> FnResult<Json<Output>> {
    to_fn_result(create_order_from_sale_pure(input.into_inner().into_value()))
}

#[cfg(feature = "guest")]
#[plugin_fn]
pub fn delete_station(input: Json<erplora_guest_sdk::Input>) -> FnResult<Json<Output>> {
    to_fn_result(delete_station_pure(input.into_inner().into_value()))
}

#[cfg(feature = "guest")]
#[plugin_fn]
pub fn set_routing(input: Json<erplora_guest_sdk::Input>) -> FnResult<Json<Output>> {
    to_fn_result(set_routing_pure(input.into_inner().into_value()))
}

#[cfg(feature = "guest")]
fn to_fn_result(r: Result<Output, String>) -> FnResult<Json<Output>> {
    match r {
        Ok(out) => Ok(Json(out)),
        Err(e) => Err(Error::msg(e).into()),
    }
}

// ── Helpers (mismo estilo que sales-handler) ───────────────────────────────

// El DINERO lo calcula `erplora_guest_sdk::money` (ADR-0123): una sola implementación para todos
// los handlers, un solo modo de redondeo (HALF_UP). Este módulo tenía su propio `round_cents`
// (half-even sobre `f64`), copiado byte a byte de otros cuatro.

fn as_i64(v: &Value, d: i64) -> i64 {
    match v {
        Value::Number(n) => n
            .as_i64()
            .unwrap_or_else(|| n.as_f64().map(|f| f as i64).unwrap_or(d)),
        Value::String(s) => s.trim().parse::<i64>().unwrap_or(d),
        _ => d,
    }
}

fn as_str(v: &Value) -> String {
    match v {
        Value::String(s) => s.clone(),
        Value::Number(n) => n.to_string(),
        Value::Bool(b) => b.to_string(),
        _ => String::new(),
    }
}

fn as_bool(v: &Value) -> bool {
    match v {
        Value::Bool(b) => *b,
        Value::Number(n) => n.as_i64().unwrap_or(0) != 0,
        Value::String(s) => matches!(s.as_str(), "1" | "true" | "True" | "yes"),
        _ => false,
    }
}

fn str_or(p: &Value, k: &str, d: &str) -> String {
    let s = as_str(p.get(k).unwrap_or(&Value::Null));
    if s.is_empty() {
        d.to_string()
    } else {
        s
    }
}

/// String opcional: '' o ausente → NULL (refs opacas table_id/customer_id/…).
fn opt_str(p: &Value, k: &str) -> Value {
    let s = as_str(p.get(k).unwrap_or(&Value::Null));
    if s.is_empty() {
        Value::Null
    } else {
        Value::String(s)
    }
}

fn day_from_now(now: &str) -> String {
    let date = now.split('T').next().unwrap_or("");
    let digits: String = date.chars().filter(|c| c.is_ascii_digit()).collect();
    if digits.len() >= 8 {
        digits[..8].to_string()
    } else {
        "00000000".to_string()
    }
}

struct Ctx {
    now: String,
    user_id: String,
    new_ids: Vec<String>,
}

fn split_input(input: &Value) -> (Value, Ctx) {
    let payload = input.get("payload").cloned().unwrap_or(Value::Null);
    let context = input.get("context").cloned().unwrap_or(Value::Null);
    let empty: Vec<Value> = Vec::new();
    let new_ids = context
        .get("new_ids")
        .and_then(|v| v.as_array())
        .unwrap_or(&empty)
        .iter()
        .map(as_str)
        .collect();
    let ctx = Ctx {
        now: context.get("now").map(as_str).unwrap_or_default(),
        user_id: context
            .get("current_user_id")
            .map(as_str)
            .unwrap_or_default(),
        new_ids,
    };
    (payload, ctx)
}

const ORDER_TYPES: [&str; 3] = ["dine_in", "takeaway", "delivery"];
const PRIORITIES: [&str; 3] = ["normal", "rush", "vip"];

/// Payload estándar de los eventos `kitchen.order.*` que escucha `kitchen.logs.create`
/// (el payload del evento ES el payload del listener: debe traer order_id/action/notes).
///
/// Y SOLO eso (kitchen#29). El relay entrega el payload del evento tal cual al listener, y
/// `execute_at` lo valida contra el schema del command de destino, que es
/// `additionalProperties: false`: una clave de más no se ignora, tumba la entrega y el rastro de
/// cocina se queda vacío sin decir por qué. Aquí sobraba `sender: "kitchen"` — la procedencia ya la
/// guarda el runtime en la fila del outbox (`_event_outbox.module_id`), que además no depende de
/// que el handler se nombre a sí mismo bien.
fn order_event(name: &str, order_id: &str, action: &str, notes: &str, user_id: &str) -> Event {
    Event::new(
        name,
        json!({
            "order_id": order_id,
            "order_item_id": Value::Null,
            "station_id": Value::Null,
            "action": action,
            "performed_by_id": if user_id.is_empty() { Value::Null } else { json!(user_id) },
            "notes": notes,
        }),
    )
}

/// kitchen#43 — la RECEPCIÓN también entra en el rastro. `kitchen.order.created` viaja con claves
/// propias (`total`, `items_count`, `order_type`…), y el relay entrega el payload del evento TAL
/// CUAL al listener: `schemas/log_create.json` es `additionalProperties: false`, así que enrutarlo
/// al log sería una entrega que reintentaría hasta morir en el dead-letter (kitchen#29). Este
/// gemelo estrecho —solo las claves del schema del log— es el que `events.listen` enruta a
/// `kitchen.logs.create`: sin él, el filtro «Recibida» del Historial lee un valor que nadie escribe.
fn received_log_event(order_id: &str, user_id: &str) -> Event {
    order_event("kitchen.order.received", order_id, "received", "", user_id)
}

/// Construye las intenciones `_bump_counter` + `_insert_order` + N×`_insert_item`.
/// Devuelve (ops, total). `items` ya viene normalizado (snapshot en el payload).
///
/// kitchen#57 — **una línea de venta puede abrir VARIAS líneas de comanda.** Un menú del día
/// `service` llega como UNA sola línea (precio cerrado, un solo tipo de IVA — ADR-0381) con sus
/// componentes en el snapshot: aquí se expanden a una fila por componente, porque cada uno tiene
/// que enrutarse por SU artículo. Falla con `DomainError` en vez de escribir a medias.
#[allow(clippy::too_many_arguments)]
fn build_order_ops(
    ctx: &Ctx,
    order_id: &str,
    day: &str,
    header: &Value,
    sale_id: Value,
    items: &[Value],
) -> Result<(Vec<Operation>, i64), DomainError> {
    let mut ops: Vec<Operation> = Vec::new();

    let mut bump = Map::new();
    bump.insert("day".into(), json!(day));
    ops.push(Operation::sql("kitchen._bump_counter", bump));

    let header_idx = ops.len();
    ops.push(Operation::sql("kitchen._insert_order", Map::new())); // placeholder

    let mut subtotal: i64 = 0; // céntimos
    // Cursor de ids: ya no hay correspondencia 1:1 entre línea de venta y fila de comanda (un
    // menú abre una por componente), así que el id se toma en ORDEN de fila, no por índice de
    // línea. `new_ids[0]` sigue siendo la comanda.
    let mut next_id = 1usize;
    // Posición de la fila DENTRO de la comanda. Todas las filas nacen en la misma transacción con
    // el mismo `created_at`, así que sin esto el orden de elección —lo que el foro de Square pide
    // desde hace años— lo decidiría el planificador de Postgres.
    let mut line_seq = 0i64;
    for item in items.iter() {
        // ADR-0147: la cantidad llega como PUNTO FIJO entero, escala global 10⁶ (0,5 = 500000) —
        // nunca un float. Esta es la FRONTERA de cocina: aquí se convierte a su representación
        // propia (Decimal exacto ÷ 10⁶; la columna sigue siendo REAL hasta la migración de este
        // módulo). Un float que llegara aquí no se repesca: es un error de quien emite.
        let qty_raw = match item.get("quantity") {
            Some(Value::Number(n)) => n.as_i64().unwrap_or(0),
            Some(Value::String(s)) => s.trim().parse::<i64>().unwrap_or(0),
            _ => QUANTITY_SCALE, // ausente → 1 unidad (el default de siempre)
        };
        let qty = Qty::from_decimal(Decimal::from(qty_raw) / Decimal::from(QUANTITY_SCALE));
        let unit_price = money::from_json(item.get("unit_price").unwrap_or(&Value::Null), 0);
        // precio × cantidad, con UN solo redondeo (la cantidad es fraccionable; el dinero no).
        let line_total = money::mul_qty(unit_price, qty.value());
        subtotal += line_total;

        // ¿Esta línea de venta es un MENÚ que trae sus componentes en el snapshot? (ADR-0381,
        // `supply_kind = 'service'`: un solo tipo de IVA ⇒ una sola línea de venta.) Si sí, la
        // línea NO se cocina: se cocinan sus componentes, uno por fila y cada uno por su ruta.
        let rows: Vec<Value> = match item.get("combo_components") {
            Some(Value::Array(components)) => {
                if components.is_empty() {
                    // Un menú disparado sin nada elegido. La puerta autoritativa del
                    // `min_choices` es de `sales` (es quien lee `combos.*`); lo que cocina NO
                    // puede permitir es abrir una tarjeta en blanco en el pase — kitchen#54,
                    // mismo razonamiento y mismo rechazo de dominio.
                    return Err(DomainError::new(
                        "kitchen.combo_without_components",
                        format!(
                            "Menu `{}` was fired with no component chosen: there is nothing to cook.",
                            str_or(item, "product_name", "?")
                        ),
                    ));
                }
                components.clone()
            }
            // Línea normal, y también el pack `goods` —ahí `sales` ya escribió una línea por
            // componente, con su propio tipo—: nada que expandir, solo que agrupar.
            _ => vec![item.clone()],
        };
        let expanded = item.get("combo_components").is_some();
        // Sin componentes, el nombre de la propia línea de venta es el que se cocina.
        let line_name = str_or(item, "product_name", "");

        // La referencia de grupo la pone `sales` (`combo_group_ref`). Si un menú llega sin ella,
        // se usa el id de la PRIMERA fila del grupo: opaca, estable dentro de la ronda y
        // compartida por los hermanos, que es todo lo que la agrupación necesita.
        let combo_ref = match opt_str(item, "combo_group_ref") {
            Value::Null if expanded => ctx
                .new_ids
                .get(next_id)
                .map(|id| json!(id))
                .unwrap_or(Value::Null),
            other => other,
        };
        // `kitchen_name` manda sobre el comercial (regla de Toast, la misma que ya usan los
        // suplementos). Sin ninguno de los dos, el nombre de la línea de venta ES el del menú.
        let combo_name = if combo_ref.is_null() {
            String::new()
        } else {
            let by_kitchen = str_or(item, "combo_kitchen_name", "");
            if !by_kitchen.is_empty() {
                by_kitchen
            } else {
                str_or(item, "combo_name", &str_or(item, "product_name", ""))
            }
        };

        for row in &rows {
            let item_id = match ctx.new_ids.get(next_id) {
                Some(id) if !id.is_empty() => id.clone(),
                // El host entrega un lote finito de ids (256). Antes se caía a `""` y la fila
                // se escribía con clave vacía; una comanda a medias es peor que ninguna.
                _ => {
                    return Err(DomainError::new(
                        "kitchen.too_many_lines",
                        "This order has more lines than the kitchen can number in one go: split it into two rounds.",
                    ))
                }
            };
            next_id += 1;
            line_seq += 1;

            // Cantidad de la FILA: la del componente multiplicada por la del menú (dos menús son
            // dos primeros). Punto fijo 10⁶ en los dos factores, así que el producto se divide
            // una vez por la escala — con `Decimal`, nunca con `f64`.
            let row_qty_raw = if expanded {
                let component_qty = match row.get("quantity") {
                    Some(Value::Number(n)) => n.as_i64().unwrap_or(QUANTITY_SCALE),
                    Some(Value::String(s)) => s.trim().parse::<i64>().unwrap_or(QUANTITY_SCALE),
                    _ => QUANTITY_SCALE,
                };
                let product = Decimal::from(component_qty) * Decimal::from(qty_raw)
                    / Decimal::from(QUANTITY_SCALE);
                product.round().try_into().unwrap_or(component_qty)
            } else {
                qty_raw
            };

            let mut p = Map::new();
            p.insert("item_id".into(), json!(item_id));
            p.insert("order_id".into(), json!(order_id));
            p.insert("station_id".into(), opt_str(row, "station_id"));
            // 🔴 La ruta sale del artículo de LA FILA, nunca del menú que la contiene: enrutar un
            // menú entero por su propio id es el fallo documentado de TouchBistro (la ensalada
            // acaba en la parrilla porque hereda la impresora del plato principal).
            p.insert("product_id".into(), opt_str(row, "product_id"));
            p.insert("category_id".into(), opt_str(row, "category_id"));
            // De qué línea de pedido salió esto: es lo que necesita la anulación para repartir
            // cantidades entre las estaciones que recibieron cada ronda. Un componente cuelga de
            // la línea del MENÚ, que es la que existe en la venta.
            p.insert("sales_order_item_id".into(), opt_str(item, "order_item_id"));
            p.insert(
                "product_name".into(),
                json!(cooking_name(row, if expanded { "" } else { &line_name })),
            );
            // El dinero del grupo es el de la línea de venta, y se cuenta UNA vez: los
            // componentes van a 0. Repetir el precio cerrado en cada fila haría leer 40,50 € en
            // un menú de 13,50 — el espejo del fallo de Odoo (el combo a 0 € en el informe).
            let (row_unit_price, row_total) = if expanded { (0, 0) } else { (unit_price, line_total) };
            p.insert("unit_price".into(), json!(row_unit_price)); // céntimos
                                                          // Punto fijo 10⁶ TAMBIÉN en la fila (ADR-0147 §2.1: REAL prohibido para cantidades de
                                                          // negocio; la migración 005 reescala la columna). El lógico solo existe al pintar.
            p.insert("quantity".into(), json!(row_qty_raw));
            p.insert("total".into(), json!(row_total)); // céntimos
            // Los suplementos cuelgan de SU componente, no del menú (ADR-0376 intacto dentro de
            // un combo): «el segundo, sin cebolla» es del segundo.
            p.insert("modifiers".into(), json!(modifiers_for_display(row)));
            p.insert("notes".into(), json!(str_or(row, "notes", "")));
            p.insert("status".into(), json!("pending"));
            p.insert(
                "seat_number".into(),
                row.get("seat_number")
                    .or_else(|| item.get("seat_number"))
                    .cloned()
                    .unwrap_or(Value::Null),
            );
            p.insert("combo_ref".into(), combo_ref.clone());
            p.insert("combo_name".into(), json!(combo_name));
            p.insert("line_seq".into(), json!(line_seq));
            ops.push(Operation::sql("kitchen._insert_item", p));
        }
    }

    let total = subtotal; // céntimos; tax/discount llegan 0 en el flujo actual (legacy idéntico)

    let mut h = Map::new();
    h.insert("order_id".into(), json!(order_id));
    h.insert("day".into(), json!(day));
    h.insert("table_id".into(), opt_str(header, "table_id"));
    h.insert("sale_id".into(), sale_id);
    h.insert("customer_id".into(), opt_str(header, "customer_id"));
    h.insert("waiter_id".into(), opt_str(header, "waiter_id"));
    // ADR-0141: los dos flujos (legacy desde venta, y desde pedido) pasan por aquí. Se declaran
    // SIEMPRE para que el binder no mande NULL a `label` (NOT NULL); `create_order_from_order` los
    // sobreescribe con el pedido real.
    h.insert("source_order_id".into(), Value::Null);
    h.insert("label".into(), json!(""));
    h.insert(
        "order_type".into(),
        json!(str_or(header, "order_type", "dine_in")),
    );
    h.insert("status".into(), json!("pending"));
    h.insert(
        "priority".into(),
        json!(str_or(header, "priority", "normal")),
    );
    h.insert(
        "round_number".into(),
        json!(header
            .get("round_number")
            .map(|v| as_i64(v, 1))
            .unwrap_or(1)),
    );
    h.insert("notes".into(), json!(str_or(header, "notes", "")));
    h.insert("subtotal".into(), json!(subtotal)); // céntimos
    h.insert("tax".into(), json!(0));
    h.insert("discount".into(), json!(0));
    h.insert("total".into(), json!(total)); // céntimos
    ops[header_idx] = Operation::sql("kitchen._insert_order", h);

    Ok((ops, total))
}

/// Nombre que lee el cocinero: `kitchen_name` → nombre comercial → id del artículo → `fallback`.
///
/// Misma escalera que los suplementos (regla de Toast), y por el mismo motivo: un hueco en la
/// comanda es lo mismo que no haberla impreso, y un cocinero que ve un código PREGUNTA mientras
/// que uno que no ve nada sirve el plato mal.
fn cooking_name(row: &Value, fallback: &str) -> String {
    for key in ["kitchen_name", "product_name", "name", "product_id"] {
        let v = str_or(row, key, "");
        if !v.is_empty() {
            return v;
        }
    }
    fallback.to_string()
}

// ── create_order (command kitchen.orders.create) ───────────────────────────

pub fn create_order_pure(input: Value) -> Result<Output, String> {
    let (payload, ctx) = split_input(&input);
    let order_type = str_or(&payload, "order_type", "dine_in");
    if !ORDER_TYPES.contains(&order_type.as_str()) {
        return Err(format!("invalid_order_type: {order_type}"));
    }
    let priority = str_or(&payload, "priority", "normal");
    if !PRIORITIES.contains(&priority.as_str()) {
        return Err(format!("invalid_priority: {priority}"));
    }
    let empty: Vec<Value> = Vec::new();
    let items = payload
        .get("items")
        .and_then(|v| v.as_array())
        .unwrap_or(&empty);
    let order_id = ctx.new_ids.first().cloned().unwrap_or_default();
    if order_id.is_empty() {
        return Err("missing_new_ids".to_string());
    }
    let day = day_from_now(&ctx.now);

    let mut header = payload.clone();
    if let Some(h) = header.as_object_mut() {
        h.insert("order_type".into(), json!(order_type));
        h.insert("priority".into(), json!(priority));
    }
    let (ops, total) = match build_order_ops(&ctx, &order_id, &day, &header, Value::Null, items) {
        Ok(built) => built,
        Err(e) => return Ok(Output::new().with_error(e)),
    };

    let mut ev = order_event(
        "kitchen.order.created",
        &order_id,
        "received",
        "",
        &ctx.user_id,
    );
    if let Value::Object(p) = &mut ev.payload {
        p.insert("total".into(), json!(total)); // céntimos
        p.insert("items_count".into(), json!(items.len()));
        p.insert(
            "order_type".into(),
            json!(payload
                .get("order_type")
                .map(as_str)
                .unwrap_or_else(|| "dine_in".into())),
        );
    }

    Ok(Output {
        operations: ops,
        events: vec![ev, received_log_event(&order_id, &ctx.user_id)],
        ..Default::default()
    })
}

// ── Order status transitions ───────────────────────────────────────────────
//
// One permission per ACTION (kitchen#5): the manifest declares one permission per command, so the
// verbs are split across three commands that share this core:
//   · `kitchen.orders.set_status` (change_order)  → fire · mark_ready · recall
//   · `kitchen.orders.mark_served` (complete_order) → served
//   · `kitchen.orders.cancel`      (cancel_order)  → cancelled
// The runtime does not hand `context.permissions` to the guest, so the split by command is the
// only place the per-action gate can live today.
//
// The state machine is AUTHORITATIVE (kitchen#11): the three commands declare a `reads` of
// `kitchen.orders.get` (ADR-0069, filtered by `payload.order_id`, `required`), so the handler sees
// the row's current status and refuses any transition outside the matrix with a business error —
// no operation, no event. The SQL guard (`require_status`) is then pinned to the state the handler
// validated against: a row that moved in between matches zero rows instead of jumping states.
// (The affected-rows gate for handler operations is hub#1025 — until it lands, that last window is
// closed by the runtime's serialisation of commands, not by a rollback.)

/// `pending → preparing → ready → served`; `ready → preparing` (recall); anything not served can be
/// cancelled. `served` and `cancelled` are terminal.
fn allowed_from(action: &str) -> &'static [&'static str] {
    match action {
        "fire" => &["pending"],
        "mark_ready" => &["pending", "preparing"],
        "mark_served" => &["ready"],
        "recall" => &["ready"],
        "cancel" => &["pending", "preparing", "ready"],
        _ => &[],
    }
}

/// The ticket row the runtime preloaded for this command (`context.reads["kitchen.orders.get"]`).
/// `Err` = the runtime did not preload it at all (a manifest/runtime mismatch, never a business
/// case); `Ok(None)` = the read ran and found no ticket of this hub with that id.
fn preloaded_order(input: &Value) -> Result<Option<Value>, String> {
    let rows = input
        .get("context")
        .and_then(|c| c.get("reads"))
        .and_then(|r| r.get("kitchen.orders.get"))
        .ok_or_else(|| "missing_read: kitchen.orders.get (declare it in `reads`)".to_string())?;
    let arr = match rows {
        Value::Array(a) => a.clone(),
        Value::Object(_) => rows
            .get("rows")
            .and_then(|v| v.as_array())
            .cloned()
            .unwrap_or_default(),
        _ => Vec::new(),
    };
    Ok(arr.into_iter().next())
}

/// `kitchen.orders.set_status`: the change_order verbs only.
pub fn update_order_status_pure(input: Value) -> Result<Output, String> {
    let action = as_str(
        input
            .get("payload")
            .and_then(|p| p.get("action_name"))
            .unwrap_or(&Value::Null),
    );
    if !matches!(action.as_str(), "fire" | "mark_ready" | "recall") {
        return Err(format!("unknown_action: {action}"));
    }
    transition_pure(&input, &action)
}

/// `kitchen.orders.mark_served`: served (complete_order).
pub fn mark_order_served_pure(input: Value) -> Result<Output, String> {
    transition_pure(&input, "mark_served")
}

/// `kitchen.orders.cancel`: cancelled (cancel_order).
pub fn cancel_order_pure(input: Value) -> Result<Output, String> {
    transition_pure(&input, "cancel")
}

fn transition_pure(input: &Value, action: &str) -> Result<Output, String> {
    let (payload, ctx) = split_input(input);
    let order_id = as_str(payload.get("order_id").unwrap_or(&Value::Null));
    if order_id.is_empty() {
        return Err("missing_order_id".to_string());
    }
    let reason = str_or(&payload, "reason", "");

    // Authoritative state check against the row the runtime preloaded (kitchen#11).
    let Some(order) = preloaded_order(input)? else {
        return Ok(Output::new().with_error(DomainError::new(
            "kitchen.order_unavailable",
            "That kitchen order is not available: it does not exist in this business or it has been deleted.",
        )));
    };
    let current = as_str(order.get("status").unwrap_or(&Value::Null));
    if !allowed_from(action).contains(&current.as_str()) {
        return Ok(Output::new().with_error(DomainError::new(
            "kitchen.invalid_transition",
            format!("A kitchen order in status `{current}` cannot `{action}`."),
        )));
    }
    // The SQL guard is pinned to the state just validated.
    let require: &str = &current;

    // (status, set_fired, ready_mode, served_mode, append_note,
    //  cascade: Option<(from_status, to_status, set_fired, completed_mode)>, evento, log_action)
    let (
        status,
        set_fired,
        ready_mode,
        served_mode,
        append_note,
        cascade,
        event,
        log_action,
    ) = match action {
        "fire" => (
            "preparing",
            1,
            "keep",
            "keep",
            String::new(),
            Some(("pending", "preparing", 1, "keep")),
            "kitchen.order.fired",
            "started",
        ),
        "mark_ready" => (
            "ready",
            0,
            "set",
            "keep",
            String::new(),
            None,
            "kitchen.order.ready",
            "bumped",
        ),
        "mark_served" => (
            "served",
            0,
            "keep",
            "set",
            String::new(),
            None,
            "kitchen.order.served",
            "served",
        ),
        "cancel" => (
            "cancelled",
            0,
            "keep",
            "keep",
            if reason.is_empty() {
                String::new()
            } else {
                format!("Cancelled: {reason}")
            },
            Some(("", "cancelled", 0, "keep")),
            "kitchen.order.cancelled",
            "cancelled",
        ),
        "recall" => (
            "preparing",
            0,
            "clear",
            "keep",
            String::new(),
            Some(("ready", "preparing", 0, "clear")),
            "kitchen.order.recalled",
            "recalled",
        ),
        other => return Err(format!("unknown_action: {other}")),
    };

    let mut ops: Vec<Operation> = Vec::new();
    let mut h = Map::new();
    h.insert("order_id".into(), json!(order_id));
    h.insert("status".into(), json!(status));
    h.insert("require_status".into(), json!(require));
    h.insert("set_fired".into(), json!(set_fired));
    h.insert("ready_mode".into(), json!(ready_mode));
    h.insert("served_mode".into(), json!(served_mode));
    h.insert("append_note".into(), json!(append_note));
    h.insert("nl".into(), json!("\n"));
    ops.push(Operation::sql("kitchen._set_order_status", h));

    if let Some((from_status, to_status, item_fired, completed_mode)) = cascade {
        let mut c = Map::new();
        c.insert("order_id".into(), json!(order_id));
        c.insert("from_status".into(), json!(from_status));
        c.insert("to_status".into(), json!(to_status));
        c.insert("set_fired".into(), json!(item_fired));
        c.insert("completed_mode".into(), json!(completed_mode));
        ops.push(Operation::sql("kitchen._cascade_item_status", c));
    }

    let ev = order_event(event, &order_id, log_action, &reason, &ctx.user_id);
    Ok(Output {
        operations: ops,
        events: vec![ev],
        ..Default::default()
    })
}

// ── Line bump / recall (kitchen#4 — the KDS gesture) ───────────────────────
//
// The market (Toast, Square, Lightspeed, Fresh, TouchBistro, Odoo, LS Central, Simphony) strikes
// the ticket LINE by LINE and lets the ticket advance by itself when nothing is left; bump and
// recall always travel as a pair, scoped to the station (a bump on the bar never clears the
// grill's lines — Tek-Tips' recurring KDS complaint). Two commands share this core:
//   · `kitchen.items.bump`   (change_order) → lines pending|preparing → ready; when no line of
//     the ticket is left cooking, the ticket goes `ready` (emits `kitchen.order.ready`); the
//     first bump on a `pending` ticket marks it `preparing` (emits `kitchen.order.fired`).
//   · `kitchen.items.recall` (change_order) → lines ready → preparing; a `ready` ticket comes
//     back to `preparing` (emits `kitchen.order.recalled`).
// Both declare `reads` of `kitchen.orders.get` + `kitchen.orders.items` (ADR-0069, `required`),
// so the handler decides against the rows the runtime saw — the same authority as kitchen#11.
// Lines already in the target state are skipped, not refused: a header tap over a half-bumped
// ticket is the normal case, not an error. Only a call that would touch NOTHING is refused.

/// The lines of the ticket the runtime preloaded (`context.reads["kitchen.orders.items"]`).
fn preloaded_items(input: &Value) -> Result<Vec<Value>, String> {
    let rows = input
        .get("context")
        .and_then(|c| c.get("reads"))
        .and_then(|r| r.get("kitchen.orders.items"))
        .ok_or_else(|| "missing_read: kitchen.orders.items (declare it in `reads`)".to_string())?;
    Ok(match rows {
        Value::Array(a) => a.clone(),
        Value::Object(_) => rows
            .get("rows")
            .and_then(|v| v.as_array())
            .cloned()
            .unwrap_or_default(),
        _ => Vec::new(),
    })
}

/// Event payload for `kitchen.item.*` — the shape `kitchen.logs.create` expects, with the line.
/// Nothing else, for the reason spelled out on [`order_event`] (kitchen#29).
fn item_event(name: &str, order_id: &str, item: &Value, action: &str, user_id: &str) -> Event {
    let station = item.get("station_id").cloned().unwrap_or(Value::Null);
    Event::new(
        name,
        json!({
            "order_id": order_id,
            "order_item_id": as_str(item.get("id").unwrap_or(&Value::Null)),
            "station_id": if station.is_null() || as_str(&station).is_empty() { Value::Null } else { json!(as_str(&station)) },
            "action": action,
            "performed_by_id": if user_id.is_empty() { Value::Null } else { json!(user_id) },
            "notes": "",
        }),
    )
}

/// `kitchen.items.bump`: lines → ready, ticket follows.
pub fn bump_items_pure(input: Value) -> Result<Output, String> {
    line_transition_pure(&input, LineVerb::Bump)
}

/// `kitchen.items.recall`: lines → preparing, ticket follows.
pub fn recall_items_pure(input: Value) -> Result<Output, String> {
    line_transition_pure(&input, LineVerb::Recall)
}

#[derive(Clone, Copy)]
enum LineVerb {
    Bump,
    Recall,
}

fn line_transition_pure(input: &Value, verb: LineVerb) -> Result<Output, String> {
    let (payload, ctx) = split_input(input);
    let order_id = as_str(payload.get("order_id").unwrap_or(&Value::Null));
    if order_id.is_empty() {
        return Err("missing_order_id".to_string());
    }
    let item_ids: Vec<String> = payload
        .get("item_ids")
        .and_then(|v| v.as_array())
        .map(|a| a.iter().map(as_str).filter(|s| !s.is_empty()).collect())
        .unwrap_or_default();
    if item_ids.is_empty() {
        return Err("missing_item_ids".to_string());
    }

    let Some(order) = preloaded_order(input)? else {
        return Ok(Output::new().with_error(DomainError::new(
            "kitchen.order_unavailable",
            "That kitchen order is not available: it does not exist in this business or it has been deleted.",
        )));
    };
    let lines = preloaded_items(input)?;
    let order_status = as_str(order.get("status").unwrap_or(&Value::Null));
    // Lines only move while the ticket is on the line: served/cancelled are terminal (kitchen#11).
    if !matches!(order_status.as_str(), "pending" | "preparing" | "ready") {
        return Ok(Output::new().with_error(DomainError::new(
            "kitchen.invalid_transition",
            format!("A kitchen order in status `{order_status}` cannot move its lines."),
        )));
    }

    // (from-states, to-state, completed_mode, item event, log action)
    let (from, to, completed_mode, item_event_name, item_action) = match verb {
        LineVerb::Bump => (
            &["pending", "preparing"][..],
            "ready",
            "set",
            "kitchen.item.bumped",
            "item_bumped",
        ),
        LineVerb::Recall => (
            &["ready"][..],
            "preparing",
            "clear",
            "kitchen.item.recalled",
            "item_recalled",
        ),
    };

    let mut ops: Vec<Operation> = Vec::new();
    let mut events: Vec<Event> = Vec::new();
    // Status of every line AFTER this command, to decide whether the ticket follows.
    let mut after: Vec<String> = Vec::with_capacity(lines.len());
    let mut touched = 0usize;
    for id in &item_ids {
        let Some(line) = lines
            .iter()
            .find(|l| as_str(l.get("id").unwrap_or(&Value::Null)) == *id)
        else {
            return Ok(Output::new().with_error(DomainError::new(
                "kitchen.item_unavailable",
                format!("Line `{id}` is not a line of this kitchen order (or it was deleted)."),
            )));
        };
        let current = as_str(line.get("status").unwrap_or(&Value::Null));
        if !from.contains(&current.as_str()) {
            continue; // already there (or not applicable): skipped, not refused
        }
        let mut p = Map::new();
        p.insert("item_id".into(), json!(id));
        p.insert("order_id".into(), json!(order_id));
        p.insert("status".into(), json!(to));
        p.insert("require_status".into(), json!(current));
        p.insert("completed_mode".into(), json!(completed_mode));
        ops.push(Operation::sql("kitchen._set_item_status", p));
        events.push(item_event(
            item_event_name,
            &order_id,
            line,
            item_action,
            &ctx.user_id,
        ));
        touched += 1;
    }
    if touched == 0 {
        return Ok(Output::new().with_error(DomainError::new(
            "kitchen.invalid_transition",
            "None of those lines is in a state this action accepts.",
        )));
    }
    for line in &lines {
        let id = as_str(line.get("id").unwrap_or(&Value::Null));
        let current = as_str(line.get("status").unwrap_or(&Value::Null));
        let moved = item_ids.contains(&id) && from.contains(&current.as_str());
        after.push(if moved { to.to_string() } else { current });
    }

    // Does the ticket follow its lines?
    //   bump:   nothing left cooking → ready; first action on a pending ticket → preparing.
    //   recall: a ready ticket has a line cooking again → preparing.
    let all_ready = after.iter().all(|s| s == "ready");
    let head = match verb {
        LineVerb::Bump if all_ready && order_status != "ready" => {
            Some(("ready", 1, "set", "kitchen.order.ready", "bumped"))
        }
        LineVerb::Bump if order_status == "pending" => {
            Some(("preparing", 1, "keep", "kitchen.order.fired", "started"))
        }
        LineVerb::Recall if order_status == "ready" => {
            Some(("preparing", 0, "clear", "kitchen.order.recalled", "recalled"))
        }
        _ => None,
    };
    if let Some((status, set_fired, ready_mode, event, log_action)) = head {
        let mut h = Map::new();
        h.insert("order_id".into(), json!(order_id));
        h.insert("status".into(), json!(status));
        h.insert("require_status".into(), json!(order_status));
        h.insert("set_fired".into(), json!(set_fired));
        h.insert("ready_mode".into(), json!(ready_mode));
        h.insert("served_mode".into(), json!("keep"));
        h.insert("append_note".into(), json!(""));
        h.insert("nl".into(), json!("\n"));
        ops.push(Operation::sql("kitchen._set_order_status", h));
        events.push(order_event(event, &order_id, log_action, "", &ctx.user_id));
    }

    Ok(Output {
        operations: ops,
        events,
        ..Default::default()
    })
}

// ── delete_order (command kitchen.orders.delete) ───────────────────────────

pub fn delete_order_pure(input: Value) -> Result<Output, String> {
    let (payload, ctx) = split_input(&input);
    let order_id = as_str(payload.get("order_id").unwrap_or(&Value::Null));
    if order_id.is_empty() {
        return Err("missing_order_id".to_string());
    }
    // Guardas (status pending/cancelled, sin venta enlazada) en el WHERE de la intención.
    let mut p = Map::new();
    p.insert("order_id".into(), json!(order_id));
    let ev = order_event(
        "kitchen.order.deleted",
        &order_id,
        "cancelled",
        "deleted",
        &ctx.user_id,
    );
    Ok(Output {
        operations: vec![Operation::sql("kitchen._order_soft_delete", p)],
        events: vec![ev],
        ..Default::default()
    })
}

// ── create_order_from_sale (event-driven: sale.completed) ──────────────────

pub fn create_order_from_sale_pure(input: Value) -> Result<Output, String> {
    let (payload, ctx) = split_input(&input);
    let sale_id = as_str(payload.get("sale_id").unwrap_or(&Value::Null));
    if sale_id.is_empty() {
        return Err("missing_sale_id".to_string());
    }
    let order_id = ctx.new_ids.first().cloned().unwrap_or_default();
    if order_id.is_empty() {
        return Err("missing_new_ids".to_string());
    }
    let day = day_from_now(&ctx.now);

    // Las líneas de servicio no se cocinan (mismo criterio que inventory al descontar stock).
    let empty: Vec<Value> = Vec::new();
    let items: Vec<Value> = payload
        .get("items")
        .and_then(|v| v.as_array())
        .unwrap_or(&empty)
        .iter()
        .filter(|it| !it.get("is_service").map(as_bool).unwrap_or(false))
        .cloned()
        .collect();

    // order_type: con mesa → dine_in; channel 'delivery' → delivery; resto → takeaway.
    // (El payload actual de sale.completed no siempre trae table_id/channel; ver doc.)
    let table_id = as_str(payload.get("table_id").unwrap_or(&Value::Null));
    let channel = as_str(payload.get("channel").unwrap_or(&Value::Null));
    let order_type = if !table_id.is_empty() {
        "dine_in"
    } else if channel == "delivery" {
        "delivery"
    } else {
        "takeaway"
    };

    let header = json!({
        "table_id": table_id,
        "customer_id": as_str(payload.get("customer_id").unwrap_or(&Value::Null)),
        "order_type": order_type,
        "priority": "normal",
        "notes": "",
    });
    // Idempotencia: uq_kitchen_order_sale (hub_id, sale_id) rechaza el duplicado si el
    // bus reentrega (además del marcador _event_delivery del runtime).
    let (ops, total) = match build_order_ops(&ctx, &order_id, &day, &header, json!(sale_id), &items)
    {
        Ok(built) => built,
        Err(e) => return Ok(Output::new().with_error(e)),
    };

    let mut ev = order_event(
        "kitchen.order.created",
        &order_id,
        "received",
        "",
        &ctx.user_id,
    );
    if let Value::Object(p) = &mut ev.payload {
        p.insert("sale_id".into(), json!(sale_id));
        p.insert("total".into(), json!(total)); // céntimos
        p.insert("items_count".into(), json!(items.len()));
        p.insert("order_type".into(), json!(order_type));
    }
    Ok(Output {
        operations: ops,
        events: vec![ev, received_log_event(&order_id, &ctx.user_id)],
        ..Default::default()
    })
}

// ── delete_station (command kitchen.stations.delete) ───────────────────────

pub fn delete_station_pure(input: Value) -> Result<Output, String> {
    let (payload, _ctx) = split_input(&input);
    let station_id = as_str(payload.get("station_id").unwrap_or(&Value::Null));
    if station_id.is_empty() {
        return Err("missing_station_id".to_string());
    }
    // Guardas (sin routings activos, sin líneas en curso) en el WHERE de la intención.
    let mut p = Map::new();
    p.insert("station_id".into(), json!(station_id));
    let ev = Event::new(
        "kitchen.station.deleted",
        json!({
            "sender": "kitchen",
            "station_id": station_id,
        }),
    );
    Ok(Output {
        operations: vec![Operation::sql("kitchen._station_soft_delete", p)],
        events: vec![ev],
        ..Default::default()
    })
}

// ── set_routing (command kitchen.stations.set_routing) ─────────────────────

pub fn set_routing_pure(input: Value) -> Result<Output, String> {
    let (payload, _ctx) = split_input(&input);
    let station_id = as_str(payload.get("station_id").unwrap_or(&Value::Null));
    if station_id.is_empty() {
        return Err("missing_station_id".to_string());
    }
    let product_id = as_str(payload.get("product_id").unwrap_or(&Value::Null));
    let category_id = as_str(payload.get("category_id").unwrap_or(&Value::Null));
    if product_id.is_empty() && category_id.is_empty() {
        return Err("nothing_to_route: aporta product_id y/o category_id".to_string());
    }

    // La validación "estación existe y activa" va en el WHERE del upsert (no-op si no).
    let mut ops: Vec<Operation> = Vec::new();
    if !product_id.is_empty() {
        let mut p = Map::new();
        p.insert("product_id".into(), json!(product_id));
        p.insert("station_id".into(), json!(station_id));
        ops.push(Operation::sql("kitchen._product_route_set", p));
    }
    if !category_id.is_empty() {
        let mut c = Map::new();
        c.insert("category_id".into(), json!(category_id));
        c.insert("station_id".into(), json!(station_id));
        ops.push(Operation::sql("kitchen._category_route_set", c));
    }

    let ev = Event::new(
        "kitchen.routing.changed",
        json!({
            "sender": "kitchen",
            "station_id": station_id,
            "product_id": if product_id.is_empty() { Value::Null } else { json!(product_id) },
            "category_id": if category_id.is_empty() { Value::Null } else { json!(category_id) },
        }),
    );
    Ok(Output {
        operations: ops,
        events: vec![ev],
        ..Default::default()
    })
}

// ── create_order_from_order (command kitchen.orders.create_from_order) ─────

/// ADR-0141 — **la comanda nace del PEDIDO**, no de la venta.
///
/// Antes esto colgaba de `sale.completed`, o sea del **cobro**: la comida salía a cocina cuando el
/// cliente pagaba, que en un restaurante es el final del servicio. El camarero dispara cuando toma
/// nota, y el pedido vive abierto una hora antes de que exista ninguna venta.
///
/// Cocina deja de conocer a `tables` y a `customers`: lo que recibe es una **etiqueta opaca**
/// (`label`) que imprime tal cual —"Mesa 4", "Barra", "Recogida Ana"— y un **canal**. Quien dispara
/// sabe qué significa; cocina no tiene por qué.
///
/// Cada disparo es una **ronda** del mismo pedido (bebidas primero, comida después). Como el guest
/// pm#93 — aplana los suplementos de una línea al TEXTO que lee cocina.
///
/// `kitchen_order_item.modifiers` es una columna de DISPLAY: el KDS la pinta tal cual y la comanda
/// impresa la saca por la térmica. Aquí se convierte la lista que manda `sales` en esa línea.
///
/// 🔴 Esto es el eslabón que se rompía EN SILENCIO: `sales` pasó a mandar una lista de objetos y
/// aquí se leía con `str_or`, que sobre un array devuelve cadena vacía. El camarero teclea «sin
/// cebolla», la venta lo guarda, el evento lo transporta, y cocina no ve nada — sin error y sin
/// aviso. Es el fallo estrella del sector: de enrutado, no de modelo.
///
/// Prioridad de cada opción: `kitchen_name` → `name` → `option_id`. El id es feo, pero aparece solo
/// cuando `sales` no pudo resolver su catálogo al disparar, y un cocinero que ve un código pregunta
/// mientras que uno que no ve nada sirve el plato mal.
///
/// Se admite además el formato ANTIGUO (una cadena suelta): un `sales` sin actualizar, o cualquier
/// integración de terceros, no puede quedarse sin comanda.
fn modifiers_for_display(item: &Value) -> String {
    match item.get("modifiers") {
        // Formato antiguo: ya viene escrito.
        Some(Value::String(s)) => s.clone(),
        Some(Value::Array(picks)) => picks
            .iter()
            .map(|m| {
                for key in ["kitchen_name", "name", "option_id"] {
                    let v = str_or(m, key, "");
                    if !v.is_empty() {
                        return v;
                    }
                }
                String::new()
            })
            .filter(|s| !s.is_empty())
            // `, ` y no `·`: esto acaba en una térmica y no hay transliteración por el camino.
            // `·` es U+00B7 — 0xFA en CP437, 0xB7 en latin-1: una codificación ingenua imprime un
            // carácter de caja. La coma se lee igual en el KDS y no falla en ninguna tabla.
            .collect::<Vec<_>>()
            .join(", "),
        _ => String::new(),
    }
}

/// no puede leer la BD, manda `round_number = 0` y el SQL la calcula contra las comandas ya
/// disparadas de ese pedido, en la misma transacción.
pub fn create_order_from_order_pure(input: Value) -> Result<Output, String> {
    let (payload, ctx) = split_input(&input);
    let source_order_id = as_str(payload.get("order_id").unwrap_or(&Value::Null));
    if source_order_id.is_empty() {
        return Err("missing_order_id".to_string());
    }
    let kitchen_order_id = ctx.new_ids.first().cloned().unwrap_or_default();
    if kitchen_order_id.is_empty() {
        return Err("missing_new_ids".to_string());
    }
    let day = day_from_now(&ctx.now);

    // Las líneas de servicio no se cocinan (mismo criterio que inventory al descontar stock).
    let empty: Vec<Value> = Vec::new();
    let items: Vec<Value> = payload
        .get("items")
        .and_then(|v| v.as_array())
        .unwrap_or(&empty)
        .iter()
        .filter(|it| !it.get("is_service").map(as_bool).unwrap_or(false))
        .cloned()
        .collect();

    // kitchen#54 — **una comanda que no se puede llenar no se abre.**
    //
    // El KDS enseñaba tarjetas VACÍAS: número, estado y cronómetro, cero productos, sin rejilla
    // por estación y sin botón «Listo». El cocinero no puede saber qué cocinar, y nada avisaba —
    // la comanda se creaba igual, con `total` 0. La causa raíz vivía en `sales` (mandaba las
    // líneas del PAYLOAD, no las suyas), pero cocina no puede depender de que TODO el que emita
    // `order.fired` —un flujo, el asistente, una integración de terceros— venga bien.
    //
    // Rechazo de DOMINIO, no un panic: el listener no revienta y el fallo se VE, que es
    // exactamente lo contrario de la tarjeta en blanco.
    if items.is_empty() {
        return Ok(Output::new().with_error(DomainError::new(
            "kitchen.nothing_to_cook",
            format!(
                "Order `{source_order_id}` was fired with nothing to cook: no lines reached the kitchen."
            ),
        )));
    }

    let channel = as_str(payload.get("channel").unwrap_or(&Value::Null));
    let order_type = if ORDER_TYPES.contains(&channel.as_str()) {
        channel
    } else {
        "dine_in".to_string()
    };
    let label = str_or(&payload, "label", "");

    let header = json!({
        "order_type": order_type,
        "priority": "normal",
        "notes": "",
        "round_number": 0, // 0 = "numérala tú" (subconsulta en _insert_order)
    });
    let (mut ops, total) =
        match build_order_ops(&ctx, &kitchen_order_id, &day, &header, Value::Null, &items) {
            Ok(built) => built,
            Err(e) => return Ok(Output::new().with_error(e)),
        };

    // El pedido de origen y la etiqueta se añaden a la cabecera ya construida: son lo único que
    // este flujo aporta sobre el legacy, y así `build_order_ops` sigue sirviendo a los dos.
    if let Some(op) = ops
        .iter_mut()
        .find(|o| o.command == "kitchen._insert_order")
    {
        op.params
            .insert("source_order_id".into(), json!(source_order_id));
        op.params.insert("label".into(), json!(label));
    }

    let mut ev = order_event(
        "kitchen.order.created",
        &kitchen_order_id,
        "received",
        "",
        &ctx.user_id,
    );
    if let Value::Object(p) = &mut ev.payload {
        p.insert("source_order_id".into(), json!(source_order_id));
        p.insert("label".into(), json!(label));
        p.insert("total".into(), json!(total)); // céntimos
        p.insert("items_count".into(), json!(items.len()));
        p.insert(
            "order_type".into(),
            json!(str_or(&header, "order_type", "dine_in")),
        );
    }
    Ok(Output {
        operations: ops,
        events: vec![ev, received_log_event(&kitchen_order_id, &ctx.user_id)],
        ..Default::default()
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Payload tal y como llega el evento `order.fired` que emite `sales` (ADR-0141).
    fn fired(label: &str, channel: &str, items: Value) -> Value {
        json!({
            "payload": { "order_id": "ord-1", "label": label, "channel": channel, "items": items },
            "context": {
                "hub_id": "h1", "current_user_id": "u1", "now": "2026-07-18T10:00:00+00:00",
                "new_ids": ["kit-1", "kit-2", "kit-3"]
            }
        })
    }

    #[test]
    fn la_comanda_cuelga_del_pedido_y_guarda_la_etiqueta_tal_cual() {
        // ADR-0141: cocina NO sabe qué es una mesa. Recibe un texto opaco y lo imprime; si mañana
        // el hub vende para llevar, la misma comanda dice "Recogida Ana" sin tocar este módulo.
        let out = create_order_from_order_pure(fired(
            "Mesa 4",
            "dine_in",
            json!([{ "product_name": "Croquetas", "quantity": 2_000_000, "unit_price": 350, "notes": "sin gluten" }]),
        ))
        .expect("crear la comanda");

        let header = out
            .operations
            .iter()
            .find(|o| o.command == "kitchen._insert_order")
            .expect("cabecera de comanda");
        assert_eq!(header.params["source_order_id"], json!("ord-1"));
        assert_eq!(header.params["label"], json!("Mesa 4"));
        assert_eq!(header.params["order_type"], json!("dine_in"));
        // La ronda la numera el SQL contra las comandas ya disparadas de ESE pedido: el handler no
        // puede leer la BD, así que manda 0 = "calcúlala tú".
        assert_eq!(header.params["round_number"], json!(0));
        // Ni rastro de la mesa ni del cliente: eso era lo que ataba cocina a otros dos módulos.
        assert_eq!(header.params["table_id"], Value::Null);
        assert_eq!(header.params["customer_id"], Value::Null);
        assert_eq!(
            header.params["sale_id"],
            Value::Null,
            "todavía no hay venta: nadie ha pagado"
        );
    }

    #[test]
    fn media_racion_entra_y_se_persiste_en_escala_10e6() {
        // ADR-0147 §2.1: la cantidad es punto fijo entero 10⁶ en el cable Y EN LA FILA — la
        // persistencia lógica en f64 («0.5» a una columna REAL) era el residuo transitorio que
        // la migración 005 elimina (REAL prohibido para cantidades de negocio). El dinero se
        // sigue calculando con la lógica exacta: 2400 × 0,5 = 1200, un redondeo.
        let out = create_order_from_order_pure(fired(
            "Mesa 4",
            "dine_in",
            json!([{ "product_name": "Gambas", "quantity": 500_000, "unit_price": 2400 }]),
        ))
        .expect("crear la comanda");
        let item = out
            .operations
            .iter()
            .find(|o| o.command == "kitchen._insert_item")
            .expect("la línea baja a cocina");
        assert_eq!(
            item.params["quantity"],
            json!(500_000),
            "la fila guarda µ, no el lógico f64: {:?}",
            item.params
        );
        assert_eq!(
            item.params["total"],
            json!(1200),
            "2400 × 0,5 = 1200 céntimos, un redondeo"
        );
    }

    #[test]
    fn the_category_of_the_line_reaches_the_routing_sql() {
        // kitchen#4 / #23 residue: routing by CATEGORY was documented as inert because "the till does
        // not send `category_id`". Since sales#12 (2026-08-18) `order.fired` carries the product's
        // primary category per line; this pins that kitchen forwards it to `_insert_item`, whose
        // COALESCE falls back to `kitchen_category_station` when the product has no mapping.
        let out = create_order_from_order_pure(fired(
            "Mesa 4",
            "dine_in",
            json!([{ "product_id": "p-cerveza", "product_name": "Caña", "quantity": 1_000_000, "unit_price": 250, "category_id": "cat-bebidas" },
                   { "product_id": "p-raro", "product_name": "Sin clasificar", "quantity": 1_000_000, "unit_price": 100, "category_id": null }]),
        ))
        .unwrap();
        let items: Vec<_> = out.operations.iter().filter(|o| o.command == "kitchen._insert_item").collect();
        assert_eq!(items[0].params["category_id"], json!("cat-bebidas"));
        assert_eq!(items[1].params["category_id"], Value::Null, "an unclassified line routes by product only (or nowhere)");
    }

    #[test]
    fn an_order_fired_with_nothing_to_cook_does_not_open_a_blank_ticket() {
        // kitchen#54 — el KDS enseñaba tarjetas VACÍAS: número, estado y cronómetro, cero
        // productos, sin rejilla por estación y sin botón «Listo». El cocinero no puede saber qué
        // cocinar, y nada avisaba: la comanda se creaba igual, con `total` 0.
        //
        // La causa raíz vive en `sales` (disparaba las líneas del PAYLOAD, no las suyas), pero
        // cocina no puede depender de que TODO el que emita `order.fired` —un flujo, el
        // asistente, una integración— venga bien. Aquí se cierra la puerta: una comanda que no se
        // puede llenar no se abre. Es un rechazo de dominio (`Output.error`), no un panic: el
        // listener no revienta y el fallo SE VE, que es lo contrario de la tarjeta en blanco.
        for (case, items) in [
            ("sin líneas", json!([])),
            ("clave ausente", Value::Null),
            // Solo servicio: cocina las descarta (no se cocinan), así que no queda nada que
            // mandar a ninguna estación. Una comanda vacía tampoco vale aquí.
            ("solo servicio", json!([{ "product_name": "Servicio de sala", "quantity": 1_000_000, "is_service": true }])),
        ] {
            let mut inp = fired("Mesa 4", "dine_in", json!([]));
            if items.is_null() {
                inp["payload"].as_object_mut().unwrap().remove("items");
            } else {
                inp["payload"]["items"] = items;
            }
            let out = create_order_from_order_pure(inp).expect("un rechazo es un Output, no una trampa");
            let err = out.error.as_ref().unwrap_or_else(|| panic!("{case}: tenía que rechazar"));
            assert_eq!(err.code, "kitchen.nothing_to_cook", "{case}");
            assert!(out.operations.is_empty(), "{case}: no se escribe nada");
            assert!(out.events.is_empty(), "{case}: sin evento, nadie oye una comanda que no existe");
        }
    }

    #[test]
    fn las_lineas_de_servicio_no_se_cocinan() {
        let out = create_order_from_order_pure(fired(
            "Barra",
            "takeaway",
            json!([
                { "product_name": "Tarta", "quantity": 1_000_000, "unit_price": 400 },
                { "product_name": "Servicio de sala", "quantity": 1_000_000, "unit_price": 200, "is_service": true }
            ]),
        ))
        .unwrap();
        let items: Vec<_> = out
            .operations
            .iter()
            .filter(|o| o.command == "kitchen._insert_item")
            .collect();
        assert_eq!(items.len(), 1, "el servicio no baja a cocina");
        assert_eq!(items[0].params["product_name"], json!("Tarta"));
    }

    // ── kitchen#5: one permission per action → one command per permission ──────────────

    fn status_input(payload: Value) -> Value {
        json!({
            "payload": payload,
            "context": { "hub_id": "h1", "current_user_id": "u1", "now": "2026-08-18T10:00:00+00:00", "new_ids": [] }
        })
    }

    #[test]
    fn set_status_keeps_only_the_change_order_verbs() {
        // `mark_served` and `cancel` moved to their own commands (complete_order / cancel_order):
        // a caller who only holds change_order must not reach them through set_status.
        for verb in ["mark_served", "cancel"] {
            let err = update_order_status_pure(status_input(json!({ "order_id": "k1", "action_name": verb })))
                .expect_err("moved verb must be refused here");
            assert!(err.starts_with("unknown_action"), "got {err}");
        }
        for (verb, from) in [("fire", "pending"), ("mark_ready", "preparing"), ("recall", "ready")] {
            let out = update_order_status_pure(with_state(from, json!({ "order_id": "k1", "action_name": verb })))
                .expect("change_order verb still handled by set_status");
            assert!(out.error.is_none(), "{verb} from {from}: {:?}", out.error);
        }
    }

    #[test]
    fn mark_order_served_is_the_served_transition() {
        let out = mark_order_served_pure(with_state("ready", json!({ "order_id": "k1" }))).expect("served");
        let head = out.operations.iter().find(|o| o.command == "kitchen._set_order_status").unwrap();
        assert_eq!(head.params["status"], json!("served"));
        assert_eq!(head.params["served_mode"], json!("set"));
        assert_eq!(out.events[0].name, "kitchen.order.served");
        assert_eq!(out.events[0].payload["action"], json!("served"));
    }

    #[test]
    fn cancel_order_is_the_cancelled_transition_with_reason() {
        let out = cancel_order_pure(with_state("preparing", json!({ "order_id": "k1", "reason": "guest left" })))
            .expect("cancelled");
        let head = out.operations.iter().find(|o| o.command == "kitchen._set_order_status").unwrap();
        assert_eq!(head.params["status"], json!("cancelled"));
        assert_eq!(head.params["append_note"], json!("Cancelled: guest left"));
        assert!(out.operations.iter().any(|o| o.command == "kitchen._cascade_item_status"));
        assert_eq!(out.events[0].name, "kitchen.order.cancelled");
        assert_eq!(out.events[0].payload["notes"], json!("guest left"));
    }

    // ── kitchen#11: the state machine is authoritative ─────────────────────────────────

    /// Input with the order row the runtime preloads (`reads`, ADR-0069) in `status`.
    fn with_state(status: &str, payload: Value) -> Value {
        json!({
            "payload": payload,
            "context": {
                "hub_id": "h1", "current_user_id": "u1", "now": "2026-08-18T10:00:00+00:00", "new_ids": [],
                "reads": { "kitchen.orders.get": [ { "id": "k1", "status": status } ] }
            }
        })
    }

    fn run(action: &str, from: &str) -> Result<Output, String> {
        let payload = json!({ "order_id": "k1", "action_name": action, "reason": "" });
        match action {
            "mark_served" => mark_order_served_pure(with_state(from, payload)),
            "cancel" => cancel_order_pure(with_state(from, payload)),
            _ => update_order_status_pure(with_state(from, payload)),
        }
    }

    #[test]
    fn a_served_ticket_cannot_go_back_to_ready() {
        // The P0 reproduced in QA (kitchen#11): served → mark_ready answered ok=true and left a
        // ticket that was `ready` and had `served_at` at once. Now it is a business rejection with
        // NO operation and NO event — the listeners never hear a state that is not in the database.
        let out = run("mark_ready", "served").expect("a rejection is an Output, not a trap");
        let err = out.error.expect("domain error");
        assert_eq!(err.code, "kitchen.invalid_transition");
        assert!(out.operations.is_empty(), "nothing to persist");
        assert!(out.events.is_empty(), "no event for a rejected transition");
    }

    #[test]
    fn the_transition_matrix() {
        // (action, allowed-from). Terminal states: served, cancelled.
        let matrix: [(&str, &[&str]); 5] = [
            ("fire", &["pending"]),
            ("mark_ready", &["pending", "preparing"]),
            ("mark_served", &["ready"]),
            ("recall", &["ready"]),
            ("cancel", &["pending", "preparing", "ready"]),
        ];
        let states = ["pending", "preparing", "ready", "served", "cancelled"];
        for (action, allowed) in matrix {
            for from in states {
                let out = run(action, from).expect("pure fn never traps on a known verb");
                if allowed.contains(&from) {
                    assert!(out.error.is_none(), "{action} from {from} must be allowed: {:?}", out.error);
                    let head = out.operations.iter().find(|o| o.command == "kitchen._set_order_status").unwrap();
                    // The SQL guard is pinned to the state the handler validated against, so a row
                    // that moved in between matches zero rows instead of jumping states.
                    assert_eq!(head.params["require_status"], json!(from), "{action} from {from}");
                    assert_eq!(out.events.len(), 1);
                } else {
                    assert_eq!(
                        out.error.as_ref().map(|e| e.code.as_str()),
                        Some("kitchen.invalid_transition"),
                        "{action} from {from} must be refused"
                    );
                    assert!(out.operations.is_empty() && out.events.is_empty(), "{action} from {from}");
                }
            }
        }
    }

    #[test]
    fn an_unknown_or_foreign_ticket_is_order_unavailable() {
        // The read came back empty: the id is not a ticket of THIS hub (or is deleted).
        let inp = json!({
            "payload": { "order_id": "ghost", "action_name": "fire" },
            "context": { "hub_id": "h1", "current_user_id": "u1", "now": "2026-08-18T10:00:00+00:00", "new_ids": [],
                         "reads": { "kitchen.orders.get": [] } }
        });
        let out = update_order_status_pure(inp).unwrap();
        assert_eq!(out.error.unwrap().code, "kitchen.order_unavailable");
    }

    #[test]
    fn without_the_read_the_handler_refuses_to_guess() {
        // No `reads` at all = a runtime that did not preload the row. The old behaviour (trust the
        // caller, guard in SQL, emit anyway) is exactly the bug: better a trap than a phantom event.
        let err = update_order_status_pure(status_input(json!({ "order_id": "k1", "action_name": "fire" })))
            .expect_err("no read → no transition");
        assert!(err.contains("missing_read"), "got {err}");
    }

    #[test]
    fn served_and_cancel_need_an_order_id() {
        assert!(mark_order_served_pure(status_input(json!({}))).is_err());
        assert!(cancel_order_pure(status_input(json!({}))).is_err());
    }

    // ── kitchen#4: bump/recall per LINE (the KDS gesture) ──────────────────────────────

    /// Input for `kitchen.items.bump` / `kitchen.items.recall`: the order row plus its lines, as
    /// the runtime preloads them (`reads`, ADR-0069). `lines` = [(id, status, station_id)].
    fn lines_input(order_status: &str, lines: &[(&str, &str, &str)], item_ids: &[&str]) -> Value {
        let rows: Vec<Value> = lines
            .iter()
            .map(|(id, st, station)| json!({ "id": id, "order_id": "k1", "status": st, "station_id": station, "station_name": station }))
            .collect();
        json!({
            "payload": { "order_id": "k1", "item_ids": item_ids },
            "context": {
                "hub_id": "h1", "current_user_id": "u1", "now": "2026-08-18T10:00:00+00:00", "new_ids": [],
                "reads": {
                    "kitchen.orders.get": [ { "id": "k1", "status": order_status } ],
                    "kitchen.orders.items": rows
                }
            }
        })
    }

    fn item_ops(out: &Output) -> Vec<&Operation> {
        out.operations.iter().filter(|o| o.command == "kitchen._set_item_status").collect()
    }

    fn order_op(out: &Output) -> Option<&Operation> {
        out.operations.iter().find(|o| o.command == "kitchen._set_order_status")
    }

    #[test]
    fn bumping_one_line_leaves_the_order_and_the_other_lines_alone() {
        // Bar bumps the beer; the grill's burger is still cooking → the ticket stays `preparing`.
        // (Tek-Tips: a bump scoped to one station must never clear the expo's whole ticket.)
        let out = bump_items_pure(lines_input("preparing", &[("i1", "pending", "bar"), ("i2", "preparing", "grill")], &["i1"])).unwrap();
        assert!(out.error.is_none(), "{:?}", out.error);
        let items = item_ops(&out);
        assert_eq!(items.len(), 1);
        assert_eq!(items[0].params["item_id"], json!("i1"));
        assert_eq!(items[0].params["status"], json!("ready"));
        assert_eq!(items[0].params["require_status"], json!("pending"), "guard pinned to the state validated");
        assert_eq!(items[0].params["completed_mode"], json!("set"));
        assert!(order_op(&out).is_none(), "the ticket does not move while a line is still cooking");
        assert_eq!(out.events.len(), 1);
        assert_eq!(out.events[0].name, "kitchen.item.bumped");
        assert_eq!(out.events[0].payload["order_id"], json!("k1"));
        assert_eq!(out.events[0].payload["order_item_id"], json!("i1"));
        assert_eq!(out.events[0].payload["station_id"], json!("bar"));
        assert_eq!(out.events[0].payload["action"], json!("item_bumped"));
    }

    #[test]
    fn bumping_the_last_pending_line_moves_the_ticket_to_ready() {
        // Odoo / Fresh: strike the lines one by one; when none is left the ticket advances by itself.
        let out = bump_items_pure(lines_input("preparing", &[("i1", "ready", "bar"), ("i2", "preparing", "grill")], &["i2"])).unwrap();
        assert!(out.error.is_none());
        let head = order_op(&out).expect("the ticket flips to ready");
        assert_eq!(head.params["status"], json!("ready"));
        assert_eq!(head.params["require_status"], json!("preparing"));
        assert_eq!(head.params["ready_mode"], json!("set"));
        let names: Vec<&str> = out.events.iter().map(|e| e.name.as_str()).collect();
        assert_eq!(names, vec!["kitchen.item.bumped", "kitchen.order.ready"]);
        assert_eq!(out.events[1].payload["action"], json!("bumped"));
    }

    #[test]
    fn a_header_tap_bumps_several_lines_at_once_and_skips_the_ones_already_ready() {
        // The expo taps the header: every line of the ticket that is still cooking is bumped in ONE
        // command; a line already ready is not an error, it is just not touched.
        let out = bump_items_pure(lines_input("preparing", &[("i1", "ready", "bar"), ("i2", "pending", "grill"), ("i3", "preparing", "grill")], &["i1", "i2", "i3"])).unwrap();
        assert!(out.error.is_none());
        let ids: Vec<Value> = item_ops(&out).iter().map(|o| o.params["item_id"].clone()).collect();
        assert_eq!(ids, vec![json!("i2"), json!("i3")]);
        assert!(order_op(&out).is_some(), "nothing left cooking → ready");
        assert_eq!(out.events.iter().filter(|e| e.name == "kitchen.item.bumped").count(), 2);
    }

    #[test]
    fn the_first_line_bumped_on_a_pending_ticket_marks_it_preparing() {
        // A ticket nobody fired explicitly: the first bump proves the kitchen is on it.
        let out = bump_items_pure(lines_input("pending", &[("i1", "pending", "bar"), ("i2", "pending", "grill")], &["i1"])).unwrap();
        assert!(out.error.is_none());
        let head = order_op(&out).expect("pending → preparing");
        assert_eq!(head.params["status"], json!("preparing"));
        assert_eq!(head.params["require_status"], json!("pending"));
        assert_eq!(head.params["set_fired"], json!(1));
        let names: Vec<&str> = out.events.iter().map(|e| e.name.as_str()).collect();
        assert_eq!(names, vec!["kitchen.item.bumped", "kitchen.order.fired"]);
    }

    #[test]
    fn bumping_only_lines_that_are_already_ready_is_a_refused_no_op() {
        let out = bump_items_pure(lines_input("preparing", &[("i1", "ready", "bar")], &["i1"])).unwrap();
        assert_eq!(out.error.as_ref().map(|e| e.code.as_str()), Some("kitchen.invalid_transition"));
        assert!(out.operations.is_empty() && out.events.is_empty());
    }

    #[test]
    fn a_line_that_is_not_on_this_ticket_is_item_unavailable() {
        // The read is scoped to the hub and the ticket: an id outside it is foreign, deleted or forged.
        let out = bump_items_pure(lines_input("preparing", &[("i1", "pending", "bar")], &["ghost"])).unwrap();
        assert_eq!(out.error.as_ref().map(|e| e.code.as_str()), Some("kitchen.item_unavailable"));
        assert!(out.operations.is_empty() && out.events.is_empty());
    }

    #[test]
    fn lines_of_a_served_or_cancelled_ticket_cannot_be_bumped_nor_recalled() {
        for terminal in ["served", "cancelled"] {
            let out = bump_items_pure(lines_input(terminal, &[("i1", "pending", "bar")], &["i1"])).unwrap();
            assert_eq!(out.error.as_ref().map(|e| e.code.as_str()), Some("kitchen.invalid_transition"), "bump on {terminal}");
            let out = recall_items_pure(lines_input(terminal, &[("i1", "ready", "bar")], &["i1"])).unwrap();
            assert_eq!(out.error.as_ref().map(|e| e.code.as_str()), Some("kitchen.invalid_transition"), "recall on {terminal}");
        }
    }

    #[test]
    fn a_missing_ticket_or_missing_reads_are_not_guessed() {
        let mut inp = lines_input("preparing", &[("i1", "pending", "bar")], &["i1"]);
        inp["context"]["reads"]["kitchen.orders.get"] = json!([]);
        let out = bump_items_pure(inp).unwrap();
        assert_eq!(out.error.unwrap().code, "kitchen.order_unavailable");

        let mut inp = lines_input("preparing", &[("i1", "pending", "bar")], &["i1"]);
        inp["context"]["reads"].as_object_mut().unwrap().remove("kitchen.orders.items");
        let err = bump_items_pure(inp).expect_err("no lines read → no bump");
        assert!(err.contains("missing_read"), "got {err}");

        let err = bump_items_pure(status_input(json!({ "order_id": "k1", "item_ids": [] }))).expect_err("empty item_ids");
        assert!(err.contains("missing_item_ids"), "got {err}");
    }

    #[test]
    fn recalling_a_line_of_a_ready_ticket_reopens_the_ticket() {
        // Bump is instant, recall is its undo (Toast/Fresh/TouchBistro): no dialog, and the ticket
        // comes back to the line because a line of it is cooking again.
        let out = recall_items_pure(lines_input("ready", &[("i1", "ready", "bar"), ("i2", "ready", "grill")], &["i2"])).unwrap();
        assert!(out.error.is_none(), "{:?}", out.error);
        let items = item_ops(&out);
        assert_eq!(items.len(), 1);
        assert_eq!(items[0].params["item_id"], json!("i2"));
        assert_eq!(items[0].params["status"], json!("preparing"));
        assert_eq!(items[0].params["require_status"], json!("ready"));
        assert_eq!(items[0].params["completed_mode"], json!("clear"));
        let head = order_op(&out).expect("ready → preparing");
        assert_eq!(head.params["status"], json!("preparing"));
        assert_eq!(head.params["require_status"], json!("ready"));
        assert_eq!(head.params["ready_mode"], json!("clear"));
        let names: Vec<&str> = out.events.iter().map(|e| e.name.as_str()).collect();
        assert_eq!(names, vec!["kitchen.item.recalled", "kitchen.order.recalled"]);
        assert_eq!(out.events[0].payload["action"], json!("item_recalled"));
        assert_eq!(out.events[0].payload["order_item_id"], json!("i2"));
    }

    #[test]
    fn recalling_a_line_of_a_ticket_still_cooking_touches_only_the_line() {
        let out = recall_items_pure(lines_input("preparing", &[("i1", "ready", "bar"), ("i2", "pending", "grill")], &["i1"])).unwrap();
        assert!(out.error.is_none());
        assert_eq!(item_ops(&out).len(), 1);
        assert!(order_op(&out).is_none());
        assert_eq!(out.events.len(), 1);
        assert_eq!(out.events[0].name, "kitchen.item.recalled");
    }

    #[test]
    fn recalling_a_line_that_is_not_ready_is_a_refused_no_op() {
        let out = recall_items_pure(lines_input("preparing", &[("i1", "pending", "bar")], &["i1"])).unwrap();
        assert_eq!(out.error.as_ref().map(|e| e.code.as_str()), Some("kitchen.invalid_transition"));
        assert!(out.operations.is_empty() && out.events.is_empty());
    }

    #[test]
    fn sin_pedido_no_hay_comanda() {
        let inp = json!({
            "payload": { "label": "Mesa 4", "items": [] },
            "context": { "hub_id": "h1", "current_user_id": "u1", "now": "2026-07-18T10:00:00+00:00", "new_ids": ["kit-1"] }
        });
        assert!(create_order_from_order_pure(inp).is_err());
    }

    // ── kitchen#29: the payload of a listened event IS the listener's command payload ───

    /// The events `module.json` routes to `kitchen.logs.create`, read from the manifest itself so a
    /// listener declared tomorrow is covered by the test below the day it is written.
    fn events_routed_to_log_create() -> Vec<String> {
        let manifest: Value = serde_json::from_str(include_str!("../../module.json"))
            .expect("module.json parses");
        manifest["events"]["listen"]
            .as_object()
            .expect("events.listen")
            .iter()
            .filter(|(_, l)| l["command"] == json!("kitchen.logs.create"))
            .map(|(event, _)| event.clone())
            .collect()
    }

    /// Judges a payload the way the runtime judges it before running the listener.
    ///
    /// The relay hands the listener the event payload **verbatim** (`outbox.rs::process_row` →
    /// `commands::execute_at`), and `execute_at` validates it against the JSON Schema of the
    /// DESTINATION command — `schemas/log_create.json` — before touching the database. That schema
    /// is `additionalProperties: false`, so one key too many is not ignored: it is a hard refusal,
    /// retried and finally parked in the dead-letter, and the kitchen log stays empty with nothing
    /// on screen to say why («Sin actividad reciente», kitchen#3).
    ///
    /// The two rules that decide this case are re-read from the schema file on every run, so the
    /// test cannot drift away from the contract it is about.
    fn assert_log_create_accepts(event: &str, payload: &Value) {
        let schema: Value = serde_json::from_str(include_str!("../../schemas/log_create.json"))
            .expect("log_create.json parses");
        assert_eq!(
            schema["additionalProperties"],
            json!(false),
            "this test only makes sense while the destination schema is strict"
        );
        let declared = schema["properties"].as_object().expect("properties");
        let object = payload.as_object().expect("an event payload is an object");
        for key in object.keys() {
            assert!(
                declared.contains_key(key),
                "`{event}` carries `{key}`, which `kitchen.logs.create` does not declare: \
                 additionalProperties:false makes the listener fail before it writes a row"
            );
        }
        for required in schema["required"].as_array().expect("required") {
            let name = required.as_str().unwrap();
            assert!(object.contains_key(name), "`{event}` is missing `{name}`");
        }
        let actions = schema["properties"]["action"]["enum"].as_array().expect("enum");
        assert!(
            actions.contains(&object["action"]),
            "`{event}` logs action {:?}, outside the enum the schema accepts",
            object["action"]
        );
    }

    #[test]
    fn every_event_the_kitchen_log_listens_to_is_accepted_by_log_create() {
        let routed = events_routed_to_log_create();
        assert!(!routed.is_empty(), "the manifest routes events to the log");

        let outputs = [
            run("fire", "pending"),
            run("mark_ready", "preparing"),
            run("mark_served", "ready"),
            run("cancel", "preparing"),
            run("recall", "ready"),
            bump_items_pure(lines_input("preparing", &[("i1", "pending", "bar")], &["i1"])),
            recall_items_pure(lines_input("ready", &[("i1", "ready", "bar")], &["i1"])),
            // kitchen#43: the reception twin — a creation path, the one the TPV walks.
            create_order_from_order_pure(fired(
                "Mesa 4",
                "dine_in",
                json!([{ "product_name": "Croquetas", "quantity": 1_000_000, "unit_price": 350 }]),
            )),
        ];

        let mut covered: Vec<String> = Vec::new();
        for out in outputs {
            let out = out.expect("the transition is allowed");
            assert!(out.error.is_none(), "{:?}", out.error);
            for ev in &out.events {
                if routed.contains(&ev.name) {
                    assert_log_create_accepts(&ev.name, &ev.payload);
                    covered.push(ev.name.clone());
                }
            }
        }
        for event in &routed {
            assert!(covered.contains(event), "no case in this test emits `{event}`");
        }
    }

    // ── pm#93 · los suplementos LLEGAN AL PAPEL ──────────────────────────────────────────────
    //
    // El eslabón que faltaba, y el que se rompía en silencio: `sales` manda ahora los suplementos
    // como una LISTA de objetos (`[{option_id, name, kitchen_name}]`), mientras aquí se leían con
    // `str_or(item, "modifiers", "")`. Un `str_or` sobre un array devuelve cadena vacía ⇒ el
    // camarero teclea «sin cebolla», la venta lo guarda, el evento lo transporta… y **cocina no ve
    // nada**. Sin error, sin aviso: exactamente el fallo estrella del sector, que es de enrutado y
    // no de modelo.
    //
    // `kitchen_order_item.modifiers` es una columna de DISPLAY (el KDS la pinta tal cual en
    // `<div class="mods">`), así que aquí se aplana a texto legible, en el ORDEN de elección.

    fn item_con_mods(mods: Value) -> Value {
        json!([{ "product_id": "p-burger", "product_name": "Hamburguesa", "quantity": 1_000_000,
                 "unit_price": 500, "notes": "", "category_id": null, "order_item_id": "li-1",
                 "modifiers": mods }])
    }

    fn primer_item(out: &Output) -> &Map<String, Value> {
        out.operations
            .iter()
            .find(|o| o.command == "kitchen._insert_item")
            .map(|o| &o.params)
            .expect("una línea de comanda")
    }

    #[test]
    fn los_suplementos_llegan_al_papel_con_su_nombre_de_cocina() {
        let out = create_order_from_order_pure(fired("Mesa 4", "dine_in", item_con_mods(json!([
            { "option_id": "o1", "name": "Sin cebolla", "kitchen_name": "SIN CEBOLLA" },
        ])))).expect("comanda válida");
        assert_eq!(primer_item(&out)["modifiers"], json!("SIN CEBOLLA"));
    }

    #[test]
    fn varios_suplementos_salen_EN_EL_ORDEN_elegido() {
        // Cocina lee en el orden en que se eligió, no en el del catálogo — la petición recurrente
        // en los foros de Square, y el motivo de que el orden viaje intacto desde el TPV.
        let out = create_order_from_order_pure(fired("Mesa 4", "dine_in", item_con_mods(json!([
            { "option_id": "o2", "name": "Extra de queso", "kitchen_name": "+QUESO" },
            { "option_id": "o1", "name": "Sin cebolla", "kitchen_name": "SIN CEBOLLA" },
        ])))).expect("comanda válida");
        // Separador `, ` y no `·`, a propósito: esto acaba en una impresora térmica y NO hay capa de
        // transliteración (lo que se manda es lo que se imprime). `·` es U+00B7, que en CP437 vive en
        // 0xFA pero en latin-1 en 0xB7 — una codificación ingenua saca un carácter de caja en el
        // papel. La coma se lee igual en el KDS y no puede fallar en ninguna tabla de códigos.
        assert_eq!(primer_item(&out)["modifiers"], json!("+QUESO, SIN CEBOLLA"));
    }

    #[test]
    fn sin_kitchen_name_se_imprime_el_comercial() {
        // Un hueco en la comanda es lo mismo que no haberla impreso.
        let out = create_order_from_order_pure(fired("Mesa 4", "dine_in", item_con_mods(json!([
            { "option_id": "o1", "name": "Sin cebolla", "kitchen_name": "" },
        ])))).expect("comanda válida");
        assert_eq!(primer_item(&out)["modifiers"], json!("Sin cebolla"));
    }

    #[test]
    fn sin_ningun_nombre_se_imprime_el_ID_antes_que_nada() {
        // Pasa cuando `sales` no pudo resolver el catálogo al disparar: manda solo el id. Es feo,
        // pero un cocinero que ve un código pregunta; uno que no ve nada, sirve el plato mal.
        let out = create_order_from_order_pure(fired("Mesa 4", "dine_in", item_con_mods(json!([
            { "option_id": "o-sin-cebolla" },
        ])))).expect("comanda válida");
        assert_eq!(primer_item(&out)["modifiers"], json!("o-sin-cebolla"));
    }

    #[test]
    fn el_formato_ANTIGUO_de_texto_sigue_valiendo() {
        // Compat: un `sales` viejo (o cualquier integración) manda `modifiers` como cadena. No se
        // puede romper la comanda de quien no haya actualizado todavía.
        let out = create_order_from_order_pure(fired("Mesa 4", "dine_in", item_con_mods(json!("sin cebolla"))))
            .expect("comanda válida");
        assert_eq!(primer_item(&out)["modifiers"], json!("sin cebolla"));
    }

    #[test]
    fn una_linea_SIN_suplementos_sigue_saliendo_vacia() {
        // Control: el 99 % de las comandas. Romper esto sería romper cocina entera.
        let out = create_order_from_order_pure(fired("Mesa 4", "dine_in", item_con_mods(json!([]))))
            .expect("comanda válida");
        assert_eq!(primer_item(&out)["modifiers"], json!(""));
    }

    // ── kitchen#43: the audit trail starts at RECEPTION ─────────────────────────────────

    /// The exact key set `schemas/log_create.json` accepts. The schema is
    /// `additionalProperties: false` and the relay hands an event payload to the listener
    /// VERBATIM, so ONE extra key is a delivery that retries until it dies in the dead-letter
    /// (kitchen#29) — the reason `kitchen.order.created`, rich with `total`/`items_count`, can
    /// never be routed to the log directly.
    const LOG_CREATE_KEYS: [&str; 6] = [
        "order_id", "order_item_id", "station_id", "action", "performed_by_id", "notes",
    ];

    fn assert_received_log_event(out: &Output, order_id: &str) {
        let ev = out
            .events
            .iter()
            .find(|e| e.name == "kitchen.order.received")
            .expect(
                "every creation path must emit kitchen.order.received: it is the only event \
                 narrow enough for the log, and without it the History's «Recibida» filter \
                 reads a value nobody ever writes (kitchen#43)",
            );
        assert_eq!(ev.payload["action"], json!("received"));
        assert_eq!(ev.payload["order_id"], json!(order_id));
        let mut keys: Vec<&str> = ev
            .payload
            .as_object()
            .expect("an object payload")
            .keys()
            .map(|k| k.as_str())
            .collect();
        keys.sort_unstable();
        let mut expected = LOG_CREATE_KEYS;
        expected.sort_unstable();
        assert_eq!(
            keys, expected,
            "the payload must be EXACTLY what schemas/log_create.json accepts — the relay \
             delivers it verbatim, one extra key kills the delivery"
        );
        // The rich twin survives: whoever listens to the creation still gets its total/items_count.
        assert!(
            out.events.iter().any(|e| e.name == "kitchen.order.created"),
            "kitchen.order.created keeps being emitted with its own payload"
        );
    }

    #[test]
    fn every_creation_path_emits_the_narrow_received_event() {
        // 1. Manual create (`kitchen.orders.create`).
        //
        // kitchen#57 — the fixture used to declare ONE id for a ticket AND its line. It only
        // ever passed because the missing id fell back to `""` and the row was written with an
        // EMPTY primary key; the host hands every handler 256 (`NEW_IDS_BATCH`), so no hub has
        // ever seen that shape. Now the shortage is a loud rejection, and the fixture says the
        // truth: one id for the ticket, one per line.
        let manual = json!({
            "payload": { "order_type": "dine_in",
                         "items": [ { "product_name": "Croquetas", "quantity": 1_000_000, "unit_price": 350 } ] },
            "context": { "hub_id": "h1", "current_user_id": "u1",
                         "now": "2026-08-22T10:00:00+00:00", "new_ids": ["k-manual", "k-manual-1"] }
        });
        let out = create_order_pure(manual).expect("a valid manual create");
        assert_received_log_event(&out, "k-manual");

        // 2. From a completed sale (event `sale.completed`).
        let sale = json!({
            "payload": { "sale_id": "s1",
                         "items": [ { "product_name": "Caña", "quantity": 1_000_000, "unit_price": 250 } ] },
            "context": { "hub_id": "h1", "current_user_id": "u1",
                         "now": "2026-08-22T10:00:00+00:00", "new_ids": ["k-sale", "k-sale-1"] }
        });
        let out = create_order_from_sale_pure(sale).expect("a valid sale create");
        assert_received_log_event(&out, "k-sale");

        // 3. From a fired order — the path the TPV walks (ADR-0141/0144).
        let out = create_order_from_order_pure(fired(
            "Mesa 4",
            "dine_in",
            json!([{ "product_name": "Croquetas", "quantity": 2_000_000, "unit_price": 350 }]),
        ))
        .expect("a valid fired-order create");
        assert_received_log_event(&out, "kit-1");
    }

    // ── kitchen#57 · EACH COMPONENT OF THE MENU REACHES ITS OWN STATION ──────────────────────
    //
    // ADR-0381. A combo is NOT one line: it is a GROUP of sibling lines. Two shapes reach the
    // kitchen and both have to end up the same way — one row per COOKABLE component:
    //
    //  * `supply_kind = 'service'` (the Spanish menu del dia, the majority case): `sales` writes
    //    ONE sale line at the closed price and the components travel in its SNAPSHOT
    //    (`combo_components`). Kitchen EXPANDS it: routing a whole menu by the combo's own
    //    product id is the documented TouchBistro bug — the salad inside the combo ends up on
    //    the grill because it inherits the main dish's printer.
    //  * `supply_kind = 'goods'` (the corner-shop pack): `sales` already writes one line per
    //    component, all sharing `combo_group_ref`. Nothing to expand — but they still have to be
    //    GROUPED under the menu, or cooking sees three loose tickets and they leave the pass at
    //    three different times.
    //
    // And the money stays where ADR-0381 put it: the closed price is the SOURCE line's, never
    // duplicated onto the components (rule 4 — no parent row with money, and no N copies of it
    // either, which would be the same lie with the sign flipped).

    /// `order.fired` carrying a single menu with its chosen components, the shape ADR-0381 fixes
    /// for `supply_kind = 'service'`. 16 ids: enough for the header and every component.
    fn fired_combo(items: Value) -> Value {
        json!({
            "payload": { "order_id": "ord-9", "label": "Mesa 7", "channel": "dine_in", "items": items },
            "context": {
                "hub_id": "h1", "current_user_id": "u1", "now": "2026-08-24T13:00:00+00:00",
                "new_ids": (0..16).map(|i| format!("kit-{i}")).collect::<Vec<_>>()
            }
        })
    }

    /// The menu del dia of the first real customer: starter (cold station), main (grill) and a
    /// drink (bar), 13,50 EUR closed, `service` so `sales` sent ONE line.
    fn menu_del_dia() -> Value {
        json!([{
            "order_item_id": "li-1",
            "product_id": "combo-menu",
            "product_name": "Menu del dia",
            "quantity": 1_000_000,
            "unit_price": 1350,
            "combo_group_ref": "cg-1",
            "combo_name": "Menu del dia",
            "combo_kitchen_name": "MENU",
            "combo_components": [
                { "product_id": "p-gazpacho", "category_id": "cat-frio", "product_name": "Gazpacho",
                  "kitchen_name": "GAZPACHO", "quantity": 1_000_000 },
                { "product_id": "p-entrecot", "category_id": "cat-plancha", "product_name": "Entrecot",
                  "kitchen_name": "ENTRECOT", "quantity": 1_000_000,
                  "modifiers": [{ "option_id": "o1", "name": "Sin cebolla", "kitchen_name": "SIN CEBOLLA" }] },
                { "product_id": "p-tinto", "category_id": "cat-barra", "product_name": "Vino tinto",
                  "quantity": 1_000_000 }
            ]
        }])
    }

    fn items_of(out: &Output) -> Vec<&Map<String, Value>> {
        out.operations
            .iter()
            .filter(|o| o.command == "kitchen._insert_item")
            .map(|o| &o.params)
            .collect()
    }

    #[test]
    fn every_component_of_the_menu_is_routed_by_its_own_article() {
        let out = create_order_from_order_pure(fired_combo(menu_del_dia())).expect("a valid comanda");
        let items = items_of(&out);

        // THREE rows, not one. One line would carry ONE product_id, so `_insert_item` would
        // resolve ONE station for the whole menu: the TouchBistro bug.
        assert_eq!(items.len(), 3, "a menu of three components must open three comanda lines");

        // Each row carries ITS OWN article and category — that is what the routing CTE of
        // `_insert_item` reads to find the station. Never the combo's own id.
        let routed: Vec<(&Value, &Value)> = items
            .iter()
            .map(|p| (&p["product_id"], &p["category_id"]))
            .collect();
        assert_eq!(
            routed,
            vec![
                (&json!("p-gazpacho"), &json!("cat-frio")),
                (&json!("p-entrecot"), &json!("cat-plancha")),
                (&json!("p-tinto"), &json!("cat-barra")),
            ],
            "a component must reach the station of ITS article, never the combo's"
        );
        for p in &items {
            assert_ne!(p["product_id"], json!("combo-menu"), "no row may be routed by the combo itself");
        }
    }

    #[test]
    fn the_components_stay_grouped_under_the_menu_in_the_order_they_were_chosen() {
        let out = create_order_from_order_pure(fired_combo(menu_del_dia())).expect("a valid comanda");
        let items = items_of(&out);

        // The group ref is what lets the KDS and the paper print a HEADER with its lines under
        // it instead of three loose tickets that leave the pass out of sync.
        for p in &items {
            assert_eq!(p["combo_ref"], json!("cg-1"));
            // `kitchen_name` wins over the commercial name (the Toast rule, same as `modifiers`).
            assert_eq!(p["combo_name"], json!("MENU"));
        }

        // Order of CHOICE, not of catalogue — the recurring request in the Square forum. Rows
        // land in one transaction, so `created_at` cannot order them: the sequence is explicit.
        let seq: Vec<&Value> = items.iter().map(|p| &p["line_seq"]).collect();
        assert_eq!(seq, vec![&json!(1), &json!(2), &json!(3)]);
        let names: Vec<&Value> = items.iter().map(|p| &p["product_name"]).collect();
        assert_eq!(names, vec![&json!("GAZPACHO"), &json!("ENTRECOT"), &json!("Vino tinto")],
            "the kitchen name wins; without one the commercial name is printed, never a blank");
    }

    #[test]
    fn a_modifier_hangs_from_its_component_not_from_the_menu() {
        // ADR-0376 unchanged inside a combo: «the main course, no onion» belongs to the main
        // course. Hanging it off the menu is how the cook ends up taking the onion out of the
        // gazpacho.
        let out = create_order_from_order_pure(fired_combo(menu_del_dia())).expect("a valid comanda");
        let items = items_of(&out);
        assert_eq!(items[0]["modifiers"], json!(""));
        assert_eq!(items[1]["modifiers"], json!("SIN CEBOLLA"));
        assert_eq!(items[2]["modifiers"], json!(""));
    }

    #[test]
    fn the_closed_price_is_not_copied_onto_the_components() {
        // ADR-0381 rule 4: no parent row with money. And no N copies of it either — a 13,50 menu
        // must not read as 40,50 on the comanda. The money of the group is the SOURCE line's.
        let out = create_order_from_order_pure(fired_combo(menu_del_dia())).expect("a valid comanda");
        for p in items_of(&out) {
            assert_eq!(p["unit_price"], json!(0));
            assert_eq!(p["total"], json!(0));
        }
        let header = out
            .operations
            .iter()
            .find(|o| o.command == "kitchen._insert_order")
            .map(|o| &o.params)
            .expect("the comanda header");
        assert_eq!(header["total"], json!(1350), "the closed price is counted ONCE");
    }

    #[test]
    fn two_menus_multiply_the_quantity_of_every_component() {
        let mut items = menu_del_dia();
        items[0]["quantity"] = json!(2_000_000);
        let out = create_order_from_order_pure(fired_combo(items)).expect("a valid comanda");
        for p in items_of(&out) {
            assert_eq!(p["quantity"], json!(2_000_000), "two menus are two starters, two mains and two drinks");
        }
    }

    #[test]
    fn a_goods_pack_arrives_already_split_and_is_only_grouped() {
        // `supply_kind = 'goods'`: `sales` already wrote one line per component (each with its
        // own tax rate, art. 79.Dos). There is nothing to expand — kitchen only has to keep them
        // together so they leave the pass at the same time.
        let out = create_order_from_order_pure(fired_combo(json!([
            { "order_item_id": "li-1", "product_id": "p-bocata", "category_id": "cat-frio",
              "product_name": "Bocadillo", "quantity": 1_000_000, "unit_price": 240,
              "combo_group_ref": "cg-2", "combo_name": "Bocata + cana" },
            { "order_item_id": "li-2", "product_id": "p-cana", "category_id": "cat-barra",
              "product_name": "Cana", "quantity": 1_000_000, "unit_price": 160,
              "combo_group_ref": "cg-2", "combo_name": "Bocata + cana" }
        ]))).expect("a valid comanda");
        let items = items_of(&out);
        assert_eq!(items.len(), 2);
        assert_eq!(items[0]["product_id"], json!("p-bocata"));
        assert_eq!(items[1]["product_id"], json!("p-cana"));
        for p in &items {
            assert_eq!(p["combo_ref"], json!("cg-2"));
            assert_eq!(p["combo_name"], json!("Bocata + cana"));
        }
        // Its own money survives: these ARE the fiscal lines, one tax rate each.
        assert_eq!(items[0]["total"], json!(240));
        assert_eq!(items[1]["total"], json!(160));
    }

    #[test]
    fn an_ordinary_line_carries_no_group_and_nothing_changes_for_it() {
        // The control that matters: 24 modules and every non-combo hub keep working exactly as
        // before. Breaking this breaks every kitchen there is.
        let out = create_order_from_order_pure(fired(
            "Mesa 4",
            "dine_in",
            json!([{ "product_id": "p-croquetas", "product_name": "Croquetas",
                     "quantity": 2_000_000, "unit_price": 350, "notes": "sin gluten" }]),
        ))
        .expect("a valid comanda");
        let items = items_of(&out);
        assert_eq!(items.len(), 1);
        assert_eq!(items[0]["combo_ref"], Value::Null);
        assert_eq!(items[0]["combo_name"], json!(""));
        assert_eq!(items[0]["line_seq"], json!(1));
        assert_eq!(items[0]["total"], json!(700));
    }

    #[test]
    fn a_comanda_that_runs_out_of_ids_is_rejected_instead_of_half_written() {
        // The host hands a FINITE batch (`NEW_IDS_BATCH` = 256). Until kitchen#57 the shortage
        // fell through to `unwrap_or_default()` and the line was written with an EMPTY primary
        // key — a comanda half on the pass, which is worse than none.
        let out = create_order_from_order_pure(json!({
            "payload": { "order_id": "ord-x", "label": "Mesa 1", "channel": "dine_in", "items": [
                { "product_id": "p-1", "product_name": "Uno", "quantity": 1_000_000, "unit_price": 100 },
                { "product_id": "p-2", "product_name": "Dos", "quantity": 1_000_000, "unit_price": 100 }
            ]},
            "context": { "hub_id": "h1", "current_user_id": "u1",
                         "now": "2026-08-24T13:00:00+00:00", "new_ids": ["kit-0", "kit-1"] }
        })).expect("a domain rejection, never a panic");
        assert_eq!(out.error.as_ref().expect("rejected").code, "kitchen.too_many_lines");
        assert!(out.operations.is_empty());
    }

    #[test]
    fn a_menu_fired_with_nothing_chosen_does_not_open_a_comanda() {
        // The precondition of ADR-0381 as far as kitchen can honestly enforce it. The
        // per-group `min_choices` gate is `sales`' (it is the one that reads `combos.*`); what
        // kitchen owns is that a menu whose snapshot arrives EMPTY never becomes a blank card on
        // the pass — same door and same reasoning as kitchen#54.
        let out = create_order_from_order_pure(fired_combo(json!([{
            "order_item_id": "li-1", "product_id": "combo-menu", "product_name": "Menu del dia",
            "quantity": 1_000_000, "unit_price": 1350,
            "combo_group_ref": "cg-3", "combo_name": "Menu del dia",
            "combo_components": []
        }]))).expect("a domain rejection, never a panic");
        let err = out.error.as_ref().expect("the menu must be rejected, loudly");
        assert_eq!(err.code, "kitchen.combo_without_components");
        assert!(out.operations.is_empty(), "nothing is written");
        assert!(out.events.is_empty(), "and no listener hears about a comanda that does not exist");
    }
}
