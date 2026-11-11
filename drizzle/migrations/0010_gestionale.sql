-- Gestionale: utenti dello staff con ruoli, registro delle modifiche e negozi online di fiducia.
-- I dati dell'app (catalogo) restano nelle loro tabelle e si consultano/modificano dal gestionale.
-- Funziona sul PostgreSQL locale del server (Raspberry).
-- Su Supabase le tabelle esistono ma restano chiuse: nessun accesso per anon/authenticated (password, sessioni, registro).

CREATE TABLE IF NOT EXISTS public.staff_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username text NOT NULL UNIQUE CHECK (username ~ '^[a-z0-9._-]{3,32}$'),
  full_name text NOT NULL,
  role text NOT NULL CHECK (role IN ('admin', 'catalogo', 'lettura')),
  password_hash text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_login_at timestamptz
);

-- Si salva solo l'impronta SHA-256 del token di sessione, mai il token.
CREATE TABLE IF NOT EXISTS public.staff_sessions (
  token_hash text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.staff_users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS staff_sessions_user_idx ON public.staff_sessions (user_id);

-- Negozi online di fiducia. search_url contiene {q} al posto del testo da cercare;
-- se è vuoto si apre la home del negozio.
CREATE TABLE IF NOT EXISTS public.shops (
  id text PRIMARY KEY,
  name text NOT NULL,
  website text NOT NULL,
  search_url text,
  description text NOT NULL DEFAULT '',
  sort int NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.audit_log (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid REFERENCES public.staff_users(id) ON DELETE SET NULL,
  username text NOT NULL,
  action text NOT NULL,
  entity text NOT NULL,
  entity_id text NOT NULL DEFAULT '',
  detail text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS audit_log_created_idx ON public.audit_log (created_at DESC);

INSERT INTO public.shops (id, name, website, search_url, description, sort) VALUES
  ('thomann', 'Thomann', 'https://www.thomann.it/', 'https://www.thomann.it/search_dir.html?sw={q}', 'Il più grande negozio di strumenti in Europa, spedizione in Italia.', 1),
  ('strumentimusicali-net', 'Strumentimusicali.net', 'https://www.strumentimusicali.net/', 'https://www.strumentimusicali.net/advanced_search_result.php?keywords={q}', 'Negozio online italiano di strumenti e audio.', 2),
  ('musicalstore2005', 'MusicalStore2005', 'https://www.musicalstore2005.com/', NULL, 'Negozio online italiano (Altamura). Ricerca da impostare dal gestionale.', 3)
ON CONFLICT (id) DO NOTHING;

-- Tutto chiuso al pubblico: l'app accede solo dal server con l'utente proprietario del database.
REVOKE ALL ON public.staff_users, public.staff_sessions, public.audit_log FROM anon, authenticated;
GRANT ALL ON public.staff_users, public.staff_sessions, public.audit_log, public.shops TO service_role;
GRANT SELECT ON public.shops TO anon, authenticated;

ALTER TABLE public.staff_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shops ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public read" ON public.shops;
CREATE POLICY "public read" ON public.shops FOR SELECT USING (true);
