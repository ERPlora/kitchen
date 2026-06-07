import { LitElement, html, css, nothing } from 'lit';
import { state } from 'lit/decorators.js';
import { define } from '@erplora/outfitkit/define';
import '@erplora/outfitkit/ok-data-table';
import type { DataTableColumn } from '@erplora/outfitkit';
import { createListController } from '@erplora/module-sdk';
import type { ListController, ListClient, ListParams, ListPage } from '@erplora/module-sdk';

interface ErploraClientLike extends ListClient {
  query<T = unknown>(name: string, params?: Record<string, unknown>): Promise<T>;
  queryPage<R = unknown>(name: string, params: ListParams): Promise<ListPage<R>>;
  command<T = unknown>(name: string, payload?: Record<string, unknown>): Promise<T>;
  on(event: string, cb: (payload: unknown) => void): () => void;
}

interface KitchenLog {
  id: string;
  order_id: string;
  action: string;
  station_id: string | null;
  notes: string;
  created_at: string;
}

function erplora(): ErploraClientLike {
  const c = (globalThis as { erplora?: ErploraClientLike }).erplora;
  if (!c) throw new Error('erplora SDK no inicializado por el shell');
  return c;
}

export class ErpKitchenDisplay extends LitElement {
  static styles = css`
    :host { display:block; font-family: system-ui, sans-serif; color: var(--ion-text-color, #1c1b18); }
    header { display:flex; gap:.5rem; align-items:center; margin-bottom:.75rem; }
    h2 { margin:0; font-size:1.15rem; flex:1; }
    .err { color:#d9480f; font-weight:600; }
    .badge { display:inline-block; padding:.1rem .5rem; border-radius:999px; background:#eef6fb; color:#1496d6; font-size:.75rem; font-weight:600; }
  `;

  @state() tick = 0;

  private ctrl!: ListController<KitchenLog>;

  private unsub?: () => void;

  private columns: DataTableColumn[] = [
    {
      key: 'action',
      header: 'Acción',
      sortable: true,
      filterable: true,
      filterType: 'select',
      options: [
        { value: 'received', label: 'Recibidas' },
        { value: 'bumped', label: 'Listas (bump)' },
        { value: 'served', label: 'Servidas' },
        { value: 'recalled', label: 'Recuperadas' },
        { value: 'cancelled', label: 'Canceladas' },
      ],
    },
    { key: 'order_id', header: 'Orden', sortable: true, filterable: true, filterType: 'text' },
    { key: 'notes', header: 'Notas', sortable: true, filterable: true, filterType: 'text' },
    { key: 'created_at', header: 'Cuándo', sortable: true, filterable: true, filterType: 'daterange' },
  ];

  // TODO-LIT: componentWillLoad → connectedCallback. Recuerda: connectedCallback se dispara
  // en CADA reconexión al DOM (no solo en el primer montaje). Si la init debe correr una
  // sola vez tras el primer render, considera firstUpdated() en su lugar.
  async connectedCallback() {
    super.connectedCallback();
    this.ctrl = createListController<KitchenLog>(erplora(), 'kitchen.logs.list', () => this.requestUpdate(), {
      pageSize: 50,
      sort: 'created_at',
      dir: 'desc',
    });
    await this.ctrl.load();
    // Reactividad: cuando llega cualquier evento de ciclo de vida de órdenes del módulo
    // `orders`, el listener declarado en module.json crea un log → recargamos la lista.
    try {
      const offs = [
        erplora().on('kitchen_orders.order_fired', () => this.ctrl.load()),
        erplora().on('kitchen_orders.order_ready', () => this.ctrl.load()),
        erplora().on('kitchen_orders.order_served', () => this.ctrl.load()),
        erplora().on('kitchen_orders.order_cancelled', () => this.ctrl.load()),
      ];
      this.unsub = () => offs.forEach((off) => off());
    } catch {
      /* sin SDK (preview) → sin reactividad en vivo */
    }
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.unsub?.();
  }

  render() {
    return html`<div>
        <header>
          <h2>Kitchen Display</h2>
        </header>
        ${this.ctrl?.error ? html`<p class="err">${this.ctrl.error}</p>` : nothing}
        <ok-data-table .serverSide=${true} .columns=${this.columns} .rows=${this.ctrl?.rows ?? []} .total=${this.ctrl?.total ?? 0} .page=${this.ctrl?.state.page ?? 0} .pageSize=${this.ctrl?.state.pageSize ?? 50} .sort=${this.ctrl?.state.sort} .sortDir=${this.ctrl?.state.dir ?? 'desc'} .searchable=${true} .searchPlaceholder=${"Buscar acción, orden o notas…"} .emptyMessage=${this.ctrl?.loading ? 'Cargando…' : 'Sin actividad reciente en cocina.'} @pageChange=${(e: CustomEvent<number>) => this.ctrl.setPage(e.detail)} @sortChange=${(e: CustomEvent<{ sort: string; dir: 'asc' | 'desc' }>) => this.ctrl.setSort(e.detail.sort, e.detail.dir)} @searchChange=${(e: CustomEvent<string>) => this.ctrl.setSearch(e.detail)} @filterChange=${(e: CustomEvent<{ col: string; value: unknown }>) => this.ctrl.setFilter(e.detail.col, e.detail.value)}></ok-data-table>
      </div>`;
  }
}

define('erp-kitchen-display', ErpKitchenDisplay);
