import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Errors,
  errorText,
  fmtDate,
  Forbidden,
  PageTitle,
  Panel,
  useStaff,
} from "@/components/gestionale/kit";
import { listMovements } from "@/lib/inventory.functions";
import { MOVEMENT_KINDS } from "@/lib/shop";

export const Route = createFileRoute("/gestionale/movimenti")({ component: Movimenti });

function Movimenti() {
  const staff = useStaff();
  const moves = useQuery({
    queryKey: ["gestionale", "movements"],
    queryFn: () => listMovements({ data: {} }),
    enabled: staff.can("magazzino"),
  });
  if (!staff.can("magazzino")) return <Forbidden />;
  return (
    <>
      <PageTitle
        title="Movimenti di magazzino"
        subtitle="Ultimi 300 carichi, scarichi, vendite, resi e rettifiche."
      />
      <Panel>
        {moves.isError && <Errors errors={[errorText(moves.error)]} />}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px] text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr className="border-b">
                <th className="py-2 pr-3">Data</th>
                <th className="py-2 pr-3">Prodotto</th>
                <th className="py-2 pr-3">Tipo</th>
                <th className="py-2 pr-3 text-right">Quantità</th>
                <th className="py-2 pr-3">Nota</th>
                <th className="py-2">Utente</th>
              </tr>
            </thead>
            <tbody>
              {(moves.data ?? []).map((m) => (
                <tr key={m.id} className="border-b border-border/50">
                  <td className="py-2 pr-3 whitespace-nowrap">{fmtDate(m.created_at)}</td>
                  <td className="py-2 pr-3">
                    {m.product_name} <span className="text-xs text-muted-foreground">{m.sku}</span>
                  </td>
                  <td className="py-2 pr-3">
                    {MOVEMENT_KINDS[m.kind]?.label.split(" (")[0] ?? m.kind}
                    {m.sale_number ? ` n. ${m.sale_number}` : ""}
                  </td>
                  <td
                    className={`py-2 pr-3 text-right tabular-nums ${m.quantity > 0 ? "text-emerald-300" : "text-red-300"}`}
                  >
                    {m.quantity > 0 ? `+${m.quantity}` : m.quantity}
                  </td>
                  <td className="py-2 pr-3 text-muted-foreground">{m.note || "—"}</td>
                  <td className="py-2">{m.username ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {moves.data?.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">Nessun movimento.</p>
          )}
        </div>
      </Panel>
    </>
  );
}
