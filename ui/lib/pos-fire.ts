// pos-fire — estado del botón «Enviar a cocina» que kitchen inyecta en el TPV (slot
// `sales.pos.actions`, rediseño 2026-07-19). El host (`sales`) cuenta el estado del carrito por
// `erp:pos-state`; aquí solo se decide si hay algo que enviar. Puro: sin DOM ni SDK.

/** Lo que el host cuenta del carrito en cada `erp:pos-state`. */
export interface PosState {
  order_id?: string;
  items_count: number;
  label?: string;
  channel?: string;
}

/** ¿Hay algo que enviar a cocina? Sin estado aún (no llegó ningún `erp:pos-state`) → no. */
export function canFire(state: PosState | undefined): boolean {
  return !!state && state.items_count > 0;
}
