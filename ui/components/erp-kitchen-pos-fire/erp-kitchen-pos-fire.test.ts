// Contrato del FILLER de cocina en «Comanda actual» (slot `sales.pos.actions`, ADR pendiente de
// número — decisión Ioan 2026-07-19). El reparto de papeles:
//
//   - El HOST (`sales`) monta este WC debajo del borrador de comanda y le cuenta el estado con
//     `erp:pos-state {order_id?, items_count, label, channel}` (dispatch SOBRE el elemento,
//     bubbles:false — mismo canal que `erp:order-restored` en el slot de asignación).
//   - El filler es SOLO el botón: al pulsarlo emite `erp:order-fire {}` (bubbles+composed) y es el
//     host quien ejecuta su `sales.order.fire` — el estado del carrito vive en el host, aquí no
//     viaja ninguna línea.
//
// Así, sin `kitchen` instalado desaparece toda la vista «Comanda actual»; y `kitchen` jamás llama
// comandos de `sales`.
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

describe('erp-kitchen-pos-fire (acción de Comanda actual)', () => {
  it('es una acción textual de envío con icono y etiqueta accesible', async () => {
    const el = await montar();
    const btn = el.shadowRoot!.querySelector('ion-button.fire')!;
    expect(btn, 'el filler pinta su ion-button').toBeTruthy();
    expect(btn.getAttribute('aria-label')).toBe('ui.fireToKitchen');
    expect(btn.querySelector('ion-icon[name="send-outline"]'), 'icono de envío').toBeTruthy();
    expect(btn.textContent?.trim(), 'la acción principal se entiende sin memorizar un icono')
      .toContain('ui.fireToKitchen');
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

// El badge de PENDIENTES (2ª ronda del debate, 2026-07-19): el host cuenta en `erp:pos-state`
// cuánto queda SIN enviar (`pending_count`) y el botón lo enseña — el camarero ve de un vistazo
// que tiene 3 artículos sin marchar, sin abrir nada.
describe('badge de pendientes en el botón', () => {
  it('muestra el pending_count y desaparece a cero', async () => {
    const el = await montar();
    el.dispatchEvent(new CustomEvent('erp:pos-state', {
      detail: { order_id: 'o1', items_count: 5, pending_count: 3 }, bubbles: false,
    }));
    await (el as unknown as { updateComplete: Promise<unknown> }).updateComplete;
    expect(el.shadowRoot!.querySelector('.badge')?.textContent?.trim(), 'el badge cuenta lo sin enviar').toBe('3');

    el.dispatchEvent(new CustomEvent('erp:pos-state', {
      detail: { order_id: 'o1', items_count: 5, pending_count: 0 }, bubbles: false,
    }));
    await (el as unknown as { updateComplete: Promise<unknown> }).updateComplete;
    expect(el.shadowRoot!.querySelector('.badge'), 'a cero no hay badge (ni botón activo)').toBeFalsy();
  });
});

// URGENTE (hub#1411) — el gesto para mandar una ronda con prioridad.
//
// Decisión de mercado (8 referencias, tabla en la PR): hay dos campos. Toast, Fresh KDS
// (Lightspeed/Square/Clover) y Clover marcan el «rush» EN LA PANTALLA de cocina, sobre un ticket
// que ya está ahí; Odoo lo pone en el TPV, antes de pulsar «Enviar». Con papel el primer campo es
// imposible —la comanda se imprime UNA vez, al disparar (`kitchen.order.created`), y marcarla
// después no reimprime nada—, así que gana el de Odoo: se arma antes de enviar.
//
// Y se arma para UNA ronda, no como un modo: si el interruptor se quedara puesto, todas las
// rondas siguientes saldrían urgentes sin que el camarero lo viera (el papel está en cocina, no
// en su mano) — y una cocina donde todo es urgente no tiene nada urgente. Por eso se desarma al
// enviar y al cambiar de pedido.
describe('marcar la ronda como URGENTE (hub#1411)', () => {
  const urgente = (el: Element) => el.shadowRoot!.querySelector('ion-button.urgent') as HTMLElement;
  const enviar = (el: Element) => el.shadowRoot!.querySelector('ion-button.fire') as HTMLElement;
  const listo = (el: Element) => (el as unknown as { updateComplete: Promise<unknown> }).updateComplete;

  async function conCarrito(orderId = 'o1') {
    const el = await montar();
    el.dispatchEvent(new CustomEvent('erp:pos-state', {
      detail: { order_id: orderId, items_count: 2, pending_count: 2 }, bubbles: false,
    }));
    await listo(el);
    return el;
  }

  it('nace apagado y es un control con estado accesible', async () => {
    const el = await conCarrito();
    expect(urgente(el), 'el filler pinta su interruptor de urgencia').toBeTruthy();
    expect(urgente(el).getAttribute('aria-pressed'), 'una ronda normal por defecto').toBe('false');
    expect(urgente(el).getAttribute('aria-label')).toBe('ui.markUrgent');
  });

  it('sin armar, el disparo viaja SIN prioridad (contrato de siempre)', async () => {
    const el = await conCarrito();
    let detalle: unknown;
    document.body.addEventListener('erp:order-fire', (e) => { detalle = (e as CustomEvent).detail; }, { once: true });
    enviar(el).click();
    expect(detalle, 'el 99 % de las comandas sigue sin la clave').toEqual({});
  });

  it('armado, el botón de enviar DICE que va urgente', async () => {
    const el = await conCarrito();
    urgente(el).click();
    await listo(el);
    expect(urgente(el).getAttribute('aria-pressed')).toBe('true');
    expect(enviar(el).textContent?.trim(), 'nadie manda una urgente sin verlo').toContain('ui.fireUrgent');
    expect(enviar(el).getAttribute('aria-label')).toBe('ui.fireUrgent');
  });

  it('armado, el disparo lleva priority: rush', async () => {
    const el = await conCarrito();
    urgente(el).click();
    await listo(el);
    let detalle: unknown;
    document.body.addEventListener('erp:order-fire', (e) => { detalle = (e as CustomEvent).detail; }, { once: true });
    enviar(el).click();
    expect(detalle, 'el vocabulario es el de kitchen: `rush`, en minúsculas').toEqual({ priority: 'rush' });
  });

  it('se desarma DESPUÉS de enviar: urgente es una ronda, no un modo', async () => {
    const el = await conCarrito();
    urgente(el).click();
    await listo(el);
    enviar(el).click();
    await listo(el);
    expect(urgente(el).getAttribute('aria-pressed'), 'la siguiente ronda vuelve a ser normal').toBe('false');
    expect(enviar(el).textContent?.trim()).toContain('ui.fireToKitchen');
  });

  it('se desarma al cambiar de pedido: la urgencia no se hereda de otra mesa', async () => {
    const el = await conCarrito('o1');
    urgente(el).click();
    await listo(el);
    el.dispatchEvent(new CustomEvent('erp:pos-state', {
      detail: { order_id: 'o2', items_count: 1, pending_count: 1 }, bubbles: false,
    }));
    await listo(el);
    expect(urgente(el).getAttribute('aria-pressed'), 'otra mesa, otra decisión').toBe('false');
  });
});
