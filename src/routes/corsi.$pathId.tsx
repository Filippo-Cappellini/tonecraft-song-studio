import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, Check, ChevronDown, Clock, Dumbbell, Ear, Gauge, ListMusic, Music2, PartyPopper, Target } from "lucide-react";
import { pathQuery, splitList, type LessonTool } from "@/lib/catalog";
import { useProgress } from "@/lib/progress";
import { NOTE_IT } from "@/lib/theory";
import { difficultyLabel } from "@/lib/instrument-images";
import { Metronome } from "@/components/Metronome";
import { AlbumCover } from "@/components/AlbumCover";

export const Route = createFileRoute("/corsi/$pathId")({
  loader: async ({ context, params }) => {
    const d = await context.queryClient.ensureQueryData(pathQuery(params.pathId));
    if (!d.path) throw notFound();
    return { title: d.path.title, description: d.path.description };
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: `${loaderData?.title ?? "Corso"} — Corsi | Tono` },
      { name: "description", content: loaderData?.description ?? "Un corso a lezioni per imparare a suonare." },
      { property: "og:title", content: `${loaderData?.title ?? "Corso"} — Tono` },
      { property: "og:description", content: loaderData?.description ?? "" },
    ],
  }),
  component: CoursePage,
});

const pill = "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm transition-colors hover:border-foreground/40";

/** Collegamento all'attrezzo usato nella lezione, già impostato sulla nota e sull'accordo o scala giusti. */
function ToolLink({ tool, note, kind, instrument }: { tool: LessonTool; note: number | null; kind: string | null; instrument: string }) {
  const nota = note ?? undefined;
  const label = nota !== undefined ? ` di ${NOTE_IT[nota]}` : "";
  switch (tool) {
    case "accordatore":
      return <Link to="/accordatore" className={pill}><Gauge className="h-4 w-4 text-primary" /> Apri l'accordatore</Link>;
    case "orecchio":
      return <Link to="/orecchio" className={pill}><Ear className="h-4 w-4 text-primary" /> Allena l'orecchio</Link>;
    case "scale":
      return (
        <Link to="/accordi" search={{ vista: "scale", nota, scala: kind ?? undefined, strumento: (["chitarra", "basso", "pianoforte"] as const).find((x) => x === instrument) ?? "chitarra" }} className={pill}>
          <Music2 className="h-4 w-4 text-primary" /> Vedi e ascolta la scala{label}
        </Link>
      );
    case "accordi-piano":
      return <Link to="/accordi" search={{ vista: "accordi-piano", nota, tipo: kind ?? undefined }} className={pill}><Music2 className="h-4 w-4 text-primary" /> Vedi e ascolta l'accordo{label}</Link>;
    default:
      return <Link to="/accordi" search={{ vista: "accordi-chitarra", nota, tipo: kind ?? undefined }} className={pill}><Music2 className="h-4 w-4 text-primary" /> Vedi e ascolta gli accordi</Link>;
  }
}

function CoursePage() {
  const { pathId } = Route.useParams();
  const { data } = useSuspenseQuery(pathQuery(pathId));
  const path = data.path!;
  const { lessons, exercises, songs } = data;
  const { progress, ready, toggleLesson } = useProgress();
  const done = lessons.filter((l) => progress.lessons.includes(l.id)).length;
  const next = lessons.find((l) => !progress.lessons.includes(l.id));
  const [open, setOpen] = useState<string | null>(null);
  const [checks, setChecks] = useState<Record<string, boolean>>({});

  // All'apertura si apre la prima lezione non ancora completata.
  useEffect(() => { if (ready) setOpen((o) => o ?? next?.id ?? null); }, [ready]); // eslint-disable-line react-hooks/exhaustive-deps

  const openLesson = (id: string | null) => {
    setOpen(id);
    if (id) setTimeout(() => document.getElementById(`lezione-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" }), 60);
  };
  const complete = (id: string, minutes: number) => {
    const wasDone = progress.lessons.includes(id);
    toggleLesson(id, minutes);
    if (!wasDone) {
      const after = lessons.slice(lessons.findIndex((l) => l.id === id) + 1).find((l) => !progress.lessons.includes(l.id));
      openLesson(after?.id ?? null);
    }
  };
  const pct = lessons.length ? (done / lessons.length) * 100 : 0;

  return (
    <main className="mx-auto max-w-4xl px-5 pb-24 pt-28">
      <Link to="/corsi" search={{ strumento: path.instrument_id }} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Tutti i corsi
      </Link>
      <p className="mt-6 text-sm uppercase tracking-[0.3em] text-primary">{difficultyLabel[path.level]} · {lessons.length} lezioni</p>
      <h1 className="mt-3 font-display text-5xl md:text-6xl">{path.title}</h1>
      <p className="mt-4 max-w-2xl text-muted-foreground">{path.description}</p>

      <div className="mt-8 rounded-3xl border border-primary/30 bg-[linear-gradient(135deg,color-mix(in_oklab,var(--primary)_16%,transparent),transparent_60%)] p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-widest text-muted-foreground">I tuoi progressi</p>
            <p className="mt-1 font-display text-2xl">{done === lessons.length && lessons.length ? "Corso completato!" : `${done} di ${lessons.length} lezioni`}</p>
          </div>
          {next ? (
            <button onClick={() => openLesson(next.id)} className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-medium text-primary-foreground shadow-glow transition-transform hover:scale-[1.03]">
              {done ? "Continua" : "Inizia"}: lezione {lessons.indexOf(next) + 1} <ArrowRight className="h-4 w-4" />
            </button>
          ) : (
            <span className="inline-flex items-center gap-2 text-emerald-300"><PartyPopper className="h-5 w-5" /> Complimenti, hai finito il corso</span>
          )}
        </div>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-foreground/10">
          <div className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-primary transition-all duration-500" style={{ width: `${pct}%` }} />
        </div>
      </div>

      <ol className="mt-10 space-y-3">
        {lessons.map((l, i) => {
          const isDone = progress.lessons.includes(l.id);
          const isOpen = open === l.id;
          const isNext = next?.id === l.id;
          const ex = l.exercise_id ? exercises.get(l.exercise_id) : undefined;
          const song = l.song_id ? songs.get(l.song_id) : undefined;
          const checklist = splitList(l.checklist);
          const bpm = l.bpm ?? song?.bpm;
          return (
            <li key={l.id} id={`lezione-${l.id}`} className={`scroll-mt-24 overflow-hidden rounded-2xl border transition-colors ${isOpen ? "border-primary/50 bg-card" : isNext ? "border-primary/30" : "hover:bg-card/60"}`}>
              <button onClick={() => setOpen(isOpen ? null : l.id)} className="flex w-full items-center gap-4 p-5 text-left">
                <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-mono text-sm ${isDone ? "bg-emerald-500 text-white" : isNext ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"}`}>
                  {isDone ? <Check className="h-5 w-5" /> : i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <h2 className="font-display text-xl">{l.title}</h2>
                  <p className="mt-0.5 truncate text-sm text-muted-foreground">{l.goal}</p>
                </div>
                <span className="hidden shrink-0 items-center gap-1 text-xs text-muted-foreground sm:flex"><Clock className="h-3.5 w-3.5" /> {l.minutes} min</span>
                <ChevronDown className={`h-5 w-5 shrink-0 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`} />
              </button>

              {isOpen && (
                <div className="animate-rise space-y-7 px-5 pb-6 sm:pl-[4.75rem]">
                  <div className="flex items-start gap-3 rounded-2xl bg-primary/10 p-4">
                    <Target className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                    <p><span className="text-primary">Obiettivo:</span> {l.goal}</p>
                  </div>

                  <div className="space-y-3 leading-relaxed">
                    {splitList(l.explanation).map((p, k) => <p key={k}>{p}</p>)}
                  </div>

                  {l.notation && <pre className="overflow-x-auto rounded-xl bg-background p-5 font-mono text-[13px] leading-6">{l.notation}</pre>}

                  <div>
                    <p className="text-xs uppercase tracking-widest text-muted-foreground">Cosa suonare</p>
                    <ol className="mt-3 space-y-3">
                      {splitList(l.practice).map((s, k) => (
                        <li key={k} className="flex items-start gap-3">
                          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary font-mono text-xs text-primary-foreground">{k + 1}</span>
                          <span className="pt-0.5">{s}</span>
                        </li>
                      ))}
                    </ol>
                  </div>

                  {(ex || song || l.tool) && (
                    <div className="flex flex-wrap gap-2">
                      {ex && (
                        <Link to="/esercizi" search={{ strumento: path.instrument_id, ex: ex.id }} className={pill}>
                          <Dumbbell className="h-4 w-4 text-primary" /> Esercizio: {ex.title}
                        </Link>
                      )}
                      {l.tool && <ToolLink tool={l.tool as LessonTool} note={l.tool_note} kind={l.tool_kind} instrument={path.instrument_id} />}
                    </div>
                  )}

                  {song && (
                    <Link to="/brani/$songId" params={{ songId: song.id }} className="group flex items-center gap-4 rounded-2xl border p-3 transition-colors hover:border-foreground/30 hover:bg-secondary/50">
                      <AlbumCover artist={song.artist} album={song.album} className="h-16 w-16 shrink-0 rounded-xl" />
                      <div className="min-w-0 flex-1">
                        <p className="flex items-center gap-1.5 text-xs uppercase tracking-widest text-primary"><ListMusic className="h-3.5 w-3.5" /> Il brano della lezione</p>
                        <p className="mt-1 truncate font-medium">{song.title}</p>
                        <p className="truncate text-sm text-muted-foreground">{song.artist} · {song.bpm} BPM</p>
                      </div>
                      <ArrowRight className="h-5 w-5 shrink-0 text-primary transition-transform group-hover:translate-x-1" />
                    </Link>
                  )}

                  {bpm && <Metronome key={l.id} initialBpm={bpm} target={song?.bpm} />}

                  {checklist.length > 0 && (
                    <div>
                      <p className="text-xs uppercase tracking-widest text-muted-foreground">Prima di andare avanti, controlla di saper fare</p>
                      <ul className="mt-3 space-y-2">
                        {checklist.map((c, k) => {
                          const key = `${l.id}:${k}`;
                          const on = isDone || !!checks[key];
                          return (
                            <li key={k}>
                              <label className="flex cursor-pointer items-center gap-3 rounded-xl p-2 hover:bg-secondary/60">
                                <input type="checkbox" checked={on} disabled={isDone} onChange={(e) => setChecks((s) => ({ ...s, [key]: e.target.checked }))} className="h-5 w-5 accent-[var(--primary)]" />
                                <span className={on ? "text-muted-foreground line-through" : ""}>{c}</span>
                              </label>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  )}

                  <div className="flex flex-wrap items-center gap-3">
                    <button onClick={() => complete(l.id, l.minutes)}
                      className={`inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-medium transition-transform hover:scale-[1.02] ${isDone ? "border text-muted-foreground" : "bg-emerald-500 text-white shadow-glow"}`}>
                      <Check className="h-4 w-4" /> {isDone ? "Segna come da rifare" : "Lezione completata"}
                    </button>
                    {!isDone && checklist.length > 0 && checklist.some((_, k) => !checks[`${l.id}:${k}`]) && (
                      <span className="text-xs text-muted-foreground">Consiglio: completa la lezione quando sai fare tutto l'elenco qui sopra.</span>
                    )}
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </main>
  );
}
