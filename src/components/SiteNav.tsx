import { Link, useRouterState } from "@tanstack/react-router";
import { Dumbbell, GraduationCap, Guitar, ListMusic, SlidersHorizontal, Wrench } from "lucide-react";
import { SiteSearch } from "@/components/SiteSearch";
import { StaffMenu } from "@/components/StaffMenu";
import { useSetup } from "@/lib/setup";

// Menu principale: voci grandi a forma di pulsante, con icona; quella della pagina aperta è evidenziata.
const item =
  "group inline-flex shrink-0 items-center gap-2 rounded-full border border-transparent px-3 py-2 text-sm font-medium text-muted-foreground transition-all hover:-translate-y-0.5 hover:border-border hover:bg-secondary hover:text-foreground sm:px-4 sm:text-base";
const active = {
  className: "border-primary! bg-primary! text-primary-foreground! shadow-glow",
};
const icon = "h-4 w-4 transition-transform group-hover:scale-110 sm:h-5 sm:w-5";

export function SiteNav() {
  const { setup } = useSetup();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const toolsActive = ["/attrezzi", "/accordatore", "/accordi", "/orecchio", "/base", "/tastiera", "/sessione"].some((p) => pathname.startsWith(p));
  return (
    <header className="glass fixed inset-x-0 top-0 z-50 border-b">
      <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-5">
        <Link to="/" className="shrink-0 font-display text-2xl tracking-tight">
          Tono<span className="text-primary">.</span>
        </Link>
        <div className="-mr-2 flex items-center gap-1 overflow-x-auto pr-2 sm:gap-2">
          {setup.instrument ? (
            <Link to="/strumento/$id" params={{ id: setup.instrument }} className={item} activeProps={active}>
              <Guitar className={icon} /> Strumento
            </Link>
          ) : (
            <Link to="/" hash="strumenti" className={item}>
              <Guitar className={icon} /> Strumento
            </Link>
          )}
          <Link to="/studio" className={item} activeProps={active}>
            <SlidersHorizontal className={icon} /> Studio
          </Link>
          <Link to="/brani" className={item} activeProps={active}>
            <ListMusic className={icon} /> Brani
          </Link>
          <Link to="/corsi" className={item} activeProps={active}>
            <GraduationCap className={icon} /> Corsi
          </Link>
          <Link to="/esercizi" className={item} activeProps={active}>
            <Dumbbell className={icon} /> Esercizi
          </Link>
          <Link to="/attrezzi" className={toolsActive ? `${item} ${active.className}` : item}>
            <Wrench className={icon} /> Attrezzi
          </Link>
          <SiteSearch />
          <StaffMenu itemClass={item} iconClass={icon} />
        </div>
      </nav>
    </header>
  );
}
