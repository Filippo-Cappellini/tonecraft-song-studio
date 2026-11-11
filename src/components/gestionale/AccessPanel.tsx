import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Panel, staffStatusQuery } from "@/components/gestionale/kit";
import { GoogleButton } from "@/components/gestionale/GoogleButton";
import { LoginForm } from "@/components/gestionale/LoginForm";
import { SignupForm } from "@/components/gestionale/SignupForm";

const ERRORS: Record<string, string> = {
  "google-non-attivo": "L'accesso con Google non è attivo su questo server.",
  "google-annullato": "Accesso con Google annullato.",
  "google-scaduto": "La richiesta a Google è scaduta o non è valida. Riprova.",
  "google-rifiutato": "Google non ha confermato l'accesso (serve un'email verificata). Riprova.",
  "registrazioni-chiuse":
    "Non esiste un account con questo profilo Google e le registrazioni sono chiuse.",
  "email-in-uso": "L'email di questo profilo Google è già usata da un altro account.",
  disattivato: "Questo account è stato disattivato dall'amministratore.",
};

/** Accedi / Crea account, con "Continua con Google" se il server lo ha configurato. */
export function AccessPanel({
  onSuccess,
  error,
}: {
  onSuccess?: () => void;
  error?: string | undefined;
}) {
  const status = useQuery(staffStatusQuery);
  const [tab, setTab] = useState<"accedi" | "crea">("accedi");
  const signup = !!status.data?.signupOpen;
  const google = !!status.data?.google;
  const tabClass = (t: typeof tab) =>
    `flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition ${tab === t ? "bg-background text-foreground shadow" : "text-muted-foreground hover:text-foreground"}`;

  return (
    <Panel>
      {signup && (
        <div
          role="tablist"
          aria-label="Accesso"
          className="mb-5 flex gap-1 rounded-lg bg-secondary p-1"
        >
          <button
            type="button"
            role="tab"
            aria-selected={tab === "accedi"}
            className={tabClass("accedi")}
            onClick={() => setTab("accedi")}
          >
            Accedi
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "crea"}
            className={tabClass("crea")}
            onClick={() => setTab("crea")}
          >
            Crea account
          </button>
        </div>
      )}
      {!signup && <h2 className="mb-4 text-lg font-semibold">Accedi</h2>}
      {error && (
        <div
          role="alert"
          className="mb-4 rounded-lg border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm"
        >
          {ERRORS[error] ?? "Accesso non riuscito. Riprova."}
        </div>
      )}
      {google && (
        <>
          <GoogleButton />
          <div className="my-4 flex items-center gap-3 text-xs text-muted-foreground">
            <span className="h-px flex-1 bg-border" /> oppure{" "}
            <span className="h-px flex-1 bg-border" />
          </div>
        </>
      )}
      {tab === "crea" && signup ? (
        <SignupForm onSuccess={onSuccess} />
      ) : (
        <LoginForm onSuccess={onSuccess} />
      )}
      {!signup && (
        <p className="mt-4 text-xs text-muted-foreground">Gli account li crea l'amministratore.</p>
      )}
    </Panel>
  );
}
