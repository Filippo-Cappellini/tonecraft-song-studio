import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Errors,
  errorText,
  fmtDate,
  PageTitle,
  Panel,
  Stat,
  useStaff,
} from "@/components/gestionale/kit";
import { TABLE_NAMES, TABLES, type TableName } from "@/lib/admin-tables";
import { getDatabaseOverview } from "@/lib/tables.functions";

export const Route = createFileRoute("/gestionale/")({ component: DatabasePage });

const HINTS: Partial<Record<TableName, string>> = {
  instruments: "Chitarra, basso, pianoforte, batteria.",
  brands: "Marche di ogni strumento.",
  models: "Modelli e colori per marca.",
  amps: "Amplificatori per strumento.",
  songs: "Titolo, artista, BPM, tonalità e notazione.",
  tones: "Impostazioni dell'amplificatore per ogni brano.",
  exercises: "Esercizi con passaggi e metronomo.",
  courses: "Video corsi consigliati (link esterni).",
  legends: "Curiosità sui grandi della musica.",
  learning_paths: "Percorsi di lezioni in ordine.",
  lessons: "Lezioni dei percorsi.",
  shops: "Negozi online di fiducia e indirizzi di ricerca.",
};

const fmtSize = (b: number) =>
  b >= 1024 * 1024
    ? `${(b / 1024 / 1024).toFixed(1).replace(".", ",")} MB`
    : `${Math.round(b / 1024)} KB`;

function DatabasePage() {
  const staff = useStaff();
  const overview = useQuery({
    queryKey: ["gestionale", "overview"],
    queryFn: () => getDatabaseOverview(),
    enabled: staff.can("vedere"),
  });
  const d = overview.data;
  const total = d?.tables.reduce((t, x) => t + x.rows, 0) ?? 0;
  const rows = new Map(d?.tables.map((t) => [t.table, t.rows]));

  return (
    <>
      <PageTitle
        title="Database"
        subtitle={
          staff.can("catalogo")
            ? "Qui sono salvati i dati dell'app. Apri una tabella per consultarla o modificarla."
            : "Qui sono salvati i dati dell'app. Il tuo ruolo può consultarli senza modificarli."
        }
      />
      {overview.isError && <Errors errors={[errorText(overview.error)]} />}
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-3">
        <Stat
          label="Righe salvate"
          value={d ? total.toLocaleString("it-IT") : "…"}
          hint={`in ${TABLE_NAMES.length} tabelle`}
        />
        <Stat
          label="Spazio occupato"
          value={d ? fmtSize(d.sizeBytes) : "…"}
          hint="tutto il database"
        />
        <Stat
          label="Motore"
          value={d ? `PostgreSQL ${d.version.split(" ")[0]}` : "…"}
          hint="sul server, backup ogni notte"
        />
      </div>

      {(["Catalogo", "Link"] as const).map((group) => (
        <section key={group} className="mb-6">
          <h2 className="mb-3 text-lg font-semibold">
            {group === "Catalogo" ? "Dati dell'app" : "Link"}
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {TABLE_NAMES.filter((t) => TABLES[t].group === group).map((t) => (
              <Link
                key={t}
                to="/gestionale/tabelle/$table"
                params={{ table: t }}
                className="rounded-2xl border bg-card/60 p-4 transition hover:-translate-y-0.5 hover:border-primary"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-semibold">{TABLES[t].label}</span>
                  <span className="tabular-nums text-sm text-muted-foreground">
                    {rows.has(t) ? rows.get(t)!.toLocaleString("it-IT") : "…"}
                  </span>
                </div>
                <div className="mt-1 text-sm text-muted-foreground">{HINTS[t]}</div>
                <div className="mt-2 font-mono text-xs text-muted-foreground/70">{t}</div>
              </Link>
            ))}
          </div>
        </section>
      ))}

      {d?.recent && (
        <Panel title="Ultime modifiche">
          {d.recent.length === 0 ? (
            <p className="text-sm text-muted-foreground">Ancora nessuna modifica.</p>
          ) : (
            <ul className="divide-y text-sm">
              {d.recent.map((r) => (
                <li key={r.id} className="flex flex-wrap justify-between gap-2 py-2">
                  <span>
                    <span className="font-medium">{r.username}</span> · {r.action}{" "}
                    <span className="text-muted-foreground">
                      {r.entity}
                      {r.entity_id ? ` · ${r.entity_id}` : ""}
                    </span>
                  </span>
                  <span className="text-muted-foreground">{fmtDate(r.created_at)}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      )}
    </>
  );
}
