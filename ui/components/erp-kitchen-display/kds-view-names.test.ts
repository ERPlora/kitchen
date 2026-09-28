// kitchen#116 — **the view switcher's tabs are named by the view, not by the view plus its counter.**
//
// «Comandas / Listas / Resumen» is an `ion-segment`: Ionic renders each `ion-segment-button` as a
// `role="tab"` button whose accessible name comes from its content. The live counter sits inside
// that content with no text between them, so a screen reader and every getByRole lookup met the
// tabs as «Comandas0» and «Listas0» (measured on hub:stable and hub:dev, ios and md) — a name
// that changes with every ticket and never equals the word on screen.
//
// The counter is `aria-hidden`, so the name is the view word the tab paints. NOT `aria-label` on
// the host: Ionic copies it onto its `role="tab"` button ONCE, at load (`inheritAttributes(el,
// ['aria-label'])`, no watcher), while this screen repaints in place on `erplora:locale-changed` —
// the tabs kept announcing «Comandas» under a visible «Tickets» after switching to English
// (measured on hub:stable, rv-kitchen-137). happy-dom has no Ionic, so `ion-segment-button` is
// stubbed below with exactly that load-once behaviour and the name is computed the way the browser
// does for a tab: its aria-label, else its content minus aria-hidden subtrees.
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

// Ionic's segment-button, as far as the tab's name goes: at load it moves the host's aria-label
// onto its native role="tab" button and never reads it again; the tab's content is the slot.
class FakeSegmentButton extends HTMLElement {
  connectedCallback() {
    if (this.shadowRoot) return;
    const inherited = this.getAttribute('aria-label');
    this.removeAttribute('aria-label');
    const tab = document.createElement('button');
    tab.setAttribute('role', 'tab');
    if (inherited !== null) tab.setAttribute('aria-label', inherited);
    tab.appendChild(document.createElement('slot'));
    this.attachShadow({ mode: 'open' }).appendChild(tab);
  }
}
if (!customElements.get('ion-segment-button')) customElements.define('ion-segment-button', FakeSegmentButton);

/** The tab's accessible name: its aria-label, else the text it slots in minus aria-hidden subtrees. */
function tabName(host: HTMLElement): string {
  const tab = host.shadowRoot?.querySelector('[role="tab"]');
  expect(tab, 'ion-segment-button stub rendered its role=tab button').toBeTruthy();
  const label = tab!.getAttribute('aria-label');
  if (label) return label.trim();
  const text = (n: Node): string =>
    n.nodeType === Node.TEXT_NODE
      ? (n.textContent ?? '')
      : (n as Element).getAttribute?.('aria-hidden') === 'true'
        ? ''
        : [...n.childNodes].map(text).join('');
  return [...host.childNodes].map(text).join('').trim();
}

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
  const word = (l: Locale, key: string) => (CATALOGS[l].ui as Record<string, string>)[key];

  it('each view tab carries the bare view name as its accessible name', async () => {
    locale = lang;
    const el = await mount();
    for (const v of VIEWS) {
      const button = el.shadowRoot.querySelector<HTMLElement>(`[data-testid="${v.testid}"]`);
      expect(button, v.testid).not.toBeNull();
      expect(word(lang, v.key), `${lang}.ui.${v.key}`).toBeTruthy();
      expect(tabName(button!), v.testid).toBe(word(lang, v.key));
    }
    el.remove();
  });

  it('a live language change renames the tabs with the words they now paint', async () => {
    locale = lang;
    const el = await mount();
    const next: Locale = lang === 'es' ? 'en' : 'es';
    locale = next;
    window.dispatchEvent(new CustomEvent('erplora:locale-changed', { detail: { locale: next } }));
    await el.updateComplete;
    for (const v of VIEWS) {
      const button = el.shadowRoot.querySelector<HTMLElement>(`[data-testid="${v.testid}"]`)!;
      expect(word(next, v.key), `${next}.ui.${v.key}`).not.toBe(word(lang, v.key));
      expect(tabName(button), `${v.testid} after switching to ${next}`).toBe(word(next, v.key));
    }
    el.remove();
  });

  it('the counter stays painted on the tab, apart from its name', async () => {
    locale = lang;
    const el = await mount();
    for (const v of VIEWS.filter((x) => x.count)) {
      const button = el.shadowRoot.querySelector<HTMLElement>(`[data-testid="${v.testid}"]`)!;
      expect(button.querySelector(`[data-count="${v.count}"]`)?.textContent?.trim(), v.testid).toBe('1');
      expect(tabName(button), v.testid).toBe(word(lang, v.key));
    }
    el.remove();
  });
});
