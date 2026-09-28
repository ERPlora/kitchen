// kitchen#131 — on a landscape tablet, a small laptop or a rotated phone (wider than 640 px, short),
// clicking a station to edit it left the list with NO row: the edit and routing panels never shrink,
// and the table was the flex child that gave, down to its toolbar (`min-height: 0`). Scrolling to the
// bottom did not help: the `fill` data-table fits its rows inside its own box, so the box was all
// there was.
//
// The fix gives the table a floor, the same one the showcase demo carries since outfitkit#230/#232
// (`min-height: 20rem`): when the panels above fill the screen, the PAGE scrolls and the list keeps
// its rows. happy-dom does no layout, so what is pinned here is the rule that makes it possible; the
// rows on screen were measured in a real browser at 1024×600, 667×375 and 844×390.
import { describe, expect, it } from 'vitest';
import { ErpKitchenOrdersStations } from './erp-kitchen-orders-stations';

const SIZING = ['flex', 'flex-grow', 'flex-shrink', 'flex-basis', 'height', 'min-height', 'max-height'];
const TABLE = '.page > ok-data-table';

/**
 * Every sizing declaration that lands on the component's ok-data-table, in source order, from ALL
 * of Lit's rules (inside `@media` too). The cascade matters: a later rule, a media query or an
 * `!important` on the table undoes the floor while a first-rule-only reader stays green
 * (HALLAZGO rv-outfitkit-230).
 */
function tableSizing(): { selector: string; prop: string; value: string }[] {
  const styles = ([] as unknown[]).concat((ErpKitchenOrdersStations as unknown as { styles: unknown }).styles);
  const css = styles.map((s) => String((s as { cssText?: string }).cssText ?? '')).join('\n');
  const flat = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const out: { selector: string; prop: string; value: string }[] = [];
  for (const [, selectors, body] of flat.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    for (const raw of selectors.split(',')) {
      const selector = raw.trim().replace(/\s*>\s*/g, ' > ').replace(/\s+/g, ' ');
      if (!/(^|[\s>+~])ok-data-table(?![\w-])[^\s>+~]*$/.test(selector)) continue;
      for (const decl of body.split(';')) {
        const at = decl.indexOf(':');
        const prop = decl.slice(0, at).trim();
        if (at > 0 && SIZING.includes(prop)) out.push({ selector, prop, value: decl.slice(at + 1).trim() });
      }
    }
  }
  return out;
}

describe('the stations list keeps a floor while a station is being edited (kitchen#131)', () => {
  it('the table grows into the free height but never below ~20 rows of text', () => {
    const sizing = tableSizing();
    // One place sizes the table: any other rule (a media query, a broader selector, an
    // `!important`) would decide the floor on some screen without this test seeing it.
    expect(sizing.filter((d) => d.selector !== TABLE), 'sizing of ok-data-table outside its rule').toEqual([]);
    const last = (prop: string) => sizing.filter((d) => d.prop === prop).at(-1)?.value;
    expect(last('flex'), 'the table still takes the height the panels leave').toBe('1 1 auto');
    for (const prop of ['flex-grow', 'flex-shrink', 'flex-basis', 'height', 'max-height']) {
      expect(last(prop), `${prop} would cap or squeeze the table`).toBeUndefined();
    }
    const floor = last('min-height') ?? '';
    // A length in rem, as the demo: a `0` floor (or a percentage of a flex parent that is itself
    // squeezed) is exactly what collapsed the list to its toolbar.
    expect(floor, `table floor ${floor}`).toMatch(/^\d+(?:\.\d+)?rem$/);
    expect(parseFloat(floor), `table floor ${floor}`).toBeGreaterThanOrEqual(15);
  });
});
