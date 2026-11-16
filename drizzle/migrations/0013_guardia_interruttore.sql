-- Guardia: interruttore acceso/spento dal gestionale (una sola riga). GUARDIA=spenta nell'ambiente la spegne comunque.
CREATE TABLE IF NOT EXISTS public.guard_settings (
  id int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  enabled boolean NOT NULL DEFAULT true,
  updated_by text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.guard_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

REVOKE ALL ON public.guard_settings FROM anon, authenticated;
GRANT ALL ON public.guard_settings TO service_role;
ALTER TABLE public.guard_settings ENABLE ROW LEVEL SECURITY;
