import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Drum, Minus, Pause, Play, Plus } from "lucide-react";
import { audio, playDrum, playNote } from "@/lib/audio";
import { PROGRESSIONS, bassNote, chordAt, chordName, chordVoicing } from "@/lib/jam";
import { METRONOME_START, clampBpm } from "@/lib/metronome";
import { NOTE_IT, NOTE_NAMES, SCALES, TUNINGS } from "@/lib/theory";
import { Fretboard, PianoKeys } from "@/components/MusicDiagrams";
import { useProgress } from "@/lib/progress";

export const Route = createFileRoute("/base")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Base per improvvisare — Tono" },
      { name: "description", content: "Scegli un giro di accordi, la tonalità e la velocità: l'app suona la base in loop e ti mostra la scala per improvvisare." },
      { property: "og:title", content: "Base per improvvisare — Tono" },
      { property: "og:description", content: "Giri di accordi in loop con la scala consigliata." },
    ],
  }),
  component: Jam,
});

type Style = "pad" | "ritmo" | "arpeggio";
const STYLES: { id: Style; name: string }[] = [
  { id: "pad", name: "Accordi lunghi" },
  { id: "ritmo", name: "Ritmo" },
  { id: "arpeggio", name: "Arpeggio" },
];
const VIEWS = [
  { id: "chitarra", name: "Chitarra" },
  { id: "basso", name: "Basso" },
  { id: "pianoforte", name: "Pianoforte" },
] as const;

const pill = (on: boolean) => `rounded-full border px-4 py-1.5 text-sm transition-colors ${on ? "border-primary bg-primary text-primary-foreground" : "hover:border-foreground/40"}`;

function Jam() {
  const [progId, setProgId] = useState(PROGRESSIONS[0]!.id);
  const [key, setKey] = useState(9); // La
  const [bpm, setBpm] = useState(90);
  const [style, setStyle] = useState<Style>("ritmo");
  const [drums, setDrums] = useState(true);
  const [view, setView] = useState<(typeof VIEWS)[number]["id"]>("chitarra");
  const [on, setOn] = useState(false);
  const [pos, setPos] = useState({ bar: -1, beat: -1 });
  const { addPractice } = useProgress();
  const prog = PROGRESSIONS.find((p) => p.id === progId)!;
  const scale = SCALES[prog.scale]!;

  // Lo scheduler legge sempre le scelte attuali: cambiarle mentre suona non fa ripartire la base.
  const live = useRef({ prog, key, bpm, style, drums });
  live.current = { prog, key, bpm, style, drums };

  useEffect(() => {
    if (!on) { setPos({ bar: -1, beat: -1 }); return; }
    window.dispatchEvent(new Event(METRONOME_START));
    const ac = audio();
    const startedAt = Date.now();
    let next = ac.currentTime + 0.08;
    let beat = 0;
    const timers = new Set<number>();
    const schedule = () => {
      const ahead = document.hidden ? 1.5 : 0.15;
      while (next < ac.currentTime + ahead) {
        const { prog: p, key: k, bpm: b, style: st, drums: dr } = live.current;
        const spb = 60 / b;
        const { bar, beatInBar, chord } = chordAt(p, beat);
        const notes = chordVoicing(k, chord);
        const rel = next - ac.currentTime;
        if (st === "pad" && beatInBar === 0) notes.forEach((n) => playNote(n, { at: rel, duration: spb * 4, volume: 0.09 }));
        if (st === "ritmo") notes.forEach((n) => playNote(n, { at: rel, duration: spb * 0.6, volume: beatInBar === 0 ? 0.1 : 0.07 }));
        if (st === "arpeggio") {
          const seq = [...notes, notes[1] ?? notes[0]!];
          playNote(seq[beatInBar % seq.length]! + 12, { at: rel, duration: spb * 1.2, volume: 0.12 });
          playNote(seq[(beatInBar + 2) % seq.length]! + 12, { at: rel + spb / 2, duration: spb, volume: 0.08 });
        }
        // Basso: fondamentale sull'1 e sul 3, quinta sul 4 per spingere verso l'accordo dopo.
        if (beatInBar !== 1) playNote(bassNote(k, chord) + (beatInBar === 3 ? 7 : 0), { at: rel, duration: spb * 0.9, volume: 0.16 });
        if (dr) {
          playDrum(beatInBar % 2 === 0 ? "kick" : "snare", next);
          playDrum("hat", next, 0.9);
          playDrum("hat", next + spb / 2, 0.6);
        }
        const id = window.setTimeout(() => { timers.delete(id); setPos({ bar, beat: beatInBar }); }, Math.max(0, rel * 1000));
        timers.add(id);
        next += spb;
        beat++;
      }
    };
    schedule();
    const loop = window.setInterval(schedule, 25);
    return () => {
      window.clearInterval(loop);
      timers.forEach((t) => window.clearTimeout(t));
      // Più di un minuto di improvvisazione conta come pratica di oggi.
      const minutes = (Date.now() - startedAt) / 60000;
      if (minutes >= 1) addPractice("base", minutes);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [on]);

  const current = pos.bar >= 0 ? prog.bars[pos.bar]! : prog.bars[0]!;
  const scaleNotes = scale.steps.map((s) => (key + s) % 12);
  const chordNotes = chordVoicing(key, current).map((n) => n % 12);
  const tuning = TUNINGS.find((t) => t.id === (view === "basso" ? "bass-standard" : "standard"))!.notes;

  return (
    <main className="mx-auto max-w-5xl px-5 pb-24 pt-28">
      <h1 className="font-display text-5xl md:text-7xl">Base per improvvisare.</h1>
      <p className="mt-4 max-w-2xl text-muted-foreground">Scegli un giro di accordi e una tonalità: la base suona in loop e qui sotto vedi quali note usare. Sono giri generici, quelli che trovi in migliaia di canzoni.</p>

      <section className="mt-10 space-y-6 rounded-3xl bg-card p-6 shadow-soft md:p-8">
        <div>
          <p className="mb-2 text-xs uppercase tracking-widest text-muted-foreground">Giro di accordi</p>
          <div className="grid gap-2 sm:grid-cols-3">
            {PROGRESSIONS.map((p) => (
              <button key={p.id} onClick={() => setProgId(p.id)}
                className={`rounded-2xl border p-3 text-left transition-all hover:-translate-y-0.5 ${progId === p.id ? "border-primary bg-primary/10" : "hover:border-foreground/30"}`}>
                <div className="font-medium">{p.name}</div>
                <div className="mt-0.5 font-mono text-xs text-muted-foreground">{p.degrees}</div>
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-2 text-xs uppercase tracking-widest text-muted-foreground">Tonalità</p>
          <div className="flex flex-wrap gap-1.5">
            {NOTE_NAMES.map((n, i) => (
              <button key={n} onClick={() => setKey(i)}
                className={`min-w-12 rounded-xl border px-2 py-1.5 text-sm ${key === i ? "border-orange-500 bg-orange-500 text-white" : "hover:border-foreground/40"}`}>
                {n}<span className="block text-[10px] opacity-70">{NOTE_IT[i]}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button onClick={() => setOn((v) => !v)} aria-label={on ? "Ferma la base" : "Suona la base"}
            className="btn-shine flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-glow transition-transform active:scale-95">
            {on ? <Pause className="h-6 w-6" /> : <Play className="ml-0.5 h-6 w-6" />}
          </button>
          <button onClick={() => setBpm(clampBpm(bpm - 5))} className="flex h-9 w-9 items-center justify-center rounded-full border" aria-label="Più lento"><Minus className="h-3.5 w-3.5" /></button>
          <input type="range" min={50} max={180} value={bpm} onChange={(e) => setBpm(+e.target.value)} className="w-40 accent-[var(--primary)]" aria-label="BPM" />
          <button onClick={() => setBpm(clampBpm(bpm + 5))} className="flex h-9 w-9 items-center justify-center rounded-full border" aria-label="Più veloce"><Plus className="h-3.5 w-3.5" /></button>
          <span className="w-16 font-mono text-sm">{bpm} bpm</span>
          <div className="flex flex-wrap gap-1.5">
            {STYLES.map((s) => <button key={s.id} onClick={() => setStyle(s.id)} className={pill(style === s.id)}>{s.name}</button>)}
          </div>
          <button onClick={() => setDrums((v) => !v)} className={`${pill(drums)} inline-flex items-center gap-1.5`}><Drum className="h-4 w-4" /> Batteria</button>
        </div>

        {/* Accordi del giro: quello che suona è evidenziato */}
        <div className="grid grid-cols-4 gap-2">
          {prog.bars.map((ch, i) => (
            <div key={i} className={`rounded-2xl border p-3 text-center transition-all ${pos.bar === i ? "scale-[1.03] border-primary bg-primary/15 shadow-glow" : ""}`}>
              <div className="font-display text-2xl">{chordName(key, ch)}</div>
              <div className="mt-2 flex justify-center gap-1" aria-hidden>
                {[0, 1, 2, 3].map((b) => <span key={b} className={`h-1.5 w-1.5 rounded-full ${pos.bar === i && pos.beat === b ? "bg-primary" : "bg-muted-foreground/25"}`} />)}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-8 rounded-3xl border p-6 md:p-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-widest text-primary">Scala consigliata</p>
            <h2 className="mt-1 font-display text-3xl">{NOTE_NAMES[key]} {scale.name}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{prog.tip}</p>
          </div>
          <div className="flex gap-1.5">{VIEWS.map((v) => <button key={v.id} onClick={() => setView(v.id)} className={pill(view === v.id)}>{v.name}</button>)}</div>
        </div>
        <p className="mt-4 text-sm">
          Note: <span className="font-mono">{scaleNotes.map((n) => NOTE_NAMES[n]).join(" · ")}</span>
          <span className="text-muted-foreground"> — sull'accordo attuale ({chordName(key, current)}) le note più sicure sono {chordNotes.map((n) => NOTE_NAMES[n]).join(", ")}.</span>
        </p>
        <div className="mt-6">
          {view === "pianoforte"
            ? <PianoKeys notes={scaleNotes} root={key} onPlay={(n, o) => playNote(60 + o * 12 + n)} />
            : <Fretboard tuning={tuning} notes={scaleNotes} root={key} />}
        </div>
        <Link to="/accordi" search={{ vista: "scale", nota: key, scala: prog.scale, strumento: view }} className="mt-4 inline-block text-sm text-primary hover:underline">
          Studia la scala nel dizionario →
        </Link>
      </section>
    </main>
  );
}
