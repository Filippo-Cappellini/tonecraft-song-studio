#!/usr/bin/env bash
# Installa Tono (app + gestionale) su un Raspberry Pi con Linux server a 64 bit
# (Raspberry Pi OS Lite 64 bit, Debian 12 o Ubuntu Server 22.04+).
# Il database PostgreSQL gira in Docker (deploy/raspberry/docker-compose.yml); l'app gira con Node come servizio.
# Uso, dalla cartella del progetto sul Raspberry:   sudo bash deploy/raspberry/install.sh
# Si può rilanciare: non cancella dati e non cambia le password già create.
set -euo pipefail

APP_DIR=/opt/tonecraft
ENV_DIR=/etc/tonecraft
ENV_FILE=$ENV_DIR/tonecraft.env
DB_ENV_FILE=$ENV_DIR/db.env
BACKUP_DIR=/var/backups/tonecraft
PORT=${PORT:-3000}
SRC_DIR=$(cd "$(dirname "$0")/../.." && pwd)
COMPOSE=(docker compose -f "$APP_DIR/deploy/raspberry/docker-compose.yml" --env-file "$DB_ENV_FILE")

if [[ $EUID -ne 0 ]]; then echo "Lancia lo script con sudo." >&2; exit 1; fi
if [[ ! -f "$SRC_DIR/package.json" ]]; then echo "Non trovo il progetto in $SRC_DIR" >&2; exit 1; fi
ARCH=$(dpkg --print-architecture)
if [[ "$ARCH" != "arm64" && "$ARCH" != "amd64" ]]; then
  echo "Serve un sistema a 64 bit (trovato: $ARCH). Installa Raspberry Pi OS Lite (64-bit)." >&2
  exit 1
fi

echo "== 1/9 Pacchetti di sistema"
apt-get update
apt-get install -y --no-install-recommends ca-certificates curl gnupg avahi-daemon rsync openssl

echo "== 2/9 Docker (dal repository ufficiale di Docker)"
if ! command -v docker >/dev/null 2>&1 || ! docker compose version >/dev/null 2>&1; then
  # shellcheck disable=SC1091
  . /etc/os-release
  DIST=$ID
  [[ "$DIST" == "raspbian" ]] && DIST=debian
  install -d -m 0755 /etc/apt/keyrings
  curl -fsSL "https://download.docker.com/linux/$DIST/gpg" -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
  echo "deb [arch=$ARCH signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/$DIST $VERSION_CODENAME stable" \
    > /etc/apt/sources.list.d/docker.list
  apt-get update
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
fi
systemctl enable --now docker
docker compose version

echo "== 3/9 Node.js 22"
NODE_MAJOR=$(node -v 2>/dev/null | sed -E 's/^v([0-9]+).*/\1/' || echo 0)
if [[ "${NODE_MAJOR:-0}" -lt 22 ]]; then
  install -d -m 0755 /etc/apt/keyrings
  curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | gpg --dearmor --yes -o /etc/apt/keyrings/nodesource.gpg
  echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_22.x nodistro main" > /etc/apt/sources.list.d/nodesource.list
  apt-get update
  apt-get install -y nodejs
fi
node -v

echo "== 4/9 Utente di servizio, cartelle e password"
id tonecraft >/dev/null 2>&1 || useradd --system --home "$APP_DIR" --shell /usr/sbin/nologin tonecraft
install -d -m 0750 -o tonecraft -g tonecraft "$APP_DIR"
install -d -m 0750 -o root -g tonecraft "$ENV_DIR"
install -d -m 0700 -o root -g root "$BACKUP_DIR"
if [[ ! -f "$DB_ENV_FILE" ]]; then
  # Password casuali (solo lettere e cifre): una per l'amministratore del database, una per l'app.
  APP_DB_PASSWORD=$(openssl rand -hex 24)
  cat > "$DB_ENV_FILE" <<EOF
# Password del database in Docker. Solo root può leggerlo.
POSTGRES_PASSWORD=$(openssl rand -hex 24)
APP_DB_PASSWORD=$APP_DB_PASSWORD
DB_PORT=5432
EOF
  chmod 0600 "$DB_ENV_FILE"
else
  APP_DB_PASSWORD=$(sed -n 's/^APP_DB_PASSWORD=//p' "$DB_ENV_FILE")
fi
if [[ ! -f "$ENV_FILE" ]]; then
  cat > "$ENV_FILE" <<EOF
# Ambiente del servizio Tono. Solo root e il servizio possono leggerlo.
DATABASE_URL=postgres://tonecraft:$APP_DB_PASSWORD@127.0.0.1:5432/tonecraft
HOST=0.0.0.0
PORT=$PORT
NODE_ENV=production
# Metti 1 se davanti al servizio c'è un proxy HTTPS (Caddy/nginx): cookie solo https e IP reale del client.
COOKIE_SECURE=0
TRUST_PROXY=0
# Registrazione di nuovi account (in sola lettura): aperte oppure chiuse.
REGISTRAZIONI=aperte
# Accesso con Google: serve un indirizzo https (vedi deploy/raspberry/README.md). Lascia vuoto per spegnerlo.
PUBLIC_URL=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
EOF
  chown root:tonecraft "$ENV_FILE"
  chmod 0640 "$ENV_FILE"
fi

echo "== 5/9 Copia del progetto in $APP_DIR"
rsync -a --delete --exclude node_modules --exclude .output --exclude .git --exclude .npm \
  --exclude .env.local --exclude .env.db "$SRC_DIR/" "$APP_DIR/"
chown -R tonecraft:tonecraft "$APP_DIR"

echo "== 6/9 Database in Docker"
# Al primo avvio il container crea l'utente dell'app e il database (deploy/raspberry/db-init/01-tono.sh).
"${COMPOSE[@]}" up -d --wait
docker ps --filter name=tonecraft-db --format '  {{.Names}}: {{.Status}} ({{.Image}})'

echo "== 7/9 Dipendenze e build (qualche minuto su un Raspberry)"
cd "$APP_DIR"
sudo -u tonecraft -H npm ci --no-audit --no-fund
sudo -u tonecraft -H env NODE_OPTIONS=--max-old-space-size=1536 npm run build:server

echo "== 8/9 Migrazioni del database"
sudo -u tonecraft -H node --env-file="$ENV_FILE" scripts/db-migrate.mjs

echo "== 9/9 Servizio, backup notturno e nome in rete"
install -m 0644 deploy/raspberry/tonecraft.service /etc/systemd/system/tonecraft.service
install -m 0755 deploy/raspberry/db-wait.sh /usr/local/sbin/tonecraft-db-wait
install -m 0755 deploy/raspberry/backup.sh /usr/local/sbin/tonecraft-backup
install -m 0644 deploy/raspberry/tonecraft-backup.service /etc/systemd/system/tonecraft-backup.service
install -m 0644 deploy/raspberry/tonecraft-backup.timer /etc/systemd/system/tonecraft-backup.timer
systemctl daemon-reload
systemctl enable --now avahi-daemon
systemctl enable tonecraft.service tonecraft-backup.timer
systemctl restart tonecraft.service
systemctl start tonecraft-backup.timer

if ! docker exec tonecraft-db psql -U postgres -d tonecraft -tAc "SELECT 1 FROM staff_users WHERE role = 'admin' AND active LIMIT 1" | grep -q 1; then
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
echo "  Per entrare: pulsante «Accedi» in alto."
