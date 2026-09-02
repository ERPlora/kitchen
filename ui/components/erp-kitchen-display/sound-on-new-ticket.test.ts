// «Sonido» rings the KDS when a ticket lands (kitchen#48).
//
// The setting shipped for months and reached no code: the manager turned it on so the line would
// hear the tickets come in, walked away, and nothing ever beeped. This is the test that makes the
// switch move something, and the one that fails if it ever stops.
//
// The rules are the market's (Toast, Square, Fresh, Simphony, Loyverse, Eats365, MobiPOS — seven of
// ten ring on a new ticket, all with ONE switch):
//   · it rings when a ticket ARRIVES, not when the board is opened — a KDS opened on a busy pass
//     would otherwise greet the cook with a beep for a service already under way;
//   · `sound_enabled = 0` is silent, and the SAME scenario with 1 rings (the control that proves
//     this test can tell the two apart);
//   · a reload that brings no new ticket is silent — the board reloads on every bump.
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

type Row = Record<string, unknown>;

let displayRows: Row[] = [];
let settings: Row = {};
let listeners: Record<string, Array<(p: unknown) => void>> = {};
let started = 0;

/** A Web Audio stub that only counts what the kitchen cares about: did anything sound? */
class FakeContext {
  state = 'running';

  currentTime = 0;

  destination = {};

  async resume() {
    this.state = 'running';
  }

  createGain() {
    return { gain: { value: 0, setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn() }, connect: vi.fn() };
  }

  createOscillator() {
    return {
      type: 'sine',
      frequency: { value: 0, setValueAtTime: vi.fn() },
      connect: vi.fn(),
      start: () => {
        started += 1;
      },
      stop: vi.fn(),
    };
  }
}

const NOW = new Date('2026-09-02T12:00:00Z');
const minutesAgo = (m: number) => new Date(NOW.getTime() - m * 60_000).toISOString();

function ticket(orderId: string, itemId: string): Row {
  return {
    order_id: orderId,
    order_number: `2026090 2-${orderId}`,
    order_status: 'pending',
    order_type: 'dine_in',
    priority: 'normal',
    label: 'Mesa 4',
    round_number: 1,
    order_notes: '',
    order_fired_at: minutesAgo(1),
    ready_at: null,
    order_created_at: minutesAgo(1),
    waiter_id: null,
    item_id: itemId,
    station_id: 's-bar',
    station_name: 'Bar',
    destination: 'display',
    product_name: 'Caña',
    quantity: 1_000_000,
    modifiers: '',
    item_notes: '',
    item_status: 'pending',
    seat_number: null,
    completed_at: null,
  };
}

beforeEach(() => {
  started = 0;
  listeners = {};
  displayRows = [ticket('k1', 'i1')];
  settings = { show_timer: 1, warning_time_minutes: 15, critical_time_minutes: 30, color_coding_enabled: 1, sound_enabled: 1 };
  (globalThis as Record<string, unknown>).AudioContext = FakeContext;
  (globalThis as Record<string, unknown>).erplora = {
    query: async (name: string) => {
      if (name === 'kitchen.orders.display') return displayRows;
      if (name === 'kitchen.settings.get') return [settings];
      return [];
    },
    queryPage: async () => ({ rows: [], total: 0, limit: 50, offset: 0 }),
    command: async () => ({}),
    hasPermission: () => true,
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
});

type Host = HTMLElement & { updateComplete: Promise<unknown>; shadowRoot: ShadowRoot };

async function settle(el: Host) {
  for (let i = 0; i < 5; i++) {
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

/** A ticket lands: the runtime pushes the event and the board reloads (never polling). */
async function ticketArrives(el: Host, rows: Row[]) {
  displayRows = rows;
  for (const cb of listeners['kitchen.order.created'] ?? []) cb({});
  await settle(el);
}

describe('the KDS rings when a ticket arrives (kitchen#48)', () => {
  it('does NOT ring for the tickets already on the board when it opens', async () => {
    await mount();
    expect(started, 'opening a busy pass must not sound like a new order').toBe(0);
  });

  it('rings when a ticket the board had not seen arrives', async () => {
    const el = await mount();
    await ticketArrives(el, [ticket('k1', 'i1'), ticket('k2', 'i2')]);
    expect(started, 'the new ticket did not ring').toBeGreaterThan(0);
  });

  it('stays silent with `sound_enabled` off — same arrival that rings above', async () => {
    settings = { ...settings, sound_enabled: 0 };
    const el = await mount();
    await ticketArrives(el, [ticket('k1', 'i1'), ticket('k2', 'i2')]);
    expect(started, 'the switch is off and the KDS rang anyway').toBe(0);
  });

  it('stays silent on a reload that brings no new ticket', async () => {
    const el = await mount();
    await ticketArrives(el, [ticket('k1', 'i1')]);
    expect(started, 'every bump reloads the board; only an ARRIVAL is an arrival').toBe(0);
  });

  it('rings once per reload, not once per line of the ticket', async () => {
    const el = await mount();
    await ticketArrives(el, [ticket('k1', 'i1'), ticket('k2', 'i2'), ticket('k2', 'i3'), ticket('k3', 'i4')]);
    // The chime is two tones; two tickets arriving together must still be ONE chime.
    expect(started).toBe(2);
  });
});
