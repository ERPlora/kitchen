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

interface Order {
  id: string;
  order_number: string;
  status: string;
  order_type: string;
  priority: string;
  total: string;
  notes: string;
  created_at: string;
}

function erplora(): ErploraClientLike {
  const c = (globalThis as { erplora?: ErploraClientLike }).erplora;
  if (!c) throw new Error('erplora SDK no inicializado por el shell');
  return c;
}

export class ErpKitchenOrdersActive extends LitElement {
  static styles = css`
    :host { display:block; font-family: system-ui, sans-serif; color: var(--ink, #1c1b18); }
    header { display:flex; gap:.5rem; align-items:center; margin-bottom:.75rem; }
    h2 { margin:0; font-size:1.15rem; flex:1; }
    .form { display:flex; gap:.5rem; flex-wrap:wrap; align-items:end; margin:.5rem 0 1rem; }
    .form ion-input, .form ion-select { --background:var(--surface-2,#f7f4ec); border:1px solid var(--line,#e7e2d6); border-radius:8px; min-width:8rem; }
    .err { color:#d9480f; font-weight:600; }
    .actions { display:flex; gap:.35rem; }
  `;

  @state() formError = '';

  @state() newType = 'dine_in';

  @state() newNotes = '';

  @state() saving = false;

  @state() tick = 0;

  private ctrl!: ListController<Order>;

  private unsub?: () => void;

  private columns: DataTableColumn[] = [
    { key: 'order_number', header: 'Comanda', sortable: true, filterable: true, filterType: 'text' },
    { key: 'order_type', header: 'Tipo', sortable: true, filterable: true, filterType: 'text' },
    { key: 'priority', header: 'Prioridad', sortable: true, filterable: true, filterType: 'text' },
    {
      key: 'status',
      header: 'Estado',
      sortable: true,
      filterable: true,
      filterType: 'select',
      options: [
        { value: 'pending', label: 'Pendiente' },
        { value: 'preparing', label: 'En preparación' },
        { value: 'ready', label: 'Lista' },
        { value: 'served', label: 'Servida' },
        { value: 'cancelled', label: 'Cancelada' },
      ],
    },
    {
      key: 'total',
      header: 'Total',
      align: 'right',
      sortable: true,
      filterable: true,
      filterType: 'range',
      format: (r) => Number(r.total).toFixed(2),
    },
  ];

  private rowActions: DataTableAction[] = [
    { id: 'fire', label: 'Lanzar' },
    { id: 'mark_ready', label: 'Lista' },
    { id: 'mark_served', label: 'Servida' },
    { id: 'recall', label: 'Recuperar' },
    { id: 'cancel', label: 'Cancelar', color: 'danger' },
  ];

  async connectedCallback() {
    super.connectedCallback();
    this.ctrl = createListController<Order>(erplora(), 'kitchen.orders.list', () => this.requestUpdate(), {
      pageSize: 50,
      sort: 'created_at',
      dir: 'desc',
    });
    await this.ctrl.load();
    try {
      const offs = [
        erplora().on('kitchen.order.created', () => this.ctrl.load()),
        erplora().on('kitchen.order.updated', () => this.ctrl.load()),
        erplora().on('kitchen.order.fired', () => this.ctrl.load()),
        erplora().on('kitchen.order.ready', () => this.ctrl.load()),
        erplora().on('kitchen.order.served', () => this.ctrl.load()),
        erplora().on('kitchen.order.recalled', () => this.ctrl.load()),
        erplora().on('kitchen.order.cancelled', () => this.ctrl.load()),
        erplora().on('kitchen.order.deleted', () => this.ctrl.load()),
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

  private async createOrder(ev: Event) {
    ev.preventDefault();
    this.saving = true;
    this.formError = '';
    try {
      await erplora().command('kitchen.orders.create', {
        order_type: this.newType,
        priority: 'normal',
        notes: this.newNotes.trim(),
        items: [],
      });
      this.newNotes = '';
      await this.ctrl.load();
    } catch (e) {
      this.formError = e instanceof Error ? e.message : 'No se pudo crear la comanda';
    } finally {
      this.saving = false;
    }
  }

  private async onRowAction(ev: CustomEvent<{ actionId: string; row: Record<string, unknown> }>) {
    const { actionId, row } = ev.detail;
    this.formError = '';
    try {
      await erplora().command('kitchen.orders.set_status', {
        order_id: (row as unknown as Order).id,
        action_name: actionId,
      });
      await this.ctrl.load();
    } catch (e) {
      this.formError = e instanceof Error ? e.message : 'No se pudo actualizar el estado';
    }
  }

  render() {
    return html`<div>
        <header>
          <h2>Comandas</h2>
        </header>
        <form class="form" @submit=${(e) => this.createOrder(e)}>
          <ion-select placeholder="Tipo" .value=${this.newType} @ionChange=${(e: any) => (this.newType = e.target.value)}>
            <ion-select-option value="dine_in">En sala</ion-select-option>
            <ion-select-option value="takeaway">Para llevar</ion-select-option>
            <ion-select-option value="delivery">A domicilio</ion-select-option>
          </ion-select>
          <ion-input placeholder="Notas" .value=${this.newNotes} @ionInput=${(e: any) => (this.newNotes = e.target.value)}></ion-input>
          <ion-button type="submit" size="small" ?disabled=${this.saving}>${this.saving ? 'Creando…' : 'Nueva comanda'}</ion-button>
        </form>
        ${this.formError ? html`<p class="err">${this.formError}</p>` : nothing}
        ${this.ctrl?.error ? html`<p class="err">${this.ctrl.error}</p>` : nothing}
        <ok-data-table .serverSide=${true} .columns=${this.columns} .rows=${this.ctrl?.rows ?? []} .total=${this.ctrl?.total ?? 0} .page=${this.ctrl?.state.page ?? 0} .pageSize=${this.ctrl?.state.pageSize ?? 50} .sort=${this.ctrl?.state.sort} .sortDir=${this.ctrl?.state.dir ?? 'desc'} .searchable=${true} .searchPlaceholder=${"Buscar comanda o estado…"} .emptyMessage=${this.ctrl?.loading ? 'Cargando…' : 'Sin comandas.'} .actions=${this.rowActions} @rowAction=${(e: CustomEvent<{ actionId: string; row: Record<string, unknown> }>) => this.onRowAction(e)} @pageChange=${(e: CustomEvent<number>) => this.ctrl.setPage(e.detail)} @sortChange=${(e: CustomEvent<{ sort: string; dir: 'asc' | 'desc' }>) => this.ctrl.setSort(e.detail.sort, e.detail.dir)} @searchChange=${(e: CustomEvent<string>) => this.ctrl.setSearch(e.detail)} @filterChange=${(e: CustomEvent<{ col: string; value: unknown }>) => this.ctrl.setFilter(e.detail.col, e.detail.value)}></ok-data-table>
      </div>`;
  }
}

define('erp-kitchen-orders-active', ErpKitchenOrdersActive);
