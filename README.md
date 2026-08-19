# Módulo `kitchen` — KDS, comandas y estaciones

Módulo **único de cocina** (ADR-0014, absorbe el antiguo `kitchen_orders`): pantalla de cocina (KDS),
**comandas** de producción con su máquina de estados, **estaciones** con enrutado producto→estación, y
**auditoría** de todas las acciones. La comanda **nace del PEDIDO disparado** (`order.fired`,
ADR-0141/0144), no del cobro: el camarero dispara al tomar nota.

> **Module id:** `kitchen`. **Depende de:** `sales`, `inventory` — y de **nadie más**: la referencia a
> la sala es una **etiqueta opaca** que se imprime tal cual, así que una pizzería de recogida o un
> obrador funcionan sin `tables`. Módulo híbrido: SQL + handler WASM (7 funciones).

## Documentación de usuario — [`docs/`](docs/)

Viaja **dentro** del módulo y se versiona con él: el asistente del hub (ADR-0282) la indexa por
versión instalada y cita la de TU versión, no la de la última publicada. En inglés (idioma fuente).

| Fichero | Para qué |
| ------- | -------- |
| [`docs/overview.md`](docs/overview.md) | Qué hace y qué NO hace; el vocabulario (estados, tipos, prioridades, destinos) |
| [`docs/screens.md`](docs/screens.md) | Display / Commands / Stations y los dos paneles que aporta al TPV |
| [`docs/concepts.md`](docs/concepts.md) | La comanda nace al DISPARAR, cada disparo es una RONDA, cocina no sabe qué es una mesa, el destino es de la ESTACIÓN, la impresión vive en el shell |
| [`docs/limits.md`](docs/limits.md) | Enrutado por categoría **inerte**, disparar con el módulo inactivo PIERDE la comanda, permisos por acción |

## Qué expone hoy

| Tipo | Nombre | Permiso |
| ---- | ------ | ------- |
| query | `kitchen.orders.list` / `.get` / `.items` · `kitchen.stations.list` / `.pending_counts` | `view_order` |
| query | `kitchen.settings.get` · `kitchen.logs.list` | `view_settings` · `view_log` |
| command | `kitchen.orders.create` (WASM) / `.create_from_order` (WASM, listener) / `.create_from_sale` (WASM, legacy) | `add_order` |
| command | `kitchen.orders.update` / `.set_status` (WASM: fire · mark_ready · recall) | `change_order` |
| command | `kitchen.orders.mark_served` (WASM) · `kitchen.orders.cancel` (WASM) | `complete_order` · `cancel_order` |
| command | `kitchen.orders.delete` (WASM) | `delete_order` |
| command | `kitchen.stations.create` / `.update` / `.delete` (WASM) / `.set_routing` (WASM) | `manage_settings` |
| command | `kitchen.settings.update` · `kitchen.logs.create` | `change_settings` · `add_log` |
| escucha | `order.fired` → `create_from_order` · `kitchen.order.*` / `kitchen.item.*` → `logs.create` | — |
| emite | `kitchen.order.*`, `kitchen.item.*`, `kitchen.station.*`, `kitchen.routing.changed`, `kitchen.settings.updated` | — |
| slots | `sales.pos.actions` → `erp-kitchen-pos-fire` · `sales.pos.order_info` → `erp-kitchen-pos-comandas` | `add_order` · `view_order` |

Navegación: `erp-kitchen-display` («Display», el KDS: rejilla de comandas por estación con
bump/recall por línea, semáforo y All-Day — kitchen#4), `erp-kitchen-orders-active` («Commands»),
`erp-kitchen-orders-stations` («Stations»), `erp-kitchen-history` («History», el log); ajustes
declarativos (ADR-0082).

## Layout

```text
module.json                   # manifest (contrato técnico)
migrations/postgres/          # esquema §2.5 (hub_id + soft-delete + auditoría)
queries/*.sql                 # lecturas declarativas (:hub_id inyectado)
commands/*.sql                # escrituras declarativas (las `_` son intenciones del WASM)
schemas/*.json                # JSON Schemas de input (draft 2020-12)
handler/                      # WASM Tier 2 → dist/handler.wasm
ui/                           # Web Components (Lit/Ionic/OutfitKit)
docs/                         # documentación de usuario + corpus del asistente
```

## Estado y trabajo abierto

El estado vive en las **Issues de este repo**, no aquí. Limitaciones conocidas y documentadas en
`docs/limits.md`: enrutado por **categoría inerte** (el TPV no manda `category_id` y producto↔categoría
es M2M), **entrega insegura** al disparar con el módulo inactivo (falta guard/ack), y auto-accept/
auto-bump sin tarea programada que los aplique.

Doc de arquitectura: `architecture/modules/kitchen.md` (cargarlo antes de tocar el módulo).
