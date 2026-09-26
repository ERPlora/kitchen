// kitchen#93 — the board that sees a round turn rush puts the RUSH notice on paper.
//
// Driven by the feed, not by the tap, the same way the pass is driven by `kitchen.order.ready`:
// the round can be rushed from another screen (and, later, from the till, kitchen#94), and every
// mounted board learns it on the reload that `kitchen.order.updated` triggers. Every board asks;
// the (order, role) job id makes it one sheet in the queue.
//
// What this pins, each with its control:
//   · a ticket the board ALREADY had that turns rush → one notice per printer role;
//   · a ticket that ARRIVES already rush → no notice: its comanda already came out with the
//     «!! URGENTE !!» line (hub#1411), a second paper would be noise;
//   · the first feed never prints (a KDS switched on mid-service is learning, not hearing news);
//   · clearing rush prints nothing;
//   · the notice does not hang off the chime switch: a muted kitchen still gets its paper;
//   · a notice that did not come out is said on screen, in the hub's language.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

type Row = Record<string, unknown>;

let displayRows: Row[] = [];
let listeners: Record<string, Array<(p: unknown) => void>> = {};
let printed: Record<string, unknown>[] = [];
let printResult: () => Promise<{ via?: string; error?: string }> = async () => ({ via: 'queue' });
let soundEnabled = 1;

function round(orderId: string, priority = 'normal'): Row {
  return {
    order_id: orderId,
    order_number: `20260926-${orderId}`,
    order_status: 'preparing',
    order_type: 'dine_in',
    priority,
    label: `Mesa ${orderId}`,
    round_number: 1,
    order_notes: '',
    order_fired_at: new Date().toISOString(),
    ready_at: null,
    order_created_at: new Date().toISOString(),
    waiter_id: null,
    item_id: `i-${orderId}`,
    station_id: 's-grill',
    station_name: 'Plancha',
    destination: 'printer',
    product_name: 'Hamburguesa',
    quantity: 1_000_000,
    modifiers: '',
    item_notes: '',
    item_status: 'pending',
    seat_number: null,
    completed_at: null,
  };
}

/** `kitchen_order.rush_count` as `commands/order_update.sql` keeps it (kitchen#99). */
let rushCount: Record<string, number>;

beforeEach(() => {
  rushCount = {};
  listeners = {};
  printed = [];
  printResult = async () => ({ via: 'queue' });
  soundEnabled = 1;
  displayRows = [round('k1'), round('k2')];
  (globalThis as Record<string, unknown>).erplora = {
    query: async (name: string, params?: Record<string, unknown>) => {
      if (name === 'kitchen.orders.display') return displayRows;
      if (name === 'kitchen.settings.get') return [{ sound_enabled: soundEnabled, auto_print_tickets: 0 }];
      if (name === 'kitchen.orders.items') {
        return [{ order_id: params?.order_id, product_name: 'Hamburguesa', quantity: 1_000_000, destination: 'printer', printer_role: 'kitchen', status: 'pending' }];
      }
      if (name === 'kitchen.orders.get') {
        const id = String(params?.order_id);
        return [{ id, order_number: `20260926-${id}`, label: 'Mesa 4', round_number: 1, rush_count: rushCount[id] ?? 0 }];
      }
      return [];
    },
    queryPage: async () => ({ rows: [], total: 0, limit: 50, offset: 0 }),
    command: async () => ({}),
    print: async (req: Record<string, unknown>) => {
      printed.push(req);
      return printResult();
    },
    hasPermission: () => true,
    on: (event: string, cb: (p: unknown) => void) => {
      (listeners[event] ??= []).push(cb);
      return () => {};
    },
    locale: 'es',
    t: (_catalog: unknown, key: string) => key,
  };
});

afterEach(() => {
  document.body.innerHTML = '';
});

type Host = HTMLElement & { updateComplete: Promise<unknown>; shadowRoot: ShadowRoot };

async function settle(el: Host) {
  for (let i = 0; i < 8; i++) {
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

async function updated(el: Host, rows: Row[]) {
  displayRows = rows;
  for (const cb of listeners['kitchen.order.updated'] ?? []) cb({ order_id: 'k2' });
  await settle(el);
}

describe('kitchen#93: a round that turns rush reaches the paper', () => {
  it('prints the RUSH notice for a ticket the board already had', async () => {
    const el = await mount();
    expect(printed, 'control: nothing prints while nothing changes').toHaveLength(0);
    rushCount.k2 = 1;
    await updated(el, [round('k1'), round('k2', 'rush')]);
    expect(printed, 'the round went rush and the paper kitchen heard nothing').toHaveLength(1);
    expect(printed[0]).toMatchObject({ role: 'kitchen', documentType: 'kitchen_order', jobId: 'kitchen-rush-k2-kitchen-1' });
    expect(printed[0].data).toMatchObject({ priority: 'HIGH', items: [] });
  });

  it('kitchen#99 · rush cleared and set again asks for a NEW sheet, not a repeat the queue drops', async () => {
    const el = await mount();
    rushCount.k2 = 1;
    await updated(el, [round('k1'), round('k2', 'rush')]);
    await updated(el, [round('k1'), round('k2')]);
    rushCount.k2 = 2;
    await updated(el, [round('k1'), round('k2', 'rush')]);
    expect(printed.map((p) => p.jobId)).toEqual(['kitchen-rush-k2-kitchen-1', 'kitchen-rush-k2-kitchen-2']);
  });

  it('a ticket that ARRIVES rush prints no notice — its comanda already said URGENTE', async () => {
    const el = await mount();
    await updated(el, [round('k1'), round('k2'), round('k3', 'rush')]);
    expect(printed).toHaveLength(0);
  });

  it('the first feed never prints, rush tickets included', async () => {
    displayRows = [round('k1'), round('k2', 'rush')];
    await mount();
    expect(printed).toHaveLength(0);
  });

  it('clearing rush prints nothing', async () => {
    displayRows = [round('k1'), round('k2', 'rush')];
    const el = await mount();
    await updated(el, [round('k1'), round('k2')]);
    expect(printed).toHaveLength(0);
  });

  it('a muted kitchen still gets the paper — the notice does not hang off the chime', async () => {
    soundEnabled = 0;
    const el = await mount();
    await updated(el, [round('k1'), round('k2', 'rush')]);
    expect(printed).toHaveLength(1);
  });

  it('says on screen when the notice did not come out', async () => {
    printResult = async () => ({ via: 'none', error: 'no printer with role kitchen' });
    const el = await mount();
    expect(el.shadowRoot.querySelector('[data-testid="kds-rush-notice-warning"]'), 'control: no banner before').toBeNull();
    await updated(el, [round('k1'), round('k2', 'rush')]);
    const banner = el.shadowRoot.querySelector('[data-testid="kds-rush-notice-warning"]');
    expect(banner?.textContent?.trim()).toBe('ui.rushNoticeFailed');
  });
});
