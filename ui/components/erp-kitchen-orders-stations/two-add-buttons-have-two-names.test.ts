// kitchen#121 — with the «New» panel of Stations open, TWO buttons were called «Add» / «Añadir»: the
// one in the table bar (opens the panel) and the submit of the panel (creates the station). A
// screen reader heard the same name twice and could not tell which one creates. It happens on a
// phone too: the panel covers the bar as a full-screen sheet, but both stay in the accessibility tree.
//
// The fix follows the pattern OutfitKit anchored in outfitkit#220: the bar button is named per table
// with `.labels=${{ add: … }}` («Add station»), and the submit says what it does («Create station»).
// Both in `en` (the source) and `es` (every app is translated, ADR-0055/0199).
import { beforeEach, describe, expect, it } from 'vitest';
import en from '../../../locales/en.json';
import es from '../../../locales/es.json';

const CATALOGS: Record<string, unknown> = { en, es };

const STATIONS = [
  { id: 'st1', name: 'Bar', name_es: 'Barra', color: '#F97316', icon: 'flame', printer_name: '', is_active: 1 },
];

/** Resolves `ui.x` against the REAL module catalog, so the test hears the words a person hears. */
function translate(lang: string, key: string): string {
  const value = key.split('.').reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], CATALOGS[lang]);
  return typeof value === 'string' ? value : key;
}

/** happy-dom has no matchMedia: the viewport is whatever this stub says. */
function viewport(mobile: boolean): void {
  (window as unknown as { matchMedia: unknown }).matchMedia = (q: string) => ({
    media: q, matches: mobile, onchange: null,
    addListener: () => {}, removeListener: () => {},
    addEventListener: () => {}, removeEventListener: () => {},
    dispatchEvent: () => false,
  });
}

function sdk(lang: string): void {
  (globalThis as Record<string, unknown>).erplora = {
    query: async () => [],
    queryPage: async () => ({ rows: STATIONS, total: STATIONS.length }),
    command: async () => ({}),
    on: () => () => {},
    locale: lang,
    t: (_catalog: unknown, key: string) => translate(lang, key),
  };
}

type Table = HTMLElement & { shadowRoot: ShadowRoot; updateComplete: Promise<unknown>; open(p?: 'filters' | 'create'): void };
type Wc = HTMLElement & { shadowRoot: ShadowRoot; updateComplete: Promise<unknown> };

async function settle(el: { updateComplete: Promise<unknown> }): Promise<void> {
  await el.updateComplete;
  await new Promise((r) => setTimeout(r, 0));
  await el.updateComplete;
}

/** Mounts Stations and opens its «New» panel, the moment both buttons coexist. */
async function mountWithPanelOpen(): Promise<{ bar: HTMLElement; submit: HTMLElement }> {
  await import('./erp-kitchen-orders-stations');
  const el = document.createElement('erp-kitchen-orders-stations') as Wc;
  document.body.appendChild(el);
  await settle(el);
  const table = el.shadowRoot.querySelector('ok-data-table') as Table;
  table.open('create');
  await settle(table);
  const bar = table.shadowRoot.querySelector('[data-testid="kitchen-stations-table-add"]') as HTMLElement | null;
  const submit = el.shadowRoot.querySelector('[data-testid="kitchen-stations-create-submit"]') as HTMLElement | null;
  expect(bar, 'the bar button that opens the panel').toBeTruthy();
  expect(submit, 'the submit of the panel').toBeTruthy();
  return { bar: bar!, submit: submit! };
}

/** An ion-button is named by its text (the icon is decorative) unless an aria-label overrides it. */
const accessibleName = (btn: HTMLElement): string => (btn.getAttribute('aria-label') ?? btn.textContent ?? '').trim();

const EXPECTED = {
  en: { bar: 'Add station', submit: 'Create station', generic: 'Add' },
  es: { bar: 'Añadir estación', submit: 'Crear estación', generic: 'Añadir' },
} as const;

describe('Stations: the bar button and the panel submit are two different buttons with two names (kitchen#121)', () => {
  beforeEach(() => {
    document.body.replaceChildren();
  });

  for (const lang of ['en', 'es'] as const) {
    for (const mobile of [false, true]) {
      const vp = mobile ? 'phone' : 'desktop';

      it(`${lang} · ${vp}: the bar button says it adds a station`, async () => {
        viewport(mobile);
        sdk(lang);
        document.documentElement.lang = lang;
        const { bar } = await mountWithPanelOpen();
        expect(accessibleName(bar)).toBe(EXPECTED[lang].bar);
      });

      it(`${lang} · ${vp}: the panel submit says it creates the station`, async () => {
        viewport(mobile);
        sdk(lang);
        document.documentElement.lang = lang;
        const { submit } = await mountWithPanelOpen();
        expect(accessibleName(submit)).toBe(EXPECTED[lang].submit);
      });

      it(`${lang} · ${vp}: no two buttons share a name, and neither is the bare «${EXPECTED[lang].generic}»`, async () => {
        viewport(mobile);
        sdk(lang);
        document.documentElement.lang = lang;
        const { bar, submit } = await mountWithPanelOpen();
        expect(accessibleName(bar)).not.toBe(accessibleName(submit));
        expect([accessibleName(bar), accessibleName(submit)]).not.toContain(EXPECTED[lang].generic);
      });
    }
  }
});
