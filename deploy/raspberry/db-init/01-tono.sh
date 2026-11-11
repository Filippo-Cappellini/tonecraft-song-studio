#!/bin/sh
# Primo avvio del container: utente dell'app, ruoli usati dalle migrazioni e database "tonecraft".
# Gira una sola volta, quando il volume dei dati è vuoto. Le tabelle le crea poi scripts/db-migrate.mjs.
set -eu
case "$APP_DB_PASSWORD" in
  *\'*) echo "APP_DB_PASSWORD non può contenere apici" >&2; exit 1 ;;
esac
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname postgres <<EOSQL
CREATE ROLE tonecraft LOGIN PASSWORD '$APP_DB_PASSWORD';
-- Le migrazioni sono scritte anche per Supabase e concedono permessi a questi ruoli (senza accesso).
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN;
CREATE DATABASE tonecraft OWNER tonecraft;
EOSQL
