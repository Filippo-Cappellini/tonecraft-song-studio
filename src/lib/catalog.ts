import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import * as local from "./catalog.functions";

/**
 * Installazione su server (es. Raspberry, build con VITE_DATA_BACKEND=local): il catalogo si legge dal
 * PostgreSQL locale tramite funzioni server. Altrimenti dal browser con il client Supabase, come su Lovable.
 */
export const LOCAL_DB = import.meta.env["VITE_DATA_BACKEND"] === "local";

async function run<R extends { data: unknown; error: { message: string } | null }>(p: PromiseLike<R>): Promise<NonNullable<R["data"]>> {
  const r = await p;
  if (r.error) throw new Error(r.error.message);
  return r.data as NonNullable<R["data"]>;
}
async function runOne<R extends { data: unknown; error: { message: string } | null }>(p: PromiseLike<R>): Promise<R["data"]> {
  const r = await p;
  if (r.error) throw new Error(r.error.message);
  return r.data;
}

export const instrumentsQuery = queryOptions({
  queryKey: ["instruments"],
  queryFn: () => (LOCAL_DB ? local.localInstruments() : run(supabase.from("instruments").select("*").order("sort"))),
  staleTime: Infinity,
});

export const instrumentQuery = (id: string) =>
  queryOptions({
    queryKey: ["instrument", id],
    queryFn: async () => {
      if (LOCAL_DB) return local.localInstrument({ data: { id } });
      const [inst, brands, models, amps] = await Promise.all([
        runOne(supabase.from("instruments").select("*").eq("id", id).maybeSingle()),
        run(supabase.from("brands").select("*").eq("instrument_id", id).order("sort")),
        run(supabase.from("models").select("*, brands!inner(instrument_id)").eq("brands.instrument_id", id).order("sort")),
        run(supabase.from("amps").select("*").eq("instrument_id", id).order("sort")),
      ]);
      return { instrument: inst, brands, models, amps };
    },
    staleTime: Infinity,
  });

export const songsQuery = (instrumentId: string) =>
  queryOptions({
    queryKey: ["songs", instrumentId],
    queryFn: () =>
      LOCAL_DB ? local.localSongs({ data: { id: instrumentId } }) : run(supabase.from("songs").select("*").eq("instrument_id", instrumentId).order("title")),
    staleTime: Infinity,
  });

export const songQuery = (id: string) =>
  queryOptions({
    queryKey: ["song", id],
    queryFn: async () => {
      if (LOCAL_DB) return local.localSong({ data: { id } });
      const [song, tone] = await Promise.all([
        runOne(supabase.from("songs").select("*").eq("id", id).maybeSingle()),
        runOne(supabase.from("tones").select("*").eq("song_id", id).maybeSingle()),
      ]);
      return { song, tone };
    },
    staleTime: Infinity,
  });

export const exercisesQuery = (instrumentId: string) =>
  queryOptions({
    queryKey: ["exercises", instrumentId],
    queryFn: () =>
      LOCAL_DB
        ? local.localExercises({ data: { id: instrumentId } })
        : run(supabase.from("exercises").select("*").eq("instrument_id", instrumentId).order("level")),
    staleTime: Infinity,
  });


// Video corsi consigliati. Se la tabella non c'è ancora, la sezione resta vuota invece di dare errore.
export const coursesQuery = (instrumentId: string) =>
  queryOptions({
    queryKey: ["courses", instrumentId],
    queryFn: async () => {
      if (LOCAL_DB) return local.localCourses({ data: { id: instrumentId } });
      const r = await supabase.from("courses").select("*").eq("instrument_id", instrumentId).order("sort");
      return r.data ?? [];
    },
    staleTime: Infinity,
  });

// Curiosità sui grandi della musica. Se la tabella non c'è ancora, la sezione resta vuota.
export const legendsQuery = queryOptions({
  queryKey: ["legends"],
  queryFn: async () => {
    if (LOCAL_DB) return local.localLegends();
    const r = await supabase.from("legends").select("*").order("sort");
    return r.data ?? [];
  },
  staleTime: Infinity,
});

// Indice per la ricerca generale del sito (si carica solo quando si apre la ricerca).
export const searchIndexQuery = queryOptions({
  queryKey: ["search-index"],
  queryFn: async () => {
    const [songs, models, exercises, legends] = LOCAL_DB ? await local.localSearchIndex().then((r) => [r.songs, r.models, r.exercises, r.legends] as const) : await Promise.all([
      run(supabase.from("songs").select("id, title, artist, instrument_id").order("title")),
      run(supabase.from("models").select("id, name, brand_id, brands!inner(name, instrument_id)").order("sort")),
      run(supabase.from("exercises").select("id, title, category, instrument_id").order("level")),
      supabase.from("legends").select("id, person, title").order("sort").then((r) => r.data ?? []),
    ]);
    // Un modello per nome base: i colori dello stesso modello non si ripetono nei risultati.
    const seen = new Map<string, { key: string; name: string; brand: string; instrument: string }>();
    for (const m of models) {
      const base = m.name.split(" · ")[0]!;
      const key = `${m.brand_id}|${base}`;
      if (!seen.has(key)) seen.set(key, { key, name: base, brand: m.brands.name, instrument: m.brands.instrument_id });
    }
    return { songs, models: [...seen.values()], exercises, legends };
  },
  staleTime: Infinity,
});

// --- Corsi: percorsi a lezioni (tabelle learning_paths e lessons) ---
// Se le tabelle non ci sono ancora (migrazione non applicata), i corsi restano vuoti invece di dare errore.
export type LessonTool = "accordatore" | "accordi-chitarra" | "scale" | "accordi-piano" | "orecchio";

/** Elenchi salvati come testo separato da "|". */
export const splitList = (s: string | null | undefined) => (s ?? "").split("|").map((x) => x.trim()).filter(Boolean);

export const pathsQuery = (instrumentId: string) =>
  queryOptions({
    queryKey: ["paths", instrumentId],
    queryFn: async () => {
      const r = LOCAL_DB ? { data: await local.localPaths({ data: { id: instrumentId } }) } : await supabase
        .from("learning_paths")
        .select("*, lessons(id, sort, title, minutes)")
        .eq("instrument_id", instrumentId)
        .order("sort");
      return (r.data ?? []).map((p) => ({ ...p, lessons: [...(p.lessons ?? [])].sort((a, b) => a.sort - b.sort) }));
    },
    staleTime: Infinity,
  });

export const pathQuery = (id: string) =>
  queryOptions({
    queryKey: ["path", id],
    queryFn: async () => {
      if (LOCAL_DB) {
        const r = await local.localPath({ data: { id } });
        return { path: r.path, lessons: r.lessons, exercises: new Map(r.exercises.map((e) => [e.id, e])), songs: new Map(r.songs.map((s) => [s.id, s])) };
      }
      const [p, l] = await Promise.all([
        supabase.from("learning_paths").select("*").eq("id", id).maybeSingle(),
        supabase.from("lessons").select("*").eq("path_id", id).order("sort"),
      ]);
      const lessons = l.data ?? [];
      const exerciseIds = [...new Set(lessons.flatMap((x) => (x.exercise_id ? [x.exercise_id] : [])))];
      const songIds = [...new Set(lessons.flatMap((x) => (x.song_id ? [x.song_id] : [])))];
      const [ex, so] = await Promise.all([
        exerciseIds.length ? run(supabase.from("exercises").select("*").in("id", exerciseIds)) : Promise.resolve([]),
        songIds.length ? run(supabase.from("songs").select("id, title, artist, album, bpm").in("id", songIds)) : Promise.resolve([]),
      ]);
      return { path: p.data ?? null, lessons, exercises: new Map(ex.map((e) => [e.id, e])), songs: new Map(so.map((s) => [s.id, s])) };
    },
    staleTime: Infinity,
  });
