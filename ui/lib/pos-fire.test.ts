import { describe, expect, it } from 'vitest';
import { canFire } from './pos-fire';

// El botón «Enviar a cocina» que kitchen INYECTA en el footer del TPV (slot `sales.pos.actions`,
// rediseño 2026-07-19). Antes vivía hardcodeado en `sales` y lo veían peluquerías y tiendas que no
// tienen cocina. La regla de habilitado es puro dato: hay algo que enviar o no lo hay.
describe('canFire: ¿hay algo que enviar a cocina?', () => {
  it('sin estado del TPV aún (no llegó erp:pos-state) no se dispara', () => {
    expect(canFire(undefined)).toBe(false);
  });

  it('carrito vacío: nada que enviar', () => {
    expect(canFire({ items_count: 0 })).toBe(false);
  });

  it('con artículos delante, se puede enviar', () => {
    expect(canFire({ items_count: 3, order_id: 'o1', label: 'Mesa 4' })).toBe(true);
  });
});
