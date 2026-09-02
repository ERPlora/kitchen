#!/usr/bin/env python3
"""A tone the form offers and the chime cannot ring is a switch that moves nothing (kitchen#72).

`sound_tone` is a CLOSED list in two places that nobody keeps in sync by hand:

  · `schemas/settings_update.json` — what the shell paints as an `ion-select`, and the only values
    the runtime will accept when the form is saved;
  · `TONE_SPECS` in `ui/lib/chime.ts` — what the KDS can actually synthesise.

`Chime` falls back to the default tone when it is handed a name it does not know, and that fallback
is deliberate — a hub upgrades on its own schedule and a mute pass is the worse failure — but it
also means a DRIFT between the two lists is **silent**: the cook picks «buzzer», saves, hears the
chime, and there is no error anywhere. That is the exact family of failure kitchen#48 retired ten
settings over, so it gets a guard instead of a promise.

The other half is the DEFAULT: the schema's has to be the one the chime rings when nobody chose,
or a hub with no settings row hears one tone and the form shows another.
"""

import json
import pathlib
import re
import sys

MODULE_DIR = pathlib.Path(__file__).resolve().parent.parent
SCHEMA_PATH = MODULE_DIR / "schemas" / "settings_update.json"
CHIME_PATH = MODULE_DIR / "ui" / "lib" / "chime.ts"

#: `  chime: { wave: 'sine', notes: [880, 1320] },` — one entry of `TONE_SPECS`.
TONE_RE = re.compile(r"^\s+(?P<name>[a-z_][a-z0-9_]*):\s*\{\s*wave:", re.MULTILINE)

#: `export const DEFAULT_TONE: ChimeTone = 'chime';`
DEFAULT_TONE_RE = re.compile(
    r"DEFAULT_TONE\s*:\s*ChimeTone\s*=\s*'(?P<name>[a-z_][a-z0-9_]*)'"
)

failures: list[str] = []


def tone_specs_block(source: str) -> str:
    """The body of `TONE_SPECS`, so a `wave:` written anywhere else is not read as a tone."""
    start = source.find("const TONE_SPECS")
    if start < 0:
        return ""
    end = source.find("} as const", start)
    return source[start:end] if end > start else ""


def main() -> int:
    source = CHIME_PATH.read_text(encoding="utf-8")
    block = tone_specs_block(source)
    if not block:
        failures.append(
            f"`TONE_SPECS` not found in {CHIME_PATH.name}: the scan would compare the schema "
            "against an empty list and pass for the worst possible reason"
        )

    tones = [m.group("name") for m in TONE_RE.finditer(block)]
    if not tones:
        failures.append(
            "no tone read out of `TONE_SPECS` — fix this scanner before trusting a line below"
        )

    schema = json.loads(SCHEMA_PATH.read_text(encoding="utf-8"))
    prop = (schema.get("properties") or {}).get("sound_tone")
    if prop is None:
        print(
            "`sound_tone` is not published in the settings schema — delete this test or the setting"
        )
        return 1

    offered = list(prop.get("enum") or [])
    if offered != tones:
        failures.append(
            f"the form offers {offered} and the chime can ring {tones}. A tone only the form knows "
            "is picked, saved and rings the DEFAULT instead, with no error anywhere; a tone only "
            "the chime knows can never be chosen"
        )

    match = DEFAULT_TONE_RE.search(source)
    if not match:
        failures.append(f"`DEFAULT_TONE` not found in {CHIME_PATH.name}")
    elif prop.get("default") != match.group("name"):
        failures.append(
            f"the schema defaults to {prop.get('default')!r} and the chime to "
            f"{match.group('name')!r}: a hub with no settings row would hear one and be shown the other"
        )

    if failures:
        print(f"✗ sound_tone — {len(failures)} problem(s):")
        for f in failures:
            print(f"  · {f}")
        return 1

    print(
        f"✓ the {len(tones)} tones the form offers are the ones the chime rings, same default"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
