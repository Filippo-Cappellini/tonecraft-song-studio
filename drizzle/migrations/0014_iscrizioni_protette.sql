-- Iscrizioni protette dai bot: account in attesa di approvazione e impostazioni delle iscrizioni dal gestionale.

-- Account creato da una persona ma non ancora approvato dall'amministratore (resta disattivato finché non lo approva).
ALTER TABLE public.staff_users ADD COLUMN IF NOT EXISTS pending boolean NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS staff_users_pending_idx ON public.staff_users (created_at) WHERE pending;

-- Impostazioni del sito (una sola riga). REGISTRAZIONI=chiuse nell'ambiente del server le chiude comunque.
--   signup_mode       aperte: si entra subito · approvazione: l'admin approva ogni account · chiuse: solo l'admin crea account
--   signups_per_hour  iscrizioni al massimo in un'ora, da tutti gli indirizzi insieme (contro i bot che cambiano IP)
CREATE TABLE IF NOT EXISTS public.site_settings (
  id int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  signup_mode text NOT NULL DEFAULT 'approvazione' CHECK (signup_mode IN ('aperte', 'approvazione', 'chiuse')),
  signups_per_hour int NOT NULL DEFAULT 10 CHECK (signups_per_hour BETWEEN 1 AND 1000),
  updated_by text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.site_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

REVOKE ALL ON public.site_settings FROM anon, authenticated;
GRANT ALL ON public.site_settings TO service_role;
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;
