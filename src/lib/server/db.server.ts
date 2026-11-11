// Connessione al PostgreSQL locale (installazione su server, es. Raspberry). Solo lato server.
// DATABASE_URL arriva dal file di ambiente del servizio (/etc/tonecraft/tonecraft.env), mai dal browser.
import postgres from "postgres";

type Sql = ReturnType<typeof postgres>;
let client: Sql | undefined;

export function hasLocalDb(): boolean {
  return typeof process !== "undefined" && !!process.env["DATABASE_URL"];
}

export function db(): Sql {
  if (!client) {
    const url = process.env["DATABASE_URL"];
    if (!url) throw new Error("Gestionale non configurato: manca DATABASE_URL sul server.");
    client = postgres(url, {
      max: Number(process.env["DATABASE_POOL"] ?? 5),
      idle_timeout: 30,
      connect_timeout: 10,
      // Gli int8 (count, somme) tornano come numeri JS: i valori del negozio stanno ben sotto 2^53.
      types: {
        int8: {
          to: 20,
          from: [20],
          serialize: (x: number) => String(x),
          parse: (x: string) => Number(x),
        },
      },
      transform: { undefined: null },
      onnotice: () => {},
      // Anche se l'utente del database non le ha già impostate: query e transazioni appese si interrompono.
      connection: { statement_timeout: 15_000, idle_in_transaction_session_timeout: 30_000 },
    });
  }
  return client;
}

/** Errori del database in messaggi comprensibili, senza dettagli interni. */
export function dbErrorMessage(e: unknown): string {
  const code =
    typeof e === "object" && e && "code" in e ? String((e as { code: unknown }).code) : "";
  if (code === "23505") return "Esiste già una riga con questo codice.";
  if (code === "23503") return "Riga collegata ad altri dati: impossibile salvarla o eliminarla.";
  if (code === "23514" || code === "22P02" || code === "23502") return "Valori non validi.";
  console.error(e);
  return "Errore del database.";
}
