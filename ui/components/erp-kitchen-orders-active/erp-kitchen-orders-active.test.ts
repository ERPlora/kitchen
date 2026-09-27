// Contrato del DINERO en la tabla de COMANDAS (incidencia 5).
//
// El `total` de la comanda viaja como INTEGER en CÉNTIMOS (ADR-0007/0123). La columna Total
// formateaba con `Number(r.total).toFixed(2)` — céntimos crudos con dos decimales — así que una
// comanda de 6,00 € se pintaba «600.00». El formateo a euros es SOLO de presentación y lo da el
// SDK del cliente (`formatMoney(cents)` divide entre 100, ADR-0059): nunca dividir a mano con
// formato ad-hoc. Mismo patrón que la lista de ventas de `sales` y el CRUD de `inventory` (su #9).
import { beforeEach, describe, expect, it } from 'vitest';

/** Céntimos que recibió `formatMoney`, para afirmar que le llegan CÉNTIMOS (no euros). */
const formateos: number[] = [];

beforeEach(() => {
  formateos.length = 0;
  (globalThis as Record<string, unknown>).erplora = {
    query: async () => [],
    queryPage: async (name: string) =>
      name === 'kitchen.orders.list'
        ? {
            rows: [{ id: 'o1', order_number: 'K-001', status: 'pending', order_type: 'dine_in', label: 'Mesa 4', priority: 'normal', total: 600, notes: '', created_at: '2026-07-19T12:00:00Z' }],
            total: 1,
            limit: 50,
            offset: 0,
          }
        : { rows: [], total: 0, limit: 50, offset: 0 },
    command: async () => ({}),
    on: () => () => {},
    locale: 'es',
    t: (_catalog: unknown, key: string) => key,
    // Contrato REAL del SDK (ADR-0059): formatMoney recibe CÉNTIMOS y divide entre 100.
    formatMoney: (cents: number) => {
      formateos.push(cents);
      return `${((cents || 0) / 100).toFixed(2)} €`;
    },
    // The real client always exposes it (module-sdk getter); the list declares `moneyFilters` (pm#501).
    currencyDecimals: 2,
  };
});

async function montar() {
  await import('./erp-kitchen-orders-active');
  const el = document.createElement('erp-kitchen-orders-active');
  document.body.appendChild(el);
  await (el as unknown as { updateComplete: Promise<unknown> }).updateComplete;
  await new Promise((r) => setTimeout(r, 0));
  await (el as unknown as { updateComplete: Promise<unknown> }).updateComplete;
  return el as HTMLElement & { shadowRoot: ShadowRoot };
}

const colTotal = (el: HTMLElement) => {
  const cols = (el as unknown as { columns: { key: string; format?: (r: Record<string, unknown>) => string }[] }).columns;
  return cols.find((c) => c.key === 'total');
};

describe('la columna Total pinta euros, no céntimos crudos (ADR-0007/0123 + ADR-0059)', () => {
  it('600 céntimos se pintan «6.00 €», no «600.00»', async () => {
    const el = await montar();
    expect(colTotal(el)?.format?.({ total: 600 }), 'la columna Total pinta los céntimos crudos').toBe('6.00 €');
  });

  it('el formateo pasa por formatMoney del SDK y le llegan CÉNTIMOS', async () => {
    const el = await montar();
    colTotal(el)?.format?.({ total: 600 });
    expect(formateos, 'la columna no usa formatMoney (o no le pasa los céntimos tal cual)').toContain(600);
  });

  it('un total ausente no revienta el formateo (pinta 0,00)', async () => {
    const el = await montar();
    expect(colTotal(el)?.format?.({})).toBe('0.00 €');
  });
});
