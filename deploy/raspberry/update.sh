#!/usr/bin/env bash
# Aggiorna Tono sul Raspberry con una nuova versione del progetto (dati e configurazione restano).
# Uso, dalla cartella della nuova versione:   sudo bash deploy/raspberry/update.sh
# Fa un backup, poi rilancia install.sh: ricostruisce l'immagine dell'app, applica le migrazioni e riavvia i container.
set -euo pipefail
if [[ $EUID -ne 0 ]]; then echo "Lancia lo script con sudo." >&2; exit 1; fi
if [[ ! -f /etc/tonecraft/tono.env && ! -f /etc/tonecraft/tonecraft.env ]]; then
  echo "Tono non è installato: usa install.sh." >&2
  exit 1
fi

echo "== Backup del database prima dell'aggiornamento"
if docker ps --format '{{.Names}}' | grep -qx tonecraft-db; then
  bash "$(dirname "$0")/backup.sh"
else
  echo "  Container tonecraft-db non avviato: salto il backup."
fi

TONO_UPDATE=1 bash "$(dirname "$0")/install.sh"
