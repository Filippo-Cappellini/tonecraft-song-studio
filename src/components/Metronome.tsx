import { useEffect, useRef, useState } from "react";
import { Hand, Minus, Pause, Play, Plus, TrendingUp } from "lucide-react";
import { audio } from "@/lib/audio";
import { METERS, METRONOME_START, beatStrength, bpmFromTaps, clampBpm, MAX_BPM, MIN_BPM, trainerNext, trainerPlan, type Meter } from "@/lib/metronome";

// Click breve: più acuto e forte sul primo battito della battuta.
function click(ac: AudioContext, at: number, strength: 0 | 1 | 2) {
  const o = ac.createOscillator();
  const g = ac.createGain();
  o.frequency.value = strength === 2 ? 1600 : strength === 1 ? 1250 : 1000;
  const vol = strength === 2 ? 0.32 : strength === 1 ? 0.26 : 0.2;
  g.gain.setValueAtTime(0, at);
  g.gain.linearRampToValueAtTime(vol, at + 0.002);
  g.gain.exponentialRampToValueAtTime(0.001, at + 0.06);
  o.connect(g).connect(ac.destination);
  o.start(at);
  o.stop(at + 0.07);
}

/**
 * Metronomo preciso: i click sono programmati in anticipo sull'orologio audio, non con un timer,
 * così non va fuori tempo. Con tap tempo, tempi diversi e allenamento di velocità.
 * `target`: velocità a cui arrivare con l'allenamento (per un brano, i suoi BPM originali).
 */
export function Metronome({ initialBpm, target }: { initialBpm: number; target?: number | undefined }) {
  const [bpm, setBpmState] = useState(() => clampBpm(initialBpm));
  const [on, setOn] = useState(false);
  const [meter, setMeter] = useState<Meter>(METERS[2]);
  const [beat, setBeat] = useState(-1);
  const [trainer, setTrainer] = useState(false);
  const plan = trainerPlan(initialBpm, target);
  // Allenamento regolabile: di quanto sale, ogni quante battute, fino a che velocità.
  const [step, setStep] = useState(5);
  const [everyBars, setEveryBars] = useState(4);
  const [goal, setGoal] = useState(plan.goal);

  // Il programmatore legge sempre i valori attuali senza ripartire da capo.
  const live = useRef({ bpm, meter, trainer, goal, step, everyBars });
  live.current = { bpm, meter, trainer, goal, step, everyBars };
  const setBpm = (v: number) => {
    const b = clampBpm(v);
    live.current.bpm = b;
    setBpmState(b);
  };

  useEffect(() => {
    if (!on) {
      setBeat(-1);
      return;
    }
    window.dispatchEvent(new Event(METRONOME_START));
    const ac = audio();
    let next = ac.currentTime + 0.06;
    let i = 0;
    let bar = 0;
    const timers = new Set<number>();
    const schedule = () => {
      // Con la scheda in secondo piano il browser rallenta i timer: si programma più avanti.
      const ahead = document.hidden ? 1.5 : 0.12;
      while (next < ac.currentTime + ahead) {
        const { meter: m, trainer: t, goal: g, step: st, everyBars: eb } = live.current;
        const b = i % m.beats;
        click(ac, next, beatStrength(m, b));
        const id = window.setTimeout(() => { timers.delete(id); setBeat(b); }, Math.max(0, (next - ac.currentTime) * 1000));
        timers.add(id);
        if (b === m.beats - 1) {
          bar++;
          if (t) {
            const nb = trainerNext(live.current.bpm, bar, g, { step: st, everyBars: eb });
            if (nb !== live.current.bpm) setBpm(nb);
          }
        }
        next += 60 / live.current.bpm;
        i++;
      }
    };
    schedule();
    const loop = window.setInterval(schedule, 25);
    return () => {
      window.clearInterval(loop);
      timers.forEach((t) => window.clearTimeout(t));
    };
  }, [on]);

  const taps = useRef<number[]>([]);
  const tap = () => {
    taps.current = [...taps.current, performance.now()].slice(-8);
    const b = bpmFromTaps(taps.current);
    if (b) setBpm(b);
  };

  const toggleTrainer = () => {
    if (!trainer && bpm >= goal) setBpm(clampBpm(goal * 0.7));
    setTrainer((v) => !v);
  };

  const sel = "rounded-full border bg-background/60 px-2 py-0.5 font-mono text-foreground";
  const btn = "flex h-9 w-9 shrink-0 items-center justify-center rounded-full border transition-colors hover:border-foreground/40";
  return (
    <div className="space-y-3 rounded-2xl bg-secondary/60 p-3">
      <div className="flex items-center gap-3">
        <button onClick={() => setOn((v) => !v)} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-transform active:scale-95" aria-label={on ? "Ferma metronomo" : "Avvia metronomo"}>
          {on ? <Pause className="h-4 w-4" /> : <Play className="ml-0.5 h-4 w-4" />}
        </button>
        <div className="flex gap-1.5" aria-hidden>
          {Array.from({ length: meter.beats }, (_, b) => (
            <span key={b} className={`rounded-full transition-colors ${beatStrength(meter, b) ? "h-2.5 w-2.5" : "h-2 w-2"} ${on && beat === b ? "bg-primary" : "bg-muted-foreground/30"}`} />
          ))}
        </div>
        <button onClick={() => setBpm(bpm - 1)} className={btn} aria-label="Più lento"><Minus className="h-3.5 w-3.5" /></button>
        <input type="range" min={MIN_BPM} max={MAX_BPM} value={bpm} onChange={(e) => setBpm(+e.target.value)} className="min-w-0 flex-1 accent-[var(--primary)]" aria-label="BPM" />
        <button onClick={() => setBpm(bpm + 1)} className={btn} aria-label="Più veloce"><Plus className="h-3.5 w-3.5" /></button>
        <span className="w-16 shrink-0 text-right font-mono text-sm">{bpm} bpm</span>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <div className="inline-flex rounded-full bg-background/60 p-0.5">
          {METERS.map((m) => (
            <button key={m.id} onClick={() => setMeter(m)}
              className={`rounded-full px-2.5 py-1 font-mono transition-colors ${meter.id === m.id ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"}`}>
              {m.id}
            </button>
          ))}
        </div>
        <button onClick={tap} className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 hover:border-foreground/40" title="Tocca a tempo almeno due volte">
          <Hand className="h-3.5 w-3.5" /> Tap tempo
        </button>
        <button onClick={toggleTrainer}
          className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 transition-colors ${trainer ? "border-emerald-400/60 bg-emerald-500/15 text-emerald-300" : "hover:border-foreground/40"}`}
          title="Il tempo sale da solo mentre suoni">
          <TrendingUp className="h-3.5 w-3.5" /> Allenamento velocità
        </button>
        {trainer && (
          <span className="flex flex-wrap items-center gap-1.5 text-muted-foreground">
            <select value={step} onChange={(e) => setStep(+e.target.value)} aria-label="Aumento di BPM" className={sel}>
              {[1, 2, 3, 5, 10].map((v) => <option key={v} value={v}>+{v} BPM</option>)}
            </select>
            ogni
            <select value={everyBars} onChange={(e) => setEveryBars(+e.target.value)} aria-label="Ogni quante battute" className={sel}>
              {[1, 2, 4, 8, 16].map((v) => <option key={v} value={v}>{v} {v === 1 ? "battuta" : "battute"}</option>)}
            </select>
            fino a
            <input type="number" min={MIN_BPM} max={MAX_BPM} value={goal} aria-label="Velocità obiettivo"
              onChange={(e) => setGoal(clampBpm(+e.target.value || goal))} className={`${sel} w-16`} />
            {bpm >= goal ? <span className="text-emerald-300">· obiettivo raggiunto!</span> : null}
          </span>
        )}
      </div>
    </div>
  );
}
