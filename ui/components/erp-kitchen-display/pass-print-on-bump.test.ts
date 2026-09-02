// The KDS prints the PASS when a ticket is bumped (kitchen#70) — and rings it the way the hub asked
// (kitchen#72).
//
// `auto_print_tickets` was published for months and reached no code, so kitchen#48 retired it. It
// comes back here with a reader and the meaning the market gives it: five of the ten KDS reviewed
// on 2026-09-02 auto-print at the BUMP (Toast «Auto-print Fulfilled Tickets», Fresh KDS, Lightspeed
// K, MobiPOS, Square), not at arrival — arrival is what station routing already prints.
//
// What this pins, and each one with its positive control (a test that passes because nothing
// happens is the failure this whole family of guards exists to catch):
//   · the ticket going `ready` queues the pass, and the SAME event with the switch off queues
//     nothing;
//   · the sheet carries the waiter the board already resolved — no second query for a name;
//   · the volume and the tone of `kitchen_settings` reach the chime, so two hubs with two volumes
//     ring at two gains.
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

type Row = Record<string, unknown>;

let displayRows: Row[] = [];
let itemRows: Row[] = [];
let orderRows: Row[] = [];
let userRows: Row[] = [];
let settings: Row = {};
let listeners: Record<string, Array<(p: unknown) => void>> = {};
let printed: Record<string, unknown>[] = [];
/** Every gain peak the chime ramped to, so «it rang louder» is measurable and not assumed. */
let peaks: number[] = [];
let waves: string[] = [];

class FakeContext {
  state = 'running';

  currentTime = 0;

  destination = {};

  async resume() {
    this.state = 'running';
  }

  createGain() {
    return {
      gain: {
        value: 0,
        setValueAtTime: vi.fn(),
        linearRampToValueAtTime: (v: number) => {
          if (v > 0.001) peaks.push(v);
        },
      },
      connect: vi.fn(),
    };
  }

  createOscillator() {
    return {
      set type(wave: string) {
        waves.push(wave);
      },
      get type() {
        return waves[waves.length - 1] ?? '';
      },
      frequency: { value: 0, setValueAtTime: vi.fn() },
      connect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
    };
  }
}

const NOW = new Date('2026-09-02T12:00:00Z');
const minutesAgo = (m: number) => new Date(NOW.getTime() - m * 60_000).toISOString();

function ticket(orderId: string, itemId: string, over: Row = {}): Row {
  return {
    order_id: orderId,
    order_number: `20260902-${orderId}`,
    order_status: 'pending',
    order_type: 'dine_in',
    priority: 'normal',
    label: 'Mesa 4',
    round_number: 1,
    order_notes: '',
    order_fired_at: minutesAgo(1),
    ready_at: null,
    order_created_at: minutesAgo(1),
    waiter_id: 'u1',
    item_id: itemId,
    station_id: 's-grill',
    station_name: 'Plancha',
    destination: 'both',
    product_name: 'Entrecot',
    quantity: 1_000_000,
    modifiers: '',
    item_notes: '',
    item_status: 'pending',
    seat_number: null,
    completed_at: null,
    ...over,
  };
}

beforeEach(() => {
  listeners = {};
  printed = [];
  peaks = [];
  waves = [];
  displayRows = [ticket('k1', 'i1')];
  itemRows = [
    {
      id: 'i1',
      order_id: 'k1',
      product_name: 'Entrecot',
      quantity: 1_000_000,
      destination: 'both',
      printer_role: 'kitchen',
      modifiers: '',
      notes: '',
    },
  ];
  orderRows = [{ id: 'k1', order_number: '20260902-k1', label: 'Mesa 4', round_number: 1, waiter_id: 'u1' }];
  userRows = [{ id: 'u1', name: 'Ana' }];
  settings = {
    show_timer: 1,
    warning_time_minutes: 15,
    critical_time_minutes: 30,
    color_coding_enabled: 1,
    sound_enabled: 1,
    sound_volume: 70,
    sound_tone: 'chime',
    auto_print_tickets: 1,
  };
  (globalThis as Record<string, unknown>).AudioContext = FakeContext;
  (globalThis as Record<string, unknown>).erplora = {
    query: async (name: string) => {
      if (name === 'kitchen.orders.display') return displayRows;
      if (name === 'kitchen.settings.get') return [settings];
      if (name === 'kitchen.orders.items') return itemRows;
      if (name === 'kitchen.orders.get') return orderRows;
      if (name === 'hub.users.list') return userRows;
      return [];
    },
    queryPage: async () => ({ rows: [], total: 0, limit: 50, offset: 0 }),
    command: async () => ({}),
    hasPermission: () => true,
    print: async (req: Record<string, unknown>) => {
      printed.push(req);
      return { via: 'queue' };
    },
    on: (event: string, cb: (p: unknown) => void) => {
      (listeners[event] ??= []).push(cb);
      return () => {};
    },
    locale: 'es',
    t: (_catalog: unknown, key: string) => key,
    formatMoney: (cents: number) => `${((cents || 0) / 100).toFixed(2)} €`,
  };
});

afterEach(() => {
  delete (globalThis as Record<string, unknown>).AudioContext;
  delete (globalThis as Record<string, unknown>).erplora;
});

type Host = HTMLElement & { updateComplete: Promise<unknown>; shadowRoot: ShadowRoot };

async function settle(el: Host) {
  for (let i = 0; i < 6; i++) {
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

/** The bump lands: the runtime pushes `kitchen.order.ready` and every mounted board hears it. */
async function ticketGoesReady(el: Host, orderId = 'k1') {
  displayRows = [ticket(orderId, 'i1', { order_status: 'ready', item_status: 'ready' })];
  for (const cb of listeners['kitchen.order.ready'] ?? []) cb({ order_id: orderId });
  await settle(el);
}

describe('the pass goes to paper when the ticket is bumped (kitchen#70)', () => {
  it('queues one job for the printer role of the lines', async () => {
    const el = await mount();
    await ticketGoesReady(el);
    expect(printed, 'the ticket went ready and no pass was queued').toHaveLength(1);
    expect(printed[0]).toMatchObject({
      role: 'kitchen',
      documentType: 'kitchen_order',
      jobId: 'kitchen-pass-k1-kitchen',
      fallbackToBrowser: false,
    });
    expect((printed[0].data as Row).label).toBe('Mesa 4');
  });

  it('queues NOTHING with the switch off — the very same bump that prints above', async () => {
    settings = { ...settings, auto_print_tickets: 0 };
    const el = await mount();
    await ticketGoesReady(el);
    expect(printed, 'a switch that prints while it is off is worse than no switch').toHaveLength(0);
  });

  it('names the waiter the board already resolved, without asking again', async () => {
    const el = await mount();
    await ticketGoesReady(el);
    expect((printed[0].data as Row).waiter, 'cooks call the waiter of the round, not a UUID').toBe('Ana');
  });

  it('does not print when the bumped ticket carries no order id', async () => {
    const el = await mount();
    for (const cb of listeners['kitchen.order.ready'] ?? []) cb({});
    await settle(el);
    expect(printed).toHaveLength(0);
  });

  it('keeps the board alive when the print door is missing altogether', async () => {
    delete (globalThis as Record<string, unknown> & { erplora: Record<string, unknown> }).erplora.print;
    const el = await mount();
    await ticketGoesReady(el);
    expect(printed).toHaveLength(0);
    expect(el.shadowRoot.querySelector('ion-segment'), 'a missing printer must not blank the pass').toBeTruthy();
  });
});

describe('the chime obeys the volume and the tone of the hub (kitchen#72)', () => {
  async function ticketArrives(el: Host) {
    displayRows = [ticket('k1', 'i1'), ticket('k2', 'i2')];
    for (const cb of listeners['kitchen.order.created'] ?? []) cb({});
    await settle(el);
  }

  it('rings at the gain the hub saved, and a louder hub rings louder', async () => {
    const el = await mount();
    await ticketArrives(el);
    const quiet = peaks[0];
    expect(quiet, 'the arrival did not ring at all').toBeGreaterThan(0);

    // A second board, on a hub that turned the volume up. The first one is unmounted and the feed
    // put back to one ticket, so what is measured is ONE arrival on ONE screen.
    el.remove();
    peaks = [];
    displayRows = [ticket('k1', 'i1')];
    settings = { ...settings, sound_volume: 100 };
    const loud = await mount();
    await ticketArrives(loud);
    expect(peaks[0], 'the volume control moved nothing').toBeGreaterThan(quiet);
  });

  it('rings the waveform of the tone the hub chose', async () => {
    settings = { ...settings, sound_tone: 'buzzer' };
    const el = await mount();
    await ticketArrives(el);
    expect(waves, 'the tone control moved nothing').toContain('square');
    expect(waves).not.toContain('sine');
  });
});
