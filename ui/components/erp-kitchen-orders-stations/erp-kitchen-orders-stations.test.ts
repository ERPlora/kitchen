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

// kitchen#45: the routing panel picks from the hub's REAL products and categories (inventory's
// public lists), and the stations speak the hub's language (`name_es` with `name` as fallback —
// st2 carries no translation, so the base name must survive, never a blank).
const STATIONS = [
  { id: 'st1', name: 'Bar', name_es: 'Barra', color: '#F97316', icon: 'flame', printer_name: 'COCINA-1', is_active: 1 },
  { id: 'st2', name: 'Kitchen', name_es: '', color: '#2DD36F', icon: 'restaurant', printer_name: 'COCINA-2', is_active: 1 },
];
const CATEGORIES = [
  { id: 'cat-1', name: 'Refrescos' },
  { id: 'cat-2', name: 'Café' },
];
const PRODUCTS = [
  { id: 'p-1', name: 'Alitas de pollo', sku: 'ALI-1' },
  { id: 'p-2', name: 'Arroz a banda', sku: 'ARB-1' },
];

const comandos: { name: string; payload: Record<string, unknown> }[] = [];

beforeEach(() => {
  comandos.length = 0;
  (globalThis as Record<string, unknown>).erplora = {
    query: async (name: string) => {
      if (name === 'kitchen.stations.pending_counts') return PENDING;
      if (name === 'inventory.categories.list') return CATEGORIES;
      if (name === 'inventory.products.list') return PRODUCTS;
      return [];
    },
    queryPage: async () => ({
      rows: STATIONS,
      total: STATIONS.length,
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
  el.shadowRoot.querySelector('ok-data-table') as (HTMLElement & { addable: boolean; fill: boolean; close: () => void; rowClickable: boolean }) | null;

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

// ── pm#155 (outfitkit#67, second half) ────────────────────────────────────────────────────────
//
// At 1440 px the «Actions» column fell off the screen with nothing hinting the table went on to
// the right, so the only door into a station was a button nobody could see. OutfitKit 0.1.44
// pins that column, but the other half of the fix is opt-in: `rowClickable` turns the whole row
// into a door — the first thing a user tries. The list has to ask for it, and wire `rowClick`
// to the same edit panel the «edit» action opens.
describe('clicking the row opens the station (pm#155)', () => {
  it('the table declares `rowClickable` → the whole row is a door, not just the action button', async () => {
    const el = await montar();
    expect(
      tabla(el)?.rowClickable,
      'without `rowClickable` the row is dead: if the actions column is off-screen there is no way in',
    ).toBe(true);
  });

  it('`rowClick` puts the station in the edit panel, same as the «edit» action', async () => {
    const el = await montar();
    tabla(el)!.dispatchEvent(new CustomEvent('rowClick', { detail: { row: { id: 'st1', name: 'Cocina', color: 'primary', sort_order: 1, is_active: 1 } } }));
    await new Promise((r) => setTimeout(r, 0));
    await (el as unknown as { updateComplete: Promise<unknown> }).updateComplete;
    const wc = el as unknown as { editing: unknown };
    expect(wc.editing, 'the row was clicked and the edit panel did not take the station').toBeTruthy();
  });
});

// ── kitchen#45: el enrutado se elige por NOMBRE, y las estaciones hablan el idioma del hub ─────
//
// El panel de enrutado pedía «ID de producto» / «ID de categoría» como TEXTO LIBRE: para mandar
// las bebidas a la Barra había que TECLEAR un UUID, y no había forma en la aplicación de
// averiguar cuál era el de «Refrescos». Así lo hace el mercado (Toast «Prep station routing»,
// Square «Ticket routing»): se elige de una lista con el nombre. Y en la misma pantalla las
// estaciones se listaban como Bar/Kitchen —inglés— con la fila teniendo name_es («Barra»,
// «Cocina») relleno y sin usar, aunque kitchen.stations.list YA lo proyecta.
describe('el enrutado se elige por NOMBRE de una lista, no tecleando ids (kitchen#45)', () => {
  const routingForm = (el: HTMLElement & { shadowRoot: ShadowRoot }) =>
    Array.from(el.shadowRoot.querySelectorAll('form'))
      .find((f) => f.textContent?.includes('ui.routingTitle') || f.querySelector('ion-select')) as HTMLFormElement | undefined;

  it('producto y categoría son ion-select con las opciones REALES del hub (inventory)', async () => {
    const el = await montar();
    const form = routingForm(el);
    expect(form, 'no hay formulario de enrutado').toBeTruthy();
    // Ya no queda NINGÚN ion-input de texto libre en el panel de enrutado.
    expect(form!.querySelectorAll('ion-input').length, 'el panel sigue pidiendo ids a pelo').toBe(0);
    const selects = Array.from(form!.querySelectorAll('ion-select'));
    expect(selects.length).toBe(3); // estación + producto + categoría
    const optionsOf = (s: HTMLElement) => Array.from(s.querySelectorAll('ion-select-option'));
    const byOptions = selects.find((s) => optionsOf(s).some((o) => o.getAttribute('value') === 'p-1'));
    expect(byOptions, 'no hay select de producto con las opciones de inventory.products.list').toBeTruthy();
    const texts = optionsOf(byOptions!).map((o) => o.textContent?.trim());
    expect(texts).toEqual(['Alitas de pollo', 'Arroz a banda']);
    const byCategories = selects.find((s) => optionsOf(s).some((o) => o.getAttribute('value') === 'cat-1'));
    expect(byCategories, 'no hay select de categoría con las opciones de inventory.categories.list').toBeTruthy();
    expect(optionsOf(byCategories!).map((o) => o.textContent?.trim())).toEqual(['Refrescos', 'Café']);
  });

  it('guardar manda el id ELEGIDO y cadena vacía en el que no se tocó', async () => {
    const el = await montar();
    const wc = el as unknown as {
      routeStationId: string;
      routeProductId: string;
      routeCategoryId: string;
      saveRouting: (ev: Event) => Promise<void>;
    };
    wc.routeStationId = 'st1';
    wc.routeProductId = 'p-2';
    wc.routeCategoryId = '';
    await wc.saveRouting(new Event('submit'));
    const ruta = comandos.find((c) => c.name === 'kitchen.stations.set_routing');
    expect(ruta, 'no se mandó el enrutado').toBeTruthy();
    expect(ruta!.payload).toEqual({ station_id: 'st1', product_id: 'p-2', category_id: '' });
  });

  it('sin producto NI categoría no se manda nada (el command lo rechazaría)', async () => {
    const el = await montar();
    const wc = el as unknown as { routeStationId: string; routeProductId: string; routeCategoryId: string; saveRouting: (ev: Event) => Promise<void> };
    wc.routeStationId = 'st1';
    wc.routeProductId = '';
    wc.routeCategoryId = '';
    await wc.saveRouting(new Event('submit'));
    expect(comandos.find((c) => c.name === 'kitchen.stations.set_routing')).toBeUndefined();
  });
});

describe('las estaciones se muestran en el idioma del hub (kitchen#45)', () => {
  it('la columna ESTACIÓN usa name_es con caída a name', async () => {
    const el = await montar();
    const cols = (el as unknown as { columns: { key: string; format?: (r: Record<string, unknown>) => unknown }[] }).columns;
    const col = cols.find((c) => c.key === 'name_es');
    expect(col?.format, 'la columna de nombre no formatea: pintaría `name` a secas').toBeTypeOf('function');
    expect(col!.format!({ name: 'Bar', name_es: 'Barra' })).toBe('Barra');
    expect(col!.format!({ name: 'Kitchen', name_es: '' })).toBe('Kitchen');
    expect(col!.format!({ name: 'Pase', name_es: null })).toBe('Pase');
  });

  it('el select de estación del enrutado también muestra name_es', async () => {
    const el = await montar();
    const selects = Array.from(el.shadowRoot.querySelectorAll('form ion-select'));
    const byStation = selects.find((s) => Array.from(s.querySelectorAll('ion-select-option')).some((o) => o.getAttribute('value') === 'st1'));
    expect(byStation, 'no hay select de estación en el panel de enrutado').toBeTruthy();
    const texts = Array.from(byStation!.querySelectorAll('ion-select-option')).map((o) => o.textContent?.trim());
    expect(texts).toEqual(['Barra', 'Kitchen']);
  });

  it('la tarjeta móvil y el título de edición muestran el nombre localizado', async () => {
    const el = await montar();
    const t = tabla(el) as unknown as { cardTitle: (r: Record<string, unknown>) => string };
    expect(t.cardTitle({ name: 'Bar', name_es: 'Barra' })).toBe('Barra');
    tabla(el)!.dispatchEvent(new CustomEvent('rowClick', { detail: { row: { id: 'st1', name: 'Bar', name_es: 'Barra', is_active: 1 } } }));
    await new Promise((r) => setTimeout(r, 0));
    await (el as unknown as { updateComplete: Promise<unknown> }).updateComplete;
    const h3 = el.shadowRoot.querySelector('h3');
    expect(h3?.textContent).toContain('Barra');
    expect(h3?.textContent).not.toContain('Bar·');
  });
});
