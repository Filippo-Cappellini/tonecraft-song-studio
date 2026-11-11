import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { CalendarDays, Flame, GraduationCap, Target, Timer, Trophy } from "lucide-react";
import { MAX_GOAL, MIN_GOAL, bestStreak, calendar, streak, totals, useProgress, weeklyTotals } from "@/lib/progress";
import { BackupBar } from "@/components/BackupBar";

export const Route = createFileRoute("/progressi")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "I miei progressi — Tono" },
      { name: "description", content: "Il calendario dei giorni in cui hai suonato, i minuti per settimana e il tuo obiettivo." },
      { property: "og:title", content: "I miei progressi — Tono" },
      { property: "og:description", content: "Calendario della pratica, minuti per settimana e obiettivi." },
    ],
  }),
  component: ProgressPage,
});

const GOALS = [60, 120, 180, 300];
// Intensità del colore nel calendario, come i quadratini di un diario di allenamento.
const shade = (m: number | null) =>
  m == null ? "bg-transparent" : m === 0 ? "bg-foreground/[0.07]" : m < 15 ? "bg-emerald-500/35" : m < 30 ? "bg-emerald-500/60" : m < 60 ? "bg-emerald-400/85" : "bg-emerald-300";
const dateIt = (k: string, opts: Intl.DateTimeFormatOptions) => {
  const [y, m, d] = k.split("-").map(Number) as [number, number, number];
  return new Date(y, m - 1, d).toLocaleDateString("it-IT", opts);
};

function ProgressPage() {
  const { progress, ready, setWeeklyGoal } = useProgress();
  const [custom, setCustom] = useState("");
  if (!ready) return <main className="min-h-screen" />;

  const cal = calendar(progress, 18);
  const weeks = weeklyTotals(progress, 8);
  const thisWeek = weeks.at(-1)!.minutes;
  const max = Math.max(30, ...weeks.map((w) => w.minutes), progress.weeklyGoal ?? 0);
  const all = totals(progress);
  const goal = progress.weeklyGoal;
  const pct = goal ? Math.min(100, Math.round((thisWeek / goal) * 100)) : 0;

  return (
    <main className="mx-auto max-w-5xl px-5 pb-24 pt-28">
      <h1 className="font-display text-5xl md:text-7xl">I miei progressi.</h1>
      <p className="mt-4 max-w-2xl text-muted-foreground">Esercizi, lezioni, sessioni guidate, giochi e basi: tutto quello che fai conta qui. I dati restano solo in questo browser.</p>

      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { icon: Flame, color: "text-orange-400", value: streak(progress), label: "giorni di fila adesso" },
          { icon: Trophy, color: "text-amber-300", value: bestStreak(progress), label: "giorni di fila: il tuo record" },
          { icon: Timer, color: "text-emerald-400", value: all.minutes, label: "minuti di pratica in tutto" },
          { icon: GraduationCap, color: "text-sky-400", value: progress.lessons.length, label: "lezioni dei corsi completate" },
        ].map((s) => (
          <div key={s.label} className="rounded-3xl border p-6">
            <s.icon className={`h-7 w-7 ${s.color}`} />
            <div className="mt-3 font-display text-4xl">{s.value}</div>
            <p className="text-sm text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Obiettivo settimanale */}
      <section className="mt-8 rounded-3xl bg-card p-6 shadow-soft md:p-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="flex items-center gap-2 text-xs uppercase tracking-widest text-primary"><Target className="h-4 w-4" /> Obiettivo della settimana</p>
            <h2 className="mt-2 font-display text-3xl">
              {goal ? <>{thisWeek} di {goal} minuti</> : "Scegli un obiettivo"}
            </h2>
            {goal ? <p className="mt-1 text-sm text-muted-foreground">{pct >= 100 ? "Obiettivo raggiunto: ottimo lavoro!" : `Ti mancano ${goal - thisWeek} minuti entro domenica.`}</p> : null}
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            {GOALS.map((g) => (
              <button key={g} onClick={() => setWeeklyGoal(g)} className={`rounded-full border px-4 py-1.5 ${goal === g ? "border-primary bg-primary text-primary-foreground" : "hover:border-foreground/40"}`}>
                {g >= 60 && g % 60 === 0 ? `${g / 60} ${g === 60 ? "ora" : "ore"}` : `${g} min`}
              </button>
            ))}
            <form onSubmit={(e) => { e.preventDefault(); const n = Number(custom); if (n >= MIN_GOAL) { setWeeklyGoal(n); setCustom(""); } }} className="flex items-center gap-1">
              <input type="number" min={MIN_GOAL} max={MAX_GOAL} value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="min" aria-label="Minuti a settimana"
                className="w-20 rounded-full border bg-background px-3 py-1.5" />
              <button className="rounded-full border px-3 py-1.5 hover:border-foreground/40">OK</button>
            </form>
            {goal ? <button onClick={() => setWeeklyGoal(null)} className="text-xs text-muted-foreground hover:text-foreground">Togli</button> : null}
          </div>
        </div>
        {goal ? (
          <div className="mt-5 h-3 overflow-hidden rounded-full bg-foreground/10">
            <div className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-primary transition-all duration-700" style={{ width: `${pct}%` }} />
          </div>
        ) : null}

        {/* Minuti per settimana */}
        <div className="mt-8 flex h-40 items-end gap-2">
          {weeks.map((w, i) => (
            <div key={w.from} className="relative flex flex-1 flex-col items-center gap-1.5">
              <span className="font-mono text-[10px] text-muted-foreground">{w.minutes || ""}</span>
              <div className={`w-full rounded-t-lg transition-all duration-700 ${i === weeks.length - 1 ? "bg-primary" : "bg-emerald-400/70"}`}
                style={{ height: `${Math.max(3, (w.minutes / max) * 110)}px`, opacity: w.minutes ? 1 : 0.3 }} title={`${w.minutes} minuti`} />
              <span className="text-[10px] text-muted-foreground">{dateIt(w.from, { day: "numeric", month: "short" })}</span>
            </div>
          ))}
        </div>
        {goal ? <p className="mt-2 text-xs text-muted-foreground">Minuti per settimana, da lunedì. La barra arancione è la settimana in corso.</p> : null}
      </section>

      {/* Calendario */}
      <section className="mt-8 rounded-3xl border p-6 md:p-8">
        <h2 className="flex items-center gap-2 font-display text-2xl"><CalendarDays className="h-6 w-6 text-primary" /> Calendario</h2>
        <p className="mt-1 text-sm text-muted-foreground">Le ultime 18 settimane: {all.activeDays} giorni in cui hai suonato in tutto.</p>
        <div className="mt-6 flex gap-2 overflow-x-auto pb-2">
          <div className="grid grid-rows-7 gap-1 pt-5 text-[10px] text-muted-foreground">
            {["lun", "", "mer", "", "ven", "", "dom"].map((d, i) => <span key={i} className="h-3.5 leading-[14px]">{d}</span>)}
          </div>
          {cal.map((week, w) => (
            <div key={w} className="flex flex-col gap-1">
              <span className="h-4 text-[10px] text-muted-foreground">{week[0]!.day.endsWith("-01") || (w === 0) || Number(week[0]!.day.slice(8)) <= 7 ? dateIt(week[0]!.day, { month: "short" }) : ""}</span>
              {week.map((d) => (
                <span key={d.day} className={`h-3.5 w-3.5 rounded-[3px] ${shade(d.minutes)}`}
                  title={d.minutes == null ? "" : `${dateIt(d.day, { weekday: "long", day: "numeric", month: "long" })}: ${d.minutes} minuti`} />
              ))}
            </div>
          ))}
        </div>
        <div className="mt-3 flex items-center gap-1.5 text-[10px] text-muted-foreground">
          Meno {[0, 10, 20, 45, 90].map((m) => <span key={m} className={`h-3 w-3 rounded-[3px] ${shade(m)}`} />)} Più
        </div>
      </section>

      <div className="mt-8 flex flex-wrap gap-2 text-sm">
        <Link to="/sessione" className="rounded-full bg-primary px-5 py-2.5 font-medium text-primary-foreground">Fai una sessione guidata</Link>
        <Link to="/esercizi" className="rounded-full border px-5 py-2.5 hover:border-foreground/40">Esercizi di oggi</Link>
      </div>
      <BackupBar />
    </main>
  );
}
