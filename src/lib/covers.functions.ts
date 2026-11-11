import { createServerFn } from "@tanstack/react-start";
import { cleanText, fetchExternalJson, inputObject, safeHttpsUrl } from "./safe-url";

const ITUNES = ["itunes.apple.com"];
// Domini da cui Apple serve copertine, anteprime audio e pagine dei brani.
const APPLE_MEDIA = ["mzstatic.com", "apple.com"];

// Looks up album artwork through the public iTunes Search API.
export const getCover = createServerFn({ method: "GET" })
  .inputValidator((d: { artist: string; album: string }) => {
    const o = inputObject(d);
    return { artist: cleanText(o["artist"], 120), album: cleanText(o["album"], 160) };
  })
  .handler(async ({ data }) => {
    const none = { url: null as string | null };
    if (!data.artist || !data.album) return none;
    const term = encodeURIComponent(`${data.artist} ${data.album}`);
    try {
      const json = await fetchExternalJson<{ results?: { artworkUrl100?: string; artistName?: string; collectionName?: string }[] }>(
        `https://itunes.apple.com/search?term=${term}&entity=album&limit=15`,
        { allowedHosts: ITUNES },
      );
      if (!json || !Array.isArray(json.results)) return none;
      const norm = (x = "") => String(x).toLowerCase().replace(/[^a-z0-9]/g, "");
      const a = norm(data.artist.split(/ & | and /i)[0]);
      const al = norm(data.album);
      const results = json.results.filter((r) => norm(r.artistName).includes(a) || a.includes(norm(r.artistName)));
      const best = results.find((r) => norm(r.collectionName).startsWith(al)) ?? results.find((r) => norm(r.collectionName).includes(al)) ?? results[0];
      const art = safeHttpsUrl(best?.artworkUrl100, APPLE_MEDIA);
      return { url: art ? art.replace("100x100bb", "600x600bb") : null };
    } catch {
      return none;
    }
  });

// Anteprima ufficiale di 30 secondi del brano, sempre dall'iTunes Search API (l'audio resta sui server di Apple).
export const getPreview = createServerFn({ method: "GET" })
  .inputValidator((d: { artist: string; title: string }) => {
    const o = inputObject(d);
    return { artist: cleanText(o["artist"], 120), title: cleanText(o["title"], 160) };
  })
  .handler(async ({ data }) => {
    const none = { url: null as string | null, page: null as string | null };
    if (!data.artist || !data.title) return none;
    const term = encodeURIComponent(`${data.artist} ${data.title}`);
    try {
      const json = await fetchExternalJson<{ results?: { previewUrl?: string; trackViewUrl?: string; artistName?: string; trackName?: string }[] }>(
        `https://itunes.apple.com/search?term=${term}&entity=song&limit=25`,
        { allowedHosts: ITUNES },
      );
      if (!json || !Array.isArray(json.results)) return none;
      const norm = (x = "") => String(x).toLowerCase().normalize("NFD").replace(/[^a-z0-9]/g, "");
      const a = norm(data.artist.split(/ & | and | ft\. /i)[0]);
      const t = norm(data.title.split(/ \(/)[0]);
      const results = json.results.filter((r) => safeHttpsUrl(r.previewUrl, APPLE_MEDIA) && (norm(r.artistName).includes(a) || a.includes(norm(r.artistName))));
      // Prima la versione con il titolo esatto, poi quelle che lo contengono (evitando live e remix se possibile).
      const plain = (r: { trackName?: string }) => !/live|remix|karaoke|cover|instrumental/i.test(r.trackName ?? "");
      const best =
        results.find((r) => norm(r.trackName) === t && plain(r)) ??
        results.find((r) => norm(r.trackName).startsWith(t) && plain(r)) ??
        results.find((r) => norm(r.trackName).includes(t));
      return best ? { url: safeHttpsUrl(best.previewUrl, APPLE_MEDIA), page: safeHttpsUrl(best.trackViewUrl, APPLE_MEDIA) } : none;
    } catch {
      return none;
    }
  });
