// pm#513 (out of pm#478) — on a phone, a refused «New station» or «Edit station» showed NOTHING: the
// person pressed the button and the screen stayed as it was.
//
// The refusal did arrive; it was painted in the wrong place. The three forms of this screen shared
// ONE notice, a child of the PAGE painted under the routing panel:
//
//   · «New station» lives in the `create` panel of the `ok-data-table`, and under 834 px that panel
//     is a FULL-SCREEN sheet (outfitkit#75): the notice sat under the sheet (bench: hub:stable
//     1.1.30, ios and md, 390 and 820 px: 4 of 6 hidden);
//   · «Edit station» opens above the routing panel, so on a phone the notice landed under both
//     panels, below the fold (390 px: hidden in ios and md).
//
// The rule, the same one customers#97 / tables#93 / reservations#73 / appointments#227 / tasks#47 /
// tickets#43 / cart_checkout#31 follow:
//
//   · what goes wrong while SAVING a form is painted INSIDE that form, above the button that was
//     pressed, and scrolled into view once — not again on every keystroke (rv-reservations-73);
//     saving one form does not wipe the refusal another form is still showing;
//   · what goes wrong OUTSIDE the save stays on the PAGE: a refused «Delete» from a row and a list
//     that does not load. No form is involved then, and a notice inside a closed panel is just as
//     invisible (rv-appointments-227).
import { beforeEach, describe, expect, it, vi } from 'vitest';

const STATIONS = [
  { id: 'st1', name: 'Bar', name_es: 'Barra', color: '#F97316', icon: 'flame', printer_name: 'COCINA-1', is_active: 1 },
  { id: 'st2', name: 'Grill', name_es: 'Plancha', color: '#2DD36F', icon: 'flame', printer_name: '', is_active: 1 },
];

const REFUSAL = 'A manager has to approve this.';

let refuse: string | null = null;
/** When set, the next command waits on it: lets a test look at the screen while a save is in flight. */
let hold: Promise<void> | null = null;
let loadFails = false;
/** How many times the station list was read: an action that goes through reloads it. */
let reads = 0;
let commands: string[] = [];
/** Every element the component scrolled into view. */
let revealed: Element[] = [];
/** Whether each revealed element had already painted itself when it was scrolled to. */
let paintedWhenRevealed: boolean[] = [];

beforeEach(() => {
  refuse = null;
  hold = null;
  loadFails = false;
  reads = 0;
  commands = [];
  revealed = [];
  paintedWhenRevealed = [];
  vi.spyOn(HTMLElement.prototype, 'scrollIntoView').mockImplementation(function (this: HTMLElement) {
    revealed.push(this);
    // ok-inline-feedback lays itself out in its own update: scrolled to before it, a phone scrolls to
    // an empty, zero-height box and the notice ends up off the sheet anyway (online_booking#33).
    paintedWhenRevealed.push((this as unknown as { hasUpdated?: boolean }).hasUpdated !== false);
  });
  (globalThis as Record<string, unknown>).erplora = {
    query: async () => [],
    queryPage: async () => {
      reads++;
      if (loadFails) throw new Error(REFUSAL);
      return { rows: STATIONS, total: STATIONS.length };
    },
    command: async (name: string) => {
      commands.push(name);
      const wait = hold;
      if (wait) await wait;
      if (refuse) throw new Error(refuse);
      return {};
    },
    on: () => () => {},
    locale: 'es',
    t: (_c: unknown, key: string) => key,
  };
});

type Wc = HTMLElement & { shadowRoot: ShadowRoot; updateComplete: Promise<unknown> } & Record<string, any>;

async function mount(): Promise<Wc> {
  await import('./erp-kitchen-orders-stations');
  const el = document.createElement('erp-kitchen-orders-stations') as Wc;
  document.body.appendChild(el);
  await settle(el);
  return el;
}

async function settle(el: Wc): Promise<void> {
  for (let i = 0; i < 3; i++) {
    await el.updateComplete;
    await new Promise((r) => setTimeout(r, 0));
  }
}

const submitEvent = (): Event => new Event('submit', { cancelable: true });

const CREATE = '[data-testid="kitchen-stations-create-form"]';
const EDIT = '[data-testid="kitchen-stations-edit-form"]';
const ROUTING = '[data-testid="kitchen-stations-routing-form"]';
const FORMS: Record<string, string> = { create: CREATE, edit: EDIT, routing: ROUTING };

/** The notice inside `scope`, or null. */
const inside = (el: Wc, scope: string, testid: string): Element | null =>
  el.shadowRoot.querySelector(`${scope} [data-testid="${testid}"]`);

/** Every place a notice with `text` is painted in: the form it sits in, or `page`. */
function whereIs(el: Wc, text: string): string[] {
  return [...el.shadowRoot.querySelectorAll('ok-inline-feedback')]
    .filter((n) => n.textContent?.trim() === text)
    .map((n) => Object.keys(FORMS).find((k) => n.closest(FORMS[k])) ?? 'page');
}

/** The notice sits above the submit button of its form. */
function aboveTheButton(form: Element, testid: string): boolean {
  const kids = [...form.children];
  const notice = kids.findIndex((k) => k.getAttribute('data-testid') === testid);
  const button = kids.findIndex((k) => k.tagName === 'ION-BUTTON' && k.getAttribute('type') === 'submit');
  return notice >= 0 && button >= 0 && notice < button;
}

async function refusedCreate(el: Wc, reason = REFUSAL): Promise<void> {
  el.newName = 'Pass';
  refuse = reason;
  await el.createStation(submitEvent());
  await settle(el);
}

async function openEdit(el: Wc, station = STATIONS[0]): Promise<void> {
  await el.onRowAction({ detail: { actionId: 'edit', row: station } });
  await settle(el);
}

async function refusedEdit(el: Wc, reason = REFUSAL): Promise<void> {
  await openEdit(el);
  refuse = reason;
  await el.saveEdit(submitEvent());
  await settle(el);
}

async function refusedRouting(el: Wc, reason = REFUSAL): Promise<void> {
  el.routeStationId = 'st1';
  el.routeCategoryId = 'cat-1';
  refuse = reason;
  await el.saveRouting(submitEvent());
  await settle(el);
}

async function deleteRow(el: Wc): Promise<void> {
  await el.onRowAction({ detail: { actionId: 'delete', row: STATIONS[1] } });
  await settle(el);
}

describe('pm#513 · stations: a refused «New station» is shown INSIDE the panel form', () => {
  it('lands in the form, with its text, painted and scrolled into view — nothing on the page under the sheet', async () => {
    const el = await mount();
    await refusedCreate(el);
    const notice = inside(el, CREATE, 'kitchen-stations-create-error');
    expect(notice, 'on a phone the panel covers the page: the refusal has to travel with the form').not.toBeNull();
    expect(notice?.textContent?.trim()).toBe(REFUSAL);
    expect(revealed, 'and it is scrolled into view').toEqual([notice]);
    expect(paintedWhenRevealed, 'once it has painted itself').toEqual([true]);
    expect(whereIs(el, REFUSAL)).toEqual(['create']);
  });

  it('sits above the «Add» button that was pressed', async () => {
    const el = await mount();
    await refusedCreate(el);
    expect(aboveTheButton(el.shadowRoot.querySelector(CREATE)!, 'kitchen-stations-create-error')).toBe(true);
  });

  it('is revealed once, not again on every keystroke while the person corrects the name', async () => {
    const el = await mount();
    await refusedCreate(el);
    revealed = [];
    el.newName = 'Pass 2';
    await settle(el);
    el.newPrinter = 'PASS-1';
    await settle(el);
    expect(inside(el, CREATE, 'kitchen-stations-create-error'), 'the refusal is still there').not.toBeNull();
    expect(revealed, 'but the sheet stays where the person is typing').toEqual([]);
  });

  it('a second refusal with a different reason is revealed again', async () => {
    const el = await mount();
    await refusedCreate(el);
    revealed = [];
    await refusedCreate(el, 'That name is taken.');
    expect(revealed).toEqual([inside(el, CREATE, 'kitchen-stations-create-error')]);
  });

  it('while the new attempt is being saved, the previous refusal is already gone', async () => {
    const el = await mount();
    await refusedCreate(el);
    refuse = null;
    let release!: () => void;
    hold = new Promise((r) => (release = r));
    const attempt = el.createStation(submitEvent());
    await settle(el);
    expect(inside(el, CREATE, 'kitchen-stations-create-error')).toBeNull();
    release();
    await attempt;
  });

  it('a save that goes through also clears the page notice of an earlier refused «Delete»', async () => {
    const el = await mount();
    refuse = REFUSAL;
    await deleteRow(el);
    expect(whereIs(el, REFUSAL)).toEqual(['page']);
    refuse = null;
    el.newName = 'Pass';
    await el.createStation(submitEvent());
    await settle(el);
    expect(whereIs(el, REFUSAL)).toEqual([]);
  });
});

describe('pm#513 · stations: a refused «Edit station» is shown INSIDE the edit form', () => {
  it('lands in the edit form, above «Save», painted and scrolled into view — not under the routing panel', async () => {
    const el = await mount();
    await refusedEdit(el);
    const notice = inside(el, EDIT, 'kitchen-stations-edit-error');
    expect(notice, 'on a phone the page notice sits below both panels, out of sight').not.toBeNull();
    expect(notice?.textContent?.trim()).toBe(REFUSAL);
    expect(aboveTheButton(el.shadowRoot.querySelector(EDIT)!, 'kitchen-stations-edit-error')).toBe(true);
    expect(revealed).toEqual([notice]);
    expect(paintedWhenRevealed).toEqual([true]);
    expect(whereIs(el, REFUSAL)).toEqual(['edit']);
  });

  it('is revealed once, not again on every keystroke while the person corrects the station', async () => {
    const el = await mount();
    await refusedEdit(el);
    revealed = [];
    el.editName = 'Barra 2';
    await settle(el);
    el.editPrinter = 'COCINA-9';
    await settle(el);
    expect(inside(el, EDIT, 'kitchen-stations-edit-error')).not.toBeNull();
    expect(revealed).toEqual([]);
  });

  it('while the new attempt is being saved, the previous refusal is already gone', async () => {
    const el = await mount();
    await refusedEdit(el);
    refuse = null;
    let release!: () => void;
    hold = new Promise((r) => (release = r));
    const attempt = el.saveEdit(submitEvent());
    await settle(el);
    expect(inside(el, EDIT, 'kitchen-stations-edit-error')).toBeNull();
    release();
    await attempt;
  });

  it('a save that goes through also clears the page notice of an earlier refused «Delete»', async () => {
    const el = await mount();
    refuse = REFUSAL;
    await deleteRow(el);
    refuse = null;
    await openEdit(el);
    await el.saveEdit(submitEvent());
    await settle(el);
    expect(whereIs(el, REFUSAL)).toEqual([]);
  });

  it('opening another station does not carry the refusal over to it (rv-tickets-43)', async () => {
    const el = await mount();
    await refusedEdit(el);
    await openEdit(el, STATIONS[1]);
    expect(whereIs(el, REFUSAL), 'the refusal was about «Barra», not «Plancha»').toEqual([]);
  });
});

describe('pm#513 · stations: a refused routing is shown INSIDE the routing form', () => {
  it('lands in the routing form, above its button, and is scrolled into view', async () => {
    const el = await mount();
    await refusedRouting(el);
    const notice = inside(el, ROUTING, 'kitchen-stations-routing-error');
    expect(notice).not.toBeNull();
    expect(aboveTheButton(el.shadowRoot.querySelector(ROUTING)!, 'kitchen-stations-routing-error')).toBe(true);
    expect(revealed).toEqual([notice]);
    expect(whereIs(el, REFUSAL)).toEqual(['routing']);
  });

  it('a save that goes through also clears the page notice of an earlier refused «Delete»', async () => {
    const el = await mount();
    refuse = REFUSAL;
    await deleteRow(el);
    refuse = null;
    el.routeStationId = 'st1';
    el.routeCategoryId = 'cat-1';
    await el.saveRouting(submitEvent());
    await settle(el);
    expect(whereIs(el, REFUSAL)).toEqual([]);
  });

  it('while the new attempt is being saved, the previous refusal is already gone', async () => {
    const el = await mount();
    await refusedRouting(el);
    refuse = null;
    let release!: () => void;
    hold = new Promise((r) => (release = r));
    const attempt = el.saveRouting(submitEvent());
    await settle(el);
    expect(inside(el, ROUTING, 'kitchen-stations-routing-error')).toBeNull();
    release();
    await attempt;
  });

  it('picking another station to route from a row does not keep the old refusal', async () => {
    const el = await mount();
    await refusedRouting(el);
    await el.onRowAction({ detail: { actionId: 'route', row: STATIONS[1] } });
    await settle(el);
    expect(whereIs(el, REFUSAL)).toEqual([]);
  });

  it('is revealed once, not again when the person picks another category', async () => {
    const el = await mount();
    await refusedRouting(el);
    revealed = [];
    el.routeCategoryId = 'cat-2';
    await settle(el);
    expect(inside(el, ROUTING, 'kitchen-stations-routing-error')).not.toBeNull();
    expect(revealed).toEqual([]);
  });
});

describe('pm#513 · stations: one form does not wipe the refusal another form is showing (rv-reservations-73)', () => {
  it('saving the routing keeps the refusal of the open edit form', async () => {
    const el = await mount();
    await refusedEdit(el);
    refuse = null;
    el.routeStationId = 'st1';
    el.routeCategoryId = 'cat-1';
    await el.saveRouting(submitEvent());
    await settle(el);
    expect(whereIs(el, REFUSAL)).toEqual(['edit']);
  });

  it('saving the edit form keeps the refusal of the routing form', async () => {
    const el = await mount();
    await openEdit(el);
    await refusedRouting(el);
    refuse = null;
    await el.saveEdit(submitEvent());
    await settle(el);
    expect(whereIs(el, REFUSAL)).toEqual(['routing']);
  });

  it('a refused routing is not painted in the edit form, nor a refused edit in the routing form', async () => {
    const el = await mount();
    await openEdit(el);
    await refusedRouting(el);
    expect(inside(el, EDIT, 'kitchen-stations-edit-error')).toBeNull();
    refuse = 'That printer does not exist.';
    await el.saveEdit(submitEvent());
    await settle(el);
    expect(whereIs(el, 'That printer does not exist.')).toEqual(['edit']);
    expect(whereIs(el, REFUSAL)).toEqual(['routing']);
  });
});

describe('pm#513 · stations: what goes wrong OUTSIDE the save stays on the page (rv-appointments-227)', () => {
  it('a refused «Delete» from a row is shown on the page, not in a form', async () => {
    const el = await mount();
    refuse = REFUSAL;
    await deleteRow(el);
    expect(commands).toEqual(['kitchen.stations.delete']);
    expect(inside(el, '.page', 'kitchen-stations-error')?.textContent?.trim()).toBe(REFUSAL);
    expect(whereIs(el, REFUSAL)).toEqual(['page']);
  });

  it('a new «Delete» clears the previous refusal while it runs', async () => {
    const el = await mount();
    refuse = REFUSAL;
    await deleteRow(el);
    refuse = null;
    let release!: () => void;
    hold = new Promise((r) => (release = r));
    const action = el.onRowAction({ detail: { actionId: 'delete', row: STATIONS[0] } });
    await settle(el);
    expect(whereIs(el, REFUSAL)).toEqual([]);
    release();
    await action;
  });

  it('a «Delete» does not wipe a refusal the person is still reading in a form', async () => {
    const el = await mount();
    await openEdit(el);
    await refusedEdit(el);
    refuse = null;
    await deleteRow(el);
    expect(whereIs(el, REFUSAL)).toEqual(['edit']);
  });

  it('a «Delete» that goes through reloads the list (rv-tasks-47)', async () => {
    const el = await mount();
    const before = reads;
    await deleteRow(el);
    expect(reads, 'the deleted station would stay on the list').toBe(before + 1);
  });

  it('a list that does not load is shown on the page, not in a form', async () => {
    loadFails = true;
    const el = await mount();
    expect(whereIs(el, REFUSAL)).toEqual(['page']);
    expect(inside(el, CREATE, 'kitchen-stations-create-error')).toBeNull();
  });
});
