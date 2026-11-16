-- Guardia: indirizzi bloccati perché hanno scansionato il sito (o bloccati a mano dall'amministratore).
-- Sbannare = cancellare la riga (dal gestionale o con scripts/sbanna.mjs); la storia resta nel registro audit_log.
CREATE TABLE IF NOT EXISTS public.guard_bans (
  ip text PRIMARY KEY CHECK (length(ip) BETWEEN 2 AND 45),
  reason text NOT NULL,
  detail text NOT NULL DEFAULT '',
  hits int NOT NULL DEFAULT 1,
  manual boolean NOT NULL DEFAULT false,
  created_by text NOT NULL DEFAULT 'guardia',
  created_at timestamptz NOT NULL DEFAULT now(),
  -- NULL: bloccato finché qualcuno non lo sbanna.
  expires_at timestamptz
);
CREATE INDEX IF NOT EXISTS guard_bans_created_idx ON public.guard_bans (created_at DESC);

-- Chiusa al pubblico come utenti e registro: la usa solo il server.
REVOKE ALL ON public.guard_bans FROM anon, authenticated;
GRANT ALL ON public.guard_bans TO service_role;
ALTER TABLE public.guard_bans ENABLE ROW LEVEL SECURITY;
