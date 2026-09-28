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

/** The declarations of the FIRST rule whose selector is exactly `selector`, from Lit's styles. */
function declarations(selector: string): Record<string, string> {
  const styles = ([] as unknown[]).concat((ErpKitchenOrdersStations as unknown as { styles: unknown }).styles);
  const css = styles.map((s) => String((s as { cssText?: string }).cssText ?? '')).join('\n');
  const flat = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const escaped = selector.replace(/[.*+?^${}()|[\]\\>]/g, (c) => (c === '>' ? '\\s*>\\s*' : `\\${c}`));
  const match = new RegExp(`(?:^|[}\\s])${escaped}\\s*\\{([^}]*)\\}`).exec(flat);
  if (!match) return {};
  const out: Record<string, string> = {};
  for (const decl of match[1].split(';')) {
    const at = decl.indexOf(':');
    if (at > 0) out[decl.slice(0, at).trim()] = decl.slice(at + 1).trim();
  }
  return out;
}

describe('the stations list keeps a floor while a station is being edited (kitchen#131)', () => {
  it('the table grows into the free height but never below ~20 rows of text', () => {
    const table = declarations('.page > ok-data-table');
    expect(table['flex'], 'the table still takes the height the panels leave').toBe('1 1 auto');
    const floor = table['min-height'];
    // A length in rem, as the demo: a `0` floor (or a percentage of a flex parent that is itself
    // squeezed) is exactly what collapsed the list to its toolbar.
    expect(floor, `table floor ${floor}`).toMatch(/^\d+(?:\.\d+)?rem$/);
    expect(parseFloat(floor), `table floor ${floor}`).toBeGreaterThanOrEqual(15);
  });
});
