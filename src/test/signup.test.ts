import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/server/db.server", () => ({
  db: () => {
    throw new Error("niente database nei test");
  },
  hasLocalDb: () => false,
}));

const s = await import("@/lib/server/signup.server");

describe("iscrizioni: gettone del modulo", () => {
  beforeEach(() => s.resetSignupForTests());

  it("rifiuta chi invia il modulo in un attimo, poi lo accetta una sola volta", () => {
    const t0 = 1_800_000_000_000;
    const token = s.issueSignupToken(t0);
    expect(s.consumeSignupToken(token, t0 + 500)).toBe("veloce");
    // Il tentativo troppo veloce non consuma il gettone: una persona può riprovare.
    expect(s.consumeSignupToken(token, t0 + s.MIN_FORM_MS + 1)).toBe("ok");
    // Un bot non può riusarlo per creare altri account.
    expect(s.consumeSignupToken(token, t0 + 60_000)).toBe("scaduto");
  });

  it("rifiuta gettoni falsi, modificati o scaduti", () => {
    const t0 = 1_800_000_000_000;
    const token = s.issueSignupToken(t0);
    expect(s.consumeSignupToken("", t0)).toBe("non valido");
    expect(s.consumeSignupToken("123.abc.def", t0)).toBe("non valido");
    // Istante cambiato per sembrare un modulo aperto da tempo: la firma non torna più.
    const [, nonce, sig] = token.split(".");
    expect(s.consumeSignupToken(`${t0 - 60_000}.${nonce}.${sig}`, t0)).toBe("non valido");
    expect(s.consumeSignupToken(token, t0 + s.MAX_FORM_MS + 1)).toBe("scaduto");
  });

  it("senza database restano le regole di prima (aperte) e REGISTRAZIONI=chiuse vince", async () => {
    expect((await s.signupSettings()).mode).toBe("aperte");
    vi.stubEnv("REGISTRAZIONI", "chiuse");
    expect(await s.signupSettings()).toMatchObject({ mode: "chiuse", forcedClosed: true });
    vi.unstubAllEnvs();
  });
});

describe("iscrizioni: difese nel codice", () => {
  const src = readFileSync(path.resolve("src/lib/staff.functions.ts"), "utf8");
  const signup = src.split("export const staffSignup")[1]!.split("export const")[0]!;

  it("il modulo controlla campo trappola, gettone, limite per indirizzo e limite globale", () => {
    expect(signup).toMatch(/data\.trap/);
    expect(signup).toMatch(/consumeSignupToken\(/);
    expect(signup).toMatch(/overLimit\(`signup:\$\{ip\}`/);
    expect(signup).toMatch(/overLimit\("signup:tutti"/);
    expect(signup).toMatch(/penalize\(/);
    // Con l'approvazione l'account nasce disattivato e non apre una sessione.
    expect(signup).toMatch(/\$\{!pending\}, \$\{pending\}/);
    expect(signup).toMatch(/if \(!pending\) await startSession/);
  });

  it("anche l'iscrizione con Google rispetta modalità e limite globale", () => {
    const google = readFileSync(path.resolve("src/lib/server/google.server.ts"), "utf8");
    expect(google).toMatch(/signupSettings\(\)/);
    expect(google).toMatch(/overLimit\("signup:tutti"/);
    expect(google).toMatch(/\$\{!pending\}, \$\{pending\}/);
  });

  it("le azioni in blocco non toccano mai l'utente collegato e tengono un amministratore", () => {
    const bulk = src.split("export const bulkStaffUsers")[1]!;
    expect(bulk).toMatch(/filter\(\(id\) => id !== me\.id\)/);
    expect(bulk).toMatch(/ULTIMO_ADMIN/);
  });
});
