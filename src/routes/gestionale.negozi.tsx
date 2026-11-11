import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ExternalLink, Search } from "lucide-react";
import {
  Errors,
  errorText,
  inputClass,
  PageTitle,
  Panel,
  useStaff,
} from "@/components/gestionale/kit";
import { ShopLinks } from "@/components/gestionale/ShopLinks";
import { listShops } from "@/lib/inventory.functions";
import { safeHttpsUrl } from "@/lib/safe-url";

export const Route = createFileRoute("/gestionale/negozi")({ component: Negozi });

// Negozi online di fiducia: per confrontare prezzi e disponibilità o riordinare. Nessun dato viene copiato dai siti.
function Negozi() {
  const staff = useStaff();
  const [q, setQ] = useState("");
  const shops = useQuery({ queryKey: ["gestionale", "shops"], queryFn: () => listShops() });
  return (
    <>
      <PageTitle
        title="Negozi online di fiducia"
        subtitle="Cerca uno strumento o un accessorio su tutti i negozi insieme. I link si aprono sul sito del negozio."
        actions={
          staff.can("admin") && (
            <Link
              to="/gestionale/tabelle/$table"
              params={{ table: "shops" }}
              className="text-sm text-primary hover:underline"
            >
              Modifica l'elenco
            </Link>
          )
        }
      />
      <Panel>
        <div className="relative mb-4">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <input
            className={`${inputClass} pl-9`}
            placeholder="es. Fender Player Stratocaster"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label="Cosa cercare"
          />
        </div>
        {shops.isError && <Errors errors={[errorText(shops.error)]} />}
        {q.trim() && (
          <div className="mb-5 flex flex-wrap gap-2">
            <ShopLinks shops={shops.data ?? []} query={q} />
          </div>
        )}
        <ul className="grid gap-3 sm:grid-cols-2">
          {(shops.data ?? []).map((s) => {
            const site = safeHttpsUrl(s.website);
            return (
              <li key={s.id} className="rounded-xl border p-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold">{s.name}</span>
                  {site && (
                    <a
                      href={site}
                      target="_blank"
                      rel="noopener noreferrer nofollow"
                      className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                    >
                      Sito <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{s.description}</p>
                {!s.search_url && (
                  <p className="mt-2 text-xs text-amber-200">
                    Ricerca non impostata: si apre la home del negozio.
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      </Panel>
    </>
  );
}
