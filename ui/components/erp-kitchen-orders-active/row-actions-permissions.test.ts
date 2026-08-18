// Row actions of the orders table follow the per-action permission model (kitchen#5).
//
// The manifest gates each verb with its own permission and command: fire / mark_ready / recall are
// `kitchen.change_order` → `kitchen.orders.set_status`; served is `kitchen.complete_order` →
// `kitchen.orders.mark_served`; cancel is `kitchen.cancel_order` → `kitchen.orders.cancel`. The
// table must (a) call the command that owns the verb and (b) not offer a verb the user cannot run —
// a cook seeing a Cancel button that always fails is the KDS equivalent of a dead key.
import { beforeEach, describe, expect, it } from 'vitest';

const calls: { name: string; payload: Record<string, unknown> }[] = [];
let granted: Set<string>;

beforeEach(() => {
  calls.length = 0;
  granted = new Set(['kitchen.change_order', 'kitchen.complete_order', 'kitchen.cancel_order']);
  (globalThis as Record<string, unknown>).erplora = {
    query: async () => [],
    queryPage: async () => ({ rows: [], total: 0, limit: 50, offset: 0 }),
    command: async (name: string, payload: Record<string, unknown>) => {
      calls.push({ name, payload });
      return {};
    },
    hasPermission: (p: string) => granted.has(p),
    on: () => () => {},
    locale: 'en',
    t: (_catalog: unknown, key: string) => key,
    formatMoney: (cents: number) => `${((cents || 0) / 100).toFixed(2)} €`,
  };
});

type Host = HTMLElement & {
  updateComplete: Promise<unknown>;
  rowActions: { id: string }[];
  onRowAction(ev: CustomEvent<{ actionId: string; row: Record<string, unknown> }>): Promise<void>;
};

async function mount(): Promise<Host> {
  await import('./erp-kitchen-orders-active');
  const el = document.createElement('erp-kitchen-orders-active') as Host;
  document.body.appendChild(el);
  await el.updateComplete;
  await new Promise((r) => setTimeout(r, 0));
  await el.updateComplete;
  return el;
}

const act = (el: Host, actionId: string) =>
  el.onRowAction(new CustomEvent('rowAction', { detail: { actionId, row: { id: 'k1', status: 'pending' } } }));

describe('each verb calls the command that owns its permission', () => {
  it('fire / mark_ready / recall go through kitchen.orders.set_status', async () => {
    const el = await mount();
    for (const verb of ['fire', 'mark_ready', 'recall']) {
      await act(el, verb);
    }
    expect(calls.map((c) => c.name)).toEqual(['kitchen.orders.set_status', 'kitchen.orders.set_status', 'kitchen.orders.set_status']);
    expect(calls.map((c) => c.payload.action_name)).toEqual(['fire', 'mark_ready', 'recall']);
  });

  it('mark_served goes through kitchen.orders.mark_served', async () => {
    const el = await mount();
    await act(el, 'mark_served');
    expect(calls).toEqual([{ name: 'kitchen.orders.mark_served', payload: { order_id: 'k1' } }]);
  });

  it('cancel goes through kitchen.orders.cancel', async () => {
    const el = await mount();
    await act(el, 'cancel');
    expect(calls).toEqual([{ name: 'kitchen.orders.cancel', payload: { order_id: 'k1' } }]);
  });
});

describe('a verb the user cannot run is not offered', () => {
  it('a cook (change_order + complete_order, no cancel_order) sees no Cancel', async () => {
    granted = new Set(['kitchen.change_order', 'kitchen.complete_order']);
    const el = await mount();
    const ids = el.rowActions.map((a) => a.id);
    expect(ids).toEqual(['fire', 'mark_ready', 'mark_served', 'recall']);
  });

  it('a read-only viewer sees no actions at all', async () => {
    granted = new Set();
    const el = await mount();
    expect(el.rowActions).toEqual([]);
  });

  it('without hasPermission on the SDK, everything is offered (the runtime still gates)', async () => {
    delete (globalThis as { erplora?: { hasPermission?: unknown } }).erplora!.hasPermission;
    const el = await mount();
    expect(el.rowActions.map((a) => a.id)).toEqual(['fire', 'mark_ready', 'mark_served', 'recall', 'cancel']);
  });
});
