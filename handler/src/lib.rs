//! Handler WASM (Tier 2) del módulo `kitchen` — comandas de cocina (fusión ADR-0014).
//!
//! Lógica pura, sin BD: cada función recibe `{payload, context}`, calcula y devuelve
//! **intenciones** (commands `_`-prefijados del propio módulo) que el host valida y
//! ejecuta en UNA transacción, más los eventos `kitchen.*` a emitir.
//!
//! Restricciones del runtime actual (sin lecturas pre-cargadas):
//! * el snapshot de producto (`product_name`/`unit_price`/`category_id`) viaja en el
//!   payload (patrón `sales`); la resolución de estación (routing) y los guardas de
//!   estado se aplican EN EL SQL de la intención (no-op si no se cumplen);
//! * ids: el host pasa `context.new_ids` (autoridad de ids); el guest solo los reparte;
//! * `order_number` atómico `YYYYMMDD-NNNN`: `_bump_counter` (upsert) + `_insert_order`
//!   leyendo el contador con subquery en la misma transacción (patrón `sales`).

use erplora_guest_sdk::money::{self, Qty};
use erplora_guest_sdk::units::QUANTITY_SCALE;
use rust_decimal::Decimal;
use erplora_guest_sdk::{Event, Operation, Output};
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

#[cfg(feature = "guest")]
#[plugin_fn]
pub fn delete_order(input: Json<erplora_guest_sdk::Input>) -> FnResult<Json<Output>> {
    to_fn_result(delete_order_pure(input.into_inner().into_value()))
}

/// ADR-0141: la comanda nace del PEDIDO. Ver `create_order_from_order_pure`.
#[cfg(feature = "guest")]
#[plugin_fn]
pub fn create_order_from_order(input: Json<erplora_guest_sdk::Input>) -> FnResult<Json<Output>> {
    to_fn_result(create_order_from_order_pure(input.into_inner().into_value()))
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
        Value::Number(n) => n.as_i64().unwrap_or_else(|| n.as_f64().map(|f| f as i64).unwrap_or(d)),
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
    if s.is_empty() { d.to_string() } else { s }
}

/// String opcional: '' o ausente → NULL (refs opacas table_id/customer_id/…).
fn opt_str(p: &Value, k: &str) -> Value {
    let s = as_str(p.get(k).unwrap_or(&Value::Null));
    if s.is_empty() { Value::Null } else { Value::String(s) }
}


fn day_from_now(now: &str) -> String {
    let date = now.split('T').next().unwrap_or("");
    let digits: String = date.chars().filter(|c| c.is_ascii_digit()).collect();
    if digits.len() >= 8 { digits[..8].to_string() } else { "00000000".to_string() }
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
        user_id: context.get("current_user_id").map(as_str).unwrap_or_default(),
        new_ids,
    };
    (payload, ctx)
}

const ORDER_TYPES: [&str; 3] = ["dine_in", "takeaway", "delivery"];
const PRIORITIES: [&str; 3] = ["normal", "rush", "vip"];

/// Payload estándar de los eventos `kitchen.order.*` que escucha `kitchen.logs.create`
/// (el payload del evento ES el payload del listener: debe traer order_id/action/notes).
fn order_event(name: &str, order_id: &str, action: &str, notes: &str, user_id: &str) -> Event {
    Event::new(name, json!({
        "sender": "kitchen",
        "order_id": order_id,
        "order_item_id": Value::Null,
        "station_id": Value::Null,
        "action": action,
        "performed_by_id": if user_id.is_empty() { Value::Null } else { json!(user_id) },
        "notes": notes,
    }))
}

/// Construye las intenciones `_bump_counter` + `_insert_order` + N×`_insert_item`.
/// Devuelve (ops, total). `items` ya viene normalizado (snapshot en el payload).
#[allow(clippy::too_many_arguments)]
fn build_order_ops(
    ctx: &Ctx,
    order_id: &str,
    day: &str,
    header: &Value,
    sale_id: Value,
    items: &[Value],
) -> (Vec<Operation>, i64) {
    let mut ops: Vec<Operation> = Vec::new();

    let mut bump = Map::new();
    bump.insert("day".into(), json!(day));
    ops.push(Operation::sql("kitchen._bump_counter", bump));

    let header_idx = ops.len();
    ops.push(Operation::sql("kitchen._insert_order", Map::new())); // placeholder

    let mut subtotal: i64 = 0; // céntimos
    for (i, item) in items.iter().enumerate() {
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

        let item_id = ctx.new_ids.get(i + 1).cloned().unwrap_or_default();
        let mut p = Map::new();
        p.insert("item_id".into(), json!(item_id));
        p.insert("order_id".into(), json!(order_id));
        p.insert("station_id".into(), opt_str(item, "station_id"));
        p.insert("product_id".into(), opt_str(item, "product_id"));
        p.insert("category_id".into(), opt_str(item, "category_id"));
        // De qué línea de pedido salió esto: es lo que necesita la anulación para repartir
        // cantidades entre las estaciones que recibieron cada ronda.
        p.insert("sales_order_item_id".into(), opt_str(item, "order_item_id"));
        p.insert("product_name".into(), json!(str_or(item, "product_name", "")));
        p.insert("unit_price".into(), json!(unit_price)); // céntimos
        // Punto fijo 10⁶ TAMBIÉN en la fila (ADR-0147 §2.1: REAL prohibido para cantidades de
        // negocio; la migración 005 reescala la columna). El lógico solo existe al pintar.
        p.insert("quantity".into(), json!(qty_raw));
        p.insert("total".into(), json!(line_total)); // céntimos
        p.insert("modifiers".into(), json!(str_or(item, "modifiers", "")));
        p.insert("notes".into(), json!(str_or(item, "notes", "")));
        p.insert("status".into(), json!("pending"));
        p.insert("seat_number".into(), item.get("seat_number").cloned().unwrap_or(Value::Null));
        ops.push(Operation::sql("kitchen._insert_item", p));
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
    h.insert("order_type".into(), json!(str_or(header, "order_type", "dine_in")));
    h.insert("status".into(), json!("pending"));
    h.insert("priority".into(), json!(str_or(header, "priority", "normal")));
    h.insert("round_number".into(), json!(header.get("round_number").map(|v| as_i64(v, 1)).unwrap_or(1)));
    h.insert("notes".into(), json!(str_or(header, "notes", "")));
    h.insert("subtotal".into(), json!(subtotal)); // céntimos
    h.insert("tax".into(), json!(0));
    h.insert("discount".into(), json!(0));
    h.insert("total".into(), json!(total)); // céntimos
    ops[header_idx] = Operation::sql("kitchen._insert_order", h);

    (ops, total)
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
    let items = payload.get("items").and_then(|v| v.as_array()).unwrap_or(&empty);
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
    let (ops, total) = build_order_ops(&ctx, &order_id, &day, &header, Value::Null, items);

    let mut ev = order_event("kitchen.order.created", &order_id, "received", "", &ctx.user_id);
    if let Value::Object(p) = &mut ev.payload {
        p.insert("total".into(), json!(total)); // céntimos
        p.insert("items_count".into(), json!(items.len()));
        p.insert("order_type".into(), json!(payload.get("order_type").map(as_str).unwrap_or_else(|| "dine_in".into())));
    }

    Ok(Output { operations: ops, events: vec![ev] })
}

// ── update_order_status (command kitchen.orders.set_status) ────────────────

pub fn update_order_status_pure(input: Value) -> Result<Output, String> {
    let (payload, ctx) = split_input(&input);
    let order_id = as_str(payload.get("order_id").unwrap_or(&Value::Null));
    if order_id.is_empty() {
        return Err("missing_order_id".to_string());
    }
    let action = as_str(payload.get("action_name").unwrap_or(&Value::Null));
    let reason = str_or(&payload, "reason", "");

    // (status, require_status, set_fired, ready_mode, served_mode, append_note,
    //  cascade: Option<(from_status, to_status, set_fired, completed_mode)>, evento, log_action)
    let (status, require, set_fired, ready_mode, served_mode, append_note, cascade, event, log_action) =
        match action.as_str() {
            "fire" => ("preparing", "", 1, "keep", "keep", String::new(),
                Some(("pending", "preparing", 1, "keep")), "kitchen.order.fired", "started"),
            "mark_ready" => ("ready", "", 0, "set", "keep", String::new(),
                None, "kitchen.order.ready", "bumped"),
            "mark_served" => ("served", "", 0, "keep", "set", String::new(),
                None, "kitchen.order.served", "served"),
            "cancel" => ("cancelled", "", 0, "keep", "keep",
                if reason.is_empty() { String::new() } else { format!("Cancelled: {reason}") },
                Some(("", "cancelled", 0, "keep")), "kitchen.order.cancelled", "cancelled"),
            // recall: SOLO si la comanda está en ready (guarda en el WHERE del SQL).
            "recall" => ("preparing", "ready", 0, "clear", "keep", String::new(),
                Some(("ready", "preparing", 0, "clear")), "kitchen.order.recalled", "recalled"),
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
    Ok(Output { operations: ops, events: vec![ev] })
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
    let ev = order_event("kitchen.order.deleted", &order_id, "cancelled", "deleted", &ctx.user_id);
    Ok(Output {
        operations: vec![Operation::sql("kitchen._order_soft_delete", p)],
        events: vec![ev],
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
    let (ops, total) = build_order_ops(&ctx, &order_id, &day, &header, json!(sale_id), &items);

    let mut ev = order_event("kitchen.order.created", &order_id, "received", "", &ctx.user_id);
    if let Value::Object(p) = &mut ev.payload {
        p.insert("sale_id".into(), json!(sale_id));
        p.insert("total".into(), json!(total)); // céntimos
        p.insert("items_count".into(), json!(items.len()));
        p.insert("order_type".into(), json!(order_type));
    }
    Ok(Output { operations: ops, events: vec![ev] })
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
    let ev = Event::new("kitchen.station.deleted", json!({
        "sender": "kitchen",
        "station_id": station_id,
    }));
    Ok(Output {
        operations: vec![Operation::sql("kitchen._station_soft_delete", p)],
        events: vec![ev],
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

    let ev = Event::new("kitchen.routing.changed", json!({
        "sender": "kitchen",
        "station_id": station_id,
        "product_id": if product_id.is_empty() { Value::Null } else { json!(product_id) },
        "category_id": if category_id.is_empty() { Value::Null } else { json!(category_id) },
    }));
    Ok(Output { operations: ops, events: vec![ev] })
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

    let channel = as_str(payload.get("channel").unwrap_or(&Value::Null));
    let order_type = if ORDER_TYPES.contains(&channel.as_str()) { channel } else { "dine_in".to_string() };
    let label = str_or(&payload, "label", "");

    let header = json!({
        "order_type": order_type,
        "priority": "normal",
        "notes": "",
        "round_number": 0, // 0 = "numérala tú" (subconsulta en _insert_order)
    });
    let (mut ops, total) =
        build_order_ops(&ctx, &kitchen_order_id, &day, &header, Value::Null, &items);

    // El pedido de origen y la etiqueta se añaden a la cabecera ya construida: son lo único que
    // este flujo aporta sobre el legacy, y así `build_order_ops` sigue sirviendo a los dos.
    if let Some(op) = ops.iter_mut().find(|o| o.command == "kitchen._insert_order") {
        op.params.insert("source_order_id".into(), json!(source_order_id));
        op.params.insert("label".into(), json!(label));
    }

    let mut ev = order_event("kitchen.order.created", &kitchen_order_id, "received", "", &ctx.user_id);
    if let Value::Object(p) = &mut ev.payload {
        p.insert("source_order_id".into(), json!(source_order_id));
        p.insert("label".into(), json!(label));
        p.insert("total".into(), json!(total)); // céntimos
        p.insert("items_count".into(), json!(items.len()));
        p.insert("order_type".into(), json!(str_or(&header, "order_type", "dine_in")));
    }
    Ok(Output { operations: ops, events: vec![ev] })
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
        assert_eq!(header.params["sale_id"], Value::Null, "todavía no hay venta: nadie ha pagado");
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
        assert_eq!(item.params["quantity"], json!(500_000), "la fila guarda µ, no el lógico f64: {:?}", item.params);
        assert_eq!(item.params["total"], json!(1200), "2400 × 0,5 = 1200 céntimos, un redondeo");
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
        let items: Vec<_> =
            out.operations.iter().filter(|o| o.command == "kitchen._insert_item").collect();
        assert_eq!(items.len(), 1, "el servicio no baja a cocina");
        assert_eq!(items[0].params["product_name"], json!("Tarta"));
    }

    #[test]
    fn sin_pedido_no_hay_comanda() {
        let inp = json!({
            "payload": { "label": "Mesa 4", "items": [] },
            "context": { "hub_id": "h1", "current_user_id": "u1", "now": "2026-07-18T10:00:00+00:00", "new_ids": ["kit-1"] }
        });
        assert!(create_order_from_order_pure(inp).is_err());
    }
}
