import { createFileRoute } from "@tanstack/react-router";
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
  useStaff,
} from "@/components/gestionale/kit";
import { changeOwnPassword } from "@/lib/staff.functions";
import { PASSWORD_HINT, ROLES } from "@/lib/staff-roles";

export const Route = createFileRoute("/gestionale/account")({ component: Account });

function Account() {
  const { user } = useStaff();
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
      <Panel title="Cambia password" className="max-w-md">
        <form onSubmit={submit} className="space-y-3">
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
