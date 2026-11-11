// Accesso con Google lato server: avvio (redirect a Google) e ritorno (codice → id_token → sessione).
// state, nonce e verificatore PKCE stanno per 10 minuti in un cookie httpOnly legato a questo browser.
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
import { audit, newSessionToken, sessionCookieHeader } from "./auth.server";

const FLOW_COOKIE = "tono_google";
const b64url = (b: Buffer) => b.toString("base64url");

export const googleEnabled = () => hasLocalDb() && googleConfig(process.env) !== null;

function redirect(location: string, cookies: string[] = []): Response {
  const headers = new Headers({ Location: location, "Cache-Control": "no-store" });
  for (const c of cookies) headers.append("Set-Cookie", c);
  return new Response(null, { status: 302, headers });
}
const fail = (motivo: string) =>
  redirect(`/accedi?errore=${encodeURIComponent(motivo)}`, [clearFlowCookie()]);
// Il cookie del flusso deve arrivare anche quando Google rimanda qui (navigazione da un altro sito): SameSite=Lax.
const clearFlowCookie = () =>
  `${FLOW_COOKIE}=; Path=${GOOGLE_CALLBACK_PATH}; HttpOnly; SameSite=Lax; Max-Age=0`;

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

/** GET /api/google/accedi: prepara state/nonce/PKCE e manda a Google. */
export function startGoogleLogin(): Response {
  const config = googleConfig(process.env);
  if (!config || !hasLocalDb()) return fail("google-non-attivo");
  const state = b64url(randomBytes(24));
  const nonce = b64url(randomBytes(24));
  const verifier = b64url(randomBytes(48));
  const challenge = b64url(createHash("sha256").update(verifier).digest());
  const secure = config.publicUrl.startsWith("https:") ? "; Secure" : "";
  const flow = `${FLOW_COOKIE}=${state}.${nonce}.${verifier}; Path=${GOOGLE_CALLBACK_PATH}; HttpOnly; SameSite=Lax; Max-Age=600${secure}`;
  return redirect(authUrl(config, { state, nonce, codeChallenge: challenge }), [flow]);
}

/** GET /api/google/ritorno: controlla la risposta di Google, trova o crea l'account e apre la sessione. */
export async function finishGoogleLogin(request: Request): Promise<Response> {
  const config = googleConfig(process.env);
  if (!config || !hasLocalDb()) return fail("google-non-attivo");
  const url = new URL(request.url);
  if (url.searchParams.get("error")) return fail("google-annullato");
  const code = url.searchParams.get("code") ?? "";
  const state = url.searchParams.get("state") ?? "";
  const [savedState, nonce, verifier] = (readCookie(request, FLOW_COOKIE) ?? "").split(".");
  if (
    !code ||
    code.length > 2000 ||
    !savedState ||
    !nonce ||
    !verifier ||
    !sameText(state, savedState)
  )
    return fail("google-scaduto");

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
      code_verifier: verifier,
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
    nonce,
    nowSec: Date.now() / 1000,
  });
  if ("error" in identity) {
    console.warn("Accesso Google rifiutato:", identity.error);
    return fail("google-rifiutato");
  }

  const user = await findOrCreateGoogleUser(identity);
  if (user === "chiuse") return fail("registrazioni-chiuse");
  if (user === "email") return fail("email-in-uso");
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

type Found = { id: string; username: string; active: boolean; created: boolean };

async function findOrCreateGoogleUser(g: GoogleIdentity): Promise<Found | "chiuse" | "email"> {
  const sql = db();
  const [bySub] = await sql<
    Found[]
  >`select id, username, active, false as created from staff_users where google_sub = ${g.sub}`;
  if (bySub) return bySub;
  // Stessa email (verificata da Google) di un account esistente: si collega Google a quell'account.
  const [byEmail] = await sql<Found[]>`
    update staff_users set google_sub = ${g.sub}
    where lower(email) = ${g.email} and google_sub is null
    returning id, username, active, false as created`;
  if (byEmail) return byEmail;
  if (!signupOpen(process.env)) return "chiuse";
  // Email già usata da un account collegato a un altro profilo Google: non si crea un doppione.
  const [taken] = await sql`select 1 from staff_users where lower(email) = ${g.email}`;
  if (taken) return "email";
  // Nuovo account in sola lettura; nome utente dall'email, con un numero se è già preso.
  const base = usernameFromEmail(g.email);
  for (let i = 0; i < 50; i++) {
    const username = i === 0 ? base : `${base}${i + 1}`;
    try {
      const [created] = await sql<Found[]>`
        insert into staff_users (username, full_name, role, email, google_sub)
        values (${username}, ${g.name}, ${SIGNUP_ROLE}, ${g.email}, ${g.sub})
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
