// Pannelli della pagina "Utenti e registro": iscrizioni e protezione dai bot, account in attesa, elenco con
// selezione multipla (approva, disattiva o elimina in un colpo, per esempio gli account creati da un bot).
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import {
  Errors,
  errorText,
  Field,
  fmtDate,
  inputClass,
  Notice,
  Panel,
} from "@/components/gestionale/kit";
import {
  bulkStaffUsers,
  getSignupAdmin,
  saveSignupAdmin,
  type StaffUserRow,
} from "@/lib/staff.functions";
import { ROLES } from "@/lib/staff-roles";
import { SIGNUP_MODE_INFO, SIGNUP_MODES, type SignupMode } from "@/lib/signup";

type Result = { ok: true; count?: number } | { ok: false; error: string };

/** Esegue un'azione del gestionale, mostra esito o errore e aggiorna i dati. */
function useAction() {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [notice, setNotice] = useState("");
  const run = async (fn: () => Promise<Result>, ok: (count: number) => string) => {
    setBusy(true);
    setErrors([]);
    setNotice("");
    try {
      const r = await fn();
      if (!r.ok) {
        setErrors([r.error]);
        return false;
      }
      setNotice(ok(r.count ?? 0));
      await qc.invalidateQueries({ queryKey: ["gestionale"] });
      return true;
    } catch (e) {
      setErrors([errorText(e)]);
      return false;
    } finally {
      setBusy(false);
    }
  };
  return { busy, errors, notice, run };
}

function Feedback({ action }: { action: ReturnType<typeof useAction> }) {
  return (
    <>
      <Errors errors={action.errors} />
      {action.notice && (
        <div className="mb-3">
          <Notice>{action.notice}</Notice>
        </div>
      )}
    </>
  );
}

/** Iscrizioni: aperte, con approvazione o chiuse, e quante al massimo in un'ora da tutti insieme. */
export function SignupPanel() {
  const settings = useQuery({
    queryKey: ["gestionale", "signup"],
    queryFn: () => getSignupAdmin(),
  });
  const [draft, setDraft] = useState<{ mode: SignupMode; perHour: string } | null>(null);
  const action = useAction();
  const s = settings.data;
  const form = draft ?? (s ? { mode: s.mode, perHour: String(s.perHour) } : null);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!form) return;
    const ok = await action.run(
      () => saveSignupAdmin({ data: { mode: form.mode, perHour: Number(form.perHour) } }),
      () => "Impostazioni delle iscrizioni salvate.",
    );
    if (ok) setDraft(null);
  };

  return (
    <Panel title="Iscrizioni e protezione dai bot">
      {settings.isError && <Errors errors={[errorText(settings.error)]} />}
      {s?.forcedClosed && (
        <p className="mb-3 text-sm text-amber-200">
          Chiuse dal file di configurazione del server (REGISTRAZIONI=chiuse): togli quella riga per
          poterle cambiare da qui.
        </p>
      )}
      {form && (
        <form onSubmit={save} className="space-y-3">
          <fieldset className="grid gap-2 sm:grid-cols-3" disabled={s?.forcedClosed}>
            <legend className="sr-only">Modalità delle iscrizioni</legend>
            {SIGNUP_MODES.map((m) => (
              <label
                key={m}
                className={`cursor-pointer rounded-xl border p-3 text-sm ${form.mode === m ? "border-primary bg-primary/10" : ""}`}
              >
                <input
                  type="radio"
                  name="signup-mode"
                  className="mr-2"
                  checked={form.mode === m}
                  onChange={() => setDraft({ ...form, mode: m })}
                />
                <span className="font-medium">{SIGNUP_MODE_INFO[m].label}</span>
                <span className="mt-1 block text-xs text-muted-foreground">
                  {SIGNUP_MODE_INFO[m].description}
                </span>
              </label>
            ))}
          </fieldset>
          <div className="flex flex-wrap items-end gap-3">
            <Field
              label="Iscrizioni al massimo in un'ora (da tutti)"
              help="Ferma anche i bot che cambiano indirizzo. In più: 5 all'ora per indirizzo."
            >
              <input
                className={`${inputClass} w-32`}
                type="number"
                min={1}
                max={1000}
                value={form.perHour}
                onChange={(e) => setDraft({ ...form, perHour: e.target.value })}
              />
            </Field>
            <Button type="submit" disabled={action.busy || !draft}>
              Salva
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Sempre attivi: campo trappola nascosto e tempo minimo di compilazione del modulo. I bot
            riconosciuti vengono bloccati dalla Guardia.
          </p>
          <Feedback action={action} />
        </form>
      )}
    </Panel>
  );
}

/** Account in attesa di approvazione: approva o rifiuta, uno alla volta o tutti insieme. */
export function PendingPanel({ users }: { users: StaffUserRow[] }) {
  const action = useAction();
  const act = (ids: string[], what: "approva" | "elimina") =>
    action.run(
      () => bulkStaffUsers({ data: { ids, action: what } }),
      (n) =>
        what === "approva" ? `${n} account approvati.` : `${n} account rifiutati ed eliminati.`,
    );
  const allIds = users.map((u) => u.id);
  const rejectAll = () => {
    if (window.confirm(`Eliminare tutti i ${users.length} account in attesa?`))
      void act(allIds, "elimina");
  };
  return (
    <Panel
      title={`In attesa di approvazione (${users.length})`}
      className="mt-6 border-amber-500/40"
      actions={
        <div className="flex gap-2">
          <Button size="sm" disabled={action.busy} onClick={() => void act(allIds, "approva")}>
            Approva tutti
          </Button>
          <Button size="sm" variant="outline" disabled={action.busy} onClick={rejectAll}>
            Rifiuta tutti
          </Button>
        </div>
      }
    >
      <Feedback action={action} />
      <ul className="divide-y divide-border/50 text-sm">
        {users.map((u) => (
          <li key={u.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
            <div>
              <div className="font-medium">{u.full_name}</div>
              <div className="text-xs text-muted-foreground">
                {u.username}
                {u.email ? ` · ${u.email}` : ""}
                {u.google ? " · Google" : ""} · iscritto {fmtDate(u.created_at)}
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" disabled={action.busy} onClick={() => void act([u.id], "approva")}>
                Approva
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={action.busy}
                onClick={() => void act([u.id], "elimina")}
              >
                Rifiuta
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

const BULK_LABEL = {
  approva: "approvati",
  disattiva: "disattivati",
  elimina: "eliminati",
} as const;

/** Elenco degli utenti con ricerca e selezione multipla. */
export function UsersPanel({
  users,
  meId,
  error,
  onEdit,
}: {
  users: StaffUserRow[];
  meId: string;
  error: string | null;
  onEdit: (u: StaffUserRow) => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState("");
  const action = useAction();
  const q = filter.trim().toLowerCase();
  const shown = q
    ? users.filter((u) => `${u.username} ${u.full_name} ${u.email ?? ""}`.toLowerCase().includes(q))
    : users;
  const selectable = shown.filter((u) => u.id !== meId);
  const allChecked = selectable.length > 0 && selectable.every((u) => selected.has(u.id));
  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const bulk = async (what: keyof typeof BULK_LABEL) => {
    const ids = [...selected];
    if (
      what === "elimina" &&
      !window.confirm(`Eliminare definitivamente ${ids.length} account? Non si può annullare.`)
    )
      return;
    const ok = await action.run(
      () => bulkStaffUsers({ data: { ids, action: what } }),
      (n) => `${n} account ${BULK_LABEL[what]}.`,
    );
    if (ok) setSelected(new Set());
  };

  return (
    <Panel title={`Utenti (${users.length})`} className="mt-6">
      {error && <Errors errors={[error]} />}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input
          className={`${inputClass} max-w-xs`}
          placeholder="Cerca nome, utente o email"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          aria-label="Cerca utenti"
        />
        {selected.size > 0 && (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-muted-foreground">{selected.size} selezionati:</span>
            <Button size="sm" disabled={action.busy} onClick={() => void bulk("approva")}>
              Approva / attiva
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={action.busy}
              onClick={() => void bulk("disattiva")}
            >
              Disattiva
            </Button>
            <Button
              size="sm"
              variant="destructive"
              disabled={action.busy}
              onClick={() => void bulk("elimina")}
            >
              Elimina
            </Button>
          </div>
        )}
      </div>
      <Feedback action={action} />
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr className="border-b">
              <th className="w-8 py-2 pr-2">
                <input
                  type="checkbox"
                  aria-label="Seleziona tutti"
                  checked={allChecked}
                  onChange={() =>
                    setSelected(allChecked ? new Set() : new Set(selectable.map((u) => u.id)))
                  }
                />
              </th>
              <th className="py-2 pr-3">Utente</th>
              <th className="py-2 pr-3">Ruolo</th>
              <th className="py-2 pr-3">Iscritto</th>
              <th className="py-2 pr-3">Ultimo accesso</th>
              <th className="py-2" />
            </tr>
          </thead>
          <tbody>
            {shown.map((u) => (
              <tr
                key={u.id}
                className={`border-b border-border/50 ${u.active ? "" : "opacity-60"}`}
              >
                <td className="py-2 pr-2">
                  {u.id !== meId && (
                    <input
                      type="checkbox"
                      aria-label={`Seleziona ${u.username}`}
                      checked={selected.has(u.id)}
                      onChange={() => toggle(u.id)}
                    />
                  )}
                </td>
                <td className="py-2 pr-3">
                  <div className="font-medium">{u.full_name}</div>
                  <div className="text-xs text-muted-foreground">
                    {u.username}
                    {u.email ? ` · ${u.email}` : ""}
                    {u.google ? " · Google" : ""}
                    {u.pending && <span className="text-amber-300"> · in attesa</span>}
                    {!u.pending && !u.active ? " · disattivato" : ""}
                    {u.id === meId ? " · sei tu" : ""}
                  </div>
                </td>
                <td className="py-2 pr-3">{ROLES[u.role].label}</td>
                <td className="py-2 pr-3 whitespace-nowrap">{fmtDate(u.created_at)}</td>
                <td className="py-2 pr-3 whitespace-nowrap">{fmtDate(u.last_login_at)}</td>
                <td className="py-2 text-right">
                  <Button size="sm" variant="outline" onClick={() => onEdit(u)}>
                    Modifica
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}
