import { useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Errors, Field, inputClass, staffStatusQuery } from "@/components/gestionale/kit";
import { staffSignup } from "@/lib/staff.functions";
import { PASSWORD_HINT } from "@/lib/staff-roles";

/** Creazione di un account: si entra subito, in sola lettura (l'amministratore può dare più permessi). */
export function SignupForm({ onSuccess }: { onSuccess?: (() => void) | undefined }) {
  const qc = useQueryClient();
  const [f, setF] = useState({ username: "", full_name: "", email: "", password: "", repeat: "" });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) =>
    setF({ ...f, [k]: e.target.value });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (f.password !== f.repeat) return setError("Le due password non coincidono.");
    setBusy(true);
    setError(null);
    try {
      const r = await staffSignup({
        data: {
          username: f.username,
          full_name: f.full_name,
          email: f.email,
          password: f.password,
        },
      });
      if (!r.ok) setError(r.error);
      else {
        await qc.invalidateQueries({ queryKey: staffStatusQuery.queryKey });
        onSuccess?.();
      }
    } catch {
      setError("Registrazione non riuscita. Riprova.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field
        label="Nome utente"
        help="Minuscole, cifre e . _ - (3-32 caratteri). Serve per accedere."
      >
        <input
          className={inputClass}
          autoComplete="username"
          value={f.username}
          onChange={(e) => setF({ ...f, username: e.target.value.toLowerCase() })}
          required
          maxLength={32}
        />
      </Field>
      <Field label="Nome e cognome">
        <input
          className={inputClass}
          autoComplete="name"
          value={f.full_name}
          onChange={set("full_name")}
          required
          maxLength={120}
        />
      </Field>
      <Field
        label="Email (facoltativa)"
        help="Se usi la stessa email di Google, potrai entrare anche con Google."
      >
        <input
          className={inputClass}
          type="email"
          autoComplete="email"
          value={f.email}
          onChange={set("email")}
          maxLength={254}
        />
      </Field>
      <Field label="Password" help={PASSWORD_HINT}>
        <input
          className={inputClass}
          type="password"
          autoComplete="new-password"
          value={f.password}
          onChange={set("password")}
          required
        />
      </Field>
      <Field label="Ripeti la password">
        <input
          className={inputClass}
          type="password"
          autoComplete="new-password"
          value={f.repeat}
          onChange={set("repeat")}
          required
        />
      </Field>
      <Errors errors={error ? [error] : []} />
      <Button type="submit" className="w-full" disabled={busy}>
        {busy ? "Creazione…" : "Crea account"}
      </Button>
      <p className="text-xs text-muted-foreground">
        Il nuovo account può consultare il database. Per modificare i dati chiedi
        all'amministratore.
      </p>
    </form>
  );
}
