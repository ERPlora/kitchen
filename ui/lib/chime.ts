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

/** The two notes, in the order they ring. A rising pair reads as «something arrived». */
const TONES = [880, 1320];

/** Seconds per note, and the gap between them. Short: a KDS rings dozens of times per service. */
const TONE_SECONDS = 0.12;
const GAP_SECONDS = 0.03;

/** Loud enough to carry, short of clipping. The forums' complaint about Square is the opposite. */
const PEAK_GAIN = 0.35;

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
   * Rings the chime. Returns `false` when this browser exposes no Web Audio at all — the only
   * case where no amount of retrying will ever produce a sound.
   */
  play(): boolean {
    const ctx = this.context();
    if (!ctx) return false;
    if (ctx.state === 'suspended') {
      // Autoplay policy: audio needs a user gesture, and a KDS opened straight on its URL (the
      // normal way a kitchen screen boots) has none yet. Resume, then ring.
      ctx
        .resume()
        .then(() => {
          if (ctx.state === 'suspended') this.armUnlock(ctx);
          else this.ring(ctx);
        })
        .catch(() => this.armUnlock(ctx));
      return true;
    }
    this.ring(ctx);
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

  private ring(ctx: AudioContextLike) {
    try {
      const start = ctx.currentTime;
      TONES.forEach((hz, index) => {
        const at = start + index * (TONE_SECONDS + GAP_SECONDS);
        const end = at + TONE_SECONDS;
        const gain = ctx.createGain();
        // Ramps, not a square on/off: an abrupt gain change is an audible click on every ticket.
        gain.gain.setValueAtTime(0.0001, at);
        gain.gain.linearRampToValueAtTime(PEAK_GAIN, at + 0.01);
        gain.gain.linearRampToValueAtTime(0.0001, end);
        gain.connect(ctx.destination);

        const tone = ctx.createOscillator();
        tone.type = 'sine';
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
