# Immagine dell'app Tono per il Raspberry (build per Node con il database PostgreSQL locale).
# Le esclusioni dalla build sono in deploy/Dockerfile.dockerignore (accanto a questo file).
# La usa deploy/raspberry/docker-compose.yml (servizi "app" e "migrate"); funziona su arm64 e amd64.

# --- Build ----------------------------------------------------------------------------------------
FROM node:22-bookworm-slim AS build
WORKDIR /src
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
# Sul Raspberry la build usa circa 1,5 GB di memoria.
RUN NODE_OPTIONS=--max-old-space-size=1536 npm run build:server

# --- Esecuzione: solo la build, le migrazioni e gli script (niente sorgenti né dipendenze di sviluppo) ---
FROM node:22-bookworm-slim
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000
WORKDIR /app
COPY --from=build /src/.output ./.output
COPY --from=build /src/scripts ./scripts
COPY --from=build /src/drizzle/migrations ./drizzle/migrations
# Client PostgreSQL per gli script (migrazioni, crea-utente); non ha altre dipendenze.
COPY --from=build /src/node_modules/postgres ./node_modules/postgres
COPY --from=build /src/package.json ./package.json
# Utente senza privilegi già presente nell'immagine di Node.
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:3000/').then(r=>process.exit(r.status<500?0:1),()=>process.exit(1))"]
CMD ["node", ".output/server/index.mjs"]
