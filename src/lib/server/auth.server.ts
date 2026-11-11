// Accesso dello staff al gestionale: password con scrypt, sessione in un cookie httpOnly
// (nel database solo l'impronta SHA-256 del token), blocco temporaneo dopo troppi tentativi falliti.
import { createHash, randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import {
  deleteCookie,
  getCookie,
  getRequest,
  getRequestIP,
  setCookie,
} from "@tanstack/react-start/server";
import { db } from "./db.server";
import { can, isRole, type Permission, type Role } from "../staff-roles";

export type Staff = { id: string; username: string; full_name: string; role: Role };

// --- Password ---------------------------------------------------------------------------------
// Formato: scrypt$N$r$p$sale$hash (base64). Lo stesso di scripts/crea-utente.mjs.
const N = 16384,
  R = 8,
  P = 1,
  KEYLEN = 64;

function scrypt(password: string, salt: Buffer, n: number, r: number, p: number): Promise<Buffer> {
  return new Promise((resolve, reject) =>
    scryptCb(
      password.normalize("NFKC"),
      salt,
      KEYLEN,
      { N: n, r, p, maxmem: 64 * 1024 * 1024 },
      (err, key) => (err ? reject(err) : resolve(key)),
    ),
  );
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(password, salt, N, R, P);
  return `scrypt$${N}$${R}$${P}$${salt.toString("base64")}$${key.toString("base64")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const [n, r, p] = parts.slice(1, 4).map(Number) as [number, number, number];
  // Parametri limitati: un valore manomesso nel database non deve bloccare il server.
  if (!(n >= 1024 && n <= 1 << 17 && r >= 1 && r <= 16 && p >= 1 && p <= 4)) return false;
  const expected = Buffer.from(parts[5]!, "base64");
  const key = await scrypt(password, Buffer.from(parts[4]!, "base64"), n, r, p);
  return expected.length === key.length && timingSafeEqual(expected, key);
}

// Hash fittizio: se l'utente non esiste si fa comunque il calcolo, così i tempi non rivelano i nomi utente.
let dummyHash: Promise<string> | undefined;
export const fakeVerify = async (password: string) => {
  dummyHash ??= hashPassword(randomBytes(12).toString("hex"));
  await verifyPassword(password, await dummyHash);
  return false;
};

// --- Tentativi di accesso ----------------------------------------------------------------------
const MAX_FAILS = 5;
const LOCK_MS = 10 * 60 * 1000;
const fails = new Map<string, { count: number; first: number }>();

export function loginLocked(key: string, now = Date.now()): boolean {
  const f = fails.get(key);
  if (!f) return false;
  if (now - f.first > LOCK_MS) {
    fails.delete(key);
    return false;
  }
  return f.count >= MAX_FAILS;
}
export function loginFailed(key: string, now = Date.now()) {
  const f = fails.get(key);
  if (!f || now - f.first > LOCK_MS) fails.set(key, { count: 1, first: now });
  else f.count++;
  if (fails.size > 10_000) fails.clear(); // memoria limitata anche sotto attacco
}
export const loginSucceeded = (key: string) => fails.delete(key);

export function clientIp(): string {
  try {
    return getRequestIP({ xForwardedFor: process.env["TRUST_PROXY"] === "1" }) ?? "?";
  } catch {
    return "?";
  }
}

// --- Sessione ----------------------------------------------------------------------------------
const COOKIE = "tono_staff";
const SESSION_HOURS = 12;
const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

function secureCookie(): boolean {
  if (process.env["COOKIE_SECURE"] === "1") return true;
  try {
    return new URL(getRequest().url).protocol === "https:";
  } catch {
    return false;
  }
}

export async function startSession(userId: string): Promise<void> {
  const token = randomBytes(32).toString("base64url");
  const sql = db();
  await sql`delete from staff_sessions where expires_at < now()`;
  await sql`insert into staff_sessions (token_hash, user_id, expires_at)
            values (${sha256(token)}, ${userId}, now() + ${`${SESSION_HOURS} hours`}::interval)`;
  await sql`update staff_users set last_login_at = now() where id = ${userId}`;
  setCookie(COOKIE, token, {
    httpOnly: true,
    sameSite: "strict",
    secure: secureCookie(),
    path: "/",
    maxAge: SESSION_HOURS * 3600,
  });
}

export async function endSession(): Promise<void> {
  const token = getCookie(COOKIE);
  if (token) await db()`delete from staff_sessions where token_hash = ${sha256(token)}`;
  deleteCookie(COOKIE, { path: "/" });
}

/** Chiude le sessioni dell'utente tranne quella di questa richiesta. */
export async function endOtherSessions(userId: string): Promise<void> {
  const token = getCookie(COOKIE) ?? "";
  await db()`delete from staff_sessions where user_id = ${userId} and token_hash <> ${sha256(token)}`;
}

/** Utente dello staff collegato, o null (sessione assente, scaduta o utente disattivato). */
export async function currentStaff(): Promise<Staff | null> {
  const token = getCookie(COOKIE);
  if (!token || token.length > 100) return null;
  const rows = await db()<Staff[]>`
    select u.id, u.username, u.full_name, u.role
    from staff_sessions s join staff_users u on u.id = s.user_id
    where s.token_hash = ${sha256(token)} and s.expires_at > now() and u.active`;
  const u = rows[0];
  return u && isRole(u.role) ? u : null;
}

export class AuthError extends Error {}

/** Utente collegato con il permesso richiesto; altrimenti errore (il browser mostra il login). */
export async function requireStaff(perm?: Permission | readonly Permission[]): Promise<Staff> {
  const u = await currentStaff();
  if (!u) throw new AuthError("Accesso richiesto.");
  const perms = perm === undefined ? [] : typeof perm === "string" ? [perm] : perm;
  if (perms.length && !perms.some((p) => can(u.role, p)))
    throw new AuthError("Non hai i permessi per questa operazione.");
  return u;
}

/** Registro delle attività: chi ha fatto cosa (consultabile dall'amministratore). */
export async function audit(
  u: Staff | { id: string | null; username: string },
  action: string,
  entity: string,
  entityId = "",
  detail = "",
) {
  try {
    await db()`insert into audit_log (user_id, username, action, entity, entity_id, detail)
               values (${u.id}, ${u.username}, ${action}, ${entity}, ${entityId}, ${detail.slice(0, 500)})`;
  } catch (e) {
    console.error("audit", e);
  }
}
