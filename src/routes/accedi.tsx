import { createFileRoute, Navigate, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Panel, staffStatusQuery } from "@/components/gestionale/kit";
import { LoginForm } from "@/components/gestionale/LoginForm";

export const Route = createFileRoute("/accedi")({
  head: () => ({
    meta: [{ title: "Accedi — Tono" }, { name: "robots", content: "noindex, nofollow" }],
  }),
  component: Accedi,
});

function Accedi() {
  const status = useQuery(staffStatusQuery);
  const navigate = useNavigate();
  if (status.data?.user) return <Navigate to="/gestionale" />;
  return (
    <main className="mx-auto max-w-md px-5 pb-24 pt-28">
      {status.data && !status.data.configured ? (
        <Panel title="Accesso non disponibile qui">
          <p className="text-sm text-muted-foreground">
            L'accesso dello staff funziona nell'installazione su server (per esempio il Raspberry).
          </p>
        </Panel>
      ) : (
        <LoginForm onSuccess={() => void navigate({ to: "/gestionale" })} />
      )}
    </main>
  );
}
