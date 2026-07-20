// erp-kitchen-pos-fire — el botón «Enviar comanda» del TPV, INYECTADO por kitchen (slot
// `sales.pos.actions`). El host lo coloca dentro de «Comanda actual», nunca en el pie de cobro;
// antes pertenecía a `sales` y lo veían peluquerías y tiendas sin cocina. Ahora solo existe si
// kitchen está instalado y activo (el shell no monta fillers de módulos inactivos, ADR-0128).
//
// Reparto de papeles (ADR-0043: host↔filler por CustomEvents, sin imports cruzados):
//   host → filler  `erp:pos-state {order_id?, items_count, label, channel}` (sobre el elemento,
//                  bubbles:false) — al montar y en cada cambio de carrito/mesa.
//   filler → host  `erp:order-fire {}` (bubbles+composed) — el HOST ejecuta su
//                  `sales.order.fire`: el estado del carrito vive en él, aquí no viaja
//                  ninguna línea. kitchen jamás llama comandos de sales.
import { LitElement, css, html, nothing } from 'lit';
import { state } from 'lit/decorators.js';
import { define } from '@erplora/outfitkit/define';
// Catálogo i18n del módulo (ADR-0055): esbuild inlinea estos JSON en el dist del WC.
import esLocale from '../../../locales/es.json';
import enLocale from '../../../locales/en.json';
import { canFire, pendingCount, type PosState } from '../../lib/pos-fire.js';

const CATALOG: Record<string, unknown> = { es: esLocale, en: enLocale };

interface ErploraI18nLike {
  locale: string;
  t(catalog: Record<string, unknown>, key: string, params?: Record<string, unknown>): string;
}

function t(key: string): string {
  const c = (globalThis as { erplora?: ErploraI18nLike }).erplora;
  return c?.t ? c.t(CATALOG, key) : key;
}

export class ErpKitchenPosFire extends LitElement {
  static styles = css`
    :host { display:block; flex:1; min-width:0; }
    /* Dentro de la vista temporal la acción ocupa todo el ancho: es la validación operativa de
       la comanda, no un icono secundario junto a Cobrar. El host decide dónde vive; kitchen sigue
       siendo dueño del control y de su disponibilidad (ADR-0043). */
    ion-button.fire { width:100%; min-height:3rem; margin:0; position:relative;
      font-weight:800; --border-radius:11px; }
    ion-button.fire ion-icon { font-size:1.15rem; }
    /* Badge de PENDIENTES: cuánto queda sin marchar, de un vistazo. */
    .badge { position: absolute; top: -0.3rem; right: -0.3rem; z-index: 1; min-width: 1.1rem;
      height: 1.1rem; padding: 0 0.2rem; border-radius: 999px;
      background: var(--ion-color-warning, #f5a623); color: #1c1b18; font-size: 0.68rem;
      font-weight: 800; display: inline-flex; align-items: center; justify-content: center; }
  `;

  @state() private posState?: PosState;

  connectedCallback() {
    super.connectedCallback();
    this.addEventListener('erp:pos-state', this.onPosState as EventListener);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.removeEventListener('erp:pos-state', this.onPosState as EventListener);
  }

  private readonly onPosState = (e: Event) => {
    this.posState = (e as CustomEvent<PosState>).detail;
  };

  private fire() {
    if (!canFire(this.posState)) return;
    this.dispatchEvent(new CustomEvent('erp:order-fire', { detail: {}, bubbles: true, composed: true }));
  }

  render() {
    const label = t('ui.fireToKitchen');
    const pendientes = pendingCount(this.posState);
    return html`
      <ion-button class="fire" fill="outline" ?disabled=${!canFire(this.posState)}
                  title=${label} aria-label=${label}
                  @click=${() => this.fire()}>
        <ion-icon slot="start" name="send-outline"></ion-icon>
        <span>${label}</span>
        ${pendientes > 0 && this.posState?.pending_count !== undefined
          ? html`<span class="badge">${pendientes}</span>` : nothing}
      </ion-button>`;
  }
}

define('erp-kitchen-pos-fire', ErpKitchenPosFire);

declare global {
  interface HTMLElementTagNameMap {
    'erp-kitchen-pos-fire': ErpKitchenPosFire;
  }
}
