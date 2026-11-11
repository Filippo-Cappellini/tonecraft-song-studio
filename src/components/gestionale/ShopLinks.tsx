import { ExternalLink } from "lucide-react";
import { shopLink, type Shop } from "@/lib/shop";

/** Link di ricerca del prodotto sui negozi online di fiducia (si aprono in una nuova scheda). */
export function ShopLinks({ shops, query }: { shops: readonly Shop[]; query: string }) {
  return (
    <>
      {shops.map((s) => {
        const link = shopLink(s, query);
        if (!link) return null;
        return (
          <a
            key={s.id}
            href={link.href}
            target="_blank"
            rel="noopener noreferrer nofollow"
            title={link.search ? `Cerca «${query}» su ${s.name}` : `Apri ${s.name}`}
            className="inline-flex h-8 items-center gap-1 rounded-md border px-2 text-xs hover:border-primary hover:text-primary"
          >
            {s.name} <ExternalLink className="h-3 w-3" />
          </a>
        );
      })}
    </>
  );
}
