import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Minus, Plus, Search, Trash2, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Errors,
  errorText,
  Field,
  fmtDate,
  Forbidden,
  inputClass,
  Notice,
  PageTitle,
  Panel,
  useStaff,
} from "@/components/gestionale/kit";
import {
  cancelSale,
  createSale,
  listContacts,
  listProducts,
  listSales,
  type Product,
} from "@/lib/inventory.functions";
import { cartProblems, cartTotal, formatEur, parseEur, PAYMENTS, type Payment } from "@/lib/shop";

export const Route = createFileRoute("/gestionale/vendite")({ component: Vendite });

type Line = { product: Product; quantity: number; price: string };

function Vendite() {
  const staff = useStaff();
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [payment, setPayment] = useState<Payment>("carta");
  const [customerId, setCustomerId] = useState("");
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<string[]>([]);
  const [done, setDone] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const allowed = staff.can("vendite");
  const products = useQuery({
    queryKey: ["gestionale", "products", q, false, false],
    queryFn: () => listProducts({ data: { q } }),
    enabled: allowed && q.trim().length > 0,
    placeholderData: (p) => p,
  });
  const contacts = useQuery({
    queryKey: ["gestionale", "contacts"],
    queryFn: () => listContacts(),
    enabled: allowed,
  });
  const sales = useQuery({
    queryKey: ["gestionale", "sales"],
    queryFn: () => listSales(),
    enabled: allowed,
  });

  const cart = useMemo(
    () =>
      lines.map((l) => ({
        productId: l.product.id,
        quantity: l.quantity,
        unitPriceCents: parseEur(l.price) ?? -1,
      })),
    [lines],
  );
  const total = cartTotal(cart.filter((l) => l.unitPriceCents >= 0));

  if (!allowed) return <Forbidden />;

  const add = (p: Product) => {
    setDone(null);
    setLines((ls) => {
      const i = ls.findIndex((l) => l.product.id === p.id);
      if (i < 0)
        return [
          ...ls,
          { product: p, quantity: 1, price: (p.price_cents / 100).toFixed(2).replace(".", ",") },
        ];
      return ls.map((l, j) => (j === i ? { ...l, quantity: l.quantity + 1 } : l));
    });
  };
  const update = (i: number, patch: Partial<Line>) =>
    setLines((ls) => ls.map((l, j) => (j === i ? { ...l, ...patch } : l)));

  const submit = async () => {
    const problems = [
      ...(cart.some((l) => l.unitPriceCents < 0) ? ["Prezzo non valido in una riga."] : []),
      ...cartProblems(cart, new Map(lines.map((l) => [l.product.id, l.product]))),
    ];
    if (problems.length) return setErrors(problems);
    setBusy(true);
    setErrors([]);
    try {
      const r = await createSale({
        data: { lines: cart, payment, customerId: customerId || null, note },
      });
      if (!r.ok) return setErrors([r.error]);
      setDone(`Vendita n. ${r.number} registrata: ${formatEur(total)}.`);
      setLines([]);
      setNote("");
      setCustomerId("");
      setQ("");
      await qc.invalidateQueries({ queryKey: ["gestionale"] });
    } catch (e) {
      setErrors([errorText(e)]);
    } finally {
      setBusy(false);
    }
  };

  const cancel = async (id: string, number: number) => {
    if (!window.confirm(`Annullare la vendita n. ${number}? La merce torna in giacenza.`)) return;
    try {
      const r = await cancelSale({ data: { id } });
      if (!r.ok) window.alert(r.error);
      await qc.invalidateQueries({ queryKey: ["gestionale"] });
    } catch (e) {
      window.alert(errorText(e));
    }
  };

  return (
    <>
      <PageTitle
        title="Vendite al banco"
        subtitle="Cerca i prodotti, componi lo scontrino e registra il pagamento. La giacenza scala da sola."
      />
      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <Panel title="Aggiungi prodotti">
          <div className="relative mb-3">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <input
              className={`${inputClass} pl-9`}
              placeholder="Nome, codice o marca"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              aria-label="Cerca prodotti da vendere"
              autoFocus
            />
          </div>
          <ul className="divide-y text-sm">
            {q.trim() &&
              (products.data ?? []).map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-2 py-2">
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{p.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {p.sku} · disponibili {p.stock}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    <span className="tabular-nums">{formatEur(p.price_cents)}</span>
                    <Button size="sm" onClick={() => add(p)} disabled={p.stock <= 0}>
                      <Plus /> Aggiungi
                    </Button>
                  </span>
                </li>
              ))}
          </ul>
          {!q.trim() && <p className="text-sm text-muted-foreground">Scrivi per cercare.</p>}
        </Panel>

        <Panel title="Scontrino">
          {lines.length === 0 ? (
            <p className="text-sm text-muted-foreground">Vuoto.</p>
          ) : (
            <ul className="space-y-3 text-sm">
              {lines.map((l, i) => (
                <li key={l.product.id} className="rounded-xl border p-3">
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-medium">{l.product.name}</span>
                    <button
                      type="button"
                      className="text-muted-foreground hover:text-destructive"
                      onClick={() => setLines(lines.filter((_, j) => j !== i))}
                      aria-label={`Togli ${l.product.name}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <Button
                      size="icon"
                      variant="outline"
                      className="h-7 w-7"
                      onClick={() => update(i, { quantity: Math.max(1, l.quantity - 1) })}
                      aria-label="Uno in meno"
                    >
                      <Minus />
                    </Button>
                    <span className="w-6 text-center tabular-nums">{l.quantity}</span>
                    <Button
                      size="icon"
                      variant="outline"
                      className="h-7 w-7"
                      onClick={() => update(i, { quantity: l.quantity + 1 })}
                      aria-label="Uno in più"
                    >
                      <Plus />
                    </Button>
                    <span className="ml-auto text-xs text-muted-foreground">€ cad.</span>
                    <input
                      className={`${inputClass} w-24 py-1 text-right`}
                      inputMode="decimal"
                      value={l.price}
                      onChange={(e) => update(i, { price: e.target.value })}
                      aria-label="Prezzo unitario"
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-4 space-y-3">
            <Field label="Pagamento">
              <select
                className={inputClass}
                value={payment}
                onChange={(e) => setPayment(e.target.value as Payment)}
              >
                {(Object.keys(PAYMENTS) as Payment[]).map((p) => (
                  <option key={p} value={p}>
                    {PAYMENTS[p]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Cliente (facoltativo)">
              <select
                className={inputClass}
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}
              >
                <option value="">—</option>
                {(contacts.data?.customers ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Nota">
              <input
                className={inputClass}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={300}
              />
            </Field>
            <div className="flex items-center justify-between border-t pt-3 text-lg">
              <span>Totale</span>
              <span className="font-display tabular-nums">{formatEur(total)}</span>
            </div>
            <Errors errors={errors} />
            {done && <Notice>{done}</Notice>}
            <Button className="w-full" onClick={submit} disabled={busy || lines.length === 0}>
              {busy ? "Registrazione…" : "Registra vendita"}
            </Button>
          </div>
        </Panel>
      </div>

      <Panel title="Ultime vendite" className="mt-6">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px] text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr className="border-b">
                <th className="py-2 pr-3">N.</th>
                <th className="py-2 pr-3">Data</th>
                <th className="py-2 pr-3">Articoli</th>
                <th className="py-2 pr-3">Pagamento</th>
                <th className="py-2 pr-3 text-right">Totale</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody>
              {(sales.data ?? []).map((s) => (
                <tr
                  key={s.id}
                  className={`border-b border-border/50 align-top ${s.canceled_at ? "text-muted-foreground line-through" : ""}`}
                >
                  <td className="py-2 pr-3 tabular-nums">{s.number}</td>
                  <td className="py-2 pr-3">
                    {fmtDate(s.created_at)}
                    <div className="text-xs text-muted-foreground no-underline">
                      {s.username ?? ""}
                      {s.customer_name ? ` · ${s.customer_name}` : ""}
                    </div>
                  </td>
                  <td className="py-2 pr-3">
                    {s.items.map((i) => `${i.quantity}× ${i.name}`).join(", ")}
                  </td>
                  <td className="py-2 pr-3">{PAYMENTS[s.payment]}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{formatEur(s.total_cents)}</td>
                  <td className="py-2 text-right">
                    {!s.canceled_at && staff.can("magazzino") && (
                      <Button size="sm" variant="ghost" onClick={() => cancel(s.id, s.number)}>
                        <Undo2 /> Annulla
                      </Button>
                    )}
                    {s.canceled_at && <span className="text-xs no-underline">annullata</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {sales.data?.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">Nessuna vendita.</p>
          )}
        </div>
      </Panel>
    </>
  );
}
