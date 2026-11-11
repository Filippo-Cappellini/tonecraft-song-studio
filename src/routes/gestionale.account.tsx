import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import {
  Errors,
  errorText,
  Field,
  inputClass,
  Notice,
  PageTitle,
  Panel,
  staffStatusQuery,
  useStaff,
} from "@/components/gestionale/kit";
import { changeOwnPassword, getMyAccount, unlinkGoogle } from "@/lib/staff.functions";
import { PASSWORD_HINT, ROLES } from "@/lib/staff-roles";

export const Route = createFileRoute("/gestionale/account")({
  validateSearch: (raw: Record<string, unknown>): { errore?: string; collegato?: boolean } => ({
    ...(typeof raw["errore"] === "string" && /^[a-z-]{1,40}$/.test(raw["errore"])
      ? { errore: raw["errore"] }
      : {}),
    ...(raw["collegato"] === 1 || raw["collegato"] === "1" ? { collegato: true } : {}),
  }),
  component: Account,
});

const GOOGLE_MSG: Record<string, string> = {
  "google-gia-collegato": "Questo profilo Google è già collegato a un altro account.",
  "google-annullato": "Collegamento con Google annullato.",
  "google-rifiutato": "Google non ha confermato l'accesso (serve un'email verificata).",
  "google-scaduto": "La richiesta a Google è scaduta. Riprova.",
};

function Account() {
  const { user } = useStaff();
  const search = Route.useSearch();
  const status = useQuery(staffStatusQuery);
  const [googleMsg, setGoogleMsg] = useState<string | null>(null);
  const account = useQuery({ queryKey: ["gestionale", "account"], queryFn: () => getMyAccount() });
  const hasPassword = account.data?.hasPassword ?? true;
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [repeat, setRepeat] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setOk(false);
    if (next !== repeat) return setError("Le due password nuove non coincidono.");
    try {
      const r = await changeOwnPassword({ data: { current, next } });
      if (!r.ok) return setError(r.error);
      setError(null);
      setOk(true);
      setCurrent("");
      setNext("");
      setRepeat("");
      void account.refetch();
    } catch (err) {
      setError(errorText(err));
    }
  };

  return (
    <>
      <PageTitle
        title="Il mio account"
        subtitle={
          user ? `${user.full_name} · ${user.username} · ${ROLES[user.role].label}` : undefined
        }
      />
      {account.data && (
        <Panel title="Accesso" className="mb-6 max-w-md">
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
            <dt className="text-muted-foreground">Email</dt>
            <dd>{account.data.email ?? "—"}</dd>
            <dt className="text-muted-foreground">Google</dt>
            <dd>{account.data.google ? "Collegato" : "Non collegato"}</dd>
            <dt className="text-muted-foreground">Password</dt>
            <dd>{account.data.hasPassword ? "Impostata" : "Nessuna (entri solo con Google)"}</dd>
          </dl>
          {search.collegato && (
            <div className="mt-3">
              <Notice>Profilo Google collegato.</Notice>
            </div>
          )}
          {search.errore && (
            <div className="mt-3">
              <Errors errors={[GOOGLE_MSG[search.errore] ?? "Collegamento non riuscito."]} />
            </div>
          )}
          {googleMsg && (
            <div className="mt-3">
              <Errors errors={[googleMsg]} />
            </div>
          )}
          {status.data?.google && !account.data.google && (
            <a
              href="/api/google/accedi?collega=1"
              className="mt-4 inline-flex rounded-md border px-3 py-1.5 text-sm hover:border-primary"
            >
              Collega Google
            </a>
          )}
          {account.data.google && account.data.hasPassword && (
            <Button
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={async () => {
                const r = await unlinkGoogle();
                if (!r.ok) setGoogleMsg(r.error);
                void account.refetch();
              }}
            >
              Scollega Google
            </Button>
          )}
        </Panel>
      )}
      <Panel title={hasPassword ? "Cambia password" : "Crea una password"} className="max-w-md">
        <form onSubmit={submit} className="space-y-3">
          {hasPassword && (
            <Field label="Password attuale">
              <input
                className={inputClass}
                type="password"
                autoComplete="current-password"
                value={current}
                onChange={(e) => setCurrent(e.target.value)}
                required
              />
            </Field>
          )}
          <Field label="Nuova password" help={PASSWORD_HINT}>
            <input
              className={inputClass}
              type="password"
              autoComplete="new-password"
              value={next}
              onChange={(e) => setNext(e.target.value)}
              required
            />
          </Field>
          <Field label="Ripeti la nuova password">
            <input
              className={inputClass}
              type="password"
              autoComplete="new-password"
              value={repeat}
              onChange={(e) => setRepeat(e.target.value)}
              required
            />
          </Field>
          <Errors errors={error ? [error] : []} />
          {ok && <Notice>Password cambiata. Le altre sessioni aperte sono state chiuse.</Notice>}
          <Button type="submit">Salva</Button>
        </form>
      </Panel>
    </>
  );
}
