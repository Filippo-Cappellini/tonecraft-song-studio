#!/usr/bin/env node
// Crea un utente del gestionale, o ne reimposta password e ruolo se esiste già (riattivandolo).
// Serve soprattutto per il primo amministratore. Uso:
//   node --env-file=/etc/tonecraft/tonecraft.env scripts/crea-utente.mjs --username admin --nome "Mario Rossi" --ruolo admin
// La password si scrive quando richiesta (non resta nella cronologia della shell) oppure con la variabile TONO_PASSWORD.
import { randomBytes, scrypt as scryptCb } from "node:crypto";
import { createInterface } from "node:readline";
import { pathToFileURL } from "node:url";

// Stesso formato di src/lib/server/auth.server.ts.
export function hashPassword(password) {
  const salt = randomBytes(16);
  return new Promise((resolve, reject) =>
    scryptCb(
      password.normalize("NFKC"),
      salt,
      64,
      { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 },
      (err, key) =>
        err
          ? reject(err)
          : resolve(`scrypt$16384$8$1$${salt.toString("base64")}$${key.toString("base64")}`),
    ),
  );
}

// Stesse regole di passwordProblem in src/lib/staff-roles.ts.
const WEAK_PARTS = [
  "password",
  "passw0rd",
  "qwerty",
  "123456",
  "654321",
  "abcdef",
  "tonecraft",
  "letmein",
  "iloveyou",
];
export function passwordProblem(pw, username = "") {
  if (pw.length < 12) return "La password deve avere almeno 12 caratteri.";
  if (pw.length > 200) return "La password è troppo lunga.";
  const lower = pw.toLowerCase();
  if (username.length >= 3 && lower.includes(username.toLowerCase()))
    return "La password non deve contenere il nome utente.";
  if (WEAK_PARTS.some((w) => lower.includes(w)))
    return "La password contiene una sequenza troppo comune.";
  if (new Set(pw).size < 6) return "La password ha troppi caratteri ripetuti.";
  const kinds = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((r) => r.test(pw)).length;
  if (kinds < 3 && pw.length < 20)
    return "Usa almeno 3 tipi tra minuscole, maiuscole, cifre e simboli, oppure una frase di almeno 20 caratteri.";
  return null;
}

function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : undefined;
}

function askHidden(question) {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    rl._writeToOutput = (s) => {
      if (s.includes(question)) process.stdout.write(s);
    };
    rl.question(question, (answer) => {
      rl.close();
      process.stdout.write("\n");
      resolve(answer);
    });
  });
}

async function main() {
  const { default: postgres } = await import("postgres");
  const username = (arg("username") ?? "").toLowerCase();
  const fullName = arg("nome") ?? username;
  const role = arg("ruolo") ?? "admin";
  if (!/^[a-z0-9._-]{3,32}$/.test(username))
    throw new Error("--username: 3-32 caratteri tra minuscole, cifre, . _ -");
  if (!["admin", "catalogo", "lettura"].includes(role))
    throw new Error("--ruolo: admin, catalogo o lettura");
  if (!process.env.DATABASE_URL)
    throw new Error("Manca DATABASE_URL (usa node --env-file=/etc/tonecraft/tonecraft.env).");

  let password = process.env.TONO_PASSWORD;
  if (!password) {
    password = await askHidden(
      "Password (almeno 12 caratteri, 3 tipi tra minuscole/maiuscole/cifre/simboli): ",
    );
    if (password !== (await askHidden("Ripeti la password: ")))
      throw new Error("Le password non coincidono.");
  }
  const problem = passwordProblem(password, username);
  if (problem) throw new Error(problem);

  const sql = postgres(process.env.DATABASE_URL, { max: 1, onnotice: () => {} });
  try {
    const hash = await hashPassword(password);
    const [row] = await sql`
      insert into staff_users (username, full_name, role, password_hash) values (${username}, ${fullName}, ${role}, ${hash})
      on conflict (username) do update set password_hash = excluded.password_hash, role = excluded.role, active = true
      returning id, (xmax = 0) as created`;
    await sql`delete from staff_sessions where user_id = ${row.id}`;
    await sql`insert into audit_log (user_id, username, action, entity, entity_id) values (${row.id}, 'console', ${row.created ? "nuovo utente" : "reimposta utente"}, 'utente', ${row.id})`;
    console.log(
      row.created
        ? `Utente «${username}» creato (${role}).`
        : `Utente «${username}» aggiornato e riattivato (${role}).`,
    );
  } finally {
    await sql.end();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  });
}
