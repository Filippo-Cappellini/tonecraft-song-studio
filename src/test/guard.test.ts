import { beforeEach, describe, expect, it, vi } from "vitest";
import { inspectRequest, inspectResponse, ipInList, normalizeIp } from "@/lib/guard";

const req = (path: string, opts: { method?: string; query?: string; ua?: string | null } = {}) => ({
  method: opts.method ?? "GET",
  path,
  query: opts.query ?? "",
  userAgent: opts.ua === undefined ? "Mozilla/5.0 (X11; Linux x86_64) Firefox/140.0" : opts.ua,
});

describe("guardia: regole", () => {
  it("riconosce subito gli strumenti di scansione e le sonde di Nmap", () => {
    for (const ua of [
      "Mozilla/5.0 (compatible; Nmap Scripting Engine; https://nmap.org/book/nse.html)",
      "Mozilla/5.00 (Nikto/2.5.0) (Evasions:None) (Test:000001)",
      "sqlmap/1.8#stable (https://sqlmap.org)",
      "Fuzz Faster U Fool v2.1.0-dev",
      "Nuclei - Open-source project (github.com/projectdiscovery/nuclei)",
      "gobuster/3.6",
    ]) {
      expect(inspectRequest(req("/", { ua }))?.points, ua).toBeGreaterThanOrEqual(10);
    }
    expect(inspectRequest(req("/nice%20ports%2C/Tri%6Eity.txt%2ebak", { ua: null }))?.reason).toBe(
      "sonda di Nmap",
    );
    expect(inspectRequest(req("/nmaplowercheck1731234567"))?.points).toBe(10);
  });

  it("riconosce attacchi nell'indirizzo e file segreti cercati a caso", () => {
    expect(
      inspectRequest(req("/brani", { query: "?q=1%27%20UNION%20SELECT%20password" }))?.points,
    ).toBe(10);
    expect(inspectRequest(req("/..%2f..%2fetc/passwd"))?.points).toBe(10);
    expect(inspectRequest(req("/", { query: "?x=${jndi:ldap://x}" }))?.points).toBe(10);
    for (const p of [
      "/.env",
      "/.git/config",
      "/wp-login.php",
      "/phpmyadmin/",
      "/index.php",
      "/backup.sql",
    ])
      expect(inspectRequest(req(p))?.points, p).toBe(5);
    expect(inspectRequest(req("/", { method: "PROPFIND" }))?.points).toBe(5);
    expect(inspectRequest(req("/", { method: "TRACE" }))?.points).toBe(5);
  });

  it("non segnala le richieste normali di chi usa l'app", () => {
    for (const p of [
      "/",
      "/brani",
      "/brani/abc-123",
      "/strumento/chitarra",
      "/gestionale/tabelle/songs",
      "/_serverFn/abc",
      "/assets/index-abc.js",
      "/favicon.ico",
      "/.well-known/security.txt",
    ])
      expect(inspectRequest(req(p)), p).toBeNull();
    expect(inspectRequest(req("/brani", { query: "?q=AC%2FDC%20back%20in%20black" }))).toBeNull();
    expect(inspectRequest(req("/_serverFn/x", { method: "POST" }))).toBeNull();
    expect(inspectRequest(req("/", { method: "OPTIONS" }))).toBeNull();
    // I 404 di file dell'app vecchi dopo un aggiornamento non contano.
    expect(inspectResponse("/assets/vecchio.js", 404)).toBeNull();
    expect(inspectResponse("/admin", 404)?.points).toBe(1);
    expect(inspectResponse("/brani", 200)).toBeNull();
  });

  it("indirizzi IP: forma normale ed elenchi con reti", () => {
    expect(normalizeIp("::ffff:192.168.1.5")).toBe("192.168.1.5");
    expect(normalizeIp(" 10.0.0.1 ")).toBe("10.0.0.1");
    expect(normalizeIp("FE80::1")).toBe("fe80::1");
    for (const bad of [
      "",
      "?",
      "999.1.1.1",
      "1.2.3",
      "abc",
      "1.2.3.4; drop table",
      null,
      undefined,
    ])
      expect(normalizeIp(bad), String(bad)).toBeNull();
    expect(ipInList("192.168.1.77", ["192.168.1.0/24"])).toBe(true);
    expect(ipInList("192.168.2.1", ["192.168.1.0/24"])).toBe(false);
    expect(ipInList("10.0.0.5", ["10.0.0.5"])).toBe(true);
    expect(ipInList("10.0.0.6", ["10.0.0.5", "nonvalido/8"])).toBe(false);
  });
});

describe("guardia: blocco e sblocco (senza database)", () => {
  beforeEach(async () => {
    vi.unstubAllEnvs();
    (await import("@/lib/server/guard.server")).resetGuardForTests();
  });

  it("blocca chi scansiona, lascia passare gli altri, e si può sbloccare", async () => {
    const g = await import("@/lib/server/guard.server");
    const scanner = "192.168.50.217";
    expect(await g.isBanned(scanner)).toBe(false);
    expect(g.checkRequest(scanner, req("/", { ua: "Nmap Scripting Engine" }))).toBe(true);
    expect(await g.isBanned(scanner)).toBe(true);
    expect(await g.isBanned("192.168.50.10")).toBe(false);
    g.forgetBan(scanner);
    expect(await g.isBanned(scanner)).toBe(false);
  });

  it("somma i punti: due file segreti o tanti 404 portano al blocco, uno solo no", async () => {
    const g = await import("@/lib/server/guard.server");
    expect(g.checkRequest("10.1.1.1", req("/.env"))).toBe(false);
    expect(g.checkRequest("10.1.1.1", req("/.git/config"))).toBe(true);
    for (let i = 0; i < 9; i++) g.checkResponse("10.1.1.2", req(`/x${i}`), 404);
    expect(await g.isBanned("10.1.1.2")).toBe(false);
    g.checkResponse("10.1.1.2", req("/x9"), 404);
    expect(await g.isBanned("10.1.1.2")).toBe(true);
  });

  it("non blocca mai il computer stesso, gli indirizzi consentiti, gli sconosciuti; si può spegnere", async () => {
    const g = await import("@/lib/server/guard.server");
    const nmap = req("/", { ua: "Nmap Scripting Engine" });
    expect(g.checkRequest("127.0.0.1", nmap)).toBe(false);
    expect(g.checkRequest(null, nmap)).toBe(false);
    vi.stubEnv("GUARDIA_CONSENTITI", "192.168.50.0/24");
    expect(g.checkRequest("192.168.50.217", nmap)).toBe(false);
    vi.stubEnv("GUARDIA_CONSENTITI", "");
    vi.stubEnv("GUARDIA", "spenta");
    expect(g.checkRequest("192.168.50.217", nmap)).toBe(false);
    expect(await g.isBanned("192.168.50.217")).toBe(false);
  });

  it("l'interruttore del gestionale la spegne e la riaccende (i blocchi restano)", async () => {
    const g = await import("@/lib/server/guard.server");
    const nmap = req("/", { ua: "Nmap Scripting Engine" });
    expect(g.checkRequest("10.3.3.3", nmap)).toBe(true);
    await g.setGuardSwitch(false, "admin");
    expect(g.guardEnabled()).toBe(false);
    expect(await g.isBanned("10.3.3.3")).toBe(false);
    expect(g.checkRequest("10.3.3.4", nmap)).toBe(false);
    await g.setGuardSwitch(true, "admin");
    expect(await g.isBanned("10.3.3.3")).toBe(true);
    // GUARDIA=spenta nell'ambiente vince sull'interruttore.
    vi.stubEnv("GUARDIA", "spenta");
    expect(g.guardEnabled()).toBe(false);
    expect(g.guardForcedOff()).toBe(true);
  });

  it("il blocco a tempo scade da solo", async () => {
    const g = await import("@/lib/server/guard.server");
    vi.useFakeTimers();
    try {
      await g.ban("10.2.2.2", "prova", { hours: 1 });
      expect(await g.isBanned("10.2.2.2")).toBe(true);
      vi.advanceTimersByTime(3600_000 + 1);
      expect(await g.isBanned("10.2.2.2")).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });
});
