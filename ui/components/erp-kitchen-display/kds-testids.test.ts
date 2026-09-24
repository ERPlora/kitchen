// kitchen#78 — the QA robot drives the KDS by name, not by text or position.
//
// `ui/test/testids.test.ts` reads the SOURCE: it proves every tap has a hook and pins the literal
// names. What it cannot prove is that a COMPUTED hook — the ticket, its line, its station — comes
// out of the render with the identity the spec will ask for. That is what this file mounts: a spec
// that says «bump table 4» asks for `kds-ticket-<order id>-bump`, and the board reorders itself on
// every fire and bump, so the id is the only thing that keeps it pressing the right card.
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

const byTestId = (el: Host, id: string): HTMLElement | null =>
  el.shadowRoot.querySelector<HTMLElement>(`[data-testid="${id}"]`);

describe('kitchen#78: the KDS answers to its data-testid hooks', () => {
  it('names each cooking ticket, its header, its lines and its bump by the order and item ids', async () => {
    const el = await mount();
    expect(byTestId(el, 'kds-ticket-k1')?.dataset.order).toBe('k1');
    expect(byTestId(el, 'kds-ticket-k1-head')?.tagName).toBe('HEADER');
    expect(byTestId(el, 'kds-line-i1')?.dataset.item).toBe('i1');
    expect(byTestId(el, 'kds-line-i2')?.dataset.item).toBe('i2');
    expect(byTestId(el, 'kds-ticket-k1-bump')?.dataset.action).toBe('bump');
  });

  it('pressing the ticket bump by its hook bumps THAT order', async () => {
    const el = await mount();
    byTestId(el, 'kds-ticket-k1-bump')?.click();
    await settle(el);
    expect(commands.some((c) => c.payload.order_id === 'k1')).toBe(true);
  });

  it('the ready view names the recall and served actions of the ready ticket', async () => {
    const el = await mount();
    el.mode = 'ready';
    await settle(el);
    expect(byTestId(el, 'kds-ticket-k2-recall')?.dataset.action).toBe('recall');
    expect(byTestId(el, 'kds-ticket-k2-served')?.dataset.action).toBe('served');
    expect(byTestId(el, 'kds-count-ready')?.textContent).toBe('1');
  });

  it('names the view tabs and the station filter by station id', async () => {
    const el = await mount();
    for (const id of ['kds-views', 'kds-view-tickets', 'kds-view-ready', 'kds-view-allday', 'kds-stations', 'kds-station-all']) {
      expect(byTestId(el, id), id).not.toBeNull();
    }
    expect(byTestId(el, 'kds-station-s-bar')?.getAttribute('value')).toBe('s-bar');
    expect(byTestId(el, 'kds-station-s-grill')?.getAttribute('value')).toBe('s-grill');
  });

  it('the all-day view and the empty board are states a spec can wait for', async () => {
    const el = await mount();
    el.mode = 'allday';
    await settle(el);
    expect(byTestId(el, 'kds-allday')?.tagName).toBe('TABLE');
    el.mode = 'tickets';
    el.station = 's-none-cooking';
    await settle(el);
    expect(byTestId(el, 'kds-empty')).not.toBeNull();
  });
});
