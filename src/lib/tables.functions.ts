import { createServerFn } from "@tanstack/react-start";
import { cleanText, inputFields, inputObject } from "./safe-url";
import {
  isTableName,
  TABLE_NAMES,
  tableDef,
  validateRow,
  validId,
  type RowValue,
  type TableName,
} from "./admin-tables";
import type { Shop } from "./shop";
import { db, dbErrorMessage } from "./server/db.server";
import { audit, requireStaff } from "./server/auth.server";

// Editor generico del gestionale: elenco, modifica ed eliminazione delle righe delle tabelle in admin-tables.ts.
// Nomi di tabelle e colonne vengono solo dall'elenco fisso, i valori passano sempre come parametri.

const PAGE = 50;

function readTable(o: { readonly table?: unknown }): TableName {
  if (!isTableName(o.table)) throw new Error("Tabella non valida.");
  return o.table;
}
const likePattern = (q: string) => `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

export type RowsPage = {
  rows: Record<string, RowValue>[];
  total: number;
  offset: number;
  pageSize: number;
};

export const listTableRows = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => {
    const o = inputFields<"offset" | "q" | "table">(d);
    const offset = Number(o.offset);
    return {
      table: readTable(o),
      q: cleanText(o.q, 100),
      offset: Number.isInteger(offset) && offset >= 0 ? Math.min(offset, 1_000_000) : 0,
    };
  })
  .handler(async ({ data }): Promise<RowsPage> => {
    const def = tableDef(data.table);
    await requireStaff("vedere");
    const sql = db();
    const cols = [def.pk, ...def.columns.map((c) => c.name)];
    const searchable = [
      def.pk,
      ...def.columns.filter((c) => c.type !== "int" && c.type !== "bool").map((c) => c.name),
    ];
    const where = data.q
      ? sql`where ${searchable.map((c) => sql`${sql(c)}::text ilike ${likePattern(data.q)}`).reduce((a, b) => sql`${a} or ${b}`)}`
      : sql``;
    const [rows, [count]] = await Promise.all([
      sql<Record<string, RowValue>[]>`
        select ${sql(cols)} from ${sql(data.table)} ${where}
        order by ${sql(def.order)}, ${sql(def.pk)} limit ${PAGE} offset ${data.offset}`,
      sql<{ n: number }[]>`select count(*)::int as n from ${sql(data.table)} ${where}`,
    ]);
    return {
      rows: rows.map((r) => ({ ...r, [def.pk]: String(r[def.pk]) })),
      total: count?.n ?? 0,
      offset: data.offset,
      pageSize: PAGE,
    };
  });

/** Id e nome delle righe di una tabella, per proporre i valori dei campi collegati. */
export const tableOptions = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => ({ table: readTable(inputFields<"table">(d)) }))
  .handler(async ({ data }) => {
    const def = tableDef(data.table);
    await requireStaff("vedere");
    const sql = db();
    return sql<{ id: string; label: string }[]>`
      select ${sql(def.pk)}::text as id, ${sql(def.title)}::text as label from ${sql(data.table)}
      order by ${sql(def.title)} limit 5000`;
  });

export const saveTableRow = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => {
    const o = inputFields<"id" | "newId" | "values" | "table">(d);
    return {
      table: readTable(o),
      /** Id della riga da modificare; null per una riga nuova. */
      id: typeof o.id === "string" ? o.id : null,
      newId: typeof o.newId === "string" ? o.newId.trim() : "",
      values: inputObject(o.values),
    };
  })
  .handler(
    async ({ data }): Promise<{ ok: true; id: string } | { ok: false; errors: string[] }> => {
      const def = tableDef(data.table);
      const me = await requireStaff(def.perm);
      const { row, errors } = validateRow(def, data.values);
      if (data.id !== null && !validId(def, data.id)) errors.push("Id non valido.");
      if (data.id === null && !def.autoPk && !validId(def, data.newId))
        errors.push("Id: minuscole, cifre e - _ . (massimo 120 caratteri).");
      if (errors.length) return { ok: false, errors };
      const sql = db();
      const cols = def.columns.map((c) => c.name);
      try {
        let id: string;
        if (data.id !== null) {
          const res =
            await sql`update ${sql(data.table)} set ${sql(row, cols)} where ${sql(def.pk)} = ${data.id}`;
          if (!res.count) return { ok: false, errors: ["La riga non esiste più."] };
          id = data.id;
        } else {
          const values = def.autoPk ? row : { ...row, [def.pk]: data.newId };
          const [created] = await sql<{ id: string }[]>`
          insert into ${sql(data.table)} ${sql(values, def.autoPk ? cols : [def.pk, ...cols])} returning ${sql(def.pk)}::text as id`;
          id = created!.id;
        }
        await audit(me, data.id ? "modifica" : "nuova riga", data.table, id);
        return { ok: true, id };
      } catch (e) {
        return { ok: false, errors: [dbErrorMessage(e)] };
      }
    },
  );

export const deleteTableRow = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => {
    const o = inputFields<"id" | "table">(d);
    return { table: readTable(o), id: typeof o.id === "string" ? o.id : "" };
  })
  .handler(async ({ data }): Promise<{ ok: true } | { ok: false; error: string }> => {
    const def = tableDef(data.table);
    const me = await requireStaff(def.perm);
    if (!validId(def, data.id)) return { ok: false, error: "Id non valido." };
    try {
      const sql = db();
      await sql`delete from ${sql(data.table)} where ${sql(def.pk)} = ${data.id}`;
      await audit(me, "eliminazione", data.table, data.id);
      return { ok: true };
    } catch (e) {
      return { ok: false, error: dbErrorMessage(e) };
    }
  });

// --- Panoramica del database e negozi online -----------------------------------------------------
export type DatabaseOverview = {
  tables: { table: TableName; rows: number }[];
  sizeBytes: number;
  version: string;
  /** Ultime modifiche (solo per l'amministratore). */
  recent:
    | {
        id: number;
        username: string;
        action: string;
        entity: string;
        entity_id: string;
        created_at: string;
      }[]
    | null;
};

export const getDatabaseOverview = createServerFn({ method: "GET" }).handler(
  async (): Promise<DatabaseOverview> => {
    const me = await requireStaff("vedere");
    const sql = db();
    // Nomi di tabella dall'elenco fisso: count(*) esatto, le tabelle sono piccole.
    const counts = await Promise.all(
      TABLE_NAMES.map(async (t) => {
        const [r] = await sql<{ n: number }[]>`select count(*)::int as n from ${sql(t)}`;
        return { table: t, rows: r?.n ?? 0 };
      }),
    );
    const [info] = await sql<{ size: number; version: string }[]>`
      select pg_database_size(current_database())::int8 as size, current_setting('server_version') as version`;
    const recent =
      me.role === "admin"
        ? await sql<NonNullable<DatabaseOverview["recent"]>>`
            select id, username, action, entity, entity_id, created_at::text
            from audit_log where action not in ('accesso', 'accesso fallito') order by id desc limit 10`
        : null;
    return { tables: counts, sizeBytes: info?.size ?? 0, version: info?.version ?? "", recent };
  },
);

export const listShops = createServerFn({ method: "GET" }).handler(async () => {
  await requireStaff("vedere");
  return db()<
    Shop[]
  >`select id, name, website, search_url, description from shops order by sort, name`;
});
