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
//
// kitchen#72 adds the two things the forums actually ask for — «all I got is a small ding that is
// really hard to hear in the kitchen» (Square Community) — and that Square, Fresh KDS, Loyverse,
// Eats365 and Simphony all ship: a VOLUME and a closed list of TONES. Both synthesised, because
// nobody in the market lets you upload a file either and a module bundle runs under
// `script-src 'self'`.
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { Chime, PEAK_GAIN_AT_MAX_VOLUME, DEFAULT_VOLUME, type ChimeTone } from './chime';

interface StartedTone {
  frequency: number;
  startedAt: number;
  stoppedAt: number;
  connected: boolean;
  wave: string;
}

let tones: StartedTone[] = [];
let contexts: FakeContext[] = [];
/** Every peak the gain was ramped up to, in the order it was scheduled. */
let peaks: number[] = [];

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
      gain: {
        value: 0,
        setValueAtTime: vi.fn(),
        // The ramp UP is the volume: the ramp back down always targets the same silence floor.
        linearRampToValueAtTime: (v: number) => {
          if (v > 0.001) peaks.push(v);
        },
      },
      connect: vi.fn(),
    };
    return gain;
  }

  createOscillator() {
    const tone: StartedTone = { frequency: 0, startedAt: -1, stoppedAt: -1, connected: false, wave: '' };
    return {
      set type(wave: string) {
        tone.wave = wave;
      },
      get type() {
        return tone.wave;
      },
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
  peaks = [];
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

describe('how LOUD it rings (kitchen#72)', () => {
  it('rings exactly as it did before this setting existed, at the default volume', async () => {
    new Chime().play();
    await Promise.resolve();
    // 0.35 was the fixed `PEAK_GAIN` of kitchen#48. A hub that never touches the new control has
    // to hear the same chime it heard yesterday — the whole point of shipping a default.
    expect(peaks).toEqual([0.35, 0.35]);
    expect((DEFAULT_VOLUME / 100) * PEAK_GAIN_AT_MAX_VOLUME).toBeCloseTo(0.35, 6);
  });

  it('two volumes give two DIFFERENT gains, and louder is louder', async () => {
    new Chime().play({ volume: 100 });
    const loud = [...peaks];
    peaks = [];
    new Chime().play({ volume: 30 });
    await Promise.resolve();
    expect(loud[0], 'the whole issue is that the ding does not carry over an extractor fan').toBeGreaterThan(peaks[0]);
    expect(loud[0]).toBeCloseTo(PEAK_GAIN_AT_MAX_VOLUME, 6);
  });

  it('is silent at zero, and says it rang nothing', async () => {
    const played = new Chime().play({ volume: 0 });
    await Promise.resolve();
    expect(played, 'zero is a choice, not a broken speaker').toBe(true);
    expect(tones, 'scheduling inaudible tones is work nobody hears').toHaveLength(0);
  });

  it('clamps what is out of range and ignores what is not a number', async () => {
    new Chime().play({ volume: 999 });
    expect(peaks[0]).toBeCloseTo(PEAK_GAIN_AT_MAX_VOLUME, 6);
    peaks = [];
    new Chime().play({ volume: Number.NaN });
    expect(peaks[0], 'a broken value must fall back to the default, never to silence').toBeCloseTo(0.35, 6);
    peaks = [];
    tones = [];
    new Chime().play({ volume: -40 });
    expect(tones, 'below zero is zero, not the default').toHaveLength(0);
  });
});

describe('WHICH sound it rings (kitchen#72)', () => {
  it('keeps the two rising notes of before as the default tone', async () => {
    new Chime().play();
    await Promise.resolve();
    expect(tones.map((t) => t.frequency)).toEqual([880, 1320]);
    expect(tones.every((t) => t.wave === 'sine')).toBe(true);
  });

  it('rings other frequencies — and another waveform — for another tone', async () => {
    new Chime().play({ tone: 'buzzer' });
    await Promise.resolve();
    const buzzer = tones.map((t) => t.frequency);
    expect(buzzer, 'the tone control that changes nothing is the switch kitchen#48 retired').not.toEqual([880, 1320]);
    expect(tones.every((t) => t.wave === 'sine'), 'a buzzer that is a sine is a chime').toBe(false);

    tones = [];
    new Chime().play({ tone: 'bell' });
    await Promise.resolve();
    expect(tones.map((t) => t.frequency)).not.toEqual(buzzer);
  });

  it('falls back to the default tone when the hub holds a name this build does not know', async () => {
    new Chime().play({ tone: 'foghorn' as ChimeTone });
    await Promise.resolve();
    expect(tones.map((t) => t.frequency), 'an unknown tone must not leave the pass mute').toEqual([880, 1320]);
  });
});
