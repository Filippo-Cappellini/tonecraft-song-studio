// Guardia: tiene i punti di ogni indirizzo e l'elenco dei bloccati. I blocchi stanno nel database (tabella guard_bans),
// con una copia in memoria riletta ogni 30 secondi: così si sbanna anche da terminale (scripts/sbanna.mjs).
// Senza database (sviluppo) i blocchi restano solo in memoria fino al riavvio.
// Si accende e si spegne dal gestionale (tabella guard_settings). Configurazione nell'ambiente del server:
//   GUARDIA=spenta            la spegne sempre, qualunque cosa dica il gestionale
//   GUARDIA_CONSENTITI=...    indirizzi o reti IPv4 mai bloccati (es. "192.168.1.10, 10.0.0.0/24")
//   GUARDIA_ORE=24            durata del blocco automatico in ore (vuoto o 0: finché qualcuno non sbanna)
import { readFileSync } from "node:fs";
import {
  BAN_POINTS,
  WINDOW_MS,
  inspectRequest,
  inspectResponse,
  ipInList,
  isLoopback,
  normalizeIp,
  parseIpList,
  type Hit,
} from "../guard";
import { db, hasLocalDb } from "./db.server";

const env = (k: string) => (typeof process !== "undefined" ? process.env[k] : undefined);

/** Spenta dall'ambiente del server (GUARDIA=spenta): il gestionale non può riaccenderla. */
export const guardForcedOff = () => env("GUARDIA")?.trim().toLowerCase() === "spenta";
/** Interruttore del gestionale (riletto dal database insieme ai blocchi). */
let switchOn = true;
export const guardEnabled = () => !guardForcedOff() && switchOn;
export const guardSwitchOn = () => switchOn;
export const guardAllowList = () => parseIpList(env("GUARDIA_CONSENTITI"));
export function guardBanHours(): number {
  const h = Number(env("GUARDIA_ORE") ?? 0);
  return Number.isFinite(h) && h > 0 ? Math.min(h, 24 * 365) : 0;
}

// Il gateway della rete di Docker: le connessioni dal computer che ospita i container (e su Docker Desktop
// tutte) arrivano da qui. Bloccarlo vorrebbe dire bloccare tutti, quindi non si blocca mai.
let gateway: string | null | undefined;
function dockerGateway(): string | null {
  if (gateway !== undefined) return gateway;
  gateway = null;
  try {
    for (const line of readFileSync("/proc/net/route", "utf8").split("\n").slice(1)) {
      const [, dest, gw] = line.trim().split(/\s+/);
      if (dest === "00000000" && gw && gw !== "00000000") {
        // Esadecimale little-endian: 0101A8C0 → 192.168.1.1
        gateway = [6, 4, 2, 0].map((i) => parseInt(gw.slice(i, i + 2), 16)).join(".");
        break;
      }
    }
  } catch {
    /* non Linux: nessun gateway da proteggere */
  }
  return gateway;
}

/** Indirizzo che la guardia non blocca mai (sconosciuto, il computer stesso, consentito, gateway di Docker). */
export function isProtected(ip: string | null): boolean {
  if (!ip) return true;
  return isLoopback(ip) || ip === dockerGateway() || ipInList(ip, guardAllowList());
}

// --- Stato in memoria ----------------------------------------------------------------------------
type Ban = { expires: number | null; at: number };
const bans = new Map<string, Ban>();
const scores = new Map<string, { points: number; first: number; reasons: string[] }>();
let loadedAt = 0;
let loading: Promise<void> | undefined;
const REFRESH_MS = 30_000;

async function refresh(): Promise<void> {
  if (!hasLocalDb()) return;
  try {
    // Prima che la migrazione 0013 sia applicata la tabella manca: la guardia resta accesa.
    const [setting] = await db()<{ enabled: boolean }[]>`
      select enabled from guard_settings where id = 1`.catch(() => []);
    if (setting) switchOn = setting.enabled;
    const rows = await db()<{ ip: string; expires_at: Date | null }[]>`
      select ip, expires_at from guard_bans where expires_at is null or expires_at > now()`;
    const now = Date.now();
    // I blocchi appena creati qui (ancora in scrittura) restano anche se la lettura non li vede.
    const recent = [...bans].filter(([, b]) => now - b.at < 2 * REFRESH_MS);
    bans.clear();
    for (const r of rows) bans.set(r.ip, { expires: r.expires_at?.getTime() ?? null, at: 0 });
    for (const [ip, b] of recent) if (!bans.has(ip)) bans.set(ip, b);
  } catch (e) {
    console.error("guardia: lettura dei blocchi non riuscita", e);
  } finally {
    loadedAt = Date.now();
  }
}

/** Rilegge i blocchi dal database se sono vecchi (la prima volta aspetta, poi in sottofondo). */
async function ensureFresh(): Promise<void> {
  if (Date.now() - loadedAt < REFRESH_MS) return;
  loading ??= refresh().finally(() => (loading = undefined));
  if (!loadedAt) await loading;
}

/** Accende o spegne la guardia (dal gestionale): subito in memoria, poi nel database. */
export async function setGuardSwitch(on: boolean, by: string): Promise<void> {
  switchOn = on;
  scores.clear();
  if (!hasLocalDb()) return;
  await db()`
    insert into guard_settings (id, enabled, updated_by, updated_at) values (1, ${on}, ${by}, now())
    on conflict (id) do update set enabled = excluded.enabled, updated_by = excluded.updated_by,
      updated_at = now()`;
}

/** Forza la rilettura (dopo uno sblocco dal gestionale). */
export function forgetBan(ip: string) {
  bans.delete(ip);
  scores.delete(ip);
}

/** L'indirizzo è bloccato? */
export async function isBanned(rawIp: string | null): Promise<boolean> {
  if (guardForcedOff()) return false;
  // Rilettura anche da spenta: così si accorge se viene riaccesa (dal gestionale o da un altro processo).
  await ensureFresh();
  if (!guardEnabled()) return false;
  const ip = normalizeIp(rawIp);
  if (isProtected(ip)) return false;
  const b = bans.get(ip!);
  if (!b) return false;
  if (b.expires !== null && b.expires <= Date.now()) {
    bans.delete(ip!);
    return false;
  }
  return true;
}

/** Salva un blocco (memoria subito, database in sottofondo) e lo scrive nel registro delle attività. */
export async function ban(
  ip: string,
  reason: string,
  opts: {
    by?: string;
    userId?: string | null;
    detail?: string;
    hours?: number;
    manual?: boolean;
  } = {},
): Promise<void> {
  const hours = opts.hours ?? guardBanHours();
  const expires = hours > 0 ? Date.now() + hours * 3600_000 : null;
  bans.set(ip, { expires, at: Date.now() });
  scores.delete(ip);
  if (bans.size > 50_000) bans.clear(); // memoria limitata anche sotto attacco; il database resta
  if (!hasLocalDb()) return;
  const by = opts.by ?? "guardia";
  const detail = (opts.detail ?? "").slice(0, 500);
  const sql = db();
  await sql`
    insert into guard_bans (ip, reason, detail, manual, created_by, expires_at)
    values (${ip}, ${reason.slice(0, 200)}, ${detail}, ${!!opts.manual}, ${by},
            ${expires ? new Date(expires) : null})
    on conflict (ip) do update set reason = excluded.reason, detail = excluded.detail,
      manual = excluded.manual, created_by = excluded.created_by, created_at = now(),
      expires_at = excluded.expires_at, hits = guard_bans.hits + 1`;
  await sql`insert into audit_log (user_id, username, action, entity, entity_id, detail)
            values (${opts.userId ?? null}, ${by}, ${opts.manual ? "ban manuale" : "ban automatico"},
                    'guardia', ${ip}, ${`${reason}${detail ? ` · ${detail}` : ""}`.slice(0, 500)})`;
}

function addPoints(ip: string, hit: Hit, detail: string, now = Date.now()): boolean {
  let s = scores.get(ip);
  if (!s || now - s.first > WINDOW_MS) {
    s = { points: 0, first: now, reasons: [] };
    scores.set(ip, s);
    if (scores.size > 20_000) scores.clear();
  }
  s.points += hit.points;
  if (!s.reasons.includes(hit.reason) && s.reasons.length < 5) s.reasons.push(hit.reason);
  if (s.points < BAN_POINTS) return false;
  // Motivo principale: l'ultimo che ha fatto superare la soglia; gli altri nel dettaglio.
  const others = s.reasons.filter((r) => r !== hit.reason).join("; ");
  ban(ip, hit.reason, { detail: [detail, others].filter(Boolean).join(" · ") }).catch((e) =>
    console.error("guardia: salvataggio del blocco non riuscito", e),
  );
  return true;
}

type Seen = { method: string; path: string; query: string; userAgent: string | null };
const describe = (r: Seen) =>
  `${r.method} ${r.path}${r.query}`.slice(0, 200) +
  (r.userAgent ? ` · UA: ${r.userAgent.slice(0, 120)}` : "");

/** Prima di servire la richiesta: true se con questa l'indirizzo va bloccato. */
export function checkRequest(rawIp: string | null, req: Seen): boolean {
  if (!guardEnabled()) return false;
  const ip = normalizeIp(rawIp);
  if (isProtected(ip)) return false;
  const hit = inspectRequest(req);
  return hit ? addPoints(ip!, hit, describe(req)) : false;
}

/** Dopo la risposta: conta i "non trovato" a raffica. */
export function checkResponse(rawIp: string | null, req: Seen, status: number): void {
  if (!guardEnabled()) return;
  const ip = normalizeIp(rawIp);
  if (isProtected(ip)) return;
  const hit = inspectResponse(req.path, status);
  if (hit) addPoints(ip!, hit, describe(req));
}

/**
 * Segnalazione da un'altra parte dell'app (es. un bot nel modulo di iscrizione): aggiunge punti all'indirizzo.
 * Con BAN_POINTS il blocco è immediato. Rispetta interruttore, indirizzi consentiti e protetti.
 */
export function penalize(rawIp: string | null, hit: Hit, detail = ""): boolean {
  if (!guardEnabled()) return false;
  const ip = normalizeIp(rawIp);
  if (isProtected(ip)) return false;
  return addPoints(ip!, hit, detail.slice(0, 200));
}

/** Pagina mostrata a chi è bloccato. */
export function bannedResponse(ip: string | null): Response {
  return new Response(
    `Accesso bloccato dalla guardia di Tono.\n` +
      `Il tuo indirizzo (${ip ?? "?"}) ha fatto richieste tipiche di una scansione.\n` +
      `Se è un errore, chiedi all'amministratore di sbloccarlo.\n`,
    {
      status: 403,
      headers: {
        "content-type": "text/plain; charset=utf-8",
        "cache-control": "no-store",
        connection: "close",
      },
    },
  );
}

/** Solo per i test: azzera lo stato. */
export function resetGuardForTests() {
  bans.clear();
  scores.clear();
  loadedAt = 0;
  gateway = undefined;
  switchOn = true;
}
