import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { cartProblems, cartTotal, formatEur, parseEur, shopLink, stockLevel } from "@/lib/shop";
import { isTableName, TABLE_NAMES, TABLES, validateRow, validId, type Column } from "@/lib/admin-tables";
import { can, canAny, passwordProblem, ROLE_IDS, USERNAME_RE } from "@/lib/staff-roles";

// auth.server.ts legge cookie e richiesta da TanStack Start: qui servono solo le funzioni sulle password.
vi.mock("@tanstack/react-start/server", () => ({}));
vi.mock("@/lib/server/db.server", () => ({ db: () => { throw new Error("niente database nei test"); } }));

describe("prezzi e carrello", () => {
  it("legge gli importi scritti all'italiana e non accetta valori strani", () => {
    expect(parseEur("12,50")).toBe(1250);
    expect(parseEur("12.5")).toBe(1250);
    expect(parseEur("1.234,99 €")).toBe(123499);
    expect(parseEur("0")).toBe(0);
    expect(parseEur("-3")).toBeNull();
    expect(parseEur("12,345")).toBeNull();
    expect(parseEur("abc")).toBeNull();
    expect(parseEur("")).toBeNull();
    expect(formatEur(12345678).replace(/\s/g, " ")).toBe("123.456,78 €");
  });

  it("controlla le giacenze sommando le righe dello stesso prodotto", () => {
    const stock = new Map([["a", { name: "Corde", stock: 3 }]]);
    expect(cartProblems([{ productId: "a", quantity: 2, unitPriceCents: 500 }], stock)).toEqual([]);
    expect(cartProblems([{ productId: "a", quantity: 2, unitPriceCents: 500 }, { productId: "a", quantity: 2, unitPriceCents: 500 }], stock)).toEqual([
      "Corde: disponibili 3, richiesti 4.",
    ]);
    expect(cartProblems([], stock)).toContain("Il carrello è vuoto.");
    expect(cartProblems([{ productId: "x", quantity: 1, unitPriceCents: 1 }], stock)).toContain("Prodotto non trovato.");
    expect(cartTotal([{ productId: "a", quantity: 3, unitPriceCents: 250 }])).toBe(750);
  });

  it("classifica le scorte", () => {
    expect(stockLevel(0, 2)).toBe("esaurito");
    expect(stockLevel(2, 2)).toBe("basso");
    expect(stockLevel(5, 2)).toBe("ok");
  });
});

describe("negozi online", () => {
  const thomann = { website: "https://www.thomann.it/", search_url: "https://www.thomann.it/search_dir.html?sw={q}" };
  it("crea il link di ricerca con il testo codificato", () => {
    expect(shopLink(thomann, "Fender Strat & co")).toEqual({ href: "https://www.thomann.it/search_dir.html?sw=Fender%20Strat%20%26%20co", search: true });
  });
  it("senza indirizzo di ricerca apre la home, e rifiuta indirizzi non https", () => {
    expect(shopLink({ website: "https://www.musicalstore2005.com/", search_url: null }, "basso")).toEqual({ href: "https://www.musicalstore2005.com/", search: false });
    expect(shopLink({ website: "javascript:alert(1)", search_url: "http://x.it/?q={q}" }, "a")).toBeNull();
  });
  it("i negozi iniziali della migrazione hanno indirizzi https validi", () => {
    const sql = readFileSync(path.resolve("drizzle/migrations/0010_gestionale.sql"), "utf8");
    const urls = [...sql.matchAll(/'(https:[^']+)'/g)].map((m) => m[1]!);
    expect(urls.length).toBeGreaterThanOrEqual(5);
    for (const u of urls) expect(shopLink({ website: u, search_url: u }, "prova")?.href).toMatch(/^https:\/\//);
  });
});

describe("ruoli", () => {
  it("l'amministratore può tutto, il commesso solo vendere", () => {
    expect(can("admin", "admin")).toBe(true);
    expect(can("vendite", "vendite")).toBe(true);
    expect(can("vendite", "magazzino")).toBe(false);
    expect(can("catalogo", "vendite")).toBe(false);
    expect(canAny("magazzino", ["vendite", "admin"])).toBe(true);
    expect(can(null, "vendite")).toBe(false);
    expect(can("hacker" as never, "admin")).toBe(false);
    expect(ROLE_IDS.filter((r) => can(r, "admin"))).toEqual(["admin"]);
  });
  it("nomi utente e password", () => {
    expect(USERNAME_RE.test("mario.rossi")).toBe(true);
    expect(USERNAME_RE.test("Mario")).toBe(false);
    expect(USERNAME_RE.test("a")).toBe(false);
    expect(passwordProblem("corta")).not.toBeNull();
    expect(passwordProblem("adminpassword1")).not.toBeNull(); // la vecchia password di prova
    expect(passwordProblem("abbastanzalunga")).not.toBeNull(); // un solo tipo di carattere
    expect(passwordProblem("Mario.Rossi-2026!", "mario.rossi")).toBe("La password non deve contenere il nome utente.");
    expect(passwordProblem("Qwerty!Estate99")).toBe("La password contiene una sequenza troppo comune.");
    expect(passwordProblem("aaaaaaAAAA11")).toBe("La password ha troppi caratteri ripetuti.");
    expect(passwordProblem("Chitarra-Blu-73")).toBeNull();
    expect(passwordProblem("il basso suona sempre piano")).toBeNull(); // frase lunga
  });
  it("lo script crea-utente applica le stesse regole del gestionale", async () => {
    // @ts-expect-error script JavaScript senza tipi
    const script = (await import("../../scripts/crea-utente.mjs")) as { passwordProblem: (p: string, u?: string) => string | null };
    for (const [pw, user] of [["corta", ""], ["adminpassword1", "admin"], ["Chitarra-Blu-73", "carla"], ["Carla-Banco-99", "carla"], ["aaaaaaAAAA11", ""], ["il basso suona sempre piano", ""]] as const)
      expect(script.passwordProblem(pw, user)).toBe(passwordProblem(pw, user));
  });
});

describe("tabelle modificabili dal gestionale", () => {
  // Colonne reali delle tabelle, lette dalle CREATE TABLE delle migrazioni.
  const columns = new Map<string, Set<string>>();
  const dir = path.resolve("drizzle/migrations");
  for (const f of readdirSync(dir).filter((f) => f.endsWith(".sql"))) {
    const text = readFileSync(path.join(dir, f), "utf8");
    for (const m of text.matchAll(/CREATE TABLE (?:IF NOT EXISTS )?public\.(\w+) \(([\s\S]*?)\);\n/g)) {
      const cols = m[2]!.split(/,\s*(?![^()]*\))/).map((c) => c.trim().split(/\s+/)[0]!);
      columns.set(m[1]!, new Set(cols));
    }
  }

  it.each(TABLE_NAMES)("%s: tabella e colonne esistono nel database", (t) => {
    const real = columns.get(t);
    expect(real, `tabella ${t}`).toBeDefined();
    const def = TABLES[t];
    for (const c of [def.pk, def.title, def.order, ...def.columns.map((c) => c.name)]) expect(real!.has(c), `${t}.${c}`).toBe(true);
  });

  it("le colonne obbligatorie nel database sono obbligatorie anche nel modulo", () => {
    const sql = readdirSync(dir)
      .filter((f) => f.endsWith(".sql"))
      .map((f) => readFileSync(path.join(dir, f), "utf8"))
      .join("\n");
    for (const t of TABLE_NAMES) {
      const body = new RegExp(`CREATE TABLE (?:IF NOT EXISTS )?public\\.${t} \\(([\\s\\S]*?)\\);\\n`).exec(sql)![1]!;
      for (const c of TABLES[t].columns as readonly Column[]) {
        const line = body.split(/,\s*(?![^()]*\))/).find((l) => l.trim().startsWith(`${c.name} `)) ?? "";
        if (/NOT NULL/.test(line) && !/DEFAULT/.test(line) && c.type !== "bool") expect(c.required, `${t}.${c.name}`).toBe(true);
      }
    }
  });

  it("converte e controlla i valori del modulo", () => {
    const { row, errors } = validateRow(TABLES.songs, {
      instrument_id: "chitarra", title: " Wonderwall ", artist: "Oasis", album: "(What's the Story)", year: "1995", genre: "Britpop",
      difficulty: "2", bpm: "87", song_key: "F#m", tuning: "Standard", notation: "",
    });
    expect(errors).toEqual([]);
    expect(row).toMatchObject({ title: "Wonderwall", year: 1995, notation: null });

    const bad = validateRow(TABLES.songs, { title: "a\nb", year: "19x5", difficulty: "9" });
    expect(bad.errors).toEqual(expect.arrayContaining(["Titolo: una sola riga.", "Anno: deve essere un numero intero.", "Difficoltà (1-5): deve stare tra 1 e 5.", "Artista: obbligatorio."]));

    expect(validateRow(TABLES.courses, { url: "javascript:alert(1)" }).errors).toContain("Indirizzo (https): deve essere un indirizzo https.");
    expect(validateRow(TABLES.shops, { name: "X", website: "https://x.it", search_url: "https://x.it/s?q={q}" }).errors).toEqual([]);
    expect(validateRow(TABLES.lessons, { tool: "rm -rf" }).errors).toContain("Attrezzo: valore non ammesso.");
  });

  it("accetta solo tabelle e id dell'elenco", () => {
    expect(isTableName("songs")).toBe(true);
    expect(isTableName("staff_users")).toBe(false);
    expect(isTableName("constructor")).toBe(false);
    expect(validId(TABLES.songs, "wonderwall-oasis")).toBe(true);
    expect(validId(TABLES.songs, "x'; drop table songs;--")).toBe(false);
    expect(validId(TABLES.customers, "not-a-uuid")).toBe(false);
    expect(validId(TABLES.customers, "6f1c2d3e-4b5a-4c6d-8e9f-0a1b2c3d4e5f")).toBe(true);
  });
});

describe("password", () => {
  it("il server accetta le password create dallo script crea-utente e rifiuta quelle sbagliate", async () => {
    const { verifyPassword, hashPassword } = await import("@/lib/server/auth.server");
    // @ts-expect-error script JavaScript senza tipi
    const script = (await import("../../scripts/crea-utente.mjs")) as { hashPassword: (p: string) => Promise<string> };
    const fromScript = await script.hashPassword("passwordSegreta1");
    expect(await verifyPassword("passwordSegreta1", fromScript)).toBe(true);
    expect(await verifyPassword("passwordsegreta1", fromScript)).toBe(false);
    const own = await hashPassword("un'altra password");
    expect(own).toMatch(/^scrypt\$16384\$8\$1\$/);
    expect(await verifyPassword("un'altra password", own)).toBe(true);
    expect(await verifyPassword("x", "testo-non-valido")).toBe(false);
    // Parametri manomessi (costo enorme) rifiutati senza calcolare.
    expect(await verifyPassword("x", own.replace("$16384$", "$1048576$"))).toBe(false);
  });

  it("blocca dopo 5 tentativi falliti e sblocca dopo 10 minuti", async () => {
    const { loginFailed, loginLocked, loginSucceeded } = await import("@/lib/server/auth.server");
    const t0 = 1_000_000;
    for (let i = 0; i < 4; i++) loginFailed("ip:test", t0);
    expect(loginLocked("ip:test", t0)).toBe(false);
    loginFailed("ip:test", t0);
    expect(loginLocked("ip:test", t0 + 1000)).toBe(true);
    expect(loginLocked("ip:test", t0 + 11 * 60 * 1000)).toBe(false);
    loginFailed("ip:altro", t0);
    loginSucceeded("ip:altro");
    expect(loginLocked("ip:altro", t0)).toBe(false);
  });
});
