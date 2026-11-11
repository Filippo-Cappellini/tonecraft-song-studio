import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Check, ChevronDown, Clock, ExternalLink, Gauge, PlayCircle, Target } from "lucide-react";
import { coursesQuery, exercisesQuery } from "@/lib/catalog";
import { useSetup } from "@/lib/setup";
import { useProgress } from "@/lib/progress";
import { difficultyLabel } from "@/lib/instrument-images";
import { InstrumentTabs } from "@/components/InstrumentTabs";
import { Metronome } from "@/components/Metronome";
import { safeHttpsUrl } from "@/lib/safe-url";

export const Route = createFileRoute("/esercizi")({
  validateSearch: (raw: Record<string, unknown>): { ex?: string; strumento?: string } => {
    const s = raw as { ex?: unknown; strumento?: unknown };
    return { ...(typeof s.ex === "string" ? { ex: s.ex } : {}), ...(typeof s.strumento === "string" ? { strumento: s.strumento } : {}) };
  },
  head: () => ({
    meta: [
      { title: "Esercizi — Tono" },
      { name: "description", content: "Il tuo allenamento di oggi, esercizi spiegati passo passo e video corsi consigliati." },
      { property: "og:title", content: "Esercizi — Tono" },
      { property: "og:description", content: "Allenamento del giorno, esercizi passo passo e video corsi." },
    ],
  }),
  component: Exercises,
});

// Un colore per categoria, così si riconosce a colpo d'occhio che tipo di esercizio è.
const CATEGORY_COLOR: Record<string, string> = {
  Tecnica: "bg-sky-500/15 text-sky-300 ring-sky-500/30",
  Scale: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30",
  Accordi: "bg-violet-500/15 text-violet-300 ring-violet-500/30",
  Ritmica: "bg-orange-500/15 text-orange-300 ring-orange-500/30",
  Groove: "bg-amber-500/15 text-amber-300 ring-amber-500/30",
  Espressività: "bg-pink-500/15 text-pink-300 ring-pink-500/30",
  Shred: "bg-red-500/15 text-red-300 ring-red-500/30",
  Lettura: "bg-teal-500/15 text-teal-300 ring-teal-500/30",
  Rudimenti: "bg-indigo-500/15 text-indigo-300 ring-indigo-500/30",
  Fill: "bg-rose-500/15 text-rose-300 ring-rose-500/30",
};
const categoryColor = (c: string) => CATEGORY_COLOR[c] ?? "bg-primary/15 text-primary ring-primary/30";
const STEP_DOT: Record<string, string> = {
  Tecnica: "bg-sky-500", Scale: "bg-emerald-500", Accordi: "bg-violet-500", Ritmica: "bg-orange-500", Groove: "bg-amber-500",
  Espressività: "bg-pink-500", Shred: "bg-red-500", Lettura: "bg-teal-500", Rudimenti: "bg-indigo-500", Fill: "bg-rose-500",
};
const LEVEL_COLOR = ["", "bg-emerald-400", "bg-lime-400", "bg-amber-400", "bg-orange-500", "bg-red-500"];
// Ordine consigliato in una sessione: prima si scaldano le mani, poi scale e accordi, poi ritmo e repertorio.
const WARMUP_ORDER = ["Tecnica", "Rudimenti", "Scale", "Accordi", "Lettura", "Groove", "Ritmica", "Fill", "Espressività", "Shred"];
const INSTRUMENT_WORD: Record<string, string> = { chitarra: "chitarra", basso: "basso", pianoforte: "pianoforte", batteria: "batteria" };

type Exercise = { id: string; title: string; category: string; level: number; minutes: number; bpm: number; description: string; steps: string; notation: string | null };

function LevelDots({ level }: { level: number }) {
  return (
    <span className="flex items-center gap-1" title={difficultyLabel[level]}>
      {[1, 2, 3, 4, 5].map((l) => (
        <span key={l} className={`h-1.5 w-3 rounded-full ${l <= level ? LEVEL_COLOR[level] : "bg-foreground/15"}`} />
      ))}
    </span>
  );
}

function Exercises() {
  const { setup, ready } = useSetup();
  const search = Route.useSearch();
  const [inst, setInst] = useState(search.strumento ?? "chitarra");
  useEffect(() => { if (ready && setup.instrument && !search.strumento) setInst(setup.instrument); }, [ready, setup.instrument, search.strumento]);
  const { data = [] } = useQuery(exercisesQuery(inst));
  const { data: allCourses = [] } = useQuery(coursesQuery(inst));
  // Solo link https validi: i dati vengono dal catalogo ma finiscono in un href.
  const courses = useMemo(() => allCourses.flatMap((c) => { const url = safeHttpsUrl(c.url); return url ? [{ ...c, url }] : []; }), [allCourses]);
  const exercises = data as Exercise[];
  const [level, setLevel] = useState(1);
  const [category, setCategory] = useState("Tutte");
  const [open, setOpen] = useState<string | null>(null);
  const { doneToday: done, toggleExercise } = useProgress();

  const levels = useMemo(() => [...new Set(exercises.map((e) => e.level))].sort(), [exercises]);
  const categories = useMemo(() => ["Tutte", ...new Set(exercises.map((e) => e.category))], [exercises]);

  // Allenamento di oggi: un esercizio per tipo, il più adatto al tuo livello, in ordine di riscaldamento.
  const plan = useMemo(() => {
    const best = new Map<string, Exercise>();
    for (const e of exercises) {
      if (e.level > level) continue;
      const cur = best.get(e.category);
      if (!cur || e.level > cur.level) best.set(e.category, e);
    }
    const rank = (c: string) => (WARMUP_ORDER.indexOf(c) + 100) % 100;
    return [...best.values()].sort((a, b) => rank(a.category) - rank(b.category)).slice(0, 3);
  }, [exercises, level]);
  const planMinutes = plan.reduce((t, e) => t + e.minutes, 0);
  const planDone = plan.filter((e) => done.includes(e.id)).length;

  useEffect(() => {
    if (!search.ex || !exercises.some((e) => e.id === search.ex)) return;
    setOpen(search.ex);
    setTimeout(() => document.getElementById(`ex-${search.ex}`)?.scrollIntoView({ behavior: "smooth", block: "start" }), 150);
  }, [search.ex, exercises]);

  const list = exercises.filter((e) => category === "Tutte" || e.category === category);
  const openExercise = (id: string) => {
    setOpen(id);
    setTimeout(() => document.getElementById(`ex-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  };

  return (
    <main className="mx-auto max-w-5xl px-5 pb-24 pt-28">
      <h1 className="font-display text-5xl md:text-7xl">Esercizi.</h1>
      <p className="mt-4 max-w-2xl text-muted-foreground">Scegli il tuo livello: ti diciamo noi cosa fare oggi. Dieci minuti al giorno valgono più di due ore la domenica.</p>
      <div className="mt-4 flex flex-wrap gap-2 text-sm">
        <Link to="/sessione" className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 font-medium text-primary-foreground"><Clock className="h-4 w-4" /> Sessione guidata con il timer</Link>
        <Link to="/progressi" className="rounded-full border px-4 py-2 hover:border-foreground/40">I miei progressi</Link>
      </div>
      <div className="mt-10"><InstrumentTabs value={inst} onChange={(v) => { setInst(v); setCategory("Tutte"); setOpen(null); }} /></div>

      {/* Livello */}
      <div className="mt-8">
        <p className="mb-2 text-xs uppercase tracking-widest text-muted-foreground">Il tuo livello</p>
        <div className="flex flex-wrap gap-2">
          {levels.map((l) => (
            <button key={l} onClick={() => setLevel(l)}
              className={`flex items-center gap-2 rounded-full border px-4 py-2 text-sm transition-colors ${level === l ? "border-primary bg-primary text-primary-foreground" : "hover:border-foreground/40"}`}>
              <span className={`h-2.5 w-2.5 rounded-full ${LEVEL_COLOR[l]}`} /> {difficultyLabel[l]}
            </button>
          ))}
        </div>
      </div>

      {/* Allenamento di oggi */}
      {plan.length > 0 && (
        <section className="mt-8 overflow-hidden rounded-3xl border border-primary/30 bg-[linear-gradient(135deg,color-mix(in_oklab,var(--primary)_18%,transparent),transparent_60%)] p-6 md:p-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="flex items-center gap-2 text-xs uppercase tracking-widest text-primary"><Target className="h-4 w-4" /> Il tuo allenamento di oggi</p>
              <h2 className="mt-2 font-display text-3xl">{plan.length} esercizi · {planMinutes} minuti</h2>
            </div>
            <div className="min-w-48 text-sm">
              <div className="flex justify-between text-muted-foreground"><span>Fatti oggi</span><span>{planDone} di {plan.length}</span></div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-foreground/10">
                <div className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-primary transition-all duration-500" style={{ width: `${(planDone / plan.length) * 100}%` }} />
              </div>
            </div>
          </div>
          <ol className="mt-6 grid gap-3 md:grid-cols-3">
            {plan.map((e, i) => {
              const isDone = done.includes(e.id);
              return (
                <li key={e.id} style={{ animationDelay: `${i * 90}ms` }} className={`animate-card-in relative rounded-2xl border bg-background/60 p-5 transition-opacity ${isDone ? "opacity-60" : ""}`}>
                  <div className="flex items-center justify-between">
                    <span className={`flex h-8 w-8 items-center justify-center rounded-full font-mono text-sm text-white ${STEP_DOT[e.category] ?? "bg-primary"}`}>
                      {isDone ? <Check className="h-4 w-4" /> : i + 1}
                    </span>
                    <span className="flex items-center gap-1 text-xs text-muted-foreground"><Clock className="h-3.5 w-3.5" />{e.minutes} min</span>
                  </div>
                  <span className={`mt-4 inline-block rounded-full px-2.5 py-0.5 text-[11px] uppercase tracking-wider ring-1 ${categoryColor(e.category)}`}>{e.category}</span>
                  <h3 className={`mt-2 font-medium ${isDone ? "line-through" : ""}`}>{e.title}</h3>
                  <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{e.description}</p>
                  <div className="mt-4 flex gap-2">
                    <button onClick={() => openExercise(e.id)} className="rounded-full bg-primary px-4 py-1.5 text-xs font-medium text-primary-foreground">Inizia</button>
                    <button onClick={() => toggleExercise(e.id, e.minutes)} className="rounded-full border px-4 py-1.5 text-xs hover:border-foreground/40">{isDone ? "Annulla" : "Fatto"}</button>
                  </div>
                </li>
              );
            })}
          </ol>
        </section>
      )}

      {/* Tutti gli esercizi */}
      <section className="mt-14">
        <h2 className="font-display text-3xl">Tutti gli esercizi</h2>
        <div className="mt-4 flex flex-wrap gap-2">
          {categories.map((c) => (
            <button key={c} onClick={() => setCategory(c)}
              className={`rounded-full px-3 py-1 text-xs ring-1 transition-opacity ${c === "Tutte" ? "ring-border" : categoryColor(c)} ${category === c ? "opacity-100 ring-2" : "opacity-60 hover:opacity-100"}`}>
              {c}
            </button>
          ))}
        </div>
        <div className="mt-6 space-y-3">
          {list.map((e) => {
            const isOpen = open === e.id;
            const isDone = done.includes(e.id);
            const video = `https://www.youtube.com/results?search_query=${encodeURIComponent(`${e.title} ${INSTRUMENT_WORD[inst] ?? ""} lezione`)}`;
            return (
              <article key={e.id} id={`ex-${e.id}`} className={`scroll-mt-24 overflow-hidden rounded-2xl border transition-colors ${isOpen ? "border-primary/50 bg-card" : "hover:bg-card/60"}`}>
                <button onClick={() => setOpen(isOpen ? null : e.id)} className="flex w-full items-center gap-4 p-5 text-left">
                  <span className={`h-10 w-1.5 shrink-0 rounded-full ${STEP_DOT[e.category] ?? "bg-primary"}`} />
                  <div className="min-w-0 flex-1">
                    <span className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] uppercase tracking-wider ring-1 ${categoryColor(e.category)}`}>{e.category}</span>
                    <h3 className="mt-1.5 flex items-center gap-2 font-display text-xl">
                      {e.title} {isDone && <Check className="h-4 w-4 text-emerald-400" />}
                    </h3>
                  </div>
                  <div className="hidden shrink-0 items-center gap-5 text-xs text-muted-foreground sm:flex">
                    <span className="flex items-center gap-2"><LevelDots level={e.level} />{difficultyLabel[e.level]}</span>
                    <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{e.minutes} min</span>
                  </div>
                  <ChevronDown className={`h-5 w-5 shrink-0 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`} />
                </button>
                {isOpen && (
                  <div className="animate-rise space-y-6 px-5 pb-6 sm:pl-12">
                    <div className="flex flex-wrap gap-2 text-xs">
                      <span className="flex items-center gap-1.5 rounded-full bg-foreground/5 px-3 py-1"><LevelDots level={e.level} /> {difficultyLabel[e.level]}</span>
                      <span className="flex items-center gap-1.5 rounded-full bg-foreground/5 px-3 py-1"><Clock className="h-3.5 w-3.5" /> {e.minutes} minuti</span>
                      <span className="flex items-center gap-1.5 rounded-full bg-foreground/5 px-3 py-1"><Gauge className="h-3.5 w-3.5" /> Parti da {e.bpm} BPM</span>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-widest text-muted-foreground">Obiettivo</p>
                      <p className="mt-1 text-lg">{e.description}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-widest text-muted-foreground">Come si fa</p>
                      <ol className="mt-3 space-y-3">
                        {e.steps.split("|").map((s, i) => (
                          <li key={i} className="flex items-start gap-3">
                            <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full font-mono text-xs text-white ${STEP_DOT[e.category] ?? "bg-primary"}`}>{i + 1}</span>
                            <span className="pt-0.5">{s}</span>
                          </li>
                        ))}
                      </ol>
                    </div>
                    {e.notation && <pre className="overflow-x-auto rounded-xl bg-background p-5 font-mono text-[13px] leading-6">{e.notation}</pre>}
                    <div className="flex flex-wrap gap-2">
                      <a href={video} target="_blank" rel="noreferrer"
                        className="inline-flex items-center gap-2 rounded-full bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-500">
                        <PlayCircle className="h-4 w-4" /> Guarda come si fa
                      </a>
                      <button onClick={() => toggleExercise(e.id, e.minutes)}
                        className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm ${isDone ? "bg-emerald-500/20 text-emerald-300" : "border hover:border-foreground/40"}`}>
                        <Check className="h-4 w-4" /> {isDone ? "Fatto oggi" : "Segna come fatto"}
                      </button>
                    </div>
                    <Metronome initialBpm={e.bpm} />
                  </div>
                )}
              </article>
            );
          })}
        </div>
      </section>

      {/* Video corsi */}
      {courses.length > 0 && (
        <section className="mt-16">
          <h2 className="flex items-center gap-3 font-display text-3xl"><PlayCircle className="h-7 w-7 text-red-500" /> Video corsi</h2>
          <p className="mt-2 text-muted-foreground">Insegnanti che spiegano bene, per imparare anche fuori da qui.</p>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {courses.map((c, i) => (
              <a key={c.id} href={c.url} target="_blank" rel="noreferrer"
                className="group relative overflow-hidden rounded-2xl border p-5 transition-colors hover:border-foreground/30">
                <div className={`absolute inset-x-0 top-0 h-1 ${["bg-gradient-to-r from-red-500 to-orange-400", "bg-gradient-to-r from-sky-500 to-violet-500", "bg-gradient-to-r from-emerald-400 to-teal-500"][i % 3]}`} />
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="text-muted-foreground">{c.teacher}</span>
                  <span className={`rounded-full px-2 py-0.5 ${c.free ? "bg-emerald-500/15 text-emerald-300" : "bg-amber-500/15 text-amber-300"}`}>{c.free ? "Gratis" : "Gratis + a pagamento"}</span>
                </div>
                <h3 className="mt-3 font-display text-xl">{c.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{c.description}</p>
                <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
                  <span className="flex items-center gap-2"><LevelDots level={c.level} /> {c.language}</span>
                  <span className="flex items-center gap-1 text-primary group-hover:underline">Apri <ExternalLink className="h-3 w-3" /></span>
                </div>
              </a>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
