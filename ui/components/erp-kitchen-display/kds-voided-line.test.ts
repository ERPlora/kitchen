// kitchen#161 — **the dish the till takes back is struck on the KDS, with its reason**.
//
// What was wrong: the POS voids a line already fired (SALES-F20, `sales.order.line_voided`) and
// the kitchen kept cooking it — the line stayed on the board looking like any other pending dish.
// The backend now marks the kitchen line `voided` with the reason; this file pins what the cook
// SEES: the line struck through with «Voided» and the reason (Toast «voided items show on the KDS»,
// Square and Lightspeed strike them), not tappable (there is nothing to bump or recall), and not
// in the way of the menu closing when the rest of it is done.
import { beforeEach, describe, expect, it, vi } from 'vitest';

type Row = Record<string, unknown>;

let displayRows: Row[] = [];
let commands: Array<{ name: string; payload: Record<string, unknown> }> = [];
let subscribed: string[] = [];

const NOW = new Date('2026-10-08T12:00:00Z');
const minutesAgo = (m: number) => new Date(NOW.getTime() - m * 60_000).toISOString();

const T4 = { order_id: 'k1', order_number: '20261008-0001', order_status: 'preparing', order_type: 'dine_in', priority: 'normal', label: 'Mesa 4', round_number: 1, order_notes: '', order_fired_at: minutesAgo(5), ready_at: null, order_created_at: minutesAgo(5), waiter_id: null };

function item(over: Row): Row {
  return { ...T4, station_id: 's-grill', station_name: 'Plancha', destination: 'display', quantity: 1_000_000, modifiers: '', item_notes: '', seat_number: null, completed_at: null, combo_ref: null, combo_name: null, line_seq: 0, void_reason: '', ...over };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  commands = [];
  subscribed = [];
  displayRows = [
    item({ item_id: 'i1', product_name: 'Croquetas', quantity: 2_000_000, item_status: 'voided', void_reason: 'Customer changed their mind' }),
    item({ item_id: 'i2', product_name: 'Hamburguesa', item_status: 'pending' }),
  ];
  (globalThis as Record<string, unknown>).erplora = {
    query: async (name: string) => {
      if (name === 'kitchen.orders.display') return displayRows;
      if (name === 'kitchen.settings.get') return [{ show_timer: 1, warning_time_minutes: 15, critical_time_minutes: 30, color_coding_enabled: 1 }];
      if (name === 'kitchen.stations.list') return [{ id: 's-grill', name: 'Plancha', name_es: '', is_active: 1 }];
      return [];
    },
    queryPage: async () => ({ rows: [], total: 0, limit: 50, offset: 0 }),
    command: async (name: string, payload: Record<string, unknown>) => {
      commands.push({ name, payload });
      return {};
    },
    hasPermission: () => true,
    on: (event: string) => {
      subscribed.push(event);
      return () => {};
    },
    locale: 'es',
    t: (_catalog: unknown, key: string, params?: Record<string, unknown>) =>
      params ? `${key}:${Object.values(params).join(',')}` : key,
  };
});

type Host = HTMLElement & { shadowRoot: ShadowRoot; updateComplete: Promise<unknown> };

async function settle(el: Host) {
  for (let i = 0; i < 4; i++) {
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

const styles = (el: Host): string => {
  const css = (el.constructor as unknown as { styles: { cssText: string } | { cssText: string }[] }).styles;
  return Array.isArray(css) ? css.map((c) => c.cssText).join('\n') : css.cssText;
};

const lineOf = (el: Host, id: string) => el.shadowRoot.querySelector<HTMLElement>(`[data-item="${id}"]`);

describe('kitchen#161: a voided line is struck on the KDS, with its reason', () => {
  it('stays on the ticket marked voided, with the word and the reason', async () => {
    const el = await mount();
    const voided = lineOf(el, 'i1');
    expect(voided, 'the cook has to SEE that the dish was taken back, not lose it silently').not.toBeNull();
    expect(voided!.dataset.status).toBe('voided');
    expect(voided!.querySelector('[data-void-label]')?.textContent).toContain('ui.lineVoided');
    expect(voided!.querySelector('[data-void-reason]')?.textContent).toContain('Customer changed their mind');
  });

  it('without a reason it still says voided, and paints no empty reason', async () => {
    displayRows[0] = { ...displayRows[0], void_reason: '' };
    const el = await mount();
    expect(lineOf(el, 'i1')!.querySelector('[data-void-label]')).not.toBeNull();
    expect(lineOf(el, 'i1')!.querySelector('[data-void-reason]')).toBeNull();
  });

  it('is struck through by the stylesheet', async () => {
    expect(styles(await mount())).toMatch(/\.line\[data-status="voided"\][^{]*\.name[^{]*\{[^}]*text-decoration:\s*line-through/);
  });

  it('is not a button: tapping it sends nothing and the keyboard skips it', async () => {
    const el = await mount();
    const voided = lineOf(el, 'i1')!;
    expect(voided.getAttribute('aria-disabled')).toBe('true');
    expect(voided.getAttribute('tabindex')).toBe('-1');
    expect(voided.getAttribute('aria-label'), 'a screen reader must not offer to bump a dish that is gone').not.toContain('ui.tapToBump');
    expect(voided.getAttribute('aria-label')).toContain('ui.lineVoided');
    voided.click();
    await settle(el);
    expect(commands).toEqual([]);
  });

  it('«Ready» on the card bumps only what is still cooking, never the voided line', async () => {
    const el = await mount();
    el.shadowRoot.querySelector<HTMLElement>('[data-order="k1"] [data-action="bump"]')!.click();
    await settle(el);
    expect(commands.at(-1)).toEqual({ name: 'kitchen.items.bump', payload: { order_id: 'k1', item_ids: ['i2'] } });
  });

  it('a menu closes when the rest of it is ready: the voided component does not hold it open', async () => {
    displayRows = [
      item({ item_id: 'c1', product_name: 'Gazpacho', item_status: 'voided', void_reason: 'Out of stock', combo_ref: 'm1', combo_name: 'Menú del día' }),
      item({ item_id: 'c2', product_name: 'Filete', item_status: 'ready', combo_ref: 'm1', combo_name: 'Menú del día' }),
      item({ item_id: 'i9', product_name: 'Caña', item_status: 'pending' }),
    ];
    const el = await mount();
    expect(el.shadowRoot.querySelector<HTMLElement>('[data-combo="m1"]')!.dataset.comboDone).toBe('true');
  });

  it('a menu whose every component was voided is not «done»: nothing was served', async () => {
    displayRows = [
      item({ item_id: 'c1', product_name: 'Gazpacho', item_status: 'voided', combo_ref: 'm1', combo_name: 'Menú del día' }),
      item({ item_id: 'i9', product_name: 'Caña', item_status: 'pending' }),
    ];
    const el = await mount();
    expect(el.shadowRoot.querySelector<HTMLElement>('[data-combo="m1"]')!.dataset.comboDone).toBe('false');
  });

  it('reloads when the kitchen voids a line, like on every other kitchen change', async () => {
    await mount();
    expect(subscribed).toContain('kitchen.item.voided');
  });
});
