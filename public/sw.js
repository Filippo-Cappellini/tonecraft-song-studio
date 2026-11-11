// Service worker di Tono: rende l'app installabile e fa funzionare offline le pagine già aperte
// (accordatore, metronomo, accordi, giochi). I dati del catalogo e le funzioni del server
// restano sempre in rete: non vengono mai salvati qui.
const VERSION = "tono-v2";
const PAGES = `${VERSION}-pagine`;
const STATIC = `${VERSION}-file`;
const PRECACHE = ["/", "/accordatore", "/attrezzi", "/manifest.webmanifest", "/icons/icon-192.png", "/icons/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(PAGES).then((c) => Promise.allSettled(PRECACHE.map((u) => c.add(new Request(u, { cache: "reload" }))))).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

const OFFLINE_HTML = `<!doctype html><html lang="it"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Offline — Tono</title><style>body{font-family:system-ui,sans-serif;background:#161412;color:#eee;display:grid;place-items:center;min-height:100vh;margin:0;text-align:center;padding:1rem}a{color:#f0a83a}</style><div><h1>Sei offline</h1><p>Questa pagina non è ancora stata aperta con la connessione.<br>L'<a href="/accordatore">accordatore</a> e le pagine già visitate funzionano anche senza rete.</p></div></html>`;

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // database, copertine, anteprime: sempre dalla rete
  if (url.pathname.startsWith("/_serverFn") || url.pathname.startsWith("/api/") || url.pathname === "/sw.js") return;
  // Gestionale: dati riservati e sempre aggiornati, mai in cache.
  if (url.pathname.startsWith("/gestionale")) return;

  // Pagine: prima la rete (contenuti aggiornati), se manca la connessione la copia salvata.
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) { const copy = res.clone(); void caches.open(PAGES).then((c) => c.put(url.pathname, copy)); }
          return res;
        })
        .catch(async () =>
          (await caches.match(url.pathname, { cacheName: PAGES })) ??
          new Response(OFFLINE_HTML, { status: 503, headers: { "content-type": "text/html; charset=utf-8" } })),
    );
    return;
  }

  // File del sito (script, stili, font, immagini): hanno un nome che cambia a ogni versione, quindi prima la copia salvata.
  if (["script", "style", "font", "image", "manifest"].includes(req.destination) || url.pathname.startsWith("/assets/")) {
    event.respondWith(
      caches.match(req, { cacheName: STATIC }).then((hit) =>
        hit ??
        fetch(req).then((res) => {
          if (res.ok && res.type === "basic") { const copy = res.clone(); void caches.open(STATIC).then((c) => c.put(req, copy)); }
          return res;
        })),
    );
  }
});
