#!/usr/bin/env bash
# Aspetta che il database in Docker sia pronto prima di avviare l'app (al massimo 2 minuti).
# Installato come /usr/local/sbin/tonecraft-db-wait e usato da tonecraft.service.
for _ in $(seq 1 120); do
  if docker exec tonecraft-db pg_isready -h 127.0.0.1 -U postgres -d tonecraft -q 2>/dev/null; then exit 0; fi
  sleep 1
done
echo "Il database (container tonecraft-db) non risponde." >&2
exit 1
