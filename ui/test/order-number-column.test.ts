// The ticket number is read WHOLE in the lists, also on a tablet (kitchen#134).
//
// WHAT HAPPENED. «Comandas» declared no `width` for its «Order» column, so `ok-data-table` gave it
// the default track `minmax(5.5rem,1fr)`. On an 820 px tablet in portrait that track resolves to
// 105 px, and on a 1024 px tablet in landscape (side menu open) to 100 px — while
// `20260928-0012` needs 107 px at 14 px (Chromium, ios and md). The cell cut it with an ellipsis
// and every row of the day read «20260928-00…»: the part that tells one ticket from the other is
// the end, and it was the part hidden. «Historial» had the same default and cut the number in the
// list view of a phone (88 px).
//
// THE CONTRACT pinned here (happy-dom does no layout — the real measure is in the PR: every number
// whole at 390/820/1024/1440, ios and md, en and es):
//   1. the column that paints the number declares its own track, in BOTH lists;
//   2. the track's minimum is a LENGTH (rem/px): the header and every row are separate grids that
//      share the template, so a content-sized minimum (`max-content`) would resolve differently in
//      each and misalign the header (outfitkit#121);
//   3. that minimum holds the widest number the module issues — `YYYYMMDD-NNNN`, one more digit
//      once the day's counter passes 9999 — at the table's 14 px, with room for the widest UI
//      digit (≈0.6 em: SF, Roboto);
//   4. and it does not buy that by pushing the rest out: the minima of every column of «Comandas»
//      still fit the tightest tablet box measured (1024×768 with the side menu: 752 px).
import { beforeEach, describe, expect, it } from 'vitest';

import '../components/erp-kitchen-orders-active/erp-kitchen-orders-active';
import '../components/erp-kitchen-history/erp-kitchen-history';

type Column = { key: string; width?: string; hidden?: boolean };
type Mounted = HTMLElement & { shadowRoot: ShadowRoot; updateComplete: Promise<unknown> };

const ROOT_PX = 16;
const TABLE_FONT_PX = 14; // `.grid { font-size: 14px }` in ok-data-table
const WIDEST_DIGIT_EM = 0.6;
const WIDEST_NUMBER_CHARS = '20260928-10000'.length; // the counter past 9999 grows a digit
const NUMBER_NEEDS_PX = WIDEST_NUMBER_CHARS * WIDEST_DIGIT_EM * TABLE_FONT_PX; // 117.6 px

// ok-data-table's own layout (outfitkit main): default track, gap and padding of a row, and the
// widest actions track (44 px tap floor on a touch screen).
const DEFAULT_MIN_PX = 5.5 * ROOT_PX;
const ROW_GAP_PX = 8;
const ROW_PADDING_PX = 32;
const ACTIONS_PX = 44;
const TIGHTEST_TABLET_BOX_PX = 752;

function shellSpeaking(locale: string) {
  document.body.replaceChildren();
  (globalThis as Record<string, unknown>).erplora = {
    query: async () => [],
    queryPage: async () => ({ rows: [], total: 0, limit: 50, offset: 0 }),
    command: async () => ({}),
    on: () => () => {},
    hasPermission: () => true,
    locale,
    t: (catalog: Record<string, unknown>, key: string) => {
      const lang = (catalog[locale] ?? catalog.en) as Record<string, Record<string, string>>;
      const [section, name] = key.split('.');
      return lang?.[section]?.[name] ?? key;
    },
    formatMoney: (minor: number) => `${((minor || 0) / 100).toFixed(2)} €`,
    currencyDecimals: 2,
    timezone: 'Europe/Madrid',
  };
}

async function columnsOf(tag: string): Promise<Column[]> {
  const el = document.createElement(tag) as Mounted;
  document.body.appendChild(el);
  await el.updateComplete;
  await new Promise((resolve) => setTimeout(resolve, 0));
  await el.updateComplete;
  const table = el.shadowRoot.querySelector('ok-data-table') as unknown as { columns: Column[] } | null;
  expect(table, `${tag} did not paint its ok-data-table`).toBeTruthy();
  return table!.columns;
}

/** Minimum of a grid track in px when it is a LENGTH (`8rem`, `128px`, `minmax(8rem,1fr)`); null otherwise. */
function minLengthPx(width: string | undefined): number | null {
  if (!width) return null;
  const inner = width.trim().match(/^minmax\(\s*([^,]+?)\s*,/)?.[1] ?? width.trim();
  const m = inner.match(/^(\d+(?:\.\d+)?)(rem|px)$/);
  if (!m) return null;
  return Number(m[1]) * (m[2] === 'rem' ? ROOT_PX : 1);
}

const LISTS = ['erp-kitchen-orders-active', 'erp-kitchen-history'];

describe('the ticket number is read whole (kitchen#134)', () => {
  beforeEach(() => shellSpeaking('es'));

  for (const tag of LISTS) {
    for (const locale of ['es', 'en']) {
      it(`${tag} (${locale}): the «Order» column declares a fixed minimum that holds the whole number`, async () => {
        shellSpeaking(locale);
        const col = (await columnsOf(tag)).find((c) => c.key === 'order_number');
        expect(col, `${tag} has no order_number column`).toBeTruthy();
        expect(col!.width, `${tag}: the number column takes the default 5.5rem track and is cut on a tablet`).toBeTruthy();
        const min = minLengthPx(col!.width);
        expect(min, `${tag}: the number column's minimum is not a length (\`${col!.width}\`) — header and rows would misalign`).not.toBeNull();
        expect(min!, `${tag}: ${min}px cannot hold «20260928-10000» (${NUMBER_NEEDS_PX}px)`).toBeGreaterThanOrEqual(NUMBER_NEEDS_PX);
      });
    }
  }

  it('«Comandas» still fits the tightest tablet box: every column keeps its floor', async () => {
    const cols = (await columnsOf('erp-kitchen-orders-active')).filter((c) => !c.hidden);
    const minima = cols.map((c) => (c.width ? minLengthPx(c.width) : DEFAULT_MIN_PX));
    expect(minima.every((m) => m !== null), `a column's width has no length minimum: ${cols.map((c) => c.width).join(' · ')}`).toBe(true);
    const tracks = [...(minima as number[]), ACTIONS_PX];
    const needed = tracks.reduce((a, b) => a + b, 0) + (tracks.length - 1) * ROW_GAP_PX + ROW_PADDING_PX;
    expect(needed, `the minima need ${needed}px on a ${TIGHTEST_TABLET_BOX_PX}px tablet box`).toBeLessThanOrEqual(TIGHTEST_TABLET_BOX_PX);
  });
});
