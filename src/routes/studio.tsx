import { createFileRoute, Link } from "@tanstack/react-router";
import { FloatingNotes } from "@/components/FloatingNotes";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, BookOpen, ChevronLeft, ChevronRight, ExternalLink, Flame, GraduationCap, Heart, Newspaper, Shuffle, Sparkles, Timer } from "lucide-react";
import { useEffect, useState } from "react";
import ampWall from "@/assets/amp-wall.jpg";
import { useSetup } from "@/lib/setup";
import { instrumentQuery, legendsQuery, pathsQuery, songsQuery } from "@/lib/catalog";
import { getMusicNews } from "@/lib/news.functions";
import { lastWeek, streak, useProgress } from "@/lib/progress";
import { BackupBar } from "@/components/BackupBar";
import { instrumentImages } from "@/lib/instrument-images";
import { AlbumCover } from "@/components/AlbumCover";
import { AmpArt } from "@/components/AmpArt";

export const Route = createFileRoute("/studio")({
  head: () => ({
    meta: [
      { title: "Il tuo studio — Tono" },
      { name: "description", content: "Il tuo setup, i brani consigliati e gli esercizi." },
      { property: "og:title", content: "Il tuo studio — Tono" },
      { property: "og:description", content: "Setup, brani consigliati ed esercizi." },
    ],
  }),
  component: Studio,
});

function Studio() {
  const { setup, ready } = useSetup();
  const inst = useQuery({ ...instrumentQuery(setup.instrument ?? ""), enabled: !!setup.instrument });
  const songs = useQuery({ ...songsQuery(setup.instrument ?? ""), enabled: !!setup.instrument });

  if (!ready) return <main className="min-h-screen" />;
  if (!setup.instrument)
    return (
      <main className="flex min-h-screen flex-col items-center justify-center px-5 text-center">
        <h1 className="font-display text-4xl">Prima scegli uno strumento.</h1>
        <Link to="/" hash="strumenti" className="mt-6 rounded-full bg-primary px-6 py-3 text-sm text-primary-foreground">Scegli</Link>
      </main>
    );

  const model = inst.data?.models.find((m) => m.id === setup.model);
  const brand = inst.data?.brands.find((b) => b.id === setup.brand);
  const amp = inst.data?.amps.find((a) => a.id === setup.amp);
  return <StudioBody instrument={setup.instrument} model={model?.name} brand={brand?.name} amp={amp ? `${amp.brand} ${amp.name}` : undefined} songs={songs.data ?? []} ampId={amp?.id} />;
}

type SongLite = { id: string; title: string; artist: string; album: string; difficulty: number };

function StudioBody({ instrument, model, brand, amp, songs, ampId }: { instrument: string; model?: string | undefined; brand?: string | undefined; amp?: string | undefined; songs: SongLite[]; ampId?: string | undefined }) {
  const { progress } = useProgress();
  // Consigli: brani non ancora iniziati, vicini al livello di quelli che stai imparando (o i più facili).
  const known = new Set([...progress.learning, ...progress.favorites]);
  const learningLevels = songs.filter((s) => progress.learning.includes(s.id)).map((s) => s.difficulty);
  const level = learningLevels.length ? Math.max(...learningLevels) : 1;
  const picks = songs
    .filter((s) => !known.has(s.id))
    .sort((a, b) => Math.abs(a.difficulty - level) - Math.abs(b.difficulty - level) || a.difficulty - b.difficulty)
    .slice(0, 6);

  return (
    <main>
      <section className="grain relative flex min-h-[70svh] items-end overflow-hidden">
        <img src={instrumentImages[instrument]} alt="" className="animate-slow-zoom absolute inset-0 h-full w-full object-cover opacity-60" />
        <div className="bg-scrim absolute inset-0" />
        <FloatingNotes variant="section" />
        <div className="relative mx-auto w-full max-w-6xl px-5 pb-16">
          <p className="text-sm uppercase tracking-[0.3em] text-primary">Il tuo setup</p>
          <h1 className="mt-3 font-display text-4xl md:text-7xl">{brand} {model}</h1>
          {amp && <p className="mt-3 text-lg text-muted-foreground">nel {amp}</p>}
          {ampId && <AmpArt ampId={ampId} className="animate-rise mt-6 block h-24 w-56" />}
          <Link to="/strumento/$id" params={{ id: instrument }} className="mt-6 inline-block text-sm text-primary hover:underline">Modifica setup</Link>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-5 px-5 py-20 md:grid-cols-2">
        <Link to="/brani" className="group relative overflow-hidden rounded-3xl bg-card p-10 shadow-soft">
          <h2 className="font-display text-3xl">Libreria brani</h2>
          <p className="mt-2 text-muted-foreground">{songs.length || "…"} brani con impostazioni del suono.</p>
          <ArrowRight className="mt-8 h-5 w-5 text-primary transition-transform group-hover:translate-x-1" />
        </Link>
        <Link to="/esercizi" className="group relative overflow-hidden rounded-3xl p-10 shadow-soft">
          <img src={ampWall} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover opacity-40" />
          <div className="relative">
            <h2 className="font-display text-3xl">Esercizi</h2>
            <p className="mt-2 text-muted-foreground">Tecnica, scale e ritmica con metronomo.</p>
            <ArrowRight className="mt-8 h-5 w-5 text-primary transition-transform group-hover:translate-x-1" />
          </div>
        </Link>
      </section>

      <ContinueCourse instrument={instrument} />

      <section className="mx-auto max-w-6xl px-5 pb-24">
        <h2 className="font-display text-3xl">{progress.learning.length ? "Il prossimo brano da imparare" : "Per iniziare"}</h2>
        <div className="mt-8 grid grid-cols-2 gap-5 md:grid-cols-3 lg:grid-cols-6">
          {picks.map((s) => (
            <Link key={s.id} to="/brani/$songId" params={{ songId: s.id }} className="group">
              <AlbumCover artist={s.artist} album={s.album} className="aspect-square w-full rounded-xl shadow-soft transition-transform duration-500 group-hover:scale-[1.04]" />
              <div className="mt-3 truncate text-sm">{s.title}</div>
              <div className="truncate text-xs text-muted-foreground">{s.artist}</div>
            </Link>
          ))}
        </div>
      </section>

      <MyProgress songs={songs} />
      <Legends />
      <News />
    </main>
  );
}

function ContinueCourse({ instrument }: { instrument: string }) {
  const { data: paths = [] } = useQuery(pathsQuery(instrument));
  const { progress, ready } = useProgress();
  if (!ready || !paths.length) return null;
  // Il primo corso non finito; se sono tutti finiti, l'ultimo.
  const path = paths.find((p) => p.lessons.some((l) => !progress.lessons.includes(l.id))) ?? paths.at(-1)!;
  const done = path.lessons.filter((l) => progress.lessons.includes(l.id)).length;
  const next = path.lessons.find((l) => !progress.lessons.includes(l.id));
  const pct = path.lessons.length ? (done / path.lessons.length) * 100 : 0;
  return (
    <section className="mx-auto max-w-6xl px-5 pb-20">
      <Link to="/corsi/$pathId" params={{ pathId: path.id }}
        className="group flex flex-col gap-6 rounded-3xl border border-primary/30 bg-[linear-gradient(135deg,color-mix(in_oklab,var(--primary)_18%,transparent),transparent_60%)] p-8 transition-all hover:border-primary/60 hover:shadow-glow md:flex-row md:items-center">
        <GraduationCap className="h-12 w-12 shrink-0 text-primary" />
        <div className="min-w-0 flex-1">
          <p className="text-xs uppercase tracking-widest text-primary">{done ? "Continua il corso" : "Inizia un corso"} · {path.title}</p>
          <h2 className="mt-2 font-display text-3xl">{next ? `Lezione ${path.lessons.indexOf(next) + 1}: ${next.title}` : "Corso completato!"}</h2>
          <div className="mt-4 flex items-center gap-3 text-xs text-muted-foreground">
            <div className="h-2 max-w-72 flex-1 overflow-hidden rounded-full bg-foreground/10">
              <div className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-primary" style={{ width: `${pct}%` }} />
            </div>
            {done} di {path.lessons.length}
          </div>
        </div>
        <ArrowRight className="h-6 w-6 shrink-0 text-primary transition-transform group-hover:translate-x-1" />
      </Link>
    </section>
  );
}

function MyProgress({ songs }: { songs: { id: string; title: string; artist: string; album: string }[] }) {
  const { progress, ready } = useProgress();
  if (!ready) return null;
  const days = lastWeek(progress);
  const week = days.reduce((t, d) => t + d.minutes, 0);
  const max = Math.max(10, ...days.map((d) => d.minutes));
  const run = streak(progress);
  const learning = songs.filter((s) => progress.learning.includes(s.id));
  return (
    <section className="mx-auto max-w-6xl px-5 pb-24">
      <h2 className="font-display text-3xl">I tuoi progressi</h2>
      <div className="mt-8 grid gap-4 md:grid-cols-[1fr_1fr_1.4fr]">
        <div className="rounded-3xl border bg-gradient-to-br from-orange-500/20 to-transparent p-6">
          <Flame className={`h-8 w-8 text-orange-400 ${run ? "animate-pulse" : "opacity-40"}`} />
          <div className="mt-3 font-display text-5xl">{run}</div>
          <p className="text-sm text-muted-foreground">{run === 1 ? "giorno di fila" : "giorni di fila"} con gli esercizi</p>
          <p className="mt-3 text-xs text-muted-foreground">{run ? "Continua così: fai almeno un esercizio anche domani." : "Fai un esercizio oggi per iniziare la tua serie."}</p>
        </div>
        <div className="rounded-3xl border bg-gradient-to-br from-emerald-500/20 to-transparent p-6">
          <Timer className="h-8 w-8 text-emerald-400" />
          <div className="mt-3 font-display text-5xl">{week}<span className="text-2xl text-muted-foreground"> min</span></div>
          <p className="text-sm text-muted-foreground">di esercizi negli ultimi 7 giorni</p>
          <div className="mt-4 flex h-16 items-end gap-1.5">
            {days.map((d) => (
              <div key={d.day} className="flex flex-1 flex-col items-center gap-1">
                <div className="w-full rounded-t bg-emerald-400/80 transition-all duration-700" style={{ height: `${Math.max(4, (d.minutes / max) * 48)}px`, opacity: d.minutes ? 1 : 0.25 }} title={`${d.minutes} min`} />
                <span className="text-[10px] text-muted-foreground">{d.label.slice(0, 2)}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-3xl border bg-gradient-to-br from-sky-500/20 to-transparent p-6">
          <div className="flex items-center justify-between">
            <BookOpen className="h-8 w-8 text-sky-400" />
            <span className="flex items-center gap-1.5 text-sm text-muted-foreground"><Heart className="h-4 w-4 text-rose-400" /> {progress.favorites.length} preferiti</span>
          </div>
          <p className="mt-3 font-medium">Brani che stai imparando</p>
          {learning.length ? (
            <ul className="mt-3 space-y-2">
              {learning.slice(0, 4).map((s) => (
                <li key={s.id}>
                  <Link to="/brani/$songId" params={{ songId: s.id }} className="flex items-center gap-3 rounded-xl p-1.5 hover:bg-secondary">
                    <AlbumCover artist={s.artist} album={s.album} className="h-10 w-10 shrink-0 rounded-lg" />
                    <span className="min-w-0"><span className="block truncate text-sm">{s.title}</span><span className="block truncate text-xs text-muted-foreground">{s.artist}</span></span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">Apri un brano e tocca "Sto imparando": lo ritrovi qui.</p>
          )}
        </div>
      </div>
      <Link to="/progressi" className="mt-4 inline-flex items-center gap-2 text-sm text-primary hover:underline">Calendario, obiettivo settimanale e statistiche <ArrowRight className="h-4 w-4" /></Link>
      <BackupBar />
    </section>
  );
}

// Colore per ruolo, per riconoscere subito di che strumento si parla.
const ROLE_COLOR: Record<string, string> = {
  Chitarra: "bg-orange-500/15 text-orange-300 ring-orange-500/30",
  Basso: "bg-sky-500/15 text-sky-300 ring-sky-500/30",
  Pianoforte: "bg-violet-500/15 text-violet-300 ring-violet-500/30",
  Batteria: "bg-rose-500/15 text-rose-300 ring-rose-500/30",
  Compositore: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30",
};
const roleColor = (r: string) => ROLE_COLOR[r] ?? "bg-amber-500/15 text-amber-300 ring-amber-500/30";

function Legends() {
  const { data: legends = [] } = useQuery(legendsQuery);
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (legends.length) setI(Math.floor(Math.random() * legends.length));
  }, [legends.length]);
  useEffect(() => {
    if (paused || legends.length < 2) return;
    const t = setInterval(() => setI((x) => (x + 1) % legends.length), 9000);
    return () => clearInterval(t);
  }, [paused, legends.length]);
  if (!legends.length) return null;
  const cur = legends[i % legends.length]!;
  const go = (d: number) => setI((x) => (x + d + legends.length) % legends.length);
  const random = () => setI((x) => (x + 1 + Math.floor(Math.random() * (legends.length - 1))) % legends.length);
  return (
    <section className="mx-auto max-w-6xl px-5 pb-24">
      <h2 className="flex items-center gap-3 font-display text-3xl"><Sparkles className="h-7 w-7 text-primary" /> Lo sapevi? I grandi della musica</h2>
      <div onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}
        className="relative mt-8 overflow-hidden rounded-3xl border border-primary/30 bg-[linear-gradient(135deg,color-mix(in_oklab,var(--primary)_16%,transparent),transparent_65%)] p-8 md:p-12">
        <div key={cur.id} className="animate-card-in max-w-3xl">
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span className={`rounded-full px-3 py-1 text-xs uppercase tracking-wider ring-1 ${roleColor(cur.role)}`}>{cur.role}</span>
            <span className="text-muted-foreground">{cur.person}{cur.year ? ` · ${cur.year}` : ""}</span>
          </div>
          <h3 className="mt-4 font-display text-3xl md:text-5xl">{cur.title}</h3>
          <p className="mt-5 text-lg leading-relaxed text-muted-foreground">{cur.fact}</p>
        </div>
        <div className="mt-8 flex items-center justify-between gap-4">
          <div className="flex min-w-0 flex-1 items-center gap-3 text-sm text-muted-foreground">
            <span className="font-mono">{(i % legends.length) + 1} / {legends.length}</span>
            <div className="h-1 max-w-48 flex-1 overflow-hidden rounded-full bg-foreground/10">
              <div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${(((i % legends.length) + 1) / legends.length) * 100}%` }} />
            </div>
          </div>
          <div className="flex shrink-0 gap-2">
            <button onClick={random} className="inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm hover:bg-secondary"><Shuffle className="h-4 w-4" /> Un'altra a caso</button>
            <button onClick={() => go(-1)} aria-label="Precedente" className="rounded-full border p-2 hover:bg-secondary"><ChevronLeft className="h-5 w-5" /></button>
            <button onClick={() => go(1)} aria-label="Successiva" className="rounded-full border p-2 hover:bg-secondary"><ChevronRight className="h-5 w-5" /></button>
          </div>
        </div>
      </div>
    </section>
  );
}

const SOURCE_COLOR: Record<string, string> = {
  "Rolling Stone Italia": "bg-red-500/15 text-red-300",
  Rockol: "bg-sky-500/15 text-sky-300",
};

const ago = (iso: string) => {
  const h = Math.round((Date.now() - new Date(iso).getTime()) / 3600000);
  if (h < 1) return "adesso";
  if (h < 24) return `${h} ${h === 1 ? "ora" : "ore"} fa`;
  const d = Math.round(h / 24);
  return d === 1 ? "ieri" : `${d} giorni fa`;
};

function News() {
  const { data: news = [], isLoading, isError } = useQuery({
    queryKey: ["music-news"],
    queryFn: () => getMusicNews(),
    staleTime: 30 * 60 * 1000,
  });
  return (
    <section className="mx-auto max-w-6xl px-5 pb-24">
      <h2 className="flex items-center gap-3 font-display text-3xl"><Newspaper className="h-7 w-7 text-primary" /> Notizie dal mondo della musica</h2>
      <p className="mt-2 text-sm text-muted-foreground">Le ultime notizie da Rolling Stone Italia e Rockol, aggiornate in automatico. Foto e articoli sono delle rispettive testate.</p>
      {isLoading ? (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((k) => <div key={k} className="h-72 animate-pulse rounded-2xl bg-card" />)}
        </div>
      ) : isError || !news.length ? (
        <p className="mt-8 text-muted-foreground">Le notizie non sono disponibili in questo momento.</p>
      ) : (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {news.map((n, k) => (
            <a key={n.link} href={n.link} target="_blank" rel="noreferrer" style={{ animationDelay: `${k * 60}ms` }}
              className="animate-card-in group flex flex-col overflow-hidden rounded-2xl border bg-card/60 transition-all hover:-translate-y-1 hover:border-foreground/30 hover:bg-card hover:shadow-glow">
              {n.image && (
                <div className="aspect-video overflow-hidden bg-secondary">
                  <img src={n.image} alt="" loading="lazy" referrerPolicy="no-referrer"
                    onError={(e) => { e.currentTarget.parentElement!.style.display = "none"; }}
                    className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105" />
                </div>
              )}
              <div className="flex flex-1 flex-col p-5">
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className={`rounded-full px-2.5 py-0.5 ${SOURCE_COLOR[n.source] ?? "bg-primary/15 text-primary"}`}>{n.source}</span>
                <span className="text-muted-foreground">{ago(n.date)}</span>
              </div>
              <h3 className="mt-3 font-medium leading-snug group-hover:text-primary">{n.title}</h3>
              {n.summary && <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">{n.summary}</p>}
              <span className="mt-auto flex items-center gap-1 pt-4 text-xs text-primary">Leggi l'articolo <ExternalLink className="h-3 w-3" /></span>
              </div>
            </a>
          ))}
        </div>
      )}
    </section>
  );
}
