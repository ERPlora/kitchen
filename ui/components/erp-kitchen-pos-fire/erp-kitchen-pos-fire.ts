// erp-kitchen-pos-fire — el botón «Enviar comanda» del TPV, INYECTADO por kitchen (slot
// `sales.pos.actions`). El host lo coloca dentro de «Comanda actual», nunca en el pie de cobro;
// antes pertenecía a `sales` y lo veían peluquerías y tiendas sin cocina. Ahora solo existe si
// kitchen está instalado y activo (el shell no monta fillers de módulos inactivos, ADR-0128).
//
// Reparto de papeles (ADR-0043: host↔filler por CustomEvents, sin imports cruzados):
//   host → filler  `erp:pos-state {order_id?, items_count, label, channel}` (sobre el elemento,
//                  bubbles:false) — al montar y en cada cambio de carrito/mesa.
//   filler → host  `erp:order-fire {priority?}` (bubbles+composed) — el HOST ejecuta su
//                  `sales.order.fire`: el estado del carrito vive en él, aquí no viaja
//                  ninguna línea. kitchen jamás llama comandos de sales.
//
// URGENTE (hub#1411): el interruptor de urgencia vive AQUÍ porque la urgencia es de cocina —
// `sales` reenvía la palabra sin interpretarla, igual que `label` o `waiter_id`. Y vive en el
// momento de ENVIAR porque la comanda se imprime UNA sola vez, al disparar: marcarla después no
// reimprime el papel que ya salió. Se arma para UNA ronda y se desarma sola (al enviar y al
// cambiar de pedido): un interruptor pegado convierte todas las rondas siguientes en urgentes sin
// que el camarero lo vea, y una cocina donde todo es urgente no tiene nada urgente.
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
    :host { display:flex; flex:1; min-width:0; gap:0.4rem; align-items:stretch; }
    /* Dentro de la vista temporal la acción ocupa todo el ancho: es la validación operativa de
       la comanda, no un icono secundario junto a Cobrar. El host decide dónde vive; kitchen sigue
       siendo dueño del control y de su disponibilidad (ADR-0043). */
    ion-button.fire { width:100%; min-height:3rem; margin:0; position:relative;
      font-weight:800; --border-radius:11px; }
    ion-button.fire ion-icon { font-size:1.15rem; }
    /* El interruptor de URGENTE va PEGADO a la acción que modifica, no perdido en otra barra: se
       decide y se envía en el mismo gesto. Armado se pinta en rojo y relleno — el estado tiene que
       leerse de lejos, con el local lleno y sin mirarlo fijo. */
    ion-button.urgent { width:3.1rem; min-height:3rem; margin:0; flex:0 0 auto;
      --border-radius:11px; --padding-start:0; --padding-end:0; }
    ion-button.urgent ion-icon { font-size:1.3rem; }
    /* pm#392 — the toggle paints from HERE, never from \`color=\`: Ionic resolves it through a
       GLOBAL \`.ion-color-*\` rule that does not reach inside this shadow root, so armed it came
       out with no red fill and unarmed in the default blue. Custom properties do inherit through
       the boundary, so the theme token still applies. Armed = solid (no \`fill\`), unarmed = outline. */
    ion-button.tone-danger:not([fill]) {
      --background: var(--ion-color-danger, #c5000f);
      --background-activated: var(--ion-color-danger-shade, #ad000d);
      --background-focused: var(--ion-color-danger-shade, #ad000d);
      --background-hover: var(--ion-color-danger-tint, #cb1a27);
      --color: var(--ion-color-danger-contrast, #fff);
    }
    ion-button.tone-medium[fill] {
      --border-color: var(--ion-color-medium, #636469);
      --color: var(--ion-color-medium, #636469);
      --background-activated: var(--ion-color-medium, #636469);
      --background-focused: var(--ion-color-medium, #636469);
    }
    /* Badge de PENDIENTES: cuánto queda sin marchar, de un vistazo. */
    .badge { position: absolute; top: -0.3rem; right: -0.3rem; z-index: 1; min-width: 1.1rem;
      height: 1.1rem; padding: 0 0.2rem; border-radius: var(--ok-radius-pill, 999px);
      background: var(--ion-color-warning, #f5a623); color: #1c1b18; font-size: 0.68rem;
      font-weight: 800; display: inline-flex; align-items: center; justify-content: center; }
  `;

  @state() private posState?: PosState;
  /** Armado para la PRÓXIMA ronda (hub#1411). No es un modo: se apaga solo al enviar. */
  @state() private urgent = false;

  connectedCallback() {
    super.connectedCallback();
    this.addEventListener('erp:pos-state', this.onPosState as EventListener);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.removeEventListener('erp:pos-state', this.onPosState as EventListener);
  }

  private readonly onPosState = (e: Event) => {
    const previo = this.posState?.order_id;
    this.posState = (e as CustomEvent<PosState>).detail;
    // Otra cuenta, otra decisión: la urgencia NO se hereda de la mesa anterior. Sin esto, armar y
    // cambiar de mesa sin enviar mandaba urgente la ronda de otro.
    if (this.posState?.order_id !== previo) this.urgent = false;
  };

  private fire() {
    if (!canFire(this.posState)) return;
    // `rush` es el vocabulario de kitchen (`PRIORITIES`, en minúsculas): el shell lo traduce a la
    // forma `HIGH` que entiende el renderizador del papel. Sin armar, el detalle va VACÍO — el
    // contrato de siempre, y el 99 % de las comandas.
    const detail = this.urgent ? { priority: 'rush' } : {};
    this.urgent = false;
    this.dispatchEvent(new CustomEvent('erp:order-fire', { detail, bubbles: true, composed: true }));
  }

  render() {
    const label = this.urgent ? t('ui.fireUrgent') : t('ui.fireToKitchen');
    const urgentLabel = t('ui.markUrgent');
    const pendientes = pendingCount(this.posState);
    return html`
      <ion-button class=${this.urgent ? 'urgent tone-danger' : 'urgent tone-medium'}
                  fill=${this.urgent ? nothing : 'outline'}
                  aria-pressed=${this.urgent ? 'true' : 'false'}
                  title=${urgentLabel} aria-label=${urgentLabel}
                  @click=${() => { this.urgent = !this.urgent; }}>
        <ion-icon slot="icon-only" name="flame-outline"></ion-icon>
      </ion-button>
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
