import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { shopLink } from "@/lib/shop";
import { isTableName, TABLE_NAMES, TABLES, validateRow, validId, type Column } from "@/lib/admin-tables";
import { can, canAny, passwordProblem, ROLE_IDS, USERNAME_RE } from "@/lib/staff-roles";

// auth.server.ts legge cookie e richiesta da TanStack Start: qui servono solo le funzioni sulle password.
vi.mock("@tanstack/react-start/server", () => ({}));
vi.mock("@/lib/server/db.server", () => ({ db: () => { throw new Error("niente database nei test"); } }));

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
  it("l'amministratore può tutto, il redattore modifica i dati, la sola lettura consulta", () => {
    expect(can("admin", "admin")).toBe(true);
    expect(can("catalogo", "catalogo")).toBe(true);
    expect(can("catalogo", "admin")).toBe(false);
    expect(can("lettura", "vedere")).toBe(true);
    expect(can("lettura", "catalogo")).toBe(false);
    expect(canAny("lettura", ["catalogo", "admin"])).toBe(false);
    expect(can(null, "vedere")).toBe(false);
    expect(can("vendite" as never, "vedere")).toBe(false); // ruolo eliminato
    expect(ROLE_IDS.filter((r) => can(r, "admin"))).toEqual(["admin"]);
    expect(ROLE_IDS.every((r) => can(r, "vedere"))).toBe(true);
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

describe("account e accesso con Google", () => {
  it("l'accesso con Google si accende solo con chiavi e indirizzo https (o localhost)", async () => {
    const { googleConfig } = await import("@/lib/google-auth");
    const keys = { GOOGLE_CLIENT_ID: "id.apps.googleusercontent.com", GOOGLE_CLIENT_SECRET: "segreto" };
    expect(googleConfig({})).toBeNull();
    expect(googleConfig({ ...keys, PUBLIC_URL: "http://tono.local:3000" })).toBeNull();
    expect(googleConfig({ ...keys, PUBLIC_URL: "https://tono.example.it/qualcosa" })?.publicUrl).toBe("https://tono.example.it");
    expect(googleConfig({ ...keys, PUBLIC_URL: "http://localhost:3000" })?.publicUrl).toBe("http://localhost:3000");
  });

  it("l'indirizzo di Google chiede solo openid/email/profilo con PKCE, state e nonce", async () => {
    const { authUrl } = await import("@/lib/google-auth");
    const u = new URL(authUrl({ clientId: "cid", clientSecret: "x", publicUrl: "https://tono.example.it" }, { state: "s1", nonce: "n1", codeChallenge: "c1" }));
    expect(u.origin).toBe("https://accounts.google.com");
    expect(Object.fromEntries(u.searchParams)).toMatchObject({
      client_id: "cid", redirect_uri: "https://tono.example.it/api/google/ritorno", response_type: "code",
      scope: "openid email profile", state: "s1", nonce: "n1", code_challenge: "c1", code_challenge_method: "S256",
    });
    expect(u.searchParams.has("client_secret")).toBe(false);
  });

  it("accetta solo id_token di Google per questa app, non scaduti, con il nonce giusto ed email verificata", async () => {
    const { checkIdToken, decodeJwtPayload } = await import("@/lib/google-auth");
    const now = 1_800_000_000;
    const good = { iss: "https://accounts.google.com", aud: "cid", exp: now + 300, nonce: "n1", email_verified: true, sub: "1234567890", email: "Niccolò.Rossi@Gmail.com", name: "Niccolò Rossi" };
    const jwt = (o: object) => `x.${Buffer.from(JSON.stringify(o)).toString("base64url")}.firma`;
    const exp = { clientId: "cid", nonce: "n1", nowSec: now };
    expect(checkIdToken(decodeJwtPayload(jwt(good)), exp)).toEqual({ sub: "1234567890", email: "niccolò.rossi@gmail.com", name: "Niccolò Rossi" });
    expect(checkIdToken(decodeJwtPayload(jwt({ ...good, aud: "altra-app" })), exp)).toEqual({ error: "destinatario" });
    expect(checkIdToken(decodeJwtPayload(jwt({ ...good, iss: "https://evil.example" })), exp)).toEqual({ error: "emittente" });
    expect(checkIdToken(decodeJwtPayload(jwt({ ...good, exp: now - 3600 })), exp)).toEqual({ error: "scaduto" });
    expect(checkIdToken(decodeJwtPayload(jwt({ ...good, nonce: "altro" })), exp)).toEqual({ error: "nonce" });
    expect(checkIdToken(decodeJwtPayload(jwt({ ...good, email_verified: false })), exp)).toEqual({ error: "email non verificata" });
    expect(checkIdToken(decodeJwtPayload("non-un-token"), exp)).toEqual({ error: "token illeggibile" });
  });

  it("crea un nome utente valido dall'email", async () => {
    const { usernameFromEmail } = await import("@/lib/google-auth");
    expect(usernameFromEmail("Mario.Rossi+chitarra@gmail.com")).toBe("mario.rossi");
    expect(usernameFromEmail("é@x.it")).toMatch(USERNAME_RE);
    expect(usernameFromEmail("_.ab.-@x.it")).toMatch(USERNAME_RE);
    expect(usernameFromEmail(`${"a".repeat(60)}@x.it`)).toMatch(USERNAME_RE);
  });

  it("i nuovi account sono in sola lettura e le registrazioni si possono chiudere", async () => {
    const { SIGNUP_ROLE, signupOpen } = await import("@/lib/staff-roles");
    expect(SIGNUP_ROLE).toBe("lettura");
    expect(can(SIGNUP_ROLE, "catalogo")).toBe(false);
    expect(signupOpen({})).toBe(true);
    expect(signupOpen({ REGISTRAZIONI: "chiuse" })).toBe(false);
  });

  it("limita le registrazioni dallo stesso indirizzo", async () => {
    const { overLimit } = await import("@/lib/server/auth.server");
    const t = 5_000_000;
    for (let i = 0; i < 5; i++) expect(overLimit("signup:test", 5, 3_600_000, t + i)).toBe(false);
    expect(overLimit("signup:test", 5, 3_600_000, t + 10)).toBe(true);
    expect(overLimit("signup:test", 5, 3_600_000, t + 3_700_000)).toBe(false);
  });
});
