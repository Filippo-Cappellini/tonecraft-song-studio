// Iscrizioni protette dai bot: modalità (aperte / con approvazione / chiuse) e limite orario dal gestionale,
// gettone firmato che misura quanto tempo passa tra l'apertura del modulo e l'invio.
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { db, hasLocalDb } from "./db.server";
import { signupOpen } from "../staff-roles";
import { SIGNUP_MODES, type SignupMode } from "../signup";

export type SignupSettings = { mode: SignupMode; perHour: number; forcedClosed: boolean };

/** REGISTRAZIONI=chiuse nell'ambiente: chiuse sempre, il gestionale non può riaprirle. */
export const signupForcedClosed = () => typeof process !== "undefined" && !signupOpen(process.env);

let cached: { mode: SignupMode; perHour: number; at: number } | undefined;
const CACHE_MS = 15_000;

/** Impostazioni attuali (rilette dal database al massimo ogni 15 secondi). */
export async function signupSettings(): Promise<SignupSettings> {
  const forcedClosed = signupForcedClosed();
  if (!cached || Date.now() - cached.at > CACHE_MS) {
    // Prima della migrazione 0014 la tabella manca: si resta come prima (aperte, 10 all'ora).
    let mode: SignupMode = "aperte";
    let perHour = 10;
    if (hasLocalDb()) {
      const [row] = await db()<{ signup_mode: string; signups_per_hour: number }[]>`
        select signup_mode, signups_per_hour from site_settings where id = 1`.catch(() => []);
      if (row && (SIGNUP_MODES as readonly string[]).includes(row.signup_mode)) {
        mode = row.signup_mode as SignupMode;
        perHour = row.signups_per_hour;
      }
    }
    cached = { mode, perHour, at: Date.now() };
  }
  return { mode: forcedClosed ? "chiuse" : cached.mode, perHour: cached.perHour, forcedClosed };
}

export async function saveSignupSettings(mode: SignupMode, perHour: number, by: string) {
  await db()`
    insert into site_settings (id, signup_mode, signups_per_hour, updated_by, updated_at)
    values (1, ${mode}, ${perHour}, ${by}, now())
    on conflict (id) do update set signup_mode = excluded.signup_mode,
      signups_per_hour = excluded.signups_per_hour, updated_by = excluded.updated_by, updated_at = now()`;
  cached = { mode, perHour, at: Date.now() };
}

// --- Gettone del modulo -----------------------------------------------------------------------
// "istante.casuale.firma": il bot non può inventarlo né cambiarne l'istante. Vale una volta sola.
export const MIN_FORM_MS = 3_000;
export const MAX_FORM_MS = 2 * 60 * 60 * 1000;
const secret = randomBytes(32); // nuovo a ogni avvio: i gettoni vecchi scadono (il modulo ne chiede un altro)
const used = new Map<string, number>();

const sign = (payload: string) => createHmac("sha256", secret).update(payload).digest("base64url");

export function issueSignupToken(now = Date.now()): string {
  const payload = `${now}.${randomBytes(9).toString("base64url")}`;
  return `${payload}.${sign(payload)}`;
}

export type TokenCheck = "ok" | "veloce" | "scaduto" | "non valido";

/** Controlla il gettone; se è buono lo consuma (un gettone = un'iscrizione). */
export function consumeSignupToken(token: string, now = Date.now()): TokenCheck {
  const parts = token.split(".");
  if (parts.length !== 3) return "non valido";
  const payload = `${parts[0]}.${parts[1]}`;
  const expected = Buffer.from(sign(payload));
  const got = Buffer.from(parts[2]!);
  if (expected.length !== got.length || !timingSafeEqual(expected, got)) return "non valido";
  const issued = Number(parts[0]);
  if (!Number.isFinite(issued) || now - issued > MAX_FORM_MS) return "scaduto";
  if (used.has(token)) return "scaduto";
  if (now - issued < MIN_FORM_MS) return "veloce"; // non consumato: dopo qualche secondo vale
  used.set(token, issued);
  // Pulizia: i gettoni oltre la durata massima non servono più.
  if (used.size > 5_000) for (const [t, at] of used) if (now - at > MAX_FORM_MS) used.delete(t);
  if (used.size > 20_000) used.clear();
  return "ok";
}

/** Solo per i test. */
export function resetSignupForTests() {
  cached = undefined;
  used.clear();
}
