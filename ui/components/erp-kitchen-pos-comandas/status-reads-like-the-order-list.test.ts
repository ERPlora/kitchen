// One order, one name for its status, whichever screen the staff reads it on (kitchen#112).
//
// The POS «Comandas» panel kept its own status catalogue (`ui.stQueued`…), so the same order was
// «En cola» / «Anulada» at the till and «Pendiente» / «Cancelada» in Kitchen › Orders — a waiter
// moving between the two could not tell whether they were different states. The orders list (cell
// and filter, kitchen#108) reads `STATUS_KEY` from `ui/lib/enums.ts`; the panel has to print exactly
// what that catalogue prints, for every status the commands can write, in both languages.
//
// Which words win was decided by the market, not by which screen came first:
// - cancelled → «Cancelled» / «Cancelada»: Odoo, Shopify, WooCommerce, Square and Lightspeed all say
//   cancel(l)ed, and in a Spanish POS «Anulada» is the FISCAL word — a voided invoice (VeriFactu
//   «anulación») — which a kitchen order that never reached the pass is not. The kitchen history
//   already says «Canceladas».
// - pending → «To prepare» / «Por preparar»: the stage Odoo's preparation display gives an order sent
//   to the kitchen and not started yet (Square KDS says «New», Lightspeed files it under «pending»).
//   Not «Pending» / «Pendiente»: on the very same till, `sales` marks the cart lines NOT SENT yet as
//   «Pendiente» (Toast calls those «unsent/held»), so a round the kitchen already has would read as
//   if it had never left. Not «Queued» / «En cola»: no KDS of reference names the state that way.
// The words are pinned here as well as compared: two screens agreeing on the wrong word would still
// pass the comparison alone.
import { afterEach, describe, expect, it } from 'vitest';

import { STATUS_KEY, enumLabel } from '../../lib/enums';

/** Every status a command writes on `kitchen_order` (handler `set_status`). */
const STATUSES = ['pending', 'preparing', 'ready', 'served', 'cancelled'];

function shellSpeaking(locale: string) {
  (globalThis as Record<string, unknown>).erplora = {
    locale,
    t: (catalog: Record<string, unknown>, key: string) => {
      const lang = (catalog[locale] ?? catalog.en) as Record<string, Record<string, string>>;
      const [section, name] = key.split('.');
      return lang?.[section]?.[name] ?? key;
    },
    queryAll: async (name: string, params?: Record<string, unknown>) => {
      if (name !== 'kitchen.orders.list') return [];
      if ((params?.filters as Record<string, unknown> | undefined)?.source_order_id !== 'o1') return [];
      return STATUSES.map((status, i) => ({
        id: `k-${status}`, round_number: i + 1, status,
        fired_at: `2026-09-28T1${i}:00:00+00:00`, created_at: `2026-09-28T1${i}:00:00+00:00`,
      }));
    },
    query: async () => [],
    on: () => () => undefined,
  };
}

async function settle(el: Element) {
  await new Promise((r) => setTimeout(r, 0));
  await (el as unknown as { updateComplete: Promise<unknown> }).updateComplete;
}

/** Status → the label the POS panel paints on that order's row. */
async function panelLabels(): Promise<Record<string, string>> {
  await import('./erp-kitchen-pos-comandas');
  const el = document.createElement('erp-kitchen-pos-comandas');
  document.body.appendChild(el);
  await settle(el);
  el.dispatchEvent(new CustomEvent('erp:pos-state', { detail: { order_id: 'o1', items_count: 1, pending_count: 0 } }));
  await settle(el);
  (el.shadowRoot!.querySelector('.chip') as HTMLElement).click();
  await settle(el);
  await settle(el);
  const out: Record<string, string> = {};
  for (const status of STATUSES) {
    const pill = el.shadowRoot!.querySelector(`[data-testid="kitchen-comandas-row-k-${status}"] .kstate`);
    out[status] = pill?.textContent?.trim() ?? '(no row)';
  }
  return out;
}

/** Status → the label the orders list paints in its Status cell and offers in its filter. */
function listLabels(): Record<string, string> {
  return Object.fromEntries(STATUSES.map((s) => [s, enumLabel(STATUS_KEY, s)]));
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('the POS panel names each status as the orders list does (kitchen#112)', () => {
  for (const locale of ['es', 'en']) {
    it(`${locale}: every status reads the same on both screens`, async () => {
      shellSpeaking(locale);
      expect(await panelLabels()).toEqual(listLabels());
    });
  }

  it('the list catalogue covers every status the commands write', () => {
    expect(Object.keys(STATUS_KEY).sort()).toEqual([...STATUSES].sort());
  });

  it('es: the market words — Por preparar, En preparación, Lista, Servida, Cancelada', async () => {
    shellSpeaking('es');
    expect(await panelLabels()).toEqual({
      pending: 'Por preparar', preparing: 'En preparación', ready: 'Lista', served: 'Servida', cancelled: 'Cancelada',
    });
  });

  it('en: the market words — To prepare, Preparing, Ready, Served, Cancelled', async () => {
    shellSpeaking('en');
    expect(await panelLabels()).toEqual({
      pending: 'To prepare', preparing: 'Preparing', ready: 'Ready', served: 'Served', cancelled: 'Cancelled',
    });
  });
});

// «En preparación» is longer than the «Preparando» it replaces. On a 390 px phone, a round in
// preparation AND rush («Comanda 1 · 06:53 · En preparación · Urgente») no longer fits one line: the
// bench showed the flame icon squeezed to nothing and «Urgente» glued to the edge. The header wraps
// instead, and the icon never shrinks. happy-dom resolves the shadow root's cascade (no layout), so
// the rules that make it possible are pinned through getComputedStyle.
describe('a longer status name still fits the phone (kitchen#112)', () => {
  it('the round header wraps instead of crushing its icon', async () => {
    shellSpeaking('es');
    await panelLabels();
    const el = document.querySelector('erp-kitchen-pos-comandas')!;
    const header = el.shadowRoot!.querySelector('[data-testid="kitchen-comandas-row-k-preparing"] .krow-h') as HTMLElement;
    const icon = header.querySelector('ion-icon') as HTMLElement;
    expect(getComputedStyle(header).flexWrap).toBe('wrap');
    expect(getComputedStyle(icon).flexShrink).toBe('0');
  });
});
