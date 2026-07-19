// Contrato del CHIP+MODAL de comandas que kitchen inyecta en el TPV (slot `sales.pos.order_info`,
// decisión Ioan 2026-07-19, 2ª ronda del debate). Composición por módulos, de lo básico a lo
// complejo: sales solo parte su carrito en Pendiente/Enviado; el DETALLE de las comandas — número,
// hora, ESTADO EN VIVO del KDS (En cola/Preparando/Lista/Servida) — es dato de kitchen
// (`source_order_id`) y lo pinta este filler:
//
//   - host → filler `erp:pos-state {order_id, …}` (mismo canal que el botón del footer).
//   - El filler consulta SUS comandas (`kitchen.orders.list` filtrado por f_source_order_id) y
//     pinta un chip «Comandas · N» que abre SU modal (dialog top-layer, patrón del picker de
//     mesas). Sin comandas o sin pedido: NADA (el TPV de tienda no ve cocina ni de lejos).
//   - Los eventos del KDS (kitchen.order.ready/served/…) refrescan en vivo: el camarero ve
//     «LISTA» sin tocar nada.
import { beforeEach, describe, expect, it } from 'vitest';

const COMANDAS = [
  { id: 'k2', round_number: 2, status: 'preparing', fired_at: '2026-07-19T20:37:00+00:00', created_at: '2026-07-19T20:37:00+00:00' },
  { id: 'k1', round_number: 1, status: 'ready', fired_at: '2026-07-19T18:40:00+00:00', created_at: '2026-07-19T18:40:00+00:00' },
];

let subs: Record<string, Array<(p: unknown) => void>>;
let comandasStub: Array<Record<string, unknown>>;

beforeEach(() => {
  subs = {};
  comandasStub = [...COMANDAS];
  (globalThis as Record<string, unknown>).erplora = {
    locale: 'es',
    t: (_catalog: unknown, key: string, params?: Record<string, unknown>) =>
      (params ? `${key} ${Object.values(params).join(' ')}` : key),
    queryAll: async (name: string, params?: Record<string, unknown>) => {
      if (name === 'kitchen.orders.list' && params?.f_source_order_id === 'o1') return comandasStub;
      return [];
    },
    // Las líneas van por query PLANA: el motor de listas mete paginación y la query de
    // detalle la rechaza (contrato fijado tras un 422 real).
    query: async (name: string) =>
      (name === 'kitchen.orders.items' ? [{ id: 'i1', product_name: 'Caña', quantity: 2_000_000 }] : []),
    on: (event: string, cb: (p: unknown) => void) => {
      (subs[event] ??= []).push(cb);
      return () => undefined;
    },
  };
});

async function montar(orderId?: string) {
  await import('./erp-kitchen-pos-comandas');
  const el = document.createElement('erp-kitchen-pos-comandas');
  document.body.appendChild(el);
  await (el as unknown as { updateComplete: Promise<unknown> }).updateComplete;
  if (orderId !== undefined) {
    el.dispatchEvent(new CustomEvent('erp:pos-state', { detail: { order_id: orderId, items_count: 1, pending_count: 0 }, bubbles: false }));
    await new Promise((r) => setTimeout(r, 0));
    await (el as unknown as { updateComplete: Promise<unknown> }).updateComplete;
  }
  return el;
}

describe('erp-kitchen-pos-comandas (chip+modal del TPV)', () => {
  it('sin pedido o sin comandas, no pinta NADA (la tienda no ve cocina)', async () => {
    const el = await montar();
    expect(el.shadowRoot!.querySelector('.chip'), 'sin pos-state no hay chip').toBeFalsy();

    const el2 = await montar('sin-comandas');
    expect(el2.shadowRoot!.querySelector('.chip'), 'pedido sin comandas: tampoco').toBeFalsy();
  });

  it('con comandas: chip «Comandas · 2» que abre el modal con número, hora y ESTADO', async () => {
    const el = await montar('o1');
    const chip = el.shadowRoot!.querySelector('.chip')!;
    expect(chip, 'el chip existe').toBeTruthy();
    expect(chip.textContent, 'cuenta las comandas del pedido').toContain('2');

    (chip as HTMLElement).click();
    await (el as unknown as { updateComplete: Promise<unknown> }).updateComplete;
    await new Promise((r) => setTimeout(r, 0));
    await (el as unknown as { updateComplete: Promise<unknown> }).updateComplete;

    const filas = [...el.shadowRoot!.querySelectorAll('.krow')];
    expect(filas, 'una fila por comanda, la más reciente primero').toHaveLength(2);
    expect(filas[0].textContent, 'número y estado del KDS').toContain('ui.comandaN 2');
    expect(filas[0].textContent).toContain('ui.stPreparing');
    expect(filas[1].textContent).toContain('ui.stReady');
  });

  it('un evento del KDS refresca EN VIVO: la comanda pasa a LISTA sin tocar nada', async () => {
    const el = await montar('o1');
    expect(Object.keys(subs).some((e) => e.startsWith('kitchen.order.')),
      'el filler está suscrito a los eventos del KDS').toBe(true);

    // El cocinero marca la comanda 2 como LISTA en el KDS.
    comandasStub = comandasStub.map((c) => (c.id === 'k2' ? { ...c, status: 'ready' } : c));
    for (const cbs of Object.values(subs)) cbs.forEach((cb) => cb({ order_id: 'k2' }));
    await new Promise((r) => setTimeout(r, 0));
    await (el as unknown as { updateComplete: Promise<unknown> }).updateComplete;

    (el.shadowRoot!.querySelector('.chip') as HTMLElement).click();
    await (el as unknown as { updateComplete: Promise<unknown> }).updateComplete;
    const primera = el.shadowRoot!.querySelector('.krow');
    expect(primera?.textContent, 'el estado nuevo se ve sin recargar').toContain('ui.stReady');
  });
});
