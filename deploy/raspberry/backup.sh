#!/usr/bin/env bash
# Backup del database di Tono (dati dell'app, account, registro), preso dal container Docker. Tiene gli ultimi 14.
# Installato come /usr/local/sbin/tonecraft-backup e lanciato ogni notte da tonecraft-backup.timer.
# Ripristino (sovrascrive i dati attuali):
#   sudo docker stop tonecraft-app
#   docker exec -i tonecraft-db pg_restore -U postgres --clean --if-exists -d tonecraft < /var/backups/tonecraft/<file>.dump
#   sudo docker start tonecraft-app
set -euo pipefail
DIR=/var/backups/tonecraft
KEEP=14
install -d -m 0700 -o root -g root "$DIR"
FILE="$DIR/tonecraft-$(date +%Y%m%d-%H%M%S).dump"
umask 077
if ! docker exec tonecraft-db pg_dump -U postgres --format=custom tonecraft > "$FILE.tmp"; then
  rm -f "$FILE.tmp"
  echo "Backup non riuscito: il container tonecraft-db è avviato?" >&2
  exit 1
fi
mv "$FILE.tmp" "$FILE"
find "$DIR" -maxdepth 1 -name 'tonecraft-*.dump' -printf '%T@ %p\n' | sort -rn | tail -n +$((KEEP + 1)) | cut -d' ' -f2- | xargs -r rm --
echo "Backup salvato: $FILE"
