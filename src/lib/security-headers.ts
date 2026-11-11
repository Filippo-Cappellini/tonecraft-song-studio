// Header HTTP di sicurezza aggiunti a ogni risposta del server (vedi src/server.ts).
// La CSP usa un nonce diverso per ogni richiesta: TanStack lo mette sugli script che genera
// (idratazione, streaming) e nel meta "csp-nonce" letto dal client. Nessuno script inline senza nonce.

/** Header interno con cui server.ts passa il nonce al router (sovrascritto a ogni richiesta). */
export const NONCE_HEADER = "x-tono-csp-nonce";

export function makeNonce(): string {
  const bytes = new Uint8Array(18);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes));
}

// Anteprime Lovable (editor): la pagina viene mostrata in un iframe di lovable.dev.
const PREVIEW_ZONES = ["lovableproject.com", "lovableproject-dev.com", "gpt-eng.com", "gptengineer.run"];
const EDITOR_ORIGINS = "https://lovable.dev https://*.lovable.dev https://gptengineer.app https://*.gptengineer.app";

function isEditorPreview(host: string): boolean {
  return host.includes("preview--") || PREVIEW_ZONES.some((z) => host === z || host.endsWith(`.${z}`));
}

function supabaseOrigins(): string {
  const raw = import.meta.env["VITE_SUPABASE_URL"] as string | undefined;
  try {
    const u = new URL(raw ?? "");
    if (u.protocol === "https:") return `${u.origin} wss://${u.host}`;
  } catch {
    /* variabile assente: si usa il dominio generico */
  }
  return "https://*.supabase.co wss://*.supabase.co";
}

export function securityHeaders(url: URL, nonce: string): Record<string, string> {
  const preview = isEditorPreview(url.hostname);
  const frameAncestors = preview ? `'self' ${EDITOR_ORIGINS}` : "'none'";
  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}'`,
    "script-src-attr 'none'",
    // Gli stili inline servono a React (attributo style) e ai componenti grafici.
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' data: https://fonts.gstatic.com",
    // Copertine iTunes e foto di anteprima delle notizie, servite dai siti delle testate.
    "img-src 'self' data: blob: https:",
    // Anteprime audio di 30 secondi, servite da Apple.
    "media-src 'self' blob: https://*.apple.com https://*.mzstatic.com",
    `connect-src 'self' ${supabaseOrigins()}`,
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    "frame-src 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    `frame-ancestors ${frameAncestors}`,
    // Solo in https (in produzione): su http locale impedirebbe di caricare la pagina stessa.
    ...(url.protocol === "https:" ? ["upgrade-insecure-requests"] : []),
  ].join("; ");

  const headers: Record<string, string> = {
    "Content-Security-Policy": csp,
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    // Il microfono serve all'accordatore; tutto il resto è spento.
    "Permissions-Policy":
      "microphone=(self), camera=(), geolocation=(), payment=(), usb=(), serial=(), bluetooth=(), hid=(), midi=(), magnetometer=(), gyroscope=(), accelerometer=(), display-capture=(), browsing-topics=()",
    "Cross-Origin-Opener-Policy": "same-origin",
    "Cross-Origin-Resource-Policy": "same-origin",
    "X-Permitted-Cross-Domain-Policies": "none",
  };
  if (!preview) headers["X-Frame-Options"] = "DENY";
  if (url.protocol === "https:") headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains";
  return headers;
}

/** Copia la risposta aggiungendo gli header di sicurezza e togliendo quelli che rivelano il software usato. */
export function withSecurityHeaders(response: Response, url: URL, nonce: string): Response {
  const out = new Response(response.body, response);
  for (const [k, v] of Object.entries(securityHeaders(url, nonce))) out.headers.set(k, v);
  out.headers.delete("X-Powered-By");
  out.headers.delete("Server");
  return out;
}
