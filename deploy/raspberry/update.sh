#!/usr/bin/env bash
# Aggiorna Tono sul Raspberry con una nuova versione del progetto (dati e configurazione restano).
# Uso, dalla cartella della nuova versione:   sudo bash deploy/raspberry/update.sh
set -euo pipefail
# Nessuna domanda da apt (su Ubuntu needrestart aprirebbe una finestra e bloccherebbe lo script).
export DEBIAN_FRONTEND=noninteractive NEEDRESTART_MODE=a

APP_DIR=/opt/tonecraft
ENV_FILE=/etc/tonecraft/tonecraft.env
SRC_DIR=$(cd "$(dirname "$0")/../.." && pwd)
if [[ $EUID -ne 0 ]]; then echo "Lancia lo script con sudo." >&2; exit 1; fi
[[ -f "$ENV_FILE" ]] || { echo "Tono non è installato: usa install.sh." >&2; exit 1; }

echo "== Backup del database prima dell'aggiornamento"
/usr/local/sbin/tonecraft-backup

echo "== Copia, dipendenze e build"
if [[ "$SRC_DIR" != "$APP_DIR" ]]; then
  rsync -a --delete --exclude node_modules --exclude .output --exclude .git --exclude .npm --exclude .env.local --exclude .env.db "$SRC_DIR/" "$APP_DIR/"
fi
chown -R tonecraft:tonecraft "$APP_DIR"
cd "$APP_DIR"

echo "== Database in Docker (applica eventuali modifiche al docker-compose.yml; i dati restano nel volume)"
docker compose -f deploy/raspberry/docker-compose.yml --env-file /etc/tonecraft/db.env up -d --wait
# Utente dell'app con permessi minimi (lo crea anche sulle installazioni fatte prima di questa versione).
bash deploy/raspberry/db-roles.sh

sudo -u tonecraft -H npm ci --no-audit --no-fund
sudo -u tonecraft -H env NODE_OPTIONS=--max-old-space-size=1536 npm run build:server

echo "== Migrazioni e riavvio"
node --env-file=/etc/tonecraft/migrate.env scripts/db-migrate.mjs
install -m 0644 deploy/raspberry/tonecraft.service /etc/systemd/system/tonecraft.service
install -m 0755 deploy/raspberry/db-wait.sh /usr/local/sbin/tonecraft-db-wait
install -m 0755 deploy/raspberry/backup.sh /usr/local/sbin/tonecraft-backup
systemctl daemon-reload
systemctl restart tonecraft.service
systemctl --no-pager --lines=5 status tonecraft.service || true
