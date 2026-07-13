// Contrato de la BARRA de la lista de ESTACIONES de cocina.
//
// El alta de una estación (Plancha, Freidora, Pase…) colgaba de un <form> suelto ENCIMA de la
// tabla. El resto del Hub —/employees en el core, el CRUD de productos de `inventory`, la lista de
// `services`— no lo hace así: el alta vive DENTRO de `ok-data-table`, detrás del «+» de su barra de
// herramientas, que despliega el panel `slot="create"`. Los filtros, igual: dentro, detrás del
// embudo, y los de dominio cerrado (activa sí/no) con un `select`, no tecleando el valor a pelo.
//
// Ojo con el ÁMBITO: aquí solo se mueve el ALTA. El panel de EDICIÓN (acción de fila «Editar») y el
// de ENRUTADO (producto/categoría → estación) NO son altas de fila: son paneles de configuración y
// siguen fuera de la tabla, a propósito.
import { beforeEach, describe, expect, it } from 'vitest';

const PENDING = [{ station_id: 'st1', pending_count: 3 }];

const comandos: { name: string; payload: Record<string, unknown> }[] = [];

beforeEach(() => {
  comandos.length = 0;
  (globalThis as Record<string, unknown>).erplora = {
    query: async (name: string) => (name === 'kitchen.stations.pending_counts' ? PENDING : []),
    queryPage: async () => ({
      rows: [{ id: 'st1', name: 'Plancha', color: '#F97316', icon: 'flame', printer_name: 'COCINA-1', is_active: 1 }],
      total: 1,
    }),
    command: async (name: string, payload: Record<string, unknown>) => {
      comandos.push({ name, payload });
      return {};
    },
    on: () => () => {},
    locale: 'es',
    t: (_catalog: unknown, key: string) => key,
  };
});

async function montar() {
  await import('./erp-kitchen-orders-stations');
  const el = document.createElement('erp-kitchen-orders-stations');
  document.body.appendChild(el);
  await (el as unknown as { updateComplete: Promise<unknown> }).updateComplete;
  await new Promise((r) => setTimeout(r, 0));
  await (el as unknown as { updateComplete: Promise<unknown> }).updateComplete;
  return el as HTMLElement & { shadowRoot: ShadowRoot };
}

const tabla = (el: HTMLElement & { shadowRoot: ShadowRoot }) =>
  el.shadowRoot.querySelector('ok-data-table') as (HTMLElement & { addable: boolean; fill: boolean; close: () => void }) | null;

describe('el alta de estación vive DENTRO de la tabla (paridad con /employees, inventory y services)', () => {
  it('la tabla declara `addable` → pinta el «+» en su barra', async () => {
    const el = await montar();
    expect(tabla(el)?.addable, 'sin `addable` no hay «+» en la barra de la tabla').toBe(true);
  });

  it('la tabla declara `fill` → ocupa el alto de la vista (scroll interno, pie fijo)', async () => {
    const el = await montar();
    expect(tabla(el)?.fill).toBe(true);
  });

  it('el formulario de alta se proyecta en el panel `create` de la tabla', async () => {
    const el = await montar();
    const form = el.shadowRoot.querySelector('form[slot="create"]');
    expect(form, 'el formulario de alta no está en el slot `create`').toBeTruthy();
    expect(form?.closest('ok-data-table'), 'el formulario de alta cuelga fuera de la tabla').toBeTruthy();
  });

  it('no queda NINGÚN formulario de alta suelto fuera de la tabla', async () => {
    const el = await montar();
    // Los paneles de edición/enrutado sí viven fuera (no son altas de fila): se excluyen por `.panel`.
    const sueltos = [...el.shadowRoot.querySelectorAll('form')].filter(
      (n) => !n.closest('ok-data-table') && !n.closest('.panel'),
    );
    expect(sueltos.length, 'hay un formulario de alta suelto encima de la tabla').toBe(0);
  });

  it('el título de la página lo pinta el topbar del shell: la vista no repite un <h2>', async () => {
    const el = await montar();
    expect(el.shadowRoot.querySelector('h2'), 'la vista duplica el título del topbar').toBeNull();
  });
});

describe('los filtros van en la tabla, y los de dominio cerrado son `select`', () => {
  it('«activa» se filtra con un select Sí/No (el servidor la filtra por `eq`)', async () => {
    const el = await montar();
    const cols = (el as unknown as { columns: { key: string; filterType?: string; options?: { value: string }[] }[] }).columns;
    const activa = cols.find((c) => c.key === 'is_active');
    expect(activa?.filterType).toBe('select');
    expect(activa?.options?.map((o) => o.value)).toEqual(['1', '0']);
  });
});

describe('el alta sigue funcionando desde el panel', () => {
  it('crear una estación manda kitchen.stations.create con los datos del panel', async () => {
    const el = await montar();
    const wc = el as unknown as { newName: string; newPrinter: string; createStation: (ev: Event) => Promise<void> };
    wc.newName = 'Freidora';
    wc.newPrinter = 'COCINA-2';
    await wc.createStation(new Event('submit'));

    const alta = comandos.find((c) => c.name === 'kitchen.stations.create');
    expect(alta, 'no se mandó el alta de la estación').toBeTruthy();
    expect(alta!.payload.name).toBe('Freidora');
    expect(alta!.payload.printer_name).toBe('COCINA-2');
  });

  it('tras crear con éxito se CIERRA el panel del «+» (si no, se queda abierto tapando la tabla)', async () => {
    const el = await montar();
    let cerrado = false;
    const t = tabla(el)!;
    t.close = () => {
      cerrado = true;
    };
    const wc = el as unknown as { newName: string; newPrinter: string; createStation: (ev: Event) => Promise<void> };
    wc.newName = 'Pase';
    await wc.createStation(new Event('submit'));
    expect(cerrado, 'el panel de alta no se cerró tras crear la estación').toBe(true);
  });
});

describe('el pie de la tabla manda: cambiar filas/página recarga server-side', () => {
  it('`pageSizeChange` llega al controlador de lista', async () => {
    const el = await montar();
    tabla(el)!.dispatchEvent(new CustomEvent('pageSizeChange', { detail: 25 }));
    const ctrl = (el as unknown as { ctrl: { state: { pageSize: number } } }).ctrl;
    expect(ctrl.state.pageSize, 'el selector de filas por página no está cableado').toBe(25);
  });
});
