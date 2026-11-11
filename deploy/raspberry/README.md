# Tono sul Raspberry (app + gestionale)

Il Raspberry esegue tutto da solo, **tutto in Docker** (`deploy/raspberry/docker-compose.yml`):

| Container | Cosa fa |
|---|---|
| `tonecraft-db` | database PostgreSQL 15 (dati nel volume Docker `tonecraft-db`) |
| `tonecraft-db-setup` | a ogni avvio prepara l'utente limitato del database, poi si ferma |
| `tonecraft-migrate` | a ogni avvio applica le migrazioni (tabelle e catalogo), poi si ferma |
| `tonecraft-app` | l'app e il gestionale, porta 3000 |

I due container che si fermano risultano «Exited (0)»: è normale.
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
   tar -czf tono-raspberry.tar.gz --exclude=node_modules --exclude=.output tonecraft-song-studio-main
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
   Lo script installa Docker (dal repository ufficiale), crea la configurazione con password casuali in
   `/etc/tonecraft/tono.env`, costruisce l'immagine dell'app (qualche minuto), avvia i container con
   `docker compose up -d --build` e attiva il backup notturno. Le migrazioni (catalogo completo incluso) le applica
   il container `tonecraft-migrate`.
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
- Per chiudere le registrazioni: `REGISTRAZIONI=chiuse` in `/etc/tonecraft/tono.env`, poi
  `cd /opt/tonecraft/deploy/raspberry && sudo docker compose up -d`. Gli account li crea allora solo l'amministratore.
- Chi entra con Google e non ha ancora un account ne riceve uno in sola lettura (nome utente preso dall'email).
  Google **non** viene mai collegato da solo a un account con la stessa email: chi ha già un account lo collega da
  *Il mio account → Collega Google*. Da *Il mio account* si può anche creare una password per entrare senza Google.

### Accesso con Google

Google permette il suo accesso solo da indirizzi **https con un dominio vero** (oppure `http://localhost`).
Con `http://tono.local:3000` in rete locale **non funziona**: il pulsante resta nascosto finché non è configurato.
Per attivarlo serve quindi un dominio con HTTPS che porti al Raspberry (per esempio un Cloudflare Tunnel o un
proxy HTTPS con certificato), che però rende l'app raggiungibile anche da internet. Poi:

1. Vai su [console.cloud.google.com](https://console.cloud.google.com) → crea un progetto → *API e servizi* →
   *Schermata consenso OAuth* (tipo Esterno, nome «Tono») → *Credenziali* → *Crea credenziali* →
   *ID client OAuth* → tipo **Applicazione web**.
2. In *URI di reindirizzamento autorizzati* metti `https://<il-tuo-dominio>/api/google/ritorno`.
3. Copia ID client e segreto in `/etc/tonecraft/tono.env` (`sudo nano /etc/tonecraft/tono.env`):
   ```
   PUBLIC_URL=https://<il-tuo-dominio>
   GOOGLE_CLIENT_ID=....apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=....
   COOKIE_SECURE=1
   TRUST_PROXY=1
   ```
4. `cd /opt/tonecraft/deploy/raspberry && sudo docker compose up -d`: nella pagina Accedi compare «Continua con Google».

L'app chiede a Google solo nome ed email (verificata), con controlli `state`, `nonce` e PKCE; il segreto resta sul server.

### Password dimenticata

Altri utenti si creano dal gestionale (Utenti e registro → Nuovo utente). Se l'amministratore dimentica la password:
```bash
sudo docker exec -it tonecraft-app node scripts/crea-utente.mjs --username admin --nome "Nome Cognome" --ruolo admin
```
(reimposta la password e riattiva l'utente).

## Comandi utili

Dalla cartella dei container:
```bash
cd /opt/tonecraft/deploy/raspberry
sudo docker compose ps -a                # stato: db e app "healthy", db-setup e migrate "Exited (0)"
sudo docker compose logs -f app          # log dell'app in tempo reale
sudo docker compose restart app          # riavvio dell'app
sudo docker compose up -d                # riavvia tutto (anche dopo aver cambiato /etc/tonecraft/tono.env)
sudo docker compose stop                 # ferma tutto (i dati restano)
sudo docker compose logs db --tail 50    # log del database
sudo docker exec -it tonecraft-db psql -U postgres -d tonecraft   # console SQL
sudo /usr/local/sbin/tonecraft-backup    # backup subito
sudo ls /var/backups/tonecraft           # backup (ogni notte alle 3:15, tenuti gli ultimi 14)
```

I container ripartono da soli a ogni accensione (`restart: unless-stopped`); l'app parte solo dopo che il database
è pronto e le migrazioni sono andate a buon fine. Configurazione e password sono in `/etc/tonecraft/tono.env`
(leggibile solo da root; `docker compose` la legge come `.env`). Il database ascolta solo su `127.0.0.1:5432`:
dalla rete non si raggiunge.

Ripristino di un backup (sovrascrive i dati attuali):
```bash
sudo docker stop tonecraft-app
sudo sh -c 'docker exec -i tonecraft-db pg_restore -U postgres --clean --if-exists -d tonecraft < /var/backups/tonecraft/<file>.dump'
sudo docker start tonecraft-app
```
Copia ogni tanto i backup fuori dal Raspberry (chiavetta o PC): se la scheda SD si rompe, si perdono con lei.

## Aggiornare a una nuova versione

Copia la nuova versione del progetto sul Raspberry e lancia, dalla sua cartella:
```bash
sudo bash deploy/raspberry/update.sh
```
Fa un backup, ricostruisce l'immagine dell'app, applica le nuove migrazioni e riavvia i container.
Dati, utenti e password restano (sono nel volume Docker `tonecraft-db`).

**Da una versione precedente** (app come servizio systemd `tonecraft`): lo stesso `update.sh` passa da solo a Docker.
Ferma e toglie il vecchio servizio, riprende password e impostazioni da `db.env` e `tonecraft.env` in
`/etc/tonecraft/tono.env` (i vecchi file restano come `*.vecchio`) e avvia i container sullo stesso database.

Attenzione: `docker volume rm tonecraft-db` o `docker compose down -v` **cancellano tutti i dati**.

## Sicurezza e limiti (rete locale in http)

- Il database (in Docker, con `no-new-privileges`) ascolta solo sul Raspberry; dalla rete si raggiunge solo l'app (porta 3000).
- **Privilegio minimo nel database**: l'app usa l'utente `tonecraft_app`, che può solo leggere e scrivere i dati.
  Non può creare, modificare o cancellare tabelle, non può modificare né cancellare il registro delle attività,
  non può leggere file del server né creare utenti, e le query oltre 15 secondi vengono interrotte. Così anche una
  SQL injection non potrebbe distruggere il database. Il proprietario delle tabelle (`tonecraft`) serve solo alle
  migrazioni (container `tonecraft-migrate`); il container dell'app non vede le altre password del database.
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
- Il container dell'app gira con un utente senza privilegi (`node`), file system in sola lettura, nessuna capability
  di Linux e `no-new-privileges`.
- In **http** il browser non permette alcune funzioni: **l'accordatore (microfono) e l'installazione come app
  non funzionano** da altri dispositivi (funzionano solo aprendo l'app dal Raspberry stesso). Tutto il resto, compreso
  il gestionale, funziona. Se servono, si può mettere davanti un proxy HTTPS (per esempio Caddy con certificato interno):
  in quel caso imposta `COOKIE_SECURE=1`, `TRUST_PROXY=1` e `APP_BIND=127.0.0.1` in `/etc/tonecraft/tono.env`.
  Ogni dispositivo dovrà però fidarsi del certificato del Raspberry.
- Chiunque nella rete locale vede l'app pubblica; il gestionale richiede sempre l'accesso. Non aprire la porta 3000
  sul router verso internet.

## Come funziona (per chi sviluppa)

- `npm run build:server` compila per Node (`NITRO_PRESET=node-server`) con `VITE_DATA_BACKEND=local`:
  il catalogo si legge da PostgreSQL con funzioni server (`src/lib/catalog.functions.ts`) invece che da Supabase.
  La build normale (`npm run build`, la versione online) resta uguale; il gestionale lì mostra che non è attivo.
- `scripts/db-migrate.mjs` applica i file di `drizzle/migrations` una volta sola (tabella `_tono_migrations`).
- L'immagine dell'app si costruisce da `deploy/Dockerfile` (build per Node, poi solo `.output`,
  migrazioni e script nell'immagine finale).
- Variabili in `/etc/tonecraft/tono.env`: password del database (`POSTGRES_PASSWORD`, `APP_DB_PASSWORD`,
  `APP_RUNTIME_PASSWORD`), `DB_PORT`, `APP_PORT`, `APP_BIND`, `COOKIE_SECURE`, `TRUST_PROXY`, `REGISTRAZIONI`,
  `PUBLIC_URL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`.
- **Sul PC**: copia `.env.db.example` in `.env.db` (cambia le password), poi
  - `npm run docker:up`: tutto in Docker come sul Raspberry, app su `http://localhost:3000`
    (`npm run docker:logs` per i log, `npm run db:down` per fermare);
  - oppure `npm run db:up` (solo il database), `npm run db:migrate:dev` e
    `node --env-file=.env.db scripts/crea-utente.mjs --username admin --nome "Admin" --ruolo admin`, poi
    `npm run build:server` e `node --env-file=.env.db .output/server/index.mjs`.
