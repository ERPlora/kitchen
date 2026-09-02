// The KDS chime (kitchen#48): the line HEARS a ticket come in.
//
// «Sonido» was a toggle that moved nothing — the emblematic case of the issue. Seven of the ten
// KDS reviewed ring on a new ticket (Toast «New Ticket Sound», Square, Fresh, Simphony, Loyverse,
// Eats365, MobiPOS) and all seven do it with ONE switch, so that is what this module ships.
//
// The tone is SYNTHESISED, never a bundled asset: a module bundle runs under `script-src 'self'`
// and shipping audio would mean a data: URI in the ESM (heavy) or a fetch the CSP blocks.
//
// The hard part is not the beep, it is the browser: audio needs a user gesture, and a KDS opened
// straight on its URL has none. What this file pins:
//   · a running context gets the two tones, connected to the destination;
//   · a suspended context is resumed first, and the tones ring after the resume;
//   · a resume the browser REFUSES arms a one-shot listener so the next touch unlocks the chime
//     for the rest of the shift — instead of a screen that stays mute forever;
//   · an environment with no Web Audio at all says so (`false`) and never throws: a kitchen screen
//     must not go down because the browser has no speakers.
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { Chime } from './chime';

interface StartedTone {
  frequency: number;
  startedAt: number;
  stoppedAt: number;
  connected: boolean;
}

let tones: StartedTone[] = [];
let contexts: FakeContext[] = [];

class FakeContext {
  state: 'running' | 'suspended' = 'running';

  currentTime = 0;

  destination = { id: 'destination' };

  resumeCalls = 0;

  /** What `resume()` does: resolve and start (default), resolve but stay suspended, or reject. */
  onResume: 'run' | 'stay-suspended' | 'reject' = 'run';

  constructor() {
    contexts.push(this);
  }

  async resume() {
    this.resumeCalls += 1;
    if (this.onResume === 'reject') throw new Error('not allowed to start AudioContext');
    if (this.onResume === 'run') this.state = 'running';
  }

  createGain() {
    const gain = {
      gain: { value: 0, setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn() },
      connect: vi.fn(),
    };
    return gain;
  }

  createOscillator() {
    const tone: StartedTone = { frequency: 0, startedAt: -1, stoppedAt: -1, connected: false };
    return {
      type: 'sine',
      frequency: {
        get value() {
          return tone.frequency;
        },
        set value(hz: number) {
          tone.frequency = hz;
        },
        setValueAtTime: (hz: number) => {
          tone.frequency = hz;
        },
      },
      connect: () => {
        tone.connected = true;
      },
      start: (at: number) => {
        tone.startedAt = at;
        tones.push(tone);
      },
      stop: (at: number) => {
        tone.stoppedAt = at;
      },
    };
  }
}

beforeEach(() => {
  tones = [];
  contexts = [];
  (globalThis as Record<string, unknown>).AudioContext = FakeContext;
});

afterEach(() => {
  delete (globalThis as Record<string, unknown>).AudioContext;
  delete (globalThis as Record<string, unknown>).webkitAudioContext;
});

describe('the KDS chime', () => {
  it('rings two connected tones on a running context', async () => {
    const played = new Chime().play();
    await Promise.resolve();
    expect(played).toBe(true);
    expect(tones.length, 'the chime is two tones so it carries over a busy kitchen').toBe(2);
    expect(tones.every((t) => t.connected)).toBe(true);
    expect(tones.every((t) => t.stoppedAt > t.startedAt), 'a tone that never stops is a drone').toBe(true);
    expect(tones[1].startedAt).toBeGreaterThan(tones[0].startedAt);
  });

  it('reuses ONE audio context across tickets', async () => {
    const chime = new Chime();
    chime.play();
    chime.play();
    await Promise.resolve();
    expect(contexts.length, 'a context per ticket exhausts the browser limit in one service').toBe(1);
  });

  it('resumes a suspended context and then rings', async () => {
    const chime = new Chime();
    const played = chime.play();
    contexts[0].state = 'suspended';
    // A KDS opened straight on its URL starts suspended: the first ticket has to resume it.
    tones = [];
    chime.play();
    await Promise.resolve();
    await Promise.resolve();
    expect(played).toBe(true);
    expect(contexts[0].resumeCalls).toBe(1);
    expect(tones.length, 'the tones never rang after the resume').toBe(2);
  });

  it('arms the next touch when the browser refuses to start the audio', async () => {
    const listeners: string[] = [];
    const add = vi.spyOn(document, 'addEventListener').mockImplementation(((type: string) => {
      listeners.push(type);
    }) as never);
    try {
      const chime = new Chime();
      chime.play();
      contexts[0].state = 'suspended';
      contexts[0].onResume = 'reject';
      chime.play();
      await Promise.resolve();
      await Promise.resolve();
      expect(listeners, 'a refused resume leaves the screen mute for the whole shift').toContain('pointerdown');
    } finally {
      add.mockRestore();
    }
  });

  it('says false — and does not throw — where there is no Web Audio at all', () => {
    delete (globalThis as Record<string, unknown>).AudioContext;
    expect(new Chime().play()).toBe(false);
  });
});
