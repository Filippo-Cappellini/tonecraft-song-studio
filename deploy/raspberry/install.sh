#!/usr/bin/env bash
# Installa Tono (app + gestionale) su un Raspberry Pi con Linux server
# (Raspberry Pi OS Lite 64 bit, Debian 12 o Ubuntu Server 22.04+).
# Uso, dalla cartella del progetto copiata sul Raspberry:   sudo bash deploy/raspberry/install.sh
# Si può rilanciare: non cancella dati e non cambia la password del database già creata.
set -euo pipefail

APP_DIR=/opt/tonecraft
ENV_DIR=/etc/tonecraft
ENV_FILE=$ENV_DIR/tonecraft.env
BACKUP_DIR=/var/backups/tonecraft
DB_NAME=tonecraft
DB_USER=tonecraft
PORT=${PORT:-3000}
SRC_DIR=$(cd "$(dirname "$0")/../.." && pwd)

if [[ $EUID -ne 0 ]]; then echo "Lancia lo script con sudo." >&2; exit 1; fi
if [[ ! -f "$SRC_DIR/package.json" ]]; then echo "Non trovo il progetto in $SRC_DIR" >&2; exit 1; fi

echo "== 1/8 Pacchetti di sistema"
apt-get update
apt-get install -y --no-install-recommends ca-certificates curl gnupg postgresql postgresql-contrib avahi-daemon rsync openssl

echo "== 2/8 Node.js 22"
NODE_MAJOR=$(node -v 2>/dev/null | sed -E 's/^v([0-9]+).*/\1/' || echo 0)
if [[ "${NODE_MAJOR:-0}" -lt 22 ]]; then
  install -d -m 0755 /etc/apt/keyrings
  curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | gpg --dearmor --yes -o /etc/apt/keyrings/nodesource.gpg
  echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_22.x nodistro main" > /etc/apt/sources.list.d/nodesource.list
  apt-get update
  apt-get install -y nodejs
fi
node -v

echo "== 3/8 Utente di servizio e cartelle"
id tonecraft >/dev/null 2>&1 || useradd --system --home "$APP_DIR" --shell /usr/sbin/nologin tonecraft
install -d -m 0750 -o tonecraft -g tonecraft "$APP_DIR"
install -d -m 0750 -o root -g tonecraft "$ENV_DIR"
install -d -m 0700 -o postgres -g postgres "$BACKUP_DIR"

echo "== 4/8 Database PostgreSQL"
systemctl enable --now postgresql
if [[ ! -f "$ENV_FILE" ]]; then
  DB_PASS=$(openssl rand -hex 24)
  cat > "$ENV_FILE" <<EOF
# Ambiente del servizio Tono. Solo root e il servizio possono leggerlo.
DATABASE_URL=postgres://$DB_USER:$DB_PASS@127.0.0.1:5432/$DB_NAME
HOST=0.0.0.0
PORT=$PORT
NODE_ENV=production
# Metti 1 se davanti al servizio c'è un proxy HTTPS (Caddy/nginx): cookie solo https e IP reale del client.
COOKIE_SECURE=0
TRUST_PROXY=0
EOF
  chown root:tonecraft "$ENV_FILE"
  chmod 0640 "$ENV_FILE"
fi
DB_PASS=$(sed -nE 's#^DATABASE_URL=postgres://[^:]+:([^@]+)@.*#\1#p' "$ENV_FILE")
sudo -u postgres psql -v ON_ERROR_STOP=1 -q <<EOF
DO \$\$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '$DB_USER') THEN CREATE ROLE $DB_USER LOGIN PASSWORD '$DB_PASS'; END IF;
  -- Ruoli usati dalle migrazioni (scritte per Supabase): senza accesso, servono solo ai GRANT.
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN; END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role NOLOGIN; END IF;
END \$\$;
EOF
sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname = '$DB_NAME'" | grep -q 1 \
  || sudo -u postgres createdb -O "$DB_USER" "$DB_NAME"
# Il database ascolta solo in locale (impostazione predefinita di Debian): nessuna porta 5432 aperta in rete.

echo "== 5/8 Copia del progetto in $APP_DIR"
rsync -a --delete --exclude node_modules --exclude .output --exclude .git --exclude .npm --exclude .env.local "$SRC_DIR/" "$APP_DIR/"
chown -R tonecraft:tonecraft "$APP_DIR"

echo "== 6/8 Dipendenze e build (qualche minuto su un Raspberry)"
cd "$APP_DIR"
sudo -u tonecraft -H npm ci --no-audit --no-fund
sudo -u tonecraft -H env NODE_OPTIONS=--max-old-space-size=1536 npm run build:server

echo "== 7/8 Migrazioni del database"
sudo -u tonecraft -H node --env-file="$ENV_FILE" scripts/db-migrate.mjs

echo "== 8/8 Servizio, backup notturno e nome in rete"
install -m 0644 deploy/raspberry/tonecraft.service /etc/systemd/system/tonecraft.service
install -m 0755 deploy/raspberry/backup.sh /usr/local/sbin/tonecraft-backup
install -m 0644 deploy/raspberry/tonecraft-backup.service /etc/systemd/system/tonecraft-backup.service
install -m 0644 deploy/raspberry/tonecraft-backup.timer /etc/systemd/system/tonecraft-backup.timer
systemctl daemon-reload
systemctl enable --now avahi-daemon
systemctl enable tonecraft.service tonecraft-backup.timer
systemctl restart tonecraft.service
systemctl start tonecraft-backup.timer

if ! sudo -u postgres psql -d "$DB_NAME" -tAc "SELECT 1 FROM staff_users WHERE role = 'admin' AND active LIMIT 1" | grep -q 1; then
  echo
  echo "Crea ora il primo amministratore del gestionale."
  read -rp "Nome utente (minuscole, es. admin): " ADMIN_USER
  read -rp "Nome e cognome: " ADMIN_NAME
  sudo -u tonecraft -H node --env-file="$ENV_FILE" scripts/crea-utente.mjs --username "$ADMIN_USER" --nome "$ADMIN_NAME" --ruolo admin
fi

sleep 2
systemctl --no-pager --lines=5 status tonecraft.service || true
IP=$(hostname -I | awk '{print $1}')
echo
echo "Fatto. Apri dalla rete locale:"
echo "  http://$(hostname).local:$PORT        (oppure http://$IP:$PORT)"
echo "  Gestionale: http://$(hostname).local:$PORT/gestionale"
