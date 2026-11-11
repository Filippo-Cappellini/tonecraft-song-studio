import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { PageTitle, Panel, Stat, useStaff } from "@/components/gestionale/kit";
import { getDashboard, type Dashboard } from "@/lib/inventory.functions";
import { formatEur } from "@/lib/shop";
import { TABLE_NAMES, TABLES } from "@/lib/admin-tables";

export const Route = createFileRoute("/gestionale/")({ component: Riepilogo });

function Riepilogo() {
  const staff = useStaff();
  const shop = staff.can("magazzino") || staff.can("vendite");
  const dash = useQuery({
    queryKey: ["gestionale", "dashboard"],
    queryFn: () => getDashboard(),
    enabled: shop,
    refetchInterval: 60_000,
  });

  return (
    <>
      <PageTitle
        title={`Ciao, ${staff.user?.full_name.split(" ")[0] ?? ""}`}
        subtitle="Situazione del negozio e scorciatoie."
      />
      {shop && dash.data && <ShopSummary d={dash.data} />}
      {shop && dash.isError && (
        <Panel>
          <p className="text-sm text-destructive">Riepilogo non disponibile.</p>
        </Panel>
      )}
      {staff.can("catalogo") && (
        <Panel title="Catalogo dell'app" className="mt-6">
          <p className="mb-3 text-sm text-muted-foreground">
            Le modifiche si vedono subito nelle pagine pubbliche (ricaricandole).
          </p>
          <div className="flex flex-wrap gap-2">
            {TABLE_NAMES.filter((t) => TABLES[t].group === "Catalogo").map((t) => (
              <Link
                key={t}
                to="/gestionale/tabelle/$table"
                params={{ table: t }}
                className="rounded-full border px-3 py-1.5 text-sm hover:border-primary hover:text-primary"
              >
                {TABLES[t].label}
              </Link>
            ))}
          </div>
        </Panel>
      )}
    </>
  );
}

function ShopSummary({ d }: { d: Dashboard }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat
          label="Incasso di oggi"
          value={formatEur(d.todayCents)}
          hint={`${d.todaySales} vendite`}
        />
        <Stat
          label="Incasso del mese"
          value={formatEur(d.monthCents)}
          hint={`${d.monthSales} vendite`}
        />
        <Stat
          label="Pezzi in magazzino"
          value={d.units.toLocaleString("it-IT")}
          hint={`${d.products} prodotti attivi`}
        />
        <Stat
          label="Valore a costo"
          value={formatEur(d.stockValueCents)}
          hint="giacenza × costo d'acquisto"
        />
      </div>
      <Panel title="Incassi degli ultimi 30 giorni">
        <SalesBars days={d.last30} />
      </Panel>
      <div className="grid gap-6 md:grid-cols-2">
        <Panel
          title="Da riordinare"
          actions={
            <Link
              to="/gestionale/prodotti"
              search={{ sotto: true }}
              className="text-sm text-primary hover:underline"
            >
              Vedi tutti
            </Link>
          }
        >
          {d.lowStock.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nessun prodotto sotto la scorta minima.</p>
          ) : (
            <ul className="divide-y text-sm">
              {d.lowStock.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-2 py-2">
                  <span className="min-w-0 truncate">
                    <AlertTriangle className="mr-1 inline h-3.5 w-3.5 text-amber-400" aria-hidden />
                    {p.name} <span className="text-muted-foreground">· {p.sku}</span>
                  </span>
                  <span className="shrink-0 tabular-nums">
                    {p.stock === 0 ? "Esaurito" : `${p.stock} (min ${p.min_stock})`}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel title="Più venduti (30 giorni)">
          {d.top.length === 0 ? (
            <p className="text-sm text-muted-foreground">Ancora nessuna vendita.</p>
          ) : (
            <ol className="divide-y text-sm">
              {d.top.map((t) => (
                <li key={t.name} className="flex justify-between gap-2 py-2">
                  <span className="truncate">{t.name}</span>
                  <span className="shrink-0 tabular-nums text-muted-foreground">
                    {t.quantity} pz · {formatEur(t.cents)}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </Panel>
      </div>
    </div>
  );
}

/** Una barra per giorno, con il valore al passaggio del mouse (o al tocco) e una tabella per chi usa lo screen reader. */
function SalesBars({ days }: { days: Dashboard["last30"] }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...days.map((d) => d.cents));
  const fmtDay = (s: string) =>
    new Date(`${s}T12:00:00`).toLocaleDateString("it-IT", { day: "numeric", month: "short" });
  const shown = hover !== null ? days[hover] : null;
  return (
    <div>
      <div className="mb-2 h-5 text-sm text-muted-foreground" aria-hidden>
        {shown ? (
          <>
            <span className="text-foreground tabular-nums">{formatEur(shown.cents)}</span> ·{" "}
            {fmtDay(shown.day)}
          </>
        ) : (
          "Passa sulle barre per vedere il giorno."
        )}
      </div>
      <div
        className="flex h-40 items-end gap-[2px] border-b border-border/60"
        aria-hidden
        onMouseLeave={() => setHover(null)}
      >
        {days.map((d, i) => (
          <div
            key={d.day}
            className="flex h-full flex-1 items-end"
            onMouseEnter={() => setHover(i)}
            onClick={() => setHover(i)}
          >
            <div
              className={`w-full rounded-t-[4px] ${hover === i ? "bg-primary" : "bg-primary/60"}`}
              style={{ height: d.cents ? `${Math.max(2, (d.cents / max) * 100)}%` : "0%" }}
            />
          </div>
        ))}
      </div>
      <div className="mt-1 flex justify-between text-xs text-muted-foreground" aria-hidden>
        <span>{days[0] ? fmtDay(days[0].day) : ""}</span>
        <span>oggi</span>
      </div>
      <table className="sr-only">
        <caption>Incassi giornalieri degli ultimi 30 giorni</caption>
        <tbody>
          {days.map((d) => (
            <tr key={d.day}>
              <th scope="row">{fmtDay(d.day)}</th>
              <td>{formatEur(d.cents)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
