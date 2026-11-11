import { createFileRoute, Navigate, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Panel, staffStatusQuery } from "@/components/gestionale/kit";
import { AccessPanel } from "@/components/gestionale/AccessPanel";

export const Route = createFileRoute("/accedi")({
  validateSearch: (raw: Record<string, unknown>): { errore?: string } =>
    typeof raw["errore"] === "string" && /^[a-z-]{1,40}$/.test(raw["errore"])
      ? { errore: raw["errore"] }
      : {},
  head: () => ({
    meta: [{ title: "Accedi — Tono" }, { name: "robots", content: "noindex, nofollow" }],
  }),
  component: Accedi,
});

function Accedi() {
  const status = useQuery(staffStatusQuery);
  const { errore } = Route.useSearch();
  const navigate = useNavigate();
  if (status.data?.user) return <Navigate to="/gestionale" />;
  return (
    <main className="mx-auto max-w-md px-5 pb-24 pt-28">
      {status.data && !status.data.configured ? (
        <Panel title="Accesso non disponibile qui">
          <p className="text-sm text-muted-foreground">
            Gli account funzionano nell'installazione su server (per esempio il Raspberry).
          </p>
        </Panel>
      ) : (
        <AccessPanel error={errore} onSuccess={() => void navigate({ to: "/gestionale" })} />
      )}
    </main>
  );
}
