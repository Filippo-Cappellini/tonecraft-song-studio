import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { ArrowDownUp, Pencil, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Errors,
  errorText,
  Field,
  Forbidden,
  inputClass,
  PageTitle,
  Panel,
  useStaff,
} from "@/components/gestionale/kit";
import {
  addStockMovement,
  listContacts,
  listProducts,
  listShops,
  saveProduct,
  type Product,
} from "@/lib/inventory.functions";
import {
  formatEur,
  MOVEMENT_KINDS,
  parseEur,
  PRODUCT_CATEGORIES,
  stockLevel,
  type MovementKind,
} from "@/lib/shop";
import { ShopLinks } from "@/components/gestionale/ShopLinks";

export const Route = createFileRoute("/gestionale/prodotti")({
  validateSearch: (raw: Record<string, unknown>): { sotto?: boolean } =>
    raw["sotto"] === true || raw["sotto"] === "true" ? { sotto: true } : {},
  component: Prodotti,
});

const LEVEL_STYLE = {
  esaurito: "bg-red-500/15 text-red-300 ring-red-500/30",
  basso: "bg-amber-500/15 text-amber-200 ring-amber-500/30",
  ok: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30",
} as const;
const LEVEL_LABEL = { esaurito: "Esaurito", basso: "Da riordinare", ok: "Disponibile" } as const;

function Prodotti() {
  const staff = useStaff();
  const search = Route.useSearch();
  const [q, setQ] = useState("");
  const [lowOnly, setLowOnly] = useState(!!search.sotto);
  const [includeInactive, setIncludeInactive] = useState(false);
  const [editing, setEditing] = useState<Product | "new" | null>(null);
  const [moving, setMoving] = useState<Product | null>(null);
  const canEdit = staff.can("magazzino");

  const products = useQuery({
    queryKey: ["gestionale", "products", q, lowOnly, includeInactive],
    queryFn: () => listProducts({ data: { q, lowOnly, includeInactive } }),
    enabled: staff.can("magazzino") || staff.can("vendite"),
    placeholderData: (prev) => prev,
  });
  const shops = useQuery({ queryKey: ["gestionale", "shops"], queryFn: () => listShops() });

  if (!staff.can("magazzino") && !staff.can("vendite")) return <Forbidden />;

  return (
    <>
      <PageTitle
        title="Prodotti e giacenze"
        subtitle="Articoli del negozio, scorte e link per confrontarli nei negozi online."
        actions={
          canEdit && (
            <Button onClick={() => setEditing("new")}>
              <Plus /> Nuovo prodotto
            </Button>
          )
        }
      />
      <Panel>
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="relative min-w-56 flex-1">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <input
              className={`${inputClass} pl-9`}
              placeholder="Cerca per nome, codice, marca o categoria"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              aria-label="Cerca prodotti"
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={lowOnly}
              onChange={(e) => setLowOnly(e.target.checked)}
            />{" "}
            Solo da riordinare
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={includeInactive}
              onChange={(e) => setIncludeInactive(e.target.checked)}
            />{" "}
            Anche archiviati
          </label>
        </div>
        {products.isError && <Errors errors={[errorText(products.error)]} />}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr className="border-b">
                <th className="py-2 pr-3">Prodotto</th>
                <th className="py-2 pr-3">Categoria</th>
                <th className="py-2 pr-3 text-right">Prezzo</th>
                <th className="py-2 pr-3 text-right">Giacenza</th>
                <th className="py-2 pr-3">Posizione</th>
                <th className="py-2">Azioni</th>
              </tr>
            </thead>
            <tbody>
              {(products.data ?? []).map((p) => {
                const level = stockLevel(p.stock, p.min_stock);
                return (
                  <tr
                    key={p.id}
                    className={`border-b border-border/50 align-top ${p.active ? "" : "opacity-50"}`}
                  >
                    <td className="py-2 pr-3">
                      <div className="font-medium">{p.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {p.sku}
                        {p.brand ? ` · ${p.brand}` : ""}
                        {p.supplier_name ? ` · forn. ${p.supplier_name}` : ""}
                      </div>
                    </td>
                    <td className="py-2 pr-3">{p.category}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">
                      {formatEur(p.price_cents)}
                    </td>
                    <td className="py-2 pr-3 text-right">
                      <span className="tabular-nums">{p.stock}</span>{" "}
                      <span
                        className={`ml-1 rounded-full px-2 py-0.5 text-xs ring-1 ${LEVEL_STYLE[level]}`}
                      >
                        {LEVEL_LABEL[level]}
                      </span>
                    </td>
                    <td className="py-2 pr-3 text-muted-foreground">{p.location || "—"}</td>
                    <td className="py-2">
                      <div className="flex flex-wrap gap-1">
                        {canEdit && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setEditing(p)}
                            aria-label={`Modifica ${p.name}`}
                          >
                            <Pencil />
                          </Button>
                        )}
                        {canEdit && (
                          <Button size="sm" variant="outline" onClick={() => setMoving(p)}>
                            <ArrowDownUp /> Movimento
                          </Button>
                        )}
                        <ShopLinks
                          shops={shops.data ?? []}
                          query={productQuery(p)}
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {products.data?.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">Nessun prodotto.</p>
          )}
        </div>
      </Panel>
      {editing && (
        <ProductDialog
          product={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
        />
      )}
      {moving && <MovementDialog product={moving} onClose={() => setMoving(null)} />}
    </>
  );
}

/** Testo da cercare nei negozi: marca e nome, senza ripetere la marca se è già nel nome. */
const productQuery = (p: Product) =>
  p.brand && !p.name.toLowerCase().includes(p.brand.toLowerCase()) ? `${p.brand} ${p.name}` : p.name;

function ProductDialog({ product, onClose }: { product: Product | null; onClose: () => void }) {
  const qc = useQueryClient();
  const contacts = useQuery({
    queryKey: ["gestionale", "contacts"],
    queryFn: () => listContacts(),
  });
  const eur = (c: number | undefined) =>
    c === undefined ? "" : (c / 100).toFixed(2).replace(".", ",");
  const [f, setF] = useState({
    sku: product?.sku ?? "",
    name: product?.name ?? "",
    category: product?.category ?? "Accessori",
    brand: product?.brand ?? "",
    model_id: product?.model_id ?? "",
    supplier_id: product?.supplier_id ?? "",
    cost: eur(product?.cost_cents),
    price: eur(product?.price_cents),
    vat: String(product?.vat ?? 22),
    min_stock: String(product?.min_stock ?? 1),
    initial_stock: "0",
    location: product?.location ?? "",
    notes: product?.notes ?? "",
    active: product?.active ?? true,
  });
  const [errors, setErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) =>
    setF({ ...f, [k]: e.target.value });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const cost = f.cost.trim() ? parseEur(f.cost) : 0;
    const price = parseEur(f.price);
    if (cost === null || price === null) return setErrors(["Prezzi: usa un importo come 12,50."]);
    setBusy(true);
    try {
      const r = await saveProduct({
        data: {
          ...f,
          id: product?.id,
          cost_cents: cost,
          price_cents: price,
          initial_stock: product ? 0 : f.initial_stock,
          supplier_id: f.supplier_id || null,
        },
      });
      if (!r.ok) setErrors([r.error]);
      else {
        await qc.invalidateQueries({ queryKey: ["gestionale"] });
        onClose();
      }
    } catch (err) {
      setErrors([errorText(err)]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{product ? "Modifica prodotto" : "Nuovo prodotto"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
          <Field label="Codice (SKU)">
            <input
              className={inputClass}
              value={f.sku}
              onChange={set("sku")}
              required
              maxLength={60}
            />
          </Field>
          <Field label="Nome">
            <input
              className={inputClass}
              value={f.name}
              onChange={set("name")}
              required
              maxLength={200}
            />
          </Field>
          <Field label="Marca">
            <input className={inputClass} value={f.brand} onChange={set("brand")} maxLength={80} />
          </Field>
          <Field label="Categoria">
            <input
              className={inputClass}
              value={f.category}
              onChange={set("category")}
              list="categorie"
              maxLength={60}
            />
            <datalist id="categorie">
              {PRODUCT_CATEGORIES.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </Field>
          <Field label="Prezzo di vendita (€)">
            <input
              className={inputClass}
              inputMode="decimal"
              value={f.price}
              onChange={set("price")}
              required
              placeholder="0,00"
            />
          </Field>
          <Field label="Costo d'acquisto (€)">
            <input
              className={inputClass}
              inputMode="decimal"
              value={f.cost}
              onChange={set("cost")}
              placeholder="0,00"
            />
          </Field>
          <Field label="IVA %">
            <input className={inputClass} inputMode="numeric" value={f.vat} onChange={set("vat")} />
          </Field>
          <Field label="Scorta minima">
            <input
              className={inputClass}
              inputMode="numeric"
              value={f.min_stock}
              onChange={set("min_stock")}
            />
          </Field>
          {!product && (
            <Field label="Giacenza iniziale" help="Registrata come carico.">
              <input
                className={inputClass}
                inputMode="numeric"
                value={f.initial_stock}
                onChange={set("initial_stock")}
              />
            </Field>
          )}
          <Field label="Posizione (scaffale)">
            <input
              className={inputClass}
              value={f.location}
              onChange={set("location")}
              maxLength={80}
            />
          </Field>
          <Field label="Fornitore">
            <select className={inputClass} value={f.supplier_id} onChange={set("supplier_id")}>
              <option value="">—</option>
              {(contacts.data?.suppliers ?? []).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </Field>
          <Field
            label="Modello del catalogo (id, facoltativo)"
            help="Collega il prodotto a un modello dell'app."
          >
            <input
              className={inputClass}
              value={f.model_id}
              onChange={set("model_id")}
              maxLength={120}
            />
          </Field>
          <Field label="Note" className="sm:col-span-2">
            <textarea
              className={inputClass}
              rows={2}
              value={f.notes}
              onChange={set("notes")}
              maxLength={2000}
            />
          </Field>
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input
              type="checkbox"
              checked={f.active}
              onChange={(e) => setF({ ...f, active: e.target.checked })}
            />{" "}
            Attivo (togli la spunta per archiviarlo)
          </label>
          <div className="sm:col-span-2">
            <Errors errors={errors} />
          </div>
          <div className="flex justify-end gap-2 sm:col-span-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Annulla
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? "Salvataggio…" : "Salva"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function MovementDialog({ product, onClose }: { product: Product; onClose: () => void }) {
  const qc = useQueryClient();
  const [kind, setKind] = useState<Exclude<MovementKind, "vendita">>("carico");
  const [quantity, setQuantity] = useState("1");
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await addStockMovement({ data: { productId: product.id, kind, quantity, note } });
      if (!r.ok) setErrors([r.error]);
      else {
        await qc.invalidateQueries({ queryKey: ["gestionale"] });
        onClose();
      }
    } catch (err) {
      setErrors([errorText(err)]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Movimento · {product.name}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Giacenza attuale: <span className="tabular-nums text-foreground">{product.stock}</span>
          </p>
          <Field label="Tipo">
            <select
              className={inputClass}
              value={kind}
              onChange={(e) => setKind(e.target.value as typeof kind)}
            >
              {(Object.keys(MOVEMENT_KINDS) as MovementKind[])
                .filter((k) => k !== "vendita")
                .map((k) => (
                  <option key={k} value={k}>
                    {MOVEMENT_KINDS[k].label}
                  </option>
                ))}
            </select>
          </Field>
          <Field
            label="Quantità"
            help={
              kind === "rettifica"
                ? "Positiva per aggiungere, negativa per togliere (es. -2)."
                : undefined
            }
          >
            <input
              className={inputClass}
              inputMode="numeric"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              required
            />
          </Field>
          <Field label="Nota">
            <input
              className={inputClass}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={300}
              placeholder="es. DDT 123 del fornitore"
            />
          </Field>
          <Errors errors={errors} />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Annulla
            </Button>
            <Button type="submit" disabled={busy}>
              Registra
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
