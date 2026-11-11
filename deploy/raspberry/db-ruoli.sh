#!/bin/sh
# Utenti del database con i soli permessi necessari (privilegio minimo). Lo lancia il servizio "db-setup" di
# docker-compose.yml a ogni avvio, prima delle migrazioni; è idempotente e vale anche per installazioni già esistenti.
#   tonecraft      proprietario delle tabelle, usato SOLO dal servizio "migrate"
#   tonecraft_app  usato dall'app: legge e scrive i dati, niente CREATE/DROP/ALTER, registro non modificabile,
#                  query lunghe interrotte. Anche con una SQL injection non può cambiare la struttura del database.
# I permessi sulle tabelle li dà scripts/db-migrate.mjs dopo ogni migrazione.
set -eu
for pw in "$APP_DB_PASSWORD" "$APP_RUNTIME_PASSWORD"; do
  # Solo lettere e cifre: sicure negli URL di connessione.
  case "$pw" in
    "" | *[!A-Za-z0-9]*) echo "APP_DB_PASSWORD e APP_RUNTIME_PASSWORD: solo lettere e cifre" >&2; exit 1 ;;
  esac
done
export PGPASSWORD="$POSTGRES_PASSWORD"
psql -q -v ON_ERROR_STOP=1 -h db -U postgres -d tonecraft \
  -v owner_pw="$APP_DB_PASSWORD" -v app_pw="$APP_RUNTIME_PASSWORD" <<'SQL'
SELECT 'CREATE ROLE anon NOLOGIN' WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'anon') \gexec
SELECT 'CREATE ROLE authenticated NOLOGIN' WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') \gexec
SELECT 'CREATE ROLE service_role NOLOGIN' WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'service_role') \gexec
SELECT 'CREATE ROLE tonecraft_app LOGIN' WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'tonecraft_app') \gexec
ALTER ROLE tonecraft WITH LOGIN NOSUPERUSER NOCREATEROLE PASSWORD :'owner_pw';
-- BYPASSRLS: le regole RLS delle tabelle servono solo su Supabase (ruoli anon/authenticated); qui i permessi
-- dell'app sono i GRANT sulle tabelle, e l'utente resta senza poteri di amministrazione.
ALTER ROLE tonecraft_app WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION BYPASSRLS
  PASSWORD :'app_pw' CONNECTION LIMIT 20;
ALTER ROLE tonecraft_app SET statement_timeout = '15s';
ALTER ROLE tonecraft_app SET idle_in_transaction_session_timeout = '30s';
ALTER ROLE tonecraft_app SET search_path = public;
REVOKE ALL ON DATABASE tonecraft FROM PUBLIC;
GRANT CONNECT ON DATABASE tonecraft TO tonecraft, tonecraft_app;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO tonecraft_app;
SQL
echo "Utenti del database pronti (tonecraft_app per l'app, tonecraft solo per le migrazioni)."
