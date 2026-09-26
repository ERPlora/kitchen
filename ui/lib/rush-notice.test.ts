// kitchen#93 — marking a round rush once it is already on the line has to reach a kitchen that
// works with PAPER, not only the screens.
//
// kitchen#76 made the gesture: the round jumps to the front of the board and every screen rings.
// A kitchen whose station prints its comanda (destination `printer` or `both`) was left with the
// sheet on the rail saying what it said at fire time. The market prints a short RUSH chit for that
// moment and never the whole comanda again: a second copy of the same round on the rail is how a
// plate gets cooked twice (the reason the issue itself gives against a full reprint).
//
// What this pins:
//   · ONE short notice per printer ROLE still cooking something of that round — `items: []`, so no
//     plate is repeated, and `priority: 'HIGH'`, the flag the device's ESC/POS renderer already
//     turns into «!! URGENTE !!» under the kitchen header (hub `render_kitchen_order`);
//   · the document type stays `kitchen_order`, the CLOSED vocabulary every deployed device
//     renders — a new name would cross the gate and print nothing (inventory#44);
//   · screen-only lines, and lines that already left the pass, print nothing;
//   · the `jobId` is stable per (order, role) and distinct from the comanda's and the pass's, so
//     three mounted boards are one sheet and the queue does not drop it as a repeat of either;
//   · nothing throws: the rush is already in the database, paper is the copy.
import { describe, expect, it } from 'vitest';
import { printRushNotice, type PassItem, type PassPrintDeps } from './pass-print';

const MILLION = 1_000_000;

function item(over: Partial<PassItem> & { status?: string } = {}): PassItem & { status?: string } {
  return {
    product_name: 'Entrecot',
    quantity: MILLION,
    destination: 'printer',
    printer_role: 'kitchen',
    notes: '',
    modifiers: '',
    combo_ref: null,
    combo_name: null,
    status: 'pending',
    ...over,
  };
}

function deps(items: Array<PassItem & { status?: string }>, over: Partial<PassPrintDeps> = {}) {
  const calls: Record<string, unknown>[] = [];
  const d: PassPrintDeps = {
    query: (async (name: string) => {
      if (name === 'kitchen.orders.items') return items;
      if (name === 'kitchen.orders.get') {
        return [{ id: 'o1', order_number: '20260926-0003', label: 'Mesa 4', round_number: 2, waiter_id: 'u1' }];
      }
      return [];
    }) as PassPrintDeps['query'],
    print: async (req: Record<string, unknown>) => {
      calls.push(req);
      return { via: 'queue' };
    },
    ...over,
  };
  return { d, calls };
}

describe('kitchen#93: the rush notice on paper', () => {
  it('queues one SHORT notice per printer role: no plates, flagged HIGH, with the table and number', async () => {
    const { d, calls } = deps([
      item({ product_name: 'Entrecot', printer_role: 'kitchen' }),
      item({ product_name: 'Chuletón', printer_role: 'kitchen' }),
      item({ product_name: 'Caña', printer_role: 'bar', destination: 'both' }),
    ]);
    const outcome = await printRushNotice('o1', d, { resolveWaiter: (id) => (id === 'u1' ? 'Ana' : '') });
    expect(outcome).toEqual({ ok: true, sheets: 2 });
    expect(calls.map((c) => c.role).sort()).toEqual(['bar', 'kitchen']);
    const kitchen = calls.find((c) => c.role === 'kitchen')!;
    expect(kitchen).toMatchObject({
      documentType: 'kitchen_order',
      fallbackToBrowser: false,
      jobId: 'kitchen-rush-o1-kitchen',
    });
    expect(kitchen.data).toEqual({
      receipt_id: '20260926-0003',
      label: 'Mesa 4',
      round_number: 2,
      waiter: 'Ana',
      priority: 'HIGH',
      items: [],
    });
  });

  it('never shares a job id with the fire comanda or the pass of the same order', async () => {
    const { d, calls } = deps([item()]);
    await printRushNotice('o1', d);
    const id = String(calls[0].jobId);
    expect(id).not.toBe('kitchen-o1-kitchen');
    expect(id).not.toBe('kitchen-pass-o1-kitchen');
  });

  it('prints nothing for a screen-only station — the board already shows the rush', async () => {
    const { d, calls } = deps([item({ destination: 'display', printer_role: 'bar' })]);
    // Control: the same line routed to a printer does print, so the empty result below is the
    // filter and not a function that never prints.
    const control = deps([item({ destination: 'printer', printer_role: 'bar' })]);
    await printRushNotice('o1', control.d);
    expect(control.calls).toHaveLength(1);

    expect(await printRushNotice('o1', d)).toEqual({ ok: true, sheets: 0, reason: 'nothing_to_print' });
    expect(calls).toHaveLength(0);
  });

  it('skips a role whose lines already left the pass — there is nothing there left to hurry', async () => {
    const { d, calls } = deps([
      item({ printer_role: 'bar', status: 'ready' }),
      item({ printer_role: 'bar', status: 'served' }),
      item({ printer_role: 'dessert', status: 'cancelled' }),
      item({ printer_role: 'kitchen', status: 'preparing' }),
    ]);
    await printRushNotice('o1', d);
    expect(calls.map((c) => c.role)).toEqual(['kitchen']);
  });

  it('reports the role with no printer, and keeps the other sheets going when one throws', async () => {
    const { d, calls } = deps([item({ printer_role: 'kitchen' }), item({ printer_role: 'bar' }), item({ printer_role: 'grill' })], {
      print: async (req: Record<string, unknown>) => {
        if (req.role === 'kitchen') throw new Error('out of paper');
        if (req.role === 'bar') return { via: 'none', error: 'no printer with role bar' };
        calls.push(req);
        return { via: 'queue' };
      },
    });
    const outcome = await printRushNotice('o1', d);
    expect(outcome.ok).toBe(false);
    expect(outcome.sheets).toBe(1);
    expect(calls.map((c) => c.role)).toEqual(['grill']);
  });

  it('says no_gate — and never throws — where the shell bolted no print door on', async () => {
    const { d } = deps([item()]);
    expect(await printRushNotice('o1', { query: d.query })).toEqual({ ok: false, sheets: 0, reason: 'no_gate' });
  });

  it('does not print when the lines cannot be read', async () => {
    const calls: unknown[] = [];
    const outcome = await printRushNotice('o1', {
      query: async () => {
        throw new Error('db down');
      },
      print: async (req) => {
        calls.push(req);
        return { via: 'queue' };
      },
    });
    expect(outcome).toMatchObject({ ok: false, sheets: 0, reason: 'threw' });
    expect(calls).toHaveLength(0);
  });
});
