import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, BarChart3, Ear, Gauge, Grid3x3, Music2, Repeat, Timer } from "lucide-react";
import { Reveal } from "@/components/Reveal";

export const Route = createFileRoute("/attrezzi")({
  head: () => ({
    meta: [
      { title: "Attrezzi per musicisti — Tono" },
      { name: "description", content: "Accordatore, accordi e scale, orecchio, base per improvvisare, note sul manico e sessione guidata." },
      { property: "og:title", content: "Attrezzi per musicisti — Tono" },
      { property: "og:description", content: "Accordatore, accordi e scale, allenamento dell'orecchio." },
    ],
  }),
  component: Tools,
});

const TOOLS = [
  { to: "/accordatore", icon: Gauge, title: "Accordatore", text: "Accorda chitarra e basso con il microfono: standard, Drop D, mezzo tono sotto e altre.", color: "from-emerald-500/25" },
  { to: "/accordi", icon: Music2, title: "Accordi e scale", text: "Diagrammi degli accordi per chitarra, scale su manico e tastiera, accordi per pianoforte. Tutto da ascoltare.", color: "from-violet-500/25" },
  { to: "/orecchio", icon: Ear, title: "Allenamento dell'orecchio", text: "Gioca a riconoscere note, intervalli e accordi. Tre livelli, con il tuo record.", color: "from-sky-500/25" },
  { to: "/base", icon: Repeat, title: "Base per improvvisare", text: "Giri di accordi in loop in ogni tonalità, con batteria e basso. Ti mostra la scala da usare.", color: "from-orange-500/25" },
  { to: "/tastiera", icon: Grid3x3, title: "Note sul manico", text: "Gioca a trovare le note su chitarra e basso, dai primi tasti a tutto il manico.", color: "from-amber-500/25" },
  { to: "/sessione", icon: Timer, title: "Sessione guidata", text: "15, 30 o 60 minuti: riscaldamento, tecnica, orecchio e il tuo brano, con il timer.", color: "from-rose-500/25" },
  { to: "/progressi", icon: BarChart3, title: "I miei progressi", text: "Calendario della pratica, minuti per settimana e obiettivo settimanale.", color: "from-teal-500/25" },
] as const;

function Tools() {
  return (
    <main className="mx-auto max-w-6xl px-5 pb-24 pt-28">
      <h1 className="font-display text-5xl md:text-7xl">Attrezzi.</h1>
      <p className="mt-4 max-w-2xl text-muted-foreground">Quello che ti serve mentre suoni, sempre a portata di mano.</p>
      <div className="mt-12 grid gap-5 md:grid-cols-3">
        {TOOLS.map((t, i) => (
          <Reveal key={t.to} delay={i * 90}>
            <Link to={t.to} className={`group flex h-full flex-col rounded-3xl border bg-gradient-to-br ${t.color} to-transparent p-8 transition-all hover:-translate-y-1 hover:border-foreground/30 hover:shadow-glow`}>
              <t.icon className="h-10 w-10 text-primary transition-transform group-hover:scale-110" />
              <h2 className="mt-6 font-display text-3xl">{t.title}</h2>
              <p className="mt-3 flex-1 text-muted-foreground">{t.text}</p>
              <span className="mt-6 inline-flex items-center gap-2 text-sm text-primary">Apri <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" /></span>
            </Link>
          </Reveal>
        ))}
      </div>
    </main>
  );
}
