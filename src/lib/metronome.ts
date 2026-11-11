// Calcoli del metronomo, separati dal suono per poterli verificare con i test.

/** Evento lanciato quando un metronomo parte: l'anteprima del brano si mette in pausa per non coprirlo. */
export const METRONOME_START = "tono-metronomo-avvio";

export const MIN_BPM = 30;
export const MAX_BPM = 250;

export const clampBpm = (bpm: number) => Math.min(MAX_BPM, Math.max(MIN_BPM, Math.round(bpm)));

/** Tempi disponibili: battiti per battuta e quali battiti hanno l'accento. */
export const METERS = [
  { id: "2/4", beats: 2, accents: [0] },
  { id: "3/4", beats: 3, accents: [0] },
  { id: "4/4", beats: 4, accents: [0] },
  { id: "6/8", beats: 6, accents: [0, 3] },
] as const;
export type Meter = (typeof METERS)[number];

/** 2 = battito forte (inizio battuta), 1 = accento secondario, 0 = battito normale. */
export function beatStrength(meter: Meter, beat: number): 0 | 1 | 2 {
  if (beat === 0) return 2;
  return (meter.accents as readonly number[]).includes(beat) ? 1 : 0;
}

/**
 * Tap tempo: dai momenti dei tocchi (in millisecondi) ricava i BPM.
 * Usa solo gli ultimi tocchi ravvicinati: una pausa di più di 2 secondi ricomincia il conteggio.
 */
export function bpmFromTaps(times: number[]): number | null {
  const recent: number[] = [];
  for (let i = times.length - 1; i >= 0 && recent.length < 6; i--) {
    if (recent.length && recent[0]! - times[i]! > 2000) break;
    recent.unshift(times[i]!);
  }
  if (recent.length < 2) return null;
  const avg = (recent.at(-1)! - recent[0]!) / (recent.length - 1);
  return avg > 0 ? clampBpm(60000 / avg) : null;
}

/** Allenamento di velocità: obiettivo e BPM di partenza (70% dell'obiettivo). */
export function trainerPlan(initialBpm: number, target?: number) {
  const goal = clampBpm(target ?? initialBpm + 40);
  return { goal, start: clampBpm(goal * 0.7) };
}

/** BPM dopo una battuta completa: sale di `step` ogni `everyBars` battute, senza superare l'obiettivo. */
export function trainerNext(bpm: number, bar: number, goal: number, { step = 5, everyBars = 4 } = {}) {
  if (bar === 0 || bar % everyBars !== 0) return bpm;
  return Math.min(goal, bpm + step);
}
