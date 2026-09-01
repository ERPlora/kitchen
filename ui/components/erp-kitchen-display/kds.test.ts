// The KDS of kitchen#4: a GRID OF TICKETS, not a table (Toast, Square, Lightspeed, Fresh, TouchBistro,
// Odoo, LS Central, Simphony). What this file pins:
//   · rows of `kitchen.orders.display` (one per line) are grouped into one card per ticket;
//   · the station filter shows only that station's lines, and a header tap bumps ONLY those lines
//     (Tek-Tips: a bump on the bar must never clear the grill's lines from the expo);
//   · one tap on a line = bump, one tap on a struck line = recall — no confirm dialog, ever;
//   · the two-threshold semaphore (`warning_time_minutes` / `critical_time_minutes`) is painted from
//     `kitchen_settings`, honouring `color_coding_enabled` and `show_timer`; the clock never stops;
//   · All-Day sums quantities per product (fixed-point 10⁶ → units);
//   · a role without `kitchen.change_order` sees the tickets and cannot bump anything.
import { beforeEach, describe, expect, it, vi } from 'vitest';

type Row = Record<string, unknown>;

let displayRows: Row[] = [];
let allDayRows: Row[] = [];
let settings: Row = {};
let stationRows: Row[] = [];
let hubUsers: Row[] | Error = [];
let permissions: string[] = ['kitchen.view_order', 'kitchen.change_order', 'kitchen.complete_order'];
let commands: Array<{ name: string; payload: Record<string, unknown> }> = [];
let listeners: Record<string, Array<(p: unknown) => void>> = {};

const NOW = new Date('2026-08-18T12:00:00Z');
const minutesAgo = (m: number) => new Date(NOW.getTime() - m * 60_000).toISOString();

function line(order: Row, item: Row): Row {
  return { ...order, ...item };
}

const T4 = { order_id: 'k1', order_number: '20260818-0001', order_status: 'preparing', order_type: 'dine_in', priority: 'normal', label: 'Mesa 4', round_number: 1, order_notes: '', order_fired_at: minutesAgo(5), ready_at: null, order_created_at: minutesAgo(5), waiter_id: 'u-ana' };
const BAR = { order_id: 'k2', order_number: '20260818-0002', order_status: 'pending', order_type: 'takeaway', priority: 'rush', label: 'Barra', round_number: 1, order_notes: '', order_fired_at: null, ready_at: null, order_created_at: minutesAgo(20), waiter_id: null };

function seed() {
  displayRows = [
    line(T4, { item_id: 'i1', station_id: 's-bar', station_name: 'Bar', destination: 'display', product_name: 'Caña', quantity: 2_000_000, modifiers: '', item_notes: '', item_status: 'pending', seat_number: 1, completed_at: null }),
    line(T4, { item_id: 'i2', station_id: 's-grill', station_name: 'Plancha', destination: 'both', product_name: 'Hamburguesa', quantity: 1_000_000, modifiers: 'sin cebolla', item_notes: 'al punto', item_status: 'pending', seat_number: 2, completed_at: null }),
    line(T4, { item_id: 'i3', station_id: 's-grill', station_name: 'Plancha', destination: 'both', product_name: 'Patatas', quantity: 1_000_000, modifiers: '', item_notes: '', item_status: 'ready', seat_number: null, completed_at: minutesAgo(1) }),
    line(BAR, { item_id: 'i4', station_id: 's-bar', station_name: 'Bar', destination: 'display', product_name: 'Café', quantity: 1_000_000, modifiers: '', item_notes: '', item_status: 'pending', seat_number: null, completed_at: null }),
  ];
  allDayRows = [
    { product_name: 'Caña', station_name: 'Bar', quantity: 3_500_000, lines: 2 },
    { product_name: 'Hamburguesa', station_name: 'Plancha', quantity: 1_000_000, lines: 1 },
  ];
  settings = { show_timer: 1, warning_time_minutes: 15, critical_time_minutes: 30, color_coding_enabled: 1 };
  // The hub's stations: `name` is the seed language, `name_es` what a Spanish hub must show.
  // s-grill carries NO translation: the base name is the fallback, never a blank.
  stationRows = [
    { id: 's-bar', name: 'Bar', name_es: 'Barra', is_active: 1 },
    { id: 's-grill', name: 'Plancha', name_es: '', is_active: 1 },
  ];
  // kitchen#63 — the hub's people, the core's reserved namespace (ADR-0192). Personnel belongs to
  // the hub, not to a module, and `waiter_id` is an OPAQUE id: the NAME is resolved here.
  hubUsers = [{ id: 'u-ana', name: 'Ana', role: 'employee', is_active: true }];
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  seed();
  commands = [];
  listeners = {};
  permissions = ['kitchen.view_order', 'kitchen.change_order', 'kitchen.complete_order'];
  (globalThis as Record<string, unknown>).confirm = vi.fn(() => {
    throw new Error('the KDS must never ask for confirmation');
  });
  (globalThis as Record<string, unknown>).erplora = {
    query: async (name: string) => {
      if (name === 'kitchen.orders.display') return displayRows;
      if (name === 'kitchen.orders.all_day') return allDayRows;
      if (name === 'kitchen.settings.get') return [settings];
      if (name === 'kitchen.stations.list') return stationRows;
      if (name === 'hub.users.list') {
        if (hubUsers instanceof Error) throw hubUsers;
        return hubUsers;
      }
      return [];
    },
    queryPage: async () => ({ rows: [], total: 0, limit: 50, offset: 0 }),
    command: async (name: string, payload: Record<string, unknown>) => {
      commands.push({ name, payload });
      return {};
    },
    hasPermission: (p: string) => permissions.includes(p),
    on: (event: string, cb: (p: unknown) => void) => {
      (listeners[event] ??= []).push(cb);
      return () => {};
    },
    locale: 'es',
    t: (_catalog: unknown, key: string, params?: Record<string, unknown>) =>
      params ? `${key}:${Object.values(params).join(',')}` : key,
    formatMoney: (cents: number) => `${((cents || 0) / 100).toFixed(2)} €`,
  };
});

type Host = HTMLElement & {
  shadowRoot: ShadowRoot;
  updateComplete: Promise<unknown>;
  station: string;
  mode: 'tickets' | 'allday';
};

async function settle(el: Host) {
  for (let i = 0; i < 4; i++) {
    await el.updateComplete;
    await Promise.resolve();
  }
}

async function mount(): Promise<Host> {
  await import('./erp-kitchen-display');
  const el = document.createElement('erp-kitchen-display') as Host;
  document.body.appendChild(el);
  await settle(el);
  return el;
}

const cards = (el: Host) => Array.from(el.shadowRoot.querySelectorAll<HTMLElement>('[data-order]'));
const card = (el: Host, id: string) => el.shadowRoot.querySelector<HTMLElement>(`[data-order="${id}"]`)!;
const lines = (c: HTMLElement) => Array.from(c.querySelectorAll<HTMLElement>('[data-item]'));

describe('a grid of tickets, one card per order, lines inside', () => {
  it('groups the one-row-per-line feed into cards with label, number and lines', async () => {
    const el = await mount();
    expect(cards(el).map((c) => c.dataset.order)).toEqual(['k1', 'k2']);
    const t4 = card(el, 'k1');
    expect(t4.textContent).toContain('Mesa 4');
    expect(t4.textContent).toContain('0001');
    expect(lines(t4).map((l) => l.dataset.item)).toEqual(['i1', 'i2', 'i3']);
    // quantity is fixed-point 10⁶: 2 000 000 → «2», never «2000000»
    expect(lines(t4)[0].textContent).toMatch(/\b2\b/);
    expect(lines(t4)[0].textContent).not.toContain('2000000');
    // modifiers and notes travel with the line
    expect(lines(t4)[1].textContent).toContain('sin cebolla');
    expect(lines(t4)[1].textContent).toContain('al punto');
    // a struck (ready) line is marked as such
    expect(lines(t4)[2].dataset.status).toBe('ready');
    // no ok-data-table on the line: it is a pass, not a spreadsheet
    expect(el.shadowRoot.querySelector('ok-data-table')).toBeNull();
  });

  it('the station filter shows only that station\'s lines and hides tickets without any', async () => {
    const el = await mount();
    el.station = 's-grill';
    await settle(el);
    expect(cards(el).map((c) => c.dataset.order)).toEqual(['k1']);
    expect(lines(card(el, 'k1')).map((l) => l.dataset.item)).toEqual(['i2', 'i3']);
  });
});

// ── kitchen#45: the station names speak the hub's language ───────────────────────────────────
//
// The line freezes its station NAME at send time (ADR-0145 snapshot), and until now it froze the
// SEED column (`name`: Bar, Kitchen) — so a Spanish hub showed a segment reading «Todas las
// estaciones | Bar | Sin estación», two labels in Spanish and one in English, and `Bar` under every
// product. The freeze now takes the localized column (COALESCE of name_es over name), and the KDS
// RESOLVES the name by station_id when it paints: a comanda sent BEFORE the change (or before the
// language was set) still renders localized, because the id is the fact and the name is
// presentation. When the stations list cannot be loaded, the frozen snapshot is the fallback.
describe('kitchen#45: station names in the hub language, resolved by station_id', () => {
  const segmentButtons = (el: Host) =>
    Array.from(el.shadowRoot.querySelectorAll<HTMLElement>('ion-segment-button')).filter((b) => b.value !== '__all');

  it('the segment and the line meta show name_es even when the snapshot froze the seed name', async () => {
    const el = await mount();
    const labels = segmentButtons(el).map((b) => b.textContent?.trim());
    expect(labels, 'the segment still shows the frozen seed name (Bar)').toContain('Barra');
    expect(labels).not.toContain('Bar');
    // …and a station without name_es keeps its base name (never blank).
    expect(labels).toContain('Plancha');
    // The line meta under the product speaks the same language as the segment.
    expect(lines(card(el, 'k1'))[0].textContent).toContain('Barra');
  });

  it('the segment keys by station_id: filtering still works after a rename or a locale switch', async () => {
    const el = await mount();
    const byBar = segmentButtons(el).find((b) => b.textContent?.trim() === 'Barra');
    expect(byBar?.getAttribute('value'), 'the segment value is the station id, not its (localized) name').toBe('s-bar');
    el.station = 's-bar';
    await settle(el);
    expect(cards(el).map((c) => c.dataset.order)).toEqual(['k1', 'k2']);
    expect(lines(card(el, 'k1')).map((l) => l.dataset.item)).toEqual(['i1']);
  });

  it('a comanda whose station no longer exists keeps its frozen snapshot name', async () => {
    stationRows = [{ id: 's-grill', name: 'Plancha', name_es: 'Plancha', is_active: 1 }]; // s-bar deleted
    const el = await mount();
    expect(el.shadowRoot.textContent).toContain('Bar');
  });

  it('without the stations list (query failed) the snapshot name is the fallback', async () => {
    (globalThis as { erplora: { query: unknown } }).erplora.query = async (name: string) => {
      if (name === 'kitchen.stations.list') throw new Error('no permissions / no SDK');
      if (name === 'kitchen.orders.display') return displayRows;
      if (name === 'kitchen.orders.all_day') return allDayRows;
      if (name === 'kitchen.settings.get') return [settings];
      return [];
    };
    const el = await mount();
    expect(segmentButtons(el).map((b) => b.textContent?.trim())).toContain('Bar');
  });
});

// kitchen#63 — **the ticket says who fired it.** The KDS showed the round with no waiter, so at the
// pass nobody knew who to call when the plate was ready. What the market does (Toast, Square for
// Restaurants, Lightspeed): the server is pinned to the check and reads in the TICKET HEADER, next
// to the table. Two rules that are the whole point of the fix: the header shows a NAME (resolved
// from `hub.users.list`, the core's reserved namespace — `waiter_id` is opaque), and where there is
// no name there is NOTHING, because a UUID on a screen read from two metres away is worse than a
// blank: the cook reads it, cannot use it, and stops trusting the header.
describe('kitchen#63: the ticket header says which waiter fired it', () => {
  const waiterOf = (el: Host, id: string) =>
    card(el, id).querySelector<HTMLElement>('[data-waiter]')?.textContent?.trim();

  it('paints the waiter NAME in the header, resolved from hub.users.list', async () => {
    const el = await mount();
    expect(waiterOf(el, 'k1')).toBe('ui.firedBy:Ana');
    expect(card(el, 'k1').textContent, 'the opaque id never reaches the pass').not.toContain('u-ana');
  });

  it('a round fired by nobody paints no waiter at all', async () => {
    const el = await mount();
    expect(waiterOf(el, 'k2')).toBeUndefined();
  });

  it('a waiter the hub no longer lists paints nothing — never a raw id', async () => {
    hubUsers = [{ id: 'u-someone-else', name: 'Luis', role: 'employee', is_active: true }];
    const el = await mount();
    expect(waiterOf(el, 'k1')).toBeUndefined();
    expect(card(el, 'k1').textContent).not.toContain('u-ana');
  });

  it('an INACTIVE waiter still reads: the round they fired is a historical fact', async () => {
    hubUsers = [{ id: 'u-ana', name: 'Ana', role: 'employee', is_active: false }];
    const el = await mount();
    expect(waiterOf(el, 'k1')).toBe('ui.firedBy:Ana');
  });

  it('without hub.users.list (no permission, no SDK) the pass still works', async () => {
    hubUsers = new Error('no permissions / no SDK');
    const el = await mount();
    // Degraded, never broken: the ticket, its lines and its bump are all still there.
    expect(cards(el).map((c) => c.dataset.order)).toEqual(['k1', 'k2']);
    expect(waiterOf(el, 'k1')).toBeUndefined();
    expect(el.shadowRoot.textContent).not.toContain('u-ana');
  });
});

describe('one tap = bump; one tap on a struck line = recall; never a dialog', () => {
  it('tapping a pending line bumps that line only', async () => {
    const el = await mount();
    lines(card(el, 'k1'))[0].click();
    await settle(el);
    expect(commands).toEqual([{ name: 'kitchen.items.bump', payload: { order_id: 'k1', item_ids: ['i1'] } }]);
  });

  it('tapping a ready line recalls it', async () => {
    const el = await mount();
    lines(card(el, 'k1'))[2].click();
    await settle(el);
    expect(commands).toEqual([{ name: 'kitchen.items.recall', payload: { order_id: 'k1', item_ids: ['i3'] } }]);
  });

  it('the header bump of a station-filtered ticket bumps ONLY that station\'s cooking lines', async () => {
    const el = await mount();
    el.station = 's-grill';
    await settle(el);
    card(el, 'k1').querySelector<HTMLElement>('[data-action="bump"]')!.click();
    await settle(el);
    // i2 is Plancha & pending → bumped; i3 is Plancha but already ready → skipped; i1 is Bar → untouched
    expect(commands).toEqual([{ name: 'kitchen.items.bump', payload: { order_id: 'k1', item_ids: ['i2'] } }]);
  });

  it('in the expo view (all stations) the header bump takes every cooking line of the ticket', async () => {
    const el = await mount();
    card(el, 'k1').querySelector<HTMLElement>('[data-action="bump"]')!.click();
    await settle(el);
    expect(commands).toEqual([{ name: 'kitchen.items.bump', payload: { order_id: 'k1', item_ids: ['i1', 'i2'] } }]);
  });

  it('a ready ticket offers recall (and served with complete_order), never in a dialog', async () => {
    displayRows = displayRows.map((r) => (r.order_id === 'k1' ? { ...r, order_status: 'ready', item_status: 'ready' } : r));
    const el = await mount();
    // kitchen#60 — a finished ticket LEAVES the active board and waits in its own view, the way
    // Square and Loyverse tab it away and Toast and Fresh bump it to a recall bar. Until then it
    // was painted in a second grid under the cooking one, which is what dropped a ready ticket
    // BELOW the one still being cooked. What this case pins is unchanged and is the point of the
    // move: everything the ticket could do there, it can still do here.
    el.mode = 'ready';
    await settle(el);
    const c = card(el, 'k1');
    expect(c.dataset.status).toBe('ready');
    c.querySelector<HTMLElement>('[data-action="recall"]')!.click();
    await settle(el);
    expect(commands.at(-1)).toEqual({ name: 'kitchen.items.recall', payload: { order_id: 'k1', item_ids: ['i1', 'i2', 'i3'] } });
    c.querySelector<HTMLElement>('[data-action="served"]')!.click();
    await settle(el);
    expect(commands.at(-1)).toEqual({ name: 'kitchen.orders.mark_served', payload: { order_id: 'k1' } });
  });

  it('a refused transition shows the translated code and reloads the feed', async () => {
    const el = await mount();
    (globalThis as { erplora: { command: unknown } }).erplora.command = async () => {
      const e = new Error('server text') as Error & { code: string };
      e.code = 'kitchen.invalid_transition';
      throw e;
    };
    let loads = 0;
    const q = (globalThis as { erplora: { query: (n: string) => Promise<unknown> } }).erplora.query;
    (globalThis as { erplora: { query: unknown } }).erplora.query = async (n: string) => {
      if (n === 'kitchen.orders.display') loads += 1;
      return q(n);
    };
    lines(card(el, 'k1'))[0].click();
    await settle(el);
    expect(el.shadowRoot.textContent).toContain('Esa comanda ya no está en el estado que requiere esta acción');
    expect(loads).toBeGreaterThan(0);
  });
});

describe('the two-threshold semaphore, from kitchen_settings', () => {
  it('green under warning, amber under critical, red beyond — and the clock keeps counting', async () => {
    const el = await mount();
    expect(card(el, 'k1').dataset.sem).toBe('ok'); // 5 min
    expect(card(el, 'k2').dataset.sem).toBe('warning'); // 20 min
    vi.setSystemTime(new Date(NOW.getTime() + 15 * 60_000));
    vi.advanceTimersByTime(1_000);
    await settle(el);
    expect(card(el, 'k2').dataset.sem).toBe('critical'); // 35 min
    expect(card(el, 'k2').querySelector('[data-timer]')!.textContent).toMatch(/35:0\d/);
  });

  it('honours color_coding_enabled=0 (no colour) and show_timer=0 (no clock)', async () => {
    settings = { ...settings, color_coding_enabled: 0, show_timer: 0 };
    const el = await mount();
    expect(card(el, 'k2').dataset.sem).toBe('off');
    expect(card(el, 'k2').querySelector('[data-timer]')).toBeNull();
  });
});

describe('All-Day: what is left to cook, summed per product', () => {
  it('shows units (÷10⁶) per product and filters by station', async () => {
    const el = await mount();
    el.mode = 'allday';
    await settle(el);
    const rows = Array.from(el.shadowRoot.querySelectorAll<HTMLElement>('[data-allday]'));
    expect(rows.map((r) => r.dataset.allday)).toEqual(['Caña', 'Hamburguesa']);
    expect(rows[0].textContent).toMatch(/3[.,]5/);
    // kitchen#45: the station column speaks the hub language too (Bar → Barra).
    expect(rows[0].textContent).toContain('Barra');
    el.station = 's-grill';
    await settle(el);
    expect(Array.from(el.shadowRoot.querySelectorAll<HTMLElement>('[data-allday]')).map((r) => r.dataset.allday)).toEqual(['Hamburguesa']);
  });
});

describe('permissions and live refresh', () => {
  it('without change_order the tickets are read-only', async () => {
    permissions = ['kitchen.view_order'];
    const el = await mount();
    expect(card(el, 'k1').querySelector('[data-action="bump"]')).toBeNull();
    lines(card(el, 'k1'))[0].click();
    await settle(el);
    expect(commands).toEqual([]);
  });

  it('reloads on kitchen.order.* and kitchen.item.* events (no polling)', async () => {
    await mount();
    for (const ev of ['kitchen.order.created', 'kitchen.order.ready', 'kitchen.item.bumped', 'kitchen.item.recalled', 'kitchen.order.cancelled']) {
      expect(listeners[ev]?.length, ev).toBeGreaterThan(0);
    }
  });

  it('touch targets: lines and buttons are at least 44px tall by contract', async () => {
    const el = await mount();
    const css = (el.constructor as unknown as { styles: { cssText: string } | { cssText: string }[] }).styles;
    const text = Array.isArray(css) ? css.map((c) => c.cssText).join('\n') : css.cssText;
    expect(text).toMatch(/\.line\s*\{[^}]*min-height:\s*44px/);
    expect(text).not.toMatch(/size="small"/);
  });
});

// ── kitchen#42: el botón «Listo» pinta su propio fondo ────────────────────────────────────────
//
// `color="success"` no pinta fondo dentro del Shadow DOM de un módulo. Ionic lo implementa con la
// regla GLOBAL `.ion-color-success { --ion-color-base: … }`, que vive en la hoja del documento y no
// atraviesa el shadow root: dentro del WC el selector no casa con nada, `--ion-color-base` queda
// VACÍO y `button-solid { background: var(--ion-color-base) }` resuelve a transparente. El texto sí
// sale blanco (lo pone `--color`), de ahí el blanco sobre blanco de la issue.
//
// happy-dom no hace layout ni carga el CSS de Ionic, así que aquí no se puede medir el
// `backgroundColor` computado (eso lo midió el QA en un navegador real, con la prueba A/B de
// `--ion-color-base`). Lo que se fija es el CONTRATO que lo hace imposible: el fondo se declara en
// el CSS del componente —que sí vive dentro del shadow root— y ningún botón lo delega en `color=`.
describe('kitchen#42: the bump button paints its own background', () => {
  const stylesOf = (el: Host): string => {
    const css = (el.constructor as unknown as { styles: { cssText: string } | { cssText: string }[] }).styles;
    return Array.isArray(css) ? css.map((c) => c.cssText).join('\n') : css.cssText;
  };

  it('declares --background inside the shadow root instead of delegating to color=', async () => {
    const el = await mount();
    expect(stylesOf(el)).toMatch(/\[data-action=["']bump["']\][^{]*\{[^}]*--background:/);
  });

  it('no ion-button of the KDS depends on color= for its background', async () => {
    const el = await mount();
    const offenders = Array.from(el.shadowRoot.querySelectorAll('ion-button'))
      .filter((b) => b.hasAttribute('color') && !b.hasAttribute('fill'))
      .map((b) => b.getAttribute('data-action') ?? b.textContent?.trim());
    expect(offenders, 'a solid ion-button inside a module shadow root renders transparent').toEqual([]);
  });
});
