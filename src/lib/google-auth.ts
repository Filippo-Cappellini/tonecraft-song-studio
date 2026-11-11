// Accesso con Google (OpenID Connect, flusso "authorization code" con PKCE): parti pure, senza server,
// così si possono provare nei test. Il flusso vero è in src/lib/server/google.server.ts.

export const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
export const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
export const GOOGLE_TOKEN_HOSTS = ["oauth2.googleapis.com"] as const;
/** Indirizzo a cui Google rimanda dopo l'accesso (da registrare nella console di Google). */
export const GOOGLE_CALLBACK_PATH = "/api/google/ritorno";

export type GoogleConfig = { clientId: string; clientSecret: string; publicUrl: string };

/**
 * Configurazione dalle variabili d'ambiente, o null se manca qualcosa.
 * Google accetta solo indirizzi https (o http://localhost): con http in rete locale l'accesso resta spento.
 */
export function googleConfig(env: Record<string, string | undefined>): GoogleConfig | null {
  const clientId = env["GOOGLE_CLIENT_ID"]?.trim();
  const clientSecret = env["GOOGLE_CLIENT_SECRET"]?.trim();
  const raw = env["PUBLIC_URL"]?.trim();
  if (!clientId || !clientSecret || !raw) return null;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  const local =
    url.protocol === "http:" && (url.hostname === "localhost" || url.hostname === "127.0.0.1");
  if (url.protocol !== "https:" && !local) return null;
  return { clientId, clientSecret, publicUrl: url.origin };
}

export const redirectUri = (c: GoogleConfig) => `${c.publicUrl}${GOOGLE_CALLBACK_PATH}`;

export function authUrl(
  c: GoogleConfig,
  p: { state: string; nonce: string; codeChallenge: string },
): string {
  const u = new URL(GOOGLE_AUTH_URL);
  u.search = new URLSearchParams({
    client_id: c.clientId,
    redirect_uri: redirectUri(c),
    response_type: "code",
    scope: "openid email profile",
    state: p.state,
    nonce: p.nonce,
    code_challenge: p.codeChallenge,
    code_challenge_method: "S256",
    prompt: "select_account",
  }).toString();
  return u.href;
}

export type GoogleIdentity = { sub: string; email: string; name: string };

/** Legge il payload di un id_token JWT (senza verificarne la firma: arriva direttamente da Google via TLS). */
export function decodeJwtPayload(jwt: string): Record<string, unknown> | null {
  const part = jwt.split(".")[1];
  if (!part || jwt.length > 10_000) return null;
  try {
    // base64url → byte → testo UTF-8 (i nomi possono avere accenti).
    const bin = atob(part.replace(/-/g, "+").replace(/_/g, "/"));
    const json = JSON.parse(new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0))));
    return json && typeof json === "object" && !Array.isArray(json)
      ? (json as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

/**
 * Controlli sull'id_token ricevuto dall'endpoint dei token di Google: emittente, destinatario (la nostra app),
 * scadenza, nonce della richiesta ed email verificata. Restituisce l'identità o il motivo del rifiuto.
 */
export function checkIdToken(
  claims: Record<string, unknown> | null,
  expected: { clientId: string; nonce: string; nowSec: number },
): GoogleIdentity | { error: string } {
  if (!claims) return { error: "token illeggibile" };
  if (claims["iss"] !== "https://accounts.google.com" && claims["iss"] !== "accounts.google.com")
    return { error: "emittente" };
  const aud = claims["aud"];
  if (aud !== expected.clientId && !(Array.isArray(aud) && aud.includes(expected.clientId)))
    return { error: "destinatario" };
  if (typeof claims["exp"] !== "number" || claims["exp"] < expected.nowSec - 60)
    return { error: "scaduto" };
  if (claims["nonce"] !== expected.nonce) return { error: "nonce" };
  if (claims["email_verified"] !== true) return { error: "email non verificata" };
  const sub = claims["sub"],
    email = claims["email"];
  if (typeof sub !== "string" || !/^[0-9A-Za-z_-]{1,255}$/.test(sub)) return { error: "utente" };
  if (typeof email !== "string" || !EMAIL_RE.test(email) || email.length > 254)
    return { error: "email" };
  const name =
    typeof claims["name"] === "string"
      ? claims["name"]
          .replace(/[\u0000-\u001f\u007f]/g, " ")
          .trim()
          .slice(0, 120)
      : "";
  return { sub, email: email.toLowerCase(), name: name || email.split("@")[0]! };
}

export const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** Nome utente proposto dall'email: "Mario.Rossi+x@gmail.com" → "mario.rossi" (3-32 caratteri ammessi). */
export function usernameFromEmail(email: string): string {
  let base = email
    .split("@")[0]!
    .toLowerCase()
    .split("+")[0]!
    .replace(/[^a-z0-9._-]/g, "");
  base = base.replace(/^[._-]+|[._-]+$/g, "").slice(0, 28);
  return base.length >= 3 ? base : `utente${base}`.slice(0, 28);
}
