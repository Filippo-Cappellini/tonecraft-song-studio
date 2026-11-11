-- Account creati dalle persone (registrazione) e accesso con Google.
-- Chi entra solo con Google non ha una password: deve esserci almeno uno dei due modi di accesso.
ALTER TABLE public.staff_users ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE public.staff_users ADD COLUMN IF NOT EXISTS google_sub text;
ALTER TABLE public.staff_users ALTER COLUMN password_hash DROP NOT NULL;

ALTER TABLE public.staff_users DROP CONSTRAINT IF EXISTS staff_users_email_check;
ALTER TABLE public.staff_users ADD CONSTRAINT staff_users_email_check
  CHECK (email IS NULL OR (length(email) <= 254 AND email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'));
ALTER TABLE public.staff_users DROP CONSTRAINT IF EXISTS staff_users_login_check;
ALTER TABLE public.staff_users ADD CONSTRAINT staff_users_login_check
  CHECK (password_hash IS NOT NULL OR google_sub IS NOT NULL);

-- Un'email e un account Google appartengono a un solo utente.
CREATE UNIQUE INDEX IF NOT EXISTS staff_users_email_idx ON public.staff_users (lower(email)) WHERE email IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS staff_users_google_idx ON public.staff_users (google_sub) WHERE google_sub IS NOT NULL;
