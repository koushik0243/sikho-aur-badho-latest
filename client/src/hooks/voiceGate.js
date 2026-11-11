'use client';

/*
 * Keeps surrounding sounds out of a learner's spoken answer.
 *
 * The browser can't tell WHO is speaking, but the learner is close to the mic,
 * so their voice is much louder than people talking nearby, a TV or traffic.
 * The learner's voice level is learned from the loudest phrases of the answer,
 * and anything well below it is treated as background:
 *
 *  • a gate mutes background sound before it is recorded, and
 *  • a phrase whose loudest moment is well below the learner's level is not
 *    sent for transcription at all.
 *
 * Browser auto-gain is off (it boosts the mic whenever the learner is silent —
 * exactly when background voices would get through). Loudness is measured on
 * the speech band only, before any boost or compression, so the difference
 * between the learner and the room is kept. The recorded audio runs slightly
 * behind the measurement, so the gate is already open for the first word.
 */

const MIC_GAIN = 2.5;            // quiet voices are amplified, then compressed (recorded path only)
const LOOKAHEAD_S = 0.15;        // recorded audio lags the measurement by this much
const HOLD_MS = 450;             // gate stays open this long after the learner's last loud moment
const GATE_OPEN_S = 0.01;        // gate fade-in / fade-out time constants
const GATE_CLOSE_S = 0.05;

const SMOOTHING = 0.35;          // level follows readings over ~60 ms, so clicks/peaks don't count
const MIN_SPEECH_RMS = 0.006;    // nothing quieter than this ever counts as speech
const FLOOR_RATIO = 3;           // speech must be this many times the room's noise floor…
const VOICE_RATIO = 0.25;        // …and at least this share (-12 dB) of the learner's voice level
const FLOOR_FALL = 0.2;          // noise floor follows quieter readings quickly…
const FLOOR_RISE = 1.002;        // …and louder ones slowly (so speech doesn't raise it)
const MAX_VOICE_RMS = 0.3;       // a shout/cough can't push the bar above every normal word
const VOICE_DECAY = 0.99988;     // per reading (~50/s): the learned level halves in ~2 min of quiet

// A phrase is the learner's only if its loudest moment reaches this share
// (-9 dB) of the learner's level; quieter phrases are background.
export const PHRASE_RATIO = 0.35;
// Before the learner's level is known, phrases wait this long (and until no
// one is mid-phrase) so the loud, close voice can be told from the room.
export const FIRST_PHRASE_WAIT_MS = 3000;

const SPEECH_BAND_LOW_HZ = 120;
const SPEECH_BAND_HIGH_HZ = 4000;

/**
 * Opens the microphone. Returns the stream to record (gated) and `measure()`,
 * which — called every few milliseconds — updates the gate and returns
 * `{ speech, level }`: whether the learner is speaking right now and the
 * current smoothed loudness. Falls back to the raw, ungated mic with
 * `measure: null` if Web Audio is unavailable.
 * @param {ReturnType<typeof createLevelTracker>} tracker shared across mic reconnects
 */
export async function openMic(tracker) {
  const raw = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: false },
  });
  const stopRaw = () => raw.getTracks().forEach(t => t.stop());
  // false once the OS takes the mic away (device switch, another app, etc.)
  const isLive = () => raw.getAudioTracks().some(t => t.readyState === 'live');
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    const ctx = new Ctx();
    const src = ctx.createMediaStreamSource(raw);

    // Measurement path: speech band only, unboosted.
    const highpass = ctx.createBiquadFilter();
    highpass.type = 'highpass';
    highpass.frequency.value = SPEECH_BAND_LOW_HZ;
    const lowpass = ctx.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.value = SPEECH_BAND_HIGH_HZ;
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 1024;
    src.connect(highpass).connect(lowpass).connect(analyser);

    // Recorded path: boosted, compressed, delayed, then gated.
    const gain = ctx.createGain();
    gain.gain.value = MIC_GAIN;
    const comp = ctx.createDynamicsCompressor();
    const delay = ctx.createDelay(1);
    delay.delayTime.value = LOOKAHEAD_S;
    const gate = ctx.createGain();
    gate.gain.value = 0;
    const dest = ctx.createMediaStreamDestination();
    src.connect(gain).connect(comp).connect(delay).connect(gate).connect(dest);

    const buf = new Float32Array(analyser.fftSize);
    let open = false;
    let lastLoudAt = -Infinity;
    const measure = () => {
      const now = Date.now();
      const reading = tracker.update(rmsOf(analyser, buf));
      if (reading.speech) lastLoudAt = now;
      const shouldOpen = now - lastLoudAt < HOLD_MS;
      if (shouldOpen !== open) {
        open = shouldOpen;
        gate.gain.setTargetAtTime(open ? 1 : 0, ctx.currentTime, open ? GATE_OPEN_S : GATE_CLOSE_S);
      }
      return reading;
    };

    return {
      stream: dest.stream, measure, ctx, isLive,
      close: () => { stopRaw(); ctx.close().catch(() => {}); },
    };
  } catch {
    return { stream: raw, measure: null, ctx: null, isLive, close: stopRaw };
  }
}

function rmsOf(analyser, buf) {
  analyser.getFloatTimeDomainData(buf);
  let sum = 0;
  for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
  return Math.sqrt(sum / buf.length);
}

/**
 * Follows the room's noise floor and the learner's voice level (taken from
 * phrases accepted as the learner's), and decides reading by reading whether
 * a sound is loud enough to be the learner speaking.
 */
export function createLevelTracker() {
  let smooth = 0;
  let floor = MIN_SPEECH_RMS;
  let voice = 0; // unknown until the first phrase is accepted
  return {
    update(rms) {
      smooth += (rms - smooth) * SMOOTHING;
      floor = smooth < floor ? floor + (smooth - floor) * FLOOR_FALL : floor * FLOOR_RISE;
      voice *= VOICE_DECAY;
      const bar = Math.max(MIN_SPEECH_RMS, floor * FLOOR_RATIO, voice * VOICE_RATIO);
      return { speech: smooth > bar, level: smooth };
    },
    learn(level) { voice = Math.max(voice, Math.min(level, MAX_VOICE_RMS)); },
    voiceLevel: () => voice,
  };
}

/**
 * Decides which phrases are the learner's. Once the learner's level is known,
 * each phrase is judged as it ends. Before that, phrases are held until it's
 * clear which voice is the loud, close one; then the quieter ones are dropped.
 * @param {ReturnType<typeof createLevelTracker>} tracker
 * @param {(phrase: { peak: number }) => void} accept called in spoken order
 */
export function createPhraseFilter(tracker, accept) {
  let held = [];
  let firstHeldAt = 0;
  return {
    add(phrase, now) {
      const voice = tracker.voiceLevel();
      if (voice > 0 && held.length === 0) {
        if (phrase.peak >= voice * PHRASE_RATIO) { tracker.learn(phrase.peak); accept(phrase); }
        return;
      }
      if (held.length === 0) firstHeldAt = now;
      held = [...held, phrase];
    },
    /** Releases held phrases once enough time has passed (or at the end). */
    settle(now, { speaking = false, final = false } = {}) {
      if (held.length === 0) return;
      if (!final && (speaking || now - firstHeldAt < FIRST_PHRASE_WAIT_MS)) return;
      const loudest = Math.max(tracker.voiceLevel(), ...held.map(p => p.peak));
      tracker.learn(loudest);
      const keep = held.filter(p => p.peak >= loudest * PHRASE_RATIO);
      held = [];
      keep.forEach(accept);
    },
    hasHeld: () => held.length > 0,
  };
}
