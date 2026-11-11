import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Check, Flame, Play, Trophy, X } from "lucide-react";
import { playNote } from "@/lib/audio";
import { FRET_LEVELS, checkFret, fretsFor, makeFretQuestion, noteAt, type FretQuestion } from "@/lib/fretgame";
import { NOTE_IT, NOTE_NAMES, TUNINGS } from "@/lib/theory";
import { useProgress } from "@/lib/progress";

export const Route = createFileRoute("/tastiera")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Note sul manico — Tono" },
      { name: "description", content: "Impara le note sul manico di chitarra e basso giocando: trova la nota sulla corda o riconosci il tasto." },
      { property: "og:title", content: "Note sul manico — Tono" },
      { property: "og:description", content: "Gioco per imparare le note su chitarra e basso." },
    ],
  }),
  component: FretGame,
});

const INSTRUMENTS = [
  { id: "chitarra", name: "Chitarra", tuning: "standard" },
  { id: "basso", name: "Basso", tuning: "bass-standard" },
] as const;
const MODES = [
  { id: "trova", name: "Trova la nota", tip: "Ti dico nota e corda: tocca il tasto giusto." },
  { id: "nomina", name: "Che nota è?", tip: "Ti mostro un tasto: scegli il nome della nota." },
] as const;
const BEST_KEY = "tono.manico.record";
const STRING_NAMES = (tuning: number[]) => tuning.map((n) => NOTE_NAMES[n % 12]!);

const pill = (on: boolean) => `rounded-full border px-4 py-1.5 text-sm transition-colors ${on ? "border-primary bg-primary text-primary-foreground" : "hover:border-foreground/40"}`;

function FretGame() {
  const [inst, setInst] = useState<(typeof INSTRUMENTS)[number]["id"]>("chitarra");
  const [mode, setMode] = useState<FretQuestion["mode"]>("trova");
  const [levelIdx, setLevelIdx] = useState(0);
  const [q, setQ] = useState<FretQuestion | null>(null);
  const [picked, setPicked] = useState<{ string: number; fret: number } | { note: number } | null>(null);
  const [score, setScore] = useState({ right: 0, total: 0, streak: 0 });
  const [best, setBest] = useState<Record<string, number>>({});
  const { addPractice } = useProgress();
  const answered = useRef(0);

  const level = FRET_LEVELS[levelIdx]!;
  const tuning = TUNINGS.find((t) => t.id === INSTRUMENTS.find((i) => i.id === inst)!.tuning)!.notes;
  const bestKey = `${inst}-${mode}-${level.id}`;
  const octave = inst === "basso" ? 12 : 0; // il basso suona un'ottava sotto: la si alza per sentirla meglio

  useEffect(() => { try { setBest(JSON.parse(localStorage.getItem(BEST_KEY) || "{}")); } catch { /* nessun record */ } }, []);
  useEffect(() => { setQ(null); setPicked(null); setScore({ right: 0, total: 0, streak: 0 }); }, [inst, mode, levelIdx]);
  // Ogni 10 risposte conta come due minuti di pratica di oggi.
  const log = useRef(addPractice);
  log.current = addPractice;
  useEffect(() => () => { if (answered.current >= 10) log.current("gioco:manico", answered.current / 5); answered.current = 0; }, []);

  const next = () => {
    const nq = makeFretQuestion(tuning, level, mode);
    setQ(nq);
    setPicked(null);
    if (nq.mode === "nomina") playNote(tuning[nq.string]! + nq.fret + octave, { duration: 1 });
  };
  const answer = (a: { string: number; fret: number } | { note: number }) => {
    if (!q || picked) return;
    setPicked(a);
    answered.current++;
    if ("fret" in a) playNote(tuning[a.string]! + a.fret + octave, { duration: 0.9 });
    const ok = checkFret(tuning, q, a);
    const s = { right: score.right + (ok ? 1 : 0), total: score.total + 1, streak: ok ? score.streak + 1 : 0 };
    setScore(s);
    if (s.streak > (best[bestKey] ?? 0)) {
      const nb = { ...best, [bestKey]: s.streak };
      setBest(nb);
      localStorage.setItem(BEST_KEY, JSON.stringify(nb));
    }
  };

  const ok = q && picked ? checkFret(tuning, q, picked) : null;
  const names = STRING_NAMES(tuning);
  // Dopo la risposta si mostrano tutte le posizioni giuste sulla corda.
  const solutions = q && picked ? fretsFor(tuning, q.string, q.note, level.maxFret) : [];

  return (
    <main className="mx-auto max-w-5xl px-5 pb-24 pt-28">
      <h1 className="font-display text-5xl md:text-7xl">Note sul manico.</h1>
      <p className="mt-4 max-w-2xl text-muted-foreground">Sapere dove sono le note ti serve per leggere gli accordi, improvvisare e capire i brani. Cinque minuti al giorno e in poche settimane le trovi senza pensarci.</p>

      <div className="mt-8 flex flex-wrap gap-2">
        {INSTRUMENTS.map((i) => <button key={i.id} onClick={() => setInst(i.id)} className={pill(inst === i.id)}>{i.name}</button>)}
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {MODES.map((m) => (
          <button key={m.id} onClick={() => setMode(m.id)}
            className={`rounded-2xl border p-4 text-left transition-all hover:-translate-y-0.5 ${mode === m.id ? "border-primary bg-primary/10" : "hover:border-foreground/30"}`}>
            <div className="font-display text-xl">{m.name}</div>
            <div className="mt-1 text-xs text-muted-foreground">{m.tip}</div>
          </button>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {FRET_LEVELS.map((l, i) => <button key={l.id} onClick={() => setLevelIdx(i)} className={pill(levelIdx === i)} title={l.tip}>{l.name}</button>)}
        <span className="text-xs text-muted-foreground">{level.tip}</span>
      </div>

      <section className="mt-8 rounded-3xl bg-card p-6 shadow-soft md:p-8">
        <div className="flex flex-wrap items-center justify-between gap-4 text-sm">
          <span className="flex items-center gap-2"><Check className="h-4 w-4 text-emerald-400" /> {score.right} su {score.total}</span>
          <span className="flex items-center gap-2"><Flame className="h-4 w-4 text-orange-400" /> Serie: {score.streak}</span>
          <span className="flex items-center gap-2 text-muted-foreground"><Trophy className="h-4 w-4 text-amber-300" /> Record: {best[bestKey] ?? 0}</span>
        </div>

        <div className="mt-6 min-h-16 text-center">
          {!q ? (
            <button onClick={next} className="btn-shine inline-flex items-center gap-2 rounded-full bg-primary px-8 py-4 font-medium text-primary-foreground shadow-glow">
              <Play className="h-5 w-5" /> Inizia
            </button>
          ) : q.mode === "trova" ? (
            <p className="font-display text-3xl">
              Trova <span className="text-primary">{NOTE_NAMES[q.note]} ({NOTE_IT[q.note]})</span> sulla corda di <span className="text-orange-400">{names[q.string]}</span>
            </p>
          ) : (
            <p className="font-display text-3xl">Che nota è il tasto evidenziato?</p>
          )}
        </div>

        {q && (
          <PlayableNeck
            tuning={tuning}
            frets={level.maxFret}
            highlightString={q.mode === "trova" ? q.string : null}
            target={q.mode === "nomina" ? { string: q.string, fret: q.fret } : null}
            picked={picked && "fret" in picked ? { ...picked, ok: !!ok } : null}
            solutions={q.mode === "trova" ? solutions.map((f) => ({ string: q.string, fret: f })) : []}
            onPick={q.mode === "trova" && !picked ? (string, fret) => answer({ string, fret }) : undefined}
          />
        )}

        {q?.mode === "nomina" && (
          <div className="mt-6 grid grid-cols-4 gap-2 sm:grid-cols-6 md:grid-cols-12">
            {NOTE_NAMES.map((n, i) => {
              if (level.naturalsOnly && n.includes("#")) return null;
              const isAnswer = picked && i === q.note;
              const isWrong = picked && "note" in picked && picked.note === i && i !== q.note;
              return (
                <button key={n} onClick={() => answer({ note: i })} disabled={!!picked}
                  className={`rounded-xl border px-2 py-2 text-sm transition-all ${isAnswer ? "border-emerald-400 bg-emerald-500/15" : isWrong ? "border-red-400 bg-red-500/15" : picked ? "opacity-50" : "hover:border-primary/50"}`}>
                  {n}<span className="block text-[10px] opacity-70">{NOTE_IT[i]}</span>
                </button>
              );
            })}
          </div>
        )}

        {picked && q && (
          <div className="mt-6 flex flex-wrap items-center justify-center gap-4">
            <p className={`flex items-center gap-2 text-lg font-medium ${ok ? "text-emerald-400" : "text-red-400"}`}>
              {ok ? <Check className="h-5 w-5" /> : <X className="h-5 w-5" />}
              {ok ? "Giusto!" : q.mode === "trova"
                ? `Hai toccato ${"fret" in picked ? NOTE_NAMES[noteAt(tuning, picked.string, picked.fret)] : ""}: ${NOTE_NAMES[q.note]} è al tasto ${solutions.join(" e ")}`
                : `Era ${NOTE_NAMES[q.note]} (${NOTE_IT[q.note]})`}
            </p>
            <button onClick={next} className="btn-shine rounded-full bg-primary px-6 py-3 text-sm font-medium text-primary-foreground">Prossima →</button>
          </div>
        )}
      </section>
    </main>
  );
}

/** Manico cliccabile: corda più acuta in alto, come nelle tablature. */
function PlayableNeck({ tuning, frets, highlightString, target, picked, solutions, onPick }: {
  tuning: number[];
  frets: number;
  highlightString: number | null;
  target: { string: number; fret: number } | null;
  picked: { string: number; fret: number; ok: boolean } | null;
  solutions: { string: number; fret: number }[];
  onPick: ((string: number, fret: number) => void) | undefined;
}) {
  const n = tuning.length;
  const cellW = 54, rowH = 34, left = 40, top = 18;
  const w = left + cellW * (frets + 1), h = top + rowH * (n - 1) + 34;
  const y = (s: number) => top + (n - 1 - s) * rowH; // s = 0 è la corda più grave, in basso
  const fx = (f: number) => (f === 0 ? left - 18 : left + cellW * (f - 0.5));
  const dot = (s: number, f: number, cls: string, key: string) => <circle key={key} cx={fx(f)} cy={y(s)} r={12} className={cls} />;
  return (
    <div className="mt-6 overflow-x-auto">
      <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h} role="img" aria-label="Manico: tocca un tasto" className="mx-auto text-foreground">
        <rect x={left} y={top - 8} width={cellW * frets} height={rowH * (n - 1) + 16} rx={4} className="fill-[#3a2416] opacity-60" />
        {[3, 5, 7, 9].filter((f) => f <= frets).map((f) => <circle key={f} cx={left + cellW * (f - 0.5)} cy={top + (rowH * (n - 1)) / 2} r={5} className="fill-foreground opacity-15" />)}
        {frets >= 12 && [1, 3].map((k) => <circle key={k} cx={left + cellW * 11.5} cy={top + ((rowH * (n - 1)) / 4) * k} r={5} className="fill-foreground opacity-15" />)}
        {Array.from({ length: frets + 1 }, (_, f) => (
          <line key={f} x1={left + cellW * f} x2={left + cellW * f} y1={top - 8} y2={top + rowH * (n - 1) + 8} className={f === 0 ? "stroke-current" : "stroke-current opacity-30"} strokeWidth={f === 0 ? 4 : 1.5} />
        ))}
        {tuning.map((open, s) => (
          <g key={s}>
            <line x1={left} x2={left + cellW * frets} y1={y(s)} y2={y(s)} strokeWidth={1 + (n - 1 - s) * 0.4}
              className={highlightString === s ? "stroke-orange-400" : "stroke-current opacity-60"} />
            <text x={6} y={y(s) + 4} className={`text-[11px] ${highlightString === s ? "fill-orange-400 font-semibold" : "fill-muted-foreground"}`}>{NOTE_NAMES[open % 12]}</text>
          </g>
        ))}
        {/* Zone cliccabili: una per tasto e corda */}
        {onPick && tuning.flatMap((_, s) => Array.from({ length: frets + 1 }, (_, f) => (
          <rect key={`${s}-${f}`} x={f === 0 ? left - 34 : left + cellW * (f - 1)} y={y(s) - rowH / 2} width={f === 0 ? 34 : cellW} height={rowH}
            className="cursor-pointer fill-transparent hover:fill-primary/20" onClick={() => onPick(s, f)}>
            <title>{`Corda ${NOTE_NAMES[tuning[s]! % 12]}, tasto ${f}`}</title>
          </rect>
        )))}
        {solutions.map((p) => dot(p.string, p.fret, "fill-emerald-500/70", `sol-${p.fret}`))}
        {target && dot(target.string, target.fret, "fill-orange-500 animate-pulse", "target")}
        {picked && dot(picked.string, picked.fret, picked.ok ? "fill-emerald-400" : "fill-red-500", "picked")}
        {Array.from({ length: frets }, (_, f) => <text key={f} x={left + cellW * (f + 0.5)} y={h - 6} textAnchor="middle" className="fill-muted-foreground text-[10px]">{f + 1}</text>)}
      </svg>
    </div>
  );
}
