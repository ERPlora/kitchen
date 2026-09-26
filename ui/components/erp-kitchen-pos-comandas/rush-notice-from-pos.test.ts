// kitchen#100 · marking a round RUSH from the POS puts the URGENT notice on the kitchen's paper.
//
// A kitchen that works on paper only (no KDS screen open) never heard about a rush set from the
// table's «Comandas» sheet (kitchen#94): the round turned rush in the database and nobody at the
// pass knew. The POS now prints the same short chit the KDS prints (kitchen#93, `printRushNotice`)
// — same document, same `jobId` per (round, printer role) — so a kitchen with a screen open too
// still gets ONE sheet: the queue drops the second request as a repeat.
//
//   · Only when the round turns rush, and only after the command succeeded.
//   · Removing the rush prints nothing: the pressure coming off a ticket is not news.
//   · A printer that is missing is SAID on the sheet; a shell with no print door says nothing.
//   · kitchen#99 · the `jobId` carries the round's `rush_count` (bumped by `kitchen.orders.update`
//     on every transition TO rush), so a round marked, cleared and marked again prints its second
//     notice — and a KDS asking for that same second rush still adds no sheet.
import { beforeEach, describe, expect, it } from 'vitest';
import { printRushNotice, type PassPrintDeps } from '../../lib/pass-print';

type Row = Record<string, unknown>;

let comandasStub: Row[];
let commands: Array<{ name: string; params: Row }>;
let prints: Row[];
let failNext: unknown;
let printVia: string;
/** The hub's print queue deduplicates by `jobId`: a repeat is accepted and prints nothing. */
let queued: Set<string>;
/** `kitchen_order.rush_count` as `commands/order_update.sql` keeps it: +1 on every turn TO rush. */
let rushCount: Record<string, number>;

const settle = async (el: Element) => {
  for (let i = 0; i < 4; i++) {
    await new Promise((r) => setTimeout(r, 0));
    await (el as unknown as { updateComplete: Promise<unknown> }).updateComplete;
  }
};

const ITEMS: Record<string, Row[]> = {
  k2: [
    { product_name: 'Entrecot', quantity: 1_000_000, printer_role: 'kitchen', destination: 'both', status: 'preparing' },
    { product_name: 'Caña', quantity: 1_000_000, printer_role: 'bar', destination: 'printer', status: 'pending' },
  ],
  k3: [{ product_name: 'Ensalada', quantity: 1_000_000, printer_role: 'kitchen', destination: 'both', status: 'pending' }],
};

const print = async (req: Row) => {
  prints.push(req);
  if (printVia === 'queue') queued.add(String(req.jobId));
  return { via: printVia, ...(printVia === 'none' ? { error: 'no printer with that role' } : {}) };
};

const query = async (name: string, params?: Row) => {
  const id = String(params?.order_id ?? '');
  if (name === 'kitchen.orders.items') return (ITEMS[id] ?? []).map((i) => ({ ...i }));
  if (name === 'kitchen.orders.get') {
    return [{ id, order_number: `T-${id}`, label: 'Mesa 4', round_number: 2, rush_count: rushCount[id] ?? 0 }];
  }
  return [];
};

beforeEach(() => {
  commands = [];
  prints = [];
  failNext = undefined;
  printVia = 'queue';
  queued = new Set();
  rushCount = { k3: 1 };
  comandasStub = [
    { id: 'k3', round_number: 3, status: 'pending', priority: 'rush', fired_at: '2026-09-26T20:40:00+00:00' },
    { id: 'k2', round_number: 2, status: 'preparing', priority: 'normal', fired_at: '2026-09-26T20:37:00+00:00' },
  ];
  (globalThis as Record<string, unknown>).erplora = {
    locale: 'es',
    t: (_catalog: unknown, key: string) => key,
    hasPermission: () => true,
    queryAll: async (name: string, params?: Row) => {
      if (name === 'kitchen.orders.list'
        && (params?.filters as Row | undefined)?.source_order_id === 'o1') return comandasStub.map((c) => ({ ...c }));
      return [];
    },
    query,
    print,
    command: async (name: string, params: Row) => {
      commands.push({ name, params });
      if (failNext) {
        const e = failNext;
        failNext = undefined;
        throw e;
      }
      if (name === 'kitchen.orders.update') {
        const id = String(params.order_id);
        const before = comandasStub.find((c) => c.id === id)?.priority;
        if (params.priority === 'rush' && before !== 'rush') rushCount[id] = (rushCount[id] ?? 0) + 1;
        comandasStub = comandasStub.map((c) => (c.id === params.order_id ? { ...c, priority: params.priority } : c));
      }
      return { ok: true };
    },
    on: () => () => undefined,
  };
});

async function openSheet() {
  await import('./erp-kitchen-pos-comandas');
  const el = document.createElement('erp-kitchen-pos-comandas');
  document.body.appendChild(el);
  await settle(el);
  el.dispatchEvent(new CustomEvent('erp:pos-state', { detail: { order_id: 'o1', items_count: 1, pending_count: 0 } }));
  await settle(el);
  (el.shadowRoot!.querySelector('[data-testid="kitchen-comandas-open"]') as HTMLElement).click();
  await settle(el);
  return el;
}

const tapRush = async (el: Element, id: string) => {
  (el.shadowRoot!.querySelector(`[data-testid="kitchen-comandas-rush-${id}"]`) as HTMLElement).click();
  await settle(el);
};

const warning = (el: Element) => el.shadowRoot!.querySelector('[data-testid="kitchen-comandas-rush-notice-warning"]');

describe('kitchen#100 · rush from the POS prints the URGENT notice in the kitchen', () => {
  it('marking a round rush prints one URGENT chit per station still cooking it, after the command', async () => {
    const el = await openSheet();
    await tapRush(el, 'k2');

    expect(commands).toEqual([{ name: 'kitchen.orders.update', params: { order_id: 'k2', priority: 'rush' } }]);
    expect(prints.map((p) => [p.role, p.documentType, p.jobId, p.fallbackToBrowser])).toEqual([
      ['kitchen', 'kitchen_order', 'kitchen-rush-k2-kitchen-1', false],
      ['bar', 'kitchen_order', 'kitchen-rush-k2-bar-1', false],
    ]);
    expect(prints[0].data, 'the short chit: flagged HIGH, no lines to cook twice').toMatchObject({
      receipt_id: 'T-k2', label: 'Mesa 4', priority: 'HIGH', items: [],
    });
    expect(warning(el), 'everything printed: no warning').toBeNull();
  });

  it('with a kitchen screen open too, the rush still makes ONE sheet per station (same job as the KDS)', async () => {
    const el = await openSheet();
    await tapRush(el, 'k2');
    // The KDS sees the same ticket escalate and asks for its own notice (kitchen#93).
    const kdsDeps: PassPrintDeps = { query: query as PassPrintDeps['query'], print };
    await printRushNotice('k2', kdsDeps);

    expect(prints, 'both asked').toHaveLength(4);
    expect(queued, 'the queue keeps one job per (round, station)').toEqual(new Set(['kitchen-rush-k2-kitchen-1', 'kitchen-rush-k2-bar-1']));
  });

  it('kitchen#99 · marked, cleared and marked AGAIN: the second rush is a new sheet per station', async () => {
    const el = await openSheet();
    await tapRush(el, 'k2'); // mark
    await tapRush(el, 'k2'); // clear
    await tapRush(el, 'k2'); // mark again

    expect(commands.map((c) => c.params.priority)).toEqual(['rush', 'normal', 'rush']);
    expect(queued, 'two rushes, two sheets per station').toEqual(
      new Set(['kitchen-rush-k2-kitchen-1', 'kitchen-rush-k2-bar-1', 'kitchen-rush-k2-kitchen-2', 'kitchen-rush-k2-bar-2']),
    );
    expect(warning(el)).toBeNull();

    // The KDS sees the same second escalation and asks for its notice: still one sheet per station.
    await printRushNotice('k2', { query: query as PassPrintDeps['query'], print });
    expect(queued.size, 'the KDS asking for the same rush adds no sheet').toBe(4);
  });

  it('removing the rush prints nothing', async () => {
    const el = await openSheet();
    await tapRush(el, 'k3');

    expect(commands).toEqual([{ name: 'kitchen.orders.update', params: { order_id: 'k3', priority: 'normal' } }]);
    expect(prints).toEqual([]);
  });

  it('a refused command prints nothing: the round did not turn rush', async () => {
    failNext = Object.assign(new Error('boom'), { code: 'kitchen.invalid_transition' });
    const el = await openSheet();
    await tapRush(el, 'k2');

    expect(prints).toEqual([]);
    expect(warning(el)).toBeNull();
  });

  it('a station with no printer is SAID on the sheet, and the round stays rush', async () => {
    printVia = 'none';
    const el = await openSheet();
    await tapRush(el, 'k2');

    const w = warning(el);
    expect(w, 'the waiter is told the kitchen did not get the paper').toBeTruthy();
    expect(w!.textContent).toContain('ui.rushNoticeFailed');
    expect(el.shadowRoot!.querySelector('[data-testid="kitchen-comandas-rush-k2"]')!.textContent).toContain('ui.clearRush');
  });

  it('the warning goes away once a later rush notice does print', async () => {
    printVia = 'none';
    const el = await openSheet();
    await tapRush(el, 'k2');
    expect(warning(el)).toBeTruthy();

    printVia = 'queue';
    await tapRush(el, 'k2'); // remove
    await tapRush(el, 'k2'); // mark again
    expect(warning(el)).toBeNull();
  });

  it('a shell with no print door marks the rush and shows no warning', async () => {
    delete ((globalThis as Record<string, unknown>).erplora as Row).print;
    const el = await openSheet();
    await tapRush(el, 'k2');

    expect(commands).toHaveLength(1);
    expect(warning(el)).toBeNull();
  });
});
