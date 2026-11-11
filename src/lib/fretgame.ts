// Gioco delle note sul manico: logica separata dalla pagina per poterla verificare con i test.
import { pc } from "./theory";

export const FRET_LEVELS = [
  { id: "facile", name: "Facile", maxFret: 5, naturalsOnly: true, tip: "Tasti 0–5, solo note senza diesis." },
  { id: "medio", name: "Medio", maxFret: 12, naturalsOnly: true, tip: "Tutto il manico fino al 12º tasto, note senza diesis." },
  { id: "difficile", name: "Difficile", maxFret: 12, naturalsOnly: false, tip: "Tutto il manico, anche diesis e bemolli." },
] as const;
export type FretLevel = (typeof FRET_LEVELS)[number];

const NATURALS = [0, 2, 4, 5, 7, 9, 11];

/** "Trova": l'app dice nota e corda, tu tocchi il tasto. "Nomina": l'app mostra un tasto, tu dici la nota. */
export type FretQuestion = { mode: "trova" | "nomina"; string: number; note: number; fret: number };

/** Indice della corda nell'accordatura (0 = la più grave) e tasto: la nota che suona. */
export const noteAt = (tuning: number[], string: number, fret: number) => pc(tuning[string]! + fret);

/** Tutti i tasti (fino a maxFret) di una corda che suonano quella nota. */
export function fretsFor(tuning: number[], string: number, note: number, maxFret: number) {
  return Array.from({ length: maxFret + 1 }, (_, f) => f).filter((f) => noteAt(tuning, string, f) === note);
}

export function makeFretQuestion(tuning: number[], level: FretLevel, mode: FretQuestion["mode"], rand = Math.random): FretQuestion {
  // Si sceglie un tasto valido per il livello: così la risposta esiste sempre.
  for (;;) {
    const string = Math.floor(rand() * tuning.length);
    const fret = Math.floor(rand() * (level.maxFret + 1));
    const note = noteAt(tuning, string, fret);
    if (!level.naturalsOnly || NATURALS.includes(note)) return { mode, string, note, fret };
  }
}

/** Per "trova" va bene qualsiasi tasto della corda giusta con la nota giusta; per "nomina" conta la nota. */
export function checkFret(tuning: number[], q: FretQuestion, answer: { string: number; fret: number } | { note: number }) {
  if ("note" in answer) return answer.note === q.note;
  return answer.string === q.string && noteAt(tuning, answer.string, answer.fret) === q.note;
}
