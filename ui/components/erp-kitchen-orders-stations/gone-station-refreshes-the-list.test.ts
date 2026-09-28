// kitchen#126 — deleting a station that no longer exists (someone deleted it on another device, or
// the trash can was pressed twice before the list refreshed) said «this station still has products
// or categories routed to it». The reason was false: the station was already gone.
//
// The runtime now refuses with its own code, `kitchen.station_unavailable`. The screen says THAT
// sentence on the page (a row delete involves no form, rv-appointments-227) and refreshes the list,
// so the ghost row the person just tried to delete disappears — like the tickets do with
// `kitchen.order_unavailable`. A station that is really in use keeps its own refusal (kitchen#124)
// and stays on the list.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import es from '../../../locales/es.json';

const BAR = { id: 'st1', name: 'Bar', name_es: 'Barra', color: '#F97316', icon: 'flame', printer_name: '', is_active: 1 };
const GRILL = { id: 'st2', name: 'Grill', name_es: 'Plancha', color: '#2DD36F', icon: 'flame', printer_name: '', is_active: 1 };

/** What the server has right now: another device may have deleted a station behind this screen. */
let serverRows: Array<Record<string, unknown>> = [];
let reads = 0;
/** The refusal the next delete gets, as the SDK throws it: an Error carrying the domain code and
 *  the module's own sentence (hub#1570). */
let refusal: { code: string; message: string } | null = null;

beforeEach(() => {
  document.body.querySelectorAll('ion-alert').forEach((a) => a.remove());
  serverRows = [BAR, GRILL];
  reads = 0;
  refusal = null;
  vi.spyOn(HTMLElement.prototype, 'scrollIntoView').mockImplementation(() => {});
  (globalThis as Record<string, unknown>).erplora = {
    query: async () => [],
    queryPage: async () => {
      reads++;
      return { rows: serverRows, total: serverRows.length };
    },
    command: async () => {
      if (refusal) throw Object.assign(new Error(refusal.message), { code: refusal.code });
      return {};
    },
    on: () => () => {},
    locale: 'es',
    t: (_c: unknown, key: string, p?: Record<string, unknown>) => {
      let cur: unknown = es;
      for (const part of key.split('.')) cur = cur && typeof cur === 'object' ? (cur as Record<string, unknown>)[part] : undefined;
      const text = typeof cur === 'string' ? cur : key;
      return text.replace(/\{(\w+)\}/g, (m, k: string) => (p && k in p ? String(p[k]) : m));
    },
  };
});

type Wc = HTMLElement & { shadowRoot: ShadowRoot; updateComplete: Promise<unknown> };
type AlertEl = HTMLElement & { buttons: Array<{ role?: string; handler?: () => unknown }> };
type Table = HTMLElement & { shadowRoot: ShadowRoot; updateComplete: Promise<unknown> };

async function settle(el: Wc): Promise<void> {
  for (let i = 0; i < 3; i++) {
    await el.updateComplete;
    await new Promise((r) => setTimeout(r, 0));
  }
}

async function mount(): Promise<Wc> {
  await import('./erp-kitchen-orders-stations');
  const el = document.createElement('erp-kitchen-orders-stations') as Wc;
  document.body.appendChild(el);
  await settle(el);
  return el;
}

const table = (el: Wc) => el.shadowRoot.querySelector('ok-data-table') as Table;

/** The person taps the REAL trash can of the row and confirms. */
async function deleteRow(el: Wc, id: string): Promise<void> {
  await table(el).updateComplete;
  const btn = table(el).shadowRoot.querySelector(`[data-testid="kitchen-stations-table-row-${id}-delete"]`) as HTMLElement | null;
  expect(btn, `the real «delete» button of row ${id}`).toBeTruthy();
  btn!.click();
  await settle(el);
  const alert = document.body.querySelector('ion-alert[data-testid="kitchen-stations-delete-confirm"]') as AlertEl | null;
  expect(alert, 'the delete confirmation').toBeTruthy();
  await alert!.buttons.find((b) => b.role === 'destructive')?.handler?.();
  alert!.dispatchEvent(new CustomEvent('ionAlertDidDismiss', { detail: { role: 'destructive' } }));
  await settle(el);
}

const pageNotice = (el: Wc) => el.shadowRoot.querySelector('[data-testid="kitchen-stations-error"]');
const rowIds = (el: Wc) =>
  ((table(el) as unknown as { rows?: Array<{ id: string }> }).rows ?? []).map((r) => r.id);

describe('kitchen#126 · deleting a station that is already gone', () => {
  it('says the station is not available — not that it still has routings', async () => {
    const el = await mount();
    serverRows = [BAR]; // «Plancha» was deleted on another device; this screen still shows it
    refusal = { code: 'kitchen.station_unavailable', message: es.errors['kitchen.station_unavailable'] };
    await deleteRow(el, 'st2');
    expect(pageNotice(el)?.textContent?.trim()).toBe(
      'Esa estación no está disponible: no existe en este negocio o ya se ha borrado. Actualiza la lista.',
    );
    expect(pageNotice(el)?.textContent).not.toContain(es.errors['kitchen.station_in_use']);
  });

  it('refreshes the list, so the ghost row disappears, and keeps the notice above the table', async () => {
    const el = await mount();
    const before = reads;
    serverRows = [BAR];
    refusal = { code: 'kitchen.station_unavailable', message: es.errors['kitchen.station_unavailable'] };
    await deleteRow(el, 'st2');
    expect(reads, 'the list is read again after the refusal').toBeGreaterThan(before);
    expect(rowIds(el), 'the station deleted elsewhere is no longer on the list').toEqual(['st1']);
    const notice = pageNotice(el);
    expect(notice, 'the refresh does not wipe the reason').toBeTruthy();
    expect(
      notice!.compareDocumentPosition(table(el)) & Node.DOCUMENT_POSITION_FOLLOWING,
      'the notice sits ABOVE the table, where a phone sees it (rv-taxes-81)',
    ).toBeTruthy();
  });

  it('a station really in use keeps its own reason (kitchen#124) and stays on the list', async () => {
    const el = await mount();
    refusal = { code: 'kitchen.station_in_use', message: es.errors['kitchen.station_in_use'] };
    await deleteRow(el, 'st2');
    expect(pageNotice(el)?.textContent?.trim()).toBe(es.errors['kitchen.station_in_use']);
    expect(rowIds(el)).toEqual(['st1', 'st2']);
  });
});
