import { LitElement, html, css, nothing } from 'lit';
import type { PropertyValues } from 'lit';
import { state } from 'lit/decorators.js';
import { define } from '@erplora/outfitkit/define';
import '@erplora/outfitkit/ok-inline-feedback';
import '@erplora/outfitkit/ok-data-table';
import type { DataTableColumn, DataTableAction } from '@erplora/outfitkit';
import { createListController } from '@erplora/module-sdk';
import type { ListController, ListClient, ListParams, ListPage } from '@erplora/module-sdk';
// Catálogo i18n del módulo (ADR-0055): esbuild inlinea estos JSON en el `dist` del WC.
import esLocale from '../../../locales/es.json';
import enLocale from '../../../locales/en.json';
const CATALOG: Record<string, unknown> = { es: esLocale, en: enLocale };

interface ErploraClientLike extends ListClient {
  query<T = unknown>(name: string, params?: Record<string, unknown>): Promise<T>;
  queryPage<R = unknown>(name: string, params: ListParams): Promise<ListPage<R>>;
  command<T = unknown>(name: string, payload?: Record<string, unknown>): Promise<T>;
  on(event: string, cb: (payload: unknown) => void): () => void;
  /** i18n del módulo (ADR-0055): idioma activo + traducción del catálogo `ui`. */
  locale: string;
  t(catalog: Record<string, unknown>, key: string, params?: Record<string, unknown>): string;
}

interface Station {
  id: string;
  name: string;
  /** The hub-language name; empty when the station carries no translation (kitchen#45). */
  name_es: string | null;
  color: string;
  icon: string;
  printer_name: string;
  is_active: number;
  pending_count?: number;
}

interface PendingCount {
  station_id: string;
  pending_count: number;
}

/** A hub product / category, as `inventory`'s public lists return them (kitchen#45: the routing
 *  panel picks by NAME from these — nobody types a UUID). */
interface InventoryOption {
  id: string;
  name: string;
}

function erplora(): ErploraClientLike {
  const c = (globalThis as { erplora?: ErploraClientLike }).erplora;
  if (!c) throw new Error('erplora SDK no inicializado por el shell');
  return c;
}

/** The station's name in the hub's language, with the base name as the fallback: an untranslated
 *  row keeps its `name`, never a blank (kitchen#45). */
function stationName(s: { name?: unknown; name_es?: unknown }): string {
  return String(s.name_es || s.name || '—');
}

/** The slice of Ionic's `<ion-alert>` the delete confirmation drives (kitchen#115). */
type IonicAlertElement = HTMLElement & {
  header: string;
  message: string;
  buttons: Array<{ text: string; role?: string; handler?: () => void }>;
  isOpen?: boolean;
  present?: () => Promise<void>;
};

export class ErpKitchenOrdersStations extends LitElement {
  static styles = css`
    :host { display:flex; flex-direction:column; height:100%; min-height:0; font-family: system-ui, sans-serif; color: var(--ion-text-color, #1c1b18); }
    /* The view fills the height: the data-table takes what is left (inner scroll, fixed footer).
       Its floor keeps ~20 rows of text when the edit/routing panels fill a short landscape screen:
       the PAGE scrolls instead of the list collapsing to its toolbar (kitchen#131, as the demo). */
    .page { display:flex; flex-direction:column; min-height:0; flex:1 1 auto; }
    .page > ok-data-table { flex:1 1 auto; min-height:20rem; }
    h3 { margin:.25rem 0 .5rem; font-size:1rem; }
    /* Los paneles de edición/enrutado siguen fuera de la tabla (no son altas de fila): ahí el form
       es ancho y va en fila. El alta, dentro del panel lateral de la tabla, va en columna. */
    .form { display:flex; gap:.75rem; flex-wrap:wrap; align-items:end; margin:.5rem 0 1rem; }
    .form ion-input, .form ion-select { flex:1 1 11rem; min-width:9rem; }
    .form ok-inline-feedback { flex:1 1 100%; }
    .create-form { display:flex; flex-direction:column; gap:.7rem; }
    .create-form ion-button { align-self:flex-end; }
    .panel { border:1px solid var(--ion-border-color,#e7e2d6); border-radius: var(--ok-radius-sm, 10px); padding:.75rem 1rem; margin:0 0 1rem; background:var(--ok-surface-2, var(--ion-color-step-50, rgba(var(--ion-text-color-rgb, 24, 24, 27), 0.04))); }
    .err { color:#d9480f; font-weight:600; }
    .ok { color:#2b8a3e; font-weight:600; }
  `;

  /** What «Add» in the «New station» panel was refused: painted inside that form, never on the page (pm#513). */
  @state() createError = '';

  /** What «Save» in the edit panel was refused: painted inside the edit form (pm#513). */
  @state() editError = '';

  /** What «Save routing» was refused: painted inside the routing form (pm#513). */
  @state() routingError = '';

  /** What a row «Delete» was refused: no form is involved then, so it goes on the page. */
  @state() pageError = '';

  @state() formMsg = '';

  @state() newName = '';

  @state() newPrinter = '';

  @state() saving = false;

  @state() tick = 0;

  /** Estación en edición (null = sin panel de edición abierto). */
  @state() editing: Station | null = null;

  @state() editName = '';

  @state() editPrinter = '';

  @state() editColor = '';

  @state() editActive = true;

  /** Formulario de enrutado producto/categoría → estación. */
  @state() routeStationId = '';

  @state() routeProductId = '';

  @state() routeCategoryId = '';

  /** Las opciones del enrutado (kitchen#45): los productos y categorías REALES del hub, de las
   *  listas públicas de `inventory` — lo que el resto del hub hace para elegir (appointments con
   *  customers/services/staff). Vacías si la query falla: el panel degrada a estación-sola, no
   *  rompe la pantalla de estaciones. */
  @state() productOptions: InventoryOption[] = [];

  @state() categoryOptions: InventoryOption[] = [];

  private ctrl!: ListController<Station>;

  private unsub?: () => void;

  private pendingCounts = new Map<string, number>();

  // Getters (no campos): se re-evalúan en cada render → los textos cambian con el idioma activo (ADR-0055).
  private get columns(): DataTableColumn[] {
    const t = (k: string): string => erplora().t(CATALOG, k);
    return [
    // kitchen#45: la columna pinta el nombre EN EL IDIOMA DEL HUB (name_es con caída a name); la
    // query ya proyectaba name_es y nadie lo miraba. El filtro/sort acompañan a lo que se ve.
    { key: 'name_es', header: t('ui.colStation'), sortable: true, filterable: true, filterType: 'text', format: (r) => stationName(r) },
    {
      key: 'printer_name',
      header: t('ui.colPrinter'),
      sortable: true,
      filterable: true,
      filterType: 'text',
      format: (r) => (r.printer_name as string) || '—',
    },
    { key: 'pending_count', header: t('ui.colInProgress'), align: 'right', format: (r) => String(this.pendingCounts.get(String(r.id)) ?? 0) },
    {
      key: 'is_active',
      header: t('ui.colActive'),
      sortable: true,
      filterable: true,
      filterType: 'select',
      options: [
        { value: '1', label: t('ui.yes') },
        { value: '0', label: t('ui.no') },
      ],
      format: (r) => (Number(r.is_active) ? t('ui.yes') : t('ui.no')),
    },
    ];
  }

  private get rowActions(): DataTableAction[] {
    const t = (k: string): string => erplora().t(CATALOG, k);
    return [
    // Solo icono (ADR-0133): el `label` viaja como title + aria-label del botón, no como texto.
    { id: 'edit', label: t('ui.rowEdit'), icon: 'create-outline' },
    { id: 'route', label: t('ui.rowRoute'), icon: 'git-branch-outline' },
    { id: 'delete', label: t('ui.rowDelete'), icon: 'trash-outline', color: 'danger' },
    ];
  }

  private readonly onLocaleChange = (): void => this.requestUpdate();

  async connectedCallback() {
    super.connectedCallback();
    window.addEventListener('erplora:locale-changed', this.onLocaleChange);
    this.ctrl = createListController<Station>(erplora(), 'kitchen.stations.list', () => this.requestUpdate(), {
      pageSize: 50,
      sort: 'name',
      dir: 'asc',
    });
    await Promise.all([this.ctrl.load(), this.loadAux()]);
    try {
      const offs = [
        erplora().on('kitchen.station.created', () => this.reload()),
        erplora().on('kitchen.station.updated', () => this.reload()),
        erplora().on('kitchen.station.deleted', () => this.reload()),
        erplora().on('kitchen.routing.changed', () => this.reload()),
      ];
      this.unsub = () => offs.forEach((o) => o());
    } catch {
      /* sin SDK (preview) → sin reactividad en vivo */
    }
  }

  disconnectedCallback() {
    window.removeEventListener('erplora:locale-changed', this.onLocaleChange);
    super.disconnectedCallback();
    this.unsub?.();
  }

  private async reload() {
    await Promise.all([this.ctrl.load(), this.loadAux()]);
  }

  private async loadAux() {
    try {
      const pending = await erplora().query<PendingCount[]>('kitchen.stations.pending_counts');
      this.pendingCounts = new Map((pending ?? []).map((p) => [p.station_id, p.pending_count]));
      this.requestUpdate();
    } catch {
      /* recuento opcional; la lista sigue funcionando sin él */
    }
    // kitchen#45: las opciones del enrutado. `limit` generoso como el resto del hub (appointments):
    // un hub de barrio no pagina sus categorías en este panel.
    try {
      const [products, categories] = await Promise.all([
        erplora().query<InventoryOption[]>('inventory.products.list', { limit: 500 }).catch(() => [] as InventoryOption[]),
        erplora().query<InventoryOption[]>('inventory.categories.list', { limit: 500 }).catch(() => [] as InventoryOption[]),
      ]);
      this.productOptions = Array.isArray(products) ? products.filter((p) => p?.id && p?.name) : [];
      this.categoryOptions = Array.isArray(categories) ? categories.filter((c) => c?.id && c?.name) : [];
      this.requestUpdate();
    } catch {
      /* sin catálogo (permiso/inventario inactivo): el panel degrada, la pantalla no rompe */
    }
  }

  // Referencia al ok-data-table para cerrar su panel lateral (drawer) tras el alta.
  private dataTable(): { open(p?: 'filters' | 'create'): void; close(): void } | null {
    return this.renderRoot.querySelector('ok-data-table') as
      | { open(p?: 'filters' | 'create'): void; close(): void }
      | null;
  }

  private async createStation(ev: Event) {
    ev.preventDefault();
    if (!this.newName.trim()) return;
    this.saving = true;
    this.createError = '';
    this.pageError = ''; // a save is the next thing the person did: an older row refusal is stale (staff#75)
    this.formMsg = '';
    try {
      await erplora().command('kitchen.stations.create', {
        name: this.newName.trim(),
        printer_name: this.newPrinter.trim(),
      });
      this.newName = '';
      this.newPrinter = '';
      this.dataTable()?.close(); // si no, el panel se queda abierto tapando la estación recién creada
      await this.reload();
    } catch (e) {
      this.createError = e instanceof Error && e.message ? e.message : erplora().t(CATALOG, 'ui.createStationError');
    } finally {
      this.saving = false;
    }
  }

  private openEdit(st: Station) {
    this.editing = st;
    this.editName = st.name;
    this.editPrinter = st.printer_name ?? '';
    this.editColor = st.color ?? '';
    this.editActive = Boolean(Number(st.is_active));
    this.editError = ''; // a refusal is about the station it was saved for, not the one opened now (rv-tickets-43)
    this.formMsg = '';
  }

  private async saveEdit(ev: Event) {
    ev.preventDefault();
    if (!this.editing) return;
    this.saving = true;
    this.editError = '';
    this.pageError = '';
    this.formMsg = '';
    try {
      await erplora().command('kitchen.stations.update', {
        station_id: this.editing.id,
        name: this.editName.trim() || null,
        color: this.editColor.trim() || null,
        printer_name: this.editPrinter.trim(),
        is_active: this.editActive ? 1 : 0,
      });
      this.formMsg = erplora().t(CATALOG, 'ui.stationUpdated');
      this.editing = null;
      await this.reload();
    } catch (e) {
      this.editError = e instanceof Error && e.message ? e.message : erplora().t(CATALOG, 'ui.updateStationError');
    } finally {
      this.saving = false;
    }
  }

  private async saveRouting(ev: Event) {
    ev.preventDefault();
    // Los ids vienen de selects (kitchen#45): cadena vacía = «no se eligió» — el schema del
    // command espera strings con "" como ausencia.
    if (!this.routeStationId || (!this.routeProductId && !this.routeCategoryId)) return;
    this.saving = true;
    this.routingError = '';
    this.pageError = '';
    this.formMsg = '';
    try {
      await erplora().command('kitchen.stations.set_routing', {
        station_id: this.routeStationId,
        product_id: this.routeProductId,
        category_id: this.routeCategoryId,
      });
      this.formMsg = erplora().t(CATALOG, 'ui.routingSaved');
      this.routeProductId = '';
      this.routeCategoryId = '';
      await this.reload();
    } catch (e) {
      this.routingError = e instanceof Error && e.message ? e.message : erplora().t(CATALOG, 'ui.saveRoutingError');
    } finally {
      this.saving = false;
    }
  }

  private async onRowAction(ev: CustomEvent<{ actionId: string; row: Record<string, unknown> }>) {
    const station = ev.detail.row as unknown as Station;
    if (ev.detail.actionId === 'edit') {
      this.openEdit(station);
      return;
    }
    if (ev.detail.actionId === 'route') {
      this.routeStationId = station.id;
      this.routingError = '';
      this.formMsg = '';
      return;
    }
    if (ev.detail.actionId !== 'delete') return;
    await this.confirmDelete(station);
  }

  /** kitchen#115: the trash can asks first, like every POS back office (Square, Toast, Lightspeed,
   *  Odoo). A GLOBAL Ionic overlay appended to `document.body` (appointments#207, the void dialog of
   *  sales): an inline `<ion-alert>` in this shadow root loses its styles when Ionic teleports it,
   *  and its backdrop covers its own buttons the first time in a session (hub#2162). */
  private async confirmDelete(station: Station): Promise<void> {
    const t = (k: string, p?: Record<string, unknown>): string => erplora().t(CATALOG, k, p);
    const alert = document.createElement('ion-alert') as IonicAlertElement;
    alert.header = t('ui.deleteStationTitle', { name: stationName(station) });
    alert.message = t('ui.deleteStationMessage');
    alert.buttons = [
      { text: t('ui.cancel'), role: 'cancel' },
      {
        text: t('ui.rowDelete'),
        role: 'destructive',
        handler: () => {
          void this.deleteStation(station);
        },
      },
    ];
    alert.setAttribute('data-testid', 'kitchen-stations-delete-confirm');
    // Ionic moves the teleported overlay back to its original parent right AFTER emitting
    // ionAlertDidDismiss: remove it on the next task or a hidden alert is left on every delete.
    alert.addEventListener('ionAlertDidDismiss', () => setTimeout(() => alert.remove(), 0), { once: true });
    document.body.appendChild(alert);
    try {
      if (typeof alert.present === 'function') await alert.present();
      else alert.isOpen = true;
    } catch {
      alert.remove();
      this.pageError = t('ui.deleteStationError');
    }
  }

  private async deleteStation(station: Station): Promise<void> {
    this.pageError = '';
    this.formMsg = '';
    try {
      await erplora().command('kitchen.stations.delete', { station_id: station.id });
      await this.reload();
    } catch (e) {
      this.pageError = e instanceof Error && e.message ? e.message : erplora().t(CATALOG, 'ui.deleteStationError');
      // kitchen#126: the station was already deleted (another device, a double tap): refresh so the
      // row the person just tried to delete disappears, keeping the reason on the page.
      if ((e as { code?: unknown } | null)?.code === 'kitchen.station_unavailable') await this.reload();
    }
  }

  /** pm#513: each refusal appears above the button that was pressed — on a phone that can leave it
   *  under the sheet or below the fold. Bring it into view when it appears, not again on every keystroke. */
  updated(changed: PropertyValues): void {
    super.updated(changed);
    if (changed.has('createError') && this.createError) void this.revealRefusal('[data-testid="kitchen-stations-create-error"]');
    if (changed.has('editError') && this.editError) void this.revealRefusal('[data-testid="kitchen-stations-edit-error"]');
    if (changed.has('routingError') && this.routingError) void this.revealRefusal('[data-testid="kitchen-stations-routing-error"]');
  }

  /** ok-inline-feedback lays itself out in its own update: scrolled to before it, the box is empty. */
  private async revealRefusal(selector: string): Promise<void> {
    const banner = this.renderRoot.querySelector(selector) as (HTMLElement & { updateComplete?: Promise<unknown> }) | null;
    await banner?.updateComplete;
    banner?.scrollIntoView?.({ block: 'center' });
  }

  private renderEditPanel() {
    if (!this.editing) return nothing;
    const t = (k: string): string => erplora().t(CATALOG, k);
    return html`<section class="panel" data-testid="kitchen-stations-edit-panel">
      <h3>${t('ui.editStationTitle')} · ${stationName(this.editing)}</h3>
      <form class="form" data-testid="kitchen-stations-edit-form" @submit=${(e: Event) => this.saveEdit(e)}>
        <ion-input data-testid="kitchen-stations-edit-name" mode="md" fill="outline" label=${t('ui.labelName')} label-placement="floating" .value=${this.editName} @ionInput=${(e: any) => (this.editName = e.target.value)}></ion-input>
        <ion-input data-testid="kitchen-stations-edit-color" mode="md" fill="outline" label=${t('ui.labelColor')} label-placement="floating" placeholder="#F97316" .value=${this.editColor} @ionInput=${(e: any) => (this.editColor = e.target.value)}></ion-input>
        <ion-input data-testid="kitchen-stations-edit-printer" mode="md" fill="outline" label=${t('ui.labelPrinter')} label-placement="floating" .value=${this.editPrinter} @ionInput=${(e: any) => (this.editPrinter = e.target.value)}></ion-input>
        <ion-toggle data-testid="kitchen-stations-edit-active" .checked=${this.editActive} @ionChange=${(e: any) => (this.editActive = e.detail.checked)}>${t('ui.labelActive')}</ion-toggle>
        ${this.editError ? html`<ok-inline-feedback data-testid="kitchen-stations-edit-error" tone="danger" icon="alert-circle-outline">${this.editError}</ok-inline-feedback>` : nothing}
        <ion-button data-testid="kitchen-stations-edit-submit" type="submit" size="small" ?disabled=${this.saving}>${this.saving ? t('ui.saving') : t('ui.save')}</ion-button>
        <ion-button data-testid="kitchen-stations-edit-cancel" size="small" fill="outline" @click=${() => (this.editing = null)}>${t('ui.cancel')}</ion-button>
      </form>
    </section>`;
  }

  private renderRoutingPanel() {
    const t = (k: string): string => erplora().t(CATALOG, k);
    const stations = this.ctrl?.rows ?? [];
    // kitchen#45: se elige por NOMBRE de una lista — las listas públicas de inventory — igual que
    // el resto del hub resuelve sus referencias (appointments: customers/services/staff). Nadie
    // teclea un UUID para mandar las bebidas a la Barra; con `interface-options` Ion pintará su
    // buscador nativo cuando la lista crezca.
    return html`<section class="panel">
      <h3>${t('ui.routingTitle')}</h3>
      <form class="form" data-testid="kitchen-stations-routing-form" @submit=${(e: Event) => this.saveRouting(e)}>
        <ion-select data-testid="kitchen-stations-routing-station" mode="md" fill="outline" label-placement="floating" label=${t('ui.colStation')} .value=${this.routeStationId} @ionChange=${(e: any) => (this.routeStationId = e.target.value)}>
          ${stations.map((s) => html`<ion-select-option value=${s.id}>${stationName(s)}</ion-select-option>`)}
        </ion-select>
        <ion-select data-testid="kitchen-stations-routing-product" mode="md" fill="outline" interface="popover" label-placement="floating" label=${t('ui.labelProduct')} placeholder=${t('ui.placeholderOptional')} .value=${this.routeProductId} @ionChange=${(e: any) => (this.routeProductId = e.target.value ?? '')}>
          ${this.productOptions.map((p) => html`<ion-select-option value=${p.id}>${p.name}</ion-select-option>`)}
        </ion-select>
        <ion-select data-testid="kitchen-stations-routing-category" mode="md" fill="outline" interface="popover" label-placement="floating" label=${t('ui.labelCategory')} placeholder=${t('ui.placeholderOptional')} .value=${this.routeCategoryId} @ionChange=${(e: any) => (this.routeCategoryId = e.target.value ?? '')}>
          ${this.categoryOptions.map((c) => html`<ion-select-option value=${c.id}>${c.name}</ion-select-option>`)}
        </ion-select>
        ${this.routingError ? html`<ok-inline-feedback data-testid="kitchen-stations-routing-error" tone="danger" icon="alert-circle-outline">${this.routingError}</ok-inline-feedback>` : nothing}
        <ion-button data-testid="kitchen-stations-routing-submit" type="submit" size="small" ?disabled=${this.saving || !this.routeStationId || (!this.routeProductId && !this.routeCategoryId)}>${this.saving ? t('ui.saving') : t('ui.saveRouting')}</ion-button>
      </form>
    </section>`;
  }

  // El título de la vista lo pinta el topbar del shell: repetirlo aquí lo duplicaba en pantalla.
  // Los paneles de EDICIÓN y ENRUTADO se quedan fuera de la tabla: no dan de alta una fila, son
  // configuración (el enrutado producto/categoría → estación ni siquiera vive en la fila).
  render() {
    const t = (k: string): string => erplora().t(CATALOG, k);
    return html`<div class="page">
        ${this.renderEditPanel()}
        ${this.renderRoutingPanel()}
        ${this.formMsg ? html`<p class="ok" data-testid="kitchen-stations-saved">${this.formMsg}</p>` : nothing}
        ${this.pageError ? html`<ok-inline-feedback data-testid="kitchen-stations-error" tone="danger" icon="alert-circle-outline">${this.pageError}</ok-inline-feedback>` : nothing}
        ${this.ctrl?.error ? html`<ok-inline-feedback data-testid="kitchen-stations-load-error" tone="danger" icon="alert-circle-outline">${this.ctrl.error}</ok-inline-feedback>` : nothing}
        <ok-data-table testid="kitchen-stations-table" .serverSide=${true} .fill=${true} .addable=${true} .labels=${{ add: t('ui.addStation') }} .columns=${this.columns} .views=${true} .cardTitle=${(r: Record<string, unknown>) => stationName(r)} .cardIcon=${() => 'flame-outline'} .rows=${this.ctrl?.rows ?? []} .total=${this.ctrl?.total ?? 0} .page=${this.ctrl?.state.page ?? 0} .pageSize=${this.ctrl?.state.pageSize ?? 50} .sort=${this.ctrl?.state.sort} .sortDir=${this.ctrl?.state.dir ?? 'asc'} .searchable=${true} .searchPlaceholder=${t('ui.searchStations')} .emptyMessage=${this.ctrl?.loading ? t('ui.loading') : t('ui.emptyStations')} .actions=${this.rowActions} .rowClickable=${true} @rowAction=${(e: CustomEvent<{ actionId: string; row: Record<string, unknown> }>) => this.onRowAction(e)} @rowClick=${(e: CustomEvent<{ row: Record<string, unknown> }>) => this.onRowAction({ detail: { actionId: 'edit', row: e.detail.row } } as CustomEvent<{ actionId: string; row: Record<string, unknown> }>)} @pageChange=${(e: CustomEvent<number>) => this.ctrl.setPage(e.detail)} @pageSizeChange=${(e: CustomEvent<number>) => this.ctrl.setPageSize(e.detail)} @sortChange=${(e: CustomEvent<{ sort: string; dir: 'asc' | 'desc' }>) => this.ctrl.setSort(e.detail.sort, e.detail.dir)} @searchChange=${(e: CustomEvent<string>) => this.ctrl.setSearch(e.detail)} @filterChange=${(e: CustomEvent<{ col: string; value: unknown }>) => this.ctrl.setFilter(e.detail.col, e.detail.value)}>
          <!-- Alta de estación: se proyecta SIEMPRE (aunque el panel esté cerrado); si se renderizara
               solo con el panel abierto, el «+» de la barra abriría un panel vacío. -->
          <form slot="create" class="create-form" data-testid="kitchen-stations-create-form" @submit=${(e: Event) => this.createStation(e)}>
            <ion-input data-testid="kitchen-stations-create-name" mode="md" fill="outline" label-placement="floating" label=${t('ui.labelName')} placeholder=${t('ui.placeholderStationName')} .value=${this.newName} @ionInput=${(e: any) => (this.newName = e.target.value)}></ion-input>
            <ion-input data-testid="kitchen-stations-create-printer" mode="md" fill="outline" label-placement="floating" label=${t('ui.labelPrinter')} placeholder=${t('ui.placeholderPrinterOptional')} .value=${this.newPrinter} @ionInput=${(e: any) => (this.newPrinter = e.target.value)}></ion-input>
            <!-- pm#513: the refusal travels WITH the form — under 834 px the panel is a full-screen
                 sheet and a notice on the page underneath it is never seen. -->
            ${this.createError ? html`<ok-inline-feedback data-testid="kitchen-stations-create-error" tone="danger" icon="alert-circle-outline">${this.createError}</ok-inline-feedback>` : nothing}
            <ion-button data-testid="kitchen-stations-create-submit" type="submit" ?disabled=${this.saving || !this.newName}>${this.saving ? t('ui.saving') : t('ui.createStation')}</ion-button>
          </form>
        </ok-data-table>
      </div>`;
  }
}

define('erp-kitchen-orders-stations', ErpKitchenOrdersStations);
