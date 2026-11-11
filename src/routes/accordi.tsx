import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Volume2 } from "lucide-react";
import { CHORD_TYPES, GUITAR_CHORDS, NOTE_IT, NOTE_NAMES, SCALES, TUNINGS, chordMidis } from "@/lib/theory";
import { playChord, playNote } from "@/lib/audio";
import { ChordDiagram, Fretboard, PianoKeys } from "@/components/MusicDiagrams";

type View = "accordi-chitarra" | "scale" | "accordi-piano";
type Search = { vista?: View | undefined; nota?: number | undefined; scala?: string | undefined; tipo?: string | undefined; strumento?: "chitarra" | "basso" | "pianoforte" | undefined };

export const Route = createFileRoute("/accordi")({
  validateSearch: (raw: Record<string, unknown>): Search => {
    const s = raw as { vista?: unknown; nota?: unknown; scala?: unknown; tipo?: unknown; strumento?: unknown };
    const n = Number(s.nota);
    return {
      ...(["accordi-chitarra", "scale", "accordi-piano"].includes(s.vista as string) ? { vista: s.vista as View } : {}),
      ...(Number.isInteger(n) && n >= 0 && n < 12 ? { nota: n } : {}),
      ...(typeof s.scala === "string" && SCALES[s.scala] ? { scala: s.scala } : {}),
      ...(typeof s.tipo === "string" && CHORD_TYPES[s.tipo] ? { tipo: s.tipo } : {}),
      ...(["chitarra", "basso", "pianoforte"].includes(s.strumento as string) ? { strumento: s.strumento as Search["strumento"] } : {}),
    };
  },
  head: () => ({
    meta: [
      { title: "Accordi e scale — Tono" },
      { name: "description", content: "Diagrammi degli accordi per chitarra, scale su manico e tastiera, accordi per pianoforte: con l'audio." },
      { property: "og:title", content: "Accordi e scale — Tono" },
      { property: "og:description", content: "Accordi per chitarra, scale e accordi per pianoforte, da ascoltare." },
    ],
  }),
  component: Dictionary,
});

const tab = (active: boolean) =>
  `rounded-full border px-4 py-2 text-sm transition-colors ${active ? "border-primary bg-primary text-primary-foreground" : "hover:border-foreground/40"}`;

function NotePicker({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {NOTE_NAMES.map((n, i) => (
        <button key={n} onClick={() => onChange(i)}
          className={`min-w-12 rounded-xl border px-2 py-1.5 text-sm ${value === i ? "border-orange-500 bg-orange-500 text-white" : "hover:border-foreground/40"}`}>
          {n}<span className="block text-[10px] opacity-70">{NOTE_IT[i]}</span>
        </button>
      ))}
    </div>
  );
}

function Dictionary() {
  const s = Route.useSearch();
  const navigate = useNavigate({ from: "/accordi" });
  const set = (patch: Search) => navigate({ search: (prev) => ({ ...prev, ...patch }), replace: true, resetScroll: false });
  const view = s.vista ?? "accordi-chitarra";
  const root = s.nota ?? 9;
  const scale = s.scala ?? "penta-minore";
  const type = s.tipo ?? "maj";
  const inst = s.strumento ?? "chitarra";

  const scaleNotes = SCALES[scale]!.steps.map((x) => (root + x) % 12);
  const chordNotes = CHORD_TYPES[type]!.steps.map((x) => (root + x) % 12);
  const guitarChords = GUITAR_CHORDS.filter((c) => s.tipo ? c.type === s.tipo : true);

  const playScale = () => {
    const base = (inst === "basso" ? 36 : 48) + root; // La/Do nell'ottava giusta per lo strumento
    [...SCALES[scale]!.steps, 12].forEach((x, i) => playNote(base + x, { at: i * 0.28, duration: 0.5 }));
  };

  return (
    <main className="mx-auto max-w-6xl px-5 pb-24 pt-28">
      <h1 className="font-display text-5xl md:text-7xl">Accordi e scale.</h1>
      <p className="mt-4 max-w-2xl text-muted-foreground">Scegli cosa ti serve, guarda dove mettere le dita e ascolta come suona. La nota principale (tonica) è sempre in arancio.</p>

      <div className="mt-8 flex flex-wrap gap-2">
        <button onClick={() => set({ vista: "accordi-chitarra" })} className={tab(view === "accordi-chitarra")}>Accordi per chitarra</button>
        <button onClick={() => set({ vista: "scale" })} className={tab(view === "scale")}>Scale</button>
        <button onClick={() => set({ vista: "accordi-piano" })} className={tab(view === "accordi-piano")}>Accordi per pianoforte</button>
      </div>

      {view === "accordi-chitarra" && (
        <section className="mt-8">
          <div className="flex flex-wrap gap-2">
            <button onClick={() => set({ tipo: undefined })} className={tab(!s.tipo)}>Tutti</button>
            {Object.entries(CHORD_TYPES).filter(([k]) => GUITAR_CHORDS.some((c) => c.type === k)).map(([k, t]) => (
              <button key={k} onClick={() => set({ tipo: k })} className={tab(s.tipo === k)}>{t.name}</button>
            ))}
          </div>
          <p className="mt-4 text-sm text-muted-foreground">I numeri sono le dita: 1 indice, 2 medio, 3 anulare, 4 mignolo. ○ corda a vuoto, × corda da non suonare. La barra è il barré.</p>
          <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {guitarChords.map((c, i) => (
              <button key={c.name} onClick={() => playChord(chordMidis(c))} style={{ animationDelay: `${Math.min(i, 18) * 30}ms` }}
                className="animate-card-in group flex flex-col items-center rounded-2xl border bg-card/60 p-3 transition-all hover:-translate-y-0.5 hover:border-primary/50">
                <div className="flex w-full items-center justify-between px-1">
                  <span className="font-display text-2xl">{c.name}</span>
                  <Volume2 className="h-4 w-4 text-muted-foreground group-hover:text-primary" />
                </div>
                <span className="w-full px-1 text-left text-[11px] text-muted-foreground">{NOTE_IT[c.root]} {CHORD_TYPES[c.type]!.name.toLowerCase()}</span>
                <ChordDiagram chord={c} />
              </button>
            ))}
          </div>
        </section>
      )}

      {view === "scale" && (
        <section className="mt-8 space-y-6">
          <div className="flex flex-wrap gap-2">
            {(["chitarra", "basso", "pianoforte"] as const).map((i) => (
              <button key={i} onClick={() => set({ strumento: i })} className={tab(inst === i)}>{i[0]!.toUpperCase() + i.slice(1)}</button>
            ))}
          </div>
          <div>
            <p className="mb-2 text-xs uppercase tracking-widest text-muted-foreground">Nota di partenza</p>
            <NotePicker value={root} onChange={(n) => set({ nota: n })} />
          </div>
          <div>
            <p className="mb-2 text-xs uppercase tracking-widest text-muted-foreground">Scala</p>
            <div className="flex flex-wrap gap-2">
              {Object.entries(SCALES).map(([k, v]) => (
                <button key={k} onClick={() => set({ scala: k })} className={tab(scale === k)}>{v.name}</button>
              ))}
            </div>
          </div>
          <div className="rounded-3xl bg-card p-6 shadow-soft">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-3xl">{NOTE_NAMES[root]} {SCALES[scale]!.name.toLowerCase()}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{SCALES[scale]!.tip}</p>
              </div>
              <button onClick={playScale} className="btn-shine inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground">
                <Volume2 className="h-4 w-4" /> Ascolta la scala
              </button>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {scaleNotes.map((n, i) => (
                <span key={i} className={`rounded-full px-3 py-1 text-sm ${n === root ? "bg-orange-500 text-white" : "bg-primary/15 text-primary"}`}>{NOTE_NAMES[n]} · {NOTE_IT[n]}</span>
              ))}
            </div>
            <div className="mt-6">
              {inst === "pianoforte" ? (
                <PianoKeys notes={scaleNotes} root={root} onPlay={(n, o) => playNote(60 + o * 12 + n)} />
              ) : (
                <Fretboard tuning={(inst === "basso" ? TUNINGS.find((t) => t.id === "bass-standard")! : TUNINGS[0]!).notes} notes={scaleNotes} root={root} />
              )}
            </div>
          </div>
        </section>
      )}

      {view === "accordi-piano" && (
        <section className="mt-8 space-y-6">
          <div>
            <p className="mb-2 text-xs uppercase tracking-widest text-muted-foreground">Nota</p>
            <NotePicker value={root} onChange={(n) => set({ nota: n })} />
          </div>
          <div>
            <p className="mb-2 text-xs uppercase tracking-widest text-muted-foreground">Tipo di accordo</p>
            <div className="flex flex-wrap gap-2">
              {Object.entries(CHORD_TYPES).map(([k, t]) => (
                <button key={k} onClick={() => set({ tipo: k })} className={tab(type === k)}>{t.name}</button>
              ))}
            </div>
          </div>
          <div className="rounded-3xl bg-card p-6 shadow-soft">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-3xl">{NOTE_NAMES[root]}{CHORD_TYPES[type]!.symbol}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{NOTE_IT[root]} {CHORD_TYPES[type]!.name.toLowerCase()}: {chordNotes.map((n) => NOTE_IT[n]).join(" – ")}</p>
              </div>
              <button onClick={() => playChord(CHORD_TYPES[type]!.steps.map((x) => 60 + root + x), { strum: 0 })}
                className="btn-shine inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground">
                <Volume2 className="h-4 w-4" /> Ascolta l'accordo
              </button>
            </div>
            <div className="mt-6"><PianoKeys notes={chordNotes} root={root} onPlay={(n, o) => playNote(60 + o * 12 + n)} /></div>
            <p className="mt-4 text-sm text-muted-foreground">Con la mano destra di solito si usano pollice (1), medio (3) e mignolo (5).</p>
          </div>
        </section>
      )}
    </main>
  );
}
