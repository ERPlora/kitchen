// Contrato del FILLER de cocina en el footer del TPV (slot `sales.pos.actions`, ADR pendiente de
// número — decisión Ioan 2026-07-19). El reparto de papeles:
//
//   - El HOST (`sales`) monta este WC en su footer y le cuenta el estado del carrito con
//     `erp:pos-state {order_id?, items_count, label, channel}` (dispatch SOBRE el elemento,
//     bubbles:false — mismo canal que `erp:order-restored` en el slot de asignación).
//   - El filler es SOLO el botón: al pulsarlo emite `erp:order-fire {}` (bubbles+composed) y es el
//     host quien ejecuta su `sales.order.fire` — el estado del carrito vive en el host, aquí no
//     viaja ninguna línea.
//
// Así, sin `kitchen` instalado el slot queda vacío y el footer del TPV no enseña cocina a una
// peluquería; y `kitchen` jamás llama comandos de `sales`.
import { beforeEach, describe, expect, it } from 'vitest';

beforeEach(() => {
  (globalThis as Record<string, unknown>).erplora = {
    locale: 'es',
    t: (_catalog: unknown, key: string) => key,
  };
});

async function montar() {
  await import('./erp-kitchen-pos-fire');
  const el = document.createElement('erp-kitchen-pos-fire');
  document.body.appendChild(el);
  await (el as unknown as { updateComplete: Promise<unknown> }).updateComplete;
  return el;
}

describe('erp-kitchen-pos-fire (filler del footer del TPV)', () => {
  it('es un botón solo-icono (restaurant) con su etiqueta en aria-label (ADR-0133)', async () => {
    const el = await montar();
    const btn = el.shadowRoot!.querySelector('ion-button.fire')!;
    expect(btn, 'el filler pinta su ion-button').toBeTruthy();
    expect(btn.getAttribute('aria-label'), 'la etiqueta va en aria (solo-icono)').toBe('ui.fireToKitchen');
    expect(btn.querySelector('ion-icon[name="restaurant-outline"]'), 'icono de cocina').toBeTruthy();
  });

  it('nace deshabilitado y se habilita cuando el host le cuenta que hay artículos', async () => {
    const el = await montar();
    const btn = () => el.shadowRoot!.querySelector('ion-button.fire')!;
    expect(btn().hasAttribute('disabled'), 'sin estado no hay nada que enviar').toBe(true);

    el.dispatchEvent(new CustomEvent('erp:pos-state', {
      detail: { order_id: 'o1', items_count: 2, label: 'Mesa 4', channel: 'dine_in' }, bubbles: false,
    }));
    await (el as unknown as { updateComplete: Promise<unknown> }).updateComplete;
    expect(btn().hasAttribute('disabled'), 'con artículos delante, listo para enviar').toBe(false);

    el.dispatchEvent(new CustomEvent('erp:pos-state', { detail: { items_count: 0 }, bubbles: false }));
    await (el as unknown as { updateComplete: Promise<unknown> }).updateComplete;
    expect(btn().hasAttribute('disabled'), 'el carrito se vació: vuelve a apagarse').toBe(true);
  });

  it('al pulsarlo emite erp:order-fire (bubbles+composed) — NO llama comandos de sales', async () => {
    const el = await montar();
    el.dispatchEvent(new CustomEvent('erp:pos-state', { detail: { items_count: 1 }, bubbles: false }));
    await (el as unknown as { updateComplete: Promise<unknown> }).updateComplete;

    let disparos = 0;
    // El host escucha en su contenedor: el evento debe SALIR del shadow root (composed).
    document.body.addEventListener('erp:order-fire', () => { disparos += 1; });
    (el.shadowRoot!.querySelector('ion-button.fire') as HTMLElement).click();
    expect(disparos, 'un toque = un disparo, y cruza el shadow boundary').toBe(1);
  });
});
