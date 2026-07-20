// pos-fire — estado del botón «Enviar a cocina» que kitchen inyecta en el TPV (slot
// `sales.pos.actions`, rediseño 2026-07-19). El host (`sales`) cuenta el estado del carrito por
// `erp:pos-state`; aquí solo se decide si hay algo que enviar. Puro: sin DOM ni SDK.

/** Lo que el host cuenta del carrito en cada `erp:pos-state`. */
export interface PosState {
  order_id?: string;
  items_count: number;
  /** Cuánto queda SIN enviar (el badge del botón). Hosts viejos no lo mandan: se cae a
   *  `items_count` (mejor un disparo de más que un botón muerto). */
  pending_count?: number;
  label?: string;
  channel?: string;
}

/** Artículos aún sin enviar según el host (con fallback compat a `items_count`). */
export function pendingCount(state: PosState | undefined): number {
  if (!state) return 0;
  return state.pending_count ?? state.items_count;
}

/** ¿Hay algo que enviar a cocina? Sin estado aún (no llegó ningún `erp:pos-state`) → no. */
export function canFire(state: PosState | undefined): boolean {
  return pendingCount(state) > 0;
}
