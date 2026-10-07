// kitchen#156 (KITCHEN-F12) — **a half-marked ticket keeps «Recall» whole on a tablet.**
//
// A ticket with one dish ready and one still cooking paints THREE footer buttons: «Ready», «Mark
// rush» and «Recall». The footer was a single flex row with no wrap: on a portrait tablet (820 px,
// three ~254 px columns) the three did not fit, «Recall» (a single word, ~111 px) ran past the
// card's `overflow:hidden` edge and the cook saw «Recupe…» — a button they could neither read nor
// tap whole. Since menus reach the kitchen dish by dish, a half-marked ticket is the normal case.
//
// The market (Toast, Square, Fresh KDS) keeps every action of the card on the card: when they do
// not fit in one row they drop to the next one. So the footer WRAPS, and each button keeps its
// content width as its floor (no `min-width:0`, no `overflow:hidden` that would trade the wrap for
// a clipped label). happy-dom does no layout, so the CSS contract is pinned here; the real fit is
// measured on the bench (hub:stable, ios+md, 1440x900 / 820x1180 / 375x667, ui-clip-sweep.sh).
import { beforeEach, describe, expect, it, vi } from 'vitest';

type Row = Record<string, unknown>;

const NOW = new Date('2026-10-07T12:00:00Z');
const minutesAgo = (m: number) => new Date(NOW.getTime() - m * 60_000).toISOString();

/** Table 3, one round: the beer is ready, the tapas still cooking. */
const T3 = { order_id: 'k1', order_number: '20261007-0001', order_status: 'preparing', order_type: 'dine_in', priority: 'normal', label: 'Mesa 3', round_number: 1, order_notes: '', order_fired_at: minutesAgo(3), ready_at: null, order_created_at: minutesAgo(3), waiter_id: null };
const rows: Row[] = [
  { ...T3, item_id: 'i1', station_id: null, station_name: '', destination: 'display', product_name: 'Caña', quantity: 1_000_000, modifiers: '', item_notes: '', item_status: 'ready', seat_number: null, completed_at: minutesAgo(1) },
  { ...T3, item_id: 'i2', station_id: null, station_name: '', destination: 'display', product_name: 'Tapa de bravas', quantity: 1_000_000, modifiers: '', item_notes: '', item_status: 'pending', seat_number: null, completed_at: null },
];

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  (globalThis as Record<string, unknown>).erplora = {
    query: async (name: string) => {
      if (name === 'kitchen.orders.display') return rows;
      if (name === 'kitchen.settings.get') return [{ show_timer: 1, warning_time_minutes: 15, critical_time_minutes: 30, color_coding_enabled: 1 }];
      return [];
    },
    queryPage: async () => ({ rows: [], total: 0, limit: 50, offset: 0 }),
    command: async () => ({}),
    hasPermission: () => true,
    on: () => () => {},
    locale: 'es',
    t: (_catalog: unknown, key: string, params?: Record<string, unknown>) =>
      params ? `${key}:${Object.values(params).join(',')}` : key,
  };
});

type Host = HTMLElement & { shadowRoot: ShadowRoot; updateComplete: Promise<unknown> };

async function mount(): Promise<Host> {
  await import('./erp-kitchen-display');
  const el = document.createElement('erp-kitchen-display') as Host;
  document.body.appendChild(el);
  for (let i = 0; i < 4; i++) {
    await el.updateComplete;
    await Promise.resolve();
  }
  return el;
}

/** The declarations of ONE rule of the component's own stylesheet, by its exact selector. */
function rule(el: Host, selector: string): string {
  const css = (el.constructor as unknown as { styles: { cssText: string } | { cssText: string }[] }).styles;
  const text = Array.isArray(css) ? css.map((c) => c.cssText).join('\n') : css.cssText;
  const esc = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/ /g, '\\s+');
  const m = new RegExp(`(?:^|[}\\s])${esc}\\s*\\{([^}]*)\\}`).exec(text);
  expect(m, `rule «${selector}» exists`).not.toBeNull();
  return m![1];
}

describe('kitchen#156: the footer of a half-marked ticket never clips «Recall»', () => {
  it('a half-marked ticket offers ready, rush and recall on the same card', async () => {
    const el = await mount();
    const actions = Array.from(el.shadowRoot.querySelectorAll<HTMLElement>('[data-order="k1"] .foot ion-button')).map((b) => b.dataset.action);
    expect(actions).toEqual(['bump', 'rush', 'recall']);
  });

  it('the footer drops the buttons that do not fit to a second row', async () => {
    expect(rule(await mount(), '.foot')).toMatch(/flex-wrap:\s*wrap/);
  });

  it('a footer button never shrinks below its label', async () => {
    const r = rule(await mount(), '.foot ion-button');
    expect(r, 'min-width:0 lets the label be cut instead of wrapping the button').not.toMatch(/min-width:\s*0/);
    expect(r).not.toMatch(/overflow:\s*hidden/);
  });
});
