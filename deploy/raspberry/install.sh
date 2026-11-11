#!/usr/bin/env bash
# Installa (o aggiorna) Tono su un Raspberry Pi con Linux server a 64 bit
# (Raspberry Pi OS Lite 64 bit, Debian 12 o Ubuntu Server 22.04+). Tutto gira in Docker:
# database, utenti del database, migrazioni e app (deploy/raspberry/docker-compose.yml).
# Uso, dalla cartella del progetto sul Raspberry:   sudo bash deploy/raspberry/install.sh
# Si può rilanciare: non cancella dati e non cambia le password già create.
# Passa da sola alla versione in Docker anche un'installazione fatta prima con il servizio systemd.
set -euo pipefail
# Nessuna domanda da apt (su Ubuntu needrestart aprirebbe una finestra e bloccherebbe lo script).
export DEBIAN_FRONTEND=noninteractive NEEDRESTART_MODE=a

APP_DIR=/opt/tonecraft
ENV_DIR=/etc/tonecraft
CONF=$ENV_DIR/tono.env
BACKUP_DIR=/var/backups/tonecraft
SRC_DIR=$(cd "$(dirname "$0")/../.." && pwd)
COMPOSE_DIR=$APP_DIR/deploy/raspberry
UPDATE=${TONO_UPDATE:-0}

if [[ $EUID -ne 0 ]]; then echo "Lancia lo script con sudo." >&2; exit 1; fi
if [[ ! -f "$SRC_DIR/package.json" ]]; then echo "Non trovo il progetto in $SRC_DIR" >&2; exit 1; fi
ARCH=$(dpkg --print-architecture)
if [[ "$ARCH" != "arm64" && "$ARCH" != "amd64" ]]; then
  echo "Serve un sistema a 64 bit (trovato: $ARCH). Installa Raspberry Pi OS Lite (64-bit)." >&2
  exit 1
fi

echo "== 1/7 Pacchetti di sistema"
if [[ "$UPDATE" != 1 ]] || ! command -v rsync >/dev/null 2>&1; then
  apt-get update
  apt-get install -y --no-install-recommends ca-certificates curl gnupg avahi-daemon rsync openssl
fi

echo "== 2/7 Docker (dal repository ufficiale di Docker)"
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

echo "== 3/7 Configurazione e password ($CONF, leggibile solo da root)"
install -d -m 0700 -o root -g root "$ENV_DIR"
install -d -m 0700 -o root -g root "$BACKUP_DIR"
umask 077
old() { [[ -f "$1" ]] && sed -n "s/^$2=//p" "$1" | tail -1 || true; }
if [[ ! -f "$CONF" ]]; then
  # Dalla vecchia installazione (servizio systemd) riprende password e impostazioni; altrimenti password nuove.
  OLD_DB=$ENV_DIR/db.env OLD_APP=$ENV_DIR/tonecraft.env
  pg=$(old "$OLD_DB" POSTGRES_PASSWORD); owner=$(old "$OLD_DB" APP_DB_PASSWORD); rt=$(old "$OLD_DB" APP_RUNTIME_PASSWORD)
  bind=0.0.0.0; [[ "$(old "$OLD_APP" HOST)" == "127.0.0.1" ]] && bind=127.0.0.1
  cat > "$CONF" <<EOF
# Configurazione di Tono in Docker (docker-compose.yml la legge come .env). Solo root può leggerlo.
# Dopo una modifica:  cd $COMPOSE_DIR && sudo docker compose up -d

# Password del database (solo lettere e cifre; non cambiarle dopo l'installazione).
POSTGRES_PASSWORD=${pg:-$(openssl rand -hex 24)}
APP_DB_PASSWORD=${owner:-$(openssl rand -hex 24)}
APP_RUNTIME_PASSWORD=${rt:-$(openssl rand -hex 24)}
DB_PORT=$(old "$OLD_DB" DB_PORT | grep . || echo 5432)

# Porta dell'app nella rete locale. Con un proxy HTTPS davanti: APP_BIND=127.0.0.1.
APP_PORT=$(old "$OLD_APP" PORT | grep . || echo 3000)
APP_BIND=$bind
# Metti 1 se davanti c'è un proxy HTTPS (Caddy/nginx): cookie solo https e IP reale del client.
COOKIE_SECURE=$(old "$OLD_APP" COOKIE_SECURE | grep . || echo 0)
TRUST_PROXY=$(old "$OLD_APP" TRUST_PROXY | grep . || echo 0)
# Registrazione di nuovi account (in sola lettura): aperte oppure chiuse.
REGISTRAZIONI=$(old "$OLD_APP" REGISTRAZIONI | grep . || echo aperte)
# Accesso con Google: serve un indirizzo https (vedi deploy/raspberry/README.md). Lascia vuoto per spegnerlo.
PUBLIC_URL=$(old "$OLD_APP" PUBLIC_URL)
GOOGLE_CLIENT_ID=$(old "$OLD_APP" GOOGLE_CLIENT_ID)
GOOGLE_CLIENT_SECRET=$(old "$OLD_APP" GOOGLE_CLIENT_SECRET)
EOF
  chmod 0600 "$CONF"
fi
umask 022

echo "== 4/7 Copia del progetto in $APP_DIR"
install -d -m 0755 -o root -g root "$APP_DIR"
if [[ "$SRC_DIR" != "$APP_DIR" ]]; then
  rsync -a --delete --delete-excluded --exclude node_modules --exclude .output --exclude .output.lovable-bak \
    --exclude .git --exclude .npm --exclude .env.local --exclude .env.db --exclude deploy/raspberry/.env \
    "$SRC_DIR/" "$APP_DIR/"
fi
chown -R root:root "$APP_DIR"
# docker compose legge la configurazione da .env accanto al docker-compose.yml.
ln -sfn "$CONF" "$COMPOSE_DIR/.env"

# Vecchia installazione con il servizio systemd: si ferma e si toglie (la porta passa al container).
if [[ -f /etc/systemd/system/tonecraft.service ]]; then
  echo "== Passo alla versione in Docker: tolgo il vecchio servizio tonecraft"
  systemctl disable --now tonecraft.service || true
  rm -f /etc/systemd/system/tonecraft.service /usr/local/sbin/tonecraft-db-wait
  systemctl daemon-reload
  # Vecchi file di configurazione: ora è tutto in tono.env (le password sono le stesse).
  for f in db.env tonecraft.env migrate.env; do
    [[ -f "$ENV_DIR/$f" ]] && mv -f "$ENV_DIR/$f" "$ENV_DIR/$f.vecchio"
  done
fi

echo "== 5/7 Build dell'immagine e avvio (database → utenti → migrazioni → app; qualche minuto su un Raspberry)"
cd "$COMPOSE_DIR"
docker compose up -d --build --wait
docker compose ps -a --format '  {{.Name}}: {{.Status}}'
docker image prune -f >/dev/null || true

echo "== 6/7 Backup notturno, nome in rete e firewall"
install -m 0755 "$COMPOSE_DIR/backup.sh" /usr/local/sbin/tonecraft-backup
install -m 0644 "$COMPOSE_DIR/tonecraft-backup.service" /etc/systemd/system/tonecraft-backup.service
install -m 0644 "$COMPOSE_DIR/tonecraft-backup.timer" /etc/systemd/system/tonecraft-backup.timer
systemctl daemon-reload
systemctl enable --now tonecraft-backup.timer
systemctl enable --now avahi-daemon || true
PORT=$(sed -n 's/^APP_PORT=//p' "$CONF" | tail -1)
PORT=${PORT:-3000}
# Firewall di Ubuntu (ufw), se attivo: apre la porta dell'app. Il database resta chiuso (ascolta solo su 127.0.0.1).
if command -v ufw >/dev/null 2>&1 && ufw status | grep -q "Status: active"; then
  ufw allow "$PORT/tcp" comment "Tono"
fi

echo "== 7/7 Primo amministratore"
if ! docker exec tonecraft-db psql -U postgres -d tonecraft -tAc "SELECT 1 FROM staff_users WHERE role = 'admin' AND active LIMIT 1" | grep -q 1; then
  echo "Crea ora il primo amministratore del gestionale."
  read -rp "Nome utente (minuscole, es. admin): " ADMIN_USER
  read -rp "Nome e cognome: " ADMIN_NAME
  docker exec -it tonecraft-app node scripts/crea-utente.mjs --username "$ADMIN_USER" --nome "$ADMIN_NAME" --ruolo admin
else
  echo "  C'è già un amministratore."
fi

IP=$(hostname -I | awk '{print $1}')
echo
echo "Fatto. Apri dalla rete locale:"
echo "  http://$(hostname).local:$PORT        (oppure http://$IP:$PORT)"
echo "  Per entrare: pulsante «Accedi» in alto."
echo "  Container: cd $COMPOSE_DIR && sudo docker compose ps"
