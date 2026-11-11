import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";
import { NONCE_HEADER, makeNonce, withSecurityHeaders } from "./lib/security-headers";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isH3SwallowedErrorBody(body)) return response;

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function isH3SwallowedErrorBody(body: string): boolean {
  try {
    const payload = JSON.parse(body) as { unhandled?: unknown; message?: unknown };
    return payload.unhandled === true && payload.message === "HTTPError";
  } catch {
    return false;
  }
}

// Header di sicurezza solo nella build di produzione: in sviluppo Vite usa script inline e websocket.
const SECURITY_HEADERS = import.meta.env.PROD;

async function handle(request: Request, env: unknown, ctx: unknown): Promise<Response> {
  try {
    const handler = await getServerEntry();
    const response = await handler.fetch(request, env, ctx);
    return await normalizeCatastrophicSsrResponse(response);
  } catch (error) {
    console.error(error);
    return new Response(renderErrorPage(), {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    // Nonce CSP nuovo per ogni richiesta, passato al router con un header interno
    // (un valore mandato dal client viene sempre sostituito).
    const nonce = makeNonce();
    const headers = new Headers(request.headers);
    headers.set(NONCE_HEADER, nonce);
    // Ricostruita dai campi (non `new Request(request, …)`): in sviluppo la richiesta
    // arriva da un'altra implementazione di Request e la copia diretta fallisce.
    const hasBody = request.method !== "GET" && request.method !== "HEAD";
    const forwarded = new Request(request.url, {
      method: request.method,
      headers,
      body: hasBody ? request.body : undefined,
      signal: request.signal,
      redirect: request.redirect,
      // Necessario per inoltrare un body in streaming.
      ...(hasBody ? { duplex: "half" } : {}),
    } as RequestInit);
    const response = await handle(forwarded, env, ctx);
    return SECURITY_HEADERS ? withSecurityHeaders(response, new URL(request.url), nonce) : response;
  },
};
