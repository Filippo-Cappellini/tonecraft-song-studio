import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { isTableName, TABLE_NAMES, TABLES } from "@/lib/admin-tables";

// Controlli di sicurezza sul codice: se una modifica futura apre una falla, questi test falliscono.
vi.mock("@tanstack/react-start/server", () => ({}));
vi.mock("@/lib/server/db.server", () => ({
  db: () => {
    throw new Error("niente database nei test");
  },
  hasLocalDb: () => false,
}));

const files = (dir: string): string[] =>
  readdirSync(dir).flatMap((f) => {
    const p = path.join(dir, f);
    return statSync(p).isDirectory() ? files(p) : /\.(ts|tsx)$/.test(f) ? [p] : [];
  });
const appCode = files(path.resolve("src")).filter(
  (f) => !f.includes(`${path.sep}test${path.sep}`) && !f.includes("routeTree.gen"),
);
const read = (f: string) => readFileSync(f, "utf8");

describe("SQL injection", () => {
  it("nel codice dell'app non c'è SQL costruito a mano (sql.unsafe / testo concatenato)", () => {
    for (const f of appCode) {
      const src = read(f);
      expect(src, f).not.toMatch(/\.unsafe\(/);
      // Un template sql`...` non deve mai ricevere testo già unito a mano (es. sql(`... ${x}`)).
      expect(src, f).not.toMatch(/sql\(\s*`/);
    }
  });

  it("l'editor del database lavora solo sulle tabelle dell'app, mai su utenti, sessioni o registro", () => {
    for (const t of [
      "staff_users",
      "staff_sessions",
      "audit_log",
      "_tono_migrations",
      "pg_user",
      "__proto__",
      "constructor",
    ]) {
      expect(isTableName(t), t).toBe(false);
    }
    for (const t of TABLE_NAMES) {
      const def = TABLES[t];
      for (const name of [t, def.pk, def.title, def.order, ...def.columns.map((c) => c.name)]) {
        expect(name, `${t}.${name}`).toMatch(/^[a-z_]+$/); // identificatori semplici, dall'elenco fisso
      }
    }
  });
});

describe("IDOR e permessi", () => {
  // Funzioni server pubbliche per scelta: catalogo (dati pubblici), accesso, registrazione, uscita.
  const PUBLIC_FNS = new Set(["getStaffStatus", "staffLogin", "staffSignup", "staffLogout"]);

  it.each(["src/lib/staff.functions.ts", "src/lib/tables.functions.ts"])(
    "%s: ogni funzione server controlla l'utente",
    (file) => {
      const src = read(path.resolve(file));
      const blocks = src.split(/export const (\w+) = createServerFn/).slice(1);
      expect(blocks.length).toBeGreaterThan(2);
      for (let i = 0; i < blocks.length; i += 2) {
        const name = blocks[i]!;
        const body = blocks[i + 1]!;
        if (PUBLIC_FNS.has(name)) continue;
        expect(body, name).toMatch(/requireStaff\(/);
      }
    },
  );

  it("le funzioni sul proprio account usano l'utente della sessione, non un id mandato dal browser", () => {
    const src = read(path.resolve("src/lib/staff.functions.ts"));
    for (const name of ["changeOwnPassword", "getMyAccount", "unlinkGoogle"]) {
      const body = src.split(`export const ${name} =`)[1]!.split("export const")[0]!;
      expect(body, name).toMatch(/me\.id/);
      expect(body, name).not.toMatch(/data\.id/);
    }
  });

  it("modificare dati, utenti e registro richiede il permesso giusto (non basta essere dentro)", () => {
    const src = read(path.resolve("src/lib/tables.functions.ts"));
    const save = src.split("export const saveTableRow")[1]!.split("export const")[0]!;
    const del = src.split("export const deleteTableRow")[1]!.split("export const")[0]!;
    expect(save).toMatch(/requireStaff\(def\.perm\)/);
    expect(del).toMatch(/requireStaff\(def\.perm\)/);
    const staff = read(path.resolve("src/lib/staff.functions.ts"));
    for (const name of ["listStaffUsers", "saveStaffUser", "listAudit"]) {
      expect(staff.split(`export const ${name} =`)[1]!.split("export const")[0], name).toMatch(
        /requireStaff\("admin"\)/,
      );
    }
  });
});

describe("SSRF", () => {
  it("il server chiama siti esterni solo con fetchExternal (https, domini ammessi, timeout, limite)", () => {
    for (const f of appCode) {
      if (
        f.endsWith(`lib${path.sep}safe-url.ts`) ||
        f.endsWith(`${path.sep}server.ts`) ||
        f.includes(`integrations${path.sep}`)
      )
        continue;
      expect(read(f), f).not.toMatch(/(^|[^.\w])fetch\(/m);
    }
  });

  it("fetchExternal rifiuta indirizzi non https, interni o con credenziali", async () => {
    const { fetchExternal, safeHttpsUrl } = await import("@/lib/safe-url");
    for (const u of [
      "http://itunes.apple.com/x",
      "https://127.0.0.1/",
      "https://169.254.169.254/latest/meta-data",
      "https://user:pw@itunes.apple.com/",
      "file:///etc/passwd",
      "https://itunes.apple.com.evil.it/",
    ]) {
      expect((await fetchExternal(u, { allowedHosts: ["itunes.apple.com"] })).ok, u).toBe(false);
    }
    expect(safeHttpsUrl("javascript:alert(1)")).toBeNull();
  });
});

describe("Accesso con Google", () => {
  it("ogni ritorno da Google vale una volta sola e scade dopo 10 minuti", async () => {
    const { saveFlow, takeFlow } = await import("@/lib/server/google.server");
    saveFlow("s1", { nonce: "n", verifier: "v", linkUserId: null }, 1000);
    expect(takeFlow("s1", 2000)?.nonce).toBe("n");
    expect(takeFlow("s1", 2000)).toBeNull(); // già usato
    saveFlow("s2", { nonce: "n", verifier: "v", linkUserId: null }, 1000);
    expect(takeFlow("s2", 1000 + 11 * 60 * 1000)).toBeNull(); // scaduto
    expect(takeFlow("inventato")).toBeNull();
  });

  it("non collega mai un profilo Google a un account esistente solo perché l'email coincide", () => {
    const src = read(path.resolve("src/lib/server/google.server.ts"));
    expect(src).not.toMatch(/update staff_users set google_sub[\s\S]{0,120}where lower\(email\)/);
  });
});

describe("Tentativi di accesso", () => {
  it("blocca il dispositivo dopo 5 errori, il nome utente solo dopo 20", async () => {
    const { loginFailed, loginLocked } = await import("@/lib/server/auth.server");
    for (let i = 0; i < 5; i++) {
      loginFailed("ip:a", 1);
      loginFailed("user:admin", 1);
    }
    expect(loginLocked("ip:a", 2)).toBe(true);
    expect(loginLocked("user:admin", 2)).toBe(false);
    for (let i = 0; i < 15; i++) loginFailed("user:admin", 1);
    expect(loginLocked("user:admin", 2)).toBe(true);
  });
});

describe("Richieste", () => {
  it("rifiuta corpi oltre 1 MB e non mette in cache le risposte private", async () => {
    vi.doMock("@tanstack/react-start/server-entry", () => ({
      default: {
        fetch: async (req: Request) =>
          new Response(await req.text(), { headers: { "cache-control": "public, max-age=60" } }),
      },
    }));
    const { default: server } = await import("@/server");
    const big = await server.fetch(
      new Request("http://x/_serverFn/a", {
        method: "POST",
        body: "x",
        headers: { "content-length": "2000000" },
      }),
      {},
      {},
    );
    expect(big.status).toBe(413);
    const ok = await server.fetch(
      new Request("http://x/_serverFn/a", { method: "POST", body: "ciao" }),
      {},
      {},
    );
    expect(await ok.text()).toBe("ciao");
    expect(ok.headers.get("cache-control")).toBe("no-store");
  });
});

describe("Richieste (corpo grande senza Content-Length)", () => {
  it("interrompe un corpo che supera 1 MB anche se l'header non lo dichiara", async () => {
    vi.resetModules();
    vi.doMock("@tanstack/react-start/server-entry", () => ({
      default: {
        fetch: async (req: Request) => {
          try {
            return new Response(String((await req.text()).length));
          } catch {
            return new Response("interrotto", { status: 413 });
          }
        },
      },
    }));
    const { default: server } = await import("@/server");
    const chunk = new Uint8Array(256 * 1024);
    let sent = 0;
    const body = new ReadableStream<Uint8Array>({
      pull(c) {
        if (sent >= 8) return c.close();
        sent++;
        c.enqueue(chunk);
      },
    });
    const req = new Request("http://x/_serverFn/a", {
      method: "POST",
      body,
      duplex: "half",
    } as RequestInit);
    const res = await server.fetch(req, {}, {});
    expect(await res.text()).toBe("interrotto");
    expect(sent).toBeLessThan(8); // il resto non viene nemmeno letto
  });
});
