// kitchen#60 — **the KDS is a board, not a page**: it has to use the whole screen.
//
// What was wrong (seen at 1440 in `qa-pm149`, kitchen 2.3.27): ~190 px of chrome before the first
// ticket (an `<h2>` title plus TWO full-width `ion-segment` rows), a grid of `minmax(17rem, 1fr)`
// cards that left ~70 % of the screen blank, dish names at 1 rem that a cook cannot read from a
// metre away — and, the part Ioan actually asked about («los elementos no están uno al lado de
// otro»), the READY tickets painted in a SECOND grid under an `<h3>LISTAS</h3>`, so a ready ticket
// fell BELOW the one still cooking instead of leaving the line.
//
// What the market does — Toast KDS, Square KDS, Fresh KDS, Lightspeed K-Series, Loyverse KDS and
// Oracle Simphony, six for six: full screen, minimal header, equal columns that fill the width,
// XL type, and the finished tickets OUT of the active board, one tap away (a «Completed» tab in
// Square and Loyverse, a recall bar in Toast and Fresh). None of them stacks a «cooking / ready»
// pair of sections down the page.
//
// This file pins the BOARD. happy-dom does no layout, so what it can prove is the structure (one
// grid, one command bar, ready tickets in their own view with their count) and the CSS CONTRACT
// that makes the rest possible (column track, type scale). How it actually LOOKS is verified in a
// real browser at 390/834/1440 — that is a standing directive, not something a DOM test replaces.
import { beforeEach, describe, expect, it, vi } from 'vitest';

type Row = Record<string, unknown>;

let displayRows: Row[] = [];
let commands: Array<{ name: string; payload: Record<string, unknown> }> = [];

const NOW = new Date('2026-08-18T12:00:00Z');
const minutesAgo = (m: number) => new Date(NOW.getTime() - m * 60_000).toISOString();

function line(order: Row, item: Row): Row {
  return { ...order, ...item };
}

/** Cooking: table 4, one round, two lines still pending. */
const T4 = { order_id: 'k1', order_number: '20260818-0001', order_status: 'preparing', order_type: 'dine_in', priority: 'normal', label: 'Mesa 4', round_number: 1, order_notes: '', order_fired_at: minutesAgo(5), ready_at: null, order_created_at: minutesAgo(5), waiter_id: 'u-ana' };
/** Ready: the bar's coffee is done and waiting to be picked up. */
const BAR = { order_id: 'k2', order_number: '20260818-0002', order_status: 'ready', order_type: 'takeaway', priority: 'normal', label: 'Barra', round_number: 1, order_notes: '', order_fired_at: minutesAgo(8), ready_at: minutesAgo(1), order_created_at: minutesAgo(8), waiter_id: null };

function seed() {
  displayRows = [
    line(T4, { item_id: 'i1', station_id: 's-bar', station_name: 'Bar', destination: 'display', product_name: 'Caña', quantity: 2_000_000, modifiers: '', item_notes: '', item_status: 'pending', seat_number: 1, completed_at: null }),
    line(T4, { item_id: 'i2', station_id: 's-grill', station_name: 'Plancha', destination: 'both', product_name: 'Hamburguesa', quantity: 1_000_000, modifiers: '', item_notes: '', item_status: 'pending', seat_number: 2, completed_at: null }),
    line(BAR, { item_id: 'i3', station_id: 's-bar', station_name: 'Bar', destination: 'display', product_name: 'Café', quantity: 1_000_000, modifiers: '', item_notes: '', item_status: 'ready', seat_number: null, completed_at: minutesAgo(1) }),
  ];
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  seed();
  commands = [];
  (globalThis as Record<string, unknown>).erplora = {
    query: async (name: string) => {
      if (name === 'kitchen.orders.display') return displayRows;
      if (name === 'kitchen.orders.all_day') return [{ product_name: 'Caña', station_name: 'Bar', quantity: 2_000_000, lines: 1 }];
      if (name === 'kitchen.settings.get') return [{ show_timer: 1, warning_time_minutes: 15, critical_time_minutes: 30, color_coding_enabled: 1 }];
      if (name === 'kitchen.stations.list') return [{ id: 's-bar', name: 'Bar', name_es: 'Barra', is_active: 1 }, { id: 's-grill', name: 'Plancha', name_es: '', is_active: 1 }];
      if (name === 'hub.users.list') return [{ id: 'u-ana', name: 'Ana', is_active: true }];
      return [];
    },
    queryPage: async () => ({ rows: [], total: 0, limit: 50, offset: 0 }),
    command: async (name: string, payload: Record<string, unknown>) => {
      commands.push({ name, payload });
      return {};
    },
    hasPermission: () => true,
    on: () => () => {},
    locale: 'es',
    t: (_catalog: unknown, key: string, params?: Record<string, unknown>) =>
      params ? `${key}:${Object.values(params).join(',')}` : key,
  };
});

type Host = HTMLElement & {
  shadowRoot: ShadowRoot;
  updateComplete: Promise<unknown>;
  station: string;
  mode: 'tickets' | 'ready' | 'allday';
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

const orders = (el: Host) => Array.from(el.shadowRoot.querySelectorAll<HTMLElement>('[data-order]')).map((c) => c.dataset.order);
const styles = (el: Host): string => {
  const css = (el.constructor as unknown as { styles: { cssText: string } | { cssText: string }[] }).styles;
  return Array.isArray(css) ? css.map((c) => c.cssText).join('\n') : css.cssText;
};
/** The `font-size` declared for a selector, in rem — 0 when the rule is not there at all, so a
 *  renamed or deleted rule fails loudly instead of quietly asserting nothing. */
function fontRem(css: string, selector: string): number {
  const at = css.indexOf(`${selector} {`);
  if (at < 0) return 0;
  const size = /font-size:\s*([\d.]+)rem/.exec(css.slice(at, css.indexOf('}', at)));
  return size ? Number(size[1]) : 0;
}

describe('kitchen#60: the ready ticket LEAVES the board, it does not stack under it', () => {
  it('paints ONE grid and no «Listas» section title', async () => {
    const el = await mount();
    expect(el.shadowRoot.querySelectorAll('.grid'), 'two grids stacked vertically is what put a ready ticket BELOW a cooking one').toHaveLength(1);
    expect(el.shadowRoot.querySelector('.section-title')).toBeNull();
  });

  it('the active board shows only what is still cooking', async () => {
    const el = await mount();
    expect(orders(el)).toEqual(['k1']);
  });

  it('the ready tickets live in their own view, one tap away, with their count', async () => {
    const el = await mount();
    const tab = el.shadowRoot.querySelector<HTMLElement>('ion-segment-button[value="ready"]');
    expect(tab, 'Square and Loyverse put the finished tickets in their own tab; Toast and Fresh in a recall bar').not.toBeNull();
    expect(tab!.textContent).toContain('1');

    el.mode = 'ready';
    await settle(el);
    expect(orders(el)).toEqual(['k2']);
    // …and it can still come back: recall is the undo, and it must survive the move.
    el.shadowRoot.querySelector<HTMLElement>('[data-order="k2"] [data-action="recall"]')!.click();
    await settle(el);
    expect(commands.at(-1)).toEqual({ name: 'kitchen.items.recall', payload: { order_id: 'k2', item_ids: ['i3'] } });
  });

  it('the count is live: with nothing ready the tab reads zero and says so', async () => {
    displayRows = displayRows.filter((r) => r.order_id !== 'k2');
    const el = await mount();
    expect(el.shadowRoot.querySelector<HTMLElement>('ion-segment-button[value="ready"]')!.textContent).toContain('0');
    el.mode = 'ready';
    await settle(el);
    expect(el.shadowRoot.querySelector('ok-empty-state')).not.toBeNull();
  });

  it('the station filter still narrows the board (kitchen#45 is not traded away)', async () => {
    const el = await mount();
    el.station = 's-grill';
    await settle(el);
    expect(orders(el)).toEqual(['k1']);
    expect(Array.from(el.shadowRoot.querySelectorAll<HTMLElement>('[data-item]')).map((l) => l.dataset.item)).toEqual(['i2']);
  });

  it('the waiter of kitchen#67 keeps reading on the ticket', async () => {
    const el = await mount();
    expect(el.shadowRoot.querySelector<HTMLElement>('[data-order="k1"] [data-waiter]')?.textContent).toContain('Ana');
  });
});

describe('kitchen#60: ONE command bar, not two rows of full-width segments', () => {
  it('has a single bar and no page title inside the board', async () => {
    const el = await mount();
    expect(el.shadowRoot.querySelectorAll('.bar'), 'two bars is the ~190 px of chrome the issue measured').toHaveLength(1);
    expect(el.shadowRoot.querySelector('h2'), 'a KDS header is ~48 px: the screen already says what it is').toBeNull();
  });

  it('the view switcher and the stations share that bar, and neither takes the full width', async () => {
    const el = await mount();
    const bar = el.shadowRoot.querySelector('.bar')!;
    expect(bar.querySelector('ion-segment.views')).not.toBeNull();
    expect(bar.querySelector('ion-segment.stations')).not.toBeNull();
    // Ionic's `ion-segment` host is `width: 100%`; left alone, each one is a full-width row.
    expect(styles(el)).toMatch(/ion-segment\.views\s*\{[^}]*width:\s*auto/);
  });

  it('the bar stays put while the board scrolls', async () => {
    // A wall tablet with 20 tickets scrolls; losing the station filter off the top strands the cook.
    expect(styles(await mount())).toMatch(/\.bar\s*\{[^}]*position:\s*sticky/);
  });
});

describe('kitchen#60: columns that fill the screen and type a cook can read from a metre', () => {
  it('sizes the column against the viewport instead of a fixed 17 rem', async () => {
    const css = styles(await mount());
    const track = /\.grid\s*\{[^}]*grid-template-columns:\s*([^;]+);/.exec(css)?.[1] ?? '';
    expect(track, 'a fixed 17rem track leaves ~70 % of a 1440 board blank').not.toContain('17rem');
    expect(track).toMatch(/clamp\(/);
    expect(track, 'the column has to grow with the screen (Toast/Fresh: 4-6 tickets fill it)').toMatch(/vw/);
  });

  it('the dish, the quantity and the station are sized for a kitchen screen', async () => {
    const css = styles(await mount());
    expect(fontRem(css, '.line .name')).toBeGreaterThanOrEqual(1.4);
    expect(fontRem(css, '.line .qty')).toBeGreaterThanOrEqual(1.6);
    expect(fontRem(css, '.line .meta')).toBeGreaterThanOrEqual(1);
    expect(fontRem(css, '.head .label')).toBeGreaterThanOrEqual(1.3);
    // The waiter of kitchen#67 grows with the rest: it is read from the same metre away.
    expect(fontRem(css, '.head .waiter')).toBeGreaterThanOrEqual(0.9);
  });

  it('keeps the 44 px touch target it already had', async () => {
    expect(styles(await mount())).toMatch(/\.line\s*\{[^}]*min-height:\s*44px/);
  });

  // Caught in a real browser at 834 while doing the three-viewport pass, not by any DOM test:
  // growing the type to kitchen size made the ticket header overflow on a narrow column, and the
  // two things that shrank were the table («Mesa 7» → «M…») and the waiter of kitchen#67
  // («Camarero: Luis» → «Ca…»). The header now WRAPS — the table and who fired it keep the first
  // line, the pills, the clock and the number drop to the next — and this pins the contract that
  // makes it possible, because happy-dom does no layout and cannot see the overflow itself.
  it('the header wraps instead of squeezing the table and the waiter out', async () => {
    const css = styles(await mount());
    expect(css).toMatch(/\.head\s*\{[^}]*flex-wrap:\s*wrap/);
    expect(css, 'without a basis the title is the first thing the row takes from').toMatch(/\.head \.title\s*\{[^}]*flex:\s*1 1 \d+%/);
  });
});
