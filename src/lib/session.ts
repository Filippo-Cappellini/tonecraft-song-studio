// Sessione di pratica guidata: una routine a blocchi con un timer.
// Il piano è calcolato qui (testabile); lo stato del timer resta in sessionStorage,
// così puoi aprire un'altra pagina dell'app e tornare senza perdere il conto.

export type BlockKind = "riscaldamento" | "tecnica" | "orecchio" | "brano";
export type SessionBlock = {
  kind: BlockKind;
  title: string;
  minutes: number;
  text: string;
  /** Esercizio del catalogo da mostrare dentro il blocco. */
  exerciseId?: string;
  /** Brano da suonare (uno di quelli che stai imparando). */
  songId?: string;
  bpm?: number;
};

type ExerciseLite = { id: string; title: string; category: string; level: number; bpm: number };
type SongLite = { id: string; title: string; artist: string; bpm: number };

export const SESSION_LENGTHS = [15, 30, 45, 60] as const;

// Quota di tempo di ogni blocco: prima si scaldano le mani, poi tecnica, orecchio e repertorio.
const SHARE: Record<BlockKind, number> = { riscaldamento: 0.2, tecnica: 0.3, orecchio: 0.15, brano: 0.35 };
const WARMUP = ["Tecnica", "Rudimenti"];
const TECHNIQUE = ["Scale", "Accordi", "Ritmica", "Groove", "Lettura", "Fill", "Espressività", "Shred"];

/** Divide i minuti in parti intere che sommano esattamente al totale (metodo del resto più grande). */
export function splitMinutes(total: number, shares: number[]) {
  const raw = shares.map((s) => s * total);
  const out = raw.map(Math.floor);
  const order = raw.map((r, i) => [r - Math.floor(r), i] as const).sort((a, b) => b[0] - a[0]);
  for (let k = 0; out.reduce((a, b) => a + b, 0) < total; k++) out[order[k % order.length]![1]]! += 1;
  return out;
}

/**
 * Costruisce la sessione. `day` cambia l'esercizio scelto ogni giorno, così non è sempre lo stesso.
 * `stringed` = chitarra o basso: per l'orecchio propone anche il gioco delle note sul manico.
 */
export function buildSession(
  minutes: number,
  { exercises, songs, level, day = 0, stringed = true }: { exercises: ExerciseLite[]; songs: SongLite[]; level: number; day?: number; stringed?: boolean },
): SessionBlock[] {
  const kinds: BlockKind[] = ["riscaldamento", "tecnica", "orecchio", "brano"];
  const mins = splitMinutes(minutes, kinds.map((k) => SHARE[k]));
  const fit = exercises.filter((e) => e.level <= level);
  const pick = (cats: string[], fallback: ExerciseLite[]) => {
    const list = fit.filter((e) => cats.includes(e.category));
    const from = list.length ? list : fallback;
    return from.length ? from[day % from.length] : undefined;
  };
  const warm = pick(WARMUP, fit);
  const tech = pick(TECHNIQUE, fit.filter((e) => e.id !== warm?.id));
  const song = songs.length ? songs[day % songs.length] : undefined;

  const blocks: SessionBlock[] = [
    {
      kind: "riscaldamento", title: warm ? `Riscaldamento: ${warm.title}` : "Riscaldamento", minutes: mins[0]!,
      text: "Lento e pulito, con il metronomo. Le mani devono essere rilassate prima di andare veloce.",
      ...(warm ? { exerciseId: warm.id, bpm: warm.bpm } : {}),
    },
    {
      kind: "tecnica", title: tech ? tech.title : "Scale e accordi", minutes: mins[1]!,
      text: "Ripeti l'esercizio finché è facile, poi alza il metronomo di 5 BPM.",
      ...(tech ? { exerciseId: tech.id, bpm: tech.bpm } : {}),
    },
    {
      kind: "orecchio", title: stringed ? "Orecchio e manico" : "Allenamento dell'orecchio", minutes: mins[2]!,
      text: stringed ? "Riconosci intervalli e accordi, oppure trova le note sul manico." : "Riconosci intervalli e accordi ascoltandoli.",
    },
    song
      ? { kind: "brano", title: `${song.title} — ${song.artist}`, minutes: mins[3]!, songId: song.id, bpm: song.bpm, text: "Suona il brano che stai imparando: prima lento, poi a tempo di disco." }
      : { kind: "brano", title: "Improvvisa su una base", minutes: mins[3]!, text: "Non hai brani segnati come \"Sto imparando\": improvvisa sulla base con la scala consigliata." },
  ];
  return blocks.filter((b) => b.minutes > 0);
}

// --- Stato del timer ---
export type SessionState = {
  minutes: number;
  blocks: SessionBlock[];
  index: number;
  /** Secondi già fatti nel blocco attuale prima dell'ultima pausa. */
  doneInBlock: number;
  /** Secondi fatti nei blocchi già finiti. */
  doneBefore: number;
  /** Istante (ms) in cui è ripartito il timer; null = in pausa. */
  runningSince: number | null;
};

const KEY = "tono.sessione";

/** Secondi trascorsi nel blocco attuale. */
export const elapsedInBlock = (s: SessionState, now = Date.now()) =>
  s.doneInBlock + (s.runningSince == null ? 0 : Math.max(0, (now - s.runningSince) / 1000));

/** Minuti di pratica fatti in tutto, per il registro. */
export const practicedMinutes = (s: SessionState, now = Date.now()) => (s.doneBefore + elapsedInBlock(s, now)) / 60;

export function nextBlock(s: SessionState, now = Date.now()): SessionState {
  return { ...s, index: s.index + 1, doneBefore: s.doneBefore + elapsedInBlock(s, now), doneInBlock: 0, runningSince: s.runningSince == null ? null : now };
}

export function readSession(): SessionState | null {
  try {
    const s = JSON.parse(sessionStorage.getItem(KEY) || "null") as SessionState | null;
    return s && Array.isArray(s.blocks) && typeof s.index === "number" ? s : null;
  } catch {
    return null;
  }
}

export function writeSession(s: SessionState | null) {
  if (s) sessionStorage.setItem(KEY, JSON.stringify(s));
  else sessionStorage.removeItem(KEY);
}
