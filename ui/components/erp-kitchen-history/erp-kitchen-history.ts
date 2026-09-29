import { LitElement, html, css, nothing } from 'lit';
import { define } from '@erplora/outfitkit/define';
import '@erplora/outfitkit/ok-inline-feedback';
import '@erplora/outfitkit/ok-data-table';
import type { DataTableColumn } from '@erplora/outfitkit';
import { createListController, dataTableShowsLoadError } from '@erplora/module-sdk';
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
  /** The ticket's human number (`20260821-0001`), resolved by `kitchen.logs.list` (kitchen#44). */
  order_number: string | null;
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

/** ONE map of action → label key, used by BOTH the filter dropdown and the cell (kitchen#44):
 *  two maps that start identical drift apart, and the cell is where the drift shows. */
const ACTION_LABEL_KEY: Record<string, string> = {
  received: 'ui.actionReceived',
  started: 'ui.actionStarted',
  bumped: 'ui.actionBumped',
  item_bumped: 'ui.actionItemBumped',
  item_recalled: 'ui.actionItemRecalled',
  served: 'ui.actionServed',
  recalled: 'ui.actionRecalled',
  cancelled: 'ui.actionCancelled',
};

/** The action label in the hub's language — or the raw code when it has no label (an API-only
 *  value such as `accepted`): a hole one can SEE is a hole one can report, a blank cell is not. */
function actionLabel(code: string): string {
  const key = ACTION_LABEL_KEY[code];
  return key ? erplora().t(CATALOG, key) : code;
}

/** Local date and time, no fractions of a second (kitchen#44). The runtime hands the instant back
 *  as ISO text with nanosecond precision and UTC offset — the storage format, not something a
 *  person reads at a pass. Same Intl pattern as the rest of the hub (tickets, customers). An
 *  unparseable value stays as-is: "Invalid Date" is less informative than the raw text. */
function formatWhen(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat(erplora().locale === 'en' ? 'en-GB' : 'es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
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
        // The same map the cell renders with — one source, not two (kitchen#44).
        options: Object.entries(ACTION_LABEL_KEY).map(([value, labelKey]) => ({ value, label: t(labelKey) })),
        format: (r) => actionLabel(String(r.action ?? '')),
      },
      // kitchen#44: the ticket NUMBER the KDS shows — the whole point of the trail is matching an
      // action with the ticket in front of you, and nobody matches a UUID by eye. The id stays as
      // the fallback of last resort (a row never blanks), and the box filters what it shows.
      {
        key: 'order_number',
        header: t('ui.colOrder'),
        // kitchen#134: the same floor as «Comandas» — the default 5.5rem cut the number in the list view.
        width: 'minmax(8rem,1fr)',
        sortable: true,
        filterable: true,
        filterType: 'text',
        format: (r) => String(r.order_number || r.order_id || '—'),
      },
      { key: 'notes', header: t('ui.colNotes'), sortable: true, filterable: true, filterType: 'text' },
      {
        key: 'created_at',
        header: t('ui.colWhen'),
        sortable: true,
        filterable: true,
        filterType: 'daterange',
        format: (r) => formatWhen(String(r.created_at ?? '')),
      },
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
        erplora().on('kitchen.order.received', reload),
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
        ${this.ctrl?.error && !dataTableShowsLoadError() ? html`<ok-inline-feedback data-testid="kitchen-history-load-error" tone="danger" icon="alert-circle-outline">${this.ctrl.error}</ok-inline-feedback>` : nothing}
        <ok-data-table testid="kitchen-history-table" .error=${this.ctrl?.error ?? ''} @retry=${() => this.ctrl?.load()} .serverSide=${true} .columns=${this.columns} .views=${true} .cardTitle=${(r: Record<string, unknown>) => String(r.order_number || r.order_id || '—')} .cardIcon=${() => 'restaurant-outline'} .rows=${this.ctrl?.rows ?? []} .total=${this.ctrl?.total ?? 0} .page=${this.ctrl?.state.page ?? 0} .pageSize=${this.ctrl?.state.pageSize ?? 50} .sort=${this.ctrl?.state.sort} .sortDir=${this.ctrl?.state.dir ?? 'desc'} .searchable=${true} .searchPlaceholder=${t('ui.searchLogs')} .emptyMessage=${this.ctrl?.loading ? t('ui.loading') : t('ui.emptyLogs')} @pageChange=${(e: CustomEvent<number>) => this.ctrl.setPage(e.detail)} @sortChange=${(e: CustomEvent<{ sort: string; dir: 'asc' | 'desc' }>) => this.ctrl.setSort(e.detail.sort, e.detail.dir)} @searchChange=${(e: CustomEvent<string>) => this.ctrl.setSearch(e.detail)} @filterChange=${(e: CustomEvent<{ col: string; value: unknown }>) => this.ctrl.setFilter(e.detail.col, e.detail.value)}></ok-data-table>
      </div>`;
  }
}

define('erp-kitchen-history', ErpKitchenHistory);
