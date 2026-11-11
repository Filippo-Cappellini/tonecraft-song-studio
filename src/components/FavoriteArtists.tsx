import { Link } from "@tanstack/react-router";
import { ExternalLink, Heart, Ticket } from "lucide-react";
import { artistsOf, concertLinks } from "@/lib/concerts";
import { useProgress } from "@/lib/progress";
import { AlbumCover } from "@/components/AlbumCover";

type SongLite = { id: string; title: string; artist: string; album: string };

/** Artisti preferiti con i link per trovare i loro concerti, e sotto tutti gli artisti del catalogo da aggiungere. */
export function FavoriteArtists({ songs, query }: { songs: SongLite[]; query: string }) {
  const { progress, ready, toggleArtist } = useProgress();
  const all = artistsOf(songs).filter((a) => a.name.toLowerCase().includes(query.toLowerCase()));
  const favs = progress.artists;
  if (!ready) return null;

  return (
    <div className="mt-12 space-y-12">
      <section>
        <h2 className="flex items-center gap-2 font-display text-3xl"><Ticket className="h-7 w-7 text-primary" /> I tuoi artisti e i loro concerti</h2>
        <p className="mt-2 text-sm text-muted-foreground">Le date dei concerti si aprono sui siti di biglietteria ufficiali, sempre aggiornate.</p>
        {favs.length ? (
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {favs.map((name, i) => {
              const theirs = songs.filter((s) => s.artist === name);
              return (
                <article key={name} style={{ animationDelay: `${Math.min(i, 10) * 50}ms` }} className="animate-card-in flex gap-4 rounded-3xl border bg-card p-5 shadow-soft">
                  {theirs[0] ? <AlbumCover artist={name} album={theirs[0].album} className="h-20 w-20 shrink-0 rounded-2xl" /> : <div className="h-20 w-20 shrink-0 rounded-2xl bg-secondary" />}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="truncate font-display text-xl">{name}</h3>
                      <button onClick={() => toggleArtist(name)} aria-label={`Togli ${name} dagli artisti preferiti`} title="Togli dai preferiti">
                        <Heart className="h-5 w-5 fill-rose-400 text-rose-400" />
                      </button>
                    </div>
                    {theirs.length > 0 && (
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {theirs.slice(0, 3).map((s, k) => (
                          <span key={s.id}>{k > 0 && " · "}<Link to="/brani/$songId" params={{ songId: s.id }} className="hover:text-foreground hover:underline">{s.title}</Link></span>
                        ))}
                      </p>
                    )}
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {concertLinks(name).map((l) => (
                        <a key={l.label} href={l.href} target="_blank" rel="noreferrer" title={l.note}
                          className="inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs text-primary hover:bg-primary/10">
                          {l.label} <ExternalLink className="h-3 w-3" />
                        </a>
                      ))}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <p className="mt-6 rounded-2xl border border-dashed p-6 text-muted-foreground">Non hai ancora artisti preferiti: tocca il cuore accanto a un nome qui sotto, o “Segui l'artista” nella pagina di un brano.</p>
        )}
      </section>

      <section>
        <h2 className="font-display text-2xl">Tutti gli artisti</h2>
        <div className="mt-4 flex flex-wrap gap-2">
          {all.map((a) => {
            const on = favs.includes(a.name);
            return (
              <button key={a.name} onClick={() => toggleArtist(a.name)} aria-pressed={on}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors ${on ? "border-rose-400/60 bg-rose-500/10 text-rose-200" : "hover:border-foreground/40"}`}>
                <Heart className={`h-3.5 w-3.5 ${on ? "fill-rose-400 text-rose-400" : ""}`} /> {a.name}
                <span className="text-xs opacity-60">{a.songs}</span>
              </button>
            );
          })}
          {!all.length && <p className="text-muted-foreground">Nessun artista trovato.</p>}
        </div>
      </section>
    </div>
  );
}
