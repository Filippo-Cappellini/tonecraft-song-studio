import { midiToFreq } from "./theory";

// Piccolo sintetizzatore nel browser per suonare note, accordi e toni di riferimento.
let ctx: AudioContext | null = null;
export function audio() {
  ctx ??= new AudioContext();
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

/** Suona una nota con un timbro morbido simile a un piano elettrico. */
export function playNote(midi: number, { at = 0, duration = 1.2, volume = 0.25 } = {}) {
  const ac = audio();
  const t = ac.currentTime + at;
  const out = ac.createGain();
  out.gain.setValueAtTime(0, t);
  out.gain.linearRampToValueAtTime(volume, t + 0.01);
  out.gain.exponentialRampToValueAtTime(volume * 0.35, t + 0.3);
  out.gain.exponentialRampToValueAtTime(0.0001, t + duration);
  out.connect(ac.destination);
  for (const [type, mult, gain] of [["triangle", 1, 1], ["sine", 2, 0.25], ["sine", 3, 0.08]] as const) {
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.type = type;
    o.frequency.value = midiToFreq(midi) * mult;
    g.gain.value = gain;
    o.connect(g).connect(out);
    o.start(t);
    o.stop(t + duration + 0.05);
  }
}

/** Accordo: note insieme (o in arpeggio se strum > 0). */
export function playChord(midis: number[], { at = 0, strum = 0.03, duration = 1.8 } = {}) {
  midis.forEach((m, i) => playNote(m, { at: at + i * strum, duration, volume: 0.6 / Math.max(3, midis.length) }));
}

/** Tono di riferimento continuo per accordare (si ferma chiamando la funzione restituita). */
export function referenceTone(midi: number) {
  const ac = audio();
  const o = ac.createOscillator();
  const g = ac.createGain();
  o.type = "sawtooth";
  o.frequency.value = midiToFreq(midi);
  const f = ac.createBiquadFilter();
  f.type = "lowpass";
  f.frequency.value = 1800;
  g.gain.setValueAtTime(0, ac.currentTime);
  g.gain.linearRampToValueAtTime(0.12, ac.currentTime + 0.05);
  o.connect(f).connect(g).connect(ac.destination);
  o.start();
  return () => {
    g.gain.setTargetAtTime(0, ac.currentTime, 0.05);
    o.stop(ac.currentTime + 0.3);
  };
}

// --- Batteria sintetizzata per la base (nessun campione audio: tutto generato nel browser) ---
let noise: AudioBuffer | null = null;
function noiseBuffer(ac: AudioContext) {
  if (noise) return noise;
  noise = ac.createBuffer(1, ac.sampleRate * 0.5, ac.sampleRate);
  const d = noise.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return noise;
}

/** Colpo di batteria all'istante `at` dell'orologio audio (secondi assoluti, non relativi). */
export function playDrum(kind: "kick" | "snare" | "hat", at: number, volume = 1) {
  const ac = audio();
  const g = ac.createGain();
  g.connect(ac.destination);
  if (kind === "kick") {
    const o = ac.createOscillator();
    o.frequency.setValueAtTime(140, at);
    o.frequency.exponentialRampToValueAtTime(45, at + 0.12);
    g.gain.setValueAtTime(0.55 * volume, at);
    g.gain.exponentialRampToValueAtTime(0.001, at + 0.3);
    o.connect(g);
    o.start(at);
    o.stop(at + 0.32);
    return;
  }
  const src = ac.createBufferSource();
  src.buffer = noiseBuffer(ac);
  const f = ac.createBiquadFilter();
  f.type = kind === "hat" ? "highpass" : "bandpass";
  f.frequency.value = kind === "hat" ? 7000 : 1800;
  const len = kind === "hat" ? 0.04 : 0.16;
  g.gain.setValueAtTime((kind === "hat" ? 0.12 : 0.3) * volume, at);
  g.gain.exponentialRampToValueAtTime(0.001, at + len);
  src.connect(f).connect(g);
  src.start(at);
  src.stop(at + len + 0.02);
}
