// Regole del negozio usate dal gestionale: prezzi in centesimi, carrello, giacenze e link ai negozi online.
import { safeHttpsUrl } from "./safe-url";

/** 1234 → "12,34 €" */
export function formatEur(cents: number): string {
  return new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(
    (cents || 0) / 100,
  );
}

/** "12,34", "12.34", "1.234,50", "€ 12" → centesimi; null se non è un importo valido (o negativo). */
export function parseEur(input: string): number | null {
  let s = input.replace(/[€\s]/g, "");
  if (!s) return null;
  // Con virgola: i punti sono separatori delle migliaia. Senza virgola il punto è il decimale.
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  const cents = Math.round(Number(s) * 100);
  return Number.isSafeInteger(cents) && cents <= 2_000_000_000 ? cents : null;
}

export type CartLine = { productId: string; quantity: number; unitPriceCents: number };

export const cartTotal = (lines: readonly CartLine[]) =>
  lines.reduce((t, l) => t + l.quantity * l.unitPriceCents, 0);

/** Problemi del carrello rispetto alle giacenze disponibili (vuoto se si può vendere). */
export function cartProblems(
  lines: readonly CartLine[],
  stock: ReadonlyMap<string, { name: string; stock: number }>,
): string[] {
  const problems: string[] = [];
  if (!lines.length) problems.push("Il carrello è vuoto.");
  const wanted = new Map<string, number>();
  for (const l of lines) {
    if (!Number.isInteger(l.quantity) || l.quantity <= 0) problems.push("Quantità non valida.");
    wanted.set(l.productId, (wanted.get(l.productId) ?? 0) + l.quantity);
  }
  for (const [id, qty] of wanted) {
    const p = stock.get(id);
    if (!p) problems.push("Prodotto non trovato.");
    else if (qty > p.stock) problems.push(`${p.name}: disponibili ${p.stock}, richiesti ${qty}.`);
  }
  return problems;
}

export type StockLevel = "esaurito" | "basso" | "ok";
export function stockLevel(stock: number, minStock: number): StockLevel {
  if (stock <= 0) return "esaurito";
  if (stock <= minStock) return "basso";
  return "ok";
}

export const MOVEMENT_KINDS = {
  carico: { label: "Carico (arrivo merce)", sign: 1 },
  scarico: { label: "Scarico (uso interno, danno)", sign: -1 },
  reso: { label: "Reso del cliente", sign: 1 },
  rettifica: { label: "Rettifica inventario", sign: 0 },
  vendita: { label: "Vendita", sign: -1 },
} as const;
export type MovementKind = keyof typeof MOVEMENT_KINDS;

export const PAYMENTS = {
  contanti: "Contanti",
  carta: "Carta / bancomat",
  bonifico: "Bonifico",
  altro: "Altro",
} as const;
export type Payment = keyof typeof PAYMENTS;

export const PRODUCT_CATEGORIES = [
  "Chitarre",
  "Bassi",
  "Tastiere e piani",
  "Batterie e percussioni",
  "Amplificatori",
  "Effetti",
  "Corde",
  "Accessori",
  "Audio e registrazione",
  "Libri e spartiti",
  "Usato",
];

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
