#!/usr/bin/env python3
"""Every option of a closed setting is shown by its name, never by its stored value (kitchen#159).

The hub paints Kitchen → Settings with its generic form: a property with an `enum` in
`schemas/settings_update.json` becomes an `ion-select`, and each option's text is looked up in the
module's own `locales/<lang>.json` under `settings.fields.<key>.options.<value>` (HUB_SHELL-F43).
When that key is missing the shell paints the RAW value — so the person configuring the kitchen
read `chime` and `dine_in`, in English, and the tone's own description talked about «campanilla,
timbre o zumbador», which matched nothing on the screen.

The stored value is a contract (the KDS, the runtime validation and every saved row read it), so
the fix is never the value: it is a label, in `en` (source) and in `es`, for every value the
schema offers. A new enum value or a new closed setting without its labels fails here.

The order type has a second, older family of labels — `ui.orderType_<value>`, the ones the KDS and
the orders table paint (`ui/lib/enums.ts`). Two lists for one thing is the drift this module keeps
producing (kitchen#34, #36, #39), so the settings form must say exactly what the rest of the module
says for the same value.
"""

import json
import pathlib
import sys

MODULE_DIR = pathlib.Path(__file__).resolve().parent.parent
SCHEMA_PATH = MODULE_DIR / "schemas" / "settings_update.json"
LOCALES = ("en", "es")

#: setting key → the `ui.*` key prefix the rest of the module already paints that value with.
SAME_LABEL_AS = {"default_order_type": "orderType_"}

failures: list[str] = []


def main() -> int:
    schema = json.loads(SCHEMA_PATH.read_text(encoding="utf-8"))
    closed = {
        key: list(prop["enum"])
        for key, prop in (schema.get("properties") or {}).items()
        if prop.get("enum")
    }
    if not closed:
        print(
            "no setting with an `enum` in the schema — this guard would pass on nothing"
        )
        return 1

    checked = 0
    for lang in LOCALES:
        locale = json.loads(
            (MODULE_DIR / "locales" / f"{lang}.json").read_text(encoding="utf-8")
        )
        fields = (locale.get("settings") or {}).get("fields") or {}
        ui = locale.get("ui") or {}
        for key, values in closed.items():
            options = (fields.get(key) or {}).get("options") or {}
            for value in values:
                label = options.get(value)
                checked += 1
                if not isinstance(label, str) or not label.strip():
                    failures.append(
                        f"{lang}: settings.fields.{key}.options.{value} is missing — the form "
                        f"shows the raw value `{value}`"
                    )
                    continue
                prefix = SAME_LABEL_AS.get(key)
                if prefix and label != ui.get(f"{prefix}{value}"):
                    failures.append(
                        f"{lang}: settings.fields.{key}.options.{value} says {label!r} and "
                        f"ui.{prefix}{value} says {ui.get(f'{prefix}{value}')!r} — the form and "
                        "the kitchen screen name the same value differently"
                    )
            stray = sorted(set(options) - set(values))
            if stray:
                failures.append(
                    f"{lang}: settings.fields.{key}.options names {stray}, which the schema "
                    "does not offer"
                )

    if failures:
        print(f"✗ settings options — {len(failures)} problem(s):")
        for f in failures:
            print(f"  · {f}")
        return 1

    print(
        f"✓ {checked} options of {len(closed)} closed settings have a name in {'/'.join(LOCALES)}"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
