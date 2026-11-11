import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { BookOpen, Heart, Mic2, Search } from "lucide-react";
import { songsQuery } from "@/lib/catalog";
import { useSetup } from "@/lib/setup";
import { useProgress } from "@/lib/progress";
import { difficultyLabel } from "@/lib/instrument-images";
import { AlbumCover } from "@/components/AlbumCover";
import { InstrumentTabs } from "@/components/InstrumentTabs";
import { FavoriteArtists } from "@/components/FavoriteArtists";

export const Route = createFileRoute("/brani/")({
  head: () => ({
    meta: [
      { title: "Libreria brani — Tono" },
      { name: "description", content: "Rock, metal, pop e classica: trova il brano da imparare per il tuo strumento." },
      { property: "og:title", content: "Libreria brani — Tono" },
      { property: "og:description", content: "Trova il brano da imparare per il tuo strumento." },
    ],
  }),
  component: Library,
});

function Library() {
  const { setup, ready } = useSetup();
  const [inst, setInst] = useState("chitarra");
  useEffect(() => { if (ready && setup.instrument) setInst(setup.instrument); }, [ready, setup.instrument]);
  const { data: songs = [], isLoading } = useQuery(songsQuery(inst));
  const [q, setQ] = useState("");
  const [genre, setGenre] = useState("Tutti");
  const [level, setLevel] = useState(0);
  const [mine, setMine] = useState<"tutti" | "preferiti" | "imparando" | "artisti">("tutti");
  const { progress } = useProgress();

  const genres = useMemo(() => ["Tutti", ...Array.from(new Set(songs.map((s) => s.genre)))], [songs]);
  const list = songs.filter(
    (s) =>
      (genre === "Tutti" || s.genre === genre) &&
      (!level || s.difficulty === level) &&
      (mine === "tutti" || mine === "artisti" || (mine === "preferiti" ? progress.favorites : progress.learning).includes(s.id)) &&
      `${s.title} ${s.artist}`.toLowerCase().includes(q.toLowerCase()),
  );

  return (
    <main className="mx-auto max-w-6xl px-5 pb-24 pt-28">
      <h1 className="font-display text-5xl md:text-7xl">Libreria.</h1>
      <div className="mt-10 flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
        <InstrumentTabs value={inst} onChange={(v) => { setInst(v); setGenre("Tutti"); }} />
        <label className="flex items-center gap-2 rounded-full bg-secondary px-4 py-2 md:w-72">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cerca brano o artista" className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground" />
        </label>
      </div>
      <div className="mt-6 flex flex-wrap gap-2">
        {([["tutti", "Tutti i brani", null], ["preferiti", "Preferiti", Heart], ["imparando", "Sto imparando", BookOpen], ["artisti", "Artisti e concerti", Mic2]] as const).map(([id, label, Icon]) => (
          <button key={id} onClick={() => setMine(id)}
            className={`inline-flex items-center gap-1.5 rounded-full border px-4 py-1.5 text-sm transition-colors ${mine === id ? "border-primary bg-primary text-primary-foreground" : "hover:border-foreground/40"}`}>
            {Icon && <Icon className="h-3.5 w-3.5" />} {label}
            {id === "artisti" ? progress.artists.length > 0 && <span className="opacity-70">{progress.artists.length}</span>
              : id !== "tutti" && <span className="opacity-70">{(id === "preferiti" ? progress.favorites : progress.learning).filter((x) => songs.some((s) => s.id === x)).length}</span>}
          </button>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {genres.map((g) => (
          <button key={g} onClick={() => setGenre(g)} className={`rounded-full border px-3 py-1 text-xs ${genre === g ? "border-primary text-primary" : "text-muted-foreground"}`}>{g}</button>
        ))}
        <span className="mx-2 w-px bg-border" />
        {[0, 1, 2, 3, 4, 5].map((l) => (
          <button key={l} onClick={() => setLevel(l)} className={`rounded-full border px-3 py-1 text-xs ${level === l ? "border-primary text-primary" : "text-muted-foreground"}`}>{l ? difficultyLabel[l] : "Ogni livello"}</button>
        ))}
      </div>

      {mine === "artisti" ? (
        <FavoriteArtists songs={songs} query={q} />
      ) : isLoading ? (
        <p className="mt-16 text-muted-foreground">Caricamento…</p>
      ) : (
        <div className="mt-12 grid grid-cols-2 gap-x-5 gap-y-10 sm:grid-cols-3 lg:grid-cols-5">
          {list.map((s, idx) => (
            <Link key={s.id} to="/brani/$songId" params={{ songId: s.id }} className="animate-card-in group" style={{ animationDelay: `${Math.min(idx, 20) * 35}ms` }}>
              <div className="relative overflow-hidden rounded-xl shadow-soft transition-all duration-500 group-hover:-translate-y-1 group-hover:shadow-glow">
                <AlbumCover artist={s.artist} album={s.album} className="aspect-square w-full transition-transform duration-700 group-hover:scale-105" />
                {progress.favorites.includes(s.id) && <Heart className="absolute right-2 top-2 h-5 w-5 fill-rose-400 text-rose-400 drop-shadow" />}
                <span className="glass absolute left-2 top-2 rounded-full px-2 py-0.5 font-mono text-[10px]">{"●".repeat(s.difficulty)}{"○".repeat(5 - s.difficulty)}</span>
              </div>
              <div className="mt-3 truncate text-sm font-medium">{s.title}</div>
              <div className="truncate text-xs text-muted-foreground">{s.artist} · {s.year}</div>
            </Link>
          ))}
          {!list.length && <p className="col-span-full text-muted-foreground">{mine === "preferiti" ? "Non hai ancora brani preferiti: aprine uno e tocca il cuore." : mine === "imparando" ? "Apri un brano e tocca \"Sto imparando\" per ritrovarlo qui." : "Nessun brano trovato."}</p>}
        </div>
      )}
    </main>
  );
}
