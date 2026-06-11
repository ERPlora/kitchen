import { LitElement, html, css, nothing } from 'lit';
import { state } from 'lit/decorators.js';
import { define } from '@erplora/outfitkit/define';
import '@erplora/outfitkit/ok-data-table';
import type { DataTableColumn, DataTableAction } from '@erplora/outfitkit';
import { createListController } from '@erplora/module-sdk';
import type { ListController, ListClient, ListParams, ListPage } from '@erplora/module-sdk';

interface ErploraClientLike extends ListClient {
  query<T = unknown>(name: string, params?: Record<string, unknown>): Promise<T>;
  queryPage<R = unknown>(name: string, params: ListParams): Promise<ListPage<R>>;
  command<T = unknown>(name: string, payload?: Record<string, unknown>): Promise<T>;
  on(event: string, cb: (payload: unknown) => void): () => void;
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
    :host { display:block; font-family: system-ui, sans-serif; color: var(--ink, #1c1b18); }
    header { display:flex; gap:.5rem; align-items:center; margin-bottom:.75rem; }
    h2 { margin:0; font-size:1.15rem; flex:1; }
    h3 { margin:.25rem 0 .5rem; font-size:1rem; }
    .form { display:flex; gap:.5rem; flex-wrap:wrap; align-items:end; margin:.5rem 0 1rem; }
    .form ion-input, .form ion-select { --background:var(--surface-2,#f7f4ec); border:1px solid var(--line,#e7e2d6); border-radius:8px; min-width:8rem; }
    .panel { border:1px solid var(--line,#e7e2d6); border-radius:10px; padding:.75rem 1rem; margin:0 0 1rem; background:var(--surface-2,#faf8f2); }
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

  private columns: DataTableColumn[] = [
    { key: 'name', header: 'Estación', sortable: true, filterable: true, filterType: 'text' },
    {
      key: 'printer_name',
      header: 'Impresora',
      sortable: true,
      filterable: true,
      filterType: 'text',
      format: (r) => (r.printer_name as string) || '—',
    },
    { key: 'pending_count', header: 'En curso', align: 'right', format: (r) => String(this.pendingCounts.get(String(r.id)) ?? 0) },
    {
      key: 'is_active',
      header: 'Activa',
      sortable: true,
      filterable: true,
      filterType: 'select',
      options: [
        { value: '1', label: 'Sí' },
        { value: '0', label: 'No' },
      ],
      format: (r) => (Number(r.is_active) ? 'Sí' : 'No'),
    },
  ];

  private rowActions: DataTableAction[] = [
    { id: 'edit', label: 'Editar' },
    { id: 'route', label: 'Enrutar' },
    { id: 'delete', label: 'Eliminar', color: 'danger' },
  ];

  async connectedCallback() {
    super.connectedCallback();
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
      await this.reload();
    } catch (e) {
      this.formError = e instanceof Error ? e.message : 'No se pudo crear la estación';
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
      this.formMsg = 'Estación actualizada';
      this.editing = null;
      await this.reload();
    } catch (e) {
      this.formError = e instanceof Error ? e.message : 'No se pudo actualizar la estación';
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
      this.formMsg = 'Enrutado guardado';
      this.routeProductId = '';
      this.routeCategoryId = '';
      await this.reload();
    } catch (e) {
      this.formError = e instanceof Error ? e.message : 'No se pudo guardar el enrutado';
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
      this.formError = e instanceof Error ? e.message : 'No se pudo eliminar la estación';
    }
  }

  private renderEditPanel() {
    if (!this.editing) return nothing;
    return html`<section class="panel">
      <h3>Editar estación · ${this.editing.name}</h3>
      <form class="form" @submit=${(e: Event) => this.saveEdit(e)}>
        <ion-input label="Nombre" label-placement="stacked" .value=${this.editName} @ionInput=${(e: any) => (this.editName = e.target.value)}></ion-input>
        <ion-input label="Color" label-placement="stacked" placeholder="#F97316" .value=${this.editColor} @ionInput=${(e: any) => (this.editColor = e.target.value)}></ion-input>
        <ion-input label="Impresora" label-placement="stacked" .value=${this.editPrinter} @ionInput=${(e: any) => (this.editPrinter = e.target.value)}></ion-input>
        <ion-toggle .checked=${this.editActive} @ionChange=${(e: any) => (this.editActive = e.detail.checked)}>Activa</ion-toggle>
        <ion-button type="submit" size="small" ?disabled=${this.saving}>${this.saving ? 'Guardando…' : 'Guardar'}</ion-button>
        <ion-button size="small" fill="outline" @click=${() => (this.editing = null)}>Cancelar</ion-button>
      </form>
    </section>`;
  }

  private renderRoutingPanel() {
    const stations = this.ctrl?.rows ?? [];
    return html`<section class="panel">
      <h3>Enrutado producto/categoría → estación</h3>
      <form class="form" @submit=${(e: Event) => this.saveRouting(e)}>
        <ion-select placeholder="Estación" .value=${this.routeStationId} @ionChange=${(e: any) => (this.routeStationId = e.target.value)}>
          ${stations.map((s) => html`<ion-select-option value=${s.id}>${s.name}</ion-select-option>`)}
        </ion-select>
        <ion-input label="ID de producto" label-placement="stacked" placeholder="(opcional)" .value=${this.routeProductId} @ionInput=${(e: any) => (this.routeProductId = e.target.value)}></ion-input>
        <ion-input label="ID de categoría" label-placement="stacked" placeholder="(opcional)" .value=${this.routeCategoryId} @ionInput=${(e: any) => (this.routeCategoryId = e.target.value)}></ion-input>
        <ion-button type="submit" size="small" ?disabled=${this.saving || !this.routeStationId || (!this.routeProductId.trim() && !this.routeCategoryId.trim())}>${this.saving ? 'Guardando…' : 'Guardar enrutado'}</ion-button>
      </form>
    </section>`;
  }

  render() {
    return html`<div>
        <header>
          <h2>Estaciones de producción</h2>
        </header>
        <form class="form" @submit=${(e) => this.createStation(e)}>
          <ion-input placeholder="Nombre (Plancha)" .value=${this.newName} @ionInput=${(e: any) => (this.newName = e.target.value)}></ion-input>
          <ion-input placeholder="Impresora (opcional)" .value=${this.newPrinter} @ionInput=${(e: any) => (this.newPrinter = e.target.value)}></ion-input>
          <ion-button type="submit" size="small" ?disabled=${this.saving || !this.newName}>${this.saving ? 'Guardando…' : 'Añadir'}</ion-button>
        </form>
        ${this.renderEditPanel()}
        ${this.renderRoutingPanel()}
        ${this.formMsg ? html`<p class="ok">${this.formMsg}</p>` : nothing}
        ${this.formError ? html`<p class="err">${this.formError}</p>` : nothing}
        ${this.ctrl?.error ? html`<p class="err">${this.ctrl.error}</p>` : nothing}
        <ok-data-table .serverSide=${true} .columns=${this.columns} .rows=${this.ctrl?.rows ?? []} .total=${this.ctrl?.total ?? 0} .page=${this.ctrl?.state.page ?? 0} .pageSize=${this.ctrl?.state.pageSize ?? 50} .sort=${this.ctrl?.state.sort} .sortDir=${this.ctrl?.state.dir ?? 'asc'} .searchable=${true} .searchPlaceholder=${"Buscar estación…"} .emptyMessage=${this.ctrl?.loading ? 'Cargando…' : 'Sin estaciones.'} .actions=${this.rowActions} @rowAction=${(e: CustomEvent<{ actionId: string; row: Record<string, unknown> }>) => this.onRowAction(e)} @pageChange=${(e: CustomEvent<number>) => this.ctrl.setPage(e.detail)} @sortChange=${(e: CustomEvent<{ sort: string; dir: 'asc' | 'desc' }>) => this.ctrl.setSort(e.detail.sort, e.detail.dir)} @searchChange=${(e: CustomEvent<string>) => this.ctrl.setSearch(e.detail)} @filterChange=${(e: CustomEvent<{ col: string; value: unknown }>) => this.ctrl.setFilter(e.detail.col, e.detail.value)}></ok-data-table>
      </div>`;
  }
}

define('erp-kitchen-orders-stations', ErpKitchenOrdersStations);
