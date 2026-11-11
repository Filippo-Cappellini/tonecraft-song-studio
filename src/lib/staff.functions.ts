import { createServerFn } from "@tanstack/react-start";
import { cleanText, inputFields, inputObject } from "./safe-url";
import { isRole, passwordProblem, SIGNUP_ROLE, signupOpen, USERNAME_RE } from "./staff-roles";
import { EMAIL_RE } from "./google-auth";
import { googleEnabled } from "./server/google.server";
import { db, dbErrorMessage, hasLocalDb } from "./server/db.server";
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
  google: boolean;
};

export const getStaffStatus = createServerFn({ method: "GET" }).handler(
  async (): Promise<StaffStatus> => {
    if (!hasLocalDb()) return { configured: false, user: null, signupOpen: false, google: false };
    return {
      configured: true,
      user: await currentStaff(),
      signupOpen: signupOpen(process.env),
      google: googleEnabled(),
    };
  },
);

/** Registrazione: account nuovo in sola lettura, poi accesso immediato. */
export const staffSignup = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => {
    const o = inputFields<"username" | "full_name" | "email" | "password">(d);
    return {
      username: cleanText(o.username, 40).toLowerCase(),
      full_name: cleanText(o.full_name, 120),
      email: cleanText(o.email, 254).toLowerCase(),
      password: typeof o.password === "string" ? o.password.slice(0, 300) : "",
    };
  })
  .handler(async ({ data }): Promise<{ ok: true } | { ok: false; error: string }> => {
    if (!hasLocalDb()) return { ok: false, error: "Account non disponibili su questo server." };
    if (!signupOpen(process.env))
      return {
        ok: false,
        error: "Le registrazioni sono chiuse: chiedi un account all'amministratore.",
      };
    if (!USERNAME_RE.test(data.username))
      return { ok: false, error: "Nome utente: 3-32 caratteri tra minuscole, cifre, . _ -" };
    if (!data.full_name) return { ok: false, error: "Scrivi nome e cognome." };
    if (data.email && !EMAIL_RE.test(data.email)) return { ok: false, error: "Email non valida." };
    const problem = passwordProblem(data.password, data.username);
    if (problem) return { ok: false, error: problem };
    // Al massimo 5 account all'ora dallo stesso indirizzo.
    if (overLimit(`signup:${clientIp()}`, 5, 60 * 60 * 1000))
      return { ok: false, error: "Troppe registrazioni. Riprova più tardi." };
    try {
      const [row] = await db()<{ id: string }[]>`
        insert into staff_users (username, full_name, role, email, password_hash)
        values (${data.username}, ${data.full_name}, ${SIGNUP_ROLE}, ${data.email || null}, ${await hashPassword(data.password)})
        returning id`;
      await startSession(row!.id);
      await audit(
        { id: row!.id, username: data.username },
        "registrazione",
        "utente",
        row!.id,
        clientIp(),
      );
      return { ok: true };
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
      { id: string; username: string; password_hash: string | null; active: boolean }[]
    >`
      select id, username, password_hash, active from staff_users where username = ${data.username}`;
    const u = rows[0];
    const ok = u
      ? await verifyPassword(data.password, u.password_hash)
      : await fakeVerify(data.password);
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
  email: string | null;
  google: boolean;
  created_at: string;
  last_login_at: string | null;
};

export const listStaffUsers = createServerFn({ method: "GET" }).handler(async () => {
  await requireStaff("admin");
  return db()<StaffUserRow[]>`
    select id, username, full_name, role, active, email, google_sub is not null as google,
           created_at::text, last_login_at::text
    from staff_users order by active desc, username`;
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
          await tx`update staff_users set full_name = ${data.full_name}, role = ${data.role!}, active = ${data.active} where id = ${data.id}`;
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
