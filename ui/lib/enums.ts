// The module's closed domains, as the USER reads them (kitchen#39).
//
// `order_type` and `priority` are fixed by `schemas/order_create.json` and by the migration, and the
// orders table let people TYPE them into a free-text filter box. Typing an enum obliges the user to
// know the internal value, in English (`dine_in`), which is a filter that only works for whoever
// wrote the module — so those columns are pickers now, and a picker needs one place to get its
// labels from.
//
// That place is here, and it is the SAME place the cell reads: the drift this module keeps
// producing (kitchen#34, #36, #39) is always two lists for one thing. The labels of `order_type`
// already lived twice, under two key families — `ui.orderTypeDineIn` in the new-order form and
// `ui.orderType_<value>` in the KDS — and they are one family now, the value-derived one.
//
// Labels are i18n keys resolved at RENDER time through `erplora.t()` (ADR-0055), never at module
// load: when this file is imported the shell has not published the client yet, and the user can
// change language later.
import esLocale from '../../locales/es.json';
import enLocale from '../../locales/en.json';

const CATALOG: Record<string, unknown> = { es: esLocale, en: enLocale };

interface Translator {
  locale: string;
  t(catalog: Record<string, unknown>, key: string, params?: Record<string, unknown>): string;
}

function erplora(): Translator {
  const c = (globalThis as { erplora?: Translator }).erplora;
  if (!c) throw new Error('erplora SDK no inicializado por el shell');
  return c;
}

/** `kitchen_order.order_type` — where the plate goes (ADR-0141). */
export const ORDER_TYPE_KEY: Record<string, string> = {
  dine_in: 'ui.orderType_dine_in',
  takeaway: 'ui.orderType_takeaway',
  delivery: 'ui.orderType_delivery',
};

/** `kitchen_order.priority` — how fast. `normal` is the default and had no label at all: the KDS
 *  only paints a pill for the other two, so nobody had ever needed one. A filter does — without it
 *  the state every order is born in is the one state you cannot pick. */
export const PRIORITY_KEY: Record<string, string> = {
  normal: 'ui.priority_normal',
  rush: 'ui.priority_rush',
  vip: 'ui.priority_vip',
};

/**
 * The label of `value` in the active language.
 *
 * A value the catalogue does not know is printed AS IS: this is a kitchen screen, and a hub running
 * a module newer than its catalogue must still see the order rather than a blank cell.
 */
export function enumLabel(keys: Record<string, string>, value: unknown): string {
  const raw = value == null ? '' : String(value);
  const key = keys[raw];
  return key ? erplora().t(CATALOG, key) : raw;
}

/** The options of a closed domain, for an `<ion-select>` or a column filter — the same labels the
 *  cell prints, by construction. */
export function enumOptions(keys: Record<string, string>): { value: string; label: string }[] {
  return Object.keys(keys).map((value) => ({ value, label: enumLabel(keys, value) }));
}
