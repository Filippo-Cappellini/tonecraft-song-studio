// Guardia: riconosce chi scansiona il sito (Nmap, Nikto, sqlmap, fuzzing di percorsi…) e ne blocca l'indirizzo.
// Qui solo le regole, senza stato né database: le usa src/lib/server/guard.server.ts e si provano nei test.

/** Punti oltre i quali l'indirizzo viene bloccato (sommati nella finestra di tempo). */
export const BAN_POINTS = 10;
/** Finestra in cui si sommano i punti di un indirizzo. */
export const WINDOW_MS = 10 * 60 * 1000;

export type Hit = { points: number; reason: string };

// Strumenti di scansione che si presentano con il proprio nome nello User-Agent.
const SCANNER_UA =
  /\b(nmap|nikto|sqlmap|nuclei|masscan|zgrab|wpscan|dirbuster|dirb|gobuster|feroxbuster|ffuf|wfuzz|whatweb|acunetix|nessus|openvas|netsparker|qualys|arachni|w3af|skipfish|commix|hydra|zmeu|fimap|joomscan|xsstrike|dalfox|jaeles|nmap scripting engine|fuzz faster u fool)\b/i;

// Richieste che fa solo Nmap (rilevamento del servizio con -sV e script http-*).
const NMAP_PATH =
  /^\/(nice ports,\/trinity\.txt\.bak|nmap(lower|upper)check\d*|hnap1\/?|evox\/about|sdk)$/i;

// Percorsi che in Tono non esistono e che cercano solo gli scanner (file segreti, pannelli di altri software).
const TRAP_PATH = new RegExp(
  [
    String.raw`\/\.(env|git|svn|hg|ds_store|aws|ssh|htaccess|htpasswd|npmrc|docker)(\/|$|\.)`,
    String.raw`\.(php\d?|asp|aspx|jsp|cgi|pl|bak|old|orig|swp|sql|tar|tgz|rar|7z)$`,
    String.raw`\/(wp-admin|wp-login|wp-content|wp-includes|xmlrpc|phpmyadmin|pma|adminer|cgi-bin|server-status|server-info|actuator|manager\/html|solr|jenkins|boaform|vendor\/phpunit|telescope|_profiler|web\.config|backup\.zip|config\.json|\.vscode)(\/|$|\.)`,
  ].join("|"),
  "i",
);

// Contenuti d'attacco nel percorso o nei parametri (già decodificati). \x00: byte nullo (troncamento di percorsi).
const ATTACK =
  // eslint-disable-next-line no-control-regex
  /(\.\.\/|\.\.\\|<script|union(\s|\+|\/\*.*\*\/)+select|'\s*or\s*'?1'?\s*=\s*'?1|\/etc\/passwd|\/proc\/self|\$\{jndi:|\x00|;\s*(wget|curl)\s)/i;

// Metodi HTTP che un browser non usa mai con Tono (WebDAV, debug).
const ODD_METHODS = new Set([
  "TRACE",
  "TRACK",
  "DEBUG",
  "CONNECT",
  "PROPFIND",
  "PROPPATCH",
  "MKCOL",
  "COPY",
  "MOVE",
  "LOCK",
  "UNLOCK",
  "SEARCH",
]);
const NORMAL_METHODS = new Set(["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]);

/** Decodifica sicura (un %xx malformato resta com'è). */
function decode(s: string): string {
  try {
    return decodeURIComponent(s.replace(/\+/g, " "));
  } catch {
    return s;
  }
}

/** Valuta una richiesta prima di servirla: punti e motivo, oppure null se è normale. */
export function inspectRequest(req: {
  method: string;
  path: string;
  query: string;
  userAgent: string | null;
}): Hit | null {
  const method = req.method.toUpperCase();
  const path = decode(req.path);
  const ua = req.userAgent ?? "";

  const tool = ua.match(SCANNER_UA);
  if (tool)
    return { points: BAN_POINTS, reason: `strumento di scansione (${tool[1]!.toLowerCase()})` };
  if (NMAP_PATH.test(path)) return { points: BAN_POINTS, reason: "sonda di Nmap" };
  if (ATTACK.test(path) || ATTACK.test(decode(req.query)))
    return { points: BAN_POINTS, reason: "tentativo di attacco nell'indirizzo" };
  if (ODD_METHODS.has(method) || !NORMAL_METHODS.has(method))
    return { points: 5, reason: `metodo HTTP insolito (${method.slice(0, 12)})` };
  if (TRAP_PATH.test(path)) return { points: 5, reason: "cerca file o pannelli che non esistono" };
  if (!ua.trim()) return { points: 2, reason: "richiesta senza User-Agent" };
  return null;
}

// File che i browser chiedono da soli, e file dell'app vecchi dopo un aggiornamento: un 404 qui è normale.
const HARMLESS_404 =
  /^\/(favicon\.ico|apple-touch-icon[\w-]*\.png|robots\.txt|sitemap\.xml|\.well-known\/|assets\/|icons\/|manifest\.webmanifest|sw\.js)/i;

/** Valuta la risposta: tanti "non trovato" di fila sono il segno di chi prova percorsi a caso. */
export function inspectResponse(path: string, status: number): Hit | null {
  if (status === 404 && !HARMLESS_404.test(path))
    return { points: 1, reason: "percorsi inesistenti a raffica" };
  return null;
}

// --- Indirizzi IP ------------------------------------------------------------------------------

const IPV4 = /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;
const IPV6 = /^[0-9a-f:]{2,39}$/i;

/** Indirizzo IP in forma normale (IPv4 dentro IPv6 → IPv4, minuscole), o null se non è un IP valido. */
export function normalizeIp(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let ip = raw.trim().toLowerCase();
  if (ip.startsWith("::ffff:") && IPV4.test(ip.slice(7))) ip = ip.slice(7);
  if (IPV4.test(ip)) return ip;
  if (IPV6.test(ip) && ip.includes(":") && (ip.match(/::/g) ?? []).length <= 1) return ip;
  return null;
}

const ipv4ToInt = (ip: string) => ip.split(".").reduce((n, p) => n * 256 + Number(p), 0);

/** L'indirizzo è nell'elenco (IP singoli o reti IPv4 come 192.168.1.0/24)? */
export function ipInList(ip: string, list: readonly string[]): boolean {
  for (const item of list) {
    const [base, bitsText] = item.split("/");
    const net = normalizeIp(base);
    if (!net) continue;
    if (bitsText === undefined) {
      if (net === ip) return true;
      continue;
    }
    const bits = Number(bitsText);
    if (!IPV4.test(ip) || !IPV4.test(net) || !Number.isInteger(bits) || bits < 0 || bits > 32)
      continue;
    const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
    if ((ipv4ToInt(ip) & mask) >>> 0 === (ipv4ToInt(net) & mask) >>> 0) return true;
  }
  return false;
}

/** Il computer stesso: mai bloccato (controlli di salute, amministrazione locale). */
export const isLoopback = (ip: string) => ip === "::1" || ip.startsWith("127.");

/** Elenco da variabile d'ambiente: "1.2.3.4, 192.168.1.0/24". */
export const parseIpList = (text: string | undefined) =>
  (text ?? "")
    .split(/[\s,;]+/)
    .map((s) => s.trim())
    .filter(Boolean);
