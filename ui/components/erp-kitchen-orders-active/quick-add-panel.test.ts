// kitchen#122 — on a phone, the quick «New order» form above the list read as a FILTER.
//
// «Type: Dine in», a «Notes» box and a «New order» button sat above the list with no title and no
// separation, so with «Type: Dine in» in sight the first card being a «Takeaway» order looked like
// a filter that does not filter. And the two fields of that one form looked different: «Type» had
// its label floated on the border (it has a value), «Notes» had it inside the box (it is empty).
//
// The fix follows the pattern Stations already uses (and every list of the hub: Odoo, Square,
// Shopify): creating a row is the table's own «+ New order» button, which opens the `create` panel
// of `ok-data-table` titled «New order» (`labels.add` / `labels.newRecord`, outfitkit#220). Above
// the list there is nothing but the list's own toolbar, so nothing can be mistaken for a filter.
//
// Once the form lives in a panel — a full-screen sheet under 834 px (outfitkit#75) — its refusal has
// to travel with it (pm#513): a notice on the page under the sheet is never seen. A refused row
// action involves no form, so it stays on the page, above the list (rv-appointments-227, rv-taxes-81).
import { beforeEach, describe, expect, it, vi } from 'vitest';
import esLocale from '../../../locales/es.json';
import enLocale from '../../../locales/en.json';

const CATALOGS: Record<string, unknown> = { es: esLocale, en: enLocale };

const REFUSAL = 'A manager has to approve this.';

let locale = 'es';
let refuse: string | null = null;
let reads = 0;
let created: Record<string, unknown>[] = [];
let revealed: Element[] = [];

/** The real lookup of the SDK: `ui.newOrder` → the catalogue's text in the active language. */
function translate(_c: unknown, key: string): string {
  const read = (lang: string): unknown =>
    key.split('.').reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], CATALOGS[lang]);
  const text = read(locale) ?? read('en');
  return typeof text === 'string' ? text : key;
}

beforeEach(() => {
  locale = 'es';
  refuse = null;
  reads = 0;
  created = [];
  revealed = [];
  vi.spyOn(HTMLElement.prototype, 'scrollIntoView').mockImplementation(function (this: HTMLElement) {
    revealed.push(this);
  });
  (globalThis as Record<string, unknown>).erplora = {
    query: async () => [],
    queryPage: async () => {
      reads++;
      return {
        rows: [{ id: 'o1', order_number: 'K-001', status: 'pending', order_type: 'takeaway', label: 'Ana', priority: 'normal', total: 600, notes: '', created_at: '2026-09-28T09:00:00Z' }],
        total: 1,
        limit: 50,
        offset: 0,
      };
    },
    command: async (name: string, payload: Record<string, unknown>) => {
      if (refuse !== null) throw new Error(refuse);
      if (name === 'kitchen.orders.create') created.push(payload);
      return {};
    },
    on: () => () => {},
    get locale() {
      return locale;
    },
    t: translate,
    formatMoney: (cents: number) => `${((cents || 0) / 100).toFixed(2)} €`,
    currencyDecimals: 2,
    hasPermission: () => true,
  };
});

type Wc = HTMLElement & { shadowRoot: ShadowRoot; updateComplete: Promise<unknown> } & Record<string, any>;

async function mount(): Promise<Wc> {
  await import('./erp-kitchen-orders-active');
  const el = document.createElement('erp-kitchen-orders-active') as Wc;
  document.body.appendChild(el);
  await settle(el);
  return el;
}

async function settle(el: Wc): Promise<void> {
  for (let i = 0; i < 3; i++) {
    await el.updateComplete;
    await new Promise((r) => setTimeout(r, 0));
  }
}

const $ = (el: Wc, testid: string): HTMLElement | null =>
  el.shadowRoot.querySelector(`[data-testid="${testid}"]`);
const table = (el: Wc): Wc => el.shadowRoot.querySelector('ok-data-table') as Wc;
const form = (el: Wc): HTMLElement => $(el, 'kitchen-orders-form') as HTMLElement;

async function submit(el: Wc): Promise<void> {
  form(el).dispatchEvent(new Event('submit', { cancelable: true }));
  await settle(el);
  await settle(el);
}

describe('the quick add is the table\'s «New order» panel, not a box above the list', () => {
  it('the form is projected into the create panel of the table', async () => {
    const el = await mount();
    const f = form(el);
    expect(f, 'the new-order form is still painted').not.toBeNull();
    expect(f.parentElement, 'the form is a child of the ok-data-table').toBe(table(el));
    expect(f.getAttribute('slot'), 'it goes into the table\'s create panel').toBe('create');
  });

  it('nothing between the title and the list is a field: no form sits above the table', async () => {
    const el = await mount();
    const outside = [...el.shadowRoot.querySelectorAll('form, ion-select, ion-input')].filter(
      (n) => !table(el).contains(n),
    );
    expect(outside.map((n) => n.tagName.toLowerCase())).toEqual([]);
  });

  it('the table offers the add button (addable)', async () => {
    const el = await mount();
    expect(table(el).addable).toBe(true);
  });

  for (const [lang, add, submitText] of [
    ['en', 'New order', 'Create order'],
    ['es', 'Nueva comanda', 'Crear comanda'],
  ] as const) {
    it(`[${lang}] the add button and the panel title say «${add}», the panel's button «${submitText}»`, async () => {
      locale = lang;
      const el = await mount();
      expect(table(el).labels?.add, 'the toolbar button names what it adds').toBe(add);
      expect(table(el).labels?.newRecord, 'the panel is titled with what it creates').toBe(add);
      expect($(el, 'kitchen-orders-submit')?.textContent?.trim()).toBe(submitText);
    });
  }
});

describe('the two fields of the form carry their label the same way', () => {
  it('Type and Notes: same label placement, stacked (the label never moves into the box)', async () => {
    const el = await mount();
    const type = $(el, 'kitchen-orders-type')!;
    const notes = $(el, 'kitchen-orders-notes')!;
    expect(type.getAttribute('label-placement')).toBe('stacked');
    expect(notes.getAttribute('label-placement')).toBe('stacked');
  });

  it('both keep the boxed look of the hub (fill=outline with mode=md, dead-fill-outline convention)', async () => {
    const el = await mount();
    for (const id of ['kitchen-orders-type', 'kitchen-orders-notes']) {
      const field = $(el, id)!;
      expect(field.getAttribute('fill'), id).toBe('outline');
      expect(field.getAttribute('mode'), id).toBe('md');
    }
  });

  for (const [lang, hint] of [
    ['en', '(optional)'],
    ['es', '(opcional)'],
  ] as const) {
    it(`[${lang}] Notes says it is optional`, async () => {
      locale = lang;
      const el = await mount();
      expect($(el, 'kitchen-orders-notes')?.getAttribute('placeholder')).toBe(hint);
    });
  }

  it('the panel lays the form out as a column with the button at the end', async () => {
    const el = await mount();
    expect(getComputedStyle(form(el)).flexDirection).toBe('column');
    expect(getComputedStyle($(el, 'kitchen-orders-submit')!).alignSelf).toBe('flex-end');
  });
});

describe('creating an order from the panel', () => {
  it('sends the picked type and the notes, closes the panel, clears the notes and reloads the list', async () => {
    const el = await mount();
    const close = vi.spyOn(table(el), 'close');
    el.newType = 'takeaway';
    el.newNotes = '  sin cebolla ';
    const before = reads;
    await submit(el);
    expect(created).toEqual([{ order_type: 'takeaway', priority: 'normal', notes: 'sin cebolla', items: [] }]);
    expect(close, 'the panel does not stay open over the new order').toHaveBeenCalled();
    expect(el.newNotes).toBe('');
    expect(reads).toBeGreaterThan(before);
  });

  it('a refused create is painted INSIDE the form, above its button, and brought into view', async () => {
    const el = await mount();
    const close = vi.spyOn(table(el), 'close');
    refuse = REFUSAL;
    await submit(el);
    const notice = $(el, 'kitchen-orders-form-error');
    expect(notice?.textContent?.trim()).toBe(REFUSAL);
    expect(notice?.parentElement, 'the notice travels with the form').toBe(form(el));
    const kids = [...form(el).children];
    expect(kids.indexOf(notice!)).toBeLessThan(kids.indexOf($(el, 'kitchen-orders-submit')!));
    expect(revealed).toContain(notice);
    expect($(el, 'kitchen-orders-error'), 'no copy of it on the page under the sheet').toBeNull();
    expect(close, 'the panel stays open so the person can fix and retry').not.toHaveBeenCalled();
  });

  it('a refused create without a message still says what failed', async () => {
    const el = await mount();
    refuse = '';
    await submit(el);
    expect($(el, 'kitchen-orders-form-error')?.textContent?.trim()).toBe('No se pudo crear la comanda');
  });

  it('a new create wipes the refusal an earlier row action left on the page', async () => {
    const el = await mount();
    refuse = REFUSAL;
    await el.onRowAction(new CustomEvent('rowAction', { detail: { actionId: 'fire', row: { id: 'o1', status: 'pending' } } }));
    await settle(el);
    expect($(el, 'kitchen-orders-error')).not.toBeNull();
    refuse = null;
    await submit(el);
    expect($(el, 'kitchen-orders-error')).toBeNull();
  });
});

describe('a refused row action stays on the page, above the list', () => {
  it('painted outside the create form and before the table', async () => {
    const el = await mount();
    refuse = REFUSAL;
    await el.onRowAction(new CustomEvent('rowAction', { detail: { actionId: 'fire', row: { id: 'o1', status: 'pending' } } }));
    await settle(el);
    const notice = $(el, 'kitchen-orders-error')!;
    expect(notice.textContent?.trim()).toBe(REFUSAL);
    expect(form(el).contains(notice), 'a closed panel would hide it').toBe(false);
    expect(notice.compareDocumentPosition(table(el)) & Node.DOCUMENT_POSITION_FOLLOWING, 'above the list').toBeTruthy();
    expect($(el, 'kitchen-orders-form-error')).toBeNull();
  });
});
