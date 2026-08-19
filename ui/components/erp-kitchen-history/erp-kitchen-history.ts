import { LitElement, html, css, nothing } from 'lit';
import { define } from '@erplora/outfitkit/define';
import '@erplora/outfitkit/ok-inline-feedback';
import '@erplora/outfitkit/ok-data-table';
import type { DataTableColumn } from '@erplora/outfitkit';
import { createListController } from '@erplora/module-sdk';
import type { ListController, ListClient, ListParams, ListPage } from '@erplora/module-sdk';
// Module i18n catalog (ADR-0055): esbuild inlines these JSON into the WC `dist`.
import esLocale from '../../../locales/es.json';
import enLocale from '../../../locales/en.json';
const CATALOG: Record<string, unknown> = { es: esLocale, en: enLocale };

interface ErploraClientLike extends ListClient {
  query<T = unknown>(name: string, params?: Record<string, unknown>): Promise<T>;
  queryPage<R = unknown>(name: string, params: ListParams): Promise<ListPage<R>>;
  on(event: string, cb: (payload: unknown) => void): () => void;
  locale: string;
  t(catalog: Record<string, unknown>, key: string, params?: Record<string, unknown>): string;
}

interface KitchenLog {
  id: string;
  order_id: string;
  order_item_id: string | null;
  action: string;
  station_id: string | null;
  notes: string;
  created_at: string;
}

function erplora(): ErploraClientLike {
  const c = (globalThis as { erplora?: ErploraClientLike }).erplora;
  if (!c) throw new Error('erplora SDK not initialised by the shell');
  return c;
}

/** The kitchen audit trail (`kitchen_order_log`), moved out of «Display» when that entry became
 *  the KDS proper (kitchen#4). Settings live in the shell's generic module settings (ADR-0082). */
export class ErpKitchenHistory extends LitElement {
  static styles = css`
    :host { display:block; font-family: system-ui, sans-serif; color: var(--ion-text-color, #1c1b18); }
    header { display:flex; gap:.5rem; align-items:center; margin-bottom:.75rem; }
    h2 { margin:0; font-size:1.15rem; flex:1; }
  `;

  private ctrl!: ListController<KitchenLog>;

  private unsub?: () => void;

  private get columns(): DataTableColumn[] {
    const t = (k: string): string => erplora().t(CATALOG, k);
    return [
      {
        key: 'action',
        header: t('ui.colAction'),
        sortable: true,
        filterable: true,
        filterType: 'select',
        options: [
          { value: 'received', label: t('ui.actionReceived') },
          { value: 'started', label: t('ui.actionStarted') },
          { value: 'bumped', label: t('ui.actionBumped') },
          { value: 'item_bumped', label: t('ui.actionItemBumped') },
          { value: 'item_recalled', label: t('ui.actionItemRecalled') },
          { value: 'served', label: t('ui.actionServed') },
          { value: 'recalled', label: t('ui.actionRecalled') },
          { value: 'cancelled', label: t('ui.actionCancelled') },
        ],
      },
      { key: 'order_id', header: t('ui.colOrder'), sortable: true, filterable: true, filterType: 'text' },
      { key: 'notes', header: t('ui.colNotes'), sortable: true, filterable: true, filterType: 'text' },
      { key: 'created_at', header: t('ui.colWhen'), sortable: true, filterable: true, filterType: 'daterange' },
    ];
  }

  private readonly onLocaleChange = (): void => this.requestUpdate();

  async connectedCallback() {
    super.connectedCallback();
    window.addEventListener('erplora:locale-changed', this.onLocaleChange);
    this.ctrl = createListController<KitchenLog>(erplora(), 'kitchen.logs.list', () => this.requestUpdate(), {
      pageSize: 50,
      sort: 'created_at',
      dir: 'desc',
    });
    await this.ctrl.load();
    // Every kitchen.order.* / kitchen.item.* transition writes a log row through the listeners
    // declared in module.json → reload the list when one arrives.
    try {
      const reload = () => this.ctrl.load();
      const offs = [
        erplora().on('kitchen.order.created', reload),
        erplora().on('kitchen.order.fired', reload),
        erplora().on('kitchen.order.ready', reload),
        erplora().on('kitchen.order.served', reload),
        erplora().on('kitchen.order.recalled', reload),
        erplora().on('kitchen.order.cancelled', reload),
        erplora().on('kitchen.item.bumped', reload),
        erplora().on('kitchen.item.recalled', reload),
      ];
      this.unsub = () => offs.forEach((off) => off());
    } catch {
      /* no SDK (preview) → no live reactivity */
    }
  }

  disconnectedCallback() {
    window.removeEventListener('erplora:locale-changed', this.onLocaleChange);
    super.disconnectedCallback();
    this.unsub?.();
  }

  render() {
    const t = (k: string): string => erplora().t(CATALOG, k);
    return html`<div>
        <header><h2>${t('ui.historyTitle')}</h2></header>
        ${this.ctrl?.error ? html`<ok-inline-feedback tone="danger" icon="alert-circle-outline">${this.ctrl.error}</ok-inline-feedback>` : nothing}
        <ok-data-table .serverSide=${true} .columns=${this.columns} .views=${true} .cardTitle=${(r: Record<string, unknown>) => `#${String(r.order_id ?? '—')}`} .cardIcon=${() => 'restaurant-outline'} .rows=${this.ctrl?.rows ?? []} .total=${this.ctrl?.total ?? 0} .page=${this.ctrl?.state.page ?? 0} .pageSize=${this.ctrl?.state.pageSize ?? 50} .sort=${this.ctrl?.state.sort} .sortDir=${this.ctrl?.state.dir ?? 'desc'} .searchable=${true} .searchPlaceholder=${t('ui.searchLogs')} .emptyMessage=${this.ctrl?.loading ? t('ui.loading') : t('ui.emptyLogs')} @pageChange=${(e: CustomEvent<number>) => this.ctrl.setPage(e.detail)} @sortChange=${(e: CustomEvent<{ sort: string; dir: 'asc' | 'desc' }>) => this.ctrl.setSort(e.detail.sort, e.detail.dir)} @searchChange=${(e: CustomEvent<string>) => this.ctrl.setSearch(e.detail)} @filterChange=${(e: CustomEvent<{ col: string; value: unknown }>) => this.ctrl.setFilter(e.detail.col, e.detail.value)}></ok-data-table>
      </div>`;
  }
}

define('erp-kitchen-history', ErpKitchenHistory);
