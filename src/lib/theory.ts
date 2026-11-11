// Teoria musicale di base: note, accordature, scale e accordi.
// Sono regole fisse della musica (non dati del catalogo), per questo stanno nel codice.

export const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
export const NOTE_IT = ["Do", "Do#", "Re", "Re#", "Mi", "Fa", "Fa#", "Sol", "Sol#", "La", "La#", "Si"];

export const midiToFreq = (m: number) => 440 * 2 ** ((m - 69) / 12);
export const freqToMidi = (f: number) => 69 + 12 * Math.log2(f / 440);
export const pc = (m: number) => ((Math.round(m) % 12) + 12) % 12;
export const noteLabel = (m: number) => `${NOTE_NAMES[pc(m)]}${Math.floor(Math.round(m) / 12) - 1}`;
export const noteIt = (m: number) => NOTE_IT[pc(m)]!;

// --- Accordature (note MIDI dalla corda più grave alla più acuta) ---
export type Tuning = { id: string; instrument: "chitarra" | "basso"; name: string; notes: number[] };
export const TUNINGS: Tuning[] = [
  { id: "standard", instrument: "chitarra", name: "Standard (EADGBE)", notes: [40, 45, 50, 55, 59, 64] },
  { id: "drop-d", instrument: "chitarra", name: "Drop D (DADGBE)", notes: [38, 45, 50, 55, 59, 64] },
  { id: "eb", instrument: "chitarra", name: "Mezzo tono sotto (Eb)", notes: [39, 44, 49, 54, 58, 63] },
  { id: "d-standard", instrument: "chitarra", name: "Un tono sotto (D)", notes: [38, 43, 48, 53, 57, 62] },
  { id: "open-g", instrument: "chitarra", name: "Open G (DGDGBD)", notes: [38, 43, 50, 55, 59, 62] },
  { id: "bass-standard", instrument: "basso", name: "Basso standard (EADG)", notes: [28, 33, 38, 43] },
  { id: "bass-drop-d", instrument: "basso", name: "Basso Drop D (DADG)", notes: [26, 33, 38, 43] },
  { id: "bass-eb", instrument: "basso", name: "Basso mezzo tono sotto (Eb)", notes: [27, 32, 37, 42] },
  { id: "bass-d-standard", instrument: "basso", name: "Basso un tono sotto (D)", notes: [26, 31, 36, 41] },
  { id: "bass-5", instrument: "basso", name: "Basso 5 corde (BEADG)", notes: [23, 28, 33, 38, 43] },
];

/** Accordatura adatta al testo scritto nel brano (es. "Drop D", "Mezzo tono sotto (Eb)"). */
export function tuningFor(text: string, instrument: string): string {
  const t = text.toLowerCase();
  const bass = instrument === "basso";
  if (/drop d/.test(t)) return bass ? "bass-drop-d" : "drop-d";
  if (/mezzo tono|eb/.test(t)) return bass ? "bass-eb" : "eb";
  if (/un tono sotto|\(d\)/.test(t)) return bass ? "bass-d-standard" : "d-standard";
  return bass ? "bass-standard" : "standard";
}

// --- Scale e accordi ---
export const SCALES: Record<string, { name: string; steps: number[]; tip: string }> = {
  maggiore: { name: "Maggiore", steps: [0, 2, 4, 5, 7, 9, 11], tip: "La scala più usata: suono allegro e aperto." },
  minore: { name: "Minore naturale", steps: [0, 2, 3, 5, 7, 8, 10], tip: "Suono malinconico, base di rock e metal." },
  "penta-minore": { name: "Pentatonica minore", steps: [0, 3, 5, 7, 10], tip: "Cinque note: la scala degli assoli rock e blues." },
  "penta-maggiore": { name: "Pentatonica maggiore", steps: [0, 2, 4, 7, 9], tip: "Cinque note dal suono solare, country e pop." },
  blues: { name: "Blues", steps: [0, 3, 5, 6, 7, 10], tip: "La pentatonica minore con la \"blue note\"." },
  "minore-armonica": { name: "Minore armonica", steps: [0, 2, 3, 5, 7, 8, 11], tip: "Suono esotico e neoclassico." },
  dorica: { name: "Dorica", steps: [0, 2, 3, 5, 7, 9, 10], tip: "Minore ma più luminosa: funk, jazz, Santana." },
  misolidia: { name: "Misolidia", steps: [0, 2, 4, 5, 7, 9, 10], tip: "Maggiore con la settima bassa: rock classico." },
};

export const CHORD_TYPES: Record<string, { name: string; symbol: string; steps: number[] }> = {
  maj: { name: "Maggiore", symbol: "", steps: [0, 4, 7] },
  min: { name: "Minore", symbol: "m", steps: [0, 3, 7] },
  "7": { name: "Settima", symbol: "7", steps: [0, 4, 7, 10] },
  maj7: { name: "Settima maggiore", symbol: "maj7", steps: [0, 4, 7, 11] },
  m7: { name: "Minore settima", symbol: "m7", steps: [0, 3, 7, 10] },
  sus2: { name: "Sus2", symbol: "sus2", steps: [0, 2, 7] },
  sus4: { name: "Sus4", symbol: "sus4", steps: [0, 5, 7] },
  dim: { name: "Diminuito", symbol: "dim", steps: [0, 3, 6] },
  aug: { name: "Aumentato", symbol: "aug", steps: [0, 4, 8] },
  "5": { name: "Power chord", symbol: "5", steps: [0, 7] },
};

/** Tonalità scritta nel brano ("E minore", "F# minore", "Ab maggiore") → nota e scala. */
export function parseKey(key: string): { root: number; scale: "maggiore" | "minore" } | null {
  const m = /^([A-G])([#b]?)\s+(maggiore|minore)/i.exec(key.trim());
  if (!m) return null;
  let root = NOTE_NAMES.indexOf(m[1]!.toUpperCase());
  if (m[2] === "#") root += 1;
  if (m[2] === "b") root -= 1;
  return { root: (root + 12) % 12, scale: m[3]!.toLowerCase() as "maggiore" | "minore" };
}

// --- Diagrammi degli accordi per chitarra (dalla 6ª corda, Mi grave, alla 1ª) ---
// frets: -1 = corda da non suonare, 0 = corda a vuoto. fingers: 1 indice … 4 mignolo. barre: tasto del barré.
export type ChordShape = { name: string; type: string; root: number; frets: number[]; fingers: number[]; barre?: number };
export const GUITAR_CHORDS: ChordShape[] = [
  { name: "C", type: "maj", root: 0, frets: [-1, 3, 2, 0, 1, 0], fingers: [0, 3, 2, 0, 1, 0] },
  { name: "D", type: "maj", root: 2, frets: [-1, -1, 0, 2, 3, 2], fingers: [0, 0, 0, 1, 3, 2] },
  { name: "E", type: "maj", root: 4, frets: [0, 2, 2, 1, 0, 0], fingers: [0, 2, 3, 1, 0, 0] },
  { name: "F", type: "maj", root: 5, frets: [1, 3, 3, 2, 1, 1], fingers: [1, 3, 4, 2, 1, 1], barre: 1 },
  { name: "G", type: "maj", root: 7, frets: [3, 2, 0, 0, 0, 3], fingers: [2, 1, 0, 0, 0, 3] },
  { name: "A", type: "maj", root: 9, frets: [-1, 0, 2, 2, 2, 0], fingers: [0, 0, 1, 2, 3, 0] },
  { name: "B", type: "maj", root: 11, frets: [-1, 2, 4, 4, 4, 2], fingers: [0, 1, 2, 3, 4, 1], barre: 2 },
  { name: "Cm", type: "min", root: 0, frets: [-1, 3, 5, 5, 4, 3], fingers: [0, 1, 3, 4, 2, 1], barre: 3 },
  { name: "Dm", type: "min", root: 2, frets: [-1, -1, 0, 2, 3, 1], fingers: [0, 0, 0, 2, 3, 1] },
  { name: "Em", type: "min", root: 4, frets: [0, 2, 2, 0, 0, 0], fingers: [0, 2, 3, 0, 0, 0] },
  { name: "F#m", type: "min", root: 6, frets: [2, 4, 4, 2, 2, 2], fingers: [1, 3, 4, 1, 1, 1], barre: 2 },
  { name: "Gm", type: "min", root: 7, frets: [3, 5, 5, 3, 3, 3], fingers: [1, 3, 4, 1, 1, 1], barre: 3 },
  { name: "Am", type: "min", root: 9, frets: [-1, 0, 2, 2, 1, 0], fingers: [0, 0, 2, 3, 1, 0] },
  { name: "Bm", type: "min", root: 11, frets: [-1, 2, 4, 4, 3, 2], fingers: [0, 1, 3, 4, 2, 1], barre: 2 },
  { name: "C7", type: "7", root: 0, frets: [-1, 3, 2, 3, 1, 0], fingers: [0, 3, 2, 4, 1, 0] },
  { name: "D7", type: "7", root: 2, frets: [-1, -1, 0, 2, 1, 2], fingers: [0, 0, 0, 2, 1, 3] },
  { name: "E7", type: "7", root: 4, frets: [0, 2, 0, 1, 0, 0], fingers: [0, 2, 0, 1, 0, 0] },
  { name: "G7", type: "7", root: 7, frets: [3, 2, 0, 0, 0, 1], fingers: [3, 2, 0, 0, 0, 1] },
  { name: "A7", type: "7", root: 9, frets: [-1, 0, 2, 0, 2, 0], fingers: [0, 0, 2, 0, 3, 0] },
  { name: "B7", type: "7", root: 11, frets: [-1, 2, 1, 2, 0, 2], fingers: [0, 2, 1, 3, 0, 4] },
  { name: "Cmaj7", type: "maj7", root: 0, frets: [-1, 3, 2, 0, 0, 0], fingers: [0, 3, 2, 0, 0, 0] },
  { name: "Fmaj7", type: "maj7", root: 5, frets: [-1, -1, 3, 2, 1, 0], fingers: [0, 0, 3, 2, 1, 0] },
  { name: "Amaj7", type: "maj7", root: 9, frets: [-1, 0, 2, 1, 2, 0], fingers: [0, 0, 2, 1, 3, 0] },
  { name: "Am7", type: "m7", root: 9, frets: [-1, 0, 2, 0, 1, 0], fingers: [0, 0, 2, 0, 1, 0] },
  { name: "Em7", type: "m7", root: 4, frets: [0, 2, 0, 0, 0, 0], fingers: [0, 2, 0, 0, 0, 0] },
  { name: "Dm7", type: "m7", root: 2, frets: [-1, -1, 0, 2, 1, 1], fingers: [0, 0, 0, 2, 1, 1] },
  { name: "Asus2", type: "sus2", root: 9, frets: [-1, 0, 2, 2, 0, 0], fingers: [0, 0, 1, 2, 0, 0] },
  { name: "Dsus2", type: "sus2", root: 2, frets: [-1, -1, 0, 2, 3, 0], fingers: [0, 0, 0, 1, 3, 0] },
  { name: "Asus4", type: "sus4", root: 9, frets: [-1, 0, 2, 2, 3, 0], fingers: [0, 0, 1, 2, 3, 0] },
  { name: "Dsus4", type: "sus4", root: 2, frets: [-1, -1, 0, 2, 3, 3], fingers: [0, 0, 0, 1, 3, 4] },
  { name: "E5", type: "5", root: 4, frets: [0, 2, 2, -1, -1, -1], fingers: [0, 1, 2, 0, 0, 0] },
  { name: "A5", type: "5", root: 9, frets: [-1, 0, 2, 2, -1, -1], fingers: [0, 0, 1, 2, 0, 0] },
  { name: "G5", type: "5", root: 7, frets: [3, 5, 5, -1, -1, -1], fingers: [1, 3, 4, 0, 0, 0] },
  { name: "D5", type: "5", root: 2, frets: [-1, 5, 7, 7, -1, -1], fingers: [0, 1, 3, 4, 0, 0] },
];

/** Note MIDI reali di un accordo per chitarra in accordatura standard. */
export const chordMidis = (c: ChordShape) => c.frets.flatMap((f, s) => (f < 0 ? [] : [TUNINGS[0]!.notes[s]! + f]));
