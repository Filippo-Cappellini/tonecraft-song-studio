// Controlli sugli URL che arrivano da fuori (API esterne, feed RSS, database) prima di usarli
// in href, src o in una richiesta del server. Solo https; facoltativamente solo da certi domini.

/** Restituisce l'URL normalizzato se è https (e, se indicati, su uno dei domini ammessi), altrimenti null. */
export function safeHttpsUrl(value: unknown, allowedHosts?: readonly string[]): string | null {
  if (typeof value !== "string" || value.length > 2048) return null;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || url.username || url.password) return null;
  if (allowedHosts && !allowedHosts.some((h) => url.hostname === h || url.hostname.endsWith(`.${h}`))) return null;
  return url.href;
}

/** Testo in ingresso a una funzione server: solo stringhe, senza caratteri di controllo, con lunghezza massima. */
export function cleanText(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  // eslint-disable-next-line no-control-regex
  return value.replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, max);
}

/** Come inputObject, ma con i soli campi indicati (accesso con il punto, valori ancora da controllare). */
export function inputFields<K extends string>(d: unknown): { readonly [P in K]?: unknown } {
  return inputObject(d) as { readonly [P in K]?: unknown };
}

/** Legge l'oggetto `data` di una funzione server: deve essere un oggetto semplice. */
export function inputObject(d: unknown): Record<string, unknown> {
  return d && typeof d === "object" && !Array.isArray(d) ? (d as Record<string, unknown>) : {};
}

/**
 * fetch per le funzioni server verso siti esterni: timeout, niente redirect verso altri domini
 * e lettura della risposta fino a un limite di byte (una risposta enorme non blocca il server).
 */
export async function fetchExternal(
  url: string,
  { allowedHosts, maxBytes = 1_000_000, timeoutMs = 6000, headers }: { allowedHosts: readonly string[]; maxBytes?: number; timeoutMs?: number; headers?: Record<string, string> },
): Promise<{ ok: boolean; text: string }> {
  const signal = AbortSignal.timeout(timeoutMs);
  let target = safeHttpsUrl(url, allowedHosts);
  let res: Response | null = null;
  // I redirect si seguono a mano (massimo 3) per controllare il dominio a ogni passaggio.
  for (let hop = 0; target && hop < 4; hop++) {
    res = await fetch(target, { ...(headers ? { headers } : {}), redirect: "manual", signal });
    if (res.status < 300 || res.status >= 400) break;
    await res.body?.cancel();
    const next = res.headers.get("location");
    target = next ? safeHttpsUrl(new URL(next, target).href, allowedHosts) : null;
    res = null;
  }
  if (!res || !res.ok || !res.body) {
    await res?.body?.cancel();
    return { ok: false, text: "" };
  }
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (size + value.byteLength > maxBytes) {
      await reader.cancel();
      break;
    }
    size += value.byteLength;
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const c of chunks) {
    bytes.set(c, offset);
    offset += c.byteLength;
  }
  return { ok: true, text: new TextDecoder().decode(bytes) };
}

/** Come fetchExternal, ma interpreta la risposta come JSON (null se non lo è). */
export async function fetchExternalJson<T>(url: string, opts: Parameters<typeof fetchExternal>[1]): Promise<T | null> {
  const { ok, text } = await fetchExternal(url, opts);
  if (!ok) return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}
