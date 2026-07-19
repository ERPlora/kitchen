import { LitElement, html, css, nothing } from 'lit';
import { state } from 'lit/decorators.js';
import { define } from '@erplora/outfitkit/define';
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
  /** Formateo de dinero (ADR-0059): recibe CÉNTIMOS y divide. El dinero viaja como
   *  INTEGER de céntimos (ADR-0007/0123) → SIEMPRE `formatMoney`, nunca ÷100 a mano. */
  formatMoney(cents: number, opts?: { currency?: string; locale?: string }): string;
}

interface Order {
  id: string;
  order_number: string;
  status: string;
  order_type: string;
  label: string;
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
    :host { display:block; font-family: system-ui, sans-serif; color: var(--ion-text-color, #1c1b18); }
    header { display:flex; gap:.5rem; align-items:center; margin-bottom:.75rem; }
    h2 { margin:0; font-size:1.15rem; flex:1; }
    .form { display:flex; gap:.75rem; flex-wrap:wrap; align-items:end; margin:.5rem 0 1rem; }
    .form ion-input, .form ion-select { flex:1 1 11rem; min-width:9rem; }
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

  // Getters (no campos): se re-evalúan en cada render → los textos cambian con el idioma activo (ADR-0055).
  private get columns(): DataTableColumn[] {
    const t = (k: string): string => erplora().t(CATALOG, k);
    return [
    { key: 'order_number', header: t('ui.colOrder'), sortable: true, filterable: true, filterType: 'text' },
    // ADR-0141: a dónde va el plato. Es una ETIQUETA OPACA que manda quien dispara ("Mesa 4",
    // "Barra", "Recogida Ana"): cocina la imprime tal cual y no depende de `tables`.
    { key: 'label', header: t('ui.colLabel'), width: '140px', sortable: true, filterable: true, filterType: 'text' },
    { key: 'order_type', header: t('ui.colType'), sortable: true, filterable: true, filterType: 'text' },
    { key: 'priority', header: t('ui.colPriority'), sortable: true, filterable: true, filterType: 'text' },
    {
      key: 'status',
      header: t('ui.colStatus'),
      sortable: true,
      filterable: true,
      filterType: 'select',
      options: [
        { value: 'pending', label: t('ui.statusPending') },
        { value: 'preparing', label: t('ui.statusPreparing') },
        { value: 'ready', label: t('ui.statusReady') },
        { value: 'served', label: t('ui.statusServed') },
        { value: 'cancelled', label: t('ui.statusCancelled') },
      ],
    },
    {
      key: 'total',
      header: t('ui.colTotal'),
      align: 'right',
      sortable: true,
      filterable: true,
      filterType: 'range',
      // El total llega en CÉNTIMOS → `formatMoney` (divide). Antes hacía `toFixed(2)` sobre
      // los céntimos crudos y una comanda de 6,00 € se pintaba «600.00» (incidencia 5).
      format: (r) => erplora().formatMoney(Number(r.total || 0)),
    },
    ];
  }

  private get rowActions(): DataTableAction[] {
    const t = (k: string): string => erplora().t(CATALOG, k);
    return [
    // Solo icono (ADR-0133): el `label` viaja como title + aria-label del botón, no como texto.
    { id: 'fire', label: t('ui.rowFire'), icon: 'flame-outline' },
    { id: 'mark_ready', label: t('ui.rowMarkReady'), icon: 'checkmark-done-outline' },
    { id: 'mark_served', label: t('ui.rowMarkServed'), icon: 'restaurant-outline' },
    { id: 'recall', label: t('ui.rowRecall'), icon: 'arrow-undo-outline' },
    { id: 'cancel', label: t('ui.rowCancel'), icon: 'close-circle-outline', color: 'danger' },
    ];
  }

  private readonly onLocaleChange = (): void => this.requestUpdate();

  async connectedCallback() {
    super.connectedCallback();
    window.addEventListener('erplora:locale-changed', this.onLocaleChange);
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
    window.removeEventListener('erplora:locale-changed', this.onLocaleChange);
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
      this.formError = e instanceof Error ? e.message : erplora().t(CATALOG, 'ui.createOrderError');
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
      this.formError = e instanceof Error ? e.message : erplora().t(CATALOG, 'ui.updateStatusError');
    }
  }

  render() {
    const t = (k: string): string => erplora().t(CATALOG, k);
    return html`<div>
        <header>
          <h2>${t('ui.ordersTitle')}</h2>
        </header>
        <form class="form" @submit=${(e) => this.createOrder(e)}>
          <ion-select fill="outline" label-placement="floating" label=${t('ui.colType')} .value=${this.newType} @ionChange=${(e: any) => (this.newType = e.target.value)}>
            <ion-select-option value="dine_in">${t('ui.orderTypeDineIn')}</ion-select-option>
            <ion-select-option value="takeaway">${t('ui.orderTypeTakeaway')}</ion-select-option>
            <ion-select-option value="delivery">${t('ui.orderTypeDelivery')}</ion-select-option>
          </ion-select>
          <ion-input fill="outline" label-placement="floating" label=${t('ui.colNotes')} .value=${this.newNotes} @ionInput=${(e: any) => (this.newNotes = e.target.value)}></ion-input>
          <ion-button type="submit" size="small" ?disabled=${this.saving}>${this.saving ? t('ui.creatingOrder') : t('ui.newOrder')}</ion-button>
        </form>
        ${this.formError ? html`<p class="err">${this.formError}</p>` : nothing}
        ${this.ctrl?.error ? html`<p class="err">${this.ctrl.error}</p>` : nothing}
        <ok-data-table .serverSide=${true} .columns=${this.columns} .views=${true} .cardTitle=${(r: Record<string, unknown>) => String(r.order_number ?? '—')} .cardIcon=${() => 'restaurant-outline'} .rows=${this.ctrl?.rows ?? []} .total=${this.ctrl?.total ?? 0} .page=${this.ctrl?.state.page ?? 0} .pageSize=${this.ctrl?.state.pageSize ?? 50} .sort=${this.ctrl?.state.sort} .sortDir=${this.ctrl?.state.dir ?? 'desc'} .searchable=${true} .searchPlaceholder=${t('ui.searchOrders')} .emptyMessage=${this.ctrl?.loading ? t('ui.loading') : t('ui.emptyOrders')} .actions=${this.rowActions} @rowAction=${(e: CustomEvent<{ actionId: string; row: Record<string, unknown> }>) => this.onRowAction(e)} @pageChange=${(e: CustomEvent<number>) => this.ctrl.setPage(e.detail)} @sortChange=${(e: CustomEvent<{ sort: string; dir: 'asc' | 'desc' }>) => this.ctrl.setSort(e.detail.sort, e.detail.dir)} @searchChange=${(e: CustomEvent<string>) => this.ctrl.setSearch(e.detail)} @filterChange=${(e: CustomEvent<{ col: string; value: unknown }>) => this.ctrl.setFilter(e.detail.col, e.detail.value)}></ok-data-table>
      </div>`;
  }
}

define('erp-kitchen-orders-active', ErpKitchenOrdersActive);
