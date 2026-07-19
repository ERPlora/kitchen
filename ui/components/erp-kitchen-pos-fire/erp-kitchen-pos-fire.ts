// erp-kitchen-pos-fire — el botón «Enviar a cocina» del TPV, INYECTADO por kitchen (slot
// `sales.pos.actions`, decisión Ioan 2026-07-19). Antes vivía hardcodeado en el footer de
// `sales` y lo veían peluquerías y tiendas sin cocina; ahora solo existe si kitchen está
// instalado y activo (el shell no monta fillers de módulos inactivos, ADR-0128).
//
// Reparto de papeles (ADR-0043: host↔filler por CustomEvents, sin imports cruzados):
//   host → filler  `erp:pos-state {order_id?, items_count, label, channel}` (sobre el elemento,
//                  bubbles:false) — al montar y en cada cambio de carrito/mesa.
//   filler → host  `erp:order-fire {}` (bubbles+composed) — el HOST ejecuta su
//                  `sales.order.fire`: el estado del carrito vive en él, aquí no viaja
//                  ninguna línea. kitchen jamás llama comandos de sales.
import { LitElement, css, html } from 'lit';
import { state } from 'lit/decorators.js';
import { define } from '@erplora/outfitkit/define';
// Catálogo i18n del módulo (ADR-0055): esbuild inlinea estos JSON en el dist del WC.
import esLocale from '../../../locales/es.json';
import enLocale from '../../../locales/en.json';
import { canFire, type PosState } from '../../lib/pos-fire.js';

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
    :host { display: contents; }
    /* El tamaño lo manda el footer del HOST (mismos 56px outline que «imprimir cuenta»);
       aquí solo se hereda — un filler no impone su layout (ADR-0043). */
    ion-button.fire { margin: 0; }
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
    return html`
      <ion-button class="fire" fill="outline" ?disabled=${!canFire(this.posState)}
                  title=${label} aria-label=${label}
                  @click=${() => this.fire()}>
        <ion-icon slot="icon-only" name="restaurant-outline"></ion-icon>
      </ion-button>`;
  }
}

define('erp-kitchen-pos-fire', ErpKitchenPosFire);

declare global {
  interface HTMLElementTagNameMap {
    'erp-kitchen-pos-fire': ErpKitchenPosFire;
  }
}
