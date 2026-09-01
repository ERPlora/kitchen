#!/usr/bin/env python3
"""The KDS tab declares the `fullscreen` chrome control (kitchen#60).

The Web Component only ASKS for full screen; whether that request is honoured is decided by the
MANIFEST. The shell reads `navigation[].chrome` from the RAW `module.json`
(`hub/apps/web/src/lib/immersive.ts::chromeControlsFor`) and, if the entry does not declare the
control, it never writes the `chrome` attribute — the button is not painted at all and the KDS runs
forever inside a 260 px sidebar plus a topbar plus the module's own tabbar, which is the half of
kitchen#60 nobody in a kitchen can use.

That half is invisible to the vitest of the component (it mounts the element and sets the attribute
by hand), so it is pinned here, where the module gate can see it (`erplora test` picks up
`tests/**/*.test.py`).

What it holds:

  * the `display` entry declares `chrome` and it contains `fullscreen`;
  * every value is one the SHELL supports. The enum is CLOSED and grows in the shell, never in a
    manifest: an unknown control is filtered out silently there (a capability announced and never
    honoured), so a typo here is a button that never appears and no error anywhere;
  * no OTHER tab claims it. Commands, Stations and History are back-office lists read at arm's
    length; giving them the control would strand whoever taps it on a screen whose only way back —
    the shell's own chrome — has just gone away.

Usage: tests/kds_declares_fullscreen_chrome.contract.test.py   (exit 0 = green)
  No Postgres, no Docker, no hub: it reads the manifest.
"""

import json
import pathlib
import sys

MODULE_DIR = pathlib.Path(__file__).resolve().parent.parent
MANIFEST = json.loads((MODULE_DIR / "module.json").read_text(encoding="utf-8"))

#: The KDS tab — the one screen of this module that is a wall display, not a back-office list.
DISPLAY_NAV = "display"

#: Controls the Hub shell knows how to honour today (`SUPPORTED_CONTROLS` in
#: `hub/apps/web/src/lib/immersive.ts`). Anything else is dropped there without a word.
SHELL_CONTROLS = {"fullscreen"}

errors: list[str] = []


def navigation() -> list[dict]:
    return MANIFEST.get("navigation") or []


def check_display_asks_for_fullscreen() -> None:
    entry = next((n for n in navigation() if n.get("id") == DISPLAY_NAV), None)
    if entry is None:
        errors.append(
            f"there is no `{DISPLAY_NAV}` navigation entry any more: "
            f"ids={[n.get('id') for n in navigation()]}"
        )
        return
    chrome = entry.get("chrome")
    if not chrome:
        errors.append(
            f"`{DISPLAY_NAV}` declares no `chrome`: the shell never writes the attribute, the KDS "
            "never paints the control, and a kitchen wall display keeps the sidebar, the topbar "
            "and the module tabbar around it (kitchen#60)"
        )
        return
    if not isinstance(chrome, list):
        errors.append(f"`chrome` must be a list of control names, it is {chrome!r}")
        return
    if "fullscreen" not in chrome:
        errors.append(
            f"`{DISPLAY_NAV}.chrome` does not include `fullscreen`: {chrome!r}"
        )


def check_controls_are_ones_the_shell_honours() -> None:
    for entry in navigation():
        for control in entry.get("chrome") or []:
            if control not in SHELL_CONTROLS:
                errors.append(
                    f"`{entry.get('id')}.chrome` asks for `{control}`, which no shell honours "
                    f"(supported: {sorted(SHELL_CONTROLS)}). It is filtered out in silence: the "
                    "button simply never appears"
                )


def check_only_the_display_claims_it() -> None:
    others = [
        n.get("id")
        for n in navigation()
        if n.get("id") != DISPLAY_NAV and n.get("chrome")
    ]
    if others:
        errors.append(
            f"only the KDS is a wall display; these tabs also claim chrome controls: {others}. "
            "A back-office list that hides the shell leaves no way back on screen"
        )


def main() -> int:
    check_display_asks_for_fullscreen()
    check_controls_are_ones_the_shell_honours()
    check_only_the_display_claims_it()
    if errors:
        print("FAIL — kitchen#60: the KDS cannot ask for the screen it needs\n")
        for e in errors:
            print(f"  · {e}")
        return 1
    print("OK — the `display` tab declares `chrome: [fullscreen]`, and only it does")
    return 0


if __name__ == "__main__":
    sys.exit(main())
