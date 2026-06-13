-- Módulo `kitchen` — módulo ÚNICO de cocina (KDS + comandas + estaciones + auditoría).
-- Esquema inicial (SQLite). Fusión de los antiguos `kitchen` (display/auditoría) y
-- `kitchen_orders` (comandas/estaciones/máquina de estados) — ADR-0014.
-- Prefijo de tabla `kitchen_`. Contrato de fila estándar del hub (§2.5):
-- hub_id + soft-delete (is_deleted/deleted_at) + auditoría (created_by/updated_by).
-- table_id/sale_id/customer_id/product_id/category_id son referencias OPACAS a otros
-- módulos (tables/sales/customers/inventory): nunca se hace JOIN contra sus tablas.

-- Configuración de display + comportamiento de comandas por hub (singleton).
CREATE TABLE IF NOT EXISTS kitchen_settings (
    id                      TEXT PRIMARY KEY,
    hub_id                  TEXT NOT NULL,
    -- display (KDS)
    auto_accept_orders      INTEGER NOT NULL DEFAULT 0,
    show_timer              INTEGER NOT NULL DEFAULT 1,
    warning_time_minutes    INTEGER NOT NULL DEFAULT 15,
    critical_time_minutes   INTEGER NOT NULL DEFAULT 30,
    items_per_page          INTEGER NOT NULL DEFAULT 12,
    auto_refresh_seconds    INTEGER NOT NULL DEFAULT 3,
    sound_enabled           INTEGER NOT NULL DEFAULT 1,
    sound_on_new_order      INTEGER NOT NULL DEFAULT 1,
    sound_on_rush           INTEGER NOT NULL DEFAULT 1,
    auto_bump_enabled       INTEGER NOT NULL DEFAULT 0,
    auto_bump_delay_seconds INTEGER NOT NULL DEFAULT 5,
    color_coding_enabled    INTEGER NOT NULL DEFAULT 1,
    -- comandas (del antiguo kitchen_orders_settings)
    auto_print_tickets      INTEGER NOT NULL DEFAULT 1,
    use_rounds              INTEGER NOT NULL DEFAULT 1,
    auto_fire_on_round      INTEGER NOT NULL DEFAULT 0,
    default_order_type      TEXT NOT NULL DEFAULT 'dine_in',   -- dine_in|takeaway|delivery
    is_deleted              INTEGER NOT NULL DEFAULT 0,
    deleted_at              TEXT,
    created_by              TEXT,
    updated_by              TEXT,
    created_at              TEXT NOT NULL,
    updated_at              TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_kitchen_settings_hub ON kitchen_settings (hub_id);
CREATE INDEX IF NOT EXISTS idx_kitchen_settings_hub ON kitchen_settings (hub_id, is_deleted);

-- Estación de producción para enrutar las líneas de comanda (Bar, Plancha, Postres…).
-- name es único por hub.
CREATE TABLE IF NOT EXISTS kitchen_station (
    id           TEXT PRIMARY KEY,
    hub_id       TEXT NOT NULL,
    name         TEXT NOT NULL,
    name_es      TEXT NOT NULL DEFAULT '',
    description  TEXT NOT NULL DEFAULT '',
    color        TEXT NOT NULL DEFAULT '#F97316',
    icon         TEXT NOT NULL DEFAULT 'flame-outline',
    printer_name TEXT NOT NULL DEFAULT '',
    sort_order   INTEGER NOT NULL DEFAULT 0,
    is_active    INTEGER NOT NULL DEFAULT 1,
    is_deleted   INTEGER NOT NULL DEFAULT 0,
    deleted_at   TEXT,
    created_by   TEXT,
    updated_by   TEXT,
    created_at   TEXT NOT NULL,
    updated_at   TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_kitchen_station_hub_name ON kitchen_station (hub_id, name);
CREATE INDEX        IF NOT EXISTS ix_kitchen_station_hub_active ON kitchen_station (hub_id, is_active);
CREATE INDEX        IF NOT EXISTS idx_kitchen_station_hub ON kitchen_station (hub_id, is_deleted);

-- Comanda / ticket.
CREATE TABLE IF NOT EXISTS kitchen_order (
    id           TEXT PRIMARY KEY,
    hub_id       TEXT NOT NULL,
    order_number TEXT NOT NULL,
    table_id     TEXT,                              -- ref a tables (otro módulo)
    sale_id      TEXT,                              -- ref a sales (otro módulo)
    customer_id  TEXT,                              -- ref a customers (otro módulo)
    waiter_id    TEXT,
    order_type   TEXT NOT NULL DEFAULT 'dine_in',   -- dine_in|takeaway|delivery
    status       TEXT NOT NULL DEFAULT 'pending',   -- pending|preparing|ready|served|paid|cancelled
    priority     TEXT NOT NULL DEFAULT 'normal',    -- normal|rush|vip
    round_number INTEGER NOT NULL DEFAULT 1,
    notes        TEXT NOT NULL DEFAULT '',
    subtotal     INTEGER NOT NULL DEFAULT 0,  -- céntimos (ADR-0007)
    tax          INTEGER NOT NULL DEFAULT 0,  -- céntimos
    discount     INTEGER NOT NULL DEFAULT 0,  -- céntimos
    total        INTEGER NOT NULL DEFAULT 0,  -- céntimos
    fired_at     TEXT,
    ready_at     TEXT,
    served_at    TEXT,
    is_deleted   INTEGER NOT NULL DEFAULT 0,
    deleted_at   TEXT,
    created_by   TEXT,
    updated_by   TEXT,
    created_at   TEXT NOT NULL,
    updated_at   TEXT
);
CREATE INDEX IF NOT EXISTS ix_kitchen_order_hub_status  ON kitchen_order (hub_id, status);
CREATE INDEX IF NOT EXISTS ix_kitchen_order_hub_created ON kitchen_order (hub_id, created_at);
CREATE INDEX IF NOT EXISTS ix_kitchen_order_hub_type    ON kitchen_order (hub_id, order_type);
CREATE INDEX IF NOT EXISTS ix_kitchen_order_hub_number  ON kitchen_order (hub_id, order_number);
CREATE INDEX IF NOT EXISTS idx_kitchen_order_hub        ON kitchen_order (hub_id, is_deleted);
-- Idempotencia de create_from_sale: una comanda viva por venta (el bus puede reentregar;
-- además del marcador _event_delivery del runtime, la BD rechaza el duplicado).
CREATE UNIQUE INDEX IF NOT EXISTS uq_kitchen_order_sale ON kitchen_order (hub_id, sale_id)
    WHERE sale_id IS NOT NULL AND is_deleted = 0;

-- Contador atómico de nº de comanda por hub+día (order_number YYYYMMDD-NNNN).
-- Mismo patrón que sales_sale_counter: upsert (_bump_counter) + lectura por subquery
-- en la MISMA transacción del _insert_order (sin read-back desde el guest WASM).
CREATE TABLE IF NOT EXISTS kitchen_order_counter (
    id          TEXT PRIMARY KEY,
    hub_id      TEXT NOT NULL,
    day         TEXT NOT NULL,                      -- YYYYMMDD
    last_number INTEGER NOT NULL DEFAULT 0
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_kitchen_order_counter ON kitchen_order_counter (hub_id, day);

-- Línea de comanda enrutada a una estación. product_id es ref opaca a inventory.
CREATE TABLE IF NOT EXISTS kitchen_order_item (
    id           TEXT PRIMARY KEY,
    hub_id       TEXT NOT NULL,
    order_id     TEXT NOT NULL,
    station_id   TEXT,
    product_id   TEXT,                              -- ref a inventory (otro módulo)
    product_name TEXT NOT NULL,
    unit_price   INTEGER NOT NULL DEFAULT 0,  -- céntimos
    quantity     INTEGER NOT NULL DEFAULT 1,
    total        INTEGER NOT NULL DEFAULT 0,  -- céntimos
    modifiers    TEXT NOT NULL DEFAULT '',
    notes        TEXT NOT NULL DEFAULT '',
    status       TEXT NOT NULL DEFAULT 'pending',   -- pending|preparing|ready|served|cancelled
    seat_number  INTEGER,
    fired_at     TEXT,
    started_at   TEXT,
    completed_at TEXT,
    is_deleted   INTEGER NOT NULL DEFAULT 0,
    deleted_at   TEXT,
    created_by   TEXT,
    updated_by   TEXT,
    created_at   TEXT NOT NULL,
    updated_at   TEXT,
    FOREIGN KEY (order_id)   REFERENCES kitchen_order (id)   ON DELETE CASCADE,
    FOREIGN KEY (station_id) REFERENCES kitchen_station (id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS ix_kitchen_item_status         ON kitchen_order_item (hub_id, status);
CREATE INDEX IF NOT EXISTS ix_kitchen_item_station_status ON kitchen_order_item (hub_id, station_id, status);
CREATE INDEX IF NOT EXISTS ix_kitchen_item_order          ON kitchen_order_item (hub_id, order_id);
CREATE INDEX IF NOT EXISTS idx_kitchen_order_item_hub     ON kitchen_order_item (hub_id, is_deleted);

-- Modificador aplicado a una línea (extra de ingrediente, punto de cocción…).
CREATE TABLE IF NOT EXISTS kitchen_order_modifier (
    id            TEXT PRIMARY KEY,
    hub_id        TEXT NOT NULL,
    order_item_id TEXT NOT NULL,
    name          TEXT NOT NULL,
    price         INTEGER NOT NULL DEFAULT 0,  -- céntimos
    is_deleted    INTEGER NOT NULL DEFAULT 0,
    deleted_at    TEXT,
    created_by    TEXT,
    updated_by    TEXT,
    created_at    TEXT NOT NULL,
    updated_at    TEXT,
    FOREIGN KEY (order_item_id) REFERENCES kitchen_order_item (id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS ix_kitchen_modifier_item ON kitchen_order_modifier (hub_id, order_item_id);
CREATE INDEX IF NOT EXISTS idx_kitchen_order_modifier_hub ON kitchen_order_modifier (hub_id, is_deleted);

-- Enrutado producto → estación (mapeo directo). product_id es ref opaca a inventory.
CREATE TABLE IF NOT EXISTS kitchen_product_station (
    id          TEXT PRIMARY KEY,
    hub_id      TEXT NOT NULL,
    product_id  TEXT NOT NULL,                      -- ref a inventory (otro módulo)
    station_id  TEXT NOT NULL,
    is_deleted  INTEGER NOT NULL DEFAULT 0,
    deleted_at  TEXT,
    created_by  TEXT,
    updated_by  TEXT,
    created_at  TEXT NOT NULL,
    updated_at  TEXT,
    FOREIGN KEY (station_id) REFERENCES kitchen_station (id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_kitchen_product_station_hub_product ON kitchen_product_station (hub_id, product_id);
CREATE INDEX        IF NOT EXISTS idx_kitchen_product_station_hub ON kitchen_product_station (hub_id, is_deleted);

-- Enrutado categoría → estación. category_id es ref opaca a inventory.
CREATE TABLE IF NOT EXISTS kitchen_category_station (
    id          TEXT PRIMARY KEY,
    hub_id      TEXT NOT NULL,
    category_id TEXT NOT NULL,                      -- ref a inventory (otro módulo)
    station_id  TEXT NOT NULL,
    is_deleted  INTEGER NOT NULL DEFAULT 0,
    deleted_at  TEXT,
    created_by  TEXT,
    updated_by  TEXT,
    created_at  TEXT NOT NULL,
    updated_at  TEXT,
    FOREIGN KEY (station_id) REFERENCES kitchen_station (id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_kitchen_category_station_hub_category ON kitchen_category_station (hub_id, category_id);
CREATE INDEX        IF NOT EXISTS idx_kitchen_category_station_hub ON kitchen_category_station (hub_id, is_deleted);

-- Auditoría de acciones del KDS (recibida, lanzada, lista, servida, recall, cancelada…).
CREATE TABLE IF NOT EXISTS kitchen_order_log (
    id              TEXT PRIMARY KEY,
    hub_id          TEXT NOT NULL,
    order_id        TEXT NOT NULL,
    order_item_id   TEXT,
    station_id      TEXT,
    action          TEXT NOT NULL,                 -- received|accepted|started|bumped|completed|served|recalled|cancelled|priority_changed|item_bumped
    performed_by_id TEXT,
    notes           TEXT NOT NULL DEFAULT '',
    is_deleted      INTEGER NOT NULL DEFAULT 0,
    deleted_at      TEXT,
    created_by      TEXT,
    updated_by      TEXT,
    created_at      TEXT NOT NULL,
    updated_at      TEXT
);
CREATE INDEX IF NOT EXISTS idx_kitchen_order_log_hub   ON kitchen_order_log (hub_id, is_deleted);
CREATE INDEX IF NOT EXISTS idx_kitchen_order_log_order ON kitchen_order_log (hub_id, order_id);
