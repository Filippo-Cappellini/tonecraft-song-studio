// Modalità delle iscrizioni, condivise tra server e gestionale.
export const SIGNUP_MODES = ["aperte", "approvazione", "chiuse"] as const;
export type SignupMode = (typeof SIGNUP_MODES)[number];

export const isSignupMode = (v: unknown): v is SignupMode =>
  typeof v === "string" && (SIGNUP_MODES as readonly string[]).includes(v);

export const SIGNUP_MODE_INFO: Record<SignupMode, { label: string; description: string }> = {
  aperte: {
    label: "Aperte",
    description: "Chi si iscrive entra subito (in sola lettura).",
  },
  approvazione: {
    label: "Con approvazione",
    description:
      "Gli account nuovi restano in attesa finché un amministratore non li approva. La difesa più forte contro i bot.",
  },
  chiuse: {
    label: "Chiuse",
    description: "Nessuno può iscriversi: gli account li crea solo l'amministratore.",
  },
};

/** Nome del campo trappola del modulo: nascosto alle persone, i bot lo compilano. */
export const TRAP_FIELD = "sito_personale";
