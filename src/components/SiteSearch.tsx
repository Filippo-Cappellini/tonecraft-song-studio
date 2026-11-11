import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { BarChart3, Dumbbell, Ear, Gauge, Grid3x3, Guitar, ListMusic, Music2, Repeat, Search, Sparkles, SlidersHorizontal, Timer, Wrench } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { searchIndexQuery } from "@/lib/catalog";

const INSTRUMENT = { chitarra: "Chitarra", basso: "Basso", pianoforte: "Pianoforte", batteria: "Batteria" } as Record<string, string>;

const PAGES = [
  { to: "/studio", label: "Il tuo studio", icon: SlidersHorizontal },
  { to: "/brani", label: "Libreria brani", icon: ListMusic },
  { to: "/esercizi", label: "Esercizi", icon: Dumbbell },
  { to: "/attrezzi", label: "Attrezzi", icon: Wrench },
  { to: "/accordatore", label: "Accordatore", icon: Gauge },
  { to: "/accordi", label: "Accordi e scale", icon: Music2 },
  { to: "/orecchio", label: "Allenamento dell'orecchio", icon: Ear },
  { to: "/base", label: "Base per improvvisare", icon: Repeat },
  { to: "/tastiera", label: "Note sul manico", icon: Grid3x3 },
  { to: "/sessione", label: "Sessione guidata", icon: Timer },
  { to: "/progressi", label: "I miei progressi", icon: BarChart3 },
] as const;

/** Ricerca unica del sito: brani, modelli, esercizi, curiosità e pagine. Si apre anche con Ctrl+K. */
export function SiteSearch() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { data } = useQuery({ ...searchIndexQuery, enabled: open });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setOpen((v) => !v); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const go = (fn: () => void) => { setOpen(false); fn(); };

  return (
    <>
      <button onClick={() => setOpen(true)} aria-label="Cerca nel sito"
        className="group inline-flex shrink-0 items-center gap-2 rounded-full border px-3 py-2 text-sm text-muted-foreground transition-all hover:-translate-y-0.5 hover:bg-secondary hover:text-foreground">
        <Search className="h-4 w-4 sm:h-5 sm:w-5" />
        <span className="hidden lg:inline">Cerca</span>
        <kbd className="hidden rounded border px-1.5 font-mono text-[10px] lg:inline">Ctrl K</kbd>
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="overflow-hidden p-0 sm:max-w-2xl">
          <DialogTitle className="sr-only">Cerca nel sito</DialogTitle>
          <Command className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-widest [&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-input]]:h-14 [&_[cmdk-item]]:py-2.5">
            <CommandInput placeholder="Cerca un brano, un modello, un esercizio, un musicista…" />
            <CommandList className="max-h-[60vh]">
              <CommandEmpty>{data ? "Nessun risultato." : "Caricamento…"}</CommandEmpty>
              <CommandGroup heading="Pagine">
                {PAGES.map((p) => (
                  <CommandItem key={p.to} value={`pagina ${p.label}`} onSelect={() => go(() => navigate({ to: p.to }))}>
                    <p.icon className="mr-2 h-4 w-4 text-primary" /> {p.label}
                  </CommandItem>
                ))}
              </CommandGroup>
              {data && (
                <>
                  <CommandGroup heading="Brani">
                    {data.songs.map((s) => (
                      <CommandItem key={s.id} value={`brano ${s.title} ${s.artist} ${s.id}`} onSelect={() => go(() => navigate({ to: "/brani/$songId", params: { songId: s.id } }))}>
                        <ListMusic className="mr-2 h-4 w-4 text-primary" />
                        <span className="truncate">{s.title} <span className="text-muted-foreground">· {s.artist}</span></span>
                        <span className="ml-auto shrink-0 text-xs text-muted-foreground">{INSTRUMENT[s.instrument_id]}</span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                  <CommandGroup heading="Strumenti e modelli">
                    {data.models.map((m) => (
                      <CommandItem key={m.key} value={`modello ${m.brand} ${m.name} ${m.key}`}
                        onSelect={() => go(() => navigate({ to: "/strumento/$id", params: { id: m.instrument }, search: { q: m.name } }))}>
                        <Guitar className="mr-2 h-4 w-4 text-primary" />
                        <span className="truncate"><span className="text-muted-foreground">{m.brand}</span> {m.name}</span>
                        <span className="ml-auto shrink-0 text-xs text-muted-foreground">{INSTRUMENT[m.instrument]}</span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                  <CommandGroup heading="Esercizi">
                    {data.exercises.map((e) => (
                      <CommandItem key={e.id} value={`esercizio ${e.title} ${e.category} ${e.id}`}
                        onSelect={() => go(() => navigate({ to: "/esercizi", search: { ex: e.id, strumento: e.instrument_id } }))}>
                        <Dumbbell className="mr-2 h-4 w-4 text-primary" />
                        <span className="truncate">{e.title} <span className="text-muted-foreground">· {e.category}</span></span>
                        <span className="ml-auto shrink-0 text-xs text-muted-foreground">{INSTRUMENT[e.instrument_id]}</span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                  {data.legends.length > 0 && (
                    <CommandGroup heading="Curiosità">
                      {data.legends.map((l) => (
                        <CommandItem key={l.id} value={`curiosita ${l.person} ${l.title} ${l.id}`} onSelect={() => go(() => navigate({ to: "/studio" }))}>
                          <Sparkles className="mr-2 h-4 w-4 text-primary" />
                          <span className="truncate">{l.person} <span className="text-muted-foreground">· {l.title}</span></span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  )}
                </>
              )}
            </CommandList>
          </Command>
        </DialogContent>
      </Dialog>
    </>
  );
}
