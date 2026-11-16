import { createServerFn } from "@tanstack/react-start";
import { cleanText, inputFields } from "./safe-url";
import { normalizeIp } from "./guard";
import { db, dbErrorMessage } from "./server/db.server";
import { audit, clientIp, requireStaff } from "./server/auth.server";
import {
  ban,
  forgetBan,
  guardAllowList,
  guardBanHours,
  guardEnabled,
  guardForcedOff,
  guardSwitchOn,
  isProtected,
  setGuardSwitch,
} from "./server/guard.server";

// Funzioni server della pagina "Guardia" del gestionale (solo amministratore).

export type GuardBanRow = {
  ip: string;
  reason: string;
  detail: string;
  hits: number;
  manual: boolean;
  created_by: string;
  created_at: string;
  expires_at: string | null;
};

export type GuardStatus = {
  /** Sta proteggendo davvero (interruttore acceso e non spenta dall'ambiente). */
  enabled: boolean;
  /** Interruttore del gestionale. */
  switchOn: boolean;
  /** GUARDIA=spenta nell'ambiente del server: l'interruttore non basta. */
  forcedOff: boolean;
  switchedBy: string;
  switchedAt: string | null;
  banHours: number;
  allowList: string[];
  myIp: string;
  bans: GuardBanRow[];
};

export const getGuardStatus = createServerFn({ method: "GET" }).handler(
  async (): Promise<GuardStatus> => {
    await requireStaff("admin");
    const bans = await db()<GuardBanRow[]>`
      select ip, reason, detail, hits, manual, created_by, created_at::text, expires_at::text
      from guard_bans where expires_at is null or expires_at > now()
      order by created_at desc limit 500`;
    const [setting] = await db()<{ updated_by: string; updated_at: string }[]>`
      select updated_by, updated_at::text from guard_settings where id = 1`.catch(() => []);
    return {
      enabled: guardEnabled(),
      switchOn: guardSwitchOn(),
      forcedOff: guardForcedOff(),
      switchedBy: setting?.updated_by ?? "",
      switchedAt: setting?.updated_by ? setting.updated_at : null,
      banHours: guardBanHours(),
      allowList: guardAllowList(),
      myIp: clientIp(),
      bans,
    };
  },
);

/** Accende o spegne la guardia. I blocchi già fatti restano; da spenta non blocca e non conta più nulla. */
export const setGuardActive = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => ({ on: inputFields<"on">(d).on === true }))
  .handler(async ({ data }): Promise<{ ok: true } | { ok: false; error: string }> => {
    const me = await requireStaff("admin");
    try {
      await setGuardSwitch(data.on, me.username);
      await audit(me, data.on ? "guardia accesa" : "guardia spenta", "guardia");
      return { ok: true };
    } catch (e) {
      return { ok: false, error: dbErrorMessage(e) };
    }
  });

/** Sbanna un indirizzo: la riga sparisce, nel registro resta chi l'ha sbloccato. */
export const unbanIp = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => ({ ip: normalizeIp(cleanText(inputFields<"ip">(d).ip, 45)) }))
  .handler(async ({ data }): Promise<{ ok: true } | { ok: false; error: string }> => {
    const me = await requireStaff("admin");
    if (!data.ip) return { ok: false, error: "Indirizzo IP non valido." };
    try {
      const rows = await db()<
        { ip: string }[]
      >`delete from guard_bans where ip = ${data.ip} returning ip`;
      forgetBan(data.ip);
      if (!rows.length) return { ok: false, error: "Questo indirizzo non è bloccato." };
      await audit(me, "sbanna", "guardia", data.ip);
      return { ok: true };
    } catch (e) {
      return { ok: false, error: dbErrorMessage(e) };
    }
  });

/** Blocca a mano un indirizzo (mai il proprio, né quelli consentiti). */
export const banIpManually = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => {
    const o = inputFields<"hours" | "ip" | "reason">(d);
    const hours = Number(o.hours);
    return {
      ip: normalizeIp(cleanText(o.ip, 45)),
      reason: cleanText(o.reason, 200),
      hours: Number.isFinite(hours) && hours > 0 ? Math.min(hours, 24 * 365) : 0,
    };
  })
  .handler(async ({ data }): Promise<{ ok: true } | { ok: false; error: string }> => {
    const me = await requireStaff("admin");
    if (!data.ip) return { ok: false, error: "Indirizzo IP non valido." };
    if (data.ip === normalizeIp(clientIp()))
      return { ok: false, error: "È il tuo indirizzo: bloccandolo resteresti fuori." };
    if (isProtected(data.ip))
      return {
        ok: false,
        error: "Indirizzo protetto (questo computer, gateway di Docker o GUARDIA_CONSENTITI).",
      };
    try {
      await ban(data.ip, data.reason || "bloccato dall'amministratore", {
        by: me.username,
        userId: me.id,
        hours: data.hours,
        manual: true,
      });
      return { ok: true };
    } catch (e) {
      return { ok: false, error: dbErrorMessage(e) };
    }
  });
