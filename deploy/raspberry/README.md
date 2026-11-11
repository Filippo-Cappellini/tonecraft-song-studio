# Tono sul Raspberry (app + gestionale)

Il Raspberry esegue tutto da solo: l'app, il gestionale e un database PostgreSQL locale.
Non serve internet per usarlo (solo per copertine, anteprime audio, notizie e link ai negozi).
È raggiungibile dalla rete locale, non da internet.

## Cosa serve

- Raspberry Pi 4 o 5 con **almeno 2 GB di RAM** (la build dell'app ne usa circa 1,5 GB).
- Scheda SD o SSD da 16 GB o più.
- **Raspberry Pi OS Lite 64 bit** (consigliato), oppure Debian 12 / Ubuntu Server 22.04+ (64 bit).
- Accesso SSH al Raspberry e connessione a internet durante l'installazione.

Con Raspberry Pi Imager imposta già nome host (es. `tono`), utente, password, Wi-Fi e SSH attivo.

## Installazione

1. Dal PC (PowerShell, nella cartella che contiene il progetto) crea un archivio senza le cartelle pesanti
   e copialo sul Raspberry:
   ```powershell
   tar -czf tono-raspberry.tar.gz --exclude=node_modules --exclude=.output --exclude=.output.lovable-bak tonecraft-song-studio-main
   scp tono-raspberry.tar.gz utente@tono.local:~/
   ```
   Sul Raspberry: `tar -xzf tono-raspberry.tar.gz`.
   **In alternativa, da GitHub** (repository privato `Filippo-Cappellini/tonecraft-song-studio`):
   su github.com → Settings → Developer settings → Personal access tokens → *Fine-grained tokens* crea un token
   con accesso **solo a questo repository** e permesso **Contents: Read-only**. Poi sul Raspberry:
   ```bash
   sudo apt-get install -y git
   git clone https://github.com/Filippo-Cappellini/tonecraft-song-studio.git tonecraft-song-studio-main
   ```
   Come nome utente scrivi `Filippo-Cappellini`, come password incolla il token.
   Per aggiornare in seguito: `cd tonecraft-song-studio-main && git pull && sudo bash deploy/raspberry/update.sh`.
2. Sul Raspberry:
   ```bash
   cd ~/tonecraft-song-studio-main
   sudo bash deploy/raspberry/install.sh
   ```
   Lo script installa PostgreSQL e Node.js 22, crea il database con una password casuale, compila l'app,
   applica le migrazioni (catalogo completo incluso), avvia il servizio e attiva il backup notturno.
   Alla fine chiede nome utente e password del **primo amministratore** del gestionale.
3. Da un PC o telefono nella stessa rete apri:
   - App: `http://tono.local:3000`
   - Per lo staff: pulsante **Accedi** nel menu in alto. Dopo l'accesso lo stesso pulsante diventa il menu
     dell'utente, con solo le sezioni del gestionale che il suo ruolo può aprire, e «Esci».

Se `tono.local` non si apre (alcuni Android), usa l'indirizzo IP che lo script stampa alla fine.

## Il gestionale

Il gestionale è il **database dell'app**: qui sono salvati tutti i dati che l'app mostra.

| Ruolo | Cosa può fare |
|---|---|
| Amministratore | Tutto: dati dell'app, utenti, negozi online e registro delle modifiche |
| Redattore | Consulta e modifica i dati dell'app (brani, suoni, strumenti, modelli, amplificatori, esercizi, corsi, lezioni) |
| Sola lettura | Consulta il database senza poter modificare nulla |

- **Database**: tutte le tabelle con il numero di righe salvate, lo spazio occupato e (per l'amministratore) le ultime
  modifiche. Si apre una tabella per cercare, consultare e, se il ruolo lo permette, aggiungere, modificare o eliminare righe.
  Le modifiche si vedono subito nelle pagine dell'app.
- **Negozi online**: ricerca di uno strumento su **Thomann**, **Strumentimusicali.net** e **MusicalStore2005** insieme.
  L'amministratore può aggiungere o cambiare negozi. MusicalStore2005 non permette la verifica automatica del suo
  indirizzo di ricerca, quindi per ora apre la home: per aggiungerlo, fai una ricerca sul loro sito, copia l'indirizzo
  della pagina dei risultati, metti `{q}` al posto della parola cercata e salvalo nella tabella *Negozi online*.
- Ogni modifica resta nel **registro** (Utenti e registro).

Altri utenti si creano dal gestionale (Utenti e registro → Nuovo utente). Se l'amministratore dimentica la password:
```bash
cd /opt/tonecraft
sudo -u tonecraft node --env-file=/etc/tonecraft/tonecraft.env scripts/crea-utente.mjs --username admin --nome "Nome Cognome" --ruolo admin
```
(reimposta la password e riattiva l'utente).

## Comandi utili

```bash
sudo systemctl status tonecraft          # stato del servizio
sudo journalctl -u tonecraft -f          # log in tempo reale
sudo systemctl restart tonecraft         # riavvio
sudo /usr/local/sbin/tonecraft-backup    # backup subito
ls /var/backups/tonecraft                # backup (ogni notte alle 3:15, tenuti gli ultimi 14)
```

Ripristino di un backup (sovrascrive i dati attuali):
```bash
sudo systemctl stop tonecraft
sudo -u postgres pg_restore --clean --if-exists -d tonecraft /var/backups/tonecraft/<file>.dump
sudo systemctl start tonecraft
```
Copia ogni tanto i backup fuori dal Raspberry (chiavetta o PC): se la scheda SD si rompe, si perdono con lei.

## Aggiornare a una nuova versione

Copia la nuova versione del progetto sul Raspberry e lancia, dalla sua cartella:
```bash
sudo bash deploy/raspberry/update.sh
```
Fa un backup, ricompila, applica le nuove migrazioni e riavvia. Dati, utenti e password restano.

## Sicurezza e limiti (rete locale in http)

- Il database ascolta solo sul Raspberry; dalla rete si raggiunge solo l'app (porta 3000).
- Le password sono salvate con scrypt; dopo 5 tentativi sbagliati l'accesso si blocca per 10 minuti.
- Il servizio gira con un utente senza privilegi e con le protezioni di systemd.
- In **http** il browser non permette alcune funzioni: **l'accordatore (microfono) e l'installazione come app
  non funzionano** da altri dispositivi (funzionano solo aprendo l'app dal Raspberry stesso). Tutto il resto, compreso
  il gestionale, funziona. Se servono, si può mettere davanti un proxy HTTPS (per esempio Caddy con certificato interno):
  in quel caso imposta `COOKIE_SECURE=1`, `TRUST_PROXY=1` e `HOST=127.0.0.1` in `/etc/tonecraft/tonecraft.env`.
  Ogni dispositivo dovrà però fidarsi del certificato del Raspberry.
- Chiunque nella rete locale vede l'app pubblica; il gestionale richiede sempre l'accesso. Non aprire la porta 3000
  sul router verso internet.

## Come funziona (per chi sviluppa)

- `npm run build:server` compila per Node (`NITRO_PRESET=node-server`) con `VITE_DATA_BACKEND=local`:
  il catalogo si legge da PostgreSQL con funzioni server (`src/lib/catalog.functions.ts`) invece che da Supabase.
  La build normale (`npm run build`, quella di Lovable) resta uguale; il gestionale lì mostra che non è attivo.
- `scripts/db-migrate.mjs` applica i file di `drizzle/migrations` una volta sola (tabella `_tono_migrations`).
- Variabili in `/etc/tonecraft/tonecraft.env`: `DATABASE_URL`, `HOST`, `PORT`, `COOKIE_SECURE`, `TRUST_PROXY`.
