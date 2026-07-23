import { LitElement, html, css, nothing } from 'lit';
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

function erplora(): ErploraClientLike {
  const c = (globalThis as { erplora?: ErploraClientLike }).erplora;
  if (!c) throw new Error('erplora SDK no inicializado por el shell');
  return c;
}

export class ErpKitchenOrdersStations extends LitElement {
  static styles = css`
    :host { display:flex; flex-direction:column; height:100%; min-height:0; font-family: system-ui, sans-serif; color: var(--ion-text-color, #1c1b18); }
    /* La vista llena el alto: el data-table ocupa lo que sobra (scroll interno, pie fijo). */
    .page { display:flex; flex-direction:column; min-height:0; flex:1 1 auto; }
    .page > ok-data-table { flex:1 1 auto; min-height:0; }
    h3 { margin:.25rem 0 .5rem; font-size:1rem; }
    /* Los paneles de edición/enrutado siguen fuera de la tabla (no son altas de fila): ahí el form
       es ancho y va en fila. El alta, dentro del panel lateral de la tabla, va en columna. */
    .form { display:flex; gap:.75rem; flex-wrap:wrap; align-items:end; margin:.5rem 0 1rem; }
    .form ion-input, .form ion-select { flex:1 1 11rem; min-width:9rem; }
    .create-form { display:flex; flex-direction:column; gap:.7rem; }
    .create-form ion-button { align-self:flex-end; }
    .panel { border:1px solid var(--ion-border-color,#e7e2d6); border-radius: var(--ok-radius-sm, 10px); padding:.75rem 1rem; margin:0 0 1rem; background:var(--ok-surface-2, var(--ion-color-step-50, rgba(var(--ion-text-color-rgb, 24, 24, 27), 0.04))); }
    .err { color:#d9480f; font-weight:600; }
    .ok { color:#2b8a3e; font-weight:600; }
  `;

  @state() formError = '';

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

  private ctrl!: ListController<Station>;

  private unsub?: () => void;

  private pendingCounts = new Map<string, number>();

  // Getters (no campos): se re-evalúan en cada render → los textos cambian con el idioma activo (ADR-0055).
  private get columns(): DataTableColumn[] {
    const t = (k: string): string => erplora().t(CATALOG, k);
    return [
    { key: 'name', header: t('ui.colStation'), sortable: true, filterable: true, filterType: 'text' },
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
    this.formError = '';
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
      this.formError = e instanceof Error ? e.message : erplora().t(CATALOG, 'ui.createStationError');
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
    this.formError = '';
    this.formMsg = '';
  }

  private async saveEdit(ev: Event) {
    ev.preventDefault();
    if (!this.editing) return;
    this.saving = true;
    this.formError = '';
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
      this.formError = e instanceof Error ? e.message : erplora().t(CATALOG, 'ui.updateStationError');
    } finally {
      this.saving = false;
    }
  }

  private async saveRouting(ev: Event) {
    ev.preventDefault();
    if (!this.routeStationId || (!this.routeProductId.trim() && !this.routeCategoryId.trim())) return;
    this.saving = true;
    this.formError = '';
    this.formMsg = '';
    try {
      await erplora().command('kitchen.stations.set_routing', {
        station_id: this.routeStationId,
        product_id: this.routeProductId.trim(),
        category_id: this.routeCategoryId.trim(),
      });
      this.formMsg = erplora().t(CATALOG, 'ui.routingSaved');
      this.routeProductId = '';
      this.routeCategoryId = '';
      await this.reload();
    } catch (e) {
      this.formError = e instanceof Error ? e.message : erplora().t(CATALOG, 'ui.saveRoutingError');
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
      this.formError = '';
      this.formMsg = '';
      return;
    }
    if (ev.detail.actionId !== 'delete') return;
    this.formError = '';
    this.formMsg = '';
    try {
      await erplora().command('kitchen.stations.delete', { station_id: station.id });
      await this.reload();
    } catch (e) {
      this.formError = e instanceof Error ? e.message : erplora().t(CATALOG, 'ui.deleteStationError');
    }
  }

  private renderEditPanel() {
    if (!this.editing) return nothing;
    const t = (k: string): string => erplora().t(CATALOG, k);
    return html`<section class="panel">
      <h3>${t('ui.editStationTitle')} · ${this.editing.name}</h3>
      <form class="form" @submit=${(e: Event) => this.saveEdit(e)}>
        <ion-input fill="outline" label=${t('ui.labelName')} label-placement="floating" .value=${this.editName} @ionInput=${(e: any) => (this.editName = e.target.value)}></ion-input>
        <ion-input fill="outline" label=${t('ui.labelColor')} label-placement="floating" placeholder="#F97316" .value=${this.editColor} @ionInput=${(e: any) => (this.editColor = e.target.value)}></ion-input>
        <ion-input fill="outline" label=${t('ui.labelPrinter')} label-placement="floating" .value=${this.editPrinter} @ionInput=${(e: any) => (this.editPrinter = e.target.value)}></ion-input>
        <ion-toggle .checked=${this.editActive} @ionChange=${(e: any) => (this.editActive = e.detail.checked)}>${t('ui.labelActive')}</ion-toggle>
        <ion-button type="submit" size="small" ?disabled=${this.saving}>${this.saving ? t('ui.saving') : t('ui.save')}</ion-button>
        <ion-button size="small" fill="outline" @click=${() => (this.editing = null)}>${t('ui.cancel')}</ion-button>
      </form>
    </section>`;
  }

  private renderRoutingPanel() {
    const t = (k: string): string => erplora().t(CATALOG, k);
    const stations = this.ctrl?.rows ?? [];
    return html`<section class="panel">
      <h3>${t('ui.routingTitle')}</h3>
      <form class="form" @submit=${(e: Event) => this.saveRouting(e)}>
        <ion-select fill="outline" label-placement="floating" label=${t('ui.colStation')} .value=${this.routeStationId} @ionChange=${(e: any) => (this.routeStationId = e.target.value)}>
          ${stations.map((s) => html`<ion-select-option value=${s.id}>${s.name}</ion-select-option>`)}
        </ion-select>
        <ion-input fill="outline" label=${t('ui.labelProductId')} label-placement="floating" placeholder=${t('ui.placeholderOptional')} .value=${this.routeProductId} @ionInput=${(e: any) => (this.routeProductId = e.target.value)}></ion-input>
        <ion-input fill="outline" label=${t('ui.labelCategoryId')} label-placement="floating" placeholder=${t('ui.placeholderOptional')} .value=${this.routeCategoryId} @ionInput=${(e: any) => (this.routeCategoryId = e.target.value)}></ion-input>
        <ion-button type="submit" size="small" ?disabled=${this.saving || !this.routeStationId || (!this.routeProductId.trim() && !this.routeCategoryId.trim())}>${this.saving ? t('ui.saving') : t('ui.saveRouting')}</ion-button>
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
        ${this.formMsg ? html`<p class="ok">${this.formMsg}</p>` : nothing}
        ${this.formError ? html`<ok-inline-feedback tone="danger" icon="alert-circle-outline">${this.formError}</ok-inline-feedback>` : nothing}
        ${this.ctrl?.error ? html`<ok-inline-feedback tone="danger" icon="alert-circle-outline">${this.ctrl.error}</ok-inline-feedback>` : nothing}
        <ok-data-table .serverSide=${true} .fill=${true} .addable=${true} .columns=${this.columns} .views=${true} .cardTitle=${(r: Record<string, unknown>) => String(r.name ?? '—')} .cardIcon=${() => 'flame-outline'} .rows=${this.ctrl?.rows ?? []} .total=${this.ctrl?.total ?? 0} .page=${this.ctrl?.state.page ?? 0} .pageSize=${this.ctrl?.state.pageSize ?? 50} .sort=${this.ctrl?.state.sort} .sortDir=${this.ctrl?.state.dir ?? 'asc'} .searchable=${true} .searchPlaceholder=${t('ui.searchStations')} .emptyMessage=${this.ctrl?.loading ? t('ui.loading') : t('ui.emptyStations')} .actions=${this.rowActions} @rowAction=${(e: CustomEvent<{ actionId: string; row: Record<string, unknown> }>) => this.onRowAction(e)} @pageChange=${(e: CustomEvent<number>) => this.ctrl.setPage(e.detail)} @pageSizeChange=${(e: CustomEvent<number>) => this.ctrl.setPageSize(e.detail)} @sortChange=${(e: CustomEvent<{ sort: string; dir: 'asc' | 'desc' }>) => this.ctrl.setSort(e.detail.sort, e.detail.dir)} @searchChange=${(e: CustomEvent<string>) => this.ctrl.setSearch(e.detail)} @filterChange=${(e: CustomEvent<{ col: string; value: unknown }>) => this.ctrl.setFilter(e.detail.col, e.detail.value)}>
          <!-- Alta de estación: se proyecta SIEMPRE (aunque el panel esté cerrado); si se renderizara
               solo con el panel abierto, el «+» de la barra abriría un panel vacío. -->
          <form slot="create" class="create-form" @submit=${(e: Event) => this.createStation(e)}>
            <ion-input fill="outline" label-placement="floating" label=${t('ui.labelName')} placeholder=${t('ui.placeholderStationName')} .value=${this.newName} @ionInput=${(e: any) => (this.newName = e.target.value)}></ion-input>
            <ion-input fill="outline" label-placement="floating" label=${t('ui.labelPrinter')} placeholder=${t('ui.placeholderPrinterOptional')} .value=${this.newPrinter} @ionInput=${(e: any) => (this.newPrinter = e.target.value)}></ion-input>
            <ion-button type="submit" ?disabled=${this.saving || !this.newName}>${this.saving ? t('ui.saving') : t('ui.addStation')}</ion-button>
          </form>
        </ok-data-table>
      </div>`;
  }
}

define('erp-kitchen-orders-stations', ErpKitchenOrdersStations);
