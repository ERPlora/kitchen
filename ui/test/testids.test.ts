// A screen the QA robot cannot name is a screen nobody tests (kitchen#78, out of hub#1756).
//
// The hub's QA drives the POS with Playwright, and Playwright addresses by `data-testid`: it is
// the only hook that survives a copy change, the `en`↔`es` translation (ADR-0055/0199) and the
// Shadow DOM of a Web Component. When a control has none, the spec falls back to a selector by
// text or by `nth` — and both break on their own. That is how 12 points of the restaurant
// checklist for this module were left unverified on 2026-09-09.
//
// This is the guard of the PATTERN, not a patch over one screen. The hub's twin lives in
// `apps/web/src/form-testids.test.ts`; the convention both obey is written once, in
// `architecture/hub/apps/testids.md`: `<surface>-<field|action|state>`, kebab-case, and the rows
// of a list carry their identity at the end (`pos-product-${id}`), never their index.
//
// Two things are NOT copied from the hub's guard, because this repo is not Vue:
//
//   · The surfaces are Lit components (`html` tagged templates inside `.ts`), so there is no
//     `<template>` block to cut: the whole source is the template.
//   · The hub only reads LITERAL hooks, so renaming a COMPUTED one (`login-pin-user-${u.id}`)
//     stays green there and breaks the specs days later, in another repo (reported by the
//     hub#1808 worker on 2026-09-11). Here a computed hook is read too: its static head must live
//     under the surface's prefix and end in `-`, so renaming it breaks HERE.
//
// Three rules, because they stop three different things:
//
//   · COVERAGE — in a registered surface no control and no action is left without a hook. It is
//     what makes the button somebody adds next month born addressable.
//   · CONTRACT — the names the QA writes in its specs are declared here, and the declared set is
//     EXACTLY the one in the file. Renaming a hook has to break THIS test first, here, where it
//     is seen.
//   · RATCHET — every surface with a control or an action is classified: covered, or pending with
//     its issue. A new component cannot slip in unclassified, and the pending list only shrinks.
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

/** `ui/components/` — where the module's Web Components live. */
const COMPONENTS = join(import.meta.dirname, '..', 'components');

/**
 * Covered surface: `prefix` is the namespace that belongs to it and `contract` is the EXACT set of
 * literal `data-testid` the file declares today.
 *
 * To get in here a screen needs both halves: every control and action hooked (the coverage rule)
 * and its contract written down (the contract rule). Adding a button to one of these forces a
 * change to this list — on purpose: that is the moment somebody decides what that button is going
 * to be called for the rest of the world.
 */
const COVERED: Record<string, { prefix: string; contract: string[] }> = {
  // The kitchen display (`/m/kitchen/display`): the screen the line cooks and the expo live on.
  // Almost everything on it is a tap — bump a line, bump a whole ticket from its header, recall,
  // mark served — so what is named here is mostly actions and the states a spec waits for.
  //
  // The tickets, their lines and their menus carry identity, never position:
  // `kds-ticket-${order.id}` (with `-head`, `-bump`, `-recall`, `-served` after it, the same shape
  // `ok-data-table` gives a row action), `kds-ticket-${order.id}-combo-${ref}`, `kds-line-${item.id}`
  // and `kds-station-${station.id}`. The board reorders itself every time a ticket is fired or
  // bumped, so a spec that pressed «the second card» would be bumping somebody else's table.
  'erp-kitchen-display/erp-kitchen-display.ts': {
    prefix: 'kds-',
    contract: [
      'kds-allday',
      'kds-count-cooking',
      'kds-count-ready',
      'kds-empty',
      'kds-error',
      'kds-fullscreen',
      'kds-pass-warning',
      'kds-rush-notice-warning',
      'kds-station-all',
      'kds-stations',
      'kds-view-allday',
      'kds-view-ready',
      'kds-view-tickets',
      'kds-views',
    ],
  },
  // The audit log of the kitchen (`/m/kitchen/history`): read-only, a table and its error.
  'erp-kitchen-history/erp-kitchen-history.ts': {
    prefix: 'kitchen-history-',
    contract: ['kitchen-history-load-error', 'kitchen-history-table'],
  },
  // The active orders (`/m/kitchen/orders`): the quick form that opens an order by hand (projected
  // into the table's create panel, kitchen#122), the page notice of a refused row action, and the
  // table whose row actions move it along (`kitchen-orders-table-row-<id>-<action>`, painted by
  // `ok-data-table` from the `testid` given here — outfitkit#143).
  'erp-kitchen-orders-active/erp-kitchen-orders-active.ts': {
    prefix: 'kitchen-orders-',
    contract: [
      'kitchen-orders-form',
      'kitchen-orders-error',
      'kitchen-orders-form-error',
      'kitchen-orders-load-error',
      'kitchen-orders-notes',
      'kitchen-orders-submit',
      'kitchen-orders-table',
      'kitchen-orders-type',
    ],
  },
  // The stations (`/m/kitchen/stations`): the create form projected into the table, the edit
  // panel a row opens and the routing of a product or a category to a station.
  'erp-kitchen-orders-stations/erp-kitchen-orders-stations.ts': {
    prefix: 'kitchen-stations-',
    contract: [
      'kitchen-stations-create-error',
      'kitchen-stations-create-form',
      'kitchen-stations-create-name',
      'kitchen-stations-create-printer',
      'kitchen-stations-create-submit',
      'kitchen-stations-edit-active',
      'kitchen-stations-edit-cancel',
      'kitchen-stations-edit-color',
      'kitchen-stations-edit-error',
      'kitchen-stations-edit-form',
      'kitchen-stations-edit-name',
      'kitchen-stations-edit-panel',
      'kitchen-stations-edit-printer',
      'kitchen-stations-edit-submit',
      'kitchen-stations-error',
      'kitchen-stations-load-error',
      'kitchen-stations-routing-category',
      'kitchen-stations-routing-error',
      'kitchen-stations-routing-form',
      'kitchen-stations-routing-product',
      'kitchen-stations-routing-station',
      'kitchen-stations-routing-submit',
      'kitchen-stations-saved',
      'kitchen-stations-table',
    ],
  },
  // The «Comandas · N» chip the POS paints for the open check, and the sheet it opens. Each round
  // is named by its order: `kitchen-comandas-row-${order.id}`, and so is its rush toggle
  // (kitchen#94): `kitchen-comandas-rush-${order.id}`.
  'erp-kitchen-pos-comandas/erp-kitchen-pos-comandas.ts': {
    prefix: 'kitchen-comandas-',
    contract: [
      'kitchen-comandas-close',
      'kitchen-comandas-error',
      'kitchen-comandas-open',
      'kitchen-comandas-rush-notice-warning',
      'kitchen-comandas-sheet',
    ],
  },
  // The two buttons the POS borrows from kitchen: arm URGENT, and fire the round.
  'erp-kitchen-pos-fire/erp-kitchen-pos-fire.ts': {
    prefix: 'kitchen-fire-',
    contract: ['kitchen-fire-send', 'kitchen-fire-urgent'],
  },
};

/**
 * Surfaces with controls or actions that do not carry hooks yet, each with the issue that asks for
 * them. The list can only SHRINK: when one is completed it leaves here and goes up (the stale-entry
 * test fails if it stays). A new component is not born in this list — it is born covered.
 */
const NOT_YET_COVERED: Record<string, string> = {};

/**
 * How many surfaces are pending TODAY. This number ONLY GOES DOWN. Without it the pending list is
 * a list of excuses: a new component walks in with a decorative issue number and the guard stays
 * green. With the count nailed down, adding one forces raising it by hand, on a line whose comment
 * says it is not raised.
 */
const PENDING_TODAY = 0;

/** What a person fills in. Buttons are not here: actions have their own rule below. */
const CONTROL_TAGS = [
  'ion-input',
  'ion-select',
  'ion-textarea',
  'ion-toggle',
  'ion-checkbox',
  'ion-searchbar',
  'ion-segment',
  'ion-radio-group',
  'ion-datetime',
  'ion-range',
  'input',
  'select',
  'textarea',
] as const;

/**
 * What a person presses. In a POS the buttons ARE the screen — charging, parking a check, opening
 * the discount sheet, tapping a product tile — so unlike the hub's guard the actions are covered
 * too, not merely declared in the contract.
 *
 * A product tile is an `<ion-card button>` and the cart drawer's scrim is a `<div @click>`, so the
 * tag list alone would miss exactly the two taps a QA journey starts with: pick a product, close
 * the drawer. Anything carrying `@click` counts.
 */
const ACTION_TAGS = ['ion-button', 'button', 'ion-fab-button', 'ion-segment-button'] as const;

const ANY_TAG = /<([a-z][a-z0-9-]*)(?=[\s/>])/g;

/**
 * The `>` that closes the opening tag, skipping the ones that are not markup: those inside quotes
 * and those inside an interpolation.
 *
 * In a Lit template `${...}` is JavaScript, and this component's JavaScript is full of `>`: every
 * arrow of a handler (`@click=${() => this.add(p)}`) and every generic (`CustomEvent<{ value?:
 * string }>`). Stopping at the first one reads a quarter of the tag and drops the rest of the
 * attributes — including, silently, an `@click` that happens to be written after another handler.
 */
function openTag(source: string, start: number): string {
  let quote: string | null = null;
  for (let i = start; i < source.length; i++) {
    const c = source[i];
    if (quote) {
      if (c === quote) quote = null;
      continue;
    }
    if (c === '$' && source[i + 1] === '{') {
      const body = braced(source, i);
      if (body !== undefined) {
        i += body.length + 2; // `${` + body + the `}` the loop's own step walks past
        continue;
      }
    }
    if (c === '"' || c === "'") quote = c;
    else if (c === '>') return source.slice(start, i + 1);
  }
  return source.slice(start);
}

/**
 * Prose out. The comments in these components talk ABOUT the markup — they name `data-testid`,
 * quote old names, and one of them explains that Ionic moves the aria attributes to the `<button>`
 * inside its shadow root. Read as markup, that sentence is an action with no hook and the coverage
 * rule reports a button that does not exist.
 *
 * A block comment is only cut when its `/ *` opens the line, which is how every comment in this
 * repo is written. Matching one mid-line would risk swallowing live template — and a swallowed
 * chunk is not a loud failure, it is a control nobody checks.
 */
function withoutComments(source: string): string {
  return source
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/^[ \t]*\/\*[\s\S]*?\*\//gm, '')
    .split('\n')
    .map((line) => (/^\s*\/\//.test(line) ? '' : line))
    .join('\n');
}

/** A hook as it is written: literal (`"pos-charge"`) or computed (`` ${`pos-product-${id}`} ``). */
type Hook = { literal?: string; head?: string };

/**
 * Every `data-testid` of a source, in the three shapes Lit writes one: `="name"`, `=${`head-${x}`}`
 * and `="${x}"`. For a computed one what is kept is its STATIC HEAD — the part before the first
 * interpolation — which is what the prefix rule can hold on to.
 */
function hooks(source: string): Hook[] {
  const found: Hook[] = [];
  const re = /(?<![\w-])data-testid\s*=\s*/g;
  for (let m = re.exec(source); m; m = re.exec(source)) {
    const at = m.index + m[0].length;
    const raw = source[at] === '"' || source[at] === "'" ? quoted(source, at) : braced(source, at);
    if (raw === undefined) continue;
    const cut = raw.indexOf('${');
    if (cut === -1 && !raw.startsWith('`')) found.push({ literal: raw });
    else found.push({ head: staticHead(raw) });
  }
  return found;
}

/** The body of `"…"`, without the quotes. */
function quoted(source: string, at: number): string | undefined {
  const end = source.indexOf(source[at], at + 1);
  return end === -1 ? undefined : source.slice(at + 1, end);
}

/** The body of `${…}`, with nested braces balanced so a `${}` inside a template literal survives. */
function braced(source: string, at: number): string | undefined {
  if (source[at] !== '$' || source[at + 1] !== '{') return undefined;
  let depth = 0;
  for (let i = at + 1; i < source.length; i++) {
    if (source[i] === '{') depth++;
    else if (source[i] === '}' && --depth === 0) return source.slice(at + 2, i);
  }
  return undefined;
}

/** The static text a computed hook starts with: `` `pos-product-${id}` `` → `pos-product-`. */
function staticHead(raw: string): string {
  const body = raw.trim().startsWith('`') ? raw.trim().slice(1) : raw;
  const cut = body.search(/\$\{|`/);
  return cut === -1 ? '' : body.slice(0, cut);
}

/**
 * `testid="x"` on an `<ok-data-table>`: the namespace the table expands into its whole chrome —
 * add, search, rows, row actions, pager (outfitkit#143). It is the same contract with the QA as a
 * `data-testid`: renaming it leaves the spec that presses «Add» with nothing to press, even though
 * the attribute is spelled differently. Without it the table paints NO hook at all.
 */
const TABLE_TESTID = /(?<![\w.:-])testid="([^"]*)"/g;

function tableHooks(source: string): string[] {
  const found: string[] = [];
  TABLE_TESTID.lastIndex = 0;
  for (let m = TABLE_TESTID.exec(source); m; m = TABLE_TESTID.exec(source)) found.push(m[1]);
  return found;
}

/** Carries a hook, literal or computed — or, for the table, the namespace of its chrome. */
const hasHook = (open: string): boolean =>
  /(?<![\w-])data-testid\s*=/.test(open) ||
  (open.startsWith('<ok-data-table') && /(?<![\w.:-])testid="[^"]+"/.test(open));

type Element = { tag: string; line: number; open: string };

function elements(source: string): Element[] {
  const clean = withoutComments(source);
  const found: Element[] = [];
  ANY_TAG.lastIndex = 0;
  for (let m = ANY_TAG.exec(clean); m; m = ANY_TAG.exec(clean)) {
    found.push({
      tag: m[1],
      line: clean.slice(0, m.index).split('\n').length,
      open: openTag(clean, m.index),
    });
  }
  return found;
}

const isControl = (el: Element): boolean => (CONTROL_TAGS as readonly string[]).includes(el.tag);

/** A table with no `testid` paints its add button, search and row actions with no hook at all. */
const isDataTable = (el: Element): boolean => el.tag === 'ok-data-table';

const isAction = (el: Element): boolean =>
  (ACTION_TAGS as readonly string[]).includes(el.tag) || /@click\s*=/.test(el.open);

/** Everything the QA has to name on a surface: what it fills in and what it presses. */
const addressable = (source: string): Element[] =>
  elements(source).filter((el) => isControl(el) || isAction(el) || isDataTable(el));

const unhooked = (source: string): string[] =>
  addressable(source)
    .filter((el) => !hasHook(el.open))
    .map((el) => `<${el.tag}> line ${el.line}`);

/** Kebab-case: lowercase and digits separated by a single hyphen. */
const KEBAB = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;

function componentFiles(dir: string, found: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) componentFiles(full, found);
    else if (entry.endsWith('.ts') && !entry.endsWith('.test.ts')) found.push(full);
  }
  return found;
}

const SURFACES: Array<{ name: string; source: string }> = componentFiles(COMPONENTS)
  .map((full) => ({ name: relative(COMPONENTS, full), source: readFileSync(full, 'utf8') }))
  .sort((a, b) => a.name.localeCompare(b.name));

const sourceOf = (name: string): string =>
  SURFACES.find((s) => s.name === name)?.source ?? '';

const literalsOf = (name: string): string[] => {
  const clean = withoutComments(sourceOf(name));
  return [
    ...hooks(clean)
      .map((h) => h.literal)
      .filter((v): v is string => v !== undefined),
    ...tableHooks(clean),
  ];
};

const headsOf = (name: string): string[] =>
  hooks(withoutComments(sourceOf(name)))
    .map((h) => h.head)
    .filter((v): v is string => v !== undefined);

describe('data-testid — the module UI convention (kitchen#78)', () => {
  it('every literal data-testid is kebab-case', () => {
    const offenders: string[] = [];
    for (const { name } of SURFACES) {
      for (const value of literalsOf(name)) {
        if (!KEBAB.test(value)) offenders.push(`${name}: "${value}"`);
      }
    }
    expect(offenders, 'a name that is not kebab-case breaks what the QA can predict').toEqual([]);
  });

  it('no literal data-testid is repeated in two surfaces', () => {
    const owners = new Map<string, string[]>();
    for (const { name } of SURFACES) {
      for (const value of new Set(literalsOf(name))) {
        owners.set(value, [...(owners.get(value) ?? []), name]);
      }
    }
    const shared = [...owners]
      .filter(([, files]) => files.length > 1)
      .map(([value, files]) => `"${value}" in ${files.join(' + ')}`);
    expect(shared, 'getByTestId would return two elements and the spec would pick at random').toEqual([]);
  });

  it('a covered surface leaves no control and no action without a hook', () => {
    const offenders: string[] = [];
    for (const name of Object.keys(COVERED)) {
      expect(SURFACES.some((s) => s.name === name), `${name} is in COVERED but does not exist`).toBe(true);
      for (const el of unhooked(sourceOf(name))) offenders.push(`${name}: ${el}`);
    }
    expect(offenders, 'Playwright cannot fill in or press what has no data-testid').toEqual([]);
  });

  it('the declared contract is EXACTLY the one in the surface', () => {
    const drift: string[] = [];
    for (const [name, spec] of Object.entries(COVERED)) {
      const found = [...new Set(literalsOf(name))].sort();
      const declared = [...spec.contract].sort();
      for (const missing of declared.filter((v) => !found.includes(v))) {
        drift.push(`${name}: the contract declares "${missing}" and the surface no longer has it`);
      }
      for (const extra of found.filter((v) => !declared.includes(v))) {
        drift.push(`${name}: the surface has "${extra}" and the contract does not declare it`);
      }
    }
    expect(drift, 'renaming a data-testid breaks the QA suite: declare it here').toEqual([]);
  });

  it('every literal data-testid lives in its surface namespace', () => {
    const offenders: string[] = [];
    for (const [name, spec] of Object.entries(COVERED)) {
      if (!spec.prefix) continue;
      for (const value of new Set(literalsOf(name))) {
        if (!value.startsWith(spec.prefix)) offenders.push(`${name}: "${value}" ≠ ${spec.prefix}*`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('a COMPUTED data-testid also lives in its namespace and keeps its identity at the end', () => {
    // This is the hole the hub's guard has and the hub#1808 worker hit: over there only the
    // literals are read, so renaming `login-pin-user-${u.id}` stays green and the specs that use
    // it break days later, in another repo. A computed hook is a contract just the same.
    const offenders: string[] = [];
    for (const [name, spec] of Object.entries(COVERED)) {
      for (const head of headsOf(name)) {
        if (head === '') {
          offenders.push(`${name}: a data-testid with no static head cannot be predicted by a spec`);
        } else if (spec.prefix && !head.startsWith(spec.prefix)) {
          offenders.push(`${name}: "${head}\${…}" ≠ ${spec.prefix}*`);
        } else if (!head.endsWith('-')) {
          offenders.push(`${name}: "${head}\${…}" glues the identity onto the name: end it with "-"`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it('a hook is spelled the one way Playwright reaches and this guard reads', () => {
    // `getByTestId` resolves `data-testid` and nothing else, so `data-test="x"` is a hook the robot
    // never reaches. And Lit accepts other spellings of the SAME attribute — `.dataTestid=${…}` as
    // a property, `?data-testid`, single quotes, `"${x}"` quoted — that paint a hook this file does
    // not read; `:data-testid` is Vue syntax copied from the shell, which Lit paints as an
    // attribute literally named `:data-testid`. The module writes ONE spelling of each.
    const WRONG = [
      /(?<![\w-])data-test\s*=/,
      /[.:?@]data-?[tT]est[iI]d\s*=/,
      /\bv-bind:data-testid/,
      /(?<![\w-])(?:data-)?testid\s*=\s*'/,
      /(?<![\w-])(?:data-)?testid\s*=\s*"\$\{/,
    ];
    const offenders: string[] = [];
    for (const { name, source } of SURFACES) {
      const clean = withoutComments(source);
      for (const re of WRONG) if (re.test(clean)) offenders.push(`${name}: ${re}`);
    }
    expect(offenders, 'write data-testid="x" or data-testid=${`head-${id}`}').toEqual([]);
  });

  it('every surface with a control or an action is classified: covered, or with its issue', () => {
    const unclassified = SURFACES.filter(
      ({ name, source }) =>
        addressable(source).length > 0 && !(name in COVERED) && !(name in NOT_YET_COVERED),
    ).map(({ name }) => name);
    expect(
      unclassified,
      'a new component is born with data-testid — or enters NOT_YET_COVERED with its issue',
    ).toEqual([]);
  });

  it('a pending surface that is already complete does not stay in the pending list', () => {
    const stale = Object.keys(NOT_YET_COVERED).filter(
      (name) => SURFACES.some((s) => s.name === name) && unhooked(sourceOf(name)).length === 0,
    );
    expect(stale, 'it already has every hook: move it to COVERED with its contract').toEqual([]);
  });

  it('the pending list only shrinks: a new surface is born covered, not pending', () => {
    const pending = Object.keys(NOT_YET_COVERED).length;
    expect(
      pending,
      pending > PENDING_TODAY
        ? 'a new surface does not enter NOT_YET_COVERED: hook it up and move it to COVERED'
        : `a pending surface left the list: lower PENDING_TODAY to ${pending}`,
    ).toBe(PENDING_TODAY);
  });

  it('the pending list does not name surfaces that no longer exist', () => {
    const ghosts = Object.keys(NOT_YET_COVERED).filter(
      (name) => !SURFACES.some((s) => s.name === name),
    );
    expect(ghosts).toEqual([]);
  });

  it('every pending surface cites a real issue, not a placeholder', () => {
    // A pending surface with no issue is a pending surface nobody does: the register above reads
    // like a plan, and a `repo#PENDING-something` turns it into a list of good intentions that
    // never reaches the board. Exact shape `repo#N` so it can be opened from here.
    const placeholders = Object.entries(NOT_YET_COVERED)
      .filter(([, issue]) => !/^[a-z][a-z0-9_-]*#\d+$/.test(issue))
      .map(([name, issue]) => `${name}: "${issue}"`);
    expect(placeholders, 'open the issue and put its number: the board does not pick up a hole').toEqual([]);
  });
});

describe('the guard reads a Lit open tag, not a JavaScript one (kitchen#78)', () => {
  // The rules above are only worth what the reader underneath them sees. In a Lit template an
  // attribute value is JavaScript — `@click=${() => this.add(p)}`, `@ionChange=${(e:
  // CustomEvent<{ value?: string }>) => …}` — and that JavaScript is FULL of `>`: every arrow, every
  // generic. A reader that closes the tag at the first `>` stops inside the first handler and
  // never sees the rest of the attributes.
  //
  // That cuts both ways, and one of the two is silent: an element whose `@click` comes after
  // another interpolated attribute is not recognised as an action at all, so the coverage rule
  // never demands a hook for it — a button nobody has to name, reported by nobody. These sources
  // are synthetic on purpose: today's components happen not to be written that way, and a guard
  // that only works on the shapes that exist today is a guard that breaks on the next component.

  it('sees an @click that comes after another interpolated handler', () => {
    const source = `html\`<div class="pdrop-back" @wheel=\${(e: WheelEvent) => this.spin(e)} @click=\${() => { this.parkedOpen = false; }}></div>\``;
    expect(
      addressable(source).map((el) => el.tag),
      'the arrow of the first handler is not the end of the tag: that div is a tap',
    ).toEqual(['div']);
  });

  it('sees an @click that comes after an attribute holding a generic', () => {
    // A `div` on purpose: an `ion-segment` is a control and would be demanded a hook anyway, so it
    // would prove nothing about the reader.
    const source = `html\`<div @ionChange=\${(e: CustomEvent<{ value?: string }>) => this.pick(e)} @click=\${() => this.focus()}></div>\``;
    expect(
      addressable(source).map((el) => el.tag),
      'the `>` closing a generic is not the `>` closing the tag',
    ).toEqual(['div']);
  });

  it('sees a data-testid that comes after the handler', () => {
    const source = `html\`<ion-button @click=\${() => this.confirm()} data-testid="pos-charge"></ion-button>\``;
    expect(
      unhooked(source),
      'the hook is there: reporting it as missing sends the author to add a second one',
    ).toEqual([]);
  });

  it('still closes the tag at its own `>`, not at a later one', () => {
    const source = `html\`<ion-input data-testid="pos-park-name"></ion-input><ion-button @click=\${() => this.go()}></ion-button>\``;
    expect(
      unhooked(source),
      'the input is hooked and the button is not: bleeding past the tag would hide one of the two',
    ).toEqual(['<ion-button> line 1']);
  });
});
