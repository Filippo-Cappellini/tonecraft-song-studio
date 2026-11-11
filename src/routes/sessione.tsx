import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Ear, Pause, Play, SkipForward, Square, Timer } from "lucide-react";
import { exercisesQuery, songsQuery } from "@/lib/catalog";
import { useSetup } from "@/lib/setup";
import { useProgress } from "@/lib/progress";
import { difficultyLabel } from "@/lib/instrument-images";
import { playChord } from "@/lib/audio";
import { SESSION_LENGTHS, buildSession, elapsedInBlock, nextBlock, practicedMinutes, readSession, writeSession, type SessionState } from "@/lib/session";
import { InstrumentTabs } from "@/components/InstrumentTabs";
import { Metronome } from "@/components/Metronome";

export const Route = createFileRoute("/sessione")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Sessione di pratica guidata — Tono" },
      { name: "description", content: "Una routine con il timer: riscaldamento, tecnica, orecchio e il brano che stai imparando." },
      { property: "og:title", content: "Sessione di pratica guidata — Tono" },
      { property: "og:description", content: "Riscaldamento, tecnica, orecchio e repertorio, con il timer." },
    ],
  }),
  component: Session,
});

type Exercise = { id: string; title: string; category: string; level: number; minutes: number; bpm: number; description: string; steps: string };

const fmt = (sec: number) => {
  const s = Math.max(0, Math.ceil(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};
const pill = (on: boolean) => `rounded-full border px-4 py-1.5 text-sm transition-colors ${on ? "border-primary bg-primary text-primary-foreground" : "hover:border-foreground/40"}`;

function Session() {
  const { setup, ready } = useSetup();
  const [inst, setInst] = useState("chitarra");
  useEffect(() => { if (ready && setup.instrument) setInst(setup.instrument); }, [ready, setup.instrument]);
  const [length, setLength] = useState<number>(30);
  const [level, setLevel] = useState(1);
  const { progress, addPractice } = useProgress();
  const exData = useQuery(exercisesQuery(inst)).data;
  const songData = useQuery(songsQuery(inst)).data;
  const exercises = useMemo(() => (exData ?? []) as Exercise[], [exData]);
  const songs = useMemo(() => songData ?? [], [songData]);
  const learning = useMemo(() => songs.filter((s) => progress.learning.includes(s.id)), [songs, progress.learning]);

  const [state, setState] = useState<SessionState | null>(null);
  const [, tick] = useState(0);
  const [done, setDone] = useState<number | null>(null);
  useEffect(() => { setState(readSession()); }, []);
  const save = (s: SessionState | null) => { writeSession(s); setState(s); };

  const day = Math.floor(Date.now() / 86_400_000);
  const preview = useMemo(
    () => buildSession(length, { exercises, songs: learning, level, day, stringed: inst === "chitarra" || inst === "basso" }),
    [length, exercises, learning, level, day, inst],
  );

  const block = state ? state.blocks[state.index] : undefined;
  const elapsed = state ? elapsedInBlock(state) : 0;
  const left = block ? block.minutes * 60 - elapsed : 0;

  // Il timer si aggiorna ogni mezzo secondo; a fine blocco suona un accordo e passa al successivo.
  const chimed = useRef(-1);
  useEffect(() => {
    if (!state?.runningSince) return;
    const id = window.setInterval(() => tick((n) => n + 1), 500);
    return () => window.clearInterval(id);
  }, [state?.runningSince]);
  useEffect(() => {
    if (!state || !block || state.runningSince == null || left > 0 || chimed.current === state.index) return;
    chimed.current = state.index;
    playChord([60, 64, 67, 72], { strum: 0.08, duration: 1.5 });
    advance();
  });

  const start = () => { chimed.current = -1; setDone(null); save({ minutes: length, blocks: preview, index: 0, doneInBlock: 0, doneBefore: 0, runningSince: Date.now() }); };
  const pause = () => state && save({ ...state, doneInBlock: elapsedInBlock(state), runningSince: null });
  const resume = () => state && save({ ...state, runningSince: Date.now() });
  const finish = (s: SessionState) => {
    const minutes = practicedMinutes(s);
    if (minutes >= 1) addPractice(`sessione:${new Date().toISOString().slice(11, 16)}`, minutes);
    setDone(Math.round(minutes));
    save(null);
  };
  function advance() {
    if (!state) return;
    const n = nextBlock(state);
    if (n.index >= n.blocks.length) finish(n);
    else save(n);
  }

  const ex = block?.exerciseId ? exercises.find((e) => e.id === block.exerciseId) : undefined;
  const total = state ? state.blocks.reduce((t, b) => t + b.minutes, 0) : length;

  return (
    <main className="mx-auto max-w-4xl px-5 pb-24 pt-28">
      <h1 className="font-display text-5xl md:text-7xl">Sessione guidata.</h1>
      <p className="mt-4 max-w-2xl text-muted-foreground">Scegli quanto tempo hai: ti preparo una routine a blocchi con il timer. Puoi aprire altre pagine dell'app, il conto resta.</p>

      {done != null && (
        <div className="animate-rise mt-8 flex items-center gap-3 rounded-2xl border border-emerald-400/40 bg-emerald-500/10 p-5">
          <Check className="h-6 w-6 text-emerald-400" />
          <p>Sessione finita: <strong>{done} minuti</strong> aggiunti ai tuoi progressi. <Link to="/progressi" className="text-primary hover:underline">Vedi i progressi →</Link></p>
        </div>
      )}

      {!state ? (
        <section className="mt-8 space-y-6 rounded-3xl bg-card p-6 shadow-soft md:p-8">
          <InstrumentTabs value={inst} onChange={setInst} />
          <div>
            <p className="mb-2 text-xs uppercase tracking-widest text-muted-foreground">Quanto tempo hai</p>
            <div className="flex flex-wrap gap-2">{SESSION_LENGTHS.map((m) => <button key={m} onClick={() => setLength(m)} className={pill(length === m)}>{m} minuti</button>)}</div>
          </div>
          <div>
            <p className="mb-2 text-xs uppercase tracking-widest text-muted-foreground">Il tuo livello</p>
            <div className="flex flex-wrap gap-2">{[1, 2, 3, 4, 5].map((l) => <button key={l} onClick={() => setLevel(l)} className={pill(level === l)}>{difficultyLabel[l]}</button>)}</div>
          </div>
          <ol className="space-y-2">
            {preview.map((b, i) => (
              <li key={i} className="flex items-center gap-4 rounded-2xl border p-4">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/15 font-mono text-sm text-primary">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <div className="text-xs uppercase tracking-widest text-muted-foreground">{b.kind}</div>
                  <div className="truncate font-medium">{b.title}</div>
                </div>
                <span className="font-mono text-sm">{b.minutes} min</span>
              </li>
            ))}
          </ol>
          <button onClick={start} disabled={!preview.length} className="btn-shine inline-flex items-center gap-2 rounded-full bg-primary px-8 py-4 font-medium text-primary-foreground shadow-glow disabled:opacity-50">
            <Play className="h-5 w-5" /> Inizia la sessione
          </button>
        </section>
      ) : block ? (
        <section className="mt-8 rounded-3xl bg-card p-6 shadow-soft md:p-8">
          {/* Avanzamento dei blocchi */}
          <div className="flex gap-1.5">
            {state.blocks.map((b, i) => (
              <div key={i} className="h-1.5 overflow-hidden rounded-full bg-foreground/10" style={{ flex: b.minutes }}>
                <div className="h-full bg-primary transition-all" style={{ width: i < state.index ? "100%" : i === state.index ? `${Math.min(100, (elapsed / (b.minutes * 60)) * 100)}%` : "0%" }} />
              </div>
            ))}
          </div>
          <div className="mt-6 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-widest text-primary">Blocco {state.index + 1} di {state.blocks.length} · {block.kind}</p>
              <h2 className="mt-1 font-display text-3xl">{block.title}</h2>
            </div>
            <div className="text-right">
              <div className="font-mono text-5xl tabular-nums">{fmt(left)}</div>
              <div className="flex items-center justify-end gap-1 text-xs text-muted-foreground"><Timer className="h-3.5 w-3.5" /> sessione da {total} min</div>
            </div>
          </div>
          <p className="mt-4 text-muted-foreground">{block.text}</p>

          <div className="mt-6 flex flex-wrap gap-2">
            {state.runningSince == null
              ? <button onClick={resume} className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground"><Play className="h-4 w-4" /> Riprendi</button>
              : <button onClick={pause} className="inline-flex items-center gap-2 rounded-full border px-5 py-2.5 text-sm hover:border-foreground/40"><Pause className="h-4 w-4" /> Pausa</button>}
            <button onClick={advance} className="inline-flex items-center gap-2 rounded-full border px-5 py-2.5 text-sm hover:border-foreground/40"><SkipForward className="h-4 w-4" /> Blocco successivo</button>
            <button onClick={() => finish(state)} className="inline-flex items-center gap-2 rounded-full border px-5 py-2.5 text-sm text-muted-foreground hover:border-foreground/40"><Square className="h-4 w-4" /> Termina</button>
          </div>

          {/* Contenuto del blocco */}
          <div className="mt-8 space-y-5 border-t pt-6">
            {ex && (
              <div>
                <p className="text-lg">{ex.description}</p>
                <ol className="mt-3 space-y-2">
                  {ex.steps.split("|").map((s, i) => (
                    <li key={i} className="flex gap-3"><span className="font-mono text-primary">{i + 1}.</span><span>{s}</span></li>
                  ))}
                </ol>
                <Link to="/esercizi" search={{ ex: ex.id, strumento: inst }} className="mt-3 inline-block text-sm text-primary hover:underline">Apri l'esercizio completo →</Link>
              </div>
            )}
            {block.kind === "orecchio" && (
              <div className="flex flex-wrap gap-2">
                <Link to="/orecchio" className="inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm hover:border-foreground/40"><Ear className="h-4 w-4" /> Allenamento dell'orecchio</Link>
                {(inst === "chitarra" || inst === "basso") && <Link to="/tastiera" className="inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm hover:border-foreground/40">Note sul manico</Link>}
              </div>
            )}
            {block.kind === "brano" && (
              block.songId
                ? <Link to="/brani/$songId" params={{ songId: block.songId }} className="inline-flex rounded-full border px-4 py-2 text-sm hover:border-foreground/40">Apri il brano: spartito e scheda →</Link>
                : <Link to="/base" className="inline-flex rounded-full border px-4 py-2 text-sm hover:border-foreground/40">Apri la base per improvvisare →</Link>
            )}
            {block.bpm ? <Metronome key={state.index} initialBpm={block.bpm} target={block.bpm} /> : null}
          </div>
        </section>
      ) : null}
    </main>
  );
}
