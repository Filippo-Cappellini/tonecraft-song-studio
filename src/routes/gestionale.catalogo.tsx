import { createFileRoute, Link } from "@tanstack/react-router";
import { Forbidden, PageTitle, useStaff } from "@/components/gestionale/kit";
import { TABLE_NAMES, TABLES } from "@/lib/admin-tables";

export const Route = createFileRoute("/gestionale/catalogo")({ component: Catalogo });

const HINTS: Partial<Record<keyof typeof TABLES, string>> = {
  songs: "Titolo, artista, BPM, tonalità e notazione dei brani.",
  tones: "Impostazioni dell'amplificatore per ogni brano.",
  models: "Chitarre, bassi, tastiere e batterie per marca.",
  exercises: "Esercizi con passaggi e metronomo.",
  learning_paths: "Percorsi di lezioni in ordine.",
  lessons: "Lezioni dei percorsi, collegate a esercizi e brani.",
};

function Catalogo() {
  const staff = useStaff();
  if (!staff.can("catalogo")) return <Forbidden />;
  return (
    <>
      <PageTitle
        title="Catalogo dell'app"
        subtitle="Tutto quello che l'app mostra viene da qui: modificalo senza toccare il codice."
      />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {TABLE_NAMES.filter((t) => TABLES[t].group === "Catalogo").map((t) => (
          <Link
            key={t}
            to="/gestionale/tabelle/$table"
            params={{ table: t }}
            className="rounded-2xl border bg-card/60 p-4 transition hover:-translate-y-0.5 hover:border-primary"
          >
            <div className="font-semibold">{TABLES[t].label}</div>
            <div className="mt-1 text-sm text-muted-foreground">{HINTS[t] ?? "Apri l'elenco."}</div>
          </Link>
        ))}
      </div>
    </>
  );
}
