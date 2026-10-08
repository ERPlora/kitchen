// The three columns of the Historial are for a PERSON, not for a database (kitchen#44).
//
// What the screen showed until now was the storage format of each value: the action as its raw
// code (`bumped`), the ticket as the UUID of its row, and the moment as the runtime's ISO text —
// 29 characters, nanosecond precision, UTC. Useful to nobody: the whole point of the trail is to
// match an action with the ticket you are looking at on the KDS, which shows `#0001`, not a UUID.
//
// What this file pins, per column, against the REAL es catalog (the cell must speak the hub's
// language, exactly like the filter dropdown already did):
//   · ACCIÓN — the same label map the dropdown builds; an unknown code (an API-only value such as
//     `accepted`) keeps its raw text instead of vanishing: a hole you can SEE is a hole you can
//     report;
//   · COMANDA — the ticket's `order_number` (`kitchen.logs.list` resolves it with a join), with
//     the id as the fallback of last resort;
//   · CUÁNDO — date and time in the hub's locale and zone, without fractions of a second.
import { beforeEach, describe, expect, it } from 'vitest';
import esLocale from '../../../locales/es.json';

type Row = Record<string, unknown>;

const LOG_ROWS: Row[] = [
  {
    id: 'log-1',
    order_id: '6bffd613-42ee-4487-aaed-a1051f95cd2a',
    order_number: '20260821-0001',
    order_item_id: null,
    station_id: null,
    action: 'item_bumped',
    performed_by_id: 'u1',
    notes: '',
    // What the runtime hands back: ISO text with NANOSECONDS and UTC offset (kitchen#44).
    created_at: '2026-08-21T22:48:45.617563259+00:00',
  },
  {
    id: 'log-2',
    order_id: '6bffd613-42ee-4487-aaed-a1051f95cd2a',
    order_number: '20260821-0001',
    order_item_id: null,
    station_id: null,
    action: 'accepted', // API-only value: never in the dropdown, must not render as blank
    performed_by_id: 'u1',
    notes: '',
    created_at: '2026-08-21T22:50:01+00:00',
  },
];

function label(code: string): string {
  const ui = (esLocale as { ui: Record<string, string> }).ui;
  const byAction: Record<string, string> = {
    received: ui.actionReceived,
    started: ui.actionStarted,
    bumped: ui.actionBumped,
    item_bumped: ui.actionItemBumped,
    item_recalled: ui.actionItemRecalled,
    item_voided: ui.actionItemVoided,
    served: ui.actionServed,
    recalled: ui.actionRecalled,
    cancelled: ui.actionCancelled,
  };
  return byAction[code] ?? code;
}

beforeEach(() => {
  (globalThis as Record<string, unknown>).erplora = {
    query: async () => [],
    queryPage: async () => ({ rows: LOG_ROWS, total: LOG_ROWS.length, limit: 50, offset: 0 }),
    on: () => () => {},
    locale: 'es',
    // The SDK's `t` walks the dotted key into the ACTIVE LANGUAGE of the catalog (ADR-0055) —
    // the mock must too, or every label comes back as its own key.
    t: (catalog: unknown, key: string) => {
      const byLang = catalog as Record<string, unknown>;
      const resolved = key
        .split('.')
        .reduce<unknown>((node, part) => (node as Record<string, unknown>)?.[part], byLang['es'] ?? byLang.en);
      return resolved ?? key;
    },
  };
});

type Host = HTMLElement & { shadowRoot: ShadowRoot; updateComplete: Promise<unknown> };

type Column = {
  key: string;
  format?: (row: Record<string, unknown>) => unknown;
  options?: { value: string; label: string }[];
};

async function mount(): Promise<Host> {
  await import('./erp-kitchen-history');
  const el = document.createElement('erp-kitchen-history') as Host;
  document.body.appendChild(el);
  for (let i = 0; i < 4; i++) {
    await el.updateComplete;
    await Promise.resolve();
  }
  return el;
}

/** The expected rendering of a known instant, with the hub's pattern: local date and time, no
 *  fractions. Built here with the same Intl options so the test cannot drift from the locale data
 *  itself (what it MUST catch is the raw ISO text with nanoseconds reaching the cell). */
function expectedWhen(iso: string): string {
  return new Intl.DateTimeFormat('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
}

describe('ACCIÓN — the cell speaks the hub language, like the dropdown already did', () => {
  it('a known action renders its translated label, not the raw code', async () => {
    const el = await mount();
    const cols = (el as unknown as { columns: Column[] }).columns;
    const action = cols.find((c) => c.key === 'action');
    expect(action?.format, 'the action column has no `format` — the raw code reaches the cell').toBeTypeOf('function');
    expect(action!.format!(LOG_ROWS[0])).toBe(label('item_bumped'));
  });

  it('the label map is THE SAME the dropdown offers (one map, not two that drift)', async () => {
    const el = await mount();
    const cols = (el as unknown as { columns: Column[] }).columns;
    const action = cols.find((c) => c.key === 'action');
    for (const opt of action?.options ?? []) {
      expect(action!.format!({ action: opt.value })).toBe(opt.label);
    }
  });

  it('kitchen#161 · a line the till voided reads «Línea anulada» and the filter offers it', async () => {
    const el = await mount();
    const cols = (el as unknown as { columns: Column[] }).columns;
    const action = cols.find((c) => c.key === 'action')!;
    expect(label('item_voided'), 'the es catalog has no actionItemVoided').toBe('Línea anulada');
    expect(action.format!({ action: 'item_voided' })).toBe('Línea anulada');
    expect(action.options?.map((o) => o.value)).toContain('item_voided');
  });

  it('an API-only code (accepted) keeps its raw text: a visible hole, not a blank cell', async () => {
    const el = await mount();
    const cols = (el as unknown as { columns: Column[] }).columns;
    const action = cols.find((c) => c.key === 'action')!;
    expect(action.format!(LOG_ROWS[1])).toBe('accepted');
  });
});

describe('COMANDA — the number the KDS shows, not the UUID of the row', () => {
  it('renders order_number when the query resolved it', async () => {
    const el = await mount();
    const cols = (el as unknown as { columns: Column[] }).columns;
    const order = cols.find((c) => c.key === 'order_number');
    expect(order, 'there is no order_number column — the cell still paints order_id').toBeTruthy();
    expect(order!.format!(LOG_ROWS[0])).toBe('20260821-0001');
  });

  it('falls back to the id when no number came back (the row never blanks)', async () => {
    const el = await mount();
    const cols = (el as unknown as { columns: Column[] }).columns;
    const order = cols.find((c) => c.key === 'order_number')!;
    expect(order.format!({ ...LOG_ROWS[0], order_number: null })).toBe(LOG_ROWS[0].order_id);
  });

  it('the card title (mobile) shows the number too', async () => {
    const el = await mount();
    const table = el.shadowRoot.querySelector('ok-data-table') as unknown as { cardTitle: (r: Row) => string };
    expect(table?.cardTitle, 'ok-data-table was not rendered').toBeTypeOf('function');
    expect(table.cardTitle(LOG_ROWS[0])).toContain('20260821-0001');
  });
});

describe('CUÁNDO — local date and time, without fractions of a second', () => {
  it('formats the nanosecond ISO text in the hub locale: no T, no nanoseconds, no UTC offset', async () => {
    const el = await mount();
    const cols = (el as unknown as { columns: Column[] }).columns;
    const when = cols.find((c) => c.key === 'created_at');
    expect(when?.format, 'the created_at column has no `format` — the raw ISO text reaches the cell').toBeTypeOf('function');
    const rendered = String(when!.format!(LOG_ROWS[0]));
    expect(rendered).toBe(expectedWhen('2026-08-21T22:48:45.617563259+00:00'));
    expect(rendered).not.toContain('T');
    expect(rendered).not.toContain('617563259');
    expect(rendered).not.toContain('+00:00');
  });

  it('an unparseable value stays as-is instead of rendering "Invalid Date"', async () => {
    const el = await mount();
    const cols = (el as unknown as { columns: Column[] }).columns;
    const when = cols.find((c) => c.key === 'created_at')!;
    expect(String(when.format!({ created_at: 'not-a-date' }))).toBe('not-a-date');
  });
});
