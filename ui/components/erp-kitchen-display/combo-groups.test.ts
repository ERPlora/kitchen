// kitchen#57 · a menu is painted as a HEADER with its components LISTED under it — never as a
// run-on paragraph (ADR-0381).
//
// The two failures this replaces are shipping in mature products today:
//   · Square prints the combo as one run-on block of text and a moderator confirms there is no
//     way to get one component per line;
//   · TouchBistro makes every component inherit the MAIN DISH's printer, so the salad inside the
//     menu comes out of the grill.
//
// What the market says, and what this file pins (13 references, 5 forum threads — the table is in
// the PR and in `architecture/modules/kitchen.md`):
//   · Oracle Simphony · Toast · Odoo — the combo keeps its parent/child relationship and the
//     children hang UNDER the parent; Toast's «Print or show item with modifier(s)» vs «modifier(s)
//     only» is the same choice made explicit. We take the header, always;
//   · the header is REPEATED at every station that receives something. Simphony's option
//     `11 - Send to Combo Parent Order Devices` is exactly this switch, and Toast's alternative —
//     a component with no parent name — is the mode you have to opt into on purpose;
//   · Square · Lightspeed · LS Central · Fresh · TouchBistro — the bump is PER COMPONENT;
//   · Odoo gives the closing rule: «The card automatically moves to the next stage once every item
//     is crossed off». The group is never marked ready by hand — it closes when the last one falls;
//   · NO PRICES on a kitchen ticket, in any of them.
//
// The two typographic details — indent character and bold — are OURS, and said out loud: no
// product publishes them. What the forum does publish is what not to do, and that is the flat
// paragraph. So: components indented under a rule, and the emphasis LEFT ON THE DISH — the market
// reserves highlighting for allergens and changes (Revel prints modifiers in red, Fresh styles by
// keyword), never for hierarchy. A loud combo header would steal the eye from what gets cooked.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { groupCombos, type Line } from './erp-kitchen-display';

type Row = Record<string, unknown>;

const NOW = new Date('2026-08-24T13:00:00Z');
const minutesAgo = (m: number) => new Date(NOW.getTime() - m * 60_000).toISOString();

const T7 = {
  order_id: 'k1', order_number: '20260824-0001', order_status: 'preparing', order_type: 'dine_in',
  priority: 'normal', label: 'Mesa 7', round_number: 1, order_notes: '',
  order_fired_at: minutesAgo(4), ready_at: null, order_created_at: minutesAgo(4),
};

function feedLine(item: Row): Row {
  return {
    ...T7,
    station_id: 's-grill', station_name: 'Plancha', destination: 'both',
    modifiers: '', item_notes: '', item_status: 'pending', seat_number: null, completed_at: null,
    combo_ref: null, combo_name: '', line_seq: 0, quantity: 1_000_000,
    ...item,
  };
}

/** The menu del día of the first real customer: cold, grill and bar, fired as one sale line. */
let displayRows: Row[] = [];
let commands: Array<{ name: string; payload: Record<string, unknown> }> = [];
let listeners: Record<string, Array<(p: unknown) => void>> = {};

function seed() {
  displayRows = [
    feedLine({ item_id: 'i1', product_name: 'GAZPACHO', station_id: 's-cold', station_name: 'Fríos',
               combo_ref: 'cg-1', combo_name: 'MENU', line_seq: 1 }),
    feedLine({ item_id: 'i2', product_name: 'ENTRECOT', station_id: 's-grill', station_name: 'Plancha',
               modifiers: 'SIN CEBOLLA', combo_ref: 'cg-1', combo_name: 'MENU', line_seq: 2 }),
    feedLine({ item_id: 'i3', product_name: 'Vino tinto', station_id: 's-bar', station_name: 'Barra',
               combo_ref: 'cg-1', combo_name: 'MENU', line_seq: 3 }),
    // …and an à-la-carte dish fired in the same round: the control that matters.
    feedLine({ item_id: 'i4', product_name: 'Croquetas', station_id: 's-grill', station_name: 'Plancha',
               quantity: 2_000_000, line_seq: 4 }),
  ];
}

interface Host extends HTMLElement { shadowRoot: ShadowRoot; station: string; updateComplete: Promise<unknown>; }

/** The KDS reloads on `kitchen.item.*` / `kitchen.order.*` — no polling (kitchen#4). */
async function refresh(el: Host) {
  for (const cb of listeners['kitchen.item.bumped'] ?? []) cb({});
  await settle(el);
}

async function settle(el: Host) {
  for (let i = 0; i < 4; i++) { await el.updateComplete; await Promise.resolve(); }
}

async function mount(): Promise<Host> {
  await import('./erp-kitchen-display');
  const el = document.createElement('erp-kitchen-display') as Host;
  document.body.appendChild(el);
  await settle(el);
  return el;
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  seed();
  commands = [];
  listeners = {};
  (globalThis as Record<string, unknown>).erplora = {
    locale: 'es',
    t: (catalog: Record<string, Record<string, unknown>>, key: string, params?: Record<string, unknown>) => {
      const [ns, k] = key.split('.');
      const raw = (catalog.es?.[ns] as Record<string, string> | undefined)?.[k];
      if (!raw) return key;
      return raw.replace(/\{(\w+)\}/g, (_m, p) => String(params?.[p] ?? ''));
    },
    hasPermission: () => true,
    on: (event: string, cb: (p: unknown) => void) => { (listeners[event] ??= []).push(cb); return () => {}; },
    query: async (name: string) => {
      if (name === 'kitchen.orders.display') return displayRows;
      if (name === 'kitchen.orders.all_day') return [];
      if (name === 'kitchen.settings.get') return [{ show_timer: 1, warning_time_minutes: 15, critical_time_minutes: 30, color_coding_enabled: 1 }];
      if (name === 'kitchen.stations.list') return [
        { id: 's-cold', name: 'Cold', name_es: 'Fríos', is_active: 1 },
        { id: 's-grill', name: 'Grill', name_es: 'Plancha', is_active: 1 },
        { id: 's-bar', name: 'Bar', name_es: 'Barra', is_active: 1 },
      ];
      return [];
    },
    command: async (name: string, payload: Record<string, unknown>) => { commands.push({ name, payload }); return {}; },
  };
});

const card = (el: Host, id: string) => el.shadowRoot.querySelector<HTMLElement>(`[data-order="${id}"]`)!;
const groups = (c: HTMLElement) => Array.from(c.querySelectorAll<HTMLElement>('[data-combo]'));
const linesOf = (root: HTMLElement) => Array.from(root.querySelectorAll<HTMLElement>('[data-item]'));

// ── the pure grouping ────────────────────────────────────────────────────────────────────────

function ln(over: Partial<Line>): Line {
  return {
    id: 'x', station_id: null, station: '', destination: 'both', product_name: '',
    quantity: 1_000_000, modifiers: '', notes: '', status: 'pending', seat: null,
    combo_ref: null, combo_name: '', ...over,
  } as Line;
}

describe('groupCombos: a menu is one group of sibling lines, everything else is itself', () => {
  it('gathers consecutive lines that share a group and keeps the order of choice', () => {
    const out = groupCombos([
      ln({ id: 'i1', product_name: 'GAZPACHO', combo_ref: 'cg-1', combo_name: 'MENU' }),
      ln({ id: 'i2', product_name: 'ENTRECOT', combo_ref: 'cg-1', combo_name: 'MENU' }),
      ln({ id: 'i3', product_name: 'Vino', combo_ref: 'cg-1', combo_name: 'MENU' }),
      ln({ id: 'i4', product_name: 'Croquetas' }),
    ]);
    expect(out.map((g) => g.ref)).toEqual(['cg-1', null]);
    expect(out[0].name).toBe('MENU');
    expect(out[0].lines.map((l) => l.id)).toEqual(['i1', 'i2', 'i3']);
    expect(out[1].lines.map((l) => l.id)).toEqual(['i4']);
  });

  it('two menus of the SAME combo stay two groups — they are two tables\' worth of food', () => {
    const out = groupCombos([
      ln({ id: 'a1', combo_ref: 'cg-1', combo_name: 'MENU' }),
      ln({ id: 'b1', combo_ref: 'cg-2', combo_name: 'MENU' }),
    ]);
    expect(out).toHaveLength(2);
    expect(out.map((g) => g.ref)).toEqual(['cg-1', 'cg-2']);
  });

  it('an ordinary line never grows a header', () => {
    const out = groupCombos([ln({ id: 'i4', product_name: 'Croquetas' })]);
    expect(out).toEqual([{ ref: null, name: '', lines: [expect.objectContaining({ id: 'i4' })] }]);
  });
});

// ── the painted card ─────────────────────────────────────────────────────────────────────────

describe('the KDS paints the menu as a header with its components LISTED under it', () => {
  it('one header, three lines — never a paragraph of comma-separated components', async () => {
    const el = await mount();
    const c = card(el, 'k1');
    const g = groups(c);
    expect(g).toHaveLength(1);
    expect(g[0].dataset.combo).toBe('cg-1');
    expect(g[0].textContent).toContain('MENU');

    // The components are their OWN list items, each tappable: the whole point of kitchen#57.
    expect(linesOf(g[0]).map((l) => l.dataset.item)).toEqual(['i1', 'i2', 'i3']);
    // …and NOT a single line whose text carries all three names glued together.
    const glued = linesOf(c).filter((l) => /GAZPACHO.*ENTRECOT/s.test(l.textContent ?? ''));
    expect(glued).toEqual([]);

    // The à-la-carte dish is outside the group and keeps no header.
    expect(linesOf(c).map((l) => l.dataset.item)).toEqual(['i1', 'i2', 'i3', 'i4']);
    expect(c.querySelector('[data-item="i4"]')!.closest('[data-combo]')).toBeNull();
  });

  it('the supplement hangs from ITS component, not from the menu header', async () => {
    const el = await mount();
    const g = groups(card(el, 'k1'))[0];
    expect(g.querySelector<HTMLElement>('[data-item="i2"]')!.textContent).toContain('SIN CEBOLLA');
    expect(g.querySelector<HTMLElement>('[data-item="i1"]')!.textContent).not.toContain('SIN CEBOLLA');
    // The header carries the menu and nothing else — no supplements, and above all NO PRICE
    // (unanimous across every KDS reviewed: a kitchen ticket has no money on it).
    const head = g.querySelector<HTMLElement>('.combo-head')!;
    expect(head.textContent).not.toContain('SIN CEBOLLA');
    expect(head.textContent).not.toMatch(/\d+[,.]\d{2}/);
  });

  it('the header is REPEATED at every station that receives a piece of the menu', async () => {
    // Simphony's `11 - Send to Combo Parent Order Devices` is this exact switch, and Toast's
    // alternative — the component alone, with no parent name — is a mode you opt into. A cook at
    // the grill who cannot see «MENU» has no way to know their steak is coupled to a gazpacho.
    const el = await mount();
    for (const [station, item] of [['s-cold', 'i1'], ['s-grill', 'i2'], ['s-bar', 'i3']] as const) {
      el.station = station;
      await settle(el);
      const g = groups(card(el, 'k1'));
      expect(g, `station ${station} lost the menu header`).toHaveLength(1);
      expect(g[0].textContent).toContain('MENU');
      expect(linesOf(g[0]).map((l) => l.dataset.item)).toEqual([item]);
    }
  });

  it('a component is bumped on its own, and the group only reads done when the last one falls', async () => {
    // Every KDS reviewed bumps per item (Square, Lightspeed, LS Central, Fresh, TouchBistro), and
    // Odoo states the closing rule: the card moves on «once every item is crossed off». Nobody
    // marks a combo ready by hand, and no product has an «a component is missing» alert either.
    const el = await mount();
    let g = groups(card(el, 'k1'))[0];
    expect(g.dataset.comboDone).toBe('false');

    g.querySelector<HTMLElement>('[data-item="i1"]')!.click();
    expect(commands).toEqual([{ name: 'kitchen.items.bump', payload: { order_id: 'k1', item_ids: ['i1'] } }]);

    // Two of three struck: still not done. The KDS refreshes off the live event, no polling.
    displayRows[0].item_status = 'ready';
    displayRows[1].item_status = 'ready';
    await refresh(el);
    g = groups(card(el, 'k1'))[0];
    expect(g.dataset.comboDone).toBe('false');

    // …and the third one closes it, on its own. That is Odoo's rule and nobody's hand.
    displayRows[2].item_status = 'ready';
    await refresh(el);
    g = groups(card(el, 'k1'))[0];
    expect(g.dataset.comboDone).toBe('true');
  });

  it('tapping the menu header bumps every component of THAT menu on screen, and nothing else', async () => {
    const el = await mount();
    const head = groups(card(el, 'k1'))[0].querySelector<HTMLElement>('.combo-head')!;
    head.click();
    expect(commands).toEqual([
      { name: 'kitchen.items.bump', payload: { order_id: 'k1', item_ids: ['i1', 'i2', 'i3'] } },
    ]);
    // `i4` is à la carte and must not move: bumping a menu is not bumping the ticket.
    expect(commands[0].payload.item_ids).not.toContain('i4');
  });
});
