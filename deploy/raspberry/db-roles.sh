#!/usr/bin/env bash
# Utente del database per l'app con i soli permessi necessari (privilegio minimo):
#   tonecraft      proprietario delle tabelle, usato SOLO dalle migrazioni (credenziali in migrate.env, solo root)
#   tonecraft_app  usato dall'app: legge e scrive i dati, niente CREATE/DROP/ALTER, registro non modificabile,
#                  query lunghe interrotte. Anche con una SQL injection non può cambiare la struttura del database.
# I permessi sulle tabelle li dà scripts/db-migrate.mjs dopo ogni migrazione.
# Idempotente: lo lanciano install.sh e update.sh (anche su un'installazione già esistente).
set -euo pipefail
ENV_DIR=${TONO_ENV_DIR:-/etc/tonecraft}
DB_ENV=$ENV_DIR/db.env
APP_ENV=$ENV_DIR/tonecraft.env
MIG_ENV=$ENV_DIR/migrate.env
CONTAINER=${TONO_DB_CONTAINER:-tonecraft-db}

val() { sed -n "s/^$1=//p" "$DB_ENV" | tail -1; }
OWNER_PW=$(val APP_DB_PASSWORD)
PORT=$(val DB_PORT)
PORT=${PORT:-5432}
RUNTIME_PW=$(val APP_RUNTIME_PASSWORD)
if [[ -z "$RUNTIME_PW" ]]; then
  RUNTIME_PW=$(openssl rand -hex 24)
  echo "APP_RUNTIME_PASSWORD=$RUNTIME_PW" >> "$DB_ENV"
fi
# Solo lettere e cifre: sicure dentro l'SQL e negli URL.
[[ "$OWNER_PW" =~ ^[A-Za-z0-9]+$ && "$RUNTIME_PW" =~ ^[A-Za-z0-9]+$ ]] || { echo "Password del database non valide in $DB_ENV" >&2; exit 1; }

docker exec -i "$CONTAINER" psql -q -v ON_ERROR_STOP=1 -U postgres -d tonecraft <<SQL
SELECT 'CREATE ROLE tonecraft_app LOGIN' WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'tonecraft_app') \gexec
-- BYPASSRLS: le regole RLS delle tabelle servono solo su Supabase (ruoli anon/authenticated); qui i permessi
-- dell'app sono i GRANT sulle tabelle, e l'utente resta senza poteri di amministrazione.
ALTER ROLE tonecraft_app WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION BYPASSRLS
  PASSWORD '$RUNTIME_PW' CONNECTION LIMIT 20;
ALTER ROLE tonecraft_app SET statement_timeout = '15s';
ALTER ROLE tonecraft_app SET idle_in_transaction_session_timeout = '30s';
ALTER ROLE tonecraft_app SET search_path = public;
REVOKE ALL ON DATABASE tonecraft FROM PUBLIC;
GRANT CONNECT ON DATABASE tonecraft TO tonecraft, tonecraft_app;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO tonecraft_app;
SQL

umask 077
# Credenziali del proprietario: solo per le migrazioni, leggibili solo da root (non dal servizio).
printf '# Solo per le migrazioni (lanciate da root). Non usarlo per il servizio.\nDATABASE_URL=postgres://tonecraft:%s@127.0.0.1:%s/tonecraft\n' "$OWNER_PW" "$PORT" > "$MIG_ENV"
chmod 0600 "$MIG_ENV"
# Il servizio usa l'utente con i permessi minimi.
if [[ -f "$APP_ENV" ]]; then
  sed -i "s#^DATABASE_URL=.*#DATABASE_URL=postgres://tonecraft_app:$RUNTIME_PW@127.0.0.1:$PORT/tonecraft#" "$APP_ENV"
fi
echo "Utenti del database pronti (tonecraft_app per l'app, tonecraft solo per le migrazioni)."
