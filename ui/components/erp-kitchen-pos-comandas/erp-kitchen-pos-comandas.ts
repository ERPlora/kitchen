// erp-kitchen-pos-comandas — el CHIP «Comandas · N» + su MODAL, inyectado por kitchen en el TPV
// (slot `sales.pos.order_info`, decisión Ioan 2026-07-19, 2ª ronda del debate).
//
// Composición por módulos, de lo básico a lo complejo: `sales` solo parte su carrito en
// Pendiente/Enviado (dato genérico de la línea); el DETALLE de las comandas — número, hora y
// ESTADO EN VIVO del KDS — es dato de kitchen (`source_order_id`) y lo pinta este filler. Sin
// kitchen instalado, el slot queda vacío y el TPV de tienda no ve cocina ni de lejos.
//
//   host → filler  `erp:pos-state {order_id, …}` (mismo canal que el botón del footer).
//   El filler consulta SUS comandas (kitchen.orders.list, filtro source_order_id) y se suscribe a
//   los eventos del KDS (kitchen.order.fired/ready/served/…): el camarero ve pasar la comanda
//   a LISTA sin tocar nada. Modal = <dialog> nativo showModal() (top layer, patrón del picker
//   de mesas de tables; los overlays de Ionic en shadow Lit se re-parentan, ADR-0028).
import { LitElement, css, html, nothing } from 'lit';
import { state } from 'lit/decorators.js';
import { define } from '@erplora/outfitkit/define';
import esLocale from '../../../locales/es.json';
import enLocale from '../../../locales/en.json';
import type { PosState } from '../../lib/pos-fire.js';

const CATALOG: Record<string, unknown> = { es: esLocale, en: enLocale };

interface Comanda {
  id: string;
  round_number: number;
  status: string;
  fired_at?: string;
  created_at?: string;
}

interface ComandaItem { id: string; product_name: string; quantity: number; }

interface ErploraLike {
  locale: string;
  t(catalog: Record<string, unknown>, key: string, params?: Record<string, unknown>): string;
  queryAll<T = unknown>(name: string, params?: Record<string, unknown>): Promise<T[]>;
  /** Query PLANA (sin motor de listas): las de detalle (items) rechazan params de paginación. */
  query<T = unknown>(name: string, params?: Record<string, unknown>): Promise<T>;
  on?(event: string, cb: (payload: unknown) => void): () => void;
}

function rows<T>(r: unknown): T[] {
  if (Array.isArray(r)) return r as T[];
  if (r && typeof r === 'object' && Array.isArray((r as { rows?: T[] }).rows)) return (r as { rows: T[] }).rows;
  return [];
}

function erplora(): ErploraLike {
  const c = (globalThis as { erplora?: ErploraLike }).erplora;
  if (!c) throw new Error('erplora SDK no inicializado por el shell');
  return c;
}

function t(key: string, params?: Record<string, unknown>): string {
  const c = (globalThis as { erplora?: ErploraLike }).erplora;
  return c?.t ? c.t(CATALOG, key, params) : key;
}

/** Estado del KDS → su clave i18n. Un estado nuevo cae al literal (nunca cadena vacía). */
const STATUS_KEY: Record<string, string> = {
  pending: 'ui.stQueued',
  preparing: 'ui.stPreparing',
  ready: 'ui.stReady',
  served: 'ui.stServed',
  paid: 'ui.stPaid',
  cancelled: 'ui.stCancelled',
};

/** Eventos del KDS que cambian lo que este chip enseña (los emite el handler de set_status). */
const KDS_EVENTS = [
  'kitchen.order.created', 'kitchen.order.fired', 'kitchen.order.ready',
  'kitchen.order.served', 'kitchen.order.recalled', 'kitchen.order.cancelled',
  'kitchen.order.deleted',
];

export class ErpKitchenPosComandas extends LitElement {
  static styles = css`
    :host { display: inline-flex; }
    .chip { display: inline-flex; align-items: center; gap: .3rem; border: 1px solid
      var(--ion-color-primary, #0091ce); color: var(--ion-color-primary, #0091ce);
      background: none; border-radius: var(--ok-radius-pill, 999px); padding: .15rem .6rem; font-size: .72rem;
      font-weight: 800; cursor: pointer; }
    .chip ion-icon { font-size: .9rem; }
    dialog.sheet { border: none; border-radius: var(--ok-radius-lg, 16px); padding: 1rem; width: min(94vw, 26rem);
      max-height: 85vh; overflow: auto; background: var(--ion-background-color, #fff);
      color: var(--ion-text-color, #1c1b18); box-shadow: 0 12px 48px rgba(0,0,0,.35); }
    dialog.sheet::backdrop { background: rgba(0,0,0,.45); }
    @media (max-width: 820px) {
      dialog.sheet { width: 100vw; max-width: 100vw; margin: auto 0 0;
        border-radius: var(--ok-radius-sheet-top, 18px 18px 0 0); padding-bottom: max(1rem, env(safe-area-inset-bottom)); }
      dialog.sheet::before { content: ''; display: block; width: 2.4rem; height: .3rem;
        border-radius: var(--ok-radius-pill, 999px); background: rgba(0,0,0,.15); margin: 0 auto .7rem; }
    }
    .sheet-h { display: flex; justify-content: space-between; align-items: center; margin-bottom: .6rem; }
    .sheet-h .t { font-size: 1.1rem; font-weight: 700; }
    .x { background: none; border: none; font-size: 1.2rem; cursor: pointer; color: #8b897f; }
    .krow { border: 1px solid rgba(0,0,0,.12); border-radius: var(--ok-radius, 12px); margin-bottom: .5rem; overflow: hidden; }
    .krow-h { display: flex; align-items: center; gap: .4rem; padding: .5rem .7rem;
      font-weight: 700; font-size: .82rem; text-transform: uppercase; letter-spacing: .04em;
      background: rgba(0,0,0,.04); }
    .krow-h .ktime { color: #8b897f; font-weight: 400; text-transform: none; letter-spacing: 0; }
    .kstate { margin-left: auto; font-size: .62rem; font-weight: 800; padding: .1rem .45rem;
      border-radius: var(--ok-radius-pill, 999px); background: #e9ecef; color: #1c1b18; }
    .kstate[data-st='preparing'] { background: var(--ion-color-warning, #f5a623); }
    .kstate[data-st='ready'] { background: var(--ion-color-success, #2f9e44); color: #fff; }
    .kstate[data-st='served'] { background: #dee2e6; }
    .kstate[data-st='cancelled'] { background: var(--ion-color-danger, #d9480f); color: #fff; }
    .kitem { display: flex; gap: .5rem; padding: .35rem .7rem; font-size: .9rem; }
    .kitem .q { color: #8b897f; min-width: 2.2rem; }
  `;

  @state() private orderId?: string;
  @state() private comandas: Comanda[] = [];
  @state() private items = new Map<string, ComandaItem[]>();
  @state() private open = false;
  private offs: Array<() => void> = [];

  connectedCallback() {
    super.connectedCallback();
    this.addEventListener('erp:pos-state', this.onPosState as EventListener);
    // EN VIVO: cualquier movimiento del KDS refresca lo que el camarero ve en el TPV.
    // OJO: `on` se llama COMO MÉTODO del cliente — desmontarlo pierde su `this.transport`.
    const c = erplora();
    if (typeof c.on === 'function') {
      this.offs = KDS_EVENTS.map((ev) => c.on!(ev, () => void this.refresh()));
    }
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.removeEventListener('erp:pos-state', this.onPosState as EventListener);
    for (const off of this.offs) off();
    this.offs = [];
  }

  private readonly onPosState = (e: Event) => {
    const next = (e as CustomEvent<PosState>).detail?.order_id;
    if (next === this.orderId) return;
    this.orderId = next;
    void this.refresh();
  };

  private async refresh(): Promise<void> {
    if (!this.orderId) { this.comandas = []; return; }
    try {
      const rows = await erplora().queryAll<Comanda>('kitchen.orders.list', {
        filters: { source_order_id: this.orderId }, sort: 'round_number', dir: 'desc',
      });
      // La más reciente primero (la que el camarero consulta).
      this.comandas = [...rows].sort((a, b) => (b.round_number ?? 0) - (a.round_number ?? 0));
    } catch {
      this.comandas = [];
    }
  }

  private async openModal(): Promise<void> {
    this.open = true;
    await this.updateComplete;
    // showModal() = TOP LAYER (inmune a ancestros con transform). El template NO lleva el
    // atributo `open`: con él puesto, el guard de showModal nunca corría y el dialog se
    // pintaba INLINE aplastando la lista (visto en Playwright).
    const d = this.renderRoot.querySelector('dialog.sheet') as HTMLDialogElement | null;
    if (d && !d.open) {
      try { d.showModal(); } catch { d.setAttribute('open', ''); /* happy-dom: sin top layer */ }
    }
    // Las líneas de cada comanda se cargan al abrir (pocas; el chip no las necesita).
    // Query PLANA (no queryAll): el motor de listas mete paginación y la query de detalle la
    // rechaza con 422 (visto en Playwright).
    for (const c of this.comandas) {
      if (this.items.has(c.id)) continue;
      try {
        const its = rows<ComandaItem>(await erplora().query('kitchen.orders.items', { order_id: c.id }));
        this.items = new Map(this.items).set(c.id, its);
      } catch { /* sin líneas no se rompe el modal */ }
    }
  }

  private closeModal(): void {
    const d = this.renderRoot.querySelector('dialog.sheet') as HTMLDialogElement | null;
    try { d?.close(); } catch { /* sin soporte */ }
    this.open = false;
  }

  /** µ → texto legible (2, 0.5…) sin arrastrar ceros. La cocina habla punto fijo 10⁶ (ADR-0147). */
  private qty(raw: number): string {
    return String((Number(raw) || 0) / 1_000_000);
  }

  render() {
    if (!this.orderId || !this.comandas.length) return html``;
    return html`
      <button class="chip" title=${t('ui.posComandasTitle')} aria-label=${t('ui.posComandasTitle')}
              @click=${() => void this.openModal()}>
        <ion-icon name="receipt-outline"></ion-icon>
        ${t('ui.posComandas')} · ${this.comandas.length}
      </button>
      ${this.open ? html`
        <dialog class="sheet" aria-label=${t('ui.posComandasTitle')}
                @click=${(e: Event) => { if (e.target === e.currentTarget) this.closeModal(); }}
                @close=${() => { this.open = false; }}>
          <div class="sheet-h">
            <span class="t">${t('ui.posComandasTitle')}</span>
            <button class="x" aria-label=${t('ui.close')} @click=${() => this.closeModal()}>✕</button>
          </div>
          ${this.comandas.map((c) => html`
            <div class="krow">
              <div class="krow-h">
                <ion-icon name="flame" color="warning"></ion-icon>
                <span>${t('ui.comandaN', { n: String(c.round_number) })}</span>
                <span class="ktime">· ${(c.fired_at ?? c.created_at ?? '').replace('T', ' ').slice(11, 16)}</span>
                <span class="kstate" data-st=${c.status}>${t(STATUS_KEY[c.status] ?? c.status)}</span>
              </div>
              ${(this.items.get(c.id) ?? []).map((i) => html`
                <div class="kitem"><span class="q">${this.qty(i.quantity)}×</span><span>${i.product_name}</span></div>`)}
            </div>`)}
        </dialog>` : nothing}`;
  }
}

define('erp-kitchen-pos-comandas', ErpKitchenPosComandas);

declare global {
  interface HTMLElementTagNameMap {
    'erp-kitchen-pos-comandas': ErpKitchenPosComandas;
  }
}
