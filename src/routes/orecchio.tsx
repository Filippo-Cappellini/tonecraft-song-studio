import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Check, Flame, Play, RotateCcw, Trophy, X } from "lucide-react";
import { playChord, playNote } from "@/lib/audio";

export const Route = createFileRoute("/orecchio")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Allenamento dell'orecchio — Tono" },
      { name: "description", content: "Gioca a riconoscere note, intervalli e accordi ascoltandoli: tre livelli di difficoltà." },
      { property: "og:title", content: "Allenamento dell'orecchio — Tono" },
      { property: "og:description", content: "Riconosci note, intervalli e accordi ascoltandoli." },
    ],
  }),
  component: EarTraining,
});

type Option = { id: string; label: string; hint?: string };
type Game = { id: string; title: string; tip: string; levels: Option[][] };

const INTERVALS: Record<string, { label: string; semis: number; hint: string }> = {
  "2M": { label: "Seconda maggiore", semis: 2, hint: "Inizio di \"Fra Martino\"" },
  "3m": { label: "Terza minore", semis: 3, hint: "Inizio di \"Smoke on the Water\"" },
  "3M": { label: "Terza maggiore", semis: 4, hint: "\"Oh When the Saints\"" },
  "4": { label: "Quarta giusta", semis: 5, hint: "Marcia nuziale (\"Here Comes the Bride\")" },
  tritono: { label: "Tritono", semis: 6, hint: "\"The Simpsons\", sigla" },
  "5": { label: "Quinta giusta", semis: 7, hint: "Tema di \"Star Wars\"" },
  "6M": { label: "Sesta maggiore", semis: 9, hint: "\"My Bonnie\"" },
  "7m": { label: "Settima minore", semis: 10, hint: "Tema di \"Star Trek\" (serie classica)" },
  "8": { label: "Ottava", semis: 12, hint: "\"Somewhere Over the Rainbow\"" },
};
const CHORDS: Record<string, { label: string; steps: number[]; hint: string }> = {
  maj: { label: "Maggiore", steps: [0, 4, 7], hint: "Allegro, aperto" },
  min: { label: "Minore", steps: [0, 3, 7], hint: "Triste, scuro" },
  dim: { label: "Diminuito", steps: [0, 3, 6], hint: "Teso, inquietante" },
  aug: { label: "Aumentato", steps: [0, 4, 8], hint: "Sospeso, misterioso" },
  "7": { label: "Settima", steps: [0, 4, 7, 10], hint: "Blues, vuole andare avanti" },
  maj7: { label: "Settima maggiore", steps: [0, 4, 7, 11], hint: "Morbido, jazzato" },
  m7: { label: "Minore settima", steps: [0, 3, 7, 10], hint: "Malinconico ma rilassato" },
};
const opts = (ids: string[], src: Record<string, { label: string; hint: string }>): Option[] => ids.map((id) => ({ id, label: src[id]!.label, hint: src[id]!.hint }));

const GAMES: Game[] = [
  {
    id: "alta", title: "Più alta o più bassa?", tip: "Senti due note: la seconda è più alta o più bassa della prima?",
    levels: [[{ id: "su", label: "Più alta" }, { id: "giu", label: "Più bassa" }], [{ id: "su", label: "Più alta" }, { id: "giu", label: "Più bassa" }], [{ id: "su", label: "Più alta" }, { id: "giu", label: "Più bassa" }, { id: "uguale", label: "Uguale" }]],
  },
  {
    id: "intervalli", title: "Intervalli", tip: "Senti due note una dopo l'altra: quanto sono distanti?",
    levels: [opts(["3M", "5", "8"], INTERVALS), opts(["2M", "3m", "3M", "4", "5", "8"], INTERVALS), opts(Object.keys(INTERVALS), INTERVALS)],
  },
  {
    id: "accordi", title: "Accordi", tip: "Senti un accordo: che tipo è?",
    levels: [opts(["maj", "min"], CHORDS), opts(["maj", "min", "dim", "aug"], CHORDS), opts(Object.keys(CHORDS), CHORDS)],
  },
];
const LEVELS = ["Facile", "Medio", "Difficile"];
const BEST_KEY = "tono.orecchio.record";

type Question = { answer: string; play: () => void };

function makeQuestion(game: string, level: number): Question {
  const options = GAMES.find((g) => g.id === game)!.levels[level]!;
  const answer = options[Math.floor(Math.random() * options.length)]!.id;
  const root = 55 + Math.floor(Math.random() * 12); // tra Sol3 e Fa#4
  if (game === "alta") {
    // Al livello facile le note sono lontane, al difficile vicinissime.
    const gap = [5 + Math.floor(Math.random() * 4), 2 + Math.floor(Math.random() * 2), 1][level]!;
    const second = answer === "su" ? root + gap : answer === "giu" ? root - gap : root;
    return { answer, play: () => { playNote(root, { duration: 0.9 }); playNote(second, { at: 0.9, duration: 0.9 }); } };
  }
  if (game === "intervalli") {
    const semis = INTERVALS[answer]!.semis;
    return { answer, play: () => { playNote(root, { duration: 0.9 }); playNote(root + semis, { at: 0.8, duration: 1.1 }); } };
  }
  const steps = CHORDS[answer]!.steps;
  return { answer, play: () => playChord(steps.map((x) => root - 7 + x), { strum: 0.04, duration: 2 }) };
}

function EarTraining() {
  const [game, setGame] = useState("intervalli");
  const [level, setLevel] = useState(0);
  const [q, setQ] = useState<Question | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [score, setScore] = useState({ right: 0, total: 0, streak: 0 });
  const [best, setBest] = useState<Record<string, number>>({});
  const bestKey = `${game}-${level}`;

  useEffect(() => { try { setBest(JSON.parse(localStorage.getItem(BEST_KEY) || "{}")); } catch { /* nessun record */ } }, []);
  useEffect(() => { setQ(null); setPicked(null); setScore({ right: 0, total: 0, streak: 0 }); }, [game, level]);

  const next = () => { const nq = makeQuestion(game, level); setQ(nq); setPicked(null); nq.play(); };
  const answer = (id: string) => {
    if (!q || picked) return;
    setPicked(id);
    const ok = id === q.answer;
    const s = { right: score.right + (ok ? 1 : 0), total: score.total + 1, streak: ok ? score.streak + 1 : 0 };
    setScore(s);
    if (s.streak > (best[bestKey] ?? 0)) {
      const nb = { ...best, [bestKey]: s.streak };
      setBest(nb);
      localStorage.setItem(BEST_KEY, JSON.stringify(nb));
    }
  };

  const g = GAMES.find((x) => x.id === game)!;
  const options = g.levels[level]!;

  return (
    <main className="mx-auto max-w-4xl px-5 pb-24 pt-28">
      <h1 className="font-display text-5xl md:text-7xl">Allenamento dell'orecchio.</h1>
      <p className="mt-4 max-w-2xl text-muted-foreground">Ascolta e indovina. Pochi minuti al giorno ti aiutano a suonare a orecchio e a riconoscere gli accordi nei brani. Usa le cuffie o alza il volume.</p>

      <div className="mt-8 grid gap-3 sm:grid-cols-3">
        {GAMES.map((x) => (
          <button key={x.id} onClick={() => setGame(x.id)}
            className={`rounded-2xl border p-4 text-left transition-all hover:-translate-y-0.5 ${game === x.id ? "border-primary bg-primary/10" : "hover:border-foreground/30"}`}>
            <div className="font-display text-xl">{x.title}</div>
            <div className="mt-1 text-xs text-muted-foreground">{x.tip}</div>
          </button>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {LEVELS.map((l, i) => (
          <button key={l} onClick={() => setLevel(i)}
            className={`rounded-full border px-4 py-1.5 text-sm ${level === i ? "border-primary bg-primary text-primary-foreground" : "hover:border-foreground/40"}`}>{l}</button>
        ))}
      </div>

      <section className="mt-8 rounded-3xl bg-card p-8 shadow-soft">
        <div className="flex flex-wrap items-center justify-between gap-4 text-sm">
          <span className="flex items-center gap-2"><Check className="h-4 w-4 text-emerald-400" /> {score.right} su {score.total}</span>
          <span className="flex items-center gap-2"><Flame className="h-4 w-4 text-orange-400" /> Serie: {score.streak}</span>
          <span className="flex items-center gap-2 text-muted-foreground"><Trophy className="h-4 w-4 text-amber-300" /> Record: {best[bestKey] ?? 0}</span>
        </div>

        <div className="mt-8 flex flex-wrap justify-center gap-3">
          {!q ? (
            <button onClick={next} className="btn-shine inline-flex items-center gap-2 rounded-full bg-primary px-8 py-4 font-medium text-primary-foreground shadow-glow">
              <Play className="h-5 w-5" /> Inizia
            </button>
          ) : (
            <>
              <button onClick={() => q.play()} className="inline-flex items-center gap-2 rounded-full border px-6 py-3 text-sm hover:bg-secondary"><RotateCcw className="h-4 w-4" /> Riascolta</button>
              {picked && <button onClick={next} className="btn-shine inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-medium text-primary-foreground">Prossima →</button>}
            </>
          )}
        </div>

        {q && (
          <div className="mt-8 grid gap-3 sm:grid-cols-2 md:grid-cols-3">
            {options.map((o) => {
              const isAnswer = picked && o.id === q.answer;
              const isWrong = picked === o.id && o.id !== q.answer;
              return (
                <button key={o.id} onClick={() => answer(o.id)} disabled={!!picked}
                  className={`animate-card-in rounded-2xl border p-4 text-left transition-all ${isAnswer ? "border-emerald-400 bg-emerald-500/15" : isWrong ? "border-red-400 bg-red-500/15" : picked ? "opacity-50" : "hover:-translate-y-0.5 hover:border-primary/50"}`}>
                  <div className="flex items-center justify-between font-medium">
                    {o.label}
                    {isAnswer && <Check className="h-5 w-5 text-emerald-400" />}
                    {isWrong && <X className="h-5 w-5 text-red-400" />}
                  </div>
                  {o.hint && picked && <div className="mt-1 text-xs text-muted-foreground">{o.hint}</div>}
                </button>
              );
            })}
          </div>
        )}
        {picked && (
          <p className={`mt-6 text-center text-lg font-medium ${picked === q?.answer ? "text-emerald-400" : "text-red-400"}`}>
            {picked === q?.answer ? "Giusto!" : `Era: ${options.find((o) => o.id === q?.answer)?.label}`}
          </p>
        )}
      </section>
    </main>
  );
}
