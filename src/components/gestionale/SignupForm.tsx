import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Errors, Field, inputClass, Notice, staffStatusQuery } from "@/components/gestionale/kit";
import { getSignupToken, staffSignup } from "@/lib/staff.functions";
import { PASSWORD_HINT } from "@/lib/staff-roles";
import { TRAP_FIELD } from "@/lib/signup";

/**
 * Creazione di un account in sola lettura (l'amministratore può dare più permessi). Con le iscrizioni
 * "con approvazione" l'account aspetta l'amministratore. Il modulo chiede un gettone al server appena si apre:
 * serve a riconoscere i bot che lo inviano in un attimo.
 */
export function SignupForm({
  onSuccess,
  approval = false,
}: {
  onSuccess?: (() => void) | undefined;
  approval?: boolean;
}) {
  const qc = useQueryClient();
  const [f, setF] = useState({ username: "", full_name: "", email: "", password: "", repeat: "" });
  // Campo trappola: invisibile, una persona non lo compila mai.
  const [trap, setTrap] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const token = useQuery({
    queryKey: ["signup-token"],
    queryFn: () => getSignupToken(),
    staleTime: 60 * 60 * 1000,
    gcTime: 0,
    refetchOnWindowFocus: false,
  });
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
          token: token.data?.token ?? "",
          [TRAP_FIELD]: trap,
        },
      });
      if (!r.ok) {
        setError(r.error);
        // Gettone usato o scaduto: se ne chiede uno nuovo per il prossimo tentativo.
        if (r.error.includes("scaduto")) await token.refetch();
      } else if (r.pending) setWaiting(true);
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

  if (waiting)
    return (
      <Notice>
        Richiesta inviata. Il tuo account è in attesa: potrai entrare quando l'amministratore lo
        avrà approvato.
      </Notice>
    );

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
      {/* Trappola per i bot: fuori dallo schermo, saltata dal tasto Tab e nascosta ai lettori di schermo. */}
      <div aria-hidden="true" className="absolute -left-[10000px] h-px w-px overflow-hidden">
        <label>
          Non compilare questo campo
          <input
            name={TRAP_FIELD}
            type="text"
            tabIndex={-1}
            autoComplete="off"
            value={trap}
            onChange={(e) => setTrap(e.target.value)}
          />
        </label>
      </div>
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
      <Button type="submit" className="w-full" disabled={busy || !token.data}>
        {busy ? "Creazione…" : "Crea account"}
      </Button>
      <p className="text-xs text-muted-foreground">
        {approval
          ? "Il nuovo account deve essere approvato dall'amministratore prima di poter entrare. "
          : ""}
        Il nuovo account può consultare il database. Per modificare i dati chiedi
        all'amministratore.
      </p>
    </form>
  );
}
