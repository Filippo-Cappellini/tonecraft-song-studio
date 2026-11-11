import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Errors,
  errorText,
  Field,
  fmtDate,
  Forbidden,
  inputClass,
  PageTitle,
  Panel,
  useStaff,
} from "@/components/gestionale/kit";
import { listAudit, listStaffUsers, saveStaffUser, type StaffUserRow } from "@/lib/staff.functions";
import { PASSWORD_HINT, ROLE_IDS, ROLES, type Role } from "@/lib/staff-roles";

export const Route = createFileRoute("/gestionale/utenti")({ component: Utenti });

function Utenti() {
  const staff = useStaff();
  const [editing, setEditing] = useState<StaffUserRow | "new" | null>(null);
  const isAdmin = staff.can("admin");
  const users = useQuery({
    queryKey: ["gestionale", "users"],
    queryFn: () => listStaffUsers(),
    enabled: isAdmin,
  });
  const log = useQuery({
    queryKey: ["gestionale", "audit"],
    queryFn: () => listAudit(),
    enabled: isAdmin,
  });
  if (!isAdmin) return <Forbidden />;

  return (
    <>
      <PageTitle
        title="Utenti e registro"
        subtitle="Chi può entrare nel gestionale e cosa ha fatto."
        actions={
          <Button onClick={() => setEditing("new")}>
            <Plus /> Nuovo utente
          </Button>
        }
      />
      <Panel title="Ruoli">
        <ul className="grid gap-2 text-sm sm:grid-cols-2">
          {ROLE_IDS.map((r) => (
            <li key={r}>
              <span className="font-medium">{ROLES[r].label}</span> —{" "}
              <span className="text-muted-foreground">{ROLES[r].description}</span>
            </li>
          ))}
        </ul>
      </Panel>
      <Panel title="Utenti" className="mt-6">
        {users.isError && <Errors errors={[errorText(users.error)]} />}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr className="border-b">
                <th className="py-2 pr-3">Utente</th>
                <th className="py-2 pr-3">Ruolo</th>
                <th className="py-2 pr-3">Ultimo accesso</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody>
              {(users.data ?? []).map((u) => (
                <tr
                  key={u.id}
                  className={`border-b border-border/50 ${u.active ? "" : "opacity-50"}`}
                >
                  <td className="py-2 pr-3">
                    <div className="font-medium">{u.full_name}</div>
                    <div className="text-xs text-muted-foreground">
                      {u.username}
                      {u.active ? "" : " · disattivato"}
                    </div>
                  </td>
                  <td className="py-2 pr-3">{ROLES[u.role].label}</td>
                  <td className="py-2 pr-3">{fmtDate(u.last_login_at)}</td>
                  <td className="py-2 text-right">
                    <Button size="sm" variant="outline" onClick={() => setEditing(u)}>
                      Modifica
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
      <Panel title="Registro attività (ultime 200)" className="mt-6">
        <div className="max-h-[480px] overflow-auto">
          <table className="w-full min-w-[560px] text-sm">
            <tbody>
              {(log.data ?? []).map((a) => (
                <tr key={a.id} className="border-b border-border/50">
                  <td className="py-1.5 pr-3 whitespace-nowrap text-muted-foreground">
                    {fmtDate(a.created_at)}
                  </td>
                  <td className="py-1.5 pr-3">{a.username}</td>
                  <td className="py-1.5 pr-3">{a.action}</td>
                  <td className="py-1.5 text-muted-foreground">
                    {a.entity}
                    {a.detail ? ` · ${a.detail}` : ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
      {editing && (
        <UserDialog user={editing === "new" ? null : editing} onClose={() => setEditing(null)} />
      )}
    </>
  );
}

function UserDialog({ user, onClose }: { user: StaffUserRow | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [f, setF] = useState({
    username: user?.username ?? "",
    full_name: user?.full_name ?? "",
    role: (user?.role ?? "vendite") as Role,
    active: user?.active ?? true,
    password: "",
  });
  const [errors, setErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await saveStaffUser({ data: { ...f, id: user?.id } });
      if (!r.ok) setErrors([r.error]);
      else {
        await qc.invalidateQueries({ queryKey: ["gestionale"] });
        onClose();
      }
    } catch (err) {
      setErrors([errorText(err)]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{user ? `Modifica ${user.username}` : "Nuovo utente"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <Field
            label="Nome utente"
            help={user ? undefined : "Minuscole, cifre, . _ - (3-32 caratteri)."}
          >
            <input
              className={inputClass}
              value={f.username}
              onChange={(e) => setF({ ...f, username: e.target.value.toLowerCase() })}
              disabled={!!user}
              required
              autoComplete="off"
            />
          </Field>
          <Field label="Nome e cognome">
            <input
              className={inputClass}
              value={f.full_name}
              onChange={(e) => setF({ ...f, full_name: e.target.value })}
              required
              maxLength={120}
            />
          </Field>
          <Field label="Ruolo" help={ROLES[f.role].description}>
            <select
              className={inputClass}
              value={f.role}
              onChange={(e) => setF({ ...f, role: e.target.value as Role })}
            >
              {ROLE_IDS.map((r) => (
                <option key={r} value={r}>
                  {ROLES[r].label}
                </option>
              ))}
            </select>
          </Field>
          <Field
            label={user ? "Nuova password (vuoto = invariata)" : "Password"}
            help={`${PASSWORD_HINT} Comunicala alla persona di persona.`}
          >
            <input
              className={inputClass}
              type="password"
              value={f.password}
              onChange={(e) => setF({ ...f, password: e.target.value })}
              required={!user}
              autoComplete="new-password"
            />
          </Field>
          {user && (
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={f.active}
                onChange={(e) => setF({ ...f, active: e.target.checked })}
              />{" "}
              Attivo (togli la spunta per bloccare l'accesso)
            </label>
          )}
          <Errors errors={errors} />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Annulla
            </Button>
            <Button type="submit" disabled={busy}>
              Salva
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
