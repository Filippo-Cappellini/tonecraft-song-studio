-- Gestionale: utenti dello staff con ruoli, negozio/magazzino (prodotti, movimenti, vendite, clienti, fornitori)
-- e negozi online di fiducia. Funziona sul PostgreSQL locale del server (Raspberry).
-- Su Supabase le tabelle esistono ma restano chiuse: nessun accesso per anon/authenticated (password, clienti, vendite).

CREATE TABLE IF NOT EXISTS public.staff_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username text NOT NULL UNIQUE CHECK (username ~ '^[a-z0-9._-]{3,32}$'),
  full_name text NOT NULL,
  role text NOT NULL CHECK (role IN ('admin', 'catalogo', 'magazzino', 'vendite')),
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

CREATE TABLE IF NOT EXISTS public.suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  contact text,
  email text,
  phone text,
  website text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  email text,
  phone text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Prezzi in centesimi di euro. model_id collega (se si vuole) il prodotto a un modello del catalogo.
CREATE TABLE IF NOT EXISTS public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sku text NOT NULL UNIQUE,
  name text NOT NULL,
  category text NOT NULL DEFAULT 'Accessori',
  brand text NOT NULL DEFAULT '',
  model_id text REFERENCES public.models(id) ON DELETE SET NULL,
  supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL,
  cost_cents int NOT NULL DEFAULT 0 CHECK (cost_cents >= 0),
  price_cents int NOT NULL DEFAULT 0 CHECK (price_cents >= 0),
  vat int NOT NULL DEFAULT 22 CHECK (vat BETWEEN 0 AND 100),
  stock int NOT NULL DEFAULT 0 CHECK (stock >= 0),
  min_stock int NOT NULL DEFAULT 0 CHECK (min_stock >= 0),
  location text NOT NULL DEFAULT '',
  notes text NOT NULL DEFAULT '',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS products_name_idx ON public.products (lower(name));

CREATE TABLE IF NOT EXISTS public.sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  number int GENERATED ALWAYS AS IDENTITY UNIQUE,
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  user_id uuid REFERENCES public.staff_users(id) ON DELETE SET NULL,
  payment text NOT NULL CHECK (payment IN ('contanti', 'carta', 'bonifico', 'altro')),
  total_cents int NOT NULL CHECK (total_cents >= 0),
  note text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  canceled_at timestamptz
);
CREATE INDEX IF NOT EXISTS sales_created_idx ON public.sales (created_at DESC);

CREATE TABLE IF NOT EXISTS public.sale_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id uuid NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  quantity int NOT NULL CHECK (quantity > 0),
  unit_price_cents int NOT NULL CHECK (unit_price_cents >= 0)
);
CREATE INDEX IF NOT EXISTS sale_items_sale_idx ON public.sale_items (sale_id);

-- Ogni variazione di giacenza: quantità positiva = entrata, negativa = uscita.
CREATE TABLE IF NOT EXISTS public.stock_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  quantity int NOT NULL CHECK (quantity <> 0),
  kind text NOT NULL CHECK (kind IN ('carico', 'scarico', 'vendita', 'reso', 'rettifica')),
  note text NOT NULL DEFAULT '',
  sale_id uuid REFERENCES public.sales(id) ON DELETE SET NULL,
  user_id uuid REFERENCES public.staff_users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS stock_movements_created_idx ON public.stock_movements (created_at DESC);
CREATE INDEX IF NOT EXISTS stock_movements_product_idx ON public.stock_movements (product_id);

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
REVOKE ALL ON public.staff_users, public.staff_sessions, public.suppliers, public.customers, public.products,
  public.sales, public.sale_items, public.stock_movements, public.audit_log FROM anon, authenticated;
GRANT ALL ON public.staff_users, public.staff_sessions, public.suppliers, public.customers, public.products,
  public.sales, public.sale_items, public.stock_movements, public.audit_log, public.shops TO service_role;
GRANT SELECT ON public.shops TO anon, authenticated;

ALTER TABLE public.staff_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shops ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public read" ON public.shops;
CREATE POLICY "public read" ON public.shops FOR SELECT USING (true);
