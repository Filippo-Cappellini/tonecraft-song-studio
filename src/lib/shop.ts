// Negozi online di fiducia: link di ricerca costruiti dall'indirizzo salvato nel database (nessun dato copiato).
import { safeHttpsUrl } from "./safe-url";

export type Shop = {
  id: string;
  name: string;
  website: string;
  search_url: string | null;
  description: string;
};

/**
 * Link al negozio online: la ricerca del prodotto se il negozio ha un indirizzo di ricerca con {q},
 * altrimenti la home. null se gli indirizzi salvati non sono https validi.
 */
export function shopLink(
  shop: Pick<Shop, "website" | "search_url">,
  query: string,
): { href: string; search: boolean } | null {
  const q = query.trim().replace(/\s+/g, " ").slice(0, 120);
  if (q && shop.search_url && shop.search_url.includes("{q}")) {
    const href = safeHttpsUrl(shop.search_url.replace("{q}", encodeURIComponent(q)));
    if (href) return { href, search: true };
  }
  const home = safeHttpsUrl(shop.website);
  return home ? { href: home, search: false } : null;
}
