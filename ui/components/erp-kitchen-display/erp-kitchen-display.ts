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
//   · station filter on the SNAPSHOT `station_name` of the line (never a live join), plus an
//     expo/pass view that shows every station;
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
}

interface Line {
  id: string;
  station: string;
  destination: string;
  product_name: string;
  quantity: number; // fixed-point 10⁶ (ADR-0147)
  modifiers: string;
  notes: string;
  status: string;
  seat: number | null;
}

interface Ticket {
  id: string;
  number: string;
  status: string;
  order_type: string;
  priority: string;
  label: string;
  round: number;
  notes: string;
  since: string; // fired_at ?? created_at
  lines: Line[];
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
        station: String(r.station_name ?? ''),
        destination: String(r.destination ?? 'both'),
        product_name: String(r.product_name ?? ''),
        quantity: Number(r.quantity ?? QUANTITY_SCALE) || 0,
        modifiers: String(r.modifiers ?? ''),
        notes: String(r.item_notes ?? ''),
        status: String(r.item_status ?? 'pending'),
        seat: r.seat_number === null || r.seat_number === undefined || r.seat_number === '' ? null : Number(r.seat_number),
      });
    }
  }
  return Array.from(byId.values());
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
    .head .label { font-weight:700; font-size:1.05rem; flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
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
    .foot { display:flex; gap:.5rem; padding:.5rem .75rem; border-top:1px solid var(--ion-border-color, #e7e2d6); }
    .foot ion-button { flex:1; }
    .notes { padding:.4rem .75rem; font-size:.85rem; font-style:italic; opacity:.85; border-top:1px dashed var(--ion-border-color, #e7e2d6); }
    .allday { width:100%; border-collapse:collapse; }
    .allday td, .allday th { padding:.6rem .75rem; text-align:left; border-bottom:1px solid var(--ion-border-color, #e7e2d6); min-height:44px; }
    .allday td.q { font-weight:800; font-size:1.2rem; text-align:right; font-variant-numeric: tabular-nums; width:6ch; }
    .allday td.s { opacity:.7; font-size:.85rem; }
    .section-title { margin:1rem 0 .5rem; font-size:.9rem; text-transform:uppercase; letter-spacing:.04em; opacity:.7; }
    @media (max-width: 480px) { .grid { grid-template-columns: 1fr; } }
  `;

  /** Station filter: '' = expo/pass (every station); `NO_STATION` = lines without station. Set from
   *  the segment; a public property so a fixed screen (the bar's tablet) can be pinned by attribute. */
  @property({ type: String, reflect: true }) station = '';

  /** 'tickets' (the pass) or 'allday' (what is left to cook, per product). */
  @property({ type: String, reflect: true }) mode: 'tickets' | 'allday' = 'tickets';

  @state() private rows: DisplayRow[] = [];

  @state() private allDay: AllDayRow[] = [];

  @state() private settings: DisplaySettings = { ...DEFAULT_SETTINGS };

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
      const [rows, allDay] = await Promise.all([
        erplora().query<DisplayRow[]>('kitchen.orders.display'),
        erplora().query<AllDayRow[]>('kitchen.orders.all_day'),
      ]);
      this.rows = Array.isArray(rows) ? rows : [];
      this.allDay = Array.isArray(allDay) ? allDay : [];
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

  /** Station names present on the line, for the segment (snapshot names, sorted). */
  private get stations(): string[] {
    const set = new Set<string>();
    for (const t of this.tickets) for (const l of t.lines) set.add(l.station);
    return Array.from(set).sort((a, b) => (a === '' ? 1 : b === '' ? -1 : a.localeCompare(b)));
  }

  /** The lines of a ticket this screen shows: all of them (expo) or the station's. */
  private visibleLines(t: Ticket): Line[] {
    if (!this.station) return t.lines;
    const want = this.station === NO_STATION ? '' : this.station;
    return t.lines.filter((l) => l.station === want);
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
    const station = !this.station && l.station ? html`<span>${l.station}</span>` : nothing;
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

  private renderTicket(t: Ticket) {
    const t_ = (k: string, p?: Record<string, unknown>): string => erplora().t(CATALOG, k, p);
    const lines = this.visibleLines(t);
    const cooking = lines.some((l) => COOKING.includes(l.status));
    const struck = lines.some((l) => l.status === 'ready');
    const canChange = can('kitchen.change_order');
    const canServe = can('kitchen.complete_order');
    const elapsed = this.elapsed(t);
    const sem = semaphore(elapsed, this.settings);
    const short = t.number.includes('-') ? t.number.slice(t.number.lastIndexOf('-') + 1) : t.number;
    return html`<article class="card" data-order=${t.id} data-status=${t.status} data-sem=${sem} aria-label=${t_('ui.ticketAria', { n: short })}>
      <header class="head" role="button" tabindex=${canChange && cooking ? 0 : -1} aria-disabled=${canChange && cooking ? 'false' : 'true'}
          title=${canChange && cooking ? t_('ui.tapHeaderToBump') : ''}
          @click=${() => (cooking ? this.bumpTicket(t) : undefined)}
          @keydown=${(e: KeyboardEvent) => { if (cooking && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); this.bumpTicket(t); } }}>
        <span class="label">${t.label || t_(`ui.orderType_${t.order_type}`) || t.order_type}</span>
        ${t.priority !== 'normal' ? html`<span class="pill ${t.priority}">${t_(`ui.priority_${t.priority}`)}</span>` : nothing}
        ${t.round > 1 ? html`<span class="pill round">${t_('ui.round', { n: t.round })}</span>` : nothing}
        ${t.status === 'ready' ? html`<span class="pill ready">${t_('ui.statusReady')}</span>` : nothing}
        ${this.settings.show_timer ? html`<span class="timer" data-timer>${formatElapsed(elapsed)}</span>` : nothing}
        <span class="num">#${short}</span>
      </header>
      <ul class="lines">${lines.map((l) => this.renderLine(t, l))}</ul>
      ${t.notes ? html`<div class="notes">${t.notes}</div>` : nothing}
      ${canChange || (canServe && t.status === 'ready')
        ? html`<footer class="foot">
            ${canChange && cooking ? html`<ion-button data-action="bump" color="success" @click=${() => this.bumpTicket(t)}>${t_('ui.bump')}</ion-button>` : nothing}
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

  private renderAllDay() {
    const t_ = (k: string): string => erplora().t(CATALOG, k);
    const want = this.station === NO_STATION ? '' : this.station;
    const rows = this.station ? this.allDay.filter((r) => String(r.station_name ?? '') === want) : this.allDay;
    if (!rows.length) return html`<ok-empty-state icon="restaurant-outline" .title=${t_('ui.emptyAllDay')}></ok-empty-state>`;
    // Same product on two stations (expo view) → two rows, each with its station: the fryer and
    // the grill do not share a batch.
    return html`<table class="allday">
      <thead><tr><th>${t_('ui.colProduct')}</th><th></th><th></th></tr></thead>
      <tbody>${rows.map(
        (r) => html`<tr data-allday=${r.product_name}>
          <td>${r.product_name}</td>
          <td class="s">${!this.station && r.station_name ? r.station_name : ''}</td>
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
              ${stations.map((s) => html`<ion-segment-button value=${s || NO_STATION}><ion-label>${s || t_('ui.stationNone')}</ion-label></ion-segment-button>`)}
            </ion-segment>
          </div>`
        : nothing}
      ${this.error ? html`<ok-inline-feedback tone="danger" icon="alert-circle-outline">${this.error}</ok-inline-feedback>` : nothing}
      ${this.mode === 'allday' ? this.renderAllDay() : this.renderTickets()}
    </div>`;
  }
}

define('erp-kitchen-display', ErpKitchenDisplay);
