// Ruoli dello staff del gestionale e cosa può fare ciascuno. Usato sia dal server (controlli) sia dal menu.
export type Permission = "catalogo" | "magazzino" | "vendite" | "admin";
export type Role = "admin" | "catalogo" | "magazzino" | "vendite";

export const ROLES: Record<
  Role,
  { label: string; description: string; perms: readonly Permission[] }
> = {
  admin: {
    label: "Amministratore",
    description: "Tutto il gestionale, compresi utenti, negozi online e registro attività.",
    perms: ["catalogo", "magazzino", "vendite", "admin"],
  },
  catalogo: {
    label: "Redattore catalogo",
    description: "Modifica brani, strumenti, amplificatori, esercizi e corsi dell'app.",
    perms: ["catalogo"],
  },
  magazzino: {
    label: "Magazziniere",
    description: "Prodotti, giacenze, carichi e scarichi, fornitori; può anche vendere.",
    perms: ["magazzino", "vendite"],
  },
  vendite: {
    label: "Commesso",
    description: "Vendite al banco e clienti; vede i prodotti ma non li modifica.",
    perms: ["vendite"],
  },
};

export const ROLE_IDS = Object.keys(ROLES) as Role[];

export const isRole = (v: unknown): v is Role => typeof v === "string" && v in ROLES;

export function can(role: Role | null | undefined, perm: Permission): boolean {
  return !!role && isRole(role) && ROLES[role].perms.includes(perm);
}

/** Almeno uno dei permessi indicati. */
export const canAny = (role: Role | null | undefined, perms: readonly Permission[]) =>
  perms.some((p) => can(role, p));

/** Nome utente: minuscole, cifre, punto, trattino e trattino basso, 3-32 caratteri (come il vincolo nel database). */
export const USERNAME_RE = /^[a-z0-9._-]{3,32}$/;

/** Regole della password, uguali in scripts/crea-utente.mjs. */
export const PASSWORD_HINT =
  "Almeno 12 caratteri con almeno 3 tipi tra minuscole, maiuscole, cifre e simboli (oppure una frase di 20+ caratteri). Non deve contenere il nome utente.";

// Parti che rendono una password facile da indovinare.
const WEAK_PARTS = [
  "password",
  "passw0rd",
  "qwerty",
  "123456",
  "654321",
  "abcdef",
  "tonecraft",
  "letmein",
  "iloveyou",
];

/** Problema della password scelta, o null se va bene. Il limite di 200 evita di far lavorare troppo lo scrypt. */
export function passwordProblem(pw: string, username = ""): string | null {
  if (pw.length < 12) return "La password deve avere almeno 12 caratteri.";
  if (pw.length > 200) return "La password è troppo lunga.";
  const lower = pw.toLowerCase();
  if (username.length >= 3 && lower.includes(username.toLowerCase()))
    return "La password non deve contenere il nome utente.";
  if (WEAK_PARTS.some((w) => lower.includes(w)))
    return "La password contiene una sequenza troppo comune.";
  if (new Set(pw).size < 6) return "La password ha troppi caratteri ripetuti.";
  const kinds = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((r) => r.test(pw)).length;
  if (kinds < 3 && pw.length < 20)
    return "Usa almeno 3 tipi tra minuscole, maiuscole, cifre e simboli, oppure una frase di almeno 20 caratteri.";
  return null;
}
