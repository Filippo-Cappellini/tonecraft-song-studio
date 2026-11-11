import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { BookOpen, ExternalLink, Gauge, Heart, Mic2, Music2, Play, Ticket } from "lucide-react";
import { instrumentQuery, songQuery } from "@/lib/catalog";
import { findOriginalTab } from "@/lib/tabs.functions";
import { useSetup } from "@/lib/setup";
import { useProgress } from "@/lib/progress";
import { parseKey, tuningFor } from "@/lib/theory";
import { difficultyLabel } from "@/lib/instrument-images";
import { AlbumCover, useCover } from "@/components/AlbumCover";
import { Knob } from "@/components/Knob";
import { Metronome } from "@/components/Metronome";
import { FloatingNotes } from "@/components/FloatingNotes";
import { Equalizer } from "@/components/Equalizer";
import { SongPreview } from "@/components/SongPreview";
import { concertLinks } from "@/lib/concerts";

export const Route = createFileRoute("/brani/$songId")({
  loader: async ({ context, params }) => {
    const d = await context.queryClient.ensureQueryData(songQuery(params.songId));
    if (!d.song) throw notFound();
    return { title: d.song.title, artist: d.song.artist };
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: `${loaderData?.title ?? "Brano"} — ${loaderData?.artist ?? ""} | Tono` },
      { name: "description", content: `Impara ${loaderData?.title} di ${loaderData?.artist}: suono, metronomo e spartito originale.` },
      { property: "og:title", content: `${loaderData?.title} — ${loaderData?.artist}` },
      { property: "og:description", content: "Impostazioni del suono, metronomo e spartito originale." },
    ],
  }),
  component: SongPage,
});

function SongPage() {
  const { songId } = Route.useParams();
  const { data } = useSuspenseQuery(songQuery(songId));
  const song = data.song!;
  const tone = data.tone;
  const cover = useCover(song.artist, song.album);
  const { setup } = useSetup();
  const inst = useQuery({ ...instrumentQuery(setup.instrument ?? ""), enabled: setup.instrument === song.instrument_id });
  const myModel = inst.data?.models.find((m) => m.id === setup.model);
  const myAmp = inst.data?.amps.find((a) => a.id === setup.amp);
  const origTab = useQuery({
    queryKey: ["original-tab", song.artist, song.title],
    queryFn: () => findOriginalTab({ data: { artist: song.artist, title: song.title } }),
    staleTime: Infinity,
  });
  const q = encodeURIComponent(`${song.artist} ${song.title}`);
  const isPiano = song.instrument_id === "pianoforte";
  const originalLinks = [
    ...(isPiano ? [] : [{ label: "Spartito originale su Songsterr", href: origTab.data?.url ?? `https://www.songsterr.com/?pattern=${q}`, primary: true }]),
    ...(isPiano
      ? [{ label: "Spartito su MuseScore", href: `https://musescore.com/sheetmusic?text=${q}`, primary: true }]
      : [{ label: "Ultimate Guitar", href: `https://www.ultimate-guitar.com/search.php?search_type=title&value=${q}`, primary: false }]),
    ...(isPiano ? [{ label: "Songsterr", href: `https://www.songsterr.com/?pattern=${q}`, primary: false }] : []),
  ];
  const stringed = song.instrument_id === "chitarra" || song.instrument_id === "basso";
  const { progress, toggleFavorite, toggleLearning, toggleArtist } = useProgress();
  const followsArtist = progress.artists.includes(song.artist);
  const isFav = progress.favorites.includes(song.id);
  const isLearning = progress.learning.includes(song.id);
  const key = parseKey(song.song_key);

  return (
    <main>
      <SongPreview key={song.id} artist={song.artist} title={song.title} />
      <section className="relative overflow-hidden pt-12">
        {cover.data?.url && <img src={cover.data.url} alt="" className="absolute inset-0 h-full w-full scale-125 object-cover opacity-50 blur-3xl" />}
        <div className="bg-scrim absolute inset-0" />
        <FloatingNotes variant="section" />
        <div className="relative mx-auto grid max-w-6xl items-end gap-10 px-5 py-20 md:grid-cols-[320px_1fr]">
          <AlbumCover artist={song.artist} album={song.album} className="animate-rise aspect-square w-full rounded-2xl shadow-soft" />
          <div className="animate-rise" style={{ animationDelay: "120ms" }}>
            <p className="flex items-center gap-3 text-sm uppercase tracking-[0.3em] text-primary"><Equalizer bpm={song.bpm} /> {song.genre}</p>
            <h1 className="mt-3 font-display text-5xl md:text-7xl">{song.title}</h1>
            <p className="mt-3 text-xl text-muted-foreground">{song.artist} · {song.album} ({song.year})</p>
            <div className="mt-6 flex flex-wrap gap-2 font-mono text-xs">
              {[difficultyLabel[song.difficulty], `${song.bpm} BPM`, song.song_key !== "—" && song.song_key, song.tuning !== "—" && song.tuning].filter(Boolean).map((t) => (
                <span key={t as string} className="glass rounded-full border px-3 py-1">{t}</span>
              ))}
            </div>
            <a href="#spartito" className="btn-shine mt-8 inline-flex items-center gap-2 rounded-full bg-primary px-7 py-3.5 text-sm font-medium text-primary-foreground shadow-glow transition-transform hover:scale-[1.03]">
              <Play className="h-4 w-4" /> Metronomo e spartito
            </a>
            <div className="mt-4 flex flex-wrap gap-2 text-sm">
              <button onClick={() => toggleFavorite(song.id)}
                className={`glass inline-flex items-center gap-2 rounded-full border px-4 py-2 transition-colors ${isFav ? "border-rose-400/60 text-rose-300" : "hover:border-foreground/40"}`}>
                <Heart className={`h-4 w-4 transition-transform ${isFav ? "scale-110 fill-rose-400 text-rose-400" : ""}`} /> {isFav ? "Nei preferiti" : "Preferito"}
              </button>
              <button onClick={() => toggleLearning(song.id)}
                className={`glass inline-flex items-center gap-2 rounded-full border px-4 py-2 transition-colors ${isLearning ? "border-sky-400/60 text-sky-300" : "hover:border-foreground/40"}`}>
                <BookOpen className="h-4 w-4" /> {isLearning ? "Lo sto imparando" : "Sto imparando"}
              </button>
              <button onClick={() => toggleArtist(song.artist)}
                className={`glass inline-flex items-center gap-2 rounded-full border px-4 py-2 transition-colors ${followsArtist ? "border-violet-400/60 text-violet-300" : "hover:border-foreground/40"}`}>
                <Mic2 className="h-4 w-4" /> {followsArtist ? "Segui l'artista ✓" : "Segui l'artista"}
              </button>
              {stringed && (
                <Link to="/accordatore" search={{ accordatura: tuningFor(song.tuning, song.instrument_id) }}
                  className="glass inline-flex items-center gap-2 rounded-full border px-4 py-2 hover:border-foreground/40">
                  <Gauge className="h-4 w-4" /> Accorda per questo brano
                </Link>
              )}
              {key && (
                <Link to="/accordi" search={{ vista: "scale", nota: key.root, scala: key.scale, strumento: (["chitarra", "basso", "pianoforte"] as const).find((x) => x === song.instrument_id) ?? "chitarra" }}
                  className="glass inline-flex items-center gap-2 rounded-full border px-4 py-2 hover:border-foreground/40">
                  <Music2 className="h-4 w-4" /> Scala del brano
                </Link>
              )}
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto grid max-w-6xl gap-6 px-5 py-16 lg:grid-cols-[1.3fr_1fr]">
        {tone && (
          <section className="rounded-3xl bg-card p-8 shadow-soft">
            <h2 className="font-display text-2xl">{stringed ? "Il suono dell'originale" : "Impostazioni del suono"}</h2>
            <p className="mt-1 text-sm text-muted-foreground">Riferimento: {tone.amp}{stringed && ` · pickup ${tone.pickup}`}</p>
            <div className="mt-8 grid grid-cols-3 gap-6 sm:grid-cols-6">
              <Knob label={stringed ? "Gain" : "Dinamica"} value={stringed ? tone.gain : 5} />
              <Knob label="Bass" value={tone.bass} />
              <Knob label="Middle" value={tone.mid} />
              <Knob label="Treble" value={tone.treble} />
              <Knob label="Presence" value={tone.presence} />
              <Knob label="Reverb" value={tone.reverb} />
            </div>
            <dl className="mt-8 space-y-3 text-sm">
              <div><dt className="text-muted-foreground">Effetti</dt><dd>{tone.effects}</dd></div>
              <div><dt className="text-muted-foreground">Consiglio</dt><dd>{tone.notes}</dd></div>
            </dl>
            {myModel && (
              <div className="mt-8 rounded-2xl border border-primary/30 bg-primary/5 p-5 text-sm">
                <div className="text-primary">Con il tuo setup</div>
                <p className="mt-1 text-muted-foreground">
                  Sulla {myModel.name} ({myModel.pickups}){myAmp && ` nel ${myAmp.brand} ${myAmp.name}`}:{" "}
                  {stringed && /emg|humbucker|burstbucker|490|dimarzio|duncan/i.test(myModel.pickups) && tone.gain <= 4
                    ? "hai pickup potenti: abbassa il gain di 1–2 punti e il volume della chitarra a 7 per restare vicino al crunch originale."
                    : stringed && /single|v-mod|noiseless|alnico/i.test(myModel.pickups) && tone.gain >= 7
                      ? "i single coil hanno meno uscita: alza il gain di 1–2 punti o aggiungi un overdrive davanti all'amplificatore."
                      : "le impostazioni qui sopra sono già un ottimo punto di partenza."}
                </p>
              </div>
            )}
          </section>
        )}

        <section className="space-y-6">
          <div className="rounded-3xl bg-card p-8 shadow-soft">
            <h2 id="spartito" className="scroll-mt-24 font-display text-2xl">Suona il brano</h2>
            <p className="mt-1 text-sm text-muted-foreground">Apri lo spartito originale e suona a tempo con il metronomo, già impostato a {song.bpm} BPM. Con “Allenamento velocità” parti più lento e arrivi al tempo del disco.</p>
            <div className="mt-5 flex flex-wrap gap-2">
              {originalLinks.map((l) => (
                <a key={l.label} href={l.href} target="_blank" rel="noreferrer"
                  className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm ${l.primary ? "bg-primary text-primary-foreground" : "border text-primary hover:bg-primary/10"}`}>
                  {l.label} <ExternalLink className="h-3.5 w-3.5" />
                </a>
              ))}
            </div>
            <div className="mt-5"><Metronome initialBpm={song.bpm} target={song.bpm} /></div>
          </div>
          {followsArtist && (
            <div className="rounded-3xl border border-violet-400/30 bg-violet-500/5 p-6">
              <h2 className="flex items-center gap-2 font-display text-xl"><Ticket className="h-5 w-5 text-violet-300" /> Concerti di {song.artist}</h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {concertLinks(song.artist).map((l) => (
                  <a key={l.label} href={l.href} target="_blank" rel="noreferrer" title={l.note}
                    className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs text-primary hover:bg-primary/10">
                    {l.label} <ExternalLink className="h-3 w-3" />
                  </a>
                ))}
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
