// kitchen#116 — **the view switcher's tabs are named by the view, not by the view plus its counter.**
//
// «Comandas / Listas / Resumen» is an `ion-segment`: Ionic renders each `ion-segment-button` as a
// `role="tab"` button whose accessible name comes from its content. The live counter sits inside
// that content with no text between them, so a screen reader and every getByRole lookup met the
// tabs as «Comandas0» and «Listas0» (measured on hub:stable and hub:dev, ios and md) — a name
// that changes with every ticket and never equals the word on screen.
//
// The name is pinned with `aria-label` on the `ion-segment-button`: Ionic's segment-button inherits
// exactly that attribute onto its native `role="tab"` button (`inheritAttributes(el,
// ['aria-label'])`, read once at load — so it must be the STATIC view name, never the counter).
// happy-dom has no Ionic, so here the contract is the host attribute; the real tab name is
// measured in the bench (hub:stable with this module mounted).
import { beforeEach, describe, expect, it, vi } from 'vitest';
import es from '../../../locales/es.json';
import en from '../../../locales/en.json';

type Row = Record<string, unknown>;
const NOW = new Date('2026-08-18T12:00:00Z');
const minutesAgo = (m: number) => new Date(NOW.getTime() - m * 60_000).toISOString();
const COOKING = { order_id: 'k1', order_number: '20260818-0001', order_status: 'preparing', order_type: 'dine_in', priority: 'normal', label: 'Mesa 4', round_number: 1, order_notes: '', order_fired_at: minutesAgo(5), ready_at: null, order_created_at: minutesAgo(5), waiter_id: null };
const READY = { order_id: 'k2', order_number: '20260818-0002', order_status: 'ready', order_type: 'takeaway', priority: 'normal', label: 'Barra', round_number: 1, order_notes: '', order_fired_at: minutesAgo(8), ready_at: minutesAgo(1), order_created_at: minutesAgo(8), waiter_id: null };
const rows: Row[] = [
  { ...COOKING, item_id: 'i1', station_id: 's-bar', station_name: 'Bar', destination: 'display', product_name: 'Caña', quantity: 1_000_000, modifiers: '', item_notes: '', item_status: 'pending', seat_number: null, completed_at: null },
  { ...READY, item_id: 'i2', station_id: 's-bar', station_name: 'Bar', destination: 'display', product_name: 'Café', quantity: 1_000_000, modifiers: '', item_notes: '', item_status: 'ready', seat_number: null, completed_at: minutesAgo(1) },
];

const CATALOGS = { es, en } as const;
type Locale = keyof typeof CATALOGS;
let locale: Locale = 'es';

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  (globalThis as Record<string, unknown>).erplora = {
    query: async (name: string) => {
      if (name === 'kitchen.settings.get') return [{ show_timer: 1, warning_time_minutes: 15, critical_time_minutes: 30, color_coding_enabled: 1 }];
      if (name === 'kitchen.orders.display') return rows;
      return [];
    },
    queryPage: async () => ({ rows: [], total: 0, limit: 50, offset: 0 }),
    command: async () => ({}),
    hasPermission: () => true,
    on: () => () => {},
    get locale() {
      return locale;
    },
    // The REAL catalog, so the pinned names are the words the cook reads, in both languages.
    t: (_catalog: unknown, key: string) =>
      key.split('.').reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], CATALOGS[locale]) as string,
  };
});

type Host = HTMLElement & { shadowRoot: ShadowRoot; updateComplete: Promise<unknown> };

async function mount(): Promise<Host> {
  await import('./erp-kitchen-display');
  const el = document.createElement('erp-kitchen-display') as Host;
  document.body.appendChild(el);
  for (let i = 0; i < 6; i++) {
    await el.updateComplete;
    await vi.advanceTimersByTimeAsync(0);
  }
  return el;
}

const VIEWS = [
  { testid: 'kds-view-tickets', key: 'modeTickets', count: 'cooking' },
  { testid: 'kds-view-ready', key: 'readyRail', count: 'ready' },
  { testid: 'kds-view-allday', key: 'modeAllDay', count: null },
] as const;

describe.each(['es', 'en'] as const)('kitchen#116: the view switcher tabs are named by the view (%s)', (lang) => {
  it('each view tab carries the bare view name as its accessible name', async () => {
    locale = lang;
    const el = await mount();
    for (const v of VIEWS) {
      const button = el.shadowRoot.querySelector<HTMLElement>(`[data-testid="${v.testid}"]`);
      expect(button, v.testid).not.toBeNull();
      const expected = (CATALOGS[lang].ui as Record<string, string>)[v.key];
      expect(expected, `${lang}.ui.${v.key}`).toBeTruthy();
      expect(button!.getAttribute('aria-label'), v.testid).toBe(expected);
    }
    el.remove();
  });

  it('the counter stays painted on the tab, apart from its name', async () => {
    locale = lang;
    const el = await mount();
    for (const v of VIEWS.filter((x) => x.count)) {
      const button = el.shadowRoot.querySelector<HTMLElement>(`[data-testid="${v.testid}"]`)!;
      expect(button.querySelector(`[data-count="${v.count}"]`)?.textContent?.trim(), v.testid).toBe('1');
      expect(button.getAttribute('aria-label'), v.testid).toEqual(expect.stringMatching(/^\D+$/));
    }
    el.remove();
  });
});
