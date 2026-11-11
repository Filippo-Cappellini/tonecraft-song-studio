// Tabelle modificabili dal gestionale con l'editor generico: catalogo dell'app e anagrafiche del negozio.
// Il server accetta solo tabelle e colonne elencate qui (i nomi non arrivano mai dal browser nella query SQL).
import type { Permission } from "./staff-roles";

export type TableName =
  | "instruments"
  | "brands"
  | "models"
  | "amps"
  | "songs"
  | "tones"
  | "exercises"
  | "courses"
  | "legends"
  | "learning_paths"
  | "lessons"
  | "customers"
  | "suppliers"
  | "shops";

export type ColumnType = "text" | "long" | "int" | "bool" | "url";
export type Column = {
  name: string;
  label: string;
  type: ColumnType;
  required?: boolean;
  /** Valori ammessi (menu a tendina). */
  options?: readonly string[];
  /** Tabella a cui punta (si propongono gli id esistenti). */
  ref?: TableName;
  min?: number;
  max?: number;
  /** Mostrata nell'elenco. */
  list?: boolean;
  help?: string;
};
export type TableDef = {
  label: string;
  group: "Catalogo" | "Negozio";
  perm: Permission;
  pk: string;
  /** true: chiave uuid generata dal database; false: id testuale scelto da chi crea la riga. */
  autoPk: boolean;
  /** La chiave è l'id di una riga di un'altra tabella (es. il suono di un brano). */
  pkRef?: TableName;
  /** Colonna mostrata come nome della riga (anche nei menu delle altre tabelle). */
  title: string;
  order: string;
  columns: readonly Column[];
};

const instrument: Column = {
  name: "instrument_id",
  label: "Strumento",
  type: "text",
  required: true,
  ref: "instruments",
  list: true,
};
const sort: Column = { name: "sort", label: "Ordine", type: "int", min: 0, max: 1_000_000 };
const level = (max: number): Column => ({
  name: "level",
  label: "Livello",
  type: "int",
  required: true,
  min: 1,
  max,
  list: true,
});

export const TABLES = {
  instruments: {
    label: "Strumenti",
    group: "Catalogo",
    perm: "catalogo",
    pk: "id",
    autoPk: false,
    title: "name",
    order: "sort",
    columns: [
      { name: "name", label: "Nome", type: "text", required: true, list: true },
      { name: "tagline", label: "Sottotitolo", type: "text", required: true, list: true },
      { name: "has_amp", label: "Usa un amplificatore", type: "bool" },
      sort,
    ],
  },
  brands: {
    label: "Marche",
    group: "Catalogo",
    perm: "catalogo",
    pk: "id",
    autoPk: false,
    title: "name",
    order: "sort",
    columns: [
      instrument,
      { name: "name", label: "Nome", type: "text", required: true, list: true },
      { name: "country", label: "Paese", type: "text", required: true, list: true },
      { name: "founded", label: "Anno di fondazione", type: "int", min: 1500, max: 2100 },
      { name: "description", label: "Descrizione", type: "long", required: true },
      sort,
    ],
  },
  models: {
    label: "Modelli",
    group: "Catalogo",
    perm: "catalogo",
    pk: "id",
    autoPk: false,
    title: "name",
    order: "sort",
    columns: [
      { name: "brand_id", label: "Marca", type: "text", required: true, ref: "brands", list: true },
      {
        name: "name",
        label: "Nome",
        type: "text",
        required: true,
        list: true,
        help: "Le varianti di colore si scrivono «Modello · Colore».",
      },
      { name: "shape", label: "Forma", type: "text", required: true, list: true },
      { name: "color", label: "Colore (es. #c0392b)", type: "text", required: true },
      { name: "finish", label: "Finitura", type: "text", required: true },
      { name: "pickguard", label: "Battipenna", type: "text" },
      { name: "hardware", label: "Meccaniche", type: "text", required: true },
      { name: "pickups", label: "Pickup", type: "text", required: true },
      { name: "description", label: "Descrizione", type: "long", required: true },
      {
        name: "price_eur",
        label: "Prezzo indicativo (€)",
        type: "int",
        required: true,
        min: 0,
        max: 1_000_000,
        help: "Non mostrato nell'app.",
      },
      sort,
    ],
  },
  amps: {
    label: "Amplificatori",
    group: "Catalogo",
    perm: "catalogo",
    pk: "id",
    autoPk: false,
    title: "name",
    order: "sort",
    columns: [
      instrument,
      { name: "brand", label: "Marca", type: "text", required: true, list: true },
      { name: "name", label: "Nome", type: "text", required: true, list: true },
      { name: "kind", label: "Tipo", type: "text", required: true, list: true },
      { name: "watts", label: "Watt", type: "int", required: true, min: 0, max: 10_000 },
      { name: "description", label: "Descrizione", type: "long", required: true },
      sort,
    ],
  },
  songs: {
    label: "Brani",
    group: "Catalogo",
    perm: "catalogo",
    pk: "id",
    autoPk: false,
    title: "title",
    order: "title",
    columns: [
      instrument,
      { name: "title", label: "Titolo", type: "text", required: true, list: true },
      { name: "artist", label: "Artista", type: "text", required: true, list: true },
      { name: "album", label: "Album", type: "text", required: true },
      {
        name: "year",
        label: "Anno",
        type: "int",
        required: true,
        min: 1900,
        max: 2100,
        list: true,
      },
      { name: "genre", label: "Genere", type: "text", required: true },
      {
        name: "difficulty",
        label: "Difficoltà (1-5)",
        type: "int",
        required: true,
        min: 1,
        max: 5,
      },
      { name: "bpm", label: "BPM", type: "int", required: true, min: 20, max: 400 },
      { name: "song_key", label: "Tonalità", type: "text", required: true },
      { name: "tuning", label: "Accordatura", type: "text", required: true },
      { name: "notation", label: "Notazione / tab", type: "long" },
    ],
  },
  tones: {
    label: "Suoni dei brani",
    group: "Catalogo",
    perm: "catalogo",
    pk: "song_id",
    autoPk: false,
    pkRef: "songs",
    title: "amp",
    order: "song_id",
    columns: [
      { name: "amp", label: "Amplificatore", type: "text", required: true, list: true },
      { name: "pickup", label: "Pickup", type: "text", required: true, list: true },
      { name: "gain", label: "Gain (0-10)", type: "int", required: true, min: 0, max: 10 },
      { name: "bass", label: "Bassi (0-10)", type: "int", required: true, min: 0, max: 10 },
      { name: "mid", label: "Medi (0-10)", type: "int", required: true, min: 0, max: 10 },
      { name: "treble", label: "Alti (0-10)", type: "int", required: true, min: 0, max: 10 },
      { name: "presence", label: "Presence (0-10)", type: "int", required: true, min: 0, max: 10 },
      { name: "reverb", label: "Riverbero (0-10)", type: "int", required: true, min: 0, max: 10 },
      { name: "effects", label: "Effetti", type: "text", required: true },
      { name: "notes", label: "Note", type: "long", required: true },
    ],
  },
  exercises: {
    label: "Esercizi",
    group: "Catalogo",
    perm: "catalogo",
    pk: "id",
    autoPk: false,
    title: "title",
    order: "level",
    columns: [
      instrument,
      { name: "title", label: "Titolo", type: "text", required: true, list: true },
      { name: "category", label: "Categoria", type: "text", required: true, list: true },
      level(5),
      { name: "minutes", label: "Minuti", type: "int", required: true, min: 1, max: 240 },
      { name: "bpm", label: "BPM", type: "int", required: true, min: 20, max: 400 },
      { name: "description", label: "Descrizione", type: "long", required: true },
      { name: "steps", label: "Passaggi (separati da |)", type: "long", required: true },
      { name: "notation", label: "Notazione", type: "long" },
    ],
  },
  courses: {
    label: "Video corsi",
    group: "Catalogo",
    perm: "catalogo",
    pk: "id",
    autoPk: false,
    title: "title",
    order: "sort",
    columns: [
      instrument,
      { name: "title", label: "Titolo", type: "text", required: true, list: true },
      { name: "teacher", label: "Insegnante", type: "text", required: true, list: true },
      { name: "description", label: "Descrizione", type: "long", required: true },
      { name: "url", label: "Indirizzo (https)", type: "url", required: true },
      { name: "language", label: "Lingua", type: "text", required: true },
      level(5),
      { name: "free", label: "Gratuito", type: "bool" },
      sort,
    ],
  },
  legends: {
    label: "Leggende della musica",
    group: "Catalogo",
    perm: "catalogo",
    pk: "id",
    autoPk: false,
    title: "person",
    order: "sort",
    columns: [
      { name: "person", label: "Persona", type: "text", required: true, list: true },
      { name: "role", label: "Ruolo", type: "text", required: true, list: true },
      { name: "title", label: "Titolo", type: "text", required: true, list: true },
      { name: "fact", label: "Curiosità", type: "long", required: true },
      { name: "year", label: "Anno", type: "int", min: 1000, max: 2100 },
      sort,
    ],
  },
  learning_paths: {
    label: "Percorsi (corsi)",
    group: "Catalogo",
    perm: "catalogo",
    pk: "id",
    autoPk: false,
    title: "title",
    order: "sort",
    columns: [
      instrument,
      { name: "title", label: "Titolo", type: "text", required: true, list: true },
      { name: "subtitle", label: "Sottotitolo", type: "text", required: true },
      { name: "description", label: "Descrizione", type: "long", required: true },
      level(5),
      sort,
    ],
  },
  lessons: {
    label: "Lezioni",
    group: "Catalogo",
    perm: "catalogo",
    pk: "id",
    autoPk: false,
    title: "title",
    order: "path_id",
    columns: [
      {
        name: "path_id",
        label: "Percorso",
        type: "text",
        required: true,
        ref: "learning_paths",
        list: true,
      },
      {
        name: "sort",
        label: "Ordine nel percorso",
        type: "int",
        required: true,
        min: 0,
        max: 10_000,
        list: true,
      },
      { name: "title", label: "Titolo", type: "text", required: true, list: true },
      { name: "goal", label: "Obiettivo", type: "text", required: true },
      { name: "explanation", label: "Spiegazione (separata da |)", type: "long", required: true },
      { name: "practice", label: "Pratica (separata da |)", type: "long", required: true },
      { name: "checklist", label: "Checklist (separata da |)", type: "long", required: true },
      { name: "minutes", label: "Minuti", type: "int", required: true, min: 1, max: 240 },
      { name: "bpm", label: "BPM", type: "int", min: 20, max: 400 },
      { name: "notation", label: "Notazione", type: "long" },
      { name: "exercise_id", label: "Esercizio collegato", type: "text", ref: "exercises" },
      { name: "song_id", label: "Brano collegato", type: "text", ref: "songs" },
      {
        name: "tool",
        label: "Attrezzo",
        type: "text",
        options: ["accordatore", "accordi-chitarra", "scale", "accordi-piano", "orecchio"],
      },
      { name: "tool_note", label: "Nota dell'attrezzo (0-11)", type: "int", min: 0, max: 11 },
      { name: "tool_kind", label: "Tipo per l'attrezzo", type: "text" },
    ],
  },
  customers: {
    label: "Clienti",
    group: "Negozio",
    perm: "vendite",
    pk: "id",
    autoPk: true,
    title: "full_name",
    order: "full_name",
    columns: [
      { name: "full_name", label: "Nome e cognome", type: "text", required: true, list: true },
      { name: "email", label: "Email", type: "text", list: true },
      { name: "phone", label: "Telefono", type: "text", list: true },
      { name: "notes", label: "Note", type: "long" },
    ],
  },
  suppliers: {
    label: "Fornitori",
    group: "Negozio",
    perm: "magazzino",
    pk: "id",
    autoPk: true,
    title: "name",
    order: "name",
    columns: [
      { name: "name", label: "Ragione sociale", type: "text", required: true, list: true },
      { name: "contact", label: "Referente", type: "text", list: true },
      { name: "email", label: "Email", type: "text", list: true },
      { name: "phone", label: "Telefono", type: "text" },
      { name: "website", label: "Sito (https)", type: "url" },
      { name: "notes", label: "Note", type: "long" },
    ],
  },
  shops: {
    label: "Negozi online",
    group: "Negozio",
    perm: "admin",
    pk: "id",
    autoPk: false,
    title: "name",
    order: "sort",
    columns: [
      { name: "name", label: "Nome", type: "text", required: true, list: true },
      { name: "website", label: "Sito (https)", type: "url", required: true, list: true },
      {
        name: "search_url",
        label: "Indirizzo di ricerca",
        type: "url",
        help: "Con {q} al posto del testo cercato, es. https://www.thomann.it/search_dir.html?sw={q}. Vuoto: si apre la home.",
      },
      { name: "description", label: "Descrizione", type: "text" },
      sort,
    ],
  },
} as const satisfies Record<TableName, TableDef>;

export const TABLE_NAMES = Object.keys(TABLES) as TableName[];
export const isTableName = (v: unknown): v is TableName =>
  typeof v === "string" && Object.hasOwn(TABLES, v);
export const tableDef = (t: TableName): TableDef => TABLES[t];

/** Id testuale scelto a mano: minuscole, cifre e - _ . (come gli id esistenti del catalogo). */
export const TEXT_ID_RE = /^[a-z0-9][a-z0-9._-]{0,119}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function validId(def: TableDef, id: unknown): id is string {
  if (typeof id !== "string") return false;
  return def.autoPk ? UUID_RE.test(id) : TEXT_ID_RE.test(id);
}

export type RowValue = string | number | boolean | null;

/**
 * Controlla e converte i valori del modulo (stringhe/booleani dal browser) nei tipi delle colonne.
 * Restituisce la riga pronta per il database oppure l'elenco degli errori.
 */
export function validateRow(
  def: TableDef,
  input: Record<string, unknown>,
): { row: Record<string, RowValue>; errors: string[] } {
  const row: Record<string, RowValue> = {};
  const errors: string[] = [];
  for (const c of def.columns) {
    const raw = input[c.name];
    if (c.type === "bool") {
      row[c.name] = raw === true || raw === "true";
      continue;
    }
    // eslint-disable-next-line no-control-regex
    const s =
      typeof raw === "number"
        ? String(raw)
        : typeof raw === "string"
          ? raw.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "").trim()
          : "";
    if (!s) {
      if (c.required) errors.push(`${c.label}: obbligatorio.`);
      row[c.name] = null;
      continue;
    }
    if (c.type === "int") {
      if (!/^-?\d{1,10}$/.test(s)) {
        errors.push(`${c.label}: deve essere un numero intero.`);
        continue;
      }
      const n = Number(s);
      if ((c.min !== undefined && n < c.min) || (c.max !== undefined && n > c.max)) {
        errors.push(`${c.label}: deve stare tra ${c.min ?? "…"} e ${c.max ?? "…"}.`);
        continue;
      }
      row[c.name] = n;
      continue;
    }
    const max = c.type === "long" ? 20_000 : 500;
    if (s.length > max) {
      errors.push(`${c.label}: al massimo ${max} caratteri.`);
      continue;
    }
    if (c.type === "text" && /[\r\n]/.test(s)) {
      errors.push(`${c.label}: una sola riga.`);
      continue;
    }
    if (c.type === "url") {
      let ok = false;
      try {
        const u = new URL(s.replace("{q}", "x"));
        ok = u.protocol === "https:" && !u.username && !u.password;
      } catch {
        /* non valido */
      }
      if (!ok) {
        errors.push(`${c.label}: deve essere un indirizzo https.`);
        continue;
      }
    }
    if (c.options && !c.options.includes(s)) {
      errors.push(`${c.label}: valore non ammesso.`);
      continue;
    }
    row[c.name] = s;
  }
  return { row, errors };
}
