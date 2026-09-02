// The PASS on paper (kitchen#70): what goes out to the floor, printed when the ticket is bumped.
//
// `auto_print_tickets` shipped for months promising «paper when the order comes IN» — which is
// what station routing already does (ADR-0145, `print-comanda.ts` in the shell listens on
// `kitchen.order.created`) — and reached no code at all, so kitchen#48 retired it. The market
// prints on the OTHER end: five of the ten KDS reviewed on 2026-09-02 auto-print at the BUMP
// (Toast «Auto-print Fulfilled Tickets», Fresh KDS, Lightspeed K, MobiPOS «Print order list when
// bump», Square), because the sheet that matters there is the runner's — the summary of the plates
// leaving the pass.
//
// What this pins:
//   · one sheet per printer ROLE, never per station: two stations sharing the bar printer are one
//     sheet, not two (same rule the fire comanda already follows);
//   · a `display`-only station prints nothing — it has no printer, and the KDS already shows it;
//   · the `jobId` is stable for the (order, role) pair, so the same pass reaching three mounted
//     KDS screens is ONE job, not three sheets;
//   · the document type is `kitchen_order`, the CLOSED vocabulary the hub's queue and the device's
//     ESC/POS renderer both accept (`DocumentType::parse`, `_ => return None`). A prettier
//     `kitchen_pass` would cross the gate and print NOTHING, which is the failure inventory#44 paid
//     for once already;
//   · nothing here throws: a printer without paper cannot take the pass down with it.
import { describe, expect, it, vi } from 'vitest';
import { buildPassGroups, printPass, type PassItem, type PassPrintDeps } from './pass-print';

const MILLION = 1_000_000;

function item(over: Partial<PassItem> = {}): PassItem {
  return {
    product_name: 'Entrecot',
    quantity: MILLION,
    destination: 'both',
    printer_role: 'kitchen',
    notes: '',
    modifiers: '',
    combo_ref: null,
    combo_name: null,
    ...over,
  };
}

function deps(over: Partial<PassPrintDeps> = {}): PassPrintDeps & { calls: Record<string, unknown>[] } {
  const calls: Record<string, unknown>[] = [];
  return {
    calls,
    query: (async (name: string) => {
      if (name === 'kitchen.orders.items') return [item()];
      if (name === 'kitchen.orders.get') {
        return [{ id: 'o1', order_number: '20260902-0007', label: 'Mesa 4', round_number: 2, waiter_id: 'u1' }];
      }
      return [];
    }) as PassPrintDeps['query'],
    print: async (req: Record<string, unknown>) => {
      calls.push(req);
      return { via: 'queue' };
    },
    ...over,
  };
}

describe('the pass, grouped for paper', () => {
  it('puts the lines of two stations that share a printer on ONE sheet', () => {
    const groups = buildPassGroups([
      item({ product_name: 'Entrecot', printer_role: 'kitchen' }),
      item({ product_name: 'Flan', printer_role: 'bar' }),
      item({ product_name: 'Caña', printer_role: 'bar' }),
    ]);
    expect(groups.map((g) => g.role).sort()).toEqual(['bar', 'kitchen']);
    expect(groups.find((g) => g.role === 'bar')!.items).toHaveLength(2);
  });

  it('leaves out what is screen-only, and keeps a line nobody routed', () => {
    const groups = buildPassGroups([
      item({ product_name: 'Caña', destination: 'display', printer_role: 'bar' }),
      item({ product_name: 'Entrecot', destination: null, printer_role: null }),
    ]);
    // Control: the SAME line with a printer destination does come out, so this test can tell the
    // two apart instead of passing because `buildPassGroups` returns nothing.
    expect(buildPassGroups([item({ destination: 'display' })])).toHaveLength(0);
    expect(groups).toHaveLength(1);
    expect(groups[0].role, 'an unrouted plate still has to be cooked somewhere').toBe('kitchen');
    expect(groups[0].items[0].name).toBe('Entrecot');
  });

  it('speaks logical quantities, not the fixed-point 10⁶ of the row (ADR-0147)', () => {
    const [group] = buildPassGroups([item({ quantity: 500_000 })]);
    expect(group.items[0].quantity).toBe(0.5);
  });

  it('carries the modifiers and the menu the line belongs to, and omits what is empty', () => {
    const [group] = buildPassGroups([
      item({ modifiers: 'Sin cebolla', notes: 'Al punto', combo_ref: 'c1', combo_name: 'Menú del día' }),
      item({ product_name: 'Pan' }),
    ]);
    expect(group.items[0]).toMatchObject({
      modifiers: 'Sin cebolla',
      notes: 'Al punto',
      combo_ref: 'c1',
      combo_name: 'Menú del día',
    });
    expect(Object.keys(group.items[1]), 'empty keys change the sheet for every old device').toEqual([
      'name',
      'quantity',
    ]);
  });
});

describe('printing the pass', () => {
  it('queues one job per role, with the label and the number of the ticket', async () => {
    const d = deps({
      query: (async (name: string) => {
        if (name === 'kitchen.orders.items') {
          return [item({ printer_role: 'kitchen' }), item({ product_name: 'Caña', printer_role: 'bar' })];
        }
        return [{ order_number: '20260902-0007', label: 'Mesa 4', round_number: 2 }];
      }) as PassPrintDeps['query'],
    });
    const outcome = await printPass('o1', d);
    expect(outcome.ok).toBe(true);
    expect(outcome.sheets).toBe(2);
    expect(d.calls.map((c) => c.role).sort()).toEqual(['bar', 'kitchen']);
    expect(d.calls[0]).toMatchObject({
      documentType: 'kitchen_order',
      fallbackToBrowser: false,
      jobId: 'kitchen-pass-o1-kitchen',
    });
    expect(d.calls[0].data).toMatchObject({ receipt_id: '20260902-0007', label: 'Mesa 4', round_number: 2 });
  });

  it('gives the same bump the same job id, so three KDS screens are one sheet', async () => {
    const first = deps();
    const second = deps();
    await printPass('o1', first);
    await printPass('o1', second);
    expect(first.calls[0].jobId).toBe(second.calls[0].jobId);
  });

  it('names the waiter only when the board could resolve one', async () => {
    const withName = deps();
    await printPass('o1', withName, { resolveWaiter: () => 'Ana' });
    expect((withName.calls[0].data as Record<string, unknown>).waiter).toBe('Ana');

    const without = deps();
    await printPass('o1', without, { resolveWaiter: () => '' });
    expect(
      Object.keys(without.calls[0].data as Record<string, unknown>),
      'a blank waiter key changes the sheet of every device that never sent one',
    ).not.toContain('waiter');
  });

  it('prints nothing — and says so — when the whole ticket was screen-only', async () => {
    const d = deps({
      query: (async (name: string) =>
        name === 'kitchen.orders.items' ? [item({ destination: 'display' })] : [{}]) as PassPrintDeps['query'],
    });
    const outcome = await printPass('o1', d);
    expect(d.calls).toHaveLength(0);
    expect(outcome).toMatchObject({ ok: true, sheets: 0, reason: 'nothing_to_print' });
  });

  it('reports the role that has no printer instead of rerouting it elsewhere', async () => {
    const d = deps({ print: async () => ({ via: 'none', error: 'sin impresora' }) });
    const outcome = await printPass('o1', d);
    expect(outcome).toMatchObject({ ok: false, sheets: 0, reason: 'no_printer', detail: 'sin impresora' });
  });

  it('survives a printer that throws, and keeps the other sheets going', async () => {
    const seen: string[] = [];
    const d = deps({
      query: (async (name: string) => {
        if (name === 'kitchen.orders.items') {
          return [item({ printer_role: 'kitchen' }), item({ product_name: 'Caña', printer_role: 'bar' })];
        }
        return [{}];
      }) as PassPrintDeps['query'],
      print: async (req: Record<string, unknown>) => {
        seen.push(String(req.role));
        if (req.role === 'kitchen') throw new Error('printer offline');
        return { via: 'bridge' };
      },
    });
    const outcome = await printPass('o1', d);
    expect(seen.sort(), 'one dead printer must not swallow the other station').toEqual(['bar', 'kitchen']);
    expect(outcome).toMatchObject({ ok: false, sheets: 1, reason: 'threw' });
  });

  it('says no_gate — and never throws — where the shell bolted no print door on', async () => {
    const outcome = await printPass('o1', { query: vi.fn(async () => []) as PassPrintDeps['query'] });
    expect(outcome).toMatchObject({ ok: false, sheets: 0, reason: 'no_gate' });
  });

  it('does not print when the lines cannot be read', async () => {
    const d = deps({ query: (async () => Promise.reject(new Error('offline'))) as PassPrintDeps['query'] });
    const outcome = await printPass('o1', d);
    expect(d.calls).toHaveLength(0);
    expect(outcome).toMatchObject({ ok: false, reason: 'threw' });
  });
});
