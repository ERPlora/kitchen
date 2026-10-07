// kitchen#164 — **the kitchen screen opens without an error and its empty board says so.**
//
// Two independent faults met on the same screen, so both are pinned here:
//
// 1. The shell writes the chrome capability as an ATTRIBUTE and, on a tab that announces nothing,
//    REMOVES it (`hub/apps/web/src/lib/immersive.ts`: `wc.removeAttribute('chrome')`). Lit turns a
//    removed attribute into `null`, not into the `''` the property was declared with, and the
//    board read it as a string: «Cannot read properties of null (reading 'split')» on every
//    render, three times while the screen opened.
// 2. The empty board handed its sentence to `ok-empty-state` as `.title`, a property that
//    component does not have (it paints `heading` and `message`): the wall showed the cutlery icon
//    and no words. These tests read what `ok-empty-state` PAINTS in its own shadow root — the
//    OutfitKit the gate installs — so a renamed prop breaks them, not just a typo here.
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

type Host = HTMLElement & {
  shadowRoot: ShadowRoot;
  updateComplete: Promise<unknown>;
  mode: 'tickets' | 'ready' | 'allday';
  chrome: string | null;
};

async function settle(el: Host): Promise<void> {
  for (let i = 0; i < 4; i++) {
    await el.updateComplete;
    await Promise.resolve();
  }
}

async function mount(prepare?: (el: Host) => void): Promise<Host> {
  await import('./erp-kitchen-display');
  const el = document.createElement('erp-kitchen-display') as Host;
  prepare?.(el);
  document.body.appendChild(el);
  await settle(el);
  return el;
}

/** The words the empty state actually paints, read inside `ok-empty-state`'s own shadow root. */
async function emptyText(el: Host): Promise<string> {
  const empty = el.shadowRoot.querySelector('[data-testid="kds-empty"]') as (HTMLElement & { updateComplete?: Promise<unknown> }) | null;
  expect(empty, 'the board is empty, so the empty state is there').not.toBeNull();
  await empty!.updateComplete;
  return (empty!.shadowRoot?.textContent ?? '').replace(/\s+/g, ' ').trim();
}

describe('kitchen#164: the screen opens clean when the shell withdraws the chrome attribute', () => {
  it('a shell that REMOVES `chrome` (Lit hands the property null) still paints the board', async () => {
    const el = await mount((e) => e.setAttribute('chrome', 'fullscreen'));
    el.removeAttribute('chrome');
    expect(el.chrome, 'this is the value the shell really leaves behind').toBeNull();

    await expect(settle(el)).resolves.toBeUndefined();
    expect(el.shadowRoot.querySelector('[data-action="fullscreen"]'), 'nothing announced, nothing offered').toBeNull();
    expect(await emptyText(el)).toContain('ui.emptyDisplay');
  });

  it('a property set to null before the first paint does not break the first render either', async () => {
    const el = await mount((e) => {
      e.chrome = null;
    });
    expect(el.shadowRoot.querySelector('.bar'), 'the first render committed').not.toBeNull();
    expect(el.shadowRoot.querySelector('[data-action="fullscreen"]')).toBeNull();
  });
});

describe('kitchen#164: the empty board says why it is empty, in every view', () => {
  for (const [mode, key] of [
    ['tickets', 'ui.emptyDisplay'],
    ['ready', 'ui.emptyReady'],
    ['allday', 'ui.emptyAllDay'],
  ] as const) {
    it(`${mode}: «${key}» is painted, not just the icon`, async () => {
      const el = await mount();
      el.mode = mode;
      await settle(el);
      expect(await emptyText(el)).toContain(key);
    });
  }
});
