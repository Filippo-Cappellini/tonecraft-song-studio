// Accesso con Google lato server: avvio (redirect a Google) e ritorno (codice → id_token → sessione).
// state, nonce, verificatore PKCE e (per il collegamento) l'utente restano sul server, validi 10 minuti e
// usabili una volta sola; il browser ha solo lo "state" in un cookie httpOnly che lega il flusso a quel browser.
// Un profilo Google non viene MAI collegato da solo a un account esistente per email (le email degli account
// creati con password non sono verificate): il collegamento si fa da "Il mio account", già dentro.
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { fetchExternal } from "../safe-url";
import {
  authUrl,
  checkIdToken,
  decodeJwtPayload,
  GOOGLE_CALLBACK_PATH,
  GOOGLE_TOKEN_HOSTS,
  GOOGLE_TOKEN_URL,
  googleConfig,
  redirectUri,
  usernameFromEmail,
  type GoogleIdentity,
} from "../google-auth";
import { SIGNUP_ROLE, signupOpen } from "../staff-roles";
import { db, hasLocalDb } from "./db.server";
import { audit, currentStaff, newSessionToken, sessionCookieHeader } from "./auth.server";

const FLOW_COOKIE = "tono_google";
const FLOW_MS = 10 * 60 * 1000;
const b64url = (b: Buffer) => b.toString("base64url");

type Flow = { nonce: string; verifier: string; linkUserId: string | null; expires: number };
const flows = new Map<string, Flow>();

/** Prende (e cancella) il flusso legato allo state: ogni ritorno da Google vale una volta sola. */
export function takeFlow(state: string, now = Date.now()): Flow | null {
  const f = flows.get(state);
  flows.delete(state);
  return f && f.expires > now ? f : null;
}
export function saveFlow(state: string, flow: Omit<Flow, "expires">, now = Date.now()) {
  for (const [k, v] of flows) if (v.expires <= now) flows.delete(k);
  if (flows.size > 5_000) flows.clear(); // memoria limitata anche sotto attacco
  flows.set(state, { ...flow, expires: now + FLOW_MS });
}

export const googleEnabled = () => hasLocalDb() && googleConfig(process.env) !== null;

function redirect(location: string, cookies: string[] = []): Response {
  const headers = new Headers({ Location: location, "Cache-Control": "no-store" });
  for (const c of cookies) headers.append("Set-Cookie", c);
  return new Response(null, { status: 302, headers });
}
// Il cookie del flusso deve arrivare anche quando Google rimanda qui (navigazione da un altro sito): SameSite=Lax.
const clearFlowCookie = () =>
  `${FLOW_COOKIE}=; Path=${GOOGLE_CALLBACK_PATH}; HttpOnly; SameSite=Lax; Max-Age=0`;
const fail = (motivo: string, to = "/accedi") =>
  redirect(`${to}?errore=${encodeURIComponent(motivo)}`, [clearFlowCookie()]);

function readCookie(request: Request, name: string): string | null {
  const header = request.headers.get("cookie") ?? "";
  for (const part of header.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return v.join("=");
  }
  return null;
}

const sameText = (a: string, b: string) => {
  const x = Buffer.from(a),
    y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};

/**
 * GET /api/google/accedi: prepara state/nonce/PKCE e manda a Google.
 * Con ?collega=1 (da "Il mio account", già dentro) il profilo Google verrà collegato all'utente collegato.
 */
export async function startGoogleLogin(request: Request): Promise<Response> {
  const config = googleConfig(process.env);
  if (!config || !hasLocalDb()) return fail("google-non-attivo");
  let linkUserId: string | null = null;
  if (new URL(request.url).searchParams.get("collega") === "1") {
    const me = await currentStaff();
    if (!me) return fail("accesso-richiesto");
    linkUserId = me.id;
  }
  const state = b64url(randomBytes(24));
  const nonce = b64url(randomBytes(24));
  const verifier = b64url(randomBytes(48));
  const challenge = b64url(createHash("sha256").update(verifier).digest());
  saveFlow(state, { nonce, verifier, linkUserId });
  const secure = config.publicUrl.startsWith("https:") ? "; Secure" : "";
  const cookie = `${FLOW_COOKIE}=${state}; Path=${GOOGLE_CALLBACK_PATH}; HttpOnly; SameSite=Lax; Max-Age=600${secure}`;
  return redirect(authUrl(config, { state, nonce, codeChallenge: challenge }), [cookie]);
}

/** GET /api/google/ritorno: controlla la risposta di Google, trova/crea o collega l'account e apre la sessione. */
export async function finishGoogleLogin(request: Request): Promise<Response> {
  const config = googleConfig(process.env);
  if (!config || !hasLocalDb()) return fail("google-non-attivo");
  const url = new URL(request.url);
  const state = url.searchParams.get("state") ?? "";
  const cookieState = readCookie(request, FLOW_COOKIE) ?? "";
  // Lo state deve essere quello di questo browser e di un flusso aperto da noi (e non ancora usato).
  const flow = state && cookieState && sameText(state, cookieState) ? takeFlow(state) : null;
  if (!flow) return fail("google-scaduto");
  const back = flow.linkUserId ? "/gestionale/account" : "/accedi";
  if (url.searchParams.get("error")) return fail("google-annullato", back);
  const code = url.searchParams.get("code") ?? "";
  if (!code || code.length > 2000) return fail("google-scaduto", back);

  const res = await fetchExternal(GOOGLE_TOKEN_URL, {
    allowedHosts: GOOGLE_TOKEN_HOSTS,
    timeoutMs: 8000,
    maxBytes: 100_000,
    headers: { Accept: "application/json" },
    form: new URLSearchParams({
      code,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: redirectUri(config),
      grant_type: "authorization_code",
      code_verifier: flow.verifier,
    }),
  });
  let idToken = "";
  try {
    idToken = res.ok ? String((JSON.parse(res.text) as { id_token?: unknown }).id_token ?? "") : "";
  } catch {
    /* risposta non valida */
  }
  const identity = checkIdToken(decodeJwtPayload(idToken), {
    clientId: config.clientId,
    nonce: flow.nonce,
    nowSec: Date.now() / 1000,
  });
  if ("error" in identity) {
    console.warn("Accesso Google rifiutato:", identity.error);
    return fail("google-rifiutato", back);
  }

  if (flow.linkUserId) return linkGoogle(flow.linkUserId, identity);

  const user = await findOrCreateGoogleUser(identity);
  if (user === "chiuse") return fail("registrazioni-chiuse");
  if (!user.active) return fail("disattivato");
  const token = await newSessionToken(user.id);
  await audit(
    { id: user.id, username: user.username },
    user.created ? "registrazione con Google" : "accesso con Google",
    "sessione",
    "",
    identity.email,
  );
  return redirect("/gestionale", [
    sessionCookieHeader(token, config.publicUrl.startsWith("https:")),
    clearFlowCookie(),
  ]);
}

/** Collega il profilo Google all'utente che ha avviato il collegamento (se il profilo non è già di un altro). */
async function linkGoogle(userId: string, g: GoogleIdentity): Promise<Response> {
  const sql = db();
  const [owner] = await sql<
    { id: string }[]
  >`select id from staff_users where google_sub = ${g.sub}`;
  if (owner && owner.id !== userId) return fail("google-gia-collegato", "/gestionale/account");
  const [me] = await sql<{ id: string; username: string }[]>`
    update staff_users set google_sub = ${g.sub}
    where id = ${userId} and active and (google_sub is null or google_sub = ${g.sub})
    returning id, username`;
  if (!me) return fail("google-gia-collegato", "/gestionale/account");
  await audit(me, "collega Google", "utente", me.id, g.email);
  return redirect("/gestionale/account?collegato=1", [clearFlowCookie()]);
}

type Found = { id: string; username: string; active: boolean; created: boolean };

async function findOrCreateGoogleUser(g: GoogleIdentity): Promise<Found | "chiuse"> {
  const sql = db();
  const [bySub] = await sql<
    Found[]
  >`select id, username, active, false as created from staff_users where google_sub = ${g.sub}`;
  if (bySub) return bySub;
  if (!signupOpen(process.env)) return "chiuse";
  // Nuovo account in sola lettura; nome utente dall'email, con un numero se è già preso.
  // Se l'email è già scritta in un altro account, il nuovo account si crea senza email (nessun collegamento automatico).
  const [taken] = await sql`select 1 from staff_users where lower(email) = ${g.email}`;
  const email = taken ? null : g.email;
  const base = usernameFromEmail(g.email);
  for (let i = 0; i < 50; i++) {
    const username = i === 0 ? base : `${base}${i + 1}`;
    try {
      const [created] = await sql<Found[]>`
        insert into staff_users (username, full_name, role, email, google_sub)
        values (${username}, ${g.name}, ${SIGNUP_ROLE}, ${email}, ${g.sub})
        returning id, username, active, true as created`;
      return created!;
    } catch (e) {
      const code = typeof e === "object" && e && "code" in e ? (e as { code: string }).code : "";
      if (code !== "23505") throw e;
      const [again] = await sql<
        Found[]
      >`select id, username, active, false as created from staff_users where google_sub = ${g.sub}`;
      if (again) return again; // creato nel frattempo da un'altra richiesta
    }
  }
  throw new Error("Nessun nome utente libero.");
}
