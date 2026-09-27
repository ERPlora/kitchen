// The «Status» column of active kitchen orders reads in the language of the hub (kitchen#108).
//
// The filter of the column already offered «Pendiente», «En preparación»… but the CELL had no
// `format`, so `ok-data-table` painted the internal value as is — «pending», in English, on the
// screen the whole service works from. The cell and the filter read the SAME catalogue now
// (`ui/lib/enums`, like «Type» and «Priority» next to it), so they cannot drift apart again.
import { beforeEach, describe, expect, it } from 'vitest';

import esLocale from '../../../locales/es.json';
import './erp-kitchen-orders-active';

const es = (esLocale as { ui: Record<string, string> }).ui;

const ORDER = { id: 'o1', order_number: 'K-001', status: 'pending', order_type: 'dine_in', label: 'Mesa 4', priority: 'normal', total: 600, notes: '', created_at: '2026-07-19T12:00:00Z' };

function shellSpeaking(locale: string) {
  document.body.replaceChildren();
  (globalThis as Record<string, unknown>).erplora = {
    query: async () => [],
    queryPage: async (name: string) =>
      name === 'kitchen.orders.list'
        ? { rows: [ORDER], total: 1, limit: 50, offset: 0 }
        : { rows: [], total: 0, limit: 50, offset: 0 },
    command: async () => ({}),
    on: () => () => {},
    locale,
    t: (catalog: Record<string, unknown>, key: string) => {
      const lang = (catalog[locale] ?? catalog.en) as Record<string, Record<string, string>>;
      const [section, name] = key.split('.');
      return lang?.[section]?.[name] ?? key;
    },
    formatMoney: (minor: number) => `${((minor || 0) / 100).toFixed(2)} €`,
    currencyDecimals: 2,
  };
}

beforeEach(() => shellSpeaking('es'));

type Column = { key: string; format?: (r: Record<string, unknown>) => string; options?: { value: string; label: string }[] };
type Mounted = HTMLElement & { shadowRoot: ShadowRoot; updateComplete: Promise<unknown>; columns: Column[] };

async function mount(): Promise<Mounted> {
  const el = document.createElement('erp-kitchen-orders-active') as Mounted;
  document.body.appendChild(el);
  await el.updateComplete;
  await new Promise((resolve) => setTimeout(resolve, 0));
  await el.updateComplete;
  return el;
}

const statusColumn = (el: Mounted) => el.columns.find((c) => c.key === 'status')!;

describe('the «Status» cell reads in the language of the hub (kitchen#108)', () => {
  it('a pending order reads «Pendiente», not «pending»', async () => {
    const col = statusColumn(await mount());
    expect(col.format, 'the status column paints the raw internal value').toBeTypeOf('function');
    expect(col.format!({ status: 'pending' })).toBe(es.statusPending);
  });

  it('every state of the line has its label', async () => {
    const col = statusColumn(await mount());
    expect(col.format?.({ status: 'preparing' })).toBe(es.statusPreparing);
    expect(col.format?.({ status: 'ready' })).toBe(es.statusReady);
    expect(col.format?.({ status: 'served' })).toBe(es.statusServed);
    expect(col.format?.({ status: 'cancelled' })).toBe(es.statusCancelled);
  });

  it('in English it reads «Pending» — nothing is hardcoded', async () => {
    shellSpeaking('en');
    const col = statusColumn(await mount());
    expect(col.format?.({ status: 'pending' })).toBe('Pending');
  });

  it('a state the catalogue does not know is printed as is, never blank', async () => {
    const col = statusColumn(await mount());
    expect(col.format?.({ status: 'on_hold' })).toBe('on_hold');
  });
});

describe('the cell and its filter say the same thing', () => {
  it('each filter option carries the label its cell prints', async () => {
    const col = statusColumn(await mount());
    expect(col.options?.map((o) => o.value).sort()).toEqual(['cancelled', 'pending', 'preparing', 'ready', 'served']);
    for (const opt of col.options ?? []) {
      expect(col.format?.({ status: opt.value }), `cell and filter disagree on «${opt.value}»`).toBe(opt.label);
    }
  });
});
