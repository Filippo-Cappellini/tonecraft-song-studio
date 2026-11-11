import { useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Errors, Field, inputClass, Panel, staffStatusQuery } from "@/components/gestionale/kit";
import { staffLogin } from "@/lib/staff.functions";

/** Accesso con nome utente e password: dopo l'accesso il menu mostra le sezioni del proprio ruolo. */
export function LoginForm({ onSuccess }: { onSuccess?: () => void }) {
  const qc = useQueryClient();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = await staffLogin({ data: { username, password } });
      if (!r.ok) setError(r.error);
      else {
        await qc.invalidateQueries({ queryKey: staffStatusQuery.queryKey });
        onSuccess?.();
      }
    } catch {
      setError("Accesso non riuscito. Riprova.");
    } finally {
      setBusy(false);
      setPassword("");
    }
  };

  return (
    <Panel title="Accedi">
      <form onSubmit={submit} className="space-y-4">
        <Field label="Nome utente">
          <input
            className={inputClass}
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            autoFocus
          />
        </Field>
        <Field label="Password">
          <input
            className={inputClass}
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </Field>
        <Errors errors={error ? [error] : []} />
        <Button type="submit" className="w-full" disabled={busy}>
          {busy ? "Accesso…" : "Entra"}
        </Button>
        <p className="text-xs text-muted-foreground">
          Per lo staff del negozio: le sezioni che vedi dipendono dal tuo ruolo. Gli account li crea
          l'amministratore.
        </p>
      </form>
    </Panel>
  );
}
