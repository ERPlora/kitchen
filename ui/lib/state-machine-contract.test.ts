// The kitchen state machine is authoritative (kitchen#11).
//
// QA reproduced the P0: fire → mark_ready → mark_served left a ticket served, and a further
// mark_ready answered ok=true and moved it back to `ready` keeping `served_at`. Two causes:
//  · the handler decided the transition without knowing the row's status, and the SQL guard
//    (`require_status`) was empty for every verb but recall;
//  · a `WHERE` that matched no row still committed and emitted its event (no affected-rows gate).
// The fix: the three transition commands declare a `reads` of `kitchen.orders.get` filtered by the
// payload (ADR-0069, `required`), the handler refuses any transition outside the matrix with a
// business code, and the SQL guard is pinned to the state it validated. The header sub-command
// declares `expect_rows` so the runtime gate applies the day hub#1025 extends it to handler ops.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = join(__dirname, '../..');
const manifest = JSON.parse(readFileSync(join(ROOT, 'module.json'), 'utf8')) as {
  id: string;
  commands: Record<
    string,
    {
      reads?: ({ query: string; params?: Record<string, string>; required?: boolean } | string)[];
      expect_rows?: { op: string; n: number; error: string; message?: string };
    }
  >;
};
const locales = (lang: string) =>
  JSON.parse(readFileSync(join(ROOT, `locales/${lang}.json`), 'utf8')) as { errors?: Record<string, string> };

const TRANSITIONS = ['kitchen.orders.set_status', 'kitchen.orders.mark_served', 'kitchen.orders.cancel'];

describe('every transition command sees the row before deciding (ADR-0069)', () => {
  for (const name of TRANSITIONS) {
    it(`${name} preloads kitchen.orders.get by payload.order_id, required`, () => {
      const read = (manifest.commands[name].reads ?? []).find(
        (r) => typeof r === 'object' && r.query === 'kitchen.orders.get',
      ) as { params?: Record<string, string>; required?: boolean } | undefined;
      expect(read, 'the read is declared').toBeTruthy();
      expect(read!.params?.order_id).toBe('payload.order_id');
      expect(read!.required, 'a failing read must abort, never let the handler guess').toBe(true);
    });
  }
});

describe('a header update that matches no row is a rejection, not a silent OK', () => {
  it('kitchen._set_order_status declares expect_rows min 1 with a module code', () => {
    const gate = manifest.commands['kitchen._set_order_status'].expect_rows;
    expect(gate).toBeTruthy();
    expect(gate!.op).toBe('min');
    expect(gate!.n).toBe(1);
    expect(gate!.error).toBe('kitchen.invalid_transition');
    expect(gate!.message).toBeTruthy();
  });
});

describe('the business codes are translatable (English source + es)', () => {
  for (const lang of ['en', 'es']) {
    it(`${lang} carries kitchen.invalid_transition and kitchen.order_unavailable`, () => {
      const errors = locales(lang).errors ?? {};
      expect(errors['kitchen.invalid_transition']).toBeTruthy();
      expect(errors['kitchen.order_unavailable']).toBeTruthy();
    });
  }
});
