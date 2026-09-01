// kitchen#60 — **the KDS asks the shell for the whole screen** (ADR-0048, Nivel 1).
//
// A KDS is a tablet on a kitchen wall read from a metre away. Around it the Hub paints a 260 px
// sidebar, a topbar and the module's own tabbar (Display/Commands/Stations/History) — chrome that
// nobody in a kitchen can use and that eats the height the tickets need. Toast, Square, Fresh,
// Lightspeed, Loyverse and Simphony all run their KDS full screen.
//
// The mechanism is the one the TPV already uses, NOT new CSS fighting the shell: the shell owns the
// chrome (it hides its own and calls the Fullscreen API), the module only ASKS. Three pieces:
//
//   shell → WC   `chrome="fullscreen"`   which controls the shell honours on this tab (capability)
//   WC   → shell `erp:chrome-request`    the request, which leaves the shadow root (composed)
//   shell → WC   `fullscreen`            the state — it also changes by Esc and F11, which the
//                                        module never sees, so it is never deduced from our clicks
//
// The capability is ANNOUNCED rather than assumed because modules auto-update and the hub image
// does not: a new `kitchen` can land on a shell that does not listen. There the button would do
// nothing, and a dead button on a kitchen wall is worse than no button. The manifest half of this
// contract (the `display` entry declaring `chrome`) is pinned in
// `tests/kds_declares_fullscreen_chrome.contract.test.py` — the shell reads it from the RAW
// `module.json`, where a vitest of the Web Component cannot see it.
import { beforeEach, describe, expect, it, vi } from 'vitest';

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-08-18T12:00:00Z'));
  (globalThis as Record<string, unknown>).erplora = {
    query: async (name: string) => {
      if (name === 'kitchen.settings.get') return [{ show_timer: 1, warning_time_minutes: 15, critical_time_minutes: 30, color_coding_enabled: 1 }];
      return [];
    },
    queryPage: async () => ({ rows: [], total: 0, limit: 50, offset: 0 }),
    command: async () => ({}),
    hasPermission: () => true,
    on: () => () => {},
    locale: 'es',
    t: (_catalog: unknown, key: string, params?: Record<string, unknown>) =>
      params ? `${key}:${Object.values(params).join(',')}` : key,
  };
});

type Host = HTMLElement & { shadowRoot: ShadowRoot; updateComplete: Promise<unknown> };

/** Mounts the KDS with the chrome controls the shell says it honours (`undefined` = old shell). */
async function mount(chrome?: string): Promise<Host> {
  await import('./erp-kitchen-display');
  const el = document.createElement('erp-kitchen-display') as Host;
  if (chrome !== undefined) el.setAttribute('chrome', chrome);
  document.body.appendChild(el);
  for (let i = 0; i < 4; i++) {
    await el.updateComplete;
    await Promise.resolve();
  }
  return el;
}

const button = (el: Host) => el.shadowRoot.querySelector<HTMLElement>('[data-action="fullscreen"]');

describe('kitchen#60: the KDS offers full screen when the shell honours it', () => {
  it('paints the control in the command bar', async () => {
    const el = await mount('fullscreen');
    const fs = button(el);
    expect(fs).not.toBeNull();
    expect(el.shadowRoot.querySelector('.bar')!.contains(fs!), 'it belongs to the one bar the board has').toBe(true);
  });

  it('does NOT paint it against a shell that announces nothing', async () => {
    expect(button(await mount())).toBeNull();
  });

  it('ignores a control this screen does not offer', async () => {
    expect(button(await mount('something-else')), 'the shell announces a set; the module only reads its own').toBeNull();
  });

  it('asks the SHELL for it — composed and bubbling, or the request dies in the shadow root', async () => {
    const el = await mount('fullscreen');
    const seen: CustomEvent[] = [];
    document.addEventListener('erp:chrome-request', (e) => seen.push(e as CustomEvent));

    button(el)!.click();
    await el.updateComplete;

    expect(seen).toHaveLength(1);
    expect(seen[0].detail).toEqual({ control: 'fullscreen', action: 'toggle' });
    expect(seen[0].composed).toBe(true);
    expect(seen[0].bubbles).toBe(true);
  });

  it('offers the way OUT when the shell says it is already full screen', async () => {
    const el = await mount('fullscreen');
    expect(button(el)!.getAttribute('aria-label')).toContain('ui.fullscreen');

    // The state is the shell's, not ours: Esc and F11 also change it and the module never sees them.
    el.setAttribute('fullscreen', '');
    await el.updateComplete;
    expect(button(el)!.getAttribute('aria-label')).toContain('ui.exitFullscreen');
  });

  it('never hides the shell by itself — no chrome CSS in the module (ADR-0022)', async () => {
    const el = await mount('fullscreen');
    const css = (el.constructor as unknown as { styles: { cssText: string } | { cssText: string }[] }).styles;
    const text = Array.isArray(css) ? css.map((c) => c.cssText).join('\n') : css.cssText;
    // The module is content, not chrome: it must not reach for the shell's DOM, the viewport or the
    // Fullscreen API. Hiding the sidebar from here would break the moment the shell reshuffles it.
    expect(text).not.toMatch(/position:\s*fixed/);
    expect(text).not.toMatch(/100vh/);
  });
});
