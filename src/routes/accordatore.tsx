import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Mic, MicOff, Volume2 } from "lucide-react";
import { TUNINGS, freqToMidi, midiToFreq, noteIt, noteLabel, NOTE_NAMES, pc } from "@/lib/theory";
import { referenceTone } from "@/lib/audio";
import { detectPitch } from "@/lib/pitch";

export const Route = createFileRoute("/accordatore")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>): { accordatura?: string } => {
    const { accordatura } = s as { accordatura?: unknown };
    return typeof accordatura === "string" ? { accordatura } : {};
  },
  head: () => ({
    meta: [
      { title: "Accordatore per chitarra e basso — Tono" },
      { name: "description", content: "Accorda chitarra e basso con il microfono: standard, Drop D, mezzo tono sotto e altre accordature." },
      { property: "og:title", content: "Accordatore — Tono" },
      { property: "og:description", content: "Accorda con il microfono del telefono o del computer." },
    ],
  }),
  component: Tuner,
});

function Tuner() {
  const search = Route.useSearch();
  const [tuningId, setTuningId] = useState(search.accordatura && TUNINGS.some((t) => t.id === search.accordatura) ? search.accordatura : "standard");
  const tuning = TUNINGS.find((t) => t.id === tuningId)!;
  const [target, setTarget] = useState<number | "auto">("auto");
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [freq, setFreq] = useState<number | null>(null);
  const [playing, setPlaying] = useState<number | null>(null);
  const stopRef = useRef<() => void>(() => {});
  const toneRef = useRef<(() => void) | null>(null);

  useEffect(() => () => { stopRef.current(); toneRef.current?.(); }, []);
  useEffect(() => { setTarget("auto"); }, [tuningId]);

  const start = async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
      const ac = new AudioContext();
      const src = ac.createMediaStreamSource(stream);
      const analyser = ac.createAnalyser();
      analyser.fftSize = 4096;
      src.connect(analyser);
      const buf = new Float32Array(analyser.fftSize);
      const recent: number[] = [];
      let silent = 0;
      const id = setInterval(() => {
        analyser.getFloatTimeDomainData(buf);
        const f = detectPitch(buf, ac.sampleRate);
        if (f > 0) {
          recent.push(f);
          if (recent.length > 5) recent.shift();
          const sorted = [...recent].sort((x, y) => x - y);
          setFreq(sorted[Math.floor(sorted.length / 2)]!);
          silent = 0;
        } else if (++silent > 12) { recent.length = 0; setFreq(null); }
      }, 90);
      stopRef.current = () => { clearInterval(id); stream.getTracks().forEach((t) => t.stop()); void ac.close(); };
      setListening(true);
    } catch {
      setError("Non riesco ad usare il microfono. Controlla di aver dato il permesso al browser e riprova.");
    }
  };
  const stop = () => { stopRef.current(); stopRef.current = () => {}; setListening(false); setFreq(null); };

  const toggleTone = (midi: number) => {
    toneRef.current?.();
    toneRef.current = null;
    if (playing === midi) { setPlaying(null); return; }
    toneRef.current = referenceTone(midi);
    setPlaying(midi);
  };

  // Nota da raggiungere: la corda scelta, oppure la corda più vicina a quello che senti.
  const heard = freq ? freqToMidi(freq) : null;
  const goal = heard === null ? null : target === "auto"
    ? tuning.notes.reduce((b, n) => (Math.abs(n - heard) < Math.abs(b - heard) ? n : b), tuning.notes[0]!)
    : target;
  const cents = heard !== null && goal !== null ? Math.max(-50, Math.min(50, (heard - goal) * 100)) : 0;
  const inTune = heard !== null && Math.abs(cents) <= 5;
  const color = heard === null ? "text-muted-foreground" : inTune ? "text-emerald-400" : Math.abs(cents) < 20 ? "text-amber-300" : "text-red-400";

  return (
    <main className="mx-auto max-w-4xl px-5 pb-24 pt-28">
      <h1 className="font-display text-5xl md:text-7xl">Accordatore.</h1>
      <p className="mt-4 max-w-2xl text-muted-foreground">Avvia il microfono e suona una corda alla volta, lasciandola vibrare. Quando la lancetta è al centro e diventa verde, la corda è accordata.</p>

      <div className="mt-8 flex flex-wrap gap-2">
        {(["chitarra", "basso"] as const).map((inst) => (
          <div key={inst} className="flex flex-wrap items-center gap-2">
            <span className="mr-1 text-xs uppercase tracking-widest text-muted-foreground">{inst === "chitarra" ? "Chitarra" : "Basso"}</span>
            {TUNINGS.filter((t) => t.instrument === inst).map((t) => (
              <button key={t.id} onClick={() => setTuningId(t.id)}
                className={`rounded-full border px-3 py-1.5 text-sm ${tuningId === t.id ? "border-primary bg-primary text-primary-foreground" : "hover:border-foreground/40"}`}>
                {t.name.replace(/^Basso /, "")}
              </button>
            ))}
          </div>
        ))}
      </div>

      <section className="mt-8 rounded-3xl bg-card p-8 text-center shadow-soft">
        <div className={`font-display text-8xl leading-none transition-colors ${color}`}>
          {heard === null ? "—" : NOTE_NAMES[pc(heard)]}
        </div>
        <div className="mt-2 text-sm text-muted-foreground">
          {heard === null ? (listening ? "Suona una corda…" : "Il microfono è spento") : `${noteIt(heard)} · ${freq!.toFixed(1)} Hz`}
        </div>

        {/* Lancetta: da -50 a +50 centesimi */}
        <div className="relative mx-auto mt-8 h-16 max-w-xl">
          <div className="absolute inset-x-0 top-1/2 h-2 -translate-y-1/2 rounded-full bg-gradient-to-r from-red-500/60 via-emerald-400 to-red-500/60" />
          {[-50, -25, 0, 25, 50].map((c) => (
            <span key={c} className="absolute top-full mt-1 -translate-x-1/2 text-[10px] text-muted-foreground" style={{ left: `${50 + c}%` }}>{c > 0 ? `+${c}` : c}</span>
          ))}
          <div className="absolute top-0 h-16 w-1 -translate-x-1/2 rounded-full bg-foreground shadow-glow transition-[left] duration-150"
            style={{ left: `${50 + cents}%`, opacity: heard === null ? 0.25 : 1 }} />
        </div>
        <p className={`mt-10 text-lg font-medium ${color}`}>
          {heard === null || goal === null ? "" : inTune ? `Perfetto: ${noteLabel(goal)} accordata` : cents < 0 ? `Troppo basso: tira un po' la corda verso ${noteLabel(goal)}` : `Troppo alto: allenta un po' la corda verso ${noteLabel(goal)}`}
        </p>

        <button onClick={listening ? stop : start}
          className={`mt-6 inline-flex items-center gap-2 rounded-full px-7 py-3.5 text-sm font-medium ${listening ? "border" : "btn-shine bg-primary text-primary-foreground shadow-glow"}`}>
          {listening ? <><MicOff className="h-4 w-4" /> Spegni il microfono</> : <><Mic className="h-4 w-4" /> Avvia il microfono</>}
        </button>
        {error && <p className="mt-4 text-sm text-red-400">{error}</p>}
      </section>

      <section className="mt-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-2xl">Le corde</h2>
          <button onClick={() => setTarget("auto")} className={`rounded-full border px-3 py-1.5 text-xs ${target === "auto" ? "border-primary text-primary" : ""}`}>Riconosci la corda da solo</button>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">Clicca una corda per accordare solo quella, oppure sull'altoparlante per sentire la nota giusta.</p>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {tuning.notes.map((n, i) => {
            const active = goal === n && heard !== null;
            return (
              <div key={i} className={`rounded-2xl border p-4 transition-colors ${target === n ? "border-primary bg-primary/10" : active ? (inTune ? "border-emerald-400/60" : "border-amber-300/60") : ""}`}>
                <button onClick={() => setTarget(n)} className="w-full text-left">
                  <div className="text-xs text-muted-foreground">{tuning.notes.length - i}ª corda</div>
                  <div className="font-display text-3xl">{NOTE_NAMES[pc(n)]}<span className="text-base text-muted-foreground">{Math.floor(n / 12) - 1}</span></div>
                  <div className="text-xs text-muted-foreground">{noteIt(n)} · {midiToFreq(n).toFixed(1)} Hz</div>
                </button>
                <button onClick={() => toggleTone(n)} aria-label={`Ascolta ${noteLabel(n)}`}
                  className={`mt-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs ${playing === n ? "bg-primary text-primary-foreground" : "bg-secondary"}`}>
                  <Volume2 className="h-3.5 w-3.5" /> {playing === n ? "Ferma" : "Ascolta"}
                </button>
              </div>
            );
          })}
        </div>
      </section>
    </main>
  );
}
