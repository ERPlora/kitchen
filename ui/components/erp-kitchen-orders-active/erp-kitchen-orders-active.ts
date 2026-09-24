import { LitElement, html, css, nothing } from 'lit';
import { state } from 'lit/decorators.js';
import { define } from '@erplora/outfitkit/define';
import '@erplora/outfitkit/ok-inline-feedback';
import '@erplora/outfitkit/ok-data-table';
import type { DataTableColumn, DataTableAction } from '@erplora/outfitkit';
import { createListController } from '@erplora/module-sdk';
import type { ListController, ListClient, ListParams, ListPage } from '@erplora/module-sdk';
// One catalogue for the module's closed domains: the CELL, the column FILTER and the new-order
// picker all read from it, so they cannot say different things about the same value (kitchen#39).
import { ORDER_TYPE_KEY, PRIORITY_KEY, enumLabel, enumOptions } from '../../lib/enums';
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
  /** Permission check of the SDK. Absent on old shells → everything is offered; the runtime gates. */
  hasPermission?(permission: string): boolean;
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

function can(permission: string): boolean {
  const client = erplora();
  return typeof client.hasPermission === 'function' ? client.hasPermission(permission) : true;
}

/** The `DEFAULT` of `kitchen_settings.default_order_type`, and of `schemas/settings_update.json`. */
const DEFAULT_ORDER_TYPE = 'dine_in';

/**
 * The configured default order type (kitchen#48) — the value the new-order picker opens on.
 *
 * Falls back to `dine_in` on every unhappy path (no singleton row, no `kitchen.view_settings`,
 * a value this module's catalogue does not know): the picker feeds a `required` field of
 * `kitchen.orders.create`, so leaving it blank or trusting an unknown value would turn a
 * misconfiguration into an order nobody can send.
 */
export function resolveDefaultOrderType(row: unknown): string {
  const value = (row as Record<string, unknown> | null | undefined)?.default_order_type;
  const text = typeof value === 'string' ? value : '';
  return text in ORDER_TYPE_KEY ? text : DEFAULT_ORDER_TYPE;
}

/** One permission per verb (kitchen#5); the command that owns each verb is called by literal below. */
type Verb = 'fire' | 'mark_ready' | 'mark_served' | 'recall' | 'cancel';
const VERB_PERMISSION: Record<Verb, string> = {
  fire: 'kitchen.change_order',
  mark_ready: 'kitchen.change_order',
  mark_served: 'kitchen.complete_order',
  recall: 'kitchen.change_order',
  cancel: 'kitchen.cancel_order',
};

/** The transition matrix (kitchen#11) — mirror of `allowed_from` in the handler, which is the
 *  authority. Here it only decides which buttons are live for a row. */
const ALLOWED_FROM: Record<Verb, readonly string[]> = {
  fire: ['pending'],
  mark_ready: ['pending', 'preparing'],
  mark_served: ['ready'],
  recall: ['ready'],
  cancel: ['pending', 'preparing', 'ready'],
};

/** Business codes (`kitchen.*`) translate through the module catalog `errors`; anything else keeps
 *  the server message. The catalog keys carry dots, so this reads it directly instead of `t()`. */
function errorText(e: unknown, fallbackKey: string): string {
  const code = (e as { code?: unknown } | null)?.code;
  if (typeof code === 'string') {
    const lang = (CATALOG[erplora().locale] ?? CATALOG.en) as { errors?: Record<string, string> } | undefined;
    const text = lang?.errors?.[code] ?? (CATALOG.en as { errors?: Record<string, string> }).errors?.[code];
    if (text) return text;
  }
  return e instanceof Error ? e.message : erplora().t(CATALOG, fallbackKey);
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

  /** Where a new ticket goes by default. `dine_in` until `kitchen.settings.get` says otherwise
   *  (kitchen#48): it is the schema and column default, and the picker must never open blank —
   *  `order_type` is `required` by `schemas/order_create.json`, so a blank one cannot be sent. */
  @state() newType = DEFAULT_ORDER_TYPE;

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
    // CLOSED domains (`schemas/order_create.json`): they are PICKED, not typed. A free-text box
    // here obliged the cook to know the internal value, in English (`dine_in`) — and since the
    // manifest filters them by equality, anything else emptied the list without saying why
    // (kitchen#39). `op: eq` is the right operator for a picker, so what changes is the box.
    {
      key: 'order_type',
      header: t('ui.colType'),
      sortable: true,
      filterable: true,
      filterType: 'select',
      format: (r) => enumLabel(ORDER_TYPE_KEY, r.order_type),
      options: enumOptions(ORDER_TYPE_KEY),
    },
    {
      key: 'priority',
      header: t('ui.colPriority'),
      sortable: true,
      filterable: true,
      filterType: 'select',
      format: (r) => enumLabel(PRIORITY_KEY, r.priority),
      options: enumOptions(PRIORITY_KEY),
    },
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

  get rowActions(): DataTableAction[] {
    const t = (k: string): string => erplora().t(CATALOG, k);
    const all: DataTableAction[] = [
      // Solo icono (ADR-0133): el `label` viaja como title + aria-label del botón, no como texto.
      { id: 'fire', label: t('ui.rowFire'), icon: 'flame-outline' },
      { id: 'mark_ready', label: t('ui.rowMarkReady'), icon: 'checkmark-done-outline' },
      { id: 'mark_served', label: t('ui.rowMarkServed'), icon: 'restaurant-outline' },
      { id: 'recall', label: t('ui.rowRecall'), icon: 'arrow-undo-outline' },
      { id: 'cancel', label: t('ui.rowCancel'), icon: 'close-circle-outline', color: 'danger' },
    ];
    // A verb the user cannot run is not offered (kitchen#5): the runtime would refuse it anyway.
    // A verb the row's state does not accept is disabled (kitchen#11): the handler refuses it too.
    return all
      .filter((a) => can(VERB_PERMISSION[a.id as Verb]))
      .map((a) => ({ ...a, disabled: (row: Record<string, unknown>) => !ALLOWED_FROM[a.id as Verb].includes(String(row.status ?? '')) }));
  }

  private readonly onLocaleChange = (): void => this.requestUpdate();

  async connectedCallback() {
    super.connectedCallback();
    window.addEventListener('erplora:locale-changed', this.onLocaleChange);
    await this.loadDefaultOrderType();
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

  /** Reads the hub's default order type once, when the screen opens. Silent on failure on
   *  purpose: this is the INITIAL value of a picker the user can change, so a hub without the
   *  singleton row (or a role without `kitchen.view_settings`) gets `dine_in` and a working
   *  form — never an error banner over a screen whose real job is the ticket list. */
  private async loadDefaultOrderType() {
    try {
      const rows = await erplora().query<Array<Record<string, unknown>>>('kitchen.settings.get');
      const row = Array.isArray(rows) ? rows[0] : (rows as unknown as Record<string, unknown>);
      this.newType = resolveDefaultOrderType(row);
    } catch {
      this.newType = DEFAULT_ORDER_TYPE;
    }
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

  async onRowAction(ev: CustomEvent<{ actionId: string; row: Record<string, unknown> }>) {
    const { actionId, row } = ev.detail;
    this.formError = '';
    try {
      const order_id = (row as unknown as Order).id;
      // set_status carries the change_order verbs; served/cancel are commands of their own, each
      // under its own permission (kitchen#5).
      switch (actionId as Verb) {
        case 'mark_served':
          await erplora().command('kitchen.orders.mark_served', { order_id });
          break;
        case 'cancel':
          await erplora().command('kitchen.orders.cancel', { order_id });
          break;
        default:
          await erplora().command('kitchen.orders.set_status', { order_id, action_name: actionId });
      }
      await this.ctrl.load();
    } catch (e) {
      // A refused transition means this row was stale (kitchen#11): say why, in the user's
      // language, and reload so the row shows the state the server actually has.
      this.formError = errorText(e, 'ui.updateStatusError');
      await this.ctrl.load().catch(() => undefined);
    }
  }

  render() {
    const t = (k: string): string => erplora().t(CATALOG, k);
    return html`<div>
        <header>
          <h2>${t('ui.ordersTitle')}</h2>
        </header>
        <form class="form" data-testid="kitchen-orders-form" @submit=${(e) => this.createOrder(e)}>
          <ion-select data-testid="kitchen-orders-type" mode="md" fill="outline" label-placement="floating" label=${t('ui.colType')} .value=${this.newType} @ionChange=${(e: any) => (this.newType = e.target.value)}>
            ${enumOptions(ORDER_TYPE_KEY).map(
              (o) => html`<ion-select-option value=${o.value}>${o.label}</ion-select-option>`,
            )}
          </ion-select>
          <ion-input data-testid="kitchen-orders-notes" mode="md" fill="outline" label-placement="floating" label=${t('ui.colNotes')} .value=${this.newNotes} @ionInput=${(e: any) => (this.newNotes = e.target.value)}></ion-input>
          <ion-button data-testid="kitchen-orders-submit" type="submit" size="small" ?disabled=${this.saving}>${this.saving ? t('ui.creatingOrder') : t('ui.newOrder')}</ion-button>
        </form>
        ${this.formError ? html`<ok-inline-feedback data-testid="kitchen-orders-form-error" tone="danger" icon="alert-circle-outline">${this.formError}</ok-inline-feedback>` : nothing}
        ${this.ctrl?.error ? html`<ok-inline-feedback data-testid="kitchen-orders-load-error" tone="danger" icon="alert-circle-outline">${this.ctrl.error}</ok-inline-feedback>` : nothing}
        <ok-data-table testid="kitchen-orders-table" .serverSide=${true} .columns=${this.columns} .views=${true} .cardTitle=${(r: Record<string, unknown>) => String(r.order_number ?? '—')} .cardIcon=${() => 'restaurant-outline'} .rows=${this.ctrl?.rows ?? []} .total=${this.ctrl?.total ?? 0} .page=${this.ctrl?.state.page ?? 0} .pageSize=${this.ctrl?.state.pageSize ?? 50} .sort=${this.ctrl?.state.sort} .sortDir=${this.ctrl?.state.dir ?? 'desc'} .searchable=${true} .searchPlaceholder=${t('ui.searchOrders')} .emptyMessage=${this.ctrl?.loading ? t('ui.loading') : t('ui.emptyOrders')} .actions=${this.rowActions} @rowAction=${(e: CustomEvent<{ actionId: string; row: Record<string, unknown> }>) => this.onRowAction(e)} @pageChange=${(e: CustomEvent<number>) => this.ctrl.setPage(e.detail)} @sortChange=${(e: CustomEvent<{ sort: string; dir: 'asc' | 'desc' }>) => this.ctrl.setSort(e.detail.sort, e.detail.dir)} @searchChange=${(e: CustomEvent<string>) => this.ctrl.setSearch(e.detail)} @filterChange=${(e: CustomEvent<{ col: string; value: unknown }>) => this.ctrl.setFilter(e.detail.col, e.detail.value)}></ok-data-table>
      </div>`;
  }
}

define('erp-kitchen-orders-active', ErpKitchenOrdersActive);
