// kitchen#76 — a round that is ALREADY on the line can be marked rush, and the kitchen finds out.
//
// Before: the only moment a round could be urgent was when it was fired (hub#1411). Once on the
// line, no screen offered the gesture — `kitchen.orders.update` accepted `priority` and nothing
// called it — and even a rush round sat where its fire time put it, behind older normal ones.
//
// What the market does (Toast «Rush», Fresh KDS «Prioritize», Square KDS priority): the gesture
// lives on the ticket in the KDS; a rushed ticket jumps to the FRONT of the board and every
// station hears it. Undoing it is the same button. This file pins those three things.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type Row = Record<string, unknown>;

let displayRows: Row[] = [];
let commands: Array<{ name: string; payload: Record<string, unknown> }> = [];
let listeners: Record<string, Array<(p: unknown) => void>> = {};
let allowed = true;
let started = 0;

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

const NOW = new Date('2026-09-26T12:00:00Z');
const minutesAgo = (m: number) => new Date(NOW.getTime() - m * 60_000).toISOString();

function round(orderId: string, firedMinutesAgo: number, priority = 'normal', status = 'preparing'): Row {
  return {
    order_id: orderId,
    order_number: `20260926-${orderId}`,
    order_status: status,
    order_type: 'dine_in',
    priority,
    label: `Mesa ${orderId}`,
    round_number: 1,
    order_notes: '',
    order_fired_at: minutesAgo(firedMinutesAgo),
    ready_at: null,
    order_created_at: minutesAgo(firedMinutesAgo),
    waiter_id: null,
    item_id: `i-${orderId}`,
    station_id: 's-grill',
    station_name: 'Plancha',
    destination: 'display',
    product_name: 'Hamburguesa',
    quantity: 1_000_000,
    modifiers: '',
    item_notes: '',
    item_status: status === 'ready' ? 'ready' : 'pending',
    seat_number: null,
    completed_at: null,
  };
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  started = 0;
  commands = [];
  listeners = {};
  allowed = true;
  // Oldest first, as the feed delivers them: k1 (20 min), k2 (10 min), k3 (2 min).
  displayRows = [round('k1', 20), round('k2', 10), round('k3', 2)];
  (globalThis as Record<string, unknown>).AudioContext = FakeContext;
  (globalThis as Record<string, unknown>).erplora = {
    query: async (name: string) => {
      if (name === 'kitchen.orders.display') return displayRows;
      if (name === 'kitchen.settings.get') return [{ show_timer: 1, warning_time_minutes: 15, critical_time_minutes: 30, color_coding_enabled: 1, sound_enabled: 1 }];
      return [];
    },
    queryPage: async () => ({ rows: [], total: 0, limit: 50, offset: 0 }),
    command: async (name: string, payload: Record<string, unknown>) => {
      commands.push({ name, payload });
      return {};
    },
    hasPermission: () => allowed,
    on: (event: string, cb: (p: unknown) => void) => {
      (listeners[event] ??= []).push(cb);
      return () => {};
    },
    locale: 'es',
    t: (_catalog: unknown, key: string) => key,
  };
});

afterEach(() => {
  vi.useRealTimers();
  delete (globalThis as Record<string, unknown>).AudioContext;
  document.body.innerHTML = '';
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

const order = (el: Host) => Array.from(el.shadowRoot.querySelectorAll<HTMLElement>('[data-order]')).map((c) => c.dataset.order);
const rushButton = (el: Host, id: string) => el.shadowRoot.querySelector<HTMLElement>(`[data-testid="kds-ticket-${id}-rush"]`);

/** Another screen (or this one) changed the round: the runtime pushes the event, the board reloads. */
async function updated(el: Host, rows: Row[]) {
  displayRows = rows;
  for (const cb of listeners['kitchen.order.updated'] ?? []) cb({ order_id: 'k3' });
  await settle(el);
}

describe('kitchen#76: marking a round rush after it was fired', () => {
  it('a cooking ticket offers «Mark rush», and tapping it writes priority=rush on THAT order', async () => {
    const el = await mount();
    const btn = rushButton(el, 'k3');
    expect(btn, 'no rush gesture on a round already on the line — the bug').not.toBeNull();
    expect(btn!.textContent?.trim()).toBe('ui.markRush');
    btn!.click();
    await settle(el);
    expect(commands).toEqual([{ name: 'kitchen.orders.update', payload: { order_id: 'k3', priority: 'rush' } }]);
  });

  it('a rush ticket offers the undo on the same button, writing priority=normal', async () => {
    displayRows = [round('k1', 20), round('k2', 10), round('k3', 2, 'rush')];
    const el = await mount();
    const btn = rushButton(el, 'k3');
    expect(btn!.textContent?.trim()).toBe('ui.clearRush');
    btn!.click();
    await settle(el);
    expect(commands).toEqual([{ name: 'kitchen.orders.update', payload: { order_id: 'k3', priority: 'normal' } }]);
  });

  it('a rush ticket jumps to the FRONT of the board; the rest keep oldest-first', async () => {
    displayRows = [round('k1', 20), round('k2', 10), round('k3', 2, 'rush')];
    const el = await mount();
    expect(order(el)).toEqual(['k3', 'k1', 'k2']);
  });

  it('without rush the board stays oldest-first (control)', async () => {
    const el = await mount();
    expect(order(el)).toEqual(['k1', 'k2', 'k3']);
  });

  it('two rush tickets keep their fire order between them', async () => {
    displayRows = [round('k1', 20), round('k2', 10, 'rush'), round('k3', 2, 'rush')];
    const el = await mount();
    expect(order(el)).toEqual(['k2', 'k3', 'k1']);
  });

  it('every board RINGS when a ticket it already had turns rush', async () => {
    const el = await mount();
    expect(started).toBe(0);
    await updated(el, [round('k1', 20), round('k2', 10), round('k3', 2, 'rush')]);
    expect(started, 'the round went rush and the kitchen heard nothing').toBeGreaterThan(0);
  });

  it('a reload where the rush ticket was ALREADY rush stays silent', async () => {
    displayRows = [round('k1', 20), round('k2', 10), round('k3', 2, 'rush')];
    const el = await mount();
    await updated(el, [round('k1', 20), round('k2', 10), round('k3', 2, 'rush')]);
    expect(started, 'every bump reloads the board; only the CHANGE to rush is news').toBe(0);
  });

  it('clearing rush does not ring', async () => {
    displayRows = [round('k1', 20), round('k2', 10), round('k3', 2, 'rush')];
    const el = await mount();
    await updated(el, [round('k1', 20), round('k2', 10), round('k3', 2)]);
    expect(started).toBe(0);
  });

  it('without `kitchen.change_order` there is no rush button (the runtime would refuse it)', async () => {
    allowed = false;
    const el = await mount();
    expect(rushButton(el, 'k3')).toBeNull();
  });

  it('a runner who may only SERVE gets no rush button, even on a card whose footer is painted', async () => {
    // `kitchen.complete_order` without `kitchen.change_order`: the footer is there (for «Served»)
    // and the ticket still has a line cooking (a recalled line on a ready ticket).
    const perms = (globalThis as { erplora: { hasPermission: (p: string) => boolean } }).erplora;
    perms.hasPermission = (p: string) => p === 'kitchen.complete_order';
    displayRows = [{ ...round('k9', 5, 'normal', 'ready'), item_status: 'pending' }];
    const el = await mount();
    (el as unknown as { mode: string }).mode = 'ready';
    await settle(el);
    expect(el.shadowRoot.querySelector('[data-testid="kds-ticket-k9-served"]'), 'control: the footer is painted').not.toBeNull();
    expect(rushButton(el, 'k9')).toBeNull();
  });

  it('a READY ticket offers no rush — it has left the line', async () => {
    displayRows = [round('k1', 20), round('k9', 5, 'normal', 'ready')];
    const el = await mount();
    (el as unknown as { mode: string }).mode = 'ready';
    await settle(el);
    expect(el.shadowRoot.querySelector('[data-order="k9"]'), 'control: the ready ticket is on screen').not.toBeNull();
    expect(rushButton(el, 'k9')).toBeNull();
  });
});
