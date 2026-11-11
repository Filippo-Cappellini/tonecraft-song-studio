import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ArrowRight, Check, Clock, GraduationCap } from "lucide-react";
import { pathsQuery } from "@/lib/catalog";
import { useSetup } from "@/lib/setup";
import { useProgress } from "@/lib/progress";
import { difficultyLabel, instrumentImages } from "@/lib/instrument-images";
import { InstrumentTabs } from "@/components/InstrumentTabs";
import { Reveal } from "@/components/Reveal";

export const Route = createFileRoute("/corsi/")({
  validateSearch: (raw: Record<string, unknown>): { strumento?: string } => {
    const { strumento } = raw as { strumento?: unknown };
    return typeof strumento === "string" ? { strumento } : {};
  },
  head: () => ({
    meta: [
      { title: "Corsi — Tono" },
      { name: "description", content: "Corsi a lezioni per chitarra, basso, pianoforte e batteria: dal primo accordo al primo brano, una lezione alla volta." },
      { property: "og:title", content: "Corsi — Tono" },
      { property: "og:description", content: "Impara a suonare una lezione alla volta, con esercizi, metronomo e brani veri." },
    ],
  }),
  component: Courses,
});

function Courses() {
  const { setup, ready } = useSetup();
  const search = Route.useSearch();
  const [inst, setInst] = useState(search.strumento ?? "chitarra");
  useEffect(() => { if (ready && setup.instrument && !search.strumento) setInst(setup.instrument); }, [ready, setup.instrument, search.strumento]);
  const { data: paths = [], isLoading } = useQuery(pathsQuery(inst));
  const { progress } = useProgress();

  return (
    <main className="mx-auto max-w-6xl px-5 pb-24 pt-28">
      <h1 className="font-display text-5xl md:text-7xl">Corsi.</h1>
      <p className="mt-4 max-w-2xl text-muted-foreground">
        Un percorso in ordine, una lezione alla volta: cosa capire, cosa suonare e come capire se sei pronto per andare avanti. Ogni lezione finisce con un esercizio o un brano vero.
      </p>
      <div className="mt-10"><InstrumentTabs value={inst} onChange={setInst} /></div>

      {isLoading ? (
        <div className="mt-10 grid gap-5 md:grid-cols-2">{[0, 1].map((k) => <div key={k} className="h-80 animate-pulse rounded-3xl bg-card" />)}</div>
      ) : !paths.length ? (
        <p className="mt-10 text-muted-foreground">I corsi per questo strumento arrivano presto.</p>
      ) : (
        <div className="mt-10 grid gap-5 md:grid-cols-2">
          {paths.map((p, i) => {
            const done = p.lessons.filter((l) => progress.lessons.includes(l.id)).length;
            const total = p.lessons.length;
            const minutes = p.lessons.reduce((t, l) => t + l.minutes, 0);
            const pct = total ? (done / total) * 100 : 0;
            const label = done === 0 ? "Inizia il corso" : done === total ? "Ripassa" : "Continua";
            return (
              <Reveal key={p.id} delay={i * 90}>
                <Link to="/corsi/$pathId" params={{ pathId: p.id }}
                  className="group relative flex h-full flex-col overflow-hidden rounded-3xl border bg-card shadow-soft transition-all hover:-translate-y-1 hover:border-foreground/30 hover:shadow-glow">
                  <div className="relative h-40 overflow-hidden">
                    <img src={instrumentImages[p.instrument_id]} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover opacity-60 transition-transform duration-[1.2s] group-hover:scale-105" />
                    <div className="bg-scrim absolute inset-0" />
                    <span className="absolute left-6 top-6 inline-flex items-center gap-2 rounded-full bg-background/70 px-3 py-1 text-xs backdrop-blur">
                      <GraduationCap className="h-3.5 w-3.5 text-primary" /> {difficultyLabel[p.level]}
                    </span>
                    {done === total && total > 0 && (
                      <span className="absolute right-6 top-6 inline-flex items-center gap-1.5 rounded-full bg-emerald-500/90 px-3 py-1 text-xs text-white"><Check className="h-3.5 w-3.5" /> Completato</span>
                    )}
                  </div>
                  <div className="flex flex-1 flex-col p-6">
                    <p className="text-sm text-primary">{p.subtitle}</p>
                    <h2 className="mt-1 font-display text-3xl">{p.title}</h2>
                    <p className="mt-3 flex-1 text-muted-foreground">{p.description}</p>
                    <div className="mt-5 flex items-center gap-4 text-xs text-muted-foreground">
                      <span>{total} lezioni</span>
                      <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> circa {Math.round(minutes / 5) * 5} minuti in tutto</span>
                    </div>
                    <div className="mt-4">
                      <div className="flex justify-between text-xs text-muted-foreground"><span>{done} di {total} completate</span><span>{Math.round(pct)}%</span></div>
                      <div className="mt-2 h-2 overflow-hidden rounded-full bg-foreground/10">
                        <div className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-primary transition-all duration-500" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                    <span className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-primary">{label} <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" /></span>
                  </div>
                </Link>
              </Reveal>
            );
          })}
        </div>
      )}
    </main>
  );
}
