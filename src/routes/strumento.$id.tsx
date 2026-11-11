import { createFileRoute, useNavigate, notFound } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Check, Search, X } from "lucide-react";
import ampWall from "@/assets/amp-wall.jpg";
import { instrumentQuery } from "@/lib/catalog";
import { readSetup, saveSetup } from "@/lib/setup";
import { Reveal } from "@/components/Reveal";
import { AmpArt } from "@/components/AmpArt";

export const Route = createFileRoute("/strumento/$id")({
  ssr: false,
  validateSearch: (raw: Record<string, unknown>): { q?: string } => {
    const { q } = raw as { q?: unknown };
    return typeof q === "string" ? { q } : {};
  },
  head: () => ({
    meta: [
      { title: "Scegli marca, modello e amplificatore — Tono" },
      { name: "description", content: "Configura il tuo strumento: centinaia di modelli di marca e amplificatore." },
      { property: "og:title", content: "Configura il tuo strumento — Tono" },
      { property: "og:description", content: "Marca, modello e amplificatore." },
    ],
  }),
  loader: async ({ context, params }) => {
    const d = await context.queryClient.ensureQueryData(instrumentQuery(params.id));
    if (!d.instrument) throw notFound();
  },
  component: Configure,
});

// Nomi chiari per il tipo di corpo, per chi conosce la forma ma non il nome del modello.
const SHAPE_LABEL: Record<string, string> = {
  strat: "Stratocaster", tele: "Telecaster", lespaul: "Les Paul", sg: "SG", superstrat: "Superstrat",
  explorer: "Explorer", flyingv: "Flying V", iceman: "Iceman", jem: "JEM", offset: "Offset", snakebyte: "Snakebyte",
  hollow: "Semi-acustica", doublecut: "Doppia spalla", acoustic: "Acustica", pbass: "Precision", jbass: "Jazz Bass",
  tbird: "Thunderbird", grand: "Pianoforte a coda", upright: "Pianoforte verticale", stage: "Stage piano", kit: "Batteria",
  stingray: "StingRay", modern: "Corpo moderno", ricky: "Rickenbacker", violin: "Violin bass",
  digital: "Pianoforte digitale", synth: "Synth", arranger: "Tastiera arranger", workstation: "Workstation",
  controller: "Tastiera MIDI", ekit: "Batteria elettronica",
};

type Model = { id: string; brand_id: string; name: string; shape: string; color: string; pickups: string; description: string };
type Variant = { id: string; label: string; color: string };
type Group = { key: string; brandId: string; brandName: string; name: string; shape: string; pickups: string; description: string; variants: Variant[] };

const fold = (x: string) => x.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();

function Configure() {
  const { id } = Route.useParams();
  const { data } = useSuspenseQuery(instrumentQuery(id));
  const { instrument, brands, models, amps } = data;
  const navigate = useNavigate();
  const [brand, setBrand] = useState<string>("all");
  const [shape, setShape] = useState<string>("all");
  const [model, setModel] = useState<string | undefined>();
  const [amp, setAmp] = useState<string | undefined>(amps[0]?.id);
  const search = Route.useSearch();
  const [q, setQ] = useState(search.q ?? "");
  useEffect(() => { if (search.q) setQ(search.q); }, [search.q]);
  const [step, setStep] = useState<"model" | "amp">("model");

  useEffect(() => {
    const s = readSetup();
    if (s.instrument === id) {
      if (s.model) setModel(s.model);
      if (s.amp) setAmp(s.amp);
    }
  }, [id]);

  // Un modello = una scheda; i colori sono scelte dentro la scheda (non righe separate).
  const groups = useMemo(() => {
    const brandName = new Map(brands.map((b) => [b.id, b.name]));
    const map = new Map<string, Group>();
    for (const m of models as Model[]) {
      const [base, label] = m.name.split(" · ");
      const key = `${m.brand_id}|${base}`;
      let g = map.get(key);
      if (!g) {
        g = { key, brandId: m.brand_id, brandName: brandName.get(m.brand_id) ?? "", name: base!, shape: m.shape, pickups: m.pickups, description: m.description, variants: [] };
        map.set(key, g);
      }
      g.variants.push({ id: m.id, label: label ?? "Finitura di serie", color: m.color });
    }
    return [...map.values()];
  }, [models, brands]);

  const shapes = useMemo(() => [...new Set(groups.map((g) => g.shape))], [groups]);
  const words = fold(q).split(" ").filter(Boolean);
  const visible = groups.filter((g) => {
    if (words.length) {
      const hay = fold(`${g.brandName} ${g.name} ${SHAPE_LABEL[g.shape] ?? ""} ${g.pickups}`);
      if (!words.every((w) => hay.includes(w))) return false;
    } else if (brand !== "all" && g.brandId !== brand) return false;
    return shape === "all" || g.shape === shape;
  });
  // I modelli sono divisi per marca, così l'elenco resta ordinato.
  const sections = brands
    .map((b) => ({ brand: b, items: visible.filter((g) => g.brandId === b.id) }))
    .filter((s) => s.items.length);

  const current = (models as Model[]).find((m) => m.id === model);
  const currentGroup = current && groups.find((g) => g.variants.some((v) => v.id === current.id));
  const currentVariant = currentGroup?.variants.find((v) => v.id === current?.id);
  const currentBrand = brands.find((b) => b.id === current?.brand_id);
  const countFor = (bid: string) => groups.filter((g) => g.brandId === bid && (shape === "all" || g.shape === shape)).length;

  const finish = () => {
    if (!current) return;
    if (step === "model" && instrument!.has_amp) { setStep("amp"); window.scrollTo({ top: 0 }); return; }
    saveSetup({ instrument: id, brand: current.brand_id, model: current.id, amp: instrument!.has_amp ? amp : undefined });
    navigate({ to: "/studio" });
  };

  const chip = (active: boolean) =>
    `shrink-0 rounded-full border px-4 py-2 text-sm transition-colors ${active ? "border-primary bg-primary text-primary-foreground" : "hover:border-foreground/40"}`;

  return (
    <main className="pt-12">
      {step === "model" ? (<>
      <section className="mx-auto max-w-6xl px-5 pt-16">
        <p className="text-sm uppercase tracking-[0.3em] text-primary">{instrument!.name}{instrument!.has_amp ? " · Passo 1 di 2" : ""}</p>
        <h1 className="mt-3 font-display text-4xl md:text-6xl">Qual è il tuo modello?</h1>
        <p className="mt-4 max-w-2xl text-muted-foreground">Scrivi il nome se lo conosci, oppure filtra per marca e per forma.</p>

        <div className="relative mt-8">
          <Search className="pointer-events-none absolute left-5 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)}
            placeholder="Es. Snakebyte, Les Paul, RG550, Fender Telecaster…"
            className="w-full rounded-2xl border bg-card py-4 pl-14 pr-12 text-lg outline-none focus:border-primary" />
          {q && (
            <button onClick={() => setQ("")} aria-label="Cancella ricerca"
              className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground hover:text-foreground">
              <X className="h-5 w-5" />
            </button>
          )}
        </div>

        {!q && (
          <div className="mt-6">
            <p className="mb-2 text-xs uppercase tracking-widest text-muted-foreground">Marca</p>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => setBrand("all")} className={chip(brand === "all")}>Tutte</button>
              {brands.map((b) => countFor(b.id) > 0 && (
                <button key={b.id} onClick={() => setBrand(b.id)} className={chip(brand === b.id)}>
                  {b.name} <span className="opacity-60">{countFor(b.id)}</span>
                </button>
              ))}
            </div>
          </div>
        )}
        {shapes.length > 1 && (
          <div className="mt-5">
            <p className="mb-2 text-xs uppercase tracking-widest text-muted-foreground">Forma</p>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => setShape("all")} className={chip(shape === "all")}>Tutte</button>
              {shapes.map((sh) => (
                <button key={sh} onClick={() => setShape(sh)} className={chip(shape === sh)}>{SHAPE_LABEL[sh] ?? sh}</button>
              ))}
            </div>
          </div>
        )}
      </section>

      <section className="mx-auto max-w-6xl px-5 pb-40 pt-10">
        <p className="text-sm text-muted-foreground">
          {visible.length === 0 ? "Nessun modello trovato." : `${visible.length} ${visible.length === 1 ? "modello" : "modelli"}`}
          {(q || shape !== "all" || brand !== "all") && (
            <button onClick={() => { setQ(""); setShape("all"); setBrand("all"); }} className="ml-3 text-primary hover:underline">Mostra tutto</button>
          )}
        </p>
        {sections.map(({ brand: b, items }) => (
          <div key={b.id} className="mt-8">
            {(brand === "all" || q) && <h2 className="mb-4 font-display text-2xl">{b.name}</h2>}
            {brand === b.id && !q && (
              <p className="mb-4 max-w-2xl text-sm text-muted-foreground">
                <span className="text-foreground">{b.country}{b.founded ? `, dal ${b.founded}` : ""}.</span> {b.description}
              </p>
            )}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((g, idx) => {
                const selected = currentGroup?.key === g.key;
                return (
                  <div key={g.key} style={{ animationDelay: `${Math.min(idx, 12) * 40}ms` }}
                    className={`animate-card-in rounded-2xl border p-5 transition-all hover:-translate-y-0.5 ${selected ? "border-primary bg-card ring-1 ring-primary" : "hover:border-foreground/30 hover:bg-card/60"}`}>
                    <button onClick={() => setModel(selected ? current!.id : g.variants[0]!.id)} className="w-full text-left">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-xs uppercase tracking-widest text-muted-foreground">{g.brandName} · {SHAPE_LABEL[g.shape] ?? g.shape}</div>
                          <div className="mt-1 text-lg font-medium leading-snug">{g.name}</div>
                        </div>
                        {selected && <Check className="mt-1 h-5 w-5 shrink-0 text-primary" />}
                      </div>
                      {g.pickups !== "—" && <div className="mt-2 text-sm text-muted-foreground">{g.pickups}</div>}
                    </button>
                    {g.variants.length > 1 && (
                      <div className="mt-4 flex flex-wrap items-center gap-2">
                        {g.variants.map((v) => (
                          <button key={v.id} onClick={() => setModel(v.id)} title={v.label} aria-label={v.label}
                            className={`h-7 w-7 rounded-full ring-1 ring-border transition-transform hover:scale-110 ${current?.id === v.id ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : ""}`}
                            style={{ background: v.color }} />
                        ))}
                        {selected && currentVariant && <span className="ml-1 text-sm">{currentVariant.label}</span>}
                      </div>
                    )}
                    {selected && <p className="mt-3 text-sm text-muted-foreground">{g.description}</p>}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </section>

      </>) : (
        <section className="relative overflow-hidden py-24">
          <img src={ampWall} alt="" loading="lazy" width={1920} height={1088} className="absolute inset-0 h-full w-full object-cover opacity-30" />
          <div className="bg-scrim absolute inset-0" />
          <div className="relative mx-auto max-w-6xl px-5">
            <p className="text-sm uppercase tracking-[0.3em] text-primary">Passo 2 di 2 · {currentBrand?.name} {current?.name}</p>
            <Reveal><h1 className="mt-3 font-display text-4xl md:text-6xl">Scegli l'amplificatore.</h1></Reveal>
            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {amps.map((a) => (
                <button key={a.id} onClick={() => setAmp(a.id)}
                  className={`glass relative rounded-2xl border p-6 text-left transition-all ${amp === a.id ? "border-primary" : "hover:border-foreground/30"}`}>
                  {amp === a.id && <Check className="absolute right-5 top-5 h-4 w-4 text-primary" />}
                  <AmpArt ampId={a.id} className="-mx-2 mb-4 block h-28 w-[calc(100%+1rem)]" />
                  <div className="text-xs uppercase tracking-widest text-muted-foreground">{a.brand}</div>
                  <div className="mt-1 font-display text-xl">{a.name}</div>
                  <div className="mt-2 font-mono text-xs text-primary">{a.kind} · {a.watts} W</div>
                  <p className="mt-3 text-sm text-muted-foreground">{a.description}</p>
                </button>
              ))}
            </div>
          </div>
        </section>
      )}

      <div className={step === "model" ? "fixed inset-x-0 bottom-0 z-30 border-t bg-background/90 backdrop-blur" : ""}>
        <div className={`mx-auto flex max-w-6xl items-center justify-end gap-3 px-5 ${step === "model" ? "py-4" : "py-16"}`}>
          {step === "model" && (
            <div className="mr-auto min-w-0 text-sm">
              {current ? (
                <div className="flex items-center gap-3">
                  <span className="h-4 w-4 shrink-0 rounded-full ring-1 ring-border" style={{ background: current.color }} />
                  <span className="truncate"><span className="text-muted-foreground">{currentBrand?.name}</span> {currentGroup?.name}{currentVariant && currentGroup && currentGroup.variants.length > 1 ? ` · ${currentVariant.label}` : ""}</span>
                </div>
              ) : <span className="text-muted-foreground">Scegli un modello dall'elenco</span>}
            </div>
          )}
          {step === "amp" && (
            <button onClick={() => { setStep("model"); window.scrollTo({ top: 0 }); }} className="rounded-full border px-8 py-4 text-sm">← Torna al modello</button>
          )}
          <button onClick={finish} disabled={!current}
            className="shrink-0 rounded-full bg-primary px-8 py-4 text-sm font-medium text-primary-foreground shadow-glow transition-transform hover:scale-[1.03] disabled:pointer-events-none disabled:opacity-40">
            {step === "model" && instrument!.has_amp ? "Avanti: amplificatore →" : "Entra nello studio"}
          </button>
        </div>
      </div>
    </main>
  );
}
