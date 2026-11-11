# Tono sul Raspberry (app + gestionale)

Il Raspberry esegue tutto da solo: l'app, il gestionale e il database **PostgreSQL in Docker**
(container `tonecraft-db`, dati nel volume Docker `tonecraft-db`).
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
   Lo script installa Docker (dal repository ufficiale) e Node.js 22, avvia il database in Docker con password
   casuali, compila l'app, applica le migrazioni (catalogo completo incluso), avvia il servizio e attiva il backup notturno.
   Alla fine chiede nome utente e password del **primo amministratore** del gestionale.
3. Da un PC o telefono nella stessa rete apri:
   - App: `http://tono.local:3000`
   - Pulsante **Accedi** nel menu in alto: si entra, si **crea un account** oppure (se attivo) si usa
     **Continua con Google**. Dopo l'accesso lo stesso pulsante diventa il menu dell'utente, con solo le sezioni
     che il suo ruolo può aprire, e «Esci».

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

## Account

- **Crea account** (pagina Accedi): nome utente, nome, email facoltativa e password. Il nuovo account è in
  **sola lettura**; l'amministratore può cambiargli ruolo da *Utenti e registro*. Al massimo 5 registrazioni
  all'ora dallo stesso dispositivo.
- Per chiudere le registrazioni: `REGISTRAZIONI=chiuse` in `/etc/tonecraft/tonecraft.env`, poi
  `sudo systemctl restart tonecraft`. Gli account li crea allora solo l'amministratore.
- Chi entra con Google e non ha ancora un account ne riceve uno in sola lettura (nome utente preso dall'email).
  Se esiste già un account con la stessa email, Google viene collegato a quello. Da *Il mio account* si può anche
  creare una password per entrare senza Google.

### Accesso con Google

Google permette il suo accesso solo da indirizzi **https con un dominio vero** (oppure `http://localhost`).
Con `http://tono.local:3000` in rete locale **non funziona**: il pulsante resta nascosto finché non è configurato.
Per attivarlo serve quindi un dominio con HTTPS che porti al Raspberry (per esempio un Cloudflare Tunnel o un
proxy HTTPS con certificato), che però rende l'app raggiungibile anche da internet. Poi:

1. Vai su [console.cloud.google.com](https://console.cloud.google.com) → crea un progetto → *API e servizi* →
   *Schermata consenso OAuth* (tipo Esterno, nome «Tono») → *Credenziali* → *Crea credenziali* →
   *ID client OAuth* → tipo **Applicazione web**.
2. In *URI di reindirizzamento autorizzati* metti `https://<il-tuo-dominio>/api/google/ritorno`.
3. Copia ID client e segreto in `/etc/tonecraft/tonecraft.env`:
   ```
   PUBLIC_URL=https://<il-tuo-dominio>
   GOOGLE_CLIENT_ID=....apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=....
   COOKIE_SECURE=1
   TRUST_PROXY=1
   ```
4. `sudo systemctl restart tonecraft`: nella pagina Accedi compare «Continua con Google».

L'app chiede a Google solo nome ed email (verificata), con controlli `state`, `nonce` e PKCE; il segreto resta sul server.

### Password dimenticata

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
sudo ls /var/backups/tonecraft           # backup (ogni notte alle 3:15, tenuti gli ultimi 14)
sudo docker ps                           # il container tonecraft-db deve essere "healthy"
sudo docker logs tonecraft-db --tail 50  # log del database
sudo docker exec -it tonecraft-db psql -U postgres -d tonecraft   # console SQL
```

Il database parte da solo con Docker a ogni accensione (`restart: unless-stopped`) e l'app lo aspetta prima di
avviarsi. Le password del database sono in `/etc/tonecraft/db.env` (leggibile solo da root). Il database ascolta
solo su `127.0.0.1:5432`: dalla rete non si raggiunge.

Ripristino di un backup (sovrascrive i dati attuali):
```bash
sudo systemctl stop tonecraft
sudo sh -c 'docker exec -i tonecraft-db pg_restore -U postgres --clean --if-exists -d tonecraft < /var/backups/tonecraft/<file>.dump'
sudo systemctl start tonecraft
```
Copia ogni tanto i backup fuori dal Raspberry (chiavetta o PC): se la scheda SD si rompe, si perdono con lei.

## Aggiornare a una nuova versione

Copia la nuova versione del progetto sul Raspberry e lancia, dalla sua cartella:
```bash
sudo bash deploy/raspberry/update.sh
```
Fa un backup, aggiorna il container del database se il `docker-compose.yml` è cambiato, ricompila, applica le
nuove migrazioni e riavvia. Dati, utenti e password restano (sono nel volume Docker `tonecraft-db`).

Attenzione: `docker volume rm tonecraft-db` o `docker compose down -v` **cancellano tutti i dati**.

## Sicurezza e limiti (rete locale in http)

- Il database (in Docker, con `no-new-privileges`) ascolta solo sul Raspberry; dalla rete si raggiunge solo l'app (porta 3000).
- **Privilegio minimo nel database**: l'app usa l'utente `tonecraft_app`, che può solo leggere e scrivere i dati.
  Non può creare, modificare o cancellare tabelle, non può modificare né cancellare il registro delle attività,
  non può leggere file del server né creare utenti, e le query oltre 15 secondi vengono interrotte. Così anche una
  SQL injection non potrebbe distruggere il database. Il proprietario delle tabelle (`tonecraft`) serve solo alle
  migrazioni e le sue credenziali sono in `/etc/tonecraft/migrate.env`, leggibile solo da root.
- **SQL injection**: tutte le query passano i valori come parametri; nomi di tabelle e colonne solo da un elenco fisso.
- **IDOR**: ogni funzione del server controlla chi è collegato e il suo ruolo; le operazioni sul proprio account usano
  l'utente della sessione, mai un id mandato dal browser; utenti, sessioni e registro non sono raggiungibili dall'editor.
- **SSRF**: il server chiama solo siti fissi (iTunes, feed delle notizie, Google) in https, con timeout e limite di
  dimensione; gli indirizzi salvati nel database (negozi, corsi) finiscono solo nei link, mai in richieste del server.
- **Google**: un profilo Google non viene mai collegato da solo a un account con la stessa email (le email delle
  registrazioni non sono verificate); il collegamento si fa da *Il mio account*. Ogni ritorno da Google vale una volta sola.
- Richieste oltre 1 MB rifiutate; risposte con dati personali mai in cache.
- Le password sono salvate con scrypt; dopo 5 tentativi sbagliati da un dispositivo l'accesso si blocca per 10 minuti
  (per un nome utente dopo 20, così nessuno può chiudere fuori l'amministratore con pochi tentativi).
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
- Variabili in `/etc/tonecraft/tonecraft.env`: `DATABASE_URL`, `HOST`, `PORT`, `COOKIE_SECURE`, `TRUST_PROXY`,
  `REGISTRAZIONI`, `PUBLIC_URL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`.
- **Sul PC** si usa lo stesso database in Docker: copia `.env.db.example` in `.env.db` (cambia le password), poi
  `npm run db:up` (avvia il container), `npm run db:migrate:dev` (crea le tabelle) e
  `node --env-file=.env.db scripts/crea-utente.mjs --username admin --nome "Admin" --ruolo admin`.
  Per avviare l'app sul database locale: `npm run build:server`, poi
  `node --env-file=.env.db .output/server/index.mjs` (porta 3000).
