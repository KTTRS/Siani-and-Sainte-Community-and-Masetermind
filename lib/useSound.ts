const STORAGE_KEY = 'sainte_sound';

let _ctx: AudioContext | null = null;
function ctx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (_ctx) return _ctx;
  const w = window as unknown as {
    AudioContext?: typeof AudioContext;
    webkitAudioContext?: typeof AudioContext;
  };
  const AC = w.AudioContext || w.webkitAudioContext;
  if (!AC) return null;
  try { _ctx = new AC(); } catch { _ctx = null; }
  return _ctx;
}

export function isSoundEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  try { return localStorage.getItem(STORAGE_KEY) === 'on'; } catch { return false; }
}

export function setSoundEnabled(on: boolean): void {
  if (typeof window === 'undefined') return;
  try { localStorage.setItem(STORAGE_KEY, on ? 'on' : 'off'); } catch {}
  if (on) {
    // Try to unlock right inside the user gesture that flipped the toggle,
    // so subsequent cues (including the one-per-session arrival) actually
    // get a running context.
    const ac = ctx();
    if (ac) void ensureRunning(ac);
  }
}

function canPlay(): boolean {
  if (typeof document === 'undefined') return false;
  if (document.visibilityState && document.visibilityState !== 'visible') return false;
  // Honor reduced-motion preference — Direction D mil-spec sounds are paired
  // with motion cues, so suppressing motion implies suppressing the sound layer.
  if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
    try {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
    } catch {}
  }
  return true;
}

async function ensureRunning(ac: AudioContext): Promise<boolean> {
  if (ac.state === 'running') return true;
  if (ac.state === 'closed') return false;
  try {
    const p: PromiseLike<void> | void = ac.resume();
    if (p && typeof (p as PromiseLike<void>).then === 'function') {
      await p;
    }
  } catch {
    return false;
  }
  return (ac.state as AudioContextState) === 'running';
}

function emitTone(ac: AudioContext, freq: number, durMs: number, type: OscillatorType, gain: number, offsetMs = 0) {
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  g.gain.value = 0;
  osc.connect(g).connect(ac.destination);
  const start = ac.currentTime + offsetMs / 1000;
  const d = durMs / 1000;
  g.gain.setValueAtTime(0, start);
  g.gain.linearRampToValueAtTime(gain, start + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, start + d);
  osc.start(start);
  osc.stop(start + d + 0.02);
}

/**
 * Internal: play a sequence of (freq, dur, type, gain, offsetMs) tones.
 * Returns true if audio was actually emitted, false if it was skipped
 * (sound off, tab hidden, no AudioContext, or unlock failed). Callers
 * that need "did it actually play?" semantics — e.g. once-per-session
 * markers — must respect the return value.
 */
async function play(notes: Array<[number, number, OscillatorType, number, number?]>): Promise<boolean> {
  if (!isSoundEnabled()) return false;
  if (!canPlay()) return false;
  const ac = ctx();
  if (!ac) return false;
  const ok = await ensureRunning(ac);
  if (!ok) return false;
  if (!canPlay()) return false; // visibility may have changed during await
  for (const [f, d, t, g, off] of notes) emitTone(ac, f, d, t, g, off ?? 0);
  return true;
}

export function playTick(): Promise<boolean> {
  return play([[2400, 40, 'square', 0.04]]);
}

export function playChime(): Promise<boolean> {
  // A5 then E6, scheduled on the AudioContext clock so both notes fire
  // even if the browser tabs out between them.
  return play([
    [880, 180, 'sine', 0.05, 0],
    [1318.5, 220, 'sine', 0.05, 90],
  ]);
}

// Soft, low arrival tone for Home — quieter than the chime, single note.
export function playArrival(): Promise<boolean> {
  return play([[523.25, 260, 'sine', 0.035]]);
}

/* =====================================================
   DIRECTION D — TACTICAL MIL-SPEC SOUND LAYER
   Mono synthesized cues. No samples. No music. Ducks under voice.
   Wired with the same global toggle as the rest of the sound layer.
   ===================================================== */

/** tap — 880Hz @ -36dB. Pair with haptic.tap. */
export function playTap(): Promise<boolean> {
  return play([[880, 60, 'square', 0.025]]);
}
/** soft (ack) — 1240Hz blip @ -34dB. Pair with haptic.soft. */
export function playSoft(): Promise<boolean> {
  return play([[1240, 70, 'sine', 0.028]]);
}
/** click (drop-open noise sweep) — @ -22dB. Pair with haptic.click. */
export function playClick(): Promise<boolean> {
  return play([
    [320, 50, 'square', 0.05, 0],
    [180, 90, 'sawtooth', 0.04, 30],
  ]);
}
/** commit — 440 → 660Hz @ -28dB. Pair with haptic.success. */
export function playCommit(): Promise<boolean> {
  return play([
    [440, 110, 'triangle', 0.04, 0],
    [660, 140, 'triangle', 0.045, 80],
  ]);
}
/** signal-in — 2 blips @ -24dB. Pair with haptic.rise. */
export function playSignalIn(): Promise<boolean> {
  return play([
    [1480, 60, 'sine', 0.05, 0],
    [1760, 60, 'sine', 0.05, 110],
  ]);
}
/** drop — synonym for click. */
export function playDrop(): Promise<boolean> { return playClick(); }
/** success — synonym for commit. */
export function playSuccess(): Promise<boolean> { return playCommit(); }
/** warn — descending two-tone @ -28dB. */
export function playWarn(): Promise<boolean> {
  return play([
    [620, 90, 'square', 0.045, 0],
    [440, 120, 'square', 0.045, 80],
  ]);
}
/** rise — synonym for signal-in. */
export function playRise(): Promise<boolean> { return playSignalIn(); }
/** siani-listen — sub-60Hz hum @ -42dB, very quiet ambient cue. */
export function playSianiListen(): Promise<boolean> {
  return play([[55, 240, 'sine', 0.012]]);
}

export function useSound() {
  return {
    isSoundEnabled,
    setSoundEnabled,
    playTick,
    playChime,
    playArrival,
    // Direction D mil-spec set
    playTap,
    playSoft,
    playClick,
    playCommit,
    playSignalIn,
    playDrop,
    playSuccess,
    playWarn,
    playRise,
    playSianiListen,
  };
}
