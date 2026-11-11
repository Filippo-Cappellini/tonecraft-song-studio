// Pezzi comuni delle pagine del gestionale: intestazioni, riquadri, campi e messaggi.
import { queryOptions, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { getStaffStatus, staffLogout } from "@/lib/staff.functions";
import { can, type Permission } from "@/lib/staff-roles";
import { cn } from "@/lib/utils";

export const staffStatusQuery = queryOptions({
  queryKey: ["staff", "status"],
  queryFn: () => getStaffStatus(),
  staleTime: 60_000,
});

/** Utente collegato (la pagina del gestionale lo ha già caricato). */
export function useStaff() {
  const { data } = useQuery(staffStatusQuery);
  const user = data?.user ?? null;
  return { user, can: (p: Permission) => can(user?.role, p) };
}

/** Uscita: chiude la sessione e dimentica i dati del gestionale già caricati. */
export function useStaffLogout() {
  const qc = useQueryClient();
  return async () => {
    await staffLogout();
    qc.removeQueries({ queryKey: ["gestionale"] });
    await qc.invalidateQueries({ queryKey: staffStatusQuery.queryKey });
  };
}

export function PageTitle({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string | undefined;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="font-display text-3xl tracking-tight sm:text-4xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Panel({
  title,
  children,
  className,
  actions,
}: {
  title?: string;
  children: ReactNode;
  className?: string;
  actions?: ReactNode;
}) {
  return (
    <section className={cn("rounded-2xl border bg-card/60 p-5", className)}>
      {(title || actions) && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          {title && <h2 className="text-lg font-semibold">{title}</h2>}
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

export function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-2xl border bg-card/60 p-4">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 font-display text-2xl tabular-nums">{value}</div>
      {hint && <div className="mt-0.5 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}

export function Field({
  label,
  children,
  help,
  className,
}: {
  label: string;
  children: ReactNode;
  help?: string | undefined;
  className?: string | undefined;
}) {
  return (
    <label className={cn("block text-sm", className)}>
      <span className="mb-1 block font-medium">{label}</span>
      {children}
      {help && <span className="mt-1 block text-xs text-muted-foreground">{help}</span>}
    </label>
  );
}

export const inputClass =
  "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary disabled:opacity-60";

export function Errors({ errors }: { errors: readonly string[] }) {
  if (!errors.length) return null;
  return (
    <div
      role="alert"
      className="rounded-lg border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive-foreground"
    >
      {errors.map((e) => (
        <div key={e}>{e}</div>
      ))}
    </div>
  );
}

export function Notice({ children }: { children: ReactNode }) {
  return (
    <div
      role="status"
      className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200"
    >
      {children}
    </div>
  );
}

export function Forbidden() {
  return (
    <Panel>
      <p className="text-sm text-muted-foreground">
        Il tuo ruolo non può aprire questa sezione. Chiedi all'amministratore.
      </p>
    </Panel>
  );
}

/** Data e ora da un timestamptz di PostgreSQL in testo ("2026-11-11 09:30:00.12+01"). */
export const fmtDate = (pg: string | null | undefined) => {
  if (!pg) return "—";
  const iso = pg.replace(" ", "T").replace(/([+-]\d\d)$/, "$1:00");
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? pg
    : d.toLocaleString("it-IT", { dateStyle: "short", timeStyle: "short" });
};

/** Errore di una funzione server in testo da mostrare. */
export const errorText = (e: unknown) =>
  e instanceof Error ? e.message : "Operazione non riuscita.";
