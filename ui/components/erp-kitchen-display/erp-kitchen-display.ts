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

const BOOL_FIELDS: Array<{ key: keyof KitchenSettings; label: string }> = [
  { key: 'auto_accept_orders', label: 'Auto-aceptar comandas' },
  { key: 'show_timer', label: 'Mostrar temporizador' },
  { key: 'sound_enabled', label: 'Sonido' },
  { key: 'sound_on_new_order', label: 'Sonido al recibir comanda' },
  { key: 'sound_on_rush', label: 'Sonido en prioridad rush' },
  { key: 'auto_bump_enabled', label: 'Auto-bump' },
  { key: 'color_coding_enabled', label: 'Colores por tiempo' },
  { key: 'auto_print_tickets', label: 'Imprimir tickets automáticamente' },
  { key: 'use_rounds', label: 'Usar rondas' },
  { key: 'auto_fire_on_round', label: 'Lanzar al cerrar ronda' },
];

const INT_FIELDS: Array<{ key: keyof KitchenSettings; label: string; min: number; max: number }> = [
  { key: 'warning_time_minutes', label: 'Aviso (min)', min: 1, max: 120 },
  { key: 'critical_time_minutes', label: 'Crítico (min)', min: 1, max: 120 },
  { key: 'items_per_page', label: 'Comandas por página', min: 4, max: 50 },
  { key: 'auto_refresh_seconds', label: 'Refresco (s)', min: 3, max: 120 },
  { key: 'auto_bump_delay_seconds', label: 'Auto-bump (s)', min: 1, max: 300 },
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
    .settings .nums { display:flex; gap:.5rem; flex-wrap:wrap; margin-top:.5rem; }
    .settings .nums ion-input { max-width: 11rem; --background: #fff; border:1px solid var(--line,#e7e2d6); border-radius:8px; }
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

  private columns: DataTableColumn[] = [
    {
      key: 'action',
      header: 'Acción',
      sortable: true,
      filterable: true,
      filterType: 'select',
      options: [
        { value: 'received', label: 'Recibidas' },
        { value: 'started', label: 'Lanzadas' },
        { value: 'bumped', label: 'Listas (bump)' },
        { value: 'served', label: 'Servidas' },
        { value: 'recalled', label: 'Recuperadas' },
        { value: 'cancelled', label: 'Canceladas' },
      ],
    },
    { key: 'order_id', header: 'Comanda', sortable: true, filterable: true, filterType: 'text' },
    { key: 'notes', header: 'Notas', sortable: true, filterable: true, filterType: 'text' },
    { key: 'created_at', header: 'Cuándo', sortable: true, filterable: true, filterType: 'daterange' },
  ];

  async connectedCallback() {
    super.connectedCallback();
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
      this.settingsErr = e instanceof Error ? e.message : 'No se pudieron cargar los ajustes';
    }
  }

  private async saveSettings() {
    this.savingSettings = true;
    this.settingsMsg = '';
    this.settingsErr = '';
    try {
      await erplora().command('kitchen.settings.update', { ...this.settings });
      this.settingsMsg = 'Ajustes guardados';
    } catch (e) {
      this.settingsErr = e instanceof Error ? e.message : 'No se pudieron guardar los ajustes';
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
    return html`<section class="settings">
      <h3>Ajustes de cocina</h3>
      <div class="grid">
        ${BOOL_FIELDS.map(
          (f) => html`<ion-item lines="none">
            <ion-toggle .checked=${Boolean(this.settings[f.key])} @ionChange=${(e: any) => this.setBool(f.key, e.detail.checked)}>${f.label}</ion-toggle>
          </ion-item>`,
        )}
      </div>
      <div class="nums">
        ${INT_FIELDS.map(
          (f) => html`<ion-input type="number" label=${f.label} label-placement="stacked" min=${f.min} max=${f.max} .value=${String(this.settings[f.key])} @ionInput=${(e: any) => this.setInt(f.key, e.target.value, f.min, f.max)}></ion-input>`,
        )}
        <ion-select label="Tipo por defecto" label-placement="stacked" .value=${this.settings.default_order_type} @ionChange=${(e: any) => (this.settings = { ...this.settings, default_order_type: e.target.value })}>
          <ion-select-option value="dine_in">En sala</ion-select-option>
          <ion-select-option value="takeaway">Para llevar</ion-select-option>
          <ion-select-option value="delivery">A domicilio</ion-select-option>
        </ion-select>
      </div>
      <footer>
        <ion-button size="small" ?disabled=${this.savingSettings} @click=${() => this.saveSettings()}>${this.savingSettings ? 'Guardando…' : 'Guardar ajustes'}</ion-button>
        ${this.settingsMsg ? html`<span class="ok">${this.settingsMsg}</span>` : nothing}
        ${this.settingsErr ? html`<span class="err">${this.settingsErr}</span>` : nothing}
      </footer>
    </section>`;
  }

  render() {
    return html`<div>
        <header>
          <h2>Kitchen Display</h2>
          <ion-button size="small" fill="outline" @click=${() => this.toggleSettings()}>${this.showSettings ? 'Cerrar ajustes' : 'Ajustes'}</ion-button>
        </header>
        ${this.showSettings ? this.renderSettings() : nothing}
        ${this.ctrl?.error ? html`<p class="err">${this.ctrl.error}</p>` : nothing}
        <ok-data-table .serverSide=${true} .columns=${this.columns} .rows=${this.ctrl?.rows ?? []} .total=${this.ctrl?.total ?? 0} .page=${this.ctrl?.state.page ?? 0} .pageSize=${this.ctrl?.state.pageSize ?? 50} .sort=${this.ctrl?.state.sort} .sortDir=${this.ctrl?.state.dir ?? 'desc'} .searchable=${true} .searchPlaceholder=${"Buscar acción, comanda o notas…"} .emptyMessage=${this.ctrl?.loading ? 'Cargando…' : 'Sin actividad reciente en cocina.'} @pageChange=${(e: CustomEvent<number>) => this.ctrl.setPage(e.detail)} @sortChange=${(e: CustomEvent<{ sort: string; dir: 'asc' | 'desc' }>) => this.ctrl.setSort(e.detail.sort, e.detail.dir)} @searchChange=${(e: CustomEvent<string>) => this.ctrl.setSearch(e.detail)} @filterChange=${(e: CustomEvent<{ col: string; value: unknown }>) => this.ctrl.setFilter(e.detail.col, e.detail.value)}></ok-data-table>
      </div>`;
  }
}

define('erp-kitchen-display', ErpKitchenDisplay);
