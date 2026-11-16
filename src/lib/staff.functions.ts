import { createServerFn } from "@tanstack/react-start";
import { cleanText, inputFields, inputObject } from "./safe-url";
import { isRole, passwordProblem, SIGNUP_ROLE, USERNAME_RE } from "./staff-roles";
import { EMAIL_RE } from "./google-auth";
import { BAN_POINTS } from "./guard";
import { isSignupMode, TRAP_FIELD, type SignupMode } from "./signup";
import { googleEnabled } from "./server/google.server";
import { db, dbErrorMessage, hasLocalDb } from "./server/db.server";
import { penalize } from "./server/guard.server";
import {
  consumeSignupToken,
  issueSignupToken,
  saveSignupSettings,
  signupSettings,
} from "./server/signup.server";
import {
  audit,
  clientIp,
  currentStaff,
  endSession,
  fakeVerify,
  hashPassword,
  loginFailed,
  loginLocked,
  loginSucceeded,
  endOtherSessions,
  overLimit,
  requireStaff,
  startSession,
  verifyPassword,
  type Staff,
} from "./server/auth.server";

// Funzioni server dell'accesso al gestionale e della gestione utenti.

export type StaffStatus = {
  configured: boolean;
  user: Staff | null;
  signupOpen: boolean;
  /** Gli account nuovi aspettano l'approvazione dell'amministratore. */
  signupApproval: boolean;
  google: boolean;
};

export const getStaffStatus = createServerFn({ method: "GET" }).handler(
  async (): Promise<StaffStatus> => {
    if (!hasLocalDb())
      return {
        configured: false,
        user: null,
        signupOpen: false,
        signupApproval: false,
        google: false,
      };
    const { mode } = await signupSettings();
    return {
      configured: true,
      user: await currentStaff(),
      signupOpen: mode !== "chiuse",
      signupApproval: mode === "approvazione",
      google: googleEnabled(),
    };
  },
);

/** Gettone del modulo di iscrizione: misura il tempo di compilazione (un bot invia in un attimo). */
export const getSignupToken = createServerFn({ method: "GET" }).handler(async () => ({
  token: issueSignupToken(),
}));

export type SignupResult = { ok: true; pending: boolean } | { ok: false; error: string };

/**
 * Registrazione: account nuovo in sola lettura. Con le iscrizioni "aperte" si entra subito, "con approvazione"
 * l'account aspetta l'amministratore. Difese dai bot: campo trappola, tempo minimo di compilazione (gettone),
 * limite per indirizzo e limite globale all'ora; i bot riconosciuti vengono segnalati alla guardia.
 */
export const staffSignup = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => {
    const o = inputFields<
      "username" | "full_name" | "email" | "password" | "token" | typeof TRAP_FIELD
    >(d);
    return {
      username: cleanText(o.username, 40).toLowerCase(),
      full_name: cleanText(o.full_name, 120),
      email: cleanText(o.email, 254).toLowerCase(),
      password: typeof o.password === "string" ? o.password.slice(0, 300) : "",
      token: cleanText(o.token, 200),
      trap: cleanText(o[TRAP_FIELD], 200),
    };
  })
  .handler(async ({ data }): Promise<SignupResult> => {
    if (!hasLocalDb()) return { ok: false, error: "Account non disponibili su questo server." };
    const settings = await signupSettings();
    if (settings.mode === "chiuse")
      return {
        ok: false,
        error: "Le registrazioni sono chiuse: chiedi un account all'amministratore.",
      };
    const ip = clientIp();
    const who = { id: null, username: data.username || "?" };

    // Campo trappola compilato: è un bot. Risposta finta di successo (così non capisce), indirizzo bloccato.
    if (data.trap) {
      penalize(
        ip,
        { points: BAN_POINTS, reason: "bot di registrazione (campo trappola)" },
        data.username,
      );
      await audit(who, "registrazione bloccata", "utente", "", `${ip} · campo trappola`);
      return { ok: true, pending: true };
    }
    const token = consumeSignupToken(data.token);
    if (token === "veloce") {
      penalize(ip, { points: 4, reason: "bot di registrazione (modulo inviato in un attimo)" });
      return {
        ok: false,
        error: "Hai compilato il modulo troppo in fretta. Aspetta qualche secondo e riprova.",
      };
    }
    if (token !== "ok") {
      if (token === "non valido")
        penalize(ip, { points: 4, reason: "bot di registrazione (gettone falso o mancante)" });
      return { ok: false, error: "Il modulo è scaduto: ricarica la pagina e riprova." };
    }

    if (!USERNAME_RE.test(data.username))
      return { ok: false, error: "Nome utente: 3-32 caratteri tra minuscole, cifre, . _ -" };
    if (!data.full_name) return { ok: false, error: "Scrivi nome e cognome." };
    if (data.email && !EMAIL_RE.test(data.email)) return { ok: false, error: "Email non valida." };
    const problem = passwordProblem(data.password, data.username);
    if (problem) return { ok: false, error: problem };
    // Al massimo 5 account all'ora dallo stesso indirizzo, e `perHour` da tutti insieme.
    if (overLimit(`signup:${ip}`, 5, 60 * 60 * 1000)) {
      penalize(ip, { points: 3, reason: "troppe registrazioni dallo stesso indirizzo" });
      return { ok: false, error: "Troppe registrazioni. Riprova più tardi." };
    }
    if (overLimit("signup:tutti", settings.perHour, 60 * 60 * 1000)) {
      await audit(who, "registrazione rifiutata", "utente", "", `${ip} · limite globale`);
      return {
        ok: false,
        error: "Troppe registrazioni in questo momento. Riprova tra un'ora.",
      };
    }
    const pending = settings.mode === "approvazione";
    try {
      const [row] = await db()<{ id: string }[]>`
        insert into staff_users (username, full_name, role, email, password_hash, active, pending)
        values (${data.username}, ${data.full_name}, ${SIGNUP_ROLE}, ${data.email || null},
                ${await hashPassword(data.password)}, ${!pending}, ${pending})
        returning id`;
      if (!pending) await startSession(row!.id);
      await audit(
        { id: row!.id, username: data.username },
        pending ? "registrazione (in attesa di approvazione)" : "registrazione",
        "utente",
        row!.id,
        ip,
      );
      return { ok: true, pending };
    } catch (e) {
      const code = typeof e === "object" && e && "code" in e ? (e as { code: string }).code : "";
      if (code === "23505") return { ok: false, error: "Nome utente o email già in uso." };
      return { ok: false, error: dbErrorMessage(e) };
    }
  });

/** Scollega Google dal proprio account (solo se c'è una password, per non restare chiusi fuori). */
export const unlinkGoogle = createServerFn({ method: "POST" }).handler(
  async (): Promise<{ ok: true } | { ok: false; error: string }> => {
    const me = await requireStaff();
    const [row] = await db()<{ id: string }[]>`
      update staff_users set google_sub = null
      where id = ${me.id} and password_hash is not null and google_sub is not null returning id`;
    if (!row)
      return { ok: false, error: "Prima crea una password, altrimenti non potresti più entrare." };
    await audit(me, "scollega Google", "utente", me.id);
    return { ok: true };
  },
);

/** Dati del proprio account (per la pagina "Il mio account"). */
export const getMyAccount = createServerFn({ method: "GET" }).handler(async () => {
  const me = await requireStaff();
  const [row] = await db()<{ email: string | null; has_password: boolean; google: boolean }[]>`
    select email, password_hash is not null as has_password, google_sub is not null as google
    from staff_users where id = ${me.id}`;
  return {
    ...me,
    email: row?.email ?? null,
    hasPassword: !!row?.has_password,
    google: !!row?.google,
  };
});

export const staffLogin = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => {
    const o = inputFields<"password" | "username">(d);
    return {
      username: cleanText(o.username, 32).toLowerCase(),
      password: typeof o.password === "string" ? o.password.slice(0, 200) : "",
    };
  })
  .handler(async ({ data }): Promise<{ ok: true } | { ok: false; error: string }> => {
    if (!hasLocalDb()) return { ok: false, error: "Gestionale non configurato su questo server." };
    const keys = [`ip:${clientIp()}`, `user:${data.username}`];
    if (keys.some((k) => loginLocked(k)))
      return { ok: false, error: "Troppi tentativi. Riprova tra 10 minuti." };
    const rows = await db()<
      {
        id: string;
        username: string;
        password_hash: string | null;
        active: boolean;
        pending: boolean;
      }[]
    >`
      select id, username, password_hash, active, pending from staff_users where username = ${data.username}`;
    const u = rows[0];
    const ok = u
      ? await verifyPassword(data.password, u.password_hash)
      : await fakeVerify(data.password);
    // Password giusta ma account non ancora approvato: lo si dice (solo a chi conosce la password).
    if (u && ok && !u.active && u.pending)
      return {
        ok: false,
        error: "Il tuo account è in attesa di approvazione dell'amministratore.",
      };
    if (!u || !ok || !u.active) {
      keys.forEach((k) => loginFailed(k));
      await audit(
        { id: u?.id ?? null, username: data.username || "?" },
        "accesso fallito",
        "sessione",
        "",
        clientIp(),
      );
      return { ok: false, error: "Nome utente o password errati." };
    }
    keys.forEach(loginSucceeded);
    await startSession(u.id);
    await audit({ id: u.id, username: u.username }, "accesso", "sessione", "", clientIp());
    return { ok: true };
  });

export const staffLogout = createServerFn({ method: "POST" }).handler(async () => {
  if (hasLocalDb()) await endSession();
  return { ok: true };
});

export const changeOwnPassword = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => {
    const o = inputFields<"current" | "next">(d);
    const s = (v: unknown) => (typeof v === "string" ? v.slice(0, 300) : "");
    return { current: s(o.current), next: s(o.next) };
  })
  .handler(async ({ data }) => {
    const me = await requireStaff();
    const problem = passwordProblem(data.next, me.username);
    if (problem) return { ok: false as const, error: problem };
    const sql = db();
    const [row] = await sql<
      { password_hash: string | null }[]
    >`select password_hash from staff_users where id = ${me.id}`;
    // Chi è entrato solo con Google non ha una password attuale: può crearne una.
    if (
      !row ||
      (row.password_hash !== null && !(await verifyPassword(data.current, row.password_hash)))
    )
      return { ok: false as const, error: "La password attuale non è corretta." };
    await sql`update staff_users set password_hash = ${await hashPassword(data.next)} where id = ${me.id}`;
    // Le altre sessioni aperte con la vecchia password vengono chiuse; questa resta valida.
    await endOtherSessions(me.id);
    await audit(me, "cambio password", "utente", me.id);
    return { ok: true as const };
  });

// --- Utenti (solo amministratore) ---------------------------------------------------------------
export type StaffUserRow = Staff & {
  active: boolean;
  /** In attesa di approvazione (iscrizione "con approvazione"). */
  pending: boolean;
  email: string | null;
  google: boolean;
  created_at: string;
  last_login_at: string | null;
};

export const listStaffUsers = createServerFn({ method: "GET" }).handler(async () => {
  await requireStaff("admin");
  return db()<StaffUserRow[]>`
    select id, username, full_name, role, active, pending, email, google_sub is not null as google,
           created_at::text, last_login_at::text
    from staff_users order by pending desc, active desc, created_at desc`;
});

export const saveStaffUser = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => {
    const o = inputFields<"active" | "full_name" | "id" | "password" | "role" | "username">(d);
    return {
      id: typeof o.id === "string" && /^[0-9a-f-]{36}$/i.test(o.id) ? o.id : null,
      username: cleanText(o.username, 40).toLowerCase(),
      full_name: cleanText(o.full_name, 120),
      role: isRole(o.role) ? o.role : null,
      active: o.active !== false,
      password: typeof o.password === "string" ? o.password.slice(0, 300) : "",
    };
  })
  .handler(async ({ data }): Promise<{ ok: true } | { ok: false; error: string }> => {
    const me = await requireStaff("admin");
    if (!data.role) return { ok: false, error: "Ruolo non valido." };
    if (!data.full_name) return { ok: false, error: "Il nome è obbligatorio." };
    if (!data.id && !USERNAME_RE.test(data.username))
      return { ok: false, error: "Nome utente: 3-32 caratteri tra minuscole, cifre, . _ -" };
    if (data.password || !data.id) {
      const problem = passwordProblem(data.password, data.username);
      if (problem) return { ok: false, error: problem };
    }
    const sql = db();
    try {
      const id = await sql.begin(async (tx) => {
        if (data.id) {
          // Attivare un account in attesa equivale ad approvarlo.
          await tx`update staff_users set full_name = ${data.full_name}, role = ${data.role!}, active = ${data.active},
                   pending = pending and not ${data.active} where id = ${data.id}`;
          if (data.password)
            await tx`update staff_users set password_hash = ${await hashPassword(data.password)} where id = ${data.id}`;
          // Password nuova o utente disattivato: le sessioni aperte vengono chiuse.
          if (data.password || !data.active)
            await tx`delete from staff_sessions where user_id = ${data.id}`;
          // Deve restare almeno un amministratore attivo.
          const [count] = await tx<
            { admins: number }[]
          >`select count(*)::int as admins from staff_users where role = 'admin' and active`;
          if (!count?.admins) throw new Error("ULTIMO_ADMIN");
          return data.id;
        }
        const [row] = await tx<{ id: string }[]>`
          insert into staff_users (username, full_name, role, password_hash)
          values (${data.username}, ${data.full_name}, ${data.role!}, ${await hashPassword(data.password)}) returning id`;
        return row!.id;
      });
      const what = data.id
        ? data.password
          ? "modifica utente e password"
          : "modifica utente"
        : "nuovo utente";
      await audit(
        me,
        what,
        "utente",
        id,
        `${data.username || ""} ${data.role}${data.active ? "" : " (disattivato)"}`.trim(),
      );
      return { ok: true };
    } catch (e) {
      if (e instanceof Error && e.message === "ULTIMO_ADMIN")
        return { ok: false, error: "Deve restare almeno un amministratore attivo." };
      return { ok: false, error: dbErrorMessage(e) };
    }
  });

export type AuditRow = {
  id: number;
  username: string;
  action: string;
  entity: string;
  entity_id: string;
  detail: string;
  created_at: string;
};

export const listAudit = createServerFn({ method: "GET" }).handler(async () => {
  await requireStaff("admin");
  return db()<
    AuditRow[]
  >`select id, username, action, entity, entity_id, detail, created_at::text from audit_log order by id desc limit 200`;
});

// --- Iscrizioni (solo amministratore) -----------------------------------------------------------
export type SignupAdmin = { mode: SignupMode; perHour: number; forcedClosed: boolean };

export const getSignupAdmin = createServerFn({ method: "GET" }).handler(
  async (): Promise<SignupAdmin> => {
    await requireStaff("admin");
    return signupSettings();
  },
);

export const saveSignupAdmin = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => {
    const o = inputFields<"mode" | "perHour">(d);
    const perHour = Math.round(Number(o.perHour));
    return {
      mode: isSignupMode(o.mode) ? o.mode : null,
      perHour: Number.isFinite(perHour) ? perHour : 0,
    };
  })
  .handler(async ({ data }): Promise<{ ok: true } | { ok: false; error: string }> => {
    const me = await requireStaff("admin");
    if (!data.mode) return { ok: false, error: "Modalità non valida." };
    if (data.perHour < 1 || data.perHour > 1000)
      return { ok: false, error: "Iscrizioni all'ora: da 1 a 1000." };
    try {
      await saveSignupSettings(data.mode, data.perHour, me.username);
      await audit(me, "impostazioni iscrizioni", "utente", "", `${data.mode}, ${data.perHour}/ora`);
      return { ok: true };
    } catch (e) {
      return { ok: false, error: dbErrorMessage(e) };
    }
  });

const BULK_ACTIONS = ["approva", "disattiva", "elimina"] as const;
type BulkAction = (typeof BULK_ACTIONS)[number];
const UUID_RE = /^[0-9a-f-]{36}$/i;

/** Approva, disattiva o elimina più utenti insieme (es. gli account creati da un bot). Mai sé stessi. */
export const bulkStaffUsers = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => {
    const o = inputFields<"action" | "ids">(d);
    const ids = Array.isArray(o.ids)
      ? [...new Set(o.ids.filter((x): x is string => typeof x === "string" && UUID_RE.test(x)))]
      : [];
    return {
      action: (BULK_ACTIONS as readonly unknown[]).includes(o.action)
        ? (o.action as BulkAction)
        : null,
      ids: ids.slice(0, 1000),
    };
  })
  .handler(
    async ({ data }): Promise<{ ok: true; count: number } | { ok: false; error: string }> => {
      const me = await requireStaff("admin");
      if (!data.action) return { ok: false, error: "Azione non valida." };
      const ids = data.ids.filter((id) => id !== me.id);
      if (!ids.length)
        return { ok: false, error: "Nessun utente selezionato (te stesso non puoi)." };
      try {
        const names = await db().begin(async (tx) => {
          let rows: { username: string }[];
          if (data.action === "approva")
            rows = await tx<{ username: string }[]>`
            update staff_users set active = true, pending = false
            where id = any(${ids}::uuid[]) returning username`;
          else if (data.action === "disattiva") {
            rows = await tx<{ username: string }[]>`
            update staff_users set active = false, pending = false
            where id = any(${ids}::uuid[]) returning username`;
            await tx`delete from staff_sessions where user_id = any(${ids}::uuid[])`;
          } else
            rows = await tx<{ username: string }[]>`
            delete from staff_users where id = any(${ids}::uuid[]) returning username`;
          // Deve restare almeno un amministratore attivo.
          const [count] = await tx<
            { admins: number }[]
          >`select count(*)::int as admins from staff_users where role = 'admin' and active`;
          if (!count?.admins) throw new Error("ULTIMO_ADMIN");
          return rows.map((r) => r.username);
        });
        const label = {
          approva: "approva utenti",
          disattiva: "disattiva utenti",
          elimina: "elimina utenti",
        };
        await audit(me, label[data.action], "utente", "", `${names.length}: ${names.join(", ")}`);
        return { ok: true, count: names.length };
      } catch (e) {
        if (e instanceof Error && e.message === "ULTIMO_ADMIN")
          return { ok: false, error: "Deve restare almeno un amministratore attivo." };
        return { ok: false, error: dbErrorMessage(e) };
      }
    },
  );
