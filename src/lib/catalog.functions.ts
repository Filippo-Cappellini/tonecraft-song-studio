import { createServerFn } from "@tanstack/react-start";
import type { Tables } from "@/integrations/supabase/types";
import { cleanText, inputFields, inputObject } from "./safe-url";
import { db } from "./server/db.server";

// Letture del catalogo dal PostgreSQL locale (installazione su server, VITE_DATA_BACKEND=local).
// Restituiscono gli stessi dati delle query Supabase in catalog.ts, così le pagine non cambiano.

const idInput = (d: unknown) => ({ id: cleanText(inputFields<"id">(d).id, 120) });

export const localInstruments = createServerFn({ method: "GET" }).handler(
  () => db()<Tables<"instruments">[]>`select * from instruments order by sort`,
);

export const localInstrument = createServerFn({ method: "GET" })
  .inputValidator(idInput)
  .handler(async ({ data: { id } }) => {
    const sql = db();
    const [inst, brands, models, amps] = await Promise.all([
      sql<Tables<"instruments">[]>`select * from instruments where id = ${id}`,
      sql<Tables<"brands">[]>`select * from brands where instrument_id = ${id} order by sort`,
      sql<(Tables<"models"> & { brands: { instrument_id: string } })[]>`
        select m.*, json_build_object('instrument_id', b.instrument_id) as brands
        from models m join brands b on b.id = m.brand_id where b.instrument_id = ${id} order by m.sort`,
      sql<Tables<"amps">[]>`select * from amps where instrument_id = ${id} order by sort`,
    ]);
    return { instrument: inst[0] ?? null, brands, models, amps };
  });

export const localSongs = createServerFn({ method: "GET" })
  .inputValidator(idInput)
  .handler(
    ({ data: { id } }) =>
      db()<Tables<"songs">[]>`select * from songs where instrument_id = ${id} order by title`,
  );

export const localSong = createServerFn({ method: "GET" })
  .inputValidator(idInput)
  .handler(async ({ data: { id } }) => {
    const sql = db();
    const [song, tone] = await Promise.all([
      sql<Tables<"songs">[]>`select * from songs where id = ${id}`,
      sql<Tables<"tones">[]>`select * from tones where song_id = ${id}`,
    ]);
    return { song: song[0] ?? null, tone: tone[0] ?? null };
  });

export const localExercises = createServerFn({ method: "GET" })
  .inputValidator(idInput)
  .handler(
    ({ data: { id } }) =>
      db()<
        Tables<"exercises">[]
      >`select * from exercises where instrument_id = ${id} order by level`,
  );

export const localCourses = createServerFn({ method: "GET" })
  .inputValidator(idInput)
  .handler(
    ({ data: { id } }) =>
      db()<Tables<"courses">[]>`select * from courses where instrument_id = ${id} order by sort`,
  );

export const localLegends = createServerFn({ method: "GET" }).handler(
  () => db()<Tables<"legends">[]>`select * from legends order by sort`,
);

export const localSearchIndex = createServerFn({ method: "GET" }).handler(async () => {
  const sql = db();
  const [songs, models, exercises, legends] = await Promise.all([
    sql<
      Pick<Tables<"songs">, "id" | "title" | "artist" | "instrument_id">[]
    >`select id, title, artist, instrument_id from songs order by title`,
    sql<
      {
        id: string;
        name: string;
        brand_id: string;
        brands: { name: string; instrument_id: string };
      }[]
    >`
      select m.id, m.name, m.brand_id, json_build_object('name', b.name, 'instrument_id', b.instrument_id) as brands
      from models m join brands b on b.id = m.brand_id order by m.sort`,
    sql<
      Pick<Tables<"exercises">, "id" | "title" | "category" | "instrument_id">[]
    >`select id, title, category, instrument_id from exercises order by level`,
    sql<
      Pick<Tables<"legends">, "id" | "person" | "title">[]
    >`select id, person, title from legends order by sort`,
  ]);
  return { songs, models, exercises, legends };
});

export const localPaths = createServerFn({ method: "GET" })
  .inputValidator(idInput)
  .handler(
    ({ data: { id } }) =>
      db()<
        (Tables<"learning_paths"> & {
          lessons: Pick<Tables<"lessons">, "id" | "sort" | "title" | "minutes">[];
        })[]
      >`
      select p.*, coalesce((select json_agg(json_build_object('id', l.id, 'sort', l.sort, 'title', l.title, 'minutes', l.minutes))
                            from lessons l where l.path_id = p.id), '[]'::json) as lessons
      from learning_paths p where p.instrument_id = ${id} order by p.sort`,
  );

export const localPath = createServerFn({ method: "GET" })
  .inputValidator(idInput)
  .handler(async ({ data: { id } }) => {
    const sql = db();
    const [path, lessons] = await Promise.all([
      sql<Tables<"learning_paths">[]>`select * from learning_paths where id = ${id}`,
      sql<Tables<"lessons">[]>`select * from lessons where path_id = ${id} order by sort`,
    ]);
    const exerciseIds = [
      ...new Set(lessons.flatMap((x) => (x.exercise_id ? [x.exercise_id] : []))),
    ];
    const songIds = [...new Set(lessons.flatMap((x) => (x.song_id ? [x.song_id] : [])))];
    const [exercises, songs] = await Promise.all([
      exerciseIds.length
        ? sql<Tables<"exercises">[]>`select * from exercises where id in ${sql(exerciseIds)}`
        : Promise.resolve([]),
      songIds.length
        ? sql<
            Pick<Tables<"songs">, "id" | "title" | "artist" | "album" | "bpm">[]
          >`select id, title, artist, album, bpm from songs where id in ${sql(songIds)}`
        : Promise.resolve([]),
    ]);
    return { path: path[0] ?? null, lessons, exercises: [...exercises], songs: [...songs] };
  });
