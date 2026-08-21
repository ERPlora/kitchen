// Contract of the module's enum catalogue (kitchen#39).
//
// `order_type` and `priority` are CLOSED domains — the values are fixed by `schemas/order_create.json`
// and the migration — and the screen let people TYPE them into a free-text filter box. Typing an
// enum obliges the user to know the internal values, in English (`dine_in`), which is a filter that
// only works for whoever wrote the module.
//
// Before this file the labels of `order_type` lived in TWO places with two key families
// (`ui.orderTypeDineIn` in the new-order form, `ui.orderType_dine_in` in the KDS), which is the
// same drift kitchen#36/#39 keep finding in the filters. One catalogue, and the filter, the cell
// and the picker all read from it.
import { beforeEach, describe, expect, it } from 'vitest';

import esLocale from '../../locales/es.json';
import { ORDER_TYPE_KEY, PRIORITY_KEY, enumLabel, enumOptions } from './enums';

const es = (esLocale as { ui: Record<string, string> }).ui;

function shellSpeaking(locale: string) {
  (globalThis as Record<string, unknown>).erplora = {
    locale,
    t: (catalog: Record<string, unknown>, key: string) => {
      const lang = (catalog[locale] ?? catalog.en) as Record<string, Record<string, string>>;
      const [section, name] = key.split('.');
      return lang?.[section]?.[name] ?? key;
    },
  };
}

beforeEach(() => shellSpeaking('es'));

describe('the closed domains are exactly the ones the schemas accept', () => {
  it('`order_type` is where the plate goes', () => {
    expect(Object.keys(ORDER_TYPE_KEY).sort()).toEqual(['delivery', 'dine_in', 'takeaway']);
  });

  it('`priority` is how fast, `normal` included', () => {
    // `normal` had no label at all: the KDS only ever painted a pill for the OTHER two. A filter
    // has to offer it, or the default state of every order is unfilterable.
    expect(Object.keys(PRIORITY_KEY).sort()).toEqual(['normal', 'rush', 'vip']);
  });
});

describe('every value reads in the language of the hub', () => {
  it('no order type resolves to its own i18n key', () => {
    for (const [value, key] of Object.entries(ORDER_TYPE_KEY)) {
      expect(enumLabel(ORDER_TYPE_KEY, value), `${key} is missing from es.json`).not.toBe(key);
    }
    expect(enumLabel(ORDER_TYPE_KEY, 'dine_in')).toBe(es.orderType_dine_in);
  });

  it('no priority resolves to its own i18n key', () => {
    for (const [value, key] of Object.entries(PRIORITY_KEY)) {
      expect(enumLabel(PRIORITY_KEY, value), `${key} is missing from es.json`).not.toBe(key);
    }
  });

  it('English says the same thing its own way — nothing is hardcoded', () => {
    shellSpeaking('en');
    expect(enumLabel(ORDER_TYPE_KEY, 'takeaway')).toBe('Takeaway');
  });

  it('a value the catalogue does not know is printed AS IS, never blank', () => {
    // A hub on a module newer than its catalogue must still see the order: this is a kitchen.
    expect(enumLabel(ORDER_TYPE_KEY, 'drive_through')).toBe('drive_through');
    expect(enumLabel(PRIORITY_KEY, null)).toBe('');
  });
});

describe('the filter options and the cell cannot drift apart', () => {
  it('the options carry the SAME labels the cell prints', () => {
    for (const keys of [ORDER_TYPE_KEY, PRIORITY_KEY]) {
      for (const opt of enumOptions(keys)) {
        expect(opt.label).toBe(enumLabel(keys, opt.value));
      }
    }
  });

  it('the options offer every value of the domain, so no order is unreachable', () => {
    expect(enumOptions(ORDER_TYPE_KEY).map((o) => o.value).sort()).toEqual(Object.keys(ORDER_TYPE_KEY).sort());
    expect(enumOptions(PRIORITY_KEY).map((o) => o.value).sort()).toEqual(Object.keys(PRIORITY_KEY).sort());
  });
});
