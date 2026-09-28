// kitchen#115: the trash can of a station row deleted the station on the FIRST tap — no question,
// no undo. A station is configuration the whole kitchen leans on (routing, tickets, printers), and
// every POS back office of the sector (Square, Toast, Lightspeed, Odoo) asks before deleting it.
//
// The confirmation is a GLOBAL Ionic overlay appended to document.body (the recipe of
// appointments#207 and the void dialog of sales): an inline <ion-alert> inside this shadow root
// loses its styles when Ionic teleports it to ion-app, and the first time in a session its backdrop
// covers its own buttons (hub#2162).
import { beforeEach, describe, expect, it, vi } from 'vitest';
import en from '../../../locales/en.json';
import es from '../../../locales/es.json';

const STATIONS = [
  { id: 'st1', name: 'Bar', name_es: 'Barra', color: '#F97316', icon: 'flame', printer_name: 'COCINA-1', is_active: 1 },
  { id: 'st2', name: 'Grill', name_es: 'Plancha', color: '#2DD36F', icon: 'flame', printer_name: '', is_active: 1 },
];

const REFUSAL = 'This station cannot be deleted.';

let refuse: string | null = null;
let hold: Promise<void> | null = null;
let reads = 0;
let commands: Array<{ name: string; payload: unknown }> = [];

beforeEach(() => {
  refuse = null;
  hold = null;
  reads = 0;
  commands = [];
  document.body.querySelectorAll('ion-alert').forEach((a) => a.remove());
  vi.spyOn(HTMLElement.prototype, 'scrollIntoView').mockImplementation(() => {});
  (globalThis as Record<string, unknown>).erplora = {
    query: async () => [],
    queryPage: async () => {
      reads++;
      return { rows: STATIONS, total: STATIONS.length };
    },
    command: async (name: string, payload: unknown) => {
      commands.push({ name, payload });
      const wait = hold;
      if (wait) await wait;
      if (refuse !== null) throw new Error(refuse);
      return {};
    },
    on: () => () => {},
    locale: 'es',
    // Resolves against the real `es` catalogue and interpolates, so the dialog is checked in the
    // words the person reads.
    t: (_c: unknown, key: string, p?: Record<string, unknown>) => {
      let cur: unknown = es;
      for (const part of key.split('.')) cur = cur && typeof cur === 'object' ? (cur as Record<string, unknown>)[part] : undefined;
      const text = typeof cur === 'string' ? cur : key;
      return text.replace(/\{(\w+)\}/g, (m, k: string) => (p && k in p ? String(p[k]) : m));
    },
  };
});

type Wc = HTMLElement & { shadowRoot: ShadowRoot; updateComplete: Promise<unknown> } & Record<string, any>;
type AlertButton = { text: string; role?: string; handler?: () => unknown };
type AlertEl = HTMLElement & { header: string; message: string; buttons: AlertButton[]; isOpen?: boolean };

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

const confirmAlert = (): AlertEl | null =>
  document.body.querySelector('ion-alert[data-testid="kitchen-stations-delete-confirm"]') as AlertEl | null;

const deletes = () => commands.filter((c) => c.name === 'kitchen.stations.delete');

/** The person taps the REAL trash can of the row, in the table (not a synthetic rowAction). */
async function tapDelete(el: Wc, id = 'st2'): Promise<void> {
  const table = el.shadowRoot.querySelector('ok-data-table') as HTMLElement & { updateComplete: Promise<unknown> };
  await table.updateComplete;
  const btn = table.shadowRoot?.querySelector(`[data-testid="kitchen-stations-table-row-${id}-delete"]`) as HTMLElement | null;
  expect(btn, `the real «delete» button of row ${id}`).toBeTruthy();
  btn?.click();
  await settle(el);
}

async function press(el: Wc, role: 'cancel' | 'destructive'): Promise<void> {
  const alert = confirmAlert();
  expect(alert, 'the delete confirmation is open').toBeTruthy();
  const btn = alert?.buttons.find((b) => b.role === role);
  expect(btn, `the «${role}» button of the confirmation`).toBeTruthy();
  await btn?.handler?.();
  alert?.dispatchEvent(new CustomEvent('ionAlertDidDismiss', { detail: { role } }));
  await settle(el);
}

const pageNotice = (el: Wc): string | undefined =>
  el.shadowRoot.querySelector('[data-testid="kitchen-stations-error"]')?.textContent?.trim();

describe('kitchen#115 · deleting a station asks first', () => {
  it('tapping the trash can deletes nothing: it opens a confirmation on document.body, in Spanish', async () => {
    const el = await mount();
    await tapDelete(el);
    expect(deletes(), 'nothing is deleted on the first tap').toEqual([]);
    const alert = confirmAlert();
    expect(alert, 'a GLOBAL overlay, not an inline alert inside the shadow root (hub#2162)').toBeTruthy();
    expect(el.shadowRoot.querySelector('ion-alert'), 'no inline alert in the shadow root').toBeNull();
    expect(alert?.isOpen, 'the confirmation is actually shown').toBe(true);
    expect(alert?.header, 'it names the station it is about to delete').toBe(
      es.ui.deleteStationTitle.replace('{name}', 'Plancha'),
    );
    expect(alert?.message).toBe(es.ui.deleteStationMessage);
    expect(alert?.buttons.map((b) => [b.role, b.text])).toEqual([
      ['cancel', es.ui.cancel],
      ['destructive', es.ui.rowDelete],
    ]);
  });

  it('confirming deletes THAT station, reloads the list and removes the dialog', async () => {
    const el = await mount();
    const before = reads;
    await tapDelete(el);
    await press(el, 'destructive');
    expect(deletes().map((c) => c.payload)).toEqual([{ station_id: 'st2' }]);
    expect(reads, 'the list is read again so the station leaves it').toBeGreaterThan(before);
    expect(confirmAlert(), 'the dialog is removed after closing').toBeNull();
  });

  it('cancelling deletes nothing and removes the dialog', async () => {
    const el = await mount();
    await tapDelete(el);
    await press(el, 'cancel');
    expect(deletes()).toEqual([]);
    expect(confirmAlert()).toBeNull();
  });

  it('dismissing it (backdrop / Esc) deletes nothing and removes the dialog', async () => {
    const el = await mount();
    await tapDelete(el);
    confirmAlert()?.dispatchEvent(new CustomEvent('ionAlertDidDismiss', { detail: { role: 'backdrop' } }));
    await settle(el);
    expect(deletes()).toEqual([]);
    expect(confirmAlert()).toBeNull();
  });

  it('the dialog does not linger once Ionic puts it back where it was after dismissing', async () => {
    const el = await mount();
    await tapDelete(el);
    const alert = confirmAlert();
    // Ionic emits ionAlertDidDismiss and only THEN moves the teleported overlay back to its original
    // parent: a synchronous remove() in the listener is undone and a hidden alert piles up per tap.
    alert?.addEventListener('ionAlertDidDismiss', () => {
      void Promise.resolve().then(() => alert && document.body.appendChild(alert));
    });
    alert?.dispatchEvent(new CustomEvent('ionAlertDidDismiss', { detail: { role: 'cancel' } }));
    await settle(el);
    expect(confirmAlert()).toBeNull();
  });

  it('a refused delete is explained on the PAGE, above the list (not in a form, not in the dialog)', async () => {
    const el = await mount();
    refuse = REFUSAL;
    await tapDelete(el);
    await press(el, 'destructive');
    expect(pageNotice(el)).toBe(REFUSAL);
    const notice = el.shadowRoot.querySelector('[data-testid="kitchen-stations-error"]')!;
    const table = el.shadowRoot.querySelector('ok-data-table')!;
    expect(
      notice.compareDocumentPosition(table) & Node.DOCUMENT_POSITION_FOLLOWING,
      'on a phone with cards, a notice under the table is never seen (rv-taxes-81)',
    ).toBeTruthy();
  });

  it('confirming another delete clears the earlier refusal as soon as it starts (customers#97)', async () => {
    const el = await mount();
    refuse = REFUSAL;
    await tapDelete(el);
    await press(el, 'destructive');
    expect(pageNotice(el)).toBe(REFUSAL);

    refuse = null;
    let release!: () => void;
    hold = new Promise((r) => (release = r));
    await tapDelete(el, 'st1');
    expect(pageNotice(el), 'opening the question alone does not wipe the reason yet').toBe(REFUSAL);
    const alert = confirmAlert();
    const attempt = alert?.buttons.find((b) => b.role === 'destructive')?.handler?.();
    await settle(el);
    expect(pageNotice(el), 'the retry is in flight: the old reason is gone').toBeUndefined();
    release();
    await attempt;
    await settle(el);
    expect(pageNotice(el)).toBeUndefined();
  });

  it('the dialog has its sentence in en and es, and es is a translation', () => {
    for (const key of ['deleteStationTitle', 'deleteStationMessage'] as const) {
      expect(typeof en.ui[key] === 'string' && en.ui[key].trim(), `en ui.${key}`).toBeTruthy();
      expect(typeof es.ui[key] === 'string' && es.ui[key].trim(), `es ui.${key}`).toBeTruthy();
      expect(es.ui[key], `ui.${key}: the es sentence is not the en one copied`).not.toBe(en.ui[key]);
    }
    expect(en.ui.deleteStationTitle).toContain('{name}');
    expect(es.ui.deleteStationTitle).toContain('{name}');
  });
});
