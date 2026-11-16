#!/usr/bin/env node
// Guardia di Tono da terminale: elenca gli indirizzi bloccati e li sblocca (utile se resti fuori tu stesso).
// L'app se ne accorge entro 30 secondi.
// Uso (con DATABASE_URL):
//   node scripts/sbanna.mjs              elenco degli indirizzi bloccati
//   node scripts/sbanna.mjs 192.168.1.50 sblocca un indirizzo (anche più di uno)
//   node scripts/sbanna.mjs --tutti      sblocca tutti
// In Docker:  docker compose exec app node scripts/sbanna.mjs [IP|--tutti]   (sul PC: npm run sbanna -- IP)
import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("Manca DATABASE_URL.");
  process.exit(1);
}
const args = process.argv.slice(2);
const sql = postgres(url, { max: 1, onnotice: () => {} });

const log = (action, ip) =>
  sql`insert into audit_log (user_id, username, action, entity, entity_id, detail)
      values (null, 'terminale', ${action}, 'guardia', ${ip}, 'scripts/sbanna.mjs')`;

try {
  if (!args.length) {
    const rows = await sql`
      select ip, reason, created_at, expires_at from guard_bans
      where expires_at is null or expires_at > now() order by created_at desc`;
    if (!rows.length) console.log("Nessun indirizzo bloccato.");
    for (const r of rows)
      console.log(
        `${r.ip.padEnd(40)} ${r.created_at.toLocaleString("it-IT")}  ${r.expires_at ? `scade ${r.expires_at.toLocaleString("it-IT")}` : "senza scadenza"}  ${r.reason}`,
      );
  } else if (args[0] === "--tutti") {
    const rows = await sql`delete from guard_bans returning ip`;
    for (const r of rows) await log("sbanna", r.ip);
    console.log(`${rows.length} indirizzi sbloccati.`);
  } else {
    for (const raw of args) {
      const ip = raw.trim().toLowerCase().replace(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/, "$1");
      const rows = await sql`delete from guard_bans where ip = ${ip} returning ip`;
      if (rows.length) {
        await log("sbanna", ip);
        console.log(`${ip} sbloccato (l'app se ne accorge entro 30 secondi).`);
      } else console.log(`${ip} non era bloccato.`);
    }
  }
} catch (e) {
  if (e?.code === "42P01") console.error("La tabella guard_bans non c'è: applica le migrazioni.");
  else console.error(e?.message ?? e);
  process.exitCode = 1;
} finally {
  await sql.end();
}
