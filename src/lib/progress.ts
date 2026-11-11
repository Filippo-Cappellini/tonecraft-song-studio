import { useCallback, useEffect, useState } from "react";
import { readSetup, saveSetup, type Setup } from "./setup";

// I progressi dell'utente restano nel browser (localStorage), come il setup: non ci sono account.
export type Progress = {
  favorites: string[]; // brani preferiti
  learning: string[]; // brani che sto imparando
  artists: string[]; // artisti preferiti (nomi come nel catalogo), per trovare i loro concerti
  lessons: string[]; // lezioni dei corsi completate
  log: Record<string, { id: string; minutes: number }[]>; // esercizi e lezioni fatti, per giorno (AAAA-MM-GG)
  weeklyGoal?: number; // minuti di pratica a settimana che vuoi raggiungere
};

export const MIN_GOAL = 10;
export const MAX_GOAL = 1200;

const KEY = "tono.progressi";
const OLD_DONE_KEY = "tono.esercizi.fatti";
const EVT = "tono-progressi";
const empty = (): Progress => ({ favorites: [], learning: [], artists: [], lessons: [], log: {} });
const MAX_ARTISTS = 200;

export const dayKey = (d = new Date()) => {
  const z = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
};

/** Le voci di registro delle lezioni hanno questo prefisso, per non confonderle con gli esercizi. */
export const lessonLogId = (lessonId: string) => `lezione:${lessonId}`;

const strings = (v: unknown) => (Array.isArray(v) ? [...new Set(v.filter((x): x is string => typeof x === "string"))] : []);

/** Rende sicuri dati salvati da versioni vecchie, modificati a mano o rovinati: quello che non torna viene scartato. */
export function normalizeProgress(raw: unknown): Progress {
  const r = (raw && typeof raw === "object" ? raw : {}) as { favorites?: unknown; learning?: unknown; lessons?: unknown; log?: unknown; weeklyGoal?: unknown; artists?: unknown };
  const log: Progress["log"] = {};
  if (r.log && typeof r.log === "object") {
    for (const [day, list] of Object.entries(r.log as Record<string, unknown>)) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !Array.isArray(list)) continue;
      const entries = list.flatMap((e) => {
        const x = e as { id?: unknown; minutes?: unknown };
        return typeof x?.id === "string" && Number.isFinite(x.minutes) && (x.minutes as number) >= 0
          ? [{ id: x.id, minutes: Math.min(600, Math.round(x.minutes as number)) }]
          : [];
      });
      if (entries.length) log[day] = entries;
    }
  }
  const artists = strings(r.artists).map((a) => a.trim().slice(0, 100)).filter(Boolean).slice(0, MAX_ARTISTS);
  const out: Progress = { favorites: strings(r.favorites), learning: strings(r.learning), artists: [...new Set(artists)], lessons: strings(r.lessons), log };
  const g = r.weeklyGoal;
  if (typeof g === "number" && Number.isFinite(g)) out.weeklyGoal = Math.min(MAX_GOAL, Math.max(MIN_GOAL, Math.round(g)));
  return out;
}

export function readProgress(): Progress {
  try {
    const p = normalizeProgress(JSON.parse(localStorage.getItem(KEY) || "{}"));
    // Esercizi segnati con la versione precedente della pagina.
    const old = JSON.parse(localStorage.getItem(OLD_DONE_KEY) || "null") as { date?: string; ids?: string[] } | null;
    if (typeof old?.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(old.date) && !p.log[old.date]) {
      const ids = strings(old.ids);
      if (ids.length) p.log[old.date] = ids.map((id) => ({ id, minutes: 10 }));
    }
    return p;
  } catch {
    return empty();
  }
}

// --- Backup: un file con progressi e setup, per non perderli cambiando browser o telefono ---
export type Backup = { app: "tono"; version: 1; exportedAt: string; progress: Progress; setup: Setup };

export function makeBackup(progress: Progress, setup: Setup, now = new Date()): Backup {
  return { app: "tono", version: 1, exportedAt: now.toISOString(), progress, setup };
}

/** Legge un file di backup. Lancia un errore con un messaggio chiaro se il file non è valido. */
export function parseBackup(text: string): { progress: Progress; setup: Setup } {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error("Il file non è un backup di Tono.");
  }
  const b = raw as Partial<Backup> | null;
  if (!b || b.app !== "tono" || !b.progress) throw new Error("Il file non è un backup di Tono.");
  if (typeof b.version !== "number" || b.version > 1) throw new Error("Il backup viene da una versione più recente dell'app.");
  const s = (b.setup ?? {}) as Record<string, unknown>;
  const setup: Setup = {};
  for (const k of ["instrument", "brand", "model", "amp"] as const) if (typeof s[k] === "string") setup[k] = s[k] as string;
  return { progress: normalizeProgress(b.progress), setup };
}

export function exportBackup() {
  const data = makeBackup(readProgress(), readSetup());
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `tono-backup-${dayKey()}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Un backup vero pesa pochi KB: file più grandi vengono rifiutati senza leggerli. */
const MAX_BACKUP_BYTES = 1_000_000;

export async function importBackup(file: File) {
  if (file.size > MAX_BACKUP_BYTES) throw new Error("Il file è troppo grande per essere un backup di Tono.");
  const { progress, setup } = parseBackup(await file.text());
  write(progress);
  if (setup.instrument) saveSetup(setup);
  return progress;
}

function write(p: Progress) {
  localStorage.setItem(KEY, JSON.stringify(p));
  localStorage.removeItem(OLD_DONE_KEY);
  window.dispatchEvent(new Event(EVT));
}

/** Giorni consecutivi con almeno un esercizio, contando da oggi (o da ieri, se oggi non hai ancora suonato). */
export function streak(p: Progress) {
  const d = new Date();
  if (!p.log[dayKey(d)]?.length) d.setDate(d.getDate() - 1);
  let n = 0;
  while (p.log[dayKey(d)]?.length) { n++; d.setDate(d.getDate() - 1); }
  return n;
}

/** Minuti di esercizio negli ultimi 7 giorni, dal più vecchio a oggi. */
export function lastWeek(p: Progress) {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const k = dayKey(d);
    return { day: k, label: d.toLocaleDateString("it-IT", { weekday: "short" }), minutes: (p.log[k] ?? []).reduce((t, e) => t + e.minutes, 0) };
  });
}

const minutesOn = (p: Progress, k: string) => (p.log[k] ?? []).reduce((t, e) => t + e.minutes, 0);

/** Calendario delle ultime `weeks` settimane, da lunedì a domenica, con i minuti di ogni giorno (null = giorno futuro). */
export function calendar(p: Progress, weeks = 18, now = new Date()) {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7) - (weeks - 1) * 7); // lunedì di `weeks` settimane fa
  const today = dayKey(now);
  let future = false;
  return Array.from({ length: weeks }, (_, w) =>
    Array.from({ length: 7 }, (_, d) => {
      const day = new Date(start);
      day.setDate(start.getDate() + w * 7 + d);
      const k = dayKey(day);
      const res = { day: k, minutes: future ? null : minutesOn(p, k) };
      if (k === today) future = true;
      return res;
    }),
  );
}

/** Minuti per settimana (da lunedì) nelle ultime `weeks` settimane, dalla più vecchia a quella in corso. */
export function weeklyTotals(p: Progress, weeks = 8, now = new Date()) {
  return calendar(p, weeks, now).map((w) => ({ from: w[0]!.day, minutes: w.reduce((t, d) => t + (d.minutes ?? 0), 0) }));
}

/** Serie più lunga di giorni consecutivi con almeno un esercizio. */
export function bestStreak(p: Progress) {
  const days = Object.keys(p.log).filter((k) => p.log[k]!.length).sort();
  let best = 0, run = 0, prev: Date | null = null;
  for (const k of days) {
    const [y, m, d] = k.split("-").map(Number) as [number, number, number];
    const cur = new Date(y, m - 1, d);
    run = prev && Math.round((cur.getTime() - prev.getTime()) / 86_400_000) === 1 ? run + 1 : 1;
    best = Math.max(best, run);
    prev = cur;
  }
  return best;
}

/** Totali di sempre: minuti, giorni in cui hai suonato, voci di registro. */
export function totals(p: Progress) {
  const days = Object.values(p.log).filter((l) => l.length);
  return { minutes: days.reduce((t, l) => t + l.reduce((a, e) => a + e.minutes, 0), 0), activeDays: days.length };
}

export function useProgress() {
  const [p, setP] = useState<Progress>(empty);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const sync = () => setP(readProgress());
    sync();
    setReady(true);
    window.addEventListener(EVT, sync);
    window.addEventListener("storage", sync);
    return () => { window.removeEventListener(EVT, sync); window.removeEventListener("storage", sync); };
  }, []);

  const update = useCallback((fn: (p: Progress) => Progress) => write(fn(readProgress())), []);
  const toggleIn = (list: "favorites" | "learning") => (id: string) =>
    update((cur) => ({ ...cur, [list]: cur[list].includes(id) ? cur[list].filter((x) => x !== id) : [...cur[list], id] }));

  const today = dayKey();
  return {
    progress: p,
    ready,
    doneToday: (p.log[today] ?? []).map((e) => e.id),
    toggleFavorite: toggleIn("favorites"),
    toggleLearning: toggleIn("learning"),
    toggleArtist: (name: string) =>
      update((cur) => ({ ...cur, artists: cur.artists.includes(name) ? cur.artists.filter((x) => x !== name) : [...cur.artists, name].slice(0, MAX_ARTISTS) })),
    /** Segna (o toglie) una lezione come completata; le lezioni fatte oggi contano anche per la serie e i minuti. */
    toggleLesson: (id: string, minutes: number) =>
      update((cur) => {
        const done = cur.lessons.includes(id);
        const list = (cur.log[today] ?? []).filter((e) => e.id !== lessonLogId(id));
        return {
          ...cur,
          lessons: done ? cur.lessons.filter((x) => x !== id) : [...cur.lessons, id],
          log: { ...cur.log, [today]: done ? list : [...list, { id: lessonLogId(id), minutes }] },
        };
      }),
    /** Aggiunge minuti di pratica di oggi (sessione guidata, giochi, base): si sommano a una voce con lo stesso id. */
    addPractice: (id: string, minutes: number) =>
      update((cur) => {
        const m = Math.max(1, Math.min(600, Math.round(minutes)));
        const list = cur.log[today] ?? [];
        const old = list.find((e) => e.id === id);
        const next = old ? list.map((e) => (e.id === id ? { id, minutes: Math.min(600, e.minutes + m) } : e)) : [...list, { id, minutes: m }];
        return { ...cur, log: { ...cur.log, [today]: next } };
      }),
    setWeeklyGoal: (minutes: number | null) =>
      update((cur) => {
        const { weeklyGoal: _old, ...rest } = cur;
        return minutes == null ? rest : normalizeProgress({ ...rest, weeklyGoal: minutes });
      }),
    toggleExercise: (id: string, minutes: number) =>
      update((cur) => {
        const list = cur.log[today] ?? [];
        const next = list.some((e) => e.id === id) ? list.filter((e) => e.id !== id) : [...list, { id, minutes }];
        return { ...cur, log: { ...cur.log, [today]: next } };
      }),
  };
}
