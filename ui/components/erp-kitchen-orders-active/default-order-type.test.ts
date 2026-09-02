// `default_order_type` is a control that MOVES the screen (kitchen#48).
//
// Ajustes de Cocina published «Tipo de comanda por defecto» and the new-order picker opened on a
// hardcoded `dine_in` no matter what was saved. A takeaway-only kitchen re-picked «Para llevar» on
// every single ticket, and the setting it had configured did nothing — the switch that lies.
//
// The default order type is a standard POS setting: the picker opens on it, and the user can still
// change it for this one ticket. What this file pins:
//   · the picker opens on the SAVED value, not on `dine_in`;
//   · with no settings row (a hub that never opened the form) it opens on `dine_in`, the schema
//     and column default — never blank, which would make the first order unsendable;
//   · a settings query that fails (no permission, no row) leaves the screen usable on `dine_in`;
//   · a value the module does not know is ignored rather than trusted into the payload.
import { beforeEach, describe, expect, it } from 'vitest';

let settingsRows: Array<Record<string, unknown>> | Error = [];

beforeEach(() => {
  settingsRows = [];
  (globalThis as Record<string, unknown>).erplora = {
    query: async (name: string) => {
      if (name === 'kitchen.settings.get') {
        if (settingsRows instanceof Error) throw settingsRows;
        return settingsRows;
      }
      return [];
    },
    queryPage: async () => ({ rows: [], total: 0, limit: 50, offset: 0 }),
    command: async () => ({}),
    on: () => () => {},
    locale: 'es',
    t: (_catalog: unknown, key: string) => key,
    formatMoney: (cents: number) => `${((cents || 0) / 100).toFixed(2)} €`,
  };
});

async function mount() {
  await import('./erp-kitchen-orders-active');
  const el = document.createElement('erp-kitchen-orders-active');
  document.body.appendChild(el);
  await (el as unknown as { updateComplete: Promise<unknown> }).updateComplete;
  await new Promise((r) => setTimeout(r, 0));
  await (el as unknown as { updateComplete: Promise<unknown> }).updateComplete;
  return el as HTMLElement & { shadowRoot: ShadowRoot };
}

/** What the picker is actually showing — the property the `ion-select` is bound to. */
const picked = (el: HTMLElement) =>
  (el.shadowRoot?.querySelector('ion-select') as unknown as { value?: unknown } | null)?.value;

describe('the new-order picker opens on the configured default order type (kitchen#48)', () => {
  it('opens on the SAVED value', async () => {
    settingsRows = [{ default_order_type: 'takeaway' }];
    const el = await mount();
    expect(picked(el), 'the picker ignores `default_order_type` and stays on dine_in').toBe('takeaway');
  });

  it('opens on `dine_in` when the hub has no settings row yet', async () => {
    settingsRows = [];
    const el = await mount();
    expect(picked(el)).toBe('dine_in');
  });

  it('opens on `dine_in` when `kitchen.settings.get` fails', async () => {
    settingsRows = new Error('no permission');
    const el = await mount();
    expect(picked(el), 'a failing settings query must not leave the picker blank').toBe('dine_in');
  });

  it('ignores a value the module does not know', async () => {
    settingsRows = [{ default_order_type: 'drive_through' }];
    const el = await mount();
    expect(picked(el), 'an unknown order type would be sent to the command and rejected').toBe('dine_in');
  });
});
