import { LitElement, html, css, nothing } from 'lit';
import { property, state } from 'lit/decorators.js';
import { define } from '@erplora/outfitkit/define';
import '@erplora/outfitkit/ok-inline-feedback';
import '@erplora/outfitkit/ok-empty-state';
// kitchen#48 · «Sonido» is a switch that MOVES something: the pass hears the ticket land.
import { Chime, CHIME_TONES, DEFAULT_TONE, DEFAULT_VOLUME, type ChimeTone } from '../../lib/chime';
import { printPass, printRushNotice } from '../../lib/pass-print';
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
//   · a round already on the line can be marked RUSH from its card (kitchen#76, Toast «Rush»,
//     Fresh KDS «Prioritize»): it jumps to the FRONT of the board and every station hears it; the
//     paper already on the pass is NOT reprinted;
//   · live refresh on `kitchen.order.*` / `kitchen.item.*` events (no polling), 44 px targets.
// Elapsed time and the semaphore are derived HERE, against `kitchen_settings`: presentation, and
// the clock must not depend on the latency of the query.
//
// It is a BOARD, and it uses the whole screen (kitchen#60, 2026-09-02). Three things changed and
// all three are what the six KDS reviewed already do:
//   · ONE command bar of ~50 px — the three views with their counts, the full-screen button and
//     the station chips on one sticky row — instead of a title plus two full-width segments, which
//     measured 162 px of chrome before the first ticket at 1440;
//   · READY leaves the active board for its own view: it used to be a second grid painted under
//     the first, so a finished ticket fell BELOW the one still cooking instead of beside it;
//   · full screen through `navigation[].chrome` (ADR-0048): the shell hides its own sidebar,
//     topbar and tabbar; this screen only asks. A KDS is a tablet on a wall, read from a metre
//     away, so the columns are sized against the viewport and the type is sized for that metre.

interface ErploraClientLike {
  query<T = unknown>(name: string, params?: Record<string, unknown>): Promise<T>;
  /** Optional reads (ADR-0127): `undefined` when the owning app is not installed. Absent on old
   *  shells — `queryAllOptional` is the whole set, `queryOptional` one capped page. */
  queryAllOptional?<T = unknown>(name: string, params?: Record<string, unknown>): Promise<T | undefined>;
  queryOptional?<T = unknown>(name: string, params?: Record<string, unknown>): Promise<T | undefined>;
  command<T = unknown>(name: string, payload?: Record<string, unknown>): Promise<T>;
  on(event: string, cb: (payload: unknown) => void): () => void;
  /** The hub's print door (kitchen#70), bolted on by the shell. Absent in the module preview and
   *  on a shell older than the door: then the pass simply does not print, and nothing breaks. */
  print?(req: Record<string, unknown>): Promise<{ via?: string; error?: string } | undefined | void>;
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

/** One row of `staff.members.list` — the business's TEAM (kitchen#82). Since sales#318 the till
 *  can say a round is served by a team record that has no hub user, and then `waiter_id` is that
 *  record's id: only the staff app can name it. */
interface TeamMember {
  id: string;
  full_name?: string;
  first_name?: string;
  last_name?: string;
}

function teamMemberName(m: TeamMember): string {
  return String(m.full_name || `${m.first_name ?? ''} ${m.last_name ?? ''}`).trim();
}

/** Page cap for the `queryOptional` fallback: `staff.members.list` has a `list` block, so that door
 *  answers ONE page of the manifest's 50 rows unless told otherwise (sales#186). Same figure as the
 *  till's picker (sales#318), so both surfaces name the same people. */
const LEGACY_PAGE_LIMIT = 500;

/** The team, OPTIONALLY (ADR-0127, no `depends_on`): `[]` without the staff app, without
 *  permission to read it, or on a shell with no optional door — the header then says what it said
 *  before kitchen#82. The query name stays literal in each call so the contract extractor sees it.
 *  Terminated and inactive records are NOT filtered: who fired a round is a historical fact.
 *  `queryAllOptional` answers the bare rows; `queryOptional` the page envelope `{rows,total,…}`
 *  of a list query — both shapes are accepted, anything else is «nothing to name». */
async function readTeam(c: ErploraClientLike): Promise<TeamMember[]> {
  try {
    const out =
      typeof c.queryAllOptional === 'function'
        ? await c.queryAllOptional<TeamMember[]>('staff.members.list')
        : typeof c.queryOptional === 'function'
          ? await c.queryOptional<TeamMember[] | { rows?: TeamMember[] }>('staff.members.list', { limit: LEGACY_PAGE_LIMIT })
          : undefined;
    if (Array.isArray(out)) return out;
    const rows = (out as { rows?: unknown } | undefined)?.rows;
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
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
  /** kitchen#48 — ring when a ticket lands. ONE switch, the way all seven KDS that ring do it. */
  sound_enabled: boolean;
  /** kitchen#72 — 0–100. The forums' complaint is that the ding does not carry over an extractor. */
  sound_volume: number;
  /** kitchen#72 — which of the synthesised tones rings (`chime` | `bell` | `buzzer`). */
  sound_tone: ChimeTone;
  /** kitchen#70 — print the PASS on the station's printer every time a ticket is bumped. */
  auto_print_tickets: boolean;
}

const DEFAULT_SETTINGS: DisplaySettings = {
  show_timer: true,
  color_coding_enabled: true,
  warning_time_minutes: 15,
  critical_time_minutes: 30,
  sound_enabled: true,
  sound_volume: DEFAULT_VOLUME,
  sound_tone: DEFAULT_TONE,
  // Off, like Toast, Fresh KDS and MobiPOS ship it: paper nobody asked for is a regression.
  auto_print_tickets: false,
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

/** `sound_volume` as the chime takes it (kitchen#72). Zero stays zero — a kitchen may choose
 *  silence — and only a value that is not a number at all falls back to the default. */
function volumeOf(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : DEFAULT_VOLUME;
}

/** `sound_tone` as the chime takes it. A name this build does not know rings the default: a hub
 *  upgrades on its own schedule and the list can grow, and a mute pass is the worse failure. */
function toneOf(v: unknown): ChimeTone {
  const name = String(v ?? '');
  return (CHIME_TONES as string[]).includes(name) ? (name as ChimeTone) : DEFAULT_TONE;
}

/** The order a `kitchen.order.*` event is talking about, whatever shape the payload arrives in. */
function orderIdOf(payload: unknown): string {
  if (payload && typeof payload === 'object') {
    const p = payload as Record<string, unknown>;
    const id = p.order_id ?? p.id;
    return id == null ? '' : String(id);
  }
  return '';
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

/** kitchen#76 · rush tickets FIRST, the rest kept oldest-first behind them — the way Toast «Rush»
 *  and Fresh KDS «Prioritize» jump a round to the front of the board without reshuffling anything
 *  else. `filter` keeps the relative order inside each group, so two rush tickets still read in
 *  the order they were fired. */
export function rushFirst(tickets: Ticket[]): Ticket[] {
  const rush = tickets.filter((t) => t.priority === 'rush');
  // kitchen#96 · `vip` is the kitchen's other priority word (it arrives with `order.fired`): it
  // reads right behind rush, ahead of the normal rounds.
  const vip = tickets.filter((t) => t.priority === 'vip');
  const rest = tickets.filter((t) => t.priority !== 'rush' && t.priority !== 'vip');
  return [...rush, ...vip, ...rest];
}

/** kitchen#96 · the rush toggle only moves a round between `normal` and `rush`. */
function rushToggleable(t: Ticket): boolean {
  return t.priority === 'normal' || t.priority === 'rush';
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
    /* kitchen#60 · ONE command bar. It used to be two rows —an h2 plus a full-width mode segment,
       then a full-width station segment— which is ~190 px of chrome before the first ticket; a KDS
       header is ~48 px (Toast, Square, Fresh, Simphony). Sticky because a busy board scrolls, and
       scrolling the station filter off the top strands whoever is at the pass. */
    .bar { display:flex; gap:.5rem; align-items:center; flex-wrap:wrap; padding:0 0 .4rem;
           position:sticky; top:0; z-index:2; background: var(--ion-background-color, #fff); }
    ion-segment { min-height:44px; }
    /* Ionic gives the ion-segment host a width of 100%, so on its own each segment IS a full-width
       row. A rule from the OUTER tree —this one— beats the component's own :host, which is what
       lets the two controls share one line: views keeps its width, stations takes what is left. */
    ion-segment.views { width:auto; flex:0 0 auto; }
    /* Shrinks when the row is tight and SCROLLS after that, but never stretches: a four-station
       kitchen whose chips were spread across 1180 px reads as four buttons, not as a filter. */
    ion-segment.stations { width:auto; flex:0 1 auto; min-width:0; max-width:100%; }
    ion-segment-button { min-height:44px; --padding-start:.6rem; --padding-end:.6rem; text-transform:none; }
    .count { font-variant-numeric: tabular-nums; opacity:.7; margin-left:.35rem; }
    /* Full screen: a plain button, not a ⋮ menu — this screen has exactly one chrome control and
       the market answer to «two ways to do the same thing» is one way (ADR-0048 owns the rest).
       It sits NEXT TO the view tabs, not pinned to the right edge: an auto left margin gave it a
       third row of its own the moment the bar wrapped on a phone, and both controls are about the
       SCREEN anyway, while the stations chips are about the food. */
    .fs { min-width:44px; min-height:44px; display:inline-flex; align-items:center; justify-content:center;
          border:1px solid var(--ion-border-color, #e7e2d6); border-radius: var(--ok-radius-sm, 10px);
          background:transparent; color:inherit; font-size:1.25rem; cursor:pointer; }
    ion-button { min-height:44px; --padding-start:1rem; --padding-end:1rem; margin:0; }
    /* kitchen#60 · the column grows with the screen instead of sitting at a fixed 17 rem: on a
       1440 board that gave five narrow cards and ~70 % white. Equal tracks that do NOT resize with
       the number of tickets — Toast and Fresh both fix the columns on purpose, because a card that
       changes size every time an order lands is a card the cook has to find again. */
    .grid { display:grid; grid-template-columns: repeat(auto-fill, minmax(clamp(15rem, 22vw, 22rem), 1fr)); gap:.6rem; align-items:start; }
    .card { border:1px solid var(--ion-border-color, #e7e2d6); border-top-width:6px; border-radius: var(--ok-radius-sm, 10px);
            background: var(--ion-item-background, var(--ion-background-color, #fff)); display:flex; flex-direction:column; overflow:hidden; }
    .card[data-sem="ok"] { border-top-color: var(--ion-color-success, #2dd36f); }
    .card[data-sem="warning"] { border-top-color: var(--ion-color-warning, #ffc409); }
    .card[data-sem="critical"] { border-top-color: var(--ion-color-danger, #eb445a); }
    .card[data-sem="critical"] .timer { color: var(--ion-color-danger, #eb445a); }
    .card[data-sem="warning"] .timer { color: var(--ion-color-warning-shade, #e0ac08); }
    .card[data-sem="off"] { border-top-color: var(--ion-border-color, #e7e2d6); }
    .card[data-status="ready"] { opacity:.85; }
    /* kitchen#60 · the header WRAPS instead of squeezing. With the type at kitchen size, a narrow
       column had «Mesa 7» and «Camarero: Luis» both collapse to «M…» / «Ca…» once a RUSH pill and
       the clock claimed the row — which is the one thing kitchen#67 exists to show. The table and
       who fired it keep the first line; the pills, the clock and the number drop to a second one. */
    .head { display:flex; align-items:center; flex-wrap:wrap; gap:.35rem .5rem; padding:.6rem .75rem; min-height:44px; cursor:pointer; user-select:none;
            background: var(--ok-surface-2, var(--ion-color-step-50, rgba(var(--ion-text-color-rgb, 24, 24, 27), 0.04))); }
    .head[aria-disabled="true"] { cursor:default; }
    /* The table and, under it, who fired the round (kitchen#63) — the header layout Toast, Square
       for Restaurants and Lightspeed use. A column so the waiter never competes with the pills for
       the row: on a 17rem card the label would be the first thing squeezed. */
    .head .title { flex:1 1 60%; min-width:0; display:flex; flex-direction:column; gap:.05rem; }
    /* kitchen#60 · type for a kitchen: this is read from a metre away, standing, in a hurry. The
       market sizes the dish and the quantity XL (Fresh, Square, Simphony) and leaves the rest
       quiet — so the dish and the count grow, the pills and the ticket number do not. */
    .head .label { font-weight:700; font-size:1.3rem; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .head .waiter { font-size:.95rem; font-weight:500; opacity:.72; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .head .num { font-variant-numeric: tabular-nums; font-size:.9rem; opacity:.75; }
    .timer { font-variant-numeric: tabular-nums; font-weight:700; font-size:1.25rem; }
    .pill { display:inline-block; padding:.1rem .5rem; border-radius: var(--ok-radius-pill, 999px); font-size:.75rem; font-weight:700; text-transform:uppercase; }
    .pill.rush { background: var(--ion-color-danger, #eb445a); color:#fff; }
    .pill.vip { background: var(--ion-color-tertiary, #6030ff); color:#fff; }
    .pill.round { background: var(--ok-surface-2, rgba(0,0,0,.06)); }
    .pill.ready { background: var(--ion-color-success, #2dd36f); color:#fff; }
    .lines { list-style:none; margin:0; padding:0; }
    .line { display:flex; gap:.6rem; align-items:flex-start; padding:.55rem .75rem; min-height:44px; border-top:1px solid var(--ion-border-color, #e7e2d6);
            cursor:pointer; user-select:none; -webkit-tap-highlight-color: transparent; }
    .line[aria-disabled="true"] { cursor:default; }
    .line:active { background: var(--ok-surface-2, rgba(0,0,0,.05)); }
    .line .qty { font-weight:800; font-size:1.6rem; min-width:2ch; text-align:right; font-variant-numeric: tabular-nums; }
    .line .body { flex:1; min-width:0; }
    .line .name { font-weight:600; font-size:1.4rem; }
    .line .mods, .line .note { font-size:1.05rem; opacity:.85; }
    .line .note { font-style:italic; }
    .line .meta { font-size:1rem; opacity:.7; display:flex; gap:.5rem; }
    .line[data-status="ready"] .name, .line[data-status="ready"] .qty { text-decoration: line-through; opacity:.55; }
    .line .tick { font-size:1.4rem; line-height:1; color: var(--ion-color-success, #2dd36f); }
    /* kitchen#57 · A MENU: a quiet header and its components indented behind a rule. The emphasis
       stays on the DISH — the market highlights allergens and changes, never hierarchy — so the
       header is smaller and dimmer than the lines it introduces, not louder. */
    .combo { display:block; border-top:1px solid var(--ion-border-color, #e7e2d6); }
    .combo-head { display:flex; align-items:center; gap:.4rem; min-height:44px; padding:.35rem .75rem;
      font-size:.95rem; text-transform:uppercase; letter-spacing:.04em; opacity:.75;
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
    /* kitchen#156 · the footer WRAPS. A half-marked ticket carries three buttons (Ready, Mark rush,
       Recall) and on a portrait tablet's ~254 px column one row could not hold them: «Recall» ran
       past the card's overflow:hidden edge as «Recupe…». A button that does not fit drops to the
       next row and fills it (Toast, Square, Fresh keep every action on the card the same way). */
    .foot { display:flex; flex-wrap:wrap; gap:.5rem; padding:.5rem .75rem; border-top:1px solid var(--ion-border-color, #e7e2d6); }
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
    .allday td.s { opacity:.7; font-size:.95rem; }
    @media (max-width: 480px) { .grid { grid-template-columns: 1fr; } }
  `;

  /** Station filter: '' = expo/pass (every station); `NO_STATION` = lines without station. Set from
   *  the segment; a public property so a fixed screen (the bar's tablet) can be pinned by attribute.
   *  Carries a station ID (kitchen#45): an id survives renames and locale switches, a name does
   *  not — a pinned Spanish name would stop matching the moment the hub changed language. */
  @property({ type: String, reflect: true }) station = '';

  /**
   * Which view the board shows: 'tickets' (what is cooking — the pass), 'ready' (what is done and
   * waiting to be picked up) or 'allday' (what is left to cook, summed per product).
   *
   * kitchen#60 · 'ready' used to be a SECOND grid under an «LISTAS» heading in the same view, so a
   * finished ticket dropped BELOW the one still cooking instead of leaving the line. No KDS does
   * that: Square and Loyverse move it to its own tab, Toast and Fresh to a recall bar. Same idea
   * here, and it stays a public property so a fixed screen can be pinned by attribute.
   */
  @property({ type: String, reflect: true }) mode: 'tickets' | 'ready' | 'allday' = 'tickets';

  /**
   * Chrome controls the SHELL honours on this tab, space separated (ADR-0048, Nivel 1). The shell
   * writes it from `navigation[].chrome`; the KDS only OFFERS what is announced.
   *
   * A kitchen wall display is the screen that least wants the Hub's sidebar, topbar and module
   * tabbar around it. But hiding them is the shell's job, not ours (ADR-0022): without the
   * announcement the button is not painted, because a `kitchen` that auto-updated onto an older
   * hub image would otherwise show a control nobody is listening to.
   *
   * On a tab that announces nothing the shell REMOVES the attribute, and Lit hands that over as
   * `null`, not `''` (kitchen#164): read it through `chromeControls`, never as a bare string.
   */
  @property() chrome: string | null = '';

  /** Whether the shell is in that mode right now. It also changes by Esc and F11, which this
   *  component never sees — so it is read from the shell, never deduced from our own clicks. */
  @property({ type: Boolean }) fullscreen = false;

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

  /** kitchen#70 · the pass did not come out of a printer. It stays until a later pass does: a
   *  warning that clears itself on the next reload — and this board reloads on every event — is a
   *  warning nobody in a service ever reads. */
  @state() private passWarning = '';

  /** kitchen#93 · the rush notice did not come out of a printer. Same lifetime as `passWarning`:
   *  it stays until a later notice does. */
  @state() private rushNoticeWarning = '';

  @state() private loading = false;

  @state() private now = Date.now();

  private unsub?: () => void;

  private clock?: ReturnType<typeof setInterval>;

  /** kitchen#48 · the chime, one audio context for the whole shift. */
  private readonly chime = new Chime();

  /** The tickets the board was showing on the previous feed. `undefined` until the FIRST feed
   *  lands: that one teaches the board what is already on the line and never rings. */
  private knownTickets?: Set<string>;

  /** kitchen#76 · the tickets that were already RUSH on the previous feed, so a board can tell a
   *  round that just turned rush from one that already was. Kept in step with `knownTickets`:
   *  both are learnt on the same first feed and updated together on every reload after it. */
  private knownRush?: Set<string>;

  private readonly onLocaleChange = (): void => this.requestUpdate();

  async connectedCallback() {
    super.connectedCallback();
    window.addEventListener('erplora:locale-changed', this.onLocaleChange);
    // kitchen#127 · everything `disconnectedCallback` stops is started HERE, before the first
    // await: a board taken off the screen while its first feed is loading must find its clock and
    // its subscriptions already there to stop. Started after the await, they ran on a board nobody
    // sees for the rest of the shift (and a board moved while loading ended up with two of each).
    // Live refresh on every event that changes what the line looks like (no polling). Literal
    // names on purpose: the contract checker reads them (ADR-0127).
    try {
      const reload = () => this.load();
      const offs = [
        erplora().on('kitchen.order.created', reload),
        erplora().on('kitchen.order.updated', reload),
        erplora().on('kitchen.order.fired', reload),
        // kitchen#70 · the bump is where the pass goes to paper (Toast, Fresh KDS, Lightspeed K,
        // MobiPOS and Square all print here). The board reloads either way: a printer out of paper
        // must never keep the screen from updating.
        erplora().on('kitchen.order.ready', (payload) => {
          void this.printPassFor(payload);
          reload();
        }),
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
    // The clock: elapsed time and the semaphore are derived here, every second, for as long as the board is on screen.
    this.clock = setInterval(() => (this.now = Date.now()), 1000);
    await Promise.all([this.loadSettings(), this.load()]);
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
        sound_enabled: row.sound_enabled === undefined || row.sound_enabled === null ? DEFAULT_SETTINGS.sound_enabled : truthy(row.sound_enabled),
        // kitchen#70 · the pass on paper. A hub on an older row (the column existed long before it
        // was read) falls back to OFF, never to «print», so an upgrade never starts spitting paper.
        auto_print_tickets:
          row.auto_print_tickets === undefined || row.auto_print_tickets === null
            ? DEFAULT_SETTINGS.auto_print_tickets
            : truthy(row.auto_print_tickets),
        warning_time_minutes: Number(row.warning_time_minutes ?? DEFAULT_SETTINGS.warning_time_minutes) || DEFAULT_SETTINGS.warning_time_minutes,
        critical_time_minutes: Number(row.critical_time_minutes ?? DEFAULT_SETTINGS.critical_time_minutes) || DEFAULT_SETTINGS.critical_time_minutes,
        // kitchen#72 · zero is a legitimate volume, so `|| default` would silently un-mute a
        // kitchen that chose silence: only a value that is not a number falls back.
        sound_volume: volumeOf(row.sound_volume),
        sound_tone: toneOf(row.sound_tone),
      };
    } catch {
      /* no settings row (or no permission): defaults */
    }
  }

  private async load() {
    this.loading = true;
    try {
      const [rows, allDay, stations, waiters, team] = await Promise.all([
        erplora().query<DisplayRow[]>('kitchen.orders.display'),
        erplora().query<AllDayRow[]>('kitchen.orders.all_day'),
        // kitchen#45: names in the hub's language. Optional: without it (no permission, no SDK)
        // the frozen snapshot names still paint — degraded, never broken.
        erplora().query<StationRow[]>('kitchen.stations.list').catch(() => [] as StationRow[]),
        // kitchen#63: the people behind `waiter_id`. Same door `sales` uses (`hub.users.list`,
        // ADR-0192) and the same policy on failure: the pass keeps working and the header says
        // nothing, because a UUID on the card would be worse than a blank.
        erplora().query<HubUser[]>('hub.users.list').catch(() => [] as HubUser[]),
        // kitchen#82: and the team records that never sign in — same policy, a blank on failure.
        readTeam(erplora()),
      ]);
      this.rows = Array.isArray(rows) ? rows : [];
      this.ringForNews();
      this.allDay = Array.isArray(allDay) ? allDay : [];
      this.stationsById = new Map((Array.isArray(stations) ? stations : []).map((s) => [String(s.id), s]));
      this.waitersById = new Map([
        ...team
          .filter((m) => m && m.id && teamMemberName(m))
          .map((m): [string, string] => [String(m.id), teamMemberName(m)]),
        ...(Array.isArray(waiters) ? waiters : [])
          .filter((u) => u && u.id && String(u.name ?? '').trim())
          .map((u): [string, string] => [String(u.id), String(u.name).trim()]),
      ]);
    } catch (e) {
      this.error = errorText(e, 'ui.loadError');
    } finally {
      this.loading = false;
    }
  }

  /**
   * Rings once when the feed brings NEWS the kitchen has not heard yet: a ticket this board had
   * not seen (kitchen#48), or one already on the line that just turned rush (kitchen#76).
   *
   * ARRIVAL and ESCALATION, not presence: the board reloads on every bump, recall and status
   * change, so «there are tickets» is not news — «there is a ticket that was not here a moment
   * ago» or «this one just got pushed to the front» is. And the FIRST feed never rings: a KDS
   * opened halfway through a service would otherwise greet whoever turns it on with an alarm for
   * orders already being cooked, rush ones included.
   *
   * One chime per reload, however many things landed together: a ticket arriving already rush, or
   * an arrival AND an escalation in the same feed, is still one chime — a delivery burst that
   * beeps six times is the noise the Square forum complains about, not an alert. Clearing rush is
   * never news: a kitchen expects silence, not a chime, when the pressure comes OFF a ticket.
   */
  private ringForNews() {
    const onScreen = new Set(this.rows.map((r) => String(r.order_id ?? '')));
    const rushNow = new Set(this.rows.filter((r) => String(r.priority ?? '') === 'rush').map((r) => String(r.order_id ?? '')));
    const knownTickets = this.knownTickets;
    const knownRush = this.knownRush;
    this.knownTickets = onScreen;
    this.knownRush = rushNow;
    if (!knownTickets || !knownRush) return; // first feed: the board is being learnt, nothing is "news" yet
    // kitchen#93 · a ticket the board already had that just turned rush needs paper: its comanda
    // went out before the round was pushed to the front. One that ARRIVES already rush is left
    // out on purpose — its own comanda already printed «!! URGENTE !!» (hub#1411). Not gated by
    // the chime switch: a muted kitchen still has to get the sheet.
    const escalatedIds = [...rushNow].filter((id) => knownTickets.has(id) && !knownRush.has(id));
    for (const id of escalatedIds) void this.printRushNoticeFor(id);
    if (!this.settings.sound_enabled) return;
    const arrived = [...onScreen].some((id) => !knownTickets.has(id));
    const escalated = [...rushNow].some((id) => !knownRush.has(id));
    if (arrived || escalated) {
      // kitchen#72 · how loud and which notes are the hub's to choose; the defaults are exactly
      // the chime this module rang before the controls existed.
      this.chime.play({ volume: this.settings.sound_volume, tone: this.settings.sound_tone });
    }
  }

  /**
   * Puts the PASS of a bumped ticket on paper (kitchen#70) — the sheet that leaves with the food.
   *
   * Driven by `kitchen.order.ready`, not by the tap: a ticket goes ready when the LAST line still
   * cooking is bumped, and that bump may happen on another station's screen, or from the ERP list.
   * The `jobId` carries the (order, role) pair, so every mounted board asking for the same pass is
   * one sheet in the queue, not one per screen.
   *
   * Never awaited by the event handler and never able to throw: the board reloads regardless.
   */
  private async printPassFor(payload: unknown) {
    if (!this.settings.auto_print_tickets) return;
    const orderId = orderIdOf(payload);
    if (!orderId) return;
    const outcome = await printPass(orderId, erplora(), {
      // The board already resolved the hub's people for the card (kitchen#63) — asking again for
      // every pass would be a query per bump for a name we are holding.
      resolveWaiter: (id) => this.waitersById.get(id) ?? '',
    });
    if (outcome.ok) {
      this.passWarning = '';
      return;
    }
    if (outcome.reason === 'no_gate') {
      // No print door at all (module preview, or a shell older than it). Not the kitchen's problem
      // and not worth a banner on the pass, but it must leave a trace.
      console.warn('[kitchen] this shell exposes no print door: the pass cannot be printed');
      return;
    }
    this.passWarning = erplora().t(CATALOG, 'ui.passPrintFailed');
  }

  /**
   * Puts the RUSH NOTICE of an escalated ticket on paper (kitchen#93) — a short chit for a round
   * pushed to the front after it already fired.
   *
   * Driven by `ringForNews`, never by the tap: never awaited by its caller and never able to
   * throw — the board already has the rush in the database, paper is only the copy of it.
   */
  private async printRushNoticeFor(orderId: string) {
    const outcome = await printRushNotice(orderId, erplora(), {
      resolveWaiter: (id) => this.waitersById.get(id) ?? '',
    });
    if (outcome.ok) {
      this.rushNoticeWarning = '';
      return;
    }
    if (outcome.reason === 'no_gate') {
      console.warn('[kitchen] this shell exposes no print door: the rush notice cannot be printed');
      return;
    }
    this.rushNoticeWarning = erplora().t(CATALOG, 'ui.rushNoticeFailed');
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

  /** The tickets this screen shows at all: the station's, or every one in the expo view. */
  private get visibleTickets(): Ticket[] {
    return this.tickets.filter((t) => this.visibleLines(t).length > 0 || (!this.station && t.lines.length === 0));
  }

  /** The active board: what the kitchen still has to cook, rush tickets FIRST (kitchen#76). */
  private get cookingTickets(): Ticket[] {
    return rushFirst(this.visibleTickets.filter((t) => t.status !== 'ready'));
  }

  /** Done and waiting to be picked up. Out of the active board, one tap away (kitchen#60). The
   *  divider is the SERVER's ticket status, which is what closes the ticket when its last line is
   *  bumped — the screen does not get to decide when a ticket is finished. */
  private get readyTickets(): Ticket[] {
    return this.visibleTickets.filter((t) => t.status === 'ready');
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

  /**
   * kitchen#76 · marks (or unmarks) a round rush from its card, once it is already on the line —
   * before this, the only moment a round could be urgent was when it was fired (hub#1411). Same
   * button undoes it: no confirm dialog, the way every other action on this screen works. Only
   * between `normal` and `rush` (the card offers no toggle on a `vip` round): undoing it there would
   * land on `normal` and erase the VIP mark for good (kitchen#96).
   */
  private toggleRush(t: Ticket) {
    if (!can('kitchen.change_order')) return;
    const next = t.priority === 'normal' ? 'rush' : 'normal';
    return this.run(() => erplora().command('kitchen.orders.update', { order_id: t.id, priority: next }));
  }

  // ── render ─────────────────────────────────────────────────────────────────

  private renderLine(t: Ticket, l: Line) {
    const t_ = (k: string): string => erplora().t(CATALOG, k);
    const actionable = can('kitchen.change_order') && (COOKING.includes(l.status) || l.status === 'ready');
    const seat = l.seat !== null ? html`<span>${t_('ui.seat')} ${l.seat}</span>` : nothing;
    const station = !this.station && l.station_id ? html`<span>${this.stationName(l)}</span>` : nothing;
    const printer = l.destination === 'printer' ? html`<ion-icon name="print-outline" aria-label=${t_('ui.printerOnly')}></ion-icon>` : nothing;
    return html`<li class="line" data-testid=${`kds-line-${l.id}`} data-item=${l.id} data-status=${l.status} role="button" tabindex=${actionable ? 0 : -1}
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
      <div class="combo-head" data-testid=${`kds-ticket-${t.id}-combo-${g.ref}`} role=${actionable ? 'button' : 'presentation'} tabindex=${actionable ? 0 : -1}
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
    return html`<article class="card" data-testid=${`kds-ticket-${t.id}`} data-order=${t.id} data-status=${t.status} data-sem=${sem} aria-label=${t_('ui.ticketAria', { n: short })}>
      <header class="head" data-testid=${`kds-ticket-${t.id}-head`} role="button" tabindex=${canChange && cooking ? 0 : -1} aria-disabled=${canChange && cooking ? 'false' : 'true'}
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
            ${canChange && cooking ? html`<ion-button data-testid=${`kds-ticket-${t.id}-bump`} data-action="bump" @click=${() => this.bumpTicket(t)}>${t_('ui.bump')}</ion-button>` : nothing}
            ${canChange && cooking && rushToggleable(t)
              ? html`<ion-button data-testid=${`kds-ticket-${t.id}-rush`} data-action="rush" fill="outline" @click=${() => this.toggleRush(t)}>${t.priority === 'rush' ? t_('ui.clearRush') : t_('ui.markRush')}</ion-button>`
              : nothing}
            ${canChange && struck ? html`<ion-button data-testid=${`kds-ticket-${t.id}-recall`} data-action="recall" fill="outline" @click=${() => this.recallTicket(t)}>${t_('ui.recall')}</ion-button>` : nothing}
            ${canServe && t.status === 'ready' ? html`<ion-button data-testid=${`kds-ticket-${t.id}-served`} data-action="served" fill="outline" @click=${() => this.serveTicket(t)}>${t_('ui.rowMarkServed')}</ion-button>` : nothing}
          </footer>`
        : nothing}
    </article>`;
  }

  /** ONE grid of equal columns, or the empty state. Never two grids stacked down the page. */
  private renderBoard(tickets: Ticket[], emptyKey: string) {
    const t_ = (k: string): string => erplora().t(CATALOG, k);
    if (!tickets.length) return html`<ok-empty-state data-testid="kds-empty" icon="restaurant-outline" .message=${t_(emptyKey)}></ok-empty-state>`;
    return html`<div class="grid">${tickets.map((t) => this.renderTicket(t))}</div>`;
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
    if (!rows.length) return html`<ok-empty-state data-testid="kds-empty" icon="restaurant-outline" .message=${t_('ui.emptyAllDay')}></ok-empty-state>`;
    // Same product on two stations (expo view) → two rows, each with its station: the fryer and
    // the grill do not share a batch.
    return html`<table class="allday" data-testid="kds-allday">
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

  /** Chrome controls the shell says it honours here (`chrome="fullscreen …"`). */
  private get chromeControls(): string[] {
    return (this.chrome ?? '').split(/\s+/).filter(Boolean);
  }

  /**
   * Asks the SHELL for a chrome control (ADR-0048: the module is content, the chrome is the
   * shell's). `composed` to leave the shadow root and `bubbles` to reach the module host — without
   * both the request dies inside the component. Nothing is toggled here: whoever does not listen
   * does not answer, which is why the button is not painted unless the capability was announced.
   */
  private requestChrome(control: string): void {
    this.dispatchEvent(new CustomEvent('erp:chrome-request', {
      detail: { control, action: 'toggle' },
      bubbles: true,
      composed: true,
    }));
  }

  private renderFullscreen() {
    const t_ = (k: string): string => erplora().t(CATALOG, k);
    if (!this.chromeControls.includes('fullscreen')) return nothing;
    const label = t_(this.fullscreen ? 'ui.exitFullscreen' : 'ui.fullscreen');
    return html`<button type="button" class="fs" data-testid="kds-fullscreen" data-action="fullscreen" title=${label} aria-label=${label}
        @click=${() => this.requestChrome('fullscreen')}>
      <ion-icon name=${this.fullscreen ? 'contract-outline' : 'expand-outline'} aria-hidden="true"></ion-icon>
    </button>`;
  }

  render() {
    const t_ = (k: string): string => erplora().t(CATALOG, k);
    const stations = this.stations;
    const cooking = this.cookingTickets;
    const ready = this.readyTickets;
    return html`<div>
      <div class="bar">
        <!-- The tab is named by the view alone (kitchen#116): the counter glued to the word made it
             «Comandas0», so the counter is aria-hidden and the name is the word it paints. Not aria-label:
             Ionic copies it onto its role="tab" button once, at load, and this screen repaints in place
             on a language change. -->
        <ion-segment class="views" data-testid="kds-views" .value=${this.mode} @ionChange=${(e: CustomEvent<{ value: string }>) => (this.mode = (e.detail.value as 'tickets' | 'ready' | 'allday') || 'tickets')}>
          <ion-segment-button value="tickets" data-testid="kds-view-tickets"><ion-label>${t_('ui.modeTickets')}<span class="count" aria-hidden="true" data-testid="kds-count-cooking" data-count="cooking">${cooking.length}</span></ion-label></ion-segment-button>
          <ion-segment-button value="ready" data-testid="kds-view-ready"><ion-label>${t_('ui.readyRail')}<span class="count" aria-hidden="true" data-testid="kds-count-ready" data-count="ready">${ready.length}</span></ion-label></ion-segment-button>
          <ion-segment-button value="allday" data-testid="kds-view-allday"><ion-label>${t_('ui.modeAllDay')}</ion-label></ion-segment-button>
        </ion-segment>
        ${this.renderFullscreen()}
        ${stations.length > 1 || this.station
          ? html`<ion-segment class="stations" data-testid="kds-stations" scrollable .value=${this.station || '__all'} @ionChange=${(e: CustomEvent<{ value: string }>) => (this.station = e.detail.value === '__all' ? '' : String(e.detail.value ?? ''))}>
              <ion-segment-button value="__all" data-testid="kds-station-all"><ion-label>${t_('ui.stationAll')}</ion-label></ion-segment-button>
              ${stations.map((s) => html`<ion-segment-button value=${s.id || NO_STATION} data-testid=${`kds-station-${s.id || 'none'}`}><ion-label>${s.id ? s.label : t_('ui.stationNone')}</ion-label></ion-segment-button>`)}
            </ion-segment>`
          : nothing}
      </div>
      ${this.error ? html`<ok-inline-feedback data-testid="kds-error" tone="danger" icon="alert-circle-outline">${this.error}</ok-inline-feedback>` : nothing}
      ${this.passWarning
        ? html`<ok-inline-feedback data-testid="kds-pass-warning" data-pass-warning tone="warning" icon="print-outline">${this.passWarning}</ok-inline-feedback>`
        : nothing}
      ${this.rushNoticeWarning ? html`<ok-inline-feedback data-testid="kds-rush-notice-warning" tone="warning" icon="print-outline">${this.rushNoticeWarning}</ok-inline-feedback>` : nothing}
      ${this.mode === 'allday'
        ? this.renderAllDay()
        : this.mode === 'ready'
          ? this.renderBoard(ready, 'ui.emptyReady')
          : this.renderBoard(cooking, 'ui.emptyDisplay')}
    </div>`;
  }
}

define('erp-kitchen-display', ErpKitchenDisplay);
