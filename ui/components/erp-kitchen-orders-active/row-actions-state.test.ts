// The orders table only offers the transitions the ticket's state allows (kitchen#11).
//
// The runtime is the authority (the handler refuses anything outside the matrix), but a button that
// always fails is a dead key. Each action is disabled per row unless the row's status is one the
// verb accepts:  fire←pending · mark_ready←pending|preparing · mark_served←ready · recall←ready ·
// cancel←pending|preparing|ready. When a stale client still hits a refused transition, the business
// code is shown in the user's language and the list is reloaded so the row shows its real state.
import { beforeEach, describe, expect, it } from 'vitest';

let commandImpl: (name: string, payload: Record<string, unknown>) => Promise<unknown>;
let loads = 0;

class DomainErr extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
  }
}

beforeEach(() => {
  loads = 0;
  commandImpl = async () => ({});
  (globalThis as Record<string, unknown>).erplora = {
    query: async () => [],
    queryPage: async () => {
      loads += 1;
      return { rows: [], total: 0, limit: 50, offset: 0 };
    },
    command: (name: string, payload: Record<string, unknown>) => commandImpl(name, payload),
    hasPermission: () => true,
    on: () => () => {},
    locale: 'es',
    t: (_catalog: unknown, key: string) => key,
    formatMoney: (cents: number) => `${((cents || 0) / 100).toFixed(2)} €`,
    // The real client always exposes it (module-sdk getter); the list declares `moneyFilters` (pm#501).
    currencyDecimals: 2,
  };
});

type Host = HTMLElement & {
  updateComplete: Promise<unknown>;
  rowActions: { id: string; disabled?: (row: Record<string, unknown>) => boolean }[];
  formError: string;
  onRowAction(ev: CustomEvent<{ actionId: string; row: Record<string, unknown> }>): Promise<void>;
};

async function mount(): Promise<Host> {
  await import('./erp-kitchen-orders-active');
  const el = document.createElement('erp-kitchen-orders-active') as Host;
  document.body.appendChild(el);
  await el.updateComplete;
  await new Promise((r) => setTimeout(r, 0));
  await el.updateComplete;
  return el;
}

const STATES = ['pending', 'preparing', 'ready', 'served', 'cancelled'];
const ALLOWED: Record<string, string[]> = {
  fire: ['pending'],
  mark_ready: ['pending', 'preparing'],
  mark_served: ['ready'],
  recall: ['ready'],
  cancel: ['pending', 'preparing', 'ready'],
};

describe('each action is enabled only in the states its verb accepts', () => {
  for (const [verb, allowed] of Object.entries(ALLOWED)) {
    it(`${verb} ← ${allowed.join('|')}`, async () => {
      const el = await mount();
      const action = el.rowActions.find((a) => a.id === verb)!;
      expect(action.disabled, `${verb} declares a per-row disabled()`).toBeTypeOf('function');
      for (const status of STATES) {
        expect(action.disabled!({ id: 'k1', status }), `${verb} on ${status}`).toBe(!allowed.includes(status));
      }
    });
  }
});

describe('a stale client that hits a refused transition sees why and gets the fresh row', () => {
  it('shows the translated business code and reloads the list', async () => {
    const el = await mount();
    const before = loads;
    commandImpl = async () => {
      throw new DomainErr('kitchen.invalid_transition', 'server fallback (english)');
    };
    await el.onRowAction(new CustomEvent('rowAction', { detail: { actionId: 'mark_ready', row: { id: 'k1', status: 'served' } } }));
    expect(el.formError).toBe('Esa comanda ya no está en el estado que requiere esta acción. Actualiza e inténtalo de nuevo.');
    expect(loads, 'the list is reloaded so the row shows its real state').toBeGreaterThan(before);
  });

  it('an error without a known code keeps the server message', async () => {
    const el = await mount();
    commandImpl = async () => {
      throw new Error('boom');
    };
    await el.onRowAction(new CustomEvent('rowAction', { detail: { actionId: 'fire', row: { id: 'k1', status: 'pending' } } }));
    expect(el.formError).toBe('boom');
  });
});
