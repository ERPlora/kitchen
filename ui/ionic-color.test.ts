// No `ion-*` of this module takes its colour from `color=` (ERPlora/pm#392, module-toolkit#273).
//
// Ionic implements `color="danger"` with a GLOBAL rule of the document stylesheet
// (`.ion-color-danger { --ion-color-base: … }`), which does not reach inside a shadow root. In the
// POS «Current order» that meant: the URGENT toggle of «Send to kitchen» came out armed with no red
// fill (transparent, the flame on nothing) and unarmed in the default blue instead of grey — the one
// state that has to read from across a busy room did not read at all.
//
// The toggle lives in this component's own shadow root (no `ion-modal`, no `ok-data-table` cell;
// when the host moves the filler, its shadow root travels with it), so the recipe is a `tone-*`
// class painted from `static styles`: custom properties DO inherit through the boundary, so the
// theme token still applies.
//
// happy-dom neither lays out nor loads Ionic's CSS, so what is pinned here is the CONTRACT; the
// computed colours were measured in a real browser.
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';

// The `ui/` of THIS checkout, from the test's own URL: a fixed folder name (`modules/kitchen`, a
// worktree) would scan a sibling checkout and let a `color=` added HERE through.
const UI = path.dirname(fileURLToPath(import.meta.url));

function sources(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...sources(full));
    else if (/\.ts$/.test(entry.name) && !/\.(test|spec)\.ts$/.test(entry.name)) out.push(full);
  }
  return out;
}

/**
 * The attribute names of every `<ion-*>` opening tag. A Lit tag does not end at the first `>`
 * (`@click=${() => …}`), so `${…}` expressions and quoted values are skipped, not read.
 */
function ionTags(source: string): { line: number; attrs: string }[] {
  const found: { line: number; attrs: string }[] = [];
  const start = /<ion-[a-z-]+(?=[\s/>])/g;
  let m: RegExpExecArray | null;
  while ((m = start.exec(source))) {
    let attrs = '';
    let depth = 0;
    let quote: string | null = null;
    for (let i = m.index + m[0].length; i < source.length; i += 1) {
      const ch = source[i];
      if (quote) {
        if (ch === '\\') i += 1;
        else if (ch === quote) quote = null;
        continue;
      }
      if (depth > 0) {
        if (ch === '"' || ch === "'" || ch === '`') quote = ch;
        else if (ch === '{') depth += 1;
        else if (ch === '}') depth -= 1;
        continue;
      }
      if (ch === '$' && source[i + 1] === '{') { depth = 1; i += 1; continue; }
      if (ch === '"' || ch === "'") { quote = ch; continue; }
      if (ch === '>') break;
      attrs += ch;
    }
    found.push({ line: source.slice(0, m.index).split('\n').length, attrs: `${m[0]}${attrs}` });
  }
  return found;
}

const DECLARES_COLOR = /(?:^|\s)\.?color=/;

describe('pm#392: no ion-* delegates its colour to color=', () => {
  it('the source of ui/ carries no color= on an ion-* element', () => {
    const offenders = sources(UI).flatMap((file) =>
      ionTags(readFileSync(file, 'utf8'))
        .filter((t) => DECLARES_COLOR.test(t.attrs))
        .map((t) => `${path.relative(UI, file)}:${t.line}`),
    );
    expect(offenders, 'color= paints nothing inside a module shadow root').toEqual([]);
  });

  it('the reader sees a color= bound to an expression or behind an arrow function (control of the control)', () => {
    expect(ionTags('<ion-badge color=${tone(p)}>x</ion-badge>').filter((t) => DECLARES_COLOR.test(t.attrs))).toHaveLength(1);
    expect(ionTags('<ion-button size="small" ?disabled=${a || b}\n  @click=${() => this.go()} color="success">x</ion-button>').filter((t) => DECLARES_COLOR.test(t.attrs))).toHaveLength(1);
    expect(ionTags('<ion-button @click=${() => ({ color: 1 })}>x</ion-button>').filter((t) => DECLARES_COLOR.test(t.attrs))).toHaveLength(0);
  });
});

// ── Render: the URGENT toggle carries its tone class in both states ─────────────────────────────

beforeEach(() => {
  document.body.innerHTML = '';
  (globalThis as Record<string, unknown>).erplora = { locale: 'es', t: (_c: unknown, key: string) => key };
});

type Wc = HTMLElement & { shadowRoot: ShadowRoot; updateComplete: Promise<unknown> };

async function mountToggle(): Promise<{ el: Wc; toggle: () => HTMLElement }> {
  await import('./components/erp-kitchen-pos-fire/erp-kitchen-pos-fire');
  const el = document.createElement('erp-kitchen-pos-fire') as Wc;
  document.body.appendChild(el);
  el.dispatchEvent(new CustomEvent('erp:pos-state', { detail: { order_id: 'o1', items_count: 2 }, bubbles: false }));
  await el.updateComplete;
  return { el, toggle: () => el.shadowRoot.querySelector('ion-button.urgent') as HTMLElement };
}

/** The CSS text of the component's `static styles`, where the `tone-*` classes are painted. */
function componentCss(el: Wc): string {
  const styles = (el.constructor as unknown as { elementStyles: { cssText: string }[] }).elementStyles;
  return styles.map((s) => s.cssText).join('\n').replace(/\s+/g, ' ');
}

describe('pm#392: the URGENT toggle paints without color=', () => {
  it('unarmed it is an outline button painted grey by tone-medium', async () => {
    const { el, toggle } = await mountToggle();
    expect(toggle().hasAttribute('color')).toBe(false);
    expect(toggle().getAttribute('fill')).toBe('outline');
    expect(toggle().classList.contains('tone-medium')).toBe(true);
    expect(toggle().classList.contains('tone-danger')).toBe(false);
    const css = componentCss(el);
    expect(css).toContain('ion-button.tone-medium[fill] {');
    expect(css).toContain('--border-color: var(--ion-color-medium, #636469)');
    expect(css).toContain('--color: var(--ion-color-medium, #636469)');
  });

  it('armed it is a solid button filled red by tone-danger', async () => {
    const { el, toggle } = await mountToggle();
    toggle().click();
    await el.updateComplete;
    expect(toggle().getAttribute('aria-pressed')).toBe('true');
    expect(toggle().hasAttribute('color')).toBe(false);
    expect(toggle().hasAttribute('fill'), 'it is the solid variant').toBe(false);
    expect(toggle().classList.contains('tone-danger')).toBe(true);
    expect(toggle().classList.contains('tone-medium')).toBe(false);
    const css = componentCss(el);
    expect(css).toContain('ion-button.tone-danger:not([fill]) {');
    expect(css).toContain('--background: var(--ion-color-danger, #c5000f)');
    expect(css).toContain('--color: var(--ion-color-danger-contrast, #fff)');
  });
});
