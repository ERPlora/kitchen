import { LitElement, html, css, nothing } from 'lit';
import { state } from 'lit/decorators.js';
import { define } from '@erplora/outfitkit/define';
import '@erplora/outfitkit/ok-data-table';
import type { DataTableColumn } from '@erplora/outfitkit';
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

interface KitchenLog {
  id: string;
  order_id: string;
  action: string;
  station_id: string | null;
  notes: string;
  created_at: string;
}

/** Settings de cocina (display + comandas). Espejo de schemas/settings_update.json. */
interface KitchenSettings {
  auto_accept_orders: boolean;
  show_timer: boolean;
  warning_time_minutes: number;
  critical_time_minutes: number;
  items_per_page: number;
  auto_refresh_seconds: number;
  sound_enabled: boolean;
  sound_on_new_order: boolean;
  sound_on_rush: boolean;
  auto_bump_enabled: boolean;
  auto_bump_delay_seconds: number;
  color_coding_enabled: boolean;
  auto_print_tickets: boolean;
  use_rounds: boolean;
  auto_fire_on_round: boolean;
  default_order_type: string;
}

const DEFAULT_SETTINGS: KitchenSettings = {
  auto_accept_orders: false,
  show_timer: true,
  warning_time_minutes: 15,
  critical_time_minutes: 30,
  items_per_page: 12,
  auto_refresh_seconds: 3,
  sound_enabled: true,
  sound_on_new_order: true,
  sound_on_rush: true,
  auto_bump_enabled: false,
  auto_bump_delay_seconds: 5,
  color_coding_enabled: true,
  auto_print_tickets: true,
  use_rounds: true,
  auto_fire_on_round: false,
  default_order_type: 'dine_in',
};

const BOOL_FIELDS: Array<{ key: keyof KitchenSettings; labelKey: string }> = [
  { key: 'auto_accept_orders', labelKey: 'ui.fieldAutoAcceptOrders' },
  { key: 'show_timer', labelKey: 'ui.fieldShowTimer' },
  { key: 'sound_enabled', labelKey: 'ui.fieldSoundEnabled' },
  { key: 'sound_on_new_order', labelKey: 'ui.fieldSoundOnNewOrder' },
  { key: 'sound_on_rush', labelKey: 'ui.fieldSoundOnRush' },
  { key: 'auto_bump_enabled', labelKey: 'ui.fieldAutoBumpEnabled' },
  { key: 'color_coding_enabled', labelKey: 'ui.fieldColorCodingEnabled' },
  { key: 'auto_print_tickets', labelKey: 'ui.fieldAutoPrintTickets' },
  { key: 'use_rounds', labelKey: 'ui.fieldUseRounds' },
  { key: 'auto_fire_on_round', labelKey: 'ui.fieldAutoFireOnRound' },
];

const INT_FIELDS: Array<{ key: keyof KitchenSettings; labelKey: string; min: number; max: number }> = [
  { key: 'warning_time_minutes', labelKey: 'ui.fieldWarningTime', min: 1, max: 120 },
  { key: 'critical_time_minutes', labelKey: 'ui.fieldCriticalTime', min: 1, max: 120 },
  { key: 'items_per_page', labelKey: 'ui.fieldItemsPerPage', min: 4, max: 50 },
  { key: 'auto_refresh_seconds', labelKey: 'ui.fieldAutoRefresh', min: 3, max: 120 },
  { key: 'auto_bump_delay_seconds', labelKey: 'ui.fieldAutoBumpDelay', min: 1, max: 300 },
];

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
    h3 { margin:.25rem 0 .5rem; font-size:1rem; }
    .err { color:#d9480f; font-weight:600; }
    .ok { color:#2b8a3e; font-weight:600; }
    .badge { display:inline-block; padding:.1rem .5rem; border-radius:999px; background:#eef6fb; color:#1496d6; font-size:.75rem; font-weight:600; }
    .settings { border:1px solid var(--line, #e7e2d6); border-radius:10px; padding: .75rem 1rem; margin: 0 0 1rem; background: var(--surface-2, #faf8f2); }
    .settings .grid { display:grid; grid-template-columns: repeat(auto-fill, minmax(16rem, 1fr)); gap:.25rem .75rem; }
    .settings .nums { display:flex; gap:.75rem; flex-wrap:wrap; align-items:end; margin-top:.5rem; }
    .settings .nums ion-input, .settings .nums ion-select { flex:1 1 11rem; min-width:9rem; max-width:13rem; }
    .settings footer { display:flex; gap:.5rem; align-items:center; margin-top:.75rem; }
  `;

  @state() tick = 0;

  @state() showSettings = false;

  @state() settings: KitchenSettings = { ...DEFAULT_SETTINGS };

  @state() settingsMsg = '';

  @state() settingsErr = '';

  @state() savingSettings = false;

  private ctrl!: ListController<KitchenLog>;

  private unsub?: () => void;

  // Getter (no campo): se re-evalúa en cada render → los textos cambian con el idioma activo (ADR-0055).
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
    // Reactividad: el módulo emite kitchen.order.* en cada transición; el listener
    // declarado en module.json crea un log → recargamos la lista.
    try {
      const offs = [
        erplora().on('kitchen.order.created', () => this.ctrl.load()),
        erplora().on('kitchen.order.fired', () => this.ctrl.load()),
        erplora().on('kitchen.order.ready', () => this.ctrl.load()),
        erplora().on('kitchen.order.served', () => this.ctrl.load()),
        erplora().on('kitchen.order.recalled', () => this.ctrl.load()),
        erplora().on('kitchen.order.cancelled', () => this.ctrl.load()),
      ];
      this.unsub = () => offs.forEach((off) => off());
    } catch {
      /* sin SDK (preview) → sin reactividad en vivo */
    }
  }

  disconnectedCallback() {
    window.removeEventListener('erplora:locale-changed', this.onLocaleChange);
    super.disconnectedCallback();
    this.unsub?.();
  }

  private async toggleSettings() {
    this.showSettings = !this.showSettings;
    this.settingsMsg = '';
    this.settingsErr = '';
    if (!this.showSettings) return;
    try {
      const rows = await erplora().query<Array<Record<string, unknown>>>('kitchen.settings.get');
      const row = Array.isArray(rows) ? rows[0] : (rows as unknown as Record<string, unknown>);
      if (row) {
        const next = { ...DEFAULT_SETTINGS } as Record<string, unknown>;
        for (const k of Object.keys(DEFAULT_SETTINGS) as Array<keyof KitchenSettings>) {
          if (row[k] === undefined || row[k] === null) continue;
          next[k] = typeof DEFAULT_SETTINGS[k] === 'boolean' ? Boolean(Number(row[k])) || row[k] === true : row[k];
        }
        this.settings = next as unknown as KitchenSettings;
      }
    } catch (e) {
      this.settingsErr = e instanceof Error ? e.message : erplora().t(CATALOG, 'ui.settingsLoadError');
    }
  }

  private async saveSettings() {
    this.savingSettings = true;
    this.settingsMsg = '';
    this.settingsErr = '';
    try {
      await erplora().command('kitchen.settings.update', { ...this.settings });
      this.settingsMsg = erplora().t(CATALOG, 'ui.settingsSaved');
    } catch (e) {
      this.settingsErr = e instanceof Error ? e.message : erplora().t(CATALOG, 'ui.settingsSaveError');
    } finally {
      this.savingSettings = false;
    }
  }

  private setBool(key: keyof KitchenSettings, value: boolean) {
    this.settings = { ...this.settings, [key]: value };
  }

  private setInt(key: keyof KitchenSettings, value: string, min: number, max: number) {
    const n = Math.max(min, Math.min(max, Number(value) || min));
    this.settings = { ...this.settings, [key]: n };
  }

  private renderSettings() {
    const t = (k: string): string => erplora().t(CATALOG, k);
    return html`<section class="settings">
      <h3>${t('ui.settingsTitle')}</h3>
      <div class="grid">
        ${BOOL_FIELDS.map(
          (f) => html`<ion-item lines="none">
            <ion-toggle .checked=${Boolean(this.settings[f.key])} @ionChange=${(e: any) => this.setBool(f.key, e.detail.checked)}>${t(f.labelKey)}</ion-toggle>
          </ion-item>`,
        )}
      </div>
      <div class="nums">
        ${INT_FIELDS.map(
          (f) => html`<ion-input fill="outline" type="number" label=${t(f.labelKey)} label-placement="floating" min=${f.min} max=${f.max} .value=${String(this.settings[f.key])} @ionInput=${(e: any) => this.setInt(f.key, e.target.value, f.min, f.max)}></ion-input>`,
        )}
        <ion-select fill="outline" label=${t('ui.defaultOrderType')} label-placement="floating" .value=${this.settings.default_order_type} @ionChange=${(e: any) => (this.settings = { ...this.settings, default_order_type: e.target.value })}>
          <ion-select-option value="dine_in">${t('ui.orderTypeDineIn')}</ion-select-option>
          <ion-select-option value="takeaway">${t('ui.orderTypeTakeaway')}</ion-select-option>
          <ion-select-option value="delivery">${t('ui.orderTypeDelivery')}</ion-select-option>
        </ion-select>
      </div>
      <footer>
        <ion-button size="small" ?disabled=${this.savingSettings} @click=${() => this.saveSettings()}>${this.savingSettings ? t('ui.savingSettings') : t('ui.saveSettings')}</ion-button>
        ${this.settingsMsg ? html`<span class="ok">${this.settingsMsg}</span>` : nothing}
        ${this.settingsErr ? html`<span class="err">${this.settingsErr}</span>` : nothing}
      </footer>
    </section>`;
  }

  render() {
    const t = (k: string): string => erplora().t(CATALOG, k);
    return html`<div>
        <header>
          <h2>${t('ui.displayTitle')}</h2>
          <ion-button size="small" fill="outline" @click=${() => this.toggleSettings()}>${this.showSettings ? t('ui.settingsToggleClose') : t('ui.settingsToggleOpen')}</ion-button>
        </header>
        ${this.showSettings ? this.renderSettings() : nothing}
        ${this.ctrl?.error ? html`<p class="err">${this.ctrl.error}</p>` : nothing}
        <ok-data-table .serverSide=${true} .columns=${this.columns} .rows=${this.ctrl?.rows ?? []} .total=${this.ctrl?.total ?? 0} .page=${this.ctrl?.state.page ?? 0} .pageSize=${this.ctrl?.state.pageSize ?? 50} .sort=${this.ctrl?.state.sort} .sortDir=${this.ctrl?.state.dir ?? 'desc'} .searchable=${true} .searchPlaceholder=${t('ui.searchLogs')} .emptyMessage=${this.ctrl?.loading ? t('ui.loading') : t('ui.emptyLogs')} @pageChange=${(e: CustomEvent<number>) => this.ctrl.setPage(e.detail)} @sortChange=${(e: CustomEvent<{ sort: string; dir: 'asc' | 'desc' }>) => this.ctrl.setSort(e.detail.sort, e.detail.dir)} @searchChange=${(e: CustomEvent<string>) => this.ctrl.setSearch(e.detail)} @filterChange=${(e: CustomEvent<{ col: string; value: unknown }>) => this.ctrl.setFilter(e.detail.col, e.detail.value)}></ok-data-table>
      </div>`;
  }
}

define('erp-kitchen-display', ErpKitchenDisplay);
