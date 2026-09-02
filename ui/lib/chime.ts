// The chime the line hears when a ticket lands on the KDS (kitchen#48).
//
// Seven of the ten KDS reviewed on 2026-09-02 ring on a new ticket (Toast «New Ticket Sound»,
// Square, Fresh KDS, Oracle Simphony, Loyverse, Eats365, MobiPOS) and every one of them does it
// with ONE switch — so `kitchen_settings.sound_enabled` is that switch, and the two toggles that
// used to sit next to it (`sound_on_new_order`, `sound_on_rush`) are gone: nobody in the market
// separates «sound» from «sound when a ticket arrives», and a per-priority beep exists only in
// Simphony, where the KDS already paints the rush pill this module paints too.
//
// SYNTHESISED, not an asset. A module bundle runs under `script-src 'self'`: an audio file would
// have to travel as a data: URI inside the ESM (weight, for a beep) or be fetched at runtime,
// which the CSP blocks. Two short tones — the thing the Square forum asks for is a chime that
// CARRIES over an extractor fan, and a single soft ding is the complaint, not the fix.

/** The subset of Web Audio this module uses. Typed here so `ui/` needs no DOM lib for audio. */
interface AudioContextLike {
  state: string;
  currentTime: number;
  destination: unknown;
  resume(): Promise<void>;
  createGain(): GainLike;
  createOscillator(): OscillatorLike;
}

interface GainLike {
  gain: { value: number; setValueAtTime(value: number, at: number): void; linearRampToValueAtTime(value: number, at: number): void };
  connect(target: unknown): void;
}

interface OscillatorLike {
  type: string;
  frequency: { value: number; setValueAtTime(value: number, at: number): void };
  connect(target: unknown): void;
  start(at: number): void;
  stop(at: number): void;
}

type AudioContextCtor = new () => AudioContextLike;

/** Seconds per note, and the gap between them. Short: a KDS rings dozens of times per service. */
const TONE_SECONDS = 0.12;
const GAP_SECONDS = 0.03;

/**
 * The tones the line can choose from (kitchen#72) — a CLOSED list, synthesised.
 *
 * Square, Fresh KDS, Loyverse, Eats365 and Simphony all offer a fixed list, and Loyverse answers
 * the «can I use my own sound» question with a flat no. That is not a limitation to work around:
 * it is what fits a module bundle under `script-src 'self'`, where an audio file would have to
 * travel as a data: URI inside the ESM or be fetched at runtime, which the CSP blocks.
 *
 * They differ in the two things that decide whether a cook hears them over an extractor fan — the
 * PITCH and the WAVEFORM. A sine is polite and gets lost; a square wave is full of harmonics and
 * cuts through, which is why the buzzer is one.
 */
const TONE_SPECS = {
  /** The rising pair this module has always rung. Default: nobody's kitchen changes sound on an
   *  update they did not ask for. */
  chime: { wave: 'sine', notes: [880, 1320] },
  /** Brighter and higher, for a line where the chime blends into the room. */
  bell: { wave: 'triangle', notes: [1568, 2349] },
  /** Low, harsh and repeated: the one that carries over a hood at full blast. */
  buzzer: { wave: 'square', notes: [330, 330] },
} as const satisfies Record<string, { wave: string; notes: readonly number[] }>;

/** A tone the settings form may hold. Mirrors the `enum` of `schemas/settings_update.json`, and
 *  `tests/chime_tones_match_the_schema.contract.test.py` fails the moment the two drift. */
export type ChimeTone = keyof typeof TONE_SPECS;

/** The names, in the order the form offers them. */
export const CHIME_TONES = Object.keys(TONE_SPECS) as ChimeTone[];

/** The tone a hub rings when it has chosen none, or has chosen one this build does not know. */
export const DEFAULT_TONE: ChimeTone = 'chime';

/**
 * Gain at volume 100 — the ceiling, not the normal level. A single sine at 0.5 has plenty of
 * headroom before clipping, and the whole point of kitchen#72 is that the line can go LOUDER than
 * the 0.35 that shipped fixed: «a small ding that is really hard to hear in the kitchen».
 */
export const PEAK_GAIN_AT_MAX_VOLUME = 0.5;

/**
 * Volume of a hub that has never touched the control. 70 × 0.5 / 100 = **0.35**, the exact gain
 * `PEAK_GAIN` rang before this setting existed: an update must not change how a kitchen sounds.
 */
export const DEFAULT_VOLUME = 70;

/** What one ring needs: how loud, and which notes. Resolved before the audio context is touched. */
interface Ring {
  peak: number;
  wave: string;
  notes: readonly number[];
}

/** How the KDS asks for a ring — the two `kitchen_settings` columns, already read by the screen. */
export interface ChimeOptions {
  /** `sound_volume`, 0–100. Out of range is clamped; not a number falls back to the default. */
  volume?: number;
  /** `sound_tone`. A name this build does not know rings the default instead of nothing. */
  tone?: ChimeTone;
}

/**
 * Turns the two settings into the ring.
 *
 * A hub can hold a value this build has never heard of — it upgrades on its own schedule and the
 * enum can grow — so neither door is allowed to end in silence: an unknown tone is the default
 * tone, and a broken volume is the default volume. **Zero, though, is a choice** and stays zero.
 */
function resolveRing(options: ChimeOptions | undefined): Ring {
  const spec = TONE_SPECS[(options?.tone ?? DEFAULT_TONE) as ChimeTone] ?? TONE_SPECS[DEFAULT_TONE];
  const asked = options?.volume;
  const volume = typeof asked === 'number' && Number.isFinite(asked) ? Math.min(100, Math.max(0, asked)) : DEFAULT_VOLUME;
  return { peak: (volume / 100) * PEAK_GAIN_AT_MAX_VOLUME, wave: spec.wave, notes: spec.notes };
}

function audioContextCtor(): AudioContextCtor | undefined {
  const scope = globalThis as { AudioContext?: AudioContextCtor; webkitAudioContext?: AudioContextCtor };
  return scope.AudioContext ?? scope.webkitAudioContext;
}

/**
 * The KDS chime. One instance per screen: it holds ONE `AudioContext`, because browsers cap how
 * many a document may open and a service can bring hundreds of tickets.
 *
 * Every path is non-fatal by design. A kitchen screen that stops showing tickets because the
 * browser would not give it a speaker is a far worse failure than a silent one.
 */
export class Chime {
  private ctx?: AudioContextLike;

  private unavailableReported = false;

  private unlockArmed = false;

  /**
   * Rings the chime, as loud and with the notes the hub asked for (kitchen#72). Returns `false`
   * when this browser exposes no Web Audio at all — the only case where no amount of retrying will
   * ever produce a sound. A volume of zero still returns `true`: silence chosen is not a failure.
   */
  play(options?: ChimeOptions): boolean {
    const ctx = this.context();
    if (!ctx) return false;
    const ring = resolveRing(options);
    if (ctx.state === 'suspended') {
      // Autoplay policy: audio needs a user gesture, and a KDS opened straight on its URL (the
      // normal way a kitchen screen boots) has none yet. Resume, then ring.
      ctx
        .resume()
        .then(() => {
          if (ctx.state === 'suspended') this.armUnlock(ctx);
          else this.ring(ctx, ring);
        })
        .catch(() => this.armUnlock(ctx));
      return true;
    }
    this.ring(ctx, ring);
    return true;
  }

  private context(): AudioContextLike | undefined {
    if (this.ctx) return this.ctx;
    const Ctor = audioContextCtor();
    if (!Ctor) {
      if (!this.unavailableReported) {
        this.unavailableReported = true;
        // Visible, once: a mute KDS is a real degradation and it has to leave a trace somewhere.
        console.warn('[kitchen] this browser has no Web Audio: the KDS cannot ring on a new ticket');
      }
      return undefined;
    }
    try {
      this.ctx = new Ctor();
      return this.ctx;
    } catch {
      if (!this.unavailableReported) {
        this.unavailableReported = true;
        console.warn('[kitchen] the browser refused an AudioContext: the KDS will stay silent');
      }
      return undefined;
    }
  }

  /**
   * The browser refused to start audio without a gesture. Instead of leaving the screen mute for
   * the whole shift, unlock it on the next touch or key — the ticket that is ringing now is lost,
   * every one after it is not.
   */
  private armUnlock(ctx: AudioContextLike) {
    if (this.unlockArmed) return;
    this.unlockArmed = true;
    const unlock = () => {
      ctx.resume().catch(() => undefined);
    };
    document.addEventListener('pointerdown', unlock, { once: true });
    document.addEventListener('keydown', unlock, { once: true });
  }

  private ring(ctx: AudioContextLike, { peak, wave, notes }: Ring) {
    // Volume zero: nothing is scheduled at all. Ramping a gain to silence on every ticket is work
    // no one can hear, and the oscillators would still run for the whole service.
    if (peak <= 0) return;
    try {
      const start = ctx.currentTime;
      notes.forEach((hz, index) => {
        const at = start + index * (TONE_SECONDS + GAP_SECONDS);
        const end = at + TONE_SECONDS;
        const gain = ctx.createGain();
        // Ramps, not a square on/off: an abrupt gain change is an audible click on every ticket.
        gain.gain.setValueAtTime(0.0001, at);
        gain.gain.linearRampToValueAtTime(peak, at + 0.01);
        gain.gain.linearRampToValueAtTime(0.0001, end);
        gain.connect(ctx.destination);

        const tone = ctx.createOscillator();
        tone.type = wave;
        tone.frequency.setValueAtTime(hz, at);
        tone.connect(gain);
        tone.start(at);
        tone.stop(end);
      });
    } catch {
      // A browser that hands out a context and then refuses to schedule on it is not worth a
      // broken screen; the warning above already recorded that this KDS may be silent.
    }
  }
}
