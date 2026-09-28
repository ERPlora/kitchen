// A board that leaves the screen stops working (kitchen#127).
//
// The KDS holds two things that outlive a render: its 1 s clock (elapsed time, semaphore) and one
// subscription per kitchen event. Both were set up AFTER the first feed was awaited, so a board
// taken off the screen while that feed was still loading — a cook who opens the KDS and switches
// screen before the hub answers — found `disconnectedCallback` with nothing to stop, and then
// started the clock and the subscriptions on a board nobody sees. From then on it repainted every
// second and reloaded (and asked to print the pass) on every kitchen event, for the rest of the
// shift. In the tests the same leak is the «erplora SDK not initialised by the shell» unhandled
// rejection of the CI of kitchen#125 (9e9c026, attempt 1): a repaint after the SDK was taken away.
//
// Deterministic on purpose — no retries, no sleeps: the first feed is HELD until the test releases
// it, and the clock is a fake one, so «a second later» is one call and not a race with the runner.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type Row = Record<string, unknown>;
type Host = HTMLElement & { updateComplete: Promise<unknown>; shadowRoot: ShadowRoot };

/** Live subscriptions per event name: +1 on `on`, −1 when its `off` runs. */
let live: Record<string, number> = {};
let held = false;
let release: () => void = () => {};
let feed: Promise<void> = Promise.resolve();

const answer = (name: string): unknown => {
  if (name === 'kitchen.settings.get') return [{ show_timer: 1, sound_enabled: 0 }];
  return [];
};

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
  live = {};
  held = false;
  feed = new Promise<void>((resolve) => {
    release = resolve;
  });
  (globalThis as Record<string, unknown>).erplora = {
    query: async (name: string) => {
      if (held) await feed;
      return answer(name);
    },
    queryPage: async () => ({ rows: [], total: 0, limit: 50, offset: 0 }),
    command: async () => ({}),
    hasPermission: () => true,
    on: (event: string) => {
      live[event] = (live[event] ?? 0) + 1;
      let off = false;
      return () => {
        if (off) return;
        off = true;
        live[event] -= 1;
      };
    },
    locale: 'es',
    t: (_catalog: unknown, key: string) => key,
  };
});

afterEach(() => {
  document.body.innerHTML = '';
  vi.useRealTimers();
  delete (globalThis as Record<string, unknown>).erplora;
});

async function flush() {
  for (let i = 0; i < 20; i++) await Promise.resolve();
}

async function place(): Promise<Host> {
  await import('./erp-kitchen-display');
  const el = document.createElement('erp-kitchen-display') as Host;
  document.body.appendChild(el);
  await flush();
  return el;
}

const held_ = () => Object.values(live).reduce((a, b) => a + b, 0);

/** Takes the SDK away and lets one tick of the clock go by: a board still ticking repaints, and
 *  its repaint asks the SDK for a label — the rejection the CI of kitchen#125 tripped on. */
async function oneSecondWithoutSdk(el: Host) {
  delete (globalThis as Record<string, unknown>).erplora;
  vi.advanceTimersByTime(1000);
  await expect(el.updateComplete, 'a board off the screen repainted after its SDK was gone').resolves.toBe(true);
}

describe('a board taken off the screen stops working (kitchen#127)', () => {
  it('stops its clock and its subscriptions when it leaves after loading', async () => {
    const el = await place();
    expect(vi.getTimerCount(), 'positive control: a board on screen runs its clock').toBe(1);
    expect(held_(), 'positive control: a board on screen listens to the kitchen').toBeGreaterThan(0);

    el.remove();
    await flush();
    expect(vi.getTimerCount(), 'the clock kept ticking on a board nobody sees').toBe(0);
    expect(live, 'a subscription survived the board').toSatisfy((m: Record<string, number>) =>
      Object.values(m).every((n) => n === 0),
    );
    await oneSecondWithoutSdk(el);
  });

  it('starts nothing when it leaves while its first feed is still loading', async () => {
    held = true;
    const el = await place();
    el.remove();
    release();
    await flush();
    await el.updateComplete;

    expect(vi.getTimerCount(), 'the clock started on a board that had already left').toBe(0);
    expect(held_(), 'the board subscribed to the kitchen after it had left').toBe(0);
    await oneSecondWithoutSdk(el);
  });

  it('holds exactly one clock and one subscription per event when moved while loading', async () => {
    held = true;
    const el = await place();
    // Moving a board in the DOM is a disconnect followed by a connect: the second must not add a
    // second clock, nor a second listener that the first one's cleanup no longer knows about.
    el.remove();
    document.body.appendChild(el);
    await flush();
    release();
    await flush();
    await el.updateComplete;

    expect(vi.getTimerCount(), 'one board, one clock').toBe(1);
    expect(Object.keys(live).length, 'positive control: the board listens to the kitchen').toBeGreaterThan(0);
    expect(live, 'one board, one listener per event').toSatisfy((m: Record<string, number>) =>
      Object.values(m).every((n) => n === 1),
    );

    el.remove();
    await flush();
    expect(vi.getTimerCount()).toBe(0);
    expect(held_(), 'the moved board left subscriptions behind').toBe(0);
  });
});
