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

// Corpo massimo di una richiesta (moduli e funzioni server): oltre si risponde 413, senza leggere il resto.
export const MAX_BODY_BYTES = 1_000_000;

/**
 * Corpo limitato: si interrompe appena supera il massimo (anche se manca o mente l'header Content-Length).
 * Il corpo originale si apre solo quando qualcuno lo legge davvero: il server Node rilegge la richiesta
 * originale (es. per `redirect`) e un corpo già bloccato la farebbe fallire.
 */
function limitBody(request: Request, max: number): ReadableStream<Uint8Array> {
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  let size = 0;
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      reader ??= request.body!.getReader();
      const { done, value } = await reader.read();
      if (done) return controller.close();
      size += value.byteLength;
      if (size > max) {
        controller.error(new Error("Richiesta troppo grande"));
        await reader.cancel();
        return;
      }
      controller.enqueue(value);
    },
    cancel(reason) {
      return reader?.cancel(reason);
    },
  });
}

/** Risposte con dati dell'utente (funzioni server, accesso con Google): mai in cache. */
const isPrivatePath = (path: string) => path.startsWith("/_serverFn") || path.startsWith("/api/");

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    const url = new URL(request.url);
    const declared = Number(request.headers.get("content-length") ?? 0);
    if (declared > MAX_BODY_BYTES) {
      return new Response("Richiesta troppo grande", {
        status: 413,
        headers: { "content-type": "text/plain; charset=utf-8" },
      });
    }
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
      body: hasBody && request.body ? limitBody(request, MAX_BODY_BYTES) : undefined,
      signal: request.signal,
      redirect: request.redirect,
      // Necessario per inoltrare un body in streaming.
      ...(hasBody ? { duplex: "half" } : {}),
    } as RequestInit);
    let response = await handle(forwarded, env, ctx);
    if (isPrivatePath(url.pathname)) {
      response = new Response(response.body, response);
      response.headers.set("Cache-Control", "no-store");
    }
    return SECURITY_HEADERS ? withSecurityHeaders(response, url, nonce) : response;
  },
};
