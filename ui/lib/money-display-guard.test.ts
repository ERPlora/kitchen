import { it, expect } from 'vitest';
import { checkMoneyDisplay } from '@erplora/module-toolkit/money-display-guard';

// GUARD (pm#289, shared since pm#505/pm#508): money on screen is never formatted by hand in this
// module, and OutfitKit comes in by entry point, never as a value from the barrel.
//
// The rules live in `@erplora/module-toolkit/money-display-guard` (one piece for every module,
// tested there against its own positives); this test only says what is specific to Kitchen:
//
// * witnesses — the only amount this module paints (the Total column of the active orders list)
//   goes through the shell's formatter. It counts the CALL, not the name: the screen also declares
//   `formatMoney(cents: number, …)` in its `erplora()` interface, and a scan over empty or
//   over-stripped content must not stay green on that declaration (rv-combos-22). The KDS paints
//   quantities, not money: `formatQty(` (its declaration + the three places that paint a quantity)
//   proves the detector read that screen's code, and the label helper of `lib/` proves `lib/`
//   stays in what the detector reads (rv-taxes-78).
// * notDisplay — none: the order total goes through `erplora().formatMoney(minor)` and `formatQty`
//   uses a currency-less `Intl.NumberFormat`, which is not a hit. Add an entry
//   (`'file: exact code line'` → why) only with the reason it is not a screen amount.
// * outfitkitImporters — the six screens import OutfitKit (entry points + types), so the barrel
//   scan provably read each of them (rv-pricing-53).
it('money on screen goes through the shared formatter and OutfitKit by entry point (pm#289)', () => {
  expect(
    checkMoneyDisplay({
      from: import.meta.url,
      witnesses: {
        'components/erp-kitchen-orders-active/erp-kitchen-orders-active.ts': { text: 'erplora().formatMoney(', atLeast: 1 },
        'components/erp-kitchen-display/erp-kitchen-display.ts': { text: 'formatQty(', atLeast: 4 },
        'lib/enums.ts': { text: 'export function enumLabel(', atLeast: 1 },
      },
      notDisplay: {},
      outfitkitImporters: [
        'components/erp-kitchen-display/erp-kitchen-display.ts',
        'components/erp-kitchen-history/erp-kitchen-history.ts',
        'components/erp-kitchen-orders-active/erp-kitchen-orders-active.ts',
        'components/erp-kitchen-orders-stations/erp-kitchen-orders-stations.ts',
        'components/erp-kitchen-pos-comandas/erp-kitchen-pos-comandas.ts',
        'components/erp-kitchen-pos-fire/erp-kitchen-pos-fire.ts',
      ],
    }),
  ).toEqual([]);
});
