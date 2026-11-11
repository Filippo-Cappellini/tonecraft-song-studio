#!/usr/bin/env node
// Applica al PostgreSQL locale le migrazioni in drizzle/migrations (in ordine di nome), una sola volta ciascuna.
// Uso: DATABASE_URL=postgres://... node scripts/db-migrate.mjs   (oppure node --env-file=/etc/tonecraft/tonecraft.env ...)
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "drizzle", "migrations");
const url = process.env.DATABASE_URL;
if (!url) {
  console.error("Manca DATABASE_URL.");
  process.exit(1);
}

const sql = postgres(url, { max: 1, onnotice: () => {} });
try {
  // Le migrazioni sono scritte per Supabase e concedono permessi a questi ruoli: devono esistere.
  const roles =
    await sql`select rolname from pg_roles where rolname in ('anon', 'authenticated', 'service_role')`;
  if (roles.length < 3) {
    console.error(
      "Mancano i ruoli anon/authenticated/service_role. Creali da superutente (lo fa deploy/raspberry/install.sh):",
    );
    console.error(
      '  sudo -u postgres psql -c "CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN;"',
    );
    process.exit(1);
  }
  await sql`create table if not exists _tono_migrations (name text primary key, applied_at timestamptz not null default now())`;
  const done = new Set((await sql`select name from _tono_migrations`).map((r) => r.name));
  const files = (await readdir(dir)).filter((f) => f.endsWith(".sql")).sort();
  let applied = 0;
  for (const f of files) {
    if (done.has(f)) continue;
    const text = await readFile(path.join(dir, f), "utf8");
    process.stdout.write(`→ ${f} … `);
    await sql.begin(async (tx) => {
      await tx.unsafe(text);
      await tx`insert into _tono_migrations (name) values (${f})`;
    });
    console.log("ok");
    applied++;
  }
  console.log(applied ? `${applied} migrazioni applicate.` : "Database già aggiornato.");
} catch (e) {
  console.error("\nMigrazione non riuscita:", e instanceof Error ? e.message : e);
  process.exitCode = 1;
} finally {
  await sql.end();
}
