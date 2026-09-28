// Paging of the Comandas list: back to page 1 after a create (kitchen#133) and the rows-per-page
// picker (kitchen#135).
//
// kitchen#133 — with more than one page of orders, creating one from page 2 left the list on page 2.
//
// The list reads newest first (`created_at desc`), so the order just created is the first row of
// page 1: reloading the page the person was on showed another page of old orders, with no sign that
// anything had happened, and it was easy to create the same order twice. After a create the list
// goes back to its first page — seeing the new order on top is the confirmation (like the OutfitKit
// demo, outfitkit#236, and the lists of Odoo or Shopify after adding a record).
//
// The fake server below keeps the orders and pages them like the list engine, so the new row has to
// come back FROM THE SERVER to be seen (rv-tasks-48): a test that only counted reloads could not
// tell page 2 from page 1.
import { beforeEach, describe, expect, it } from 'vitest';
import esLocale from '../../../locales/es.json';

type Row = Record<string, unknown> & { id: string; order_number: string };
type Params = { limit: number; offset: number; search?: string; sort?: string; dir?: string; filters?: Record<string, unknown> };

let orders: Row[] = [];
let calls: Params[] = [];
let refuse: string | null = null;

function order(n: number): Row {
  const num = String(n).padStart(4, '0');
  return { id: `o${num}`, order_number: `K-${num}`, status: 'pending', order_type: 'dine_in', label: '', priority: 'normal', total: 0, notes: '', created_at: `2026-09-28T09:${num.slice(2)}:00Z` };
}

beforeEach(() => {
  refuse = null;
  calls = [];
  // 60 orders, newest first: page 1 = K-0060…K-0011, page 2 = K-0010…K-0001.
  orders = Array.from({ length: 60 }, (_, i) => order(60 - i));
  (globalThis as Record<string, unknown>).erplora = {
    query: async () => [],
    queryPage: async (_name: string, p: Params) => {
      calls.push(structuredClone(p));
      const hits = orders.filter((o) => !p.search || o.order_number.includes(p.search));
      // Copies: a row the component holds must not change when the server does (rv-payment_gateways-45).
      return { rows: hits.slice(p.offset, p.offset + p.limit).map((o) => ({ ...o })), total: hits.length, limit: p.limit, offset: p.offset };
    },
    command: async (name: string) => {
      if (refuse !== null) throw new Error(refuse);
      if (name === 'kitchen.orders.create') orders.unshift(order(orders.length + 1));
      return {};
    },
    on: () => () => {},
    locale: 'es',
    t: (_c: unknown, key: string) =>
      key.split('.').reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], esLocale) ?? key,
    formatMoney: (cents: number) => `${((cents || 0) / 100).toFixed(2)} €`,
    currencyDecimals: 2,
    hasPermission: () => true,
  };
});

type Wc = HTMLElement & { shadowRoot: ShadowRoot; updateComplete: Promise<unknown> } & Record<string, any>;

async function settle(el: Wc): Promise<void> {
  for (let i = 0; i < 4; i++) {
    await el.updateComplete;
    await new Promise((r) => setTimeout(r, 0));
  }
}

async function mount(): Promise<Wc> {
  await import('./erp-kitchen-orders-active');
  const el = document.createElement('erp-kitchen-orders-active') as Wc;
  document.body.appendChild(el);
  await settle(el);
  return el;
}

const table = (el: Wc): Wc => el.shadowRoot.querySelector('ok-data-table') as Wc;
const numbers = (el: Wc): string[] => (table(el).rows as Row[]).map((r) => r.order_number);

/** What the person does: the table's pager emits `pageChange` (0-based). */
async function goToPage(el: Wc, page: number): Promise<void> {
  table(el).dispatchEvent(new CustomEvent('pageChange', { detail: page }));
  await settle(el);
}

async function createOrder(el: Wc): Promise<void> {
  const form = el.shadowRoot.querySelector('[data-testid="kitchen-orders-form"]') as HTMLElement;
  form.dispatchEvent(new Event('submit', { cancelable: true }));
  await settle(el);
}

// kitchen#135 — the rows-per-page picker of the table said «25» and the list kept 50: the screen
// never listened to `pageSizeChange`.
describe('the rows-per-page picker changes the list', () => {
  for (const size of [25, 100]) {
    it(`picking ${size} reloads ${size} rows per page from the first page`, async () => {
      const el = await mount();
      orders = Array.from({ length: 160 }, (_, i) => order(160 - i));
      await goToPage(el, 1);

      table(el).dispatchEvent(new CustomEvent('pageSizeChange', { detail: size }));
      await settle(el);

      expect([calls.at(-1)?.offset, calls.at(-1)?.limit]).toEqual([0, size]);
      expect(table(el).pageSize, 'the picker and the footer count with the new size').toBe(size);
      expect(table(el).page).toBe(0);
      expect(numbers(el)).toHaveLength(size);
    });
  }
});

describe('creating an order from a later page brings the list back to its first page', () => {
  it('from page 2, the new order is the first row the person sees, on page 1', async () => {
    const el = await mount();
    await goToPage(el, 1);
    expect(numbers(el)[0], 'the control: page 2 is on screen').toBe('K-0010');
    expect(table(el).page).toBe(1);

    await createOrder(el);

    expect(numbers(el)[0], 'the order just created heads the list').toBe('K-0061');
    expect(table(el).page, 'the pager says page 1').toBe(0);
    expect(calls.at(-1)?.offset, 'the reload asks the server for the first page').toBe(0);
  });

  it('the search, the filters and the order the person chose stay as they were', async () => {
    const el = await mount();
    table(el).dispatchEvent(new CustomEvent('searchChange', { detail: 'K-00' }));
    table(el).dispatchEvent(new CustomEvent('filterChange', { detail: { col: 'status', value: 'pending' } }));
    // Not the default (created_at desc): a create that put the default sort back would pass otherwise.
    table(el).dispatchEvent(new CustomEvent('sortChange', { detail: { sort: 'total', dir: 'asc' } }));
    await settle(el);
    await goToPage(el, 1);

    await createOrder(el);

    const last = calls.at(-1)!;
    expect(last.search, 'the search box is not emptied behind the person').toBe('K-00');
    expect(last.filters, 'the column filters are not emptied behind the person').toEqual({ status: 'pending' });
    expect([last.sort, last.dir], 'the sort the person picked is kept').toEqual(['total', 'asc']);
    expect(last.offset).toBe(0);
    expect(table(el).page).toBe(0);
  });

  it('after picking 25 rows per page, the create reloads the first 25 (the size is kept)', async () => {
    const el = await mount();
    table(el).dispatchEvent(new CustomEvent('pageSizeChange', { detail: 25 }));
    await settle(el);
    await goToPage(el, 1);

    await createOrder(el);

    expect([calls.at(-1)?.offset, calls.at(-1)?.limit]).toEqual([0, 25]);
    expect(numbers(el)).toHaveLength(25);
  });

  it('a refused create keeps the person on the page they were on', async () => {
    const el = await mount();
    await goToPage(el, 1);
    const before = calls.length;
    refuse = 'A manager has to approve this.';

    await createOrder(el);

    expect(table(el).page, 'nothing was created: the list does not move').toBe(1);
    expect(numbers(el)[0]).toBe('K-0010');
    expect(calls.slice(before).every((p) => p.offset === 50), 'no reload of page 1').toBe(true);
  });
});
