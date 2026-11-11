import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { ArrowRight } from "lucide-react";
import hero from "@/assets/hero-studio.jpg";
import ampWall from "@/assets/amp-wall.jpg";
import { instrumentsQuery } from "@/lib/catalog";
import { instrumentImages } from "@/lib/instrument-images";
import { Reveal } from "@/components/Reveal";
import { FloatingNotes } from "@/components/FloatingNotes";
import { Equalizer } from "@/components/Equalizer";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Tono — Scegli il tuo strumento e impara a suonare" },
      { name: "description", content: "Chitarra, basso, pianoforte o batteria: scegli modello e amplificatore, poi impara i brani con il suono dell'originale." },
      { property: "og:title", content: "Tono — Scegli il tuo strumento" },
      { property: "og:description", content: "Centinaia di modelli, impostazioni del suono, spartiti ed esercizi per imparare i brani." },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(instrumentsQuery),
  component: Index,
});

function Index() {
  const { data: instruments } = useSuspenseQuery(instrumentsQuery);
  return (
    <main>
      <section className="grain relative flex min-h-[100svh] items-end overflow-hidden">
        <img src={hero} alt="Chitarra appoggiata a un amplificatore valvolare" width={1920} height={1088} className="animate-slow-zoom absolute inset-0 h-full w-full object-cover" />
        <div className="bg-scrim-side absolute inset-0" />
        <div className="bg-scrim absolute inset-0" />
        <FloatingNotes variant="section" />
        <div className="relative mx-auto w-full max-w-6xl px-5 pb-24">
          <p className="animate-rise flex items-center gap-3 text-sm uppercase tracking-[0.3em] text-primary"><Equalizer bpm={110} /> Studio di pratica</p>
          <h1 className="animate-rise mt-4 max-w-3xl font-display text-5xl leading-[1.02] md:text-8xl" style={{ animationDelay: "120ms" }}>
            Il suono giusto,<br />nota per nota.
          </h1>
          <p className="animate-rise mt-6 max-w-lg text-lg text-muted-foreground" style={{ animationDelay: "240ms" }}>
            Scegli lo strumento, il modello e l'amplificatore. Poi impara i brani con le stesse impostazioni del disco.
          </p>
          <a href="#strumenti" className="btn-shine animate-rise mt-10 inline-flex items-center gap-2 rounded-full bg-primary px-7 py-3.5 text-sm font-medium text-primary-foreground shadow-glow transition-transform hover:scale-[1.03]" style={{ animationDelay: "360ms" }}>
            Inizia ora <ArrowRight className="h-4 w-4" />
          </a>
        </div>
      </section>

      <section id="strumenti" className="relative bg-background">
        <div className="mx-auto max-w-6xl px-5 py-28">
        <Reveal>
          <h2 className="font-display text-4xl md:text-6xl">Cosa suoni?</h2>
          <p className="mt-3 text-muted-foreground">Puoi cambiare strumento in qualsiasi momento.</p>
        </Reveal>
        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {instruments.map((i, idx) => (
            <Reveal key={i.id} delay={idx * 90}>
              <Link to="/strumento/$id" params={{ id: i.id }} className="group relative block aspect-[4/5] overflow-hidden rounded-3xl bg-card shadow-soft">
                <img src={instrumentImages[i.id]} alt={i.name} loading="lazy" width={1024} height={1280} className="absolute inset-0 h-full w-full object-cover transition-transform duration-[1.2s] ease-out group-hover:scale-105" />
                <div className="bg-scrim absolute inset-0" />
                <div className="absolute inset-x-0 bottom-0 p-6">
                  <h3 className="font-display text-2xl">{i.name}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{i.tagline}</p>
                  <span className="mt-4 inline-flex items-center gap-1 text-sm text-primary opacity-0 transition-opacity group-hover:opacity-100">
                    Scegli <ArrowRight className="h-3.5 w-3.5" />
                  </span>
                </div>
              </Link>
            </Reveal>
          ))}
        </div>
        </div>
      </section>

      <section className="relative overflow-hidden py-40">
        <img src={ampWall} alt="" loading="lazy" width={1920} height={1088} className="absolute inset-0 h-full w-full object-cover opacity-50" />
        <div className="bg-scrim absolute inset-0" />
        <FloatingNotes variant="section" />
        <div className="relative mx-auto grid max-w-6xl gap-16 px-5 md:grid-cols-3">
          {[
            ["01", "Il tuo setup", "Marca, modello e amplificatore: trovi il tuo in pochi secondi."],
            ["02", "Il suono del disco", "Gain, equalizzazione ed effetti per avvicinarti al suono originale."],
            ["03", "Suona e migliora", "Spartiti originali, metronomo ed esercizi guidati."],
          ].map(([n, t, d], idx) => (
            <Reveal key={n} delay={idx * 120}>
              <span className="font-mono text-sm text-primary">{n}</span>
              <h3 className="mt-3 font-display text-3xl">{t}</h3>
              <p className="mt-3 text-muted-foreground">{d}</p>
            </Reveal>
          ))}
        </div>
      </section>
    </main>
  );
}
