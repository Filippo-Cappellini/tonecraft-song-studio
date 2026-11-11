import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ClipboardList, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Panel, staffStatusQuery, useStaffLogout } from "@/components/gestionale/kit";
import { LoginForm } from "@/components/gestionale/LoginForm";
import { STAFF_NAV } from "@/components/gestionale/nav";
import { canAny, ROLES } from "@/lib/staff-roles";

export const Route = createFileRoute("/gestionale")({
  head: () => ({
    meta: [{ title: "Gestionale — Tono" }, { name: "robots", content: "noindex, nofollow" }],
  }),
  component: GestionaleLayout,
});

function GestionaleLayout() {
  const status = useQuery(staffStatusQuery);
  const logout = useStaffLogout();

  if (status.isPending) return <main className="min-h-screen pt-28" />;
  if (status.isError)
    return (
      <Shell>
        <Panel title="Gestionale non raggiungibile">
          <p className="text-sm text-muted-foreground">
            Il server non risponde. Controlla che il servizio e il database siano avviati.
          </p>
        </Panel>
      </Shell>
    );
  if (!status.data.configured)
    return (
      <Shell>
        <Panel title="Gestionale non attivo qui">
          <p className="text-sm text-muted-foreground">
            Il gestionale funziona nell'installazione su server (per esempio il Raspberry), con il
            suo database locale. Le istruzioni sono in <code>deploy/raspberry/README.md</code>.
          </p>
        </Panel>
      </Shell>
    );
  const user = status.data.user;
  if (!user)
    return (
      <Shell>
        <LoginForm />
      </Shell>
    );

  const items = STAFF_NAV.filter((n) => canAny(user.role, n.perms));

  return (
    <main className="mx-auto max-w-7xl px-4 pb-24 pt-24 sm:px-5">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-card/60 px-4 py-3">
        <div className="flex items-center gap-2 text-sm">
          <ClipboardList className="h-4 w-4 text-primary" />
          <span className="font-semibold">Gestionale</span>
          <span className="text-muted-foreground">
            · {user.full_name} ({ROLES[user.role].label})
          </span>
        </div>
        <Button variant="outline" size="sm" onClick={logout}>
          <LogOut /> Esci
        </Button>
      </div>
      <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
        <nav
          aria-label="Sezioni del gestionale"
          className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1 lg:sticky lg:top-24 lg:flex-col lg:self-start lg:overflow-visible"
        >
          {items.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              activeOptions={{ exact: !!n.exact }}
              className="inline-flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-sm text-muted-foreground hover:bg-secondary hover:text-foreground"
              activeProps={{ className: "bg-primary! text-primary-foreground!" }}
            >
              <n.icon className="h-4 w-4" /> {n.label}
            </Link>
          ))}
        </nav>
        <div className="min-w-0">
          <Outlet />
        </div>
      </div>
    </main>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return <main className="mx-auto max-w-md px-5 pb-24 pt-28">{children}</main>;
}
