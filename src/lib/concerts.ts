// Concerti degli artisti preferiti: link di ricerca sui siti di biglietteria ufficiali.
// Nessuna API e nessun dato copiato: le date le mostrano i siti stessi.
export type ConcertLink = { label: string; href: string; note: string };

export function concertLinks(artist: string): ConcertLink[] {
  const q = encodeURIComponent(artist.trim());
  return [
    { label: "TicketOne", href: `https://www.ticketone.it/search/?searchterm=${q}`, note: "Biglietti in Italia" },
    { label: "Ticketmaster", href: `https://www.ticketmaster.it/search?q=${q}`, note: "Biglietti in Italia ed Europa" },
    { label: "Songkick", href: `https://www.songkick.com/search?query=${q}&type=artists`, note: "Tour nel mondo" },
  ];
}

/** Artisti presenti nel catalogo, in ordine alfabetico, con il numero di brani. */
export function artistsOf(songs: { artist: string }[]) {
  const count = new Map<string, number>();
  for (const s of songs) count.set(s.artist, (count.get(s.artist) ?? 0) + 1);
  return [...count.entries()].map(([name, songs]) => ({ name, songs })).sort((a, b) => a.name.localeCompare(b.name, "it"));
}
