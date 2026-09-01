import { LitElement, html, css, nothing } from 'lit';
import { property, state } from 'lit/decorators.js';
import { define } from '@erplora/outfitkit/define';
import '@erplora/outfitkit/ok-inline-feedback';
import '@erplora/outfitkit/ok-empty-state';
// Module i18n catalog (ADR-0055): esbuild inlines these JSON into the WC `dist`.
import esLocale from '../../../locales/es.json';
import enLocale from '../../../locales/en.json';
const CATALOG: Record<string, unknown> = { es: esLocale, en: enLocale };

// ── The KDS (kitchen#4) ────────────────────────────────────────────────────────────────────────
//
// A GRID OF TICKETS, not a table — what every KDS on the market does (Toast, Square, Lightspeed,
// Fresh, TouchBistro, Odoo, LS Central, Simphony; decision in kitchen#4, 2026-08-15):
//   · one card per ticket: label ("Mesa 4"), number, round, priority, and its lines with quantity,
//     modifiers, notes and seat;
//   · station filter on the SNAPSHOT station of the line — by `station_id`, its name PAINTED in
//     the hub's language (`name_es` with `name` as fallback, kitchen#45), plus an expo/pass view
//     that shows every station;
//   · one tap on a line = bump (`kitchen.items.bump`); one tap on a struck line = recall
//     (`kitchen.items.recall`); a header tap bumps ONLY the lines on screen (station-scoped —
//     Tek-Tips: a bar bump must never clear the grill's lines from the expo). The ticket follows
//     its lines on the server (all ready → ready). No confirm dialogs: recall IS the undo;
//   · a two-threshold semaphore over elapsed time (`warning_time_minutes` / `critical_time_minutes`,
//     `kitchen_settings`), honouring `show_timer` and `color_coding_enabled`, and the clock keeps
//     counting in red — it never stops nor disappears;
//   · All-Day: what is left to cook, summed per product (`kitchen.orders.all_day`);
//   · live refresh on `kitchen.order.*` / `kitchen.item.*` events (no polling), 44 px targets.
// Elapsed time and the semaphore are derived HERE, against `kitchen_settings`: presentation, and
// the clock must not depend on the latency of the query.

interface ErploraClientLike {
  query<T = unknown>(name: string, params?: Record<string, unknown>): Promise<T>;
  command<T = unknown>(name: string, payload?: Record<string, unknown>): Promise<T>;
  on(event: string, cb: (payload: unknown) => void): () => void;
  locale: string;
  t(catalog: Record<string, unknown>, key: string, params?: Record<string, unknown>): string;
  /** Permission check of the SDK. Absent on old shells → everything is offered; the runtime gates. */
  hasPermission?(permission: string): boolean;
}

/** One row of `kitchen.orders.display` — a LINE with its ticket header repeated. */
interface DisplayRow {
  order_id: string;
  order_number: string;
  order_status: string;
  order_type: string;
  priority: string;
  label: string;
  /** kitchen#63 · who fired the round — an OPAQUE id, resolved to a name at render. */
  waiter_id: string | null;
  round_number: number | string;
  order_notes: string;
  order_fired_at: string | null;
  ready_at: string | null;
  order_created_at: string;
  item_id: string | null;
  station_id: string | null;
  station_name: string | null;
  destination: string | null;
  product_name: string | null;
  quantity: number | string | null;
  modifiers: string | null;
  item_notes: string | null;
  item_status: string | null;
  seat_number: number | string | null;
  completed_at: string | null;
  /** kitchen#57 · the MENU this line belongs to (ADR-0381); NULL on an ordinary line. */
  combo_ref: string | null;
  combo_name: string | null;
  line_seq: number | string | null;
}

export interface Line {
  id: string;
  /** The station the line went to, resolved at render by id (localized); the snapshot name is the
   *  fallback when the station is gone or the list did not load (kitchen#45). */
  station_id: string | null;
  station: string;
  destination: string;
  product_name: string;
  quantity: number; // fixed-point 10⁶ (ADR-0147)
  modifiers: string;
  notes: string;
  status: string;
  seat: number | null;
  /** The menu this line is a component of (`combo_group_ref`), or null when it is à la carte. */
  combo_ref: string | null;
  /** The FROZEN name of that menu — its kitchen name when it has one. */
  combo_name: string;
}

/** One row of `kitchen.stations.list`, for rendering names in the hub's language. */
interface StationRow {
  id: string;
  name: string;
  name_es: string | null;
}

interface Ticket {
  id: string;
  number: string;
  status: string;
  order_type: string;
  priority: string;
  label: string;
  /** kitchen#63 · the id of whoever fired this round; '' when nobody was attributed. */
  waiter_id: string;
  round: number;
  notes: string;
  since: string; // fired_at ?? created_at
  lines: Line[];
}

/** One row of `hub.users.list` — the hub's people (ADR-0192, the core's reserved namespace).
 *  Personnel belongs to the CORE, not to the `staff` module: same door `sales` uses for its
 *  «who is serving this check» picker (sales#179). */
interface HubUser {
  id: string;
  name: string;
  is_active?: boolean;
}

interface AllDayRow {
  product_name: string;
  station_name: string | null;
  quantity: number | string;
  lines: number | string;
}

/** The display settings this screen reads (`kitchen.settings.get`); the rest is the shell's form. */
interface DisplaySettings {
  show_timer: boolean;
  color_coding_enabled: boolean;
  warning_time_minutes: number;
  critical_time_minutes: number;
}

const DEFAULT_SETTINGS: DisplaySettings = {
  show_timer: true,
  color_coding_enabled: true,
  warning_time_minutes: 15,
  critical_time_minutes: 30,
};

/** Fixed-point 10⁶ (ADR-0147). */
const QUANTITY_SCALE = 1_000_000;

const COOKING = ['pending', 'preparing'];

/** Segment value for the lines that carry no station (unrouted product). */
const NO_STATION = '__none';

function erplora(): ErploraClientLike {
  const c = (globalThis as { erplora?: ErploraClientLike }).erplora;
  if (!c) throw new Error('erplora SDK not initialised by the shell');
  return c;
}

function can(permission: string): boolean {
  const client = erplora();
  return typeof client.hasPermission === 'function' ? client.hasPermission(permission) : true;
}

function truthy(v: unknown): boolean {
  return v === true || v === 1 || v === '1' || v === 'true';
}

/** Business codes (`kitchen.*`) translate through the module catalog `errors`; anything else keeps
 *  the server message. The catalog keys carry dots, so this reads it directly instead of `t()`. */
function errorText(e: unknown, fallbackKey: string): string {
  const code = (e as { code?: unknown } | null)?.code;
  if (typeof code === 'string') {
    const lang = (CATALOG[erplora().locale] ?? CATALOG.en) as { errors?: Record<string, string> } | undefined;
    const text = lang?.errors?.[code] ?? (CATALOG.en as { errors?: Record<string, string> }).errors?.[code];
    if (text) return text;
  }
  return e instanceof Error ? e.message : erplora().t(CATALOG, fallbackKey);
}

/** Groups the one-row-per-line feed into tickets, in the order the feed gave them (oldest first). */
export function groupTickets(rows: DisplayRow[]): Ticket[] {
  const byId = new Map<string, Ticket>();
  for (const r of rows) {
    let t = byId.get(r.order_id);
    if (!t) {
      t = {
        id: r.order_id,
        number: String(r.order_number ?? ''),
        status: String(r.order_status ?? ''),
        order_type: String(r.order_type ?? ''),
        priority: String(r.priority ?? 'normal'),
        label: String(r.label ?? ''),
        waiter_id: String(r.waiter_id ?? ''),
        round: Number(r.round_number ?? 1) || 1,
        notes: String(r.order_notes ?? ''),
        since: String(r.order_fired_at ?? r.order_created_at ?? ''),
        lines: [],
      };
      byId.set(r.order_id, t);
    }
    if (r.item_id) {
      t.lines.push({
        id: r.item_id,
        station_id: r.station_id === null || r.station_id === undefined || r.station_id === '' ? null : String(r.station_id),
        station: String(r.station_name ?? ''),
        destination: String(r.destination ?? 'both'),
        product_name: String(r.product_name ?? ''),
        quantity: Number(r.quantity ?? QUANTITY_SCALE) || 0,
        modifiers: String(r.modifiers ?? ''),
        notes: String(r.item_notes ?? ''),
        status: String(r.item_status ?? 'pending'),
        seat: r.seat_number === null || r.seat_number === undefined || r.seat_number === '' ? null : Number(r.seat_number),
        combo_ref: r.combo_ref === null || r.combo_ref === undefined || r.combo_ref === '' ? null : String(r.combo_ref),
        combo_name: String(r.combo_name ?? ''),
      });
    }
  }
  return Array.from(byId.values());
}

/** A menu with its components, or a single à-la-carte line (`ref === null`). */
export interface LineGroup {
  ref: string | null;
  /** The menu's frozen name; '' when this is not a menu. */
  name: string;
  lines: Line[];
}

/**
 * kitchen#57 · gathers the components of a menu so the card can paint a HEADER with its lines
 * under it (ADR-0381). Square prints the combo as one run-on paragraph and a moderator confirms
 * there is no way to get one component per line; this is the other road.
 *
 * CONSECUTIVE lines only, and that is deliberate. The feed arrives ordered by `line_seq` — the
 * order the courses were CHOSEN, which is what a kitchen reads and what the catalogue order never
 * gives you — so a menu's components are contiguous by construction. Grouping by reference
 * anywhere in the ticket would merge two menus that happened to share a ref and, worse, would
 * silently reorder the food.
 */
export function groupCombos(lines: Line[]): LineGroup[] {
  const out: LineGroup[] = [];
  for (const l of lines) {
    const prev = out[out.length - 1];
    if (l.combo_ref && prev && prev.ref === l.combo_ref) {
      prev.lines.push(l);
      continue;
    }
    out.push({ ref: l.combo_ref, name: l.combo_ref ? l.combo_name : '', lines: [l] });
  }
  return out;
}

/** Renders a fixed-point 10⁶ quantity as units: 2 000 000 → "2", 500 000 → "0,5". */
export function formatQty(micro: number, locale: string): string {
  const units = micro / QUANTITY_SCALE;
  return new Intl.NumberFormat(locale || 'en', { maximumFractionDigits: 3 }).format(units);
}

/** m:ss (or h:mm:ss past the hour). The clock never stops. */
export function formatElapsed(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = h > 0 ? String(m).padStart(2, '0') : String(m);
  return `${h > 0 ? `${h}:` : ''}${mm}:${String(s).padStart(2, '0')}`;
}

export type Semaphore = 'off' | 'ok' | 'warning' | 'critical';

/** Two thresholds (Square, Fresh, LS Central): green < warning → amber < critical → red. */
export function semaphore(elapsedMs: number, s: DisplaySettings): Semaphore {
  if (!s.color_coding_enabled) return 'off';
  const min = elapsedMs / 60_000;
  if (min >= s.critical_time_minutes) return 'critical';
  if (min >= s.warning_time_minutes) return 'warning';
  return 'ok';
}

export class ErpKitchenDisplay extends LitElement {
  static styles = css`
    :host { display:block; font-family: system-ui, sans-serif; color: var(--ion-text-color, #1c1b18); }
    .bar { display:flex; gap:.5rem; align-items:center; flex-wrap:wrap; margin-bottom:.75rem; }
    .bar h2 { margin:0; font-size:1.15rem; }
    .bar .grow { flex:1; }
    ion-segment { min-height:44px; }
    ion-segment-button { min-height:44px; --padding-start:.75rem; --padding-end:.75rem; text-transform:none; }
    ion-button { min-height:44px; --padding-start:1rem; --padding-end:1rem; margin:0; }
    .grid { display:grid; grid-template-columns: repeat(auto-fill, minmax(17rem, 1fr)); gap:.75rem; align-items:start; }
    .card { border:1px solid var(--ion-border-color, #e7e2d6); border-top-width:6px; border-radius: var(--ok-radius-sm, 10px);
            background: var(--ion-item-background, var(--ion-background-color, #fff)); display:flex; flex-direction:column; overflow:hidden; }
    .card[data-sem="ok"] { border-top-color: var(--ion-color-success, #2dd36f); }
    .card[data-sem="warning"] { border-top-color: var(--ion-color-warning, #ffc409); }
    .card[data-sem="critical"] { border-top-color: var(--ion-color-danger, #eb445a); }
    .card[data-sem="critical"] .timer { color: var(--ion-color-danger, #eb445a); }
    .card[data-sem="warning"] .timer { color: var(--ion-color-warning-shade, #e0ac08); }
    .card[data-sem="off"] { border-top-color: var(--ion-border-color, #e7e2d6); }
    .card[data-status="ready"] { opacity:.85; }
    .head { display:flex; align-items:center; gap:.5rem; padding:.6rem .75rem; min-height:44px; cursor:pointer; user-select:none;
            background: var(--ok-surface-2, var(--ion-color-step-50, rgba(var(--ion-text-color-rgb, 24, 24, 27), 0.04))); }
    .head[aria-disabled="true"] { cursor:default; }
    /* The table and, under it, who fired the round (kitchen#63) — the header layout Toast, Square
       for Restaurants and Lightspeed use. A column so the waiter never competes with the pills for
       the row: on a 17rem card the label would be the first thing squeezed. */
    .head .title { flex:1; min-width:0; display:flex; flex-direction:column; gap:.05rem; }
    .head .label { font-weight:700; font-size:1.05rem; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .head .waiter { font-size:.78rem; font-weight:500; opacity:.72; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .head .num { font-variant-numeric: tabular-nums; font-size:.8rem; opacity:.75; }
    .timer { font-variant-numeric: tabular-nums; font-weight:700; font-size:1rem; }
    .pill { display:inline-block; padding:.1rem .5rem; border-radius: var(--ok-radius-pill, 999px); font-size:.7rem; font-weight:700; text-transform:uppercase; }
    .pill.rush { background: var(--ion-color-danger, #eb445a); color:#fff; }
    .pill.vip { background: var(--ion-color-tertiary, #6030ff); color:#fff; }
    .pill.round { background: var(--ok-surface-2, rgba(0,0,0,.06)); }
    .pill.ready { background: var(--ion-color-success, #2dd36f); color:#fff; }
    .lines { list-style:none; margin:0; padding:0; }
    .line { display:flex; gap:.6rem; align-items:flex-start; padding:.55rem .75rem; min-height:44px; border-top:1px solid var(--ion-border-color, #e7e2d6);
            cursor:pointer; user-select:none; -webkit-tap-highlight-color: transparent; }
    .line[aria-disabled="true"] { cursor:default; }
    .line:active { background: var(--ok-surface-2, rgba(0,0,0,.05)); }
    .line .qty { font-weight:800; font-size:1.05rem; min-width:2ch; text-align:right; font-variant-numeric: tabular-nums; }
    .line .body { flex:1; min-width:0; }
    .line .name { font-weight:600; font-size:1rem; }
    .line .mods, .line .note { font-size:.85rem; opacity:.85; }
    .line .note { font-style:italic; }
    .line .meta { font-size:.75rem; opacity:.7; display:flex; gap:.5rem; }
    .line[data-status="ready"] .name, .line[data-status="ready"] .qty { text-decoration: line-through; opacity:.55; }
    .line .tick { font-size:1.4rem; line-height:1; color: var(--ion-color-success, #2dd36f); }
    /* kitchen#57 · A MENU: a quiet header and its components indented behind a rule. The emphasis
       stays on the DISH — the market highlights allergens and changes, never hierarchy — so the
       header is smaller and dimmer than the lines it introduces, not louder. */
    .combo { display:block; border-top:1px solid var(--ion-border-color, #e7e2d6); }
    .combo-head { display:flex; align-items:center; gap:.4rem; min-height:44px; padding:.35rem .75rem;
      font-size:.78rem; text-transform:uppercase; letter-spacing:.04em; opacity:.75;
      background: var(--ok-surface-2, rgba(0,0,0,.035)); cursor:pointer; }
    .combo-head[aria-disabled="true"] { cursor:default; }
    .combo-head:active { background: var(--ok-surface-3, rgba(0,0,0,.07)); }
    .combo-name { font-weight:700; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .combo-count { font-variant-numeric: tabular-nums; }
    .combo-head .tick { margin-left:auto; font-size:1.1rem; line-height:1; color: var(--ion-color-success, #2dd36f); }
    .combo-lines { list-style:none; margin:0; padding:0 0 0 .75rem;
      border-left:3px solid var(--ion-color-medium, #9d968a); margin-left:.75rem; }
    /* The rule already says «these belong together»; a second border per component would only add
       noise, so inside a menu the lines lose their own top border except between siblings. */
    .combo-lines .line:first-child { border-top:0; }
    .combo[data-combo-done="true"] .combo-head { opacity:.5; }
    .combo[data-combo-done="true"] .combo-name { text-decoration: line-through; }
    .foot { display:flex; gap:.5rem; padding:.5rem .75rem; border-top:1px solid var(--ion-border-color, #e7e2d6); }
    .foot ion-button { flex:1; }
    /* kitchen#42 — el fondo del bump se declara AQUÍ, dentro del shadow root, y no con
       \`color="success"\`. Ionic implementa \`color=\` con la regla GLOBAL
       \`.ion-color-success { --ion-color-base: … }\`, que vive en la hoja del documento y NO
       atraviesa el shadow root de un WC de módulo: dentro, el selector no casa con nada,
       \`--ion-color-base\` queda vacío y \`button-solid { background: var(--ion-color-base) }\`
       resuelve a transparente — texto blanco sobre tarjeta blanca, contraste 1:1. Las custom
       properties sí heredan a través del límite, así que el token se lee sin problema.
       Hermana del gotcha de \`fill\` + \`mode="ios"\` (ADR-0143, hub#760/#1060). */
    .foot ion-button[data-action="bump"] {
      --background: var(--ion-color-success);
      --background-activated: var(--ion-color-success-shade);
      --background-hover: var(--ion-color-success-tint);
      --color: var(--ion-color-success-contrast);
    }
    .notes { padding:.4rem .75rem; font-size:.85rem; font-style:italic; opacity:.85; border-top:1px dashed var(--ion-border-color, #e7e2d6); }
    .allday { width:100%; border-collapse:collapse; }
    .allday td, .allday th { padding:.6rem .75rem; text-align:left; border-bottom:1px solid var(--ion-border-color, #e7e2d6); min-height:44px; }
    .allday td.q { font-weight:800; font-size:1.2rem; text-align:right; font-variant-numeric: tabular-nums; width:6ch; }
    .allday td.s { opacity:.7; font-size:.85rem; }
    .section-title { margin:1rem 0 .5rem; font-size:.9rem; text-transform:uppercase; letter-spacing:.04em; opacity:.7; }
    @media (max-width: 480px) { .grid { grid-template-columns: 1fr; } }
  `;

  /** Station filter: '' = expo/pass (every station); `NO_STATION` = lines without station. Set from
   *  the segment; a public property so a fixed screen (the bar's tablet) can be pinned by attribute.
   *  Carries a station ID (kitchen#45): an id survives renames and locale switches, a name does
   *  not — a pinned Spanish name would stop matching the moment the hub changed language. */
  @property({ type: String, reflect: true }) station = '';

  /** 'tickets' (the pass) or 'allday' (what is left to cook, per product). */
  @property({ type: String, reflect: true }) mode: 'tickets' | 'allday' = 'tickets';

  @state() private rows: DisplayRow[] = [];

  @state() private allDay: AllDayRow[] = [];

  @state() private settings: DisplaySettings = { ...DEFAULT_SETTINGS };

  /** The hub's stations by id, to paint station names in the hub's language (kitchen#45). A comanda
   *  freezes its station NAME at send time (ADR-0145) and old lines froze the seed column — the ID
   *  is the fact; the name is presentation, resolved here with the frozen one as fallback. */
  @state() private stationsById = new Map<string, StationRow>();

  /** kitchen#63 · the hub's people by id, to turn the ticket's opaque `waiter_id` into the name the
   *  pass calls out. INACTIVE people stay in the map on purpose: who fired a round is a historical
   *  fact, and a waiter who left the shift — or the company — still has to read on their tickets.
   *  Empty when the query is not reachable, and then the header simply says nothing. */
  @state() private waitersById = new Map<string, string>();

  @state() private error = '';

  @state() private loading = false;

  @state() private now = Date.now();

  private unsub?: () => void;

  private clock?: ReturnType<typeof setInterval>;

  private readonly onLocaleChange = (): void => this.requestUpdate();

  async connectedCallback() {
    super.connectedCallback();
    window.addEventListener('erplora:locale-changed', this.onLocaleChange);
    await Promise.all([this.loadSettings(), this.load()]);
    // Live refresh on every event that changes what the line looks like (no polling). Literal
    // names on purpose: the contract checker reads them (ADR-0127).
    try {
      const reload = () => this.load();
      const offs = [
        erplora().on('kitchen.order.created', reload),
        erplora().on('kitchen.order.updated', reload),
        erplora().on('kitchen.order.fired', reload),
        erplora().on('kitchen.order.ready', reload),
        erplora().on('kitchen.order.served', reload),
        erplora().on('kitchen.order.recalled', reload),
        erplora().on('kitchen.order.cancelled', reload),
        erplora().on('kitchen.order.deleted', reload),
        erplora().on('kitchen.item.bumped', reload),
        erplora().on('kitchen.item.recalled', reload),
        erplora().on('kitchen.settings.updated', () => this.loadSettings()),
      ];
      this.unsub = () => offs.forEach((off) => off());
    } catch {
      /* no SDK (preview) → no live reactivity */
    }
    // The clock: elapsed time and the semaphore are derived here, every second, and never stop.
    this.clock = setInterval(() => (this.now = Date.now()), 1000);
  }

  disconnectedCallback() {
    window.removeEventListener('erplora:locale-changed', this.onLocaleChange);
    if (this.clock) clearInterval(this.clock);
    this.unsub?.();
    super.disconnectedCallback();
  }

  private async loadSettings() {
    try {
      const rows = await erplora().query<Array<Record<string, unknown>>>('kitchen.settings.get');
      const row = Array.isArray(rows) ? rows[0] : (rows as unknown as Record<string, unknown>);
      if (!row) return;
      this.settings = {
        show_timer: row.show_timer === undefined || row.show_timer === null ? DEFAULT_SETTINGS.show_timer : truthy(row.show_timer),
        color_coding_enabled: row.color_coding_enabled === undefined || row.color_coding_enabled === null ? DEFAULT_SETTINGS.color_coding_enabled : truthy(row.color_coding_enabled),
        warning_time_minutes: Number(row.warning_time_minutes ?? DEFAULT_SETTINGS.warning_time_minutes) || DEFAULT_SETTINGS.warning_time_minutes,
        critical_time_minutes: Number(row.critical_time_minutes ?? DEFAULT_SETTINGS.critical_time_minutes) || DEFAULT_SETTINGS.critical_time_minutes,
      };
    } catch {
      /* no settings row (or no permission): defaults */
    }
  }

  private async load() {
    this.loading = true;
    try {
      const [rows, allDay, stations, waiters] = await Promise.all([
        erplora().query<DisplayRow[]>('kitchen.orders.display'),
        erplora().query<AllDayRow[]>('kitchen.orders.all_day'),
        // kitchen#45: names in the hub's language. Optional: without it (no permission, no SDK)
        // the frozen snapshot names still paint — degraded, never broken.
        erplora().query<StationRow[]>('kitchen.stations.list').catch(() => [] as StationRow[]),
        // kitchen#63: the people behind `waiter_id`. Same door `sales` uses (`hub.users.list`,
        // ADR-0192) and the same policy on failure: the pass keeps working and the header says
        // nothing, because a UUID on the card would be worse than a blank.
        erplora().query<HubUser[]>('hub.users.list').catch(() => [] as HubUser[]),
      ]);
      this.rows = Array.isArray(rows) ? rows : [];
      this.allDay = Array.isArray(allDay) ? allDay : [];
      this.stationsById = new Map((Array.isArray(stations) ? stations : []).map((s) => [String(s.id), s]));
      this.waitersById = new Map(
        (Array.isArray(waiters) ? waiters : [])
          .filter((u) => u && u.id && String(u.name ?? '').trim())
          .map((u) => [String(u.id), String(u.name).trim()]),
      );
    } catch (e) {
      this.error = errorText(e, 'ui.loadError');
    } finally {
      this.loading = false;
    }
  }

  // ── derived ────────────────────────────────────────────────────────────────

  private get tickets(): Ticket[] {
    return groupTickets(this.rows);
  }

  /** The station's name in the hub's language, with the line's frozen snapshot as the fallback:
   *  the station may carry no translation, be deleted, or the list may not have loaded. */
  private stationName(l: Line): string {
    const row = l.station_id ? this.stationsById.get(l.station_id) : undefined;
    if (!row) return l.station;
    return String(row.name_es || row.name || l.station);
  }

  /** kitchen#63 · the NAME of the waiter who fired this round, or '' when there is none to show.
   *
   *  '' covers three cases on purpose, and all three paint the same nothing: the round carries no
   *  waiter (an old ticket, a fire with no session), the hub does not list that id any more, or the
   *  list could not be loaded. A raw id would be worse than a blank — the cook reads it from two
   *  metres away, cannot use it, and stops trusting the header. */
  private waiterName(t: Ticket): string {
    return (t.waiter_id && this.waitersById.get(t.waiter_id)) || '';
  }

  /** The stations present on the line, for the segment: keyed by ID (stable across renames and
   *  locale switches), labelled in the hub's language. '' = lines without a station. */
  private get stations(): { id: string; label: string }[] {
    const byId = new Map<string, string>();
    for (const t of this.tickets)
      for (const l of t.lines) {
        const key = l.station_id ?? '';
        if (!byId.has(key)) byId.set(key, this.stationName(l));
      }
    return Array.from(byId, ([id, label]) => ({ id, label })).sort((a, b) =>
      a.id === '' ? 1 : b.id === '' ? -1 : a.label.localeCompare(b.label),
    );
  }

  /** The lines of a ticket this screen shows: all of them (expo) or the station's. */
  private visibleLines(t: Ticket): Line[] {
    if (!this.station) return t.lines;
    const wantNone = this.station === NO_STATION;
    return t.lines.filter((l) => (l.station_id ?? '') === (wantNone ? '' : this.station));
  }

  private elapsed(t: Ticket): number {
    const since = Date.parse(t.since);
    return Number.isFinite(since) ? Math.max(0, this.now - since) : 0;
  }

  // ── actions (one tap, no dialogs) ──────────────────────────────────────────

  /** Runs one command (given as a thunk so the SDK call keeps its literal name, ADR-0127). */
  private async run(cmd: () => Promise<unknown>) {
    this.error = '';
    try {
      await cmd();
    } catch (e) {
      // A refused transition means this card was stale: say why, in the user's language, and
      // reload so the card shows the state the server actually has.
      this.error = errorText(e, 'ui.updateStatusError');
    }
    await this.load().catch(() => undefined);
  }

  private tapLine(t: Ticket, l: Line) {
    if (!can('kitchen.change_order')) return;
    if (COOKING.includes(l.status)) return this.run(() => erplora().command('kitchen.items.bump', { order_id: t.id, item_ids: [l.id] }));
    if (l.status === 'ready') return this.run(() => erplora().command('kitchen.items.recall', { order_id: t.id, item_ids: [l.id] }));
    return undefined;
  }

  /** Header tap / Bump button: every line ON SCREEN still cooking (station-scoped). */
  private bumpTicket(t: Ticket) {
    if (!can('kitchen.change_order')) return;
    const ids = this.visibleLines(t).filter((l) => COOKING.includes(l.status)).map((l) => l.id);
    if (!ids.length) return;
    return this.run(() => erplora().command('kitchen.items.bump', { order_id: t.id, item_ids: ids }));
  }

  /**
   * kitchen#57 · header tap on a MENU: every component of THAT menu on screen, and nothing else.
   * Bumping a menu is not bumping the ticket — the à-la-carte croquetas next to it stay put.
   */
  private bumpGroup(t: Ticket, g: LineGroup) {
    if (!can('kitchen.change_order')) return;
    const ids = g.lines.filter((l) => COOKING.includes(l.status)).map((l) => l.id);
    if (!ids.length) return;
    return this.run(() => erplora().command('kitchen.items.bump', { order_id: t.id, item_ids: ids }));
  }

  /** Recall button: every line ON SCREEN already ready comes back. */
  private recallTicket(t: Ticket) {
    if (!can('kitchen.change_order')) return;
    const ids = this.visibleLines(t).filter((l) => l.status === 'ready').map((l) => l.id);
    if (!ids.length) return;
    return this.run(() => erplora().command('kitchen.items.recall', { order_id: t.id, item_ids: ids }));
  }

  private serveTicket(t: Ticket) {
    if (!can('kitchen.complete_order')) return;
    return this.run(() => erplora().command('kitchen.orders.mark_served', { order_id: t.id }));
  }

  // ── render ─────────────────────────────────────────────────────────────────

  private renderLine(t: Ticket, l: Line) {
    const t_ = (k: string): string => erplora().t(CATALOG, k);
    const actionable = can('kitchen.change_order') && (COOKING.includes(l.status) || l.status === 'ready');
    const seat = l.seat !== null ? html`<span>${t_('ui.seat')} ${l.seat}</span>` : nothing;
    const station = !this.station && l.station_id ? html`<span>${this.stationName(l)}</span>` : nothing;
    const printer = l.destination === 'printer' ? html`<ion-icon name="print-outline" aria-label=${t_('ui.printerOnly')}></ion-icon>` : nothing;
    return html`<li class="line" data-item=${l.id} data-status=${l.status} role="button" tabindex=${actionable ? 0 : -1}
        aria-disabled=${actionable ? 'false' : 'true'}
        aria-label=${`${formatQty(l.quantity, erplora().locale)} × ${l.product_name} — ${l.status === 'ready' ? t_('ui.tapToRecall') : t_('ui.tapToBump')}`}
        @click=${() => this.tapLine(t, l)}
        @keydown=${(e: KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this.tapLine(t, l); } }}>
      <span class="qty">${formatQty(l.quantity, erplora().locale)}</span>
      <span class="body">
        <div class="name">${l.product_name}</div>
        ${l.modifiers ? html`<div class="mods">${l.modifiers}</div>` : nothing}
        ${l.notes ? html`<div class="note">${l.notes}</div>` : nothing}
        ${seat !== nothing || station !== nothing || printer !== nothing ? html`<div class="meta">${seat}${station}${printer}</div>` : nothing}
      </span>
      ${l.status === 'ready' ? html`<span class="tick" aria-hidden="true">✓</span>` : nothing}
    </li>`;
  }

  /**
   * A menu: its name as a quiet header, its components LISTED under it, indented behind a rule.
   *
   * The two typographic calls are ours and no product publishes them (checked across Toast,
   * Square, Lightspeed, Odoo, Revel, Clover, TouchBistro, Fresh KDS, LS Central and Simphony).
   * What the market DOES say is where the emphasis goes: Revel prints modifiers in red and Fresh
   * styles by keyword — highlighting is for allergens and changes, never for hierarchy. So the
   * header stays QUIET and the weight stays on the dish, which is what gets cooked. What the
   * forum says is what not to do, and that is the flat paragraph.
   *
   * The header is painted at EVERY station that receives a piece of the menu: `lines` is already
   * station-scoped, and a cook at the grill who cannot read «MENU» has no way to know their steak
   * is coupled to a gazpacho. It is Simphony's `11 - Send to Combo Parent Order Devices` as a
   * default instead of a switch, and Toast's headerless alternative is a mode you opt into.
   */
  private renderGroup(t: Ticket, g: LineGroup) {
    const t_ = (k: string, p?: Record<string, unknown>): string => erplora().t(CATALOG, k, p);
    if (!g.ref) return g.lines.map((l) => this.renderLine(t, l));
    const cooking = g.lines.some((l) => COOKING.includes(l.status));
    // Odoo's closing rule: «The card automatically moves to the next stage once every item is
    // crossed off». Nobody marks a menu ready by hand, and no product reviewed has an «a
    // component is missing» alert either — the expo sees the whole thing and that is the answer.
    const done = g.lines.every((l) => l.status === 'ready');
    const actionable = can('kitchen.change_order') && cooking;
    return html`<li class="combo" data-combo=${g.ref} data-combo-done=${done ? 'true' : 'false'}>
      <div class="combo-head" role=${actionable ? 'button' : 'presentation'} tabindex=${actionable ? 0 : -1}
          aria-disabled=${actionable ? 'false' : 'true'}
          title=${actionable ? t_('ui.tapMenuToBump') : ''}
          aria-label=${t_('ui.comboAria', { name: g.name, n: g.lines.length })}
          @click=${() => (actionable ? this.bumpGroup(t, g) : undefined)}
          @keydown=${(e: KeyboardEvent) => { if (actionable && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); this.bumpGroup(t, g); } }}>
        <span class="combo-name">${g.name || t_('ui.comboFallbackName')}</span>
        <span class="combo-count">${t_('ui.comboCount', { n: g.lines.length })}</span>
        ${done ? html`<span class="tick" aria-hidden="true">✓</span>` : nothing}
      </div>
      <ul class="combo-lines">${g.lines.map((l) => this.renderLine(t, l))}</ul>
    </li>`;
  }

  private renderTicket(t: Ticket) {
    const t_ = (k: string, p?: Record<string, unknown>): string => erplora().t(CATALOG, k, p);
    const lines = this.visibleLines(t);
    const cooking = lines.some((l) => COOKING.includes(l.status));
    const struck = lines.some((l) => l.status === 'ready');
    const canChange = can('kitchen.change_order');
    const canServe = can('kitchen.complete_order');
    const elapsed = this.elapsed(t);
    const sem = semaphore(elapsed, this.settings);
    const waiter = this.waiterName(t);
    const short = t.number.includes('-') ? t.number.slice(t.number.lastIndexOf('-') + 1) : t.number;
    return html`<article class="card" data-order=${t.id} data-status=${t.status} data-sem=${sem} aria-label=${t_('ui.ticketAria', { n: short })}>
      <header class="head" role="button" tabindex=${canChange && cooking ? 0 : -1} aria-disabled=${canChange && cooking ? 'false' : 'true'}
          title=${canChange && cooking ? t_('ui.tapHeaderToBump') : ''}
          @click=${() => (cooking ? this.bumpTicket(t) : undefined)}
          @keydown=${(e: KeyboardEvent) => { if (cooking && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); this.bumpTicket(t); } }}>
        <span class="title">
          <span class="label">${t.label || t_(`ui.orderType_${t.order_type}`) || t.order_type}</span>
          ${waiter ? html`<span class="waiter" data-waiter>${t_('ui.firedBy', { name: waiter })}</span>` : nothing}
        </span>
        ${t.priority !== 'normal' ? html`<span class="pill ${t.priority}">${t_(`ui.priority_${t.priority}`)}</span>` : nothing}
        ${t.round > 1 ? html`<span class="pill round">${t_('ui.round', { n: t.round })}</span>` : nothing}
        ${t.status === 'ready' ? html`<span class="pill ready">${t_('ui.statusReady')}</span>` : nothing}
        ${this.settings.show_timer ? html`<span class="timer" data-timer>${formatElapsed(elapsed)}</span>` : nothing}
        <span class="num">#${short}</span>
      </header>
      <ul class="lines">${groupCombos(lines).map((g) => this.renderGroup(t, g))}</ul>
      ${t.notes ? html`<div class="notes">${t.notes}</div>` : nothing}
      ${canChange || (canServe && t.status === 'ready')
        ? html`<footer class="foot">
            ${canChange && cooking ? html`<ion-button data-action="bump" @click=${() => this.bumpTicket(t)}>${t_('ui.bump')}</ion-button>` : nothing}
            ${canChange && struck ? html`<ion-button data-action="recall" fill="outline" @click=${() => this.recallTicket(t)}>${t_('ui.recall')}</ion-button>` : nothing}
            ${canServe && t.status === 'ready' ? html`<ion-button data-action="served" fill="outline" @click=${() => this.serveTicket(t)}>${t_('ui.rowMarkServed')}</ion-button>` : nothing}
          </footer>`
        : nothing}
    </article>`;
  }

  private renderTickets() {
    const t_ = (k: string): string => erplora().t(CATALOG, k);
    const visible = this.tickets.filter((t) => this.visibleLines(t).length > 0 || (!this.station && t.lines.length === 0));
    const cooking = visible.filter((t) => t.status !== 'ready');
    const ready = visible.filter((t) => t.status === 'ready');
    if (!visible.length) {
      return html`<ok-empty-state icon="restaurant-outline" .title=${t_('ui.emptyDisplay')}></ok-empty-state>`;
    }
    return html`
      <div class="grid">${cooking.map((t) => this.renderTicket(t))}</div>
      ${ready.length
        ? html`<h3 class="section-title">${t_('ui.readyRail')} (${ready.length})</h3>
               <div class="grid">${ready.map((t) => this.renderTicket(t))}</div>`
        : nothing}`;
  }

  /** An All-Day row's station name, in the hub's language: rows group by the FROZEN name, so this
   *  reverses it through the stations list (a row frozen as `Bar` or as `Barra` both render
   *  «Barra»). Unknown names (station deleted, list not loaded) stay as they were frozen. */
  private allDayStation(name: string | null): string {
    const frozen = String(name ?? '');
    if (!frozen) return frozen;
    for (const s of this.stationsById.values()) {
      if (frozen === s.name_es || frozen === s.name) return String(s.name_es || s.name);
    }
    return frozen;
  }

  private renderAllDay() {
    const t_ = (k: string): string => erplora().t(CATALOG, k);
    // The filter carries a station ID (kitchen#45); rows carry frozen names. A row belongs to the
    // selection when its frozen name is the station's localized OR seed name — the feed mixes
    // comandas sent before and after the locale was set.
    let rows = this.allDay;
    if (this.station) {
      const selected = this.station === NO_STATION ? null : this.stationsById.get(this.station);
      const names = selected ? new Set([String(selected.name_es || ''), String(selected.name || '')]) : new Set(['']);
      rows = this.allDay.filter((r) => names.has(String(r.station_name ?? '')));
    }
    if (!rows.length) return html`<ok-empty-state icon="restaurant-outline" .title=${t_('ui.emptyAllDay')}></ok-empty-state>`;
    // Same product on two stations (expo view) → two rows, each with its station: the fryer and
    // the grill do not share a batch.
    return html`<table class="allday">
      <thead><tr><th>${t_('ui.colProduct')}</th><th></th><th></th></tr></thead>
      <tbody>${rows.map(
        (r) => html`<tr data-allday=${r.product_name}>
          <td>${r.product_name}</td>
          <td class="s">${!this.station && r.station_name ? this.allDayStation(r.station_name) : ''}</td>
          <td class="q">${formatQty(Number(r.quantity) || 0, erplora().locale)}</td>
        </tr>`,
      )}</tbody>
    </table>`;
  }

  render() {
    const t_ = (k: string): string => erplora().t(CATALOG, k);
    const stations = this.stations;
    return html`<div>
      <div class="bar">
        <h2>${t_('ui.displayTitle')}</h2>
        <span class="grow"></span>
        <ion-segment .value=${this.mode} @ionChange=${(e: CustomEvent<{ value: string }>) => (this.mode = (e.detail.value as 'tickets' | 'allday') || 'tickets')}>
          <ion-segment-button value="tickets"><ion-label>${t_('ui.modeTickets')}</ion-label></ion-segment-button>
          <ion-segment-button value="allday"><ion-label>${t_('ui.modeAllDay')}</ion-label></ion-segment-button>
        </ion-segment>
      </div>
      ${stations.length > 1 || this.station
        ? html`<div class="bar">
            <ion-segment scrollable .value=${this.station || '__all'} @ionChange=${(e: CustomEvent<{ value: string }>) => (this.station = e.detail.value === '__all' ? '' : String(e.detail.value ?? ''))}>
              <ion-segment-button value="__all"><ion-label>${t_('ui.stationAll')}</ion-label></ion-segment-button>
              ${stations.map((s) => html`<ion-segment-button value=${s.id || NO_STATION}><ion-label>${s.id ? s.label : t_('ui.stationNone')}</ion-label></ion-segment-button>`)}
            </ion-segment>
          </div>`
        : nothing}
      ${this.error ? html`<ok-inline-feedback tone="danger" icon="alert-circle-outline">${this.error}</ok-inline-feedback>` : nothing}
      ${this.mode === 'allday' ? this.renderAllDay() : this.renderTickets()}
    </div>`;
  }
}

define('erp-kitchen-display', ErpKitchenDisplay);
