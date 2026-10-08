// kitchen#161 — on the till's «Comandas de la cuenta» sheet, a dish the till voided after firing
// reads struck with «Voided», the same way the kitchen sees it — not as «2× Croquetas» still on the
// round. The waiter who voided it opens the sheet to check that the kitchen got it.
//
// Two ways it went stale: the dish lines were loaded ONCE per round and cached for the life of the
// component (reopening the sheet after a void still showed the old line), and no kitchen event
// about a single dish refreshed them.
import { beforeEach, describe, expect, it } from 'vitest';

let subs: Record<string, Array<(p: unknown) => void>>;
let items: Array<Record<string, unknown>>;

beforeEach(() => {
  subs = {};
  items = [
    { id: 'i1', product_name: 'Croquetas', quantity: 2_000_000, status: 'pending', void_reason: '' },
    { id: 'i2', product_name: 'Caña', quantity: 1_000_000, status: 'pending', void_reason: '' },
  ];
  (globalThis as Record<string, unknown>).erplora = {
    locale: 'es',
    t: (_catalog: unknown, key: string, params?: Record<string, unknown>) =>
      (params ? `${key} ${Object.values(params).join(' ')}` : key),
    queryAll: async (name: string) =>
      (name === 'kitchen.orders.list'
        ? [{ id: 'k1', round_number: 1, status: 'preparing', fired_at: '2026-10-08T12:00:00+00:00', created_at: '2026-10-08T12:00:00+00:00' }]
        : []),
    query: async (name: string) => (name === 'kitchen.orders.items' ? items.map((i) => ({ ...i })) : []),
    on: (event: string, cb: (p: unknown) => void) => {
      (subs[event] ??= []).push(cb);
      return () => undefined;
    },
  };
});

type El = HTMLElement & { updateComplete: Promise<unknown> };

async function flush(el: El) {
  for (let i = 0; i < 4; i++) {
    await new Promise((r) => setTimeout(r, 0));
    await el.updateComplete;
  }
}

async function mountWithOrder(): Promise<El> {
  await import('./erp-kitchen-pos-comandas');
  const el = document.createElement('erp-kitchen-pos-comandas') as El;
  document.body.appendChild(el);
  await el.updateComplete;
  el.dispatchEvent(new CustomEvent('erp:pos-state', { detail: { order_id: 'o1', items_count: 1, pending_count: 0 } }));
  await flush(el);
  return el;
}

async function openSheet(el: El) {
  (el.shadowRoot!.querySelector('.chip') as HTMLElement).click();
  await flush(el);
}

const dish = (el: El, id: string) => el.shadowRoot!.querySelector<HTMLElement>(`.kitem[data-item="${id}"]`);

function voidCroquetas() {
  items = items.map((i) => (i.id === 'i1' ? { ...i, status: 'voided', void_reason: 'Out of stock' } : i));
}

describe('kitchen#161: the voided dish reads voided on the till sheet', () => {
  it('a voided dish is marked voided, with the word, and the live one is not', async () => {
    voidCroquetas();
    const el = await mountWithOrder();
    await openSheet(el);
    expect(dish(el, 'i1')?.dataset.status).toBe('voided');
    expect(dish(el, 'i1')?.textContent).toContain('ui.lineVoided');
    expect(dish(el, 'i2')?.dataset.status).toBe('pending');
    expect(dish(el, 'i2')?.textContent).not.toContain('ui.lineVoided');
  });

  it('is struck through by the stylesheet', async () => {
    await import('./erp-kitchen-pos-comandas');
    const ctor = customElements.get('erp-kitchen-pos-comandas') as unknown as { styles: { cssText: string } };
    expect(ctor.styles.cssText).toMatch(/\.kitem\[data-status=['"]voided['"]\][^{]*\{[^}]*text-decoration:\s*line-through/);
  });

  it('reopening the sheet after a void shows it voided (the dishes are not cached forever)', async () => {
    const el = await mountWithOrder();
    await openSheet(el);
    expect(dish(el, 'i1')?.dataset.status).toBe('pending');
    (el.shadowRoot!.querySelector('.x') as HTMLElement).click();
    await flush(el);

    voidCroquetas();
    await openSheet(el);
    expect(dish(el, 'i1')?.dataset.status).toBe('voided');
  });

  it('with the sheet open, the kitchen voiding the dish strikes it without reopening', async () => {
    const el = await mountWithOrder();
    await openSheet(el);
    expect(subs['kitchen.item.voided'], 'the sheet does not listen to a single dish being voided').toBeTruthy();
    voidCroquetas();
    subs['kitchen.item.voided'].forEach((cb) => cb({ order_id: 'k1', item_id: 'i1' }));
    await flush(el);
    expect(dish(el, 'i1')?.dataset.status).toBe('voided');
  });
});
