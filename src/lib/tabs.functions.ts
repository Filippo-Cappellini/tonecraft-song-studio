import { createServerFn } from "@tanstack/react-start";
import { cleanText, fetchExternalJson, inputObject } from "./safe-url";

const norm = (x = "") => x.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
const slug = (x = "") => x.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

type SsSong = { id?: number; songId?: number; title?: string; artist?: string | { name?: string } };

// Cerca il brano su Songsterr e restituisce il link diretto alla tablatura originale.
// Se la ricerca fallisce, restituisce null e la pagina usa il link di ricerca.
export const findOriginalTab = createServerFn({ method: "GET" })
  .inputValidator((d: { artist: string; title: string }) => {
    const o = inputObject(d);
    return { artist: cleanText(o["artist"], 120), title: cleanText(o["title"], 160) };
  })
  .handler(async ({ data }) => {
    if (!data.artist || !data.title) return { url: null as string | null };
    try {
      const q = encodeURIComponent(`${data.artist} ${data.title}`);
      const list = await fetchExternalJson<SsSong[]>(`https://www.songsterr.com/api/songs?size=10&pattern=${q}`, {
        allowedHosts: ["songsterr.com"],
        headers: { Accept: "application/json" },
      });
      if (!Array.isArray(list)) return { url: null as string | null };
      const a = norm(data.artist.split(/ & | and |, /i)[0]);
      const t = norm(data.title);
      const nameOf = (s: SsSong) => (typeof s.artist === "string" ? s.artist : s.artist?.name) ?? "";
      const best =
        list.find((s) => norm(s.title) === t && norm(nameOf(s)).includes(a)) ??
        list.find((s) => norm(s.title).includes(t) && norm(nameOf(s)).includes(a));
      const id = best?.songId ?? best?.id;
      if (!best || !Number.isSafeInteger(id) || (id as number) <= 0) return { url: null as string | null };
      return { url: `https://www.songsterr.com/a/wsa/${slug(nameOf(best))}-${slug(best.title)}-tab-s${id}` };
    } catch {
      return { url: null as string | null };
    }
  });
