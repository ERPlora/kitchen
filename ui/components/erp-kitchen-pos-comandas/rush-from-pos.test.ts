// kitchen#94 · the waiter marks a round RUSH from the table's «Comandas» sheet in the POS.
//
// Table 4 tells the waiter they are in a hurry. Before this, the sheet only READ the rounds and
// the waiter had to walk to the kitchen screen to hurry one. Now every round still on the line
// offers the same gesture the KDS card has (kitchen#76): «Mark rush» / «Remove rush», the same
// command (`kitchen.orders.update {priority}`) and the same permission (`kitchen.change_order`).
//
//   · Only rounds still cooking (`pending`/`preparing`): a ready or served round has nothing left
//     to hurry.
//   · Only between `normal` and `rush`: a VIP round offers no toggle, because undoing it would land
//     on `normal` and erase the VIP mark for good (kitchen#96).
//   · A refused command is SAID on the sheet, never swallowed.
import { beforeEach, describe, expect, it } from 'vitest';

type Row = Record<string, unknown>;

let subs: Record<string, Array<(p: unknown) => void>>;
let comandasStub: Row[];
let commands: Array<{ name: string; params: Row }>;
let granted: Set<string>;
let failNext: unknown;

const settle = async (el: Element) => {
  for (let i = 0; i < 3; i++) {
    await new Promise((r) => setTimeout(r, 0));
    await (el as unknown as { updateComplete: Promise<unknown> }).updateComplete;
  }
};

beforeEach(() => {
  subs = {};
  commands = [];
  granted = new Set(['kitchen.view_order', 'kitchen.change_order']);
  failNext = undefined;
  comandasStub = [
    { id: 'k3', round_number: 3, status: 'pending', priority: 'rush', fired_at: '2026-09-26T20:40:00+00:00' },
    { id: 'k2', round_number: 2, status: 'preparing', priority: 'normal', fired_at: '2026-09-26T20:37:00+00:00' },
    { id: 'k1', round_number: 1, status: 'ready', priority: 'normal', fired_at: '2026-09-26T18:40:00+00:00' },
  ];
  (globalThis as Record<string, unknown>).erplora = {
    locale: 'es',
    t: (_catalog: unknown, key: string, params?: Record<string, unknown>) =>
      (params ? `${key} ${Object.values(params).join(' ')}` : key),
    hasPermission: (p: string) => granted.has(p),
    queryAll: async (name: string, params?: Row) => {
      if (name === 'kitchen.orders.list'
        && (params?.filters as Row | undefined)?.source_order_id === 'o1') return comandasStub.map((c) => ({ ...c }));
      return [];
    },
    query: async () => [],
    command: async (name: string, params: Row) => {
      commands.push({ name, params });
      if (failNext) {
        const e = failNext;
        failNext = undefined;
        throw e;
      }
      if (name === 'kitchen.orders.update') {
        comandasStub = comandasStub.map((c) => (c.id === params.order_id ? { ...c, priority: params.priority } : c));
      }
      return { ok: true };
    },
    on: (event: string, cb: (p: unknown) => void) => {
      (subs[event] ??= []).push(cb);
      return () => undefined;
    },
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

const rushButton = (el: Element, id: string) =>
  el.shadowRoot!.querySelector(`[data-testid="kitchen-comandas-rush-${id}"]`) as HTMLElement | null;

describe('kitchen#94 · rush from the POS «Comandas» sheet', () => {
  it('a round still cooking offers «Mark rush»; tapping it sends the KDS command and the sheet shows it rush', async () => {
    const el = await openSheet();
    const btn = rushButton(el, 'k2');
    expect(btn, 'the preparing, normal round offers the toggle').toBeTruthy();
    expect(btn!.textContent).toContain('ui.markRush');

    btn!.click();
    await settle(el);

    expect(commands, 'same command and payload as the KDS card').toEqual([
      { name: 'kitchen.orders.update', params: { order_id: 'k2', priority: 'rush' } },
    ]);
    expect(rushButton(el, 'k2')!.textContent, 'the sheet reloads and now offers to undo it').toContain('ui.clearRush');
    const row = el.shadowRoot!.querySelector('[data-testid="kitchen-comandas-row-k2"]')!;
    expect(row.textContent, 'a rush round reads as such to the waiter').toContain('ui.priority_rush');
  });

  it('a rush round offers «Remove rush», which puts it back to normal', async () => {
    const el = await openSheet();
    const btn = rushButton(el, 'k3');
    expect(btn!.textContent).toContain('ui.clearRush');

    btn!.click();
    await settle(el);

    expect(commands).toEqual([{ name: 'kitchen.orders.update', params: { order_id: 'k3', priority: 'normal' } }]);
    expect(rushButton(el, 'k3')!.textContent).toContain('ui.markRush');
  });

  it('a round that left the line (ready/served/cancelled) offers no toggle', async () => {
    comandasStub.push(
      { id: 'k0', round_number: 0, status: 'served', priority: 'normal' },
      { id: 'kx', round_number: 4, status: 'cancelled', priority: 'normal' },
    );
    const el = await openSheet();
    expect(rushButton(el, 'k1'), 'ready').toBeNull();
    expect(rushButton(el, 'k0'), 'served').toBeNull();
    expect(rushButton(el, 'kx'), 'cancelled').toBeNull();
  });

  it('a VIP round offers no toggle: undoing it would erase the VIP mark (kitchen#96)', async () => {
    comandasStub = comandasStub.map((c) => (c.id === 'k2' ? { ...c, priority: 'vip' } : c));
    const el = await openSheet();
    expect(rushButton(el, 'k2')).toBeNull();
  });

  it('without kitchen.change_order the sheet stays read-only', async () => {
    granted.delete('kitchen.change_order');
    const el = await openSheet();
    expect(rushButton(el, 'k2')).toBeNull();
    expect(rushButton(el, 'k3')).toBeNull();
  });

  it('a refused command is said on the sheet, in the user language, and the row shows the real state', async () => {
    failNext = Object.assign(new Error('boom'), { code: 'kitchen.invalid_transition' });
    const el = await openSheet();
    rushButton(el, 'k2')!.click();
    await settle(el);

    const err = el.shadowRoot!.querySelector('[data-testid="kitchen-comandas-error"]');
    expect(err, 'the failure is visible').toBeTruthy();
    expect(err!.textContent, 'the code maps to its catalog text, not the raw message').toContain('ya no está en el estado');
    expect(rushButton(el, 'k2')!.textContent, 'nothing changed server-side').toContain('ui.markRush');
  });

  it('a failure with no known code shows the generic message, never the raw server text', async () => {
    failNext = new Error('connect ECONNREFUSED 10.0.0.1:5432');
    const el = await openSheet();
    rushButton(el, 'k2')!.click();
    await settle(el);

    const err = el.shadowRoot!.querySelector('[data-testid="kitchen-comandas-error"]')!;
    expect(err.textContent).toContain('ui.updateStatusError');
    expect(err.textContent).not.toContain('ECONNREFUSED');
  });

  it('a rush set from ANOTHER screen reaches the open sheet live (kitchen.order.updated)', async () => {
    const el = await openSheet();
    expect(subs['kitchen.order.updated'], 'the sheet listens to the update event').toBeTruthy();

    comandasStub = comandasStub.map((c) => (c.id === 'k2' ? { ...c, priority: 'rush' } : c));
    subs['kitchen.order.updated'].forEach((cb) => cb({ order_id: 'k2' }));
    await settle(el);

    expect(rushButton(el, 'k2')!.textContent).toContain('ui.clearRush');
  });
});
