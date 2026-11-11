// Base per improvvisare: giri di accordi generici (non di brani precisi) costruiti in qualsiasi tonalità.
// Sono regole della musica, come il resto della teoria: stanno nel codice, non nel database.
import { CHORD_TYPES, NOTE_NAMES, pc } from "./theory";

export type JamChord = { offset: number; type: keyof typeof CHORD_TYPES & string };
export type Progression = {
  id: string;
  name: string;
  /** Gradi scritti come li scrivono i musicisti (I, IV, vi…), solo da leggere. */
  degrees: string;
  /** Un accordo per battuta. */
  bars: JamChord[];
  /** Scala consigliata per improvvisare (id di SCALES in theory.ts). */
  scale: string;
  tip: string;
};

const c = (offset: number, type: JamChord["type"]): JamChord => ({ offset, type });

export const PROGRESSIONS: Progression[] = [
  { id: "pop", name: "Pop", degrees: "I – V – vi – IV", bars: [c(0, "maj"), c(7, "maj"), c(9, "min"), c(5, "maj")], scale: "penta-maggiore", tip: "Il giro più usato nel pop. Insisti sulle note dell'accordo quando cambia." },
  { id: "anni50", name: "Anni '50", degrees: "I – vi – IV – V", bars: [c(0, "maj"), c(9, "min"), c(5, "maj"), c(7, "maj")], scale: "maggiore", tip: "Suono dolce e nostalgico: melodie semplici e note lunghe." },
  { id: "blues", name: "Blues in 12 battute", degrees: "I7 ×4 – IV7 ×2 – I7 ×2 – V7 – IV7 – I7 – V7", bars: [c(0, "7"), c(0, "7"), c(0, "7"), c(0, "7"), c(5, "7"), c(5, "7"), c(0, "7"), c(0, "7"), c(7, "7"), c(5, "7"), c(0, "7"), c(7, "7")], scale: "blues", tip: "La scala blues va bene su tutti e tre gli accordi. Prova a ripetere una frase e poi a risponderle." },
  { id: "rock-minore", name: "Rock minore", degrees: "i – VII – VI – VII", bars: [c(0, "min"), c(10, "maj"), c(8, "maj"), c(10, "maj")], scale: "penta-minore", tip: "La pentatonica minore è la scelta sicura. Fai dei bending sulla quarta e sulla settima." },
  { id: "epico", name: "Epico", degrees: "i – VI – III – VII", bars: [c(0, "min"), c(8, "maj"), c(3, "maj"), c(10, "maj")], scale: "minore", tip: "Suono cinematografico: usa la minore naturale e lascia respirare le note." },
  { id: "minore-armonica", name: "Minore con la dominante", degrees: "i – iv – V7 – i", bars: [c(0, "min"), c(5, "min"), c(7, "7"), c(0, "min")], scale: "minore-armonica", tip: "Sul V7 la minore armonica dà quel suono neoclassico: la settima alzata vuole tornare alla tonica." },
  { id: "jazz", name: "Jazz ii – V – I", degrees: "ii7 – V7 – Imaj7 – Imaj7", bars: [c(2, "m7"), c(7, "7"), c(0, "maj7"), c(0, "maj7")], scale: "maggiore", tip: "Il giro base del jazz. Prova a puntare la terza di ogni accordo." },
  { id: "funk", name: "Funk dorico", degrees: "i7 – IV7", bars: [c(0, "m7"), c(5, "7")], scale: "dorica", tip: "Due accordi e tanto ritmo: frasi corte e staccate, la sesta maggiore della dorica fa il colore." },
  { id: "misolidio", name: "Rock classico", degrees: "I – ♭VII – IV – I", bars: [c(0, "maj"), c(10, "maj"), c(5, "maj"), c(0, "maj")], scale: "misolidia", tip: "La misolidia ha la settima bassa: suono da rock anni '70." },
];

/** Nome dell'accordo (es. "Am", "G7", "Cmaj7") in una tonalità. */
export function chordName(key: number, ch: JamChord) {
  return `${NOTE_NAMES[pc(key + ch.offset)]}${CHORD_TYPES[ch.type]!.symbol}`;
}

/** Note MIDI dell'accordo in una posizione media (fondamentale tra Do3 e Si3). */
export function chordVoicing(key: number, ch: JamChord) {
  const root = 48 + pc(key + ch.offset);
  return CHORD_TYPES[ch.type]!.steps.map((s) => root + s);
}

/** Nota del basso (fondamentale tra Do2 e Si2). */
export const bassNote = (key: number, ch: JamChord) => 36 + pc(key + ch.offset);

/** Quale accordo suona a un certo battito (4 battiti per battuta), in loop. */
export function chordAt(p: Progression, beat: number) {
  const bar = Math.floor(beat / 4) % p.bars.length;
  return { bar, beatInBar: beat % 4, chord: p.bars[bar]! };
}
