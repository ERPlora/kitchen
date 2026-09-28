// kitchen#120: a refusal is only explained if the code the runtime sends has a sentence. The SDK
// reads the `errors` block of `locales/<lang>.json` (hub#1570) and puts the module's own sentence in
// the Error the screen paints; a code without an entry arrives as the runtime's generic English
// fallback, or as nothing at all.
//
// This guard reads the codes from where the runtime takes them — `on_unique` and `expect_rows.error`
// of every command in `module.json` — so a code added next month without its sentence breaks HERE,
// in `en` (the source) and in `es` (every app is translated, ADR-0055/0199).
import { describe, expect, it } from 'vitest';
import manifest from '../../module.json';
import en from '../../locales/en.json';
import es from '../../locales/es.json';

type Command = { on_unique?: Record<string, string>; expect_rows?: { error?: string } };

const codes = new Set<string>();
for (const cmd of Object.values((manifest as { commands: Record<string, Command> }).commands)) {
  for (const code of Object.values(cmd.on_unique ?? {})) codes.add(code);
  if (cmd.expect_rows?.error) codes.add(cmd.expect_rows.error);
}

describe('every refusal code the manifest declares has a sentence in en and es', () => {
  it('the refusals of the stations screen are declared (kitchen#120, kitchen#126)', () => {
    expect([...codes]).toEqual(
      expect.arrayContaining(['kitchen.station_name_taken', 'kitchen.station_in_use', 'kitchen.station_unavailable']),
    );
  });

  for (const [lang, catalog] of [['en', en], ['es', es]] as const) {
    it(`${lang}: each declared code has its own, non-empty sentence`, () => {
      const errors = (catalog as { errors?: Record<string, string> }).errors ?? {};
      const missing = [...codes].filter((c) => !(typeof errors[c] === 'string' && errors[c].trim()));
      expect(missing).toEqual([]);
    });
  }

  it('the Spanish sentence is a translation, not the English one copied', () => {
    const e = (en as { errors?: Record<string, string> }).errors ?? {};
    const s = (es as { errors?: Record<string, string> }).errors ?? {};
    const copied = [...codes].filter((c) => e[c] && e[c] === s[c]);
    expect(copied).toEqual([]);
  });
});
