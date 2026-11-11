import { createServerFn } from "@tanstack/react-start";
import { fetchExternal, safeHttpsUrl } from "./safe-url";

// Ultime notizie musicali dai feed RSS pubblici di Rolling Stone Italia e Rockol.
// Si mostrano titolo, breve sommario, la foto di anteprima scelta dalla testata e il link all'articolo originale.
// La foto è quella del feed oppure, se il feed non la ha, l'immagine di anteprima (og:image) dell'articolo:
// non viene copiata, si usa direttamente dal sito della testata.
export type NewsItem = { title: string; link: string; date: string; source: string; summary: string; image: string | null };

// `hosts`: domini della testata. Link degli articoli e pagine lette dal server devono stare lì.
const FEEDS = [
  { source: "Rolling Stone Italia", url: "https://www.rollingstone.it/feed/", hosts: ["rollingstone.it"] },
  { source: "Rockol", url: "https://www.rockol.it/rss/news", hosts: ["rockol.it"] },
];
const UA = { "User-Agent": "Mozilla/5.0 (TonoSongStudio news)" };

const decode = (s: string) =>
  s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/&quot;/g, '"').replace(/&apos;|&#039;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&");
const tag = (xml: string, name: string) => decode(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`).exec(xml)?.[1] ?? "").trim();
const text = (html: string) => html.replace(/<p>The post[\s\S]*$/i, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
const httpsUrl = (u?: string | null) => safeHttpsUrl(u);

/** Foto inserita dalla testata nel feed (media:content, enclosure o prima immagine del sommario). */
const feedImage = (item: string, description: string) =>
  httpsUrl(/<media:(?:content|thumbnail)[^>]+url="([^"]+)"/.exec(item)?.[1]) ??
  httpsUrl(/<enclosure[^>]+url="([^"]+)"[^>]*type="image/.exec(item)?.[1]) ??
  httpsUrl(/<img[^>]+src="([^"]+)"/.exec(description)?.[1]);

/** Immagine di anteprima dichiarata dall'articolo per la condivisione (og:image). */
async function ogImage(link: string, hosts: readonly string[]): Promise<string | null> {
  try {
    // Solo pagine della testata (il link viene dal feed), letta solo l'intestazione della pagina.
    const res = await fetchExternal(link, { allowedHosts: hosts, headers: UA, timeoutMs: 5000, maxBytes: 60000 });
    if (!res.ok) return null;
    const head = res.text;
    const m = /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i.exec(head)
      ?? /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i.exec(head);
    return httpsUrl(m ? decode(m[1]!) : null);
  } catch {
    return null;
  }
}

let cache: { at: number; items: NewsItem[] } | null = null;

export async function fetchMusicNews(): Promise<NewsItem[]> {
  if (cache && Date.now() - cache.at < 30 * 60 * 1000) return cache.items;
  const lists = await Promise.all(
    FEEDS.map(async (f) => {
      try {
        const res = await fetchExternal(f.url, { allowedHosts: f.hosts, headers: UA, maxBytes: 3_000_000 });
        if (!res.ok) return [];
        const xml = res.text;
        return xml.split(/<item[\s>]/).slice(1).slice(0, 5).flatMap((it): (NewsItem & { hosts: readonly string[] })[] => {
          const title = tag(it, "title");
          const link = safeHttpsUrl(tag(it, "link"), f.hosts);
          const date = new Date(tag(it, "pubDate"));
          if (!title || !link || Number.isNaN(date.getTime())) return [];
          const description = tag(it, "description");
          const summary = text(description);
          return [{
            title: title.slice(0, 300), link, source: f.source, hosts: f.hosts,
            date: date.toISOString(),
            summary: summary.length > 180 ? `${summary.slice(0, 177)}…` : summary,
            image: feedImage(it, description),
          }];
        });
      } catch {
        return [];
      }
    }),
  );
  const found = lists.flat().sort((a, b) => b.date.localeCompare(a.date)).slice(0, 9);
  const items: NewsItem[] = await Promise.all(
    found.map(async ({ hosts, ...n }) => ({ ...n, image: n.image ?? (await ogImage(n.link, hosts)) })),
  );
  if (items.length) cache = { at: Date.now(), items };
  return items;
}

export const getMusicNews = createServerFn({ method: "GET" }).handler(() => fetchMusicNews());
