#!/usr/bin/env bash
# Backup del database di Tono (dati dell'app, utenti, registro). Tiene gli ultimi 14.
# Installato come /usr/local/sbin/tonecraft-backup e lanciato ogni notte da tonecraft-backup.timer.
# Ripristino:  sudo -u postgres pg_restore --clean --if-exists -d tonecraft /var/backups/tonecraft/<file>.dump
set -euo pipefail
DIR=/var/backups/tonecraft
KEEP=14
install -d -m 0700 -o postgres -g postgres "$DIR"
FILE="$DIR/tonecraft-$(date +%Y%m%d-%H%M%S).dump"
sudo -u postgres pg_dump --format=custom --file="$FILE" tonecraft
ls -1t "$DIR"/tonecraft-*.dump | tail -n +$((KEEP + 1)) | xargs -r rm --
echo "Backup salvato: $FILE"
