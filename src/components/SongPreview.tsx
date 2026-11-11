import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink, Pause, Play, Volume1, VolumeX } from "lucide-react";
import { getPreview } from "@/lib/covers.functions";
import { Equalizer } from "@/components/Equalizer";
import { METRONOME_START } from "@/lib/metronome";

// Preferenza "musica di sottofondo spenta", ricordata nel browser.
const OFF_KEY = "tono.anteprima.spenta";
const VOL_KEY = "tono.anteprima.volume";

/**
 * Anteprima del brano (30 secondi, da Apple) in sottofondo a volume basso, con pausa e volume.
 * Se il browser blocca l'avvio automatico, mostra il pulsante per farla partire.
 */
export function SongPreview({ artist, title }: { artist: string; title: string }) {
  const { data } = useQuery({
    queryKey: ["preview", artist, title],
    queryFn: () => getPreview({ data: { artist, title } }),
    staleTime: Infinity,
    gcTime: Infinity,
  });
  const el = useRef<HTMLAudioElement | null>(null);
  const fade = useRef<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const [volume, setVolume] = useState(0.15);

  const vol = useRef(volume);
  vol.current = volume;
  const target = () => vol.current;
  const stopFade = () => { if (fade.current) window.clearInterval(fade.current); fade.current = null; };
  // Entrata dolce: il volume sale in un secondo e mezzo.
  const play = () => {
    const a = el.current;
    if (!a) return;
    stopFade();
    a.volume = 0;
    a.play().then(() => {
      fade.current = window.setInterval(() => {
        a.volume = Math.min(target(), a.volume + target() / 15);
        if (a.volume >= target()) stopFade();
      }, 100);
    }).catch(() => setPlaying(false));
  };
  const pause = () => { stopFade(); el.current?.pause(); };

  useEffect(() => {
    try {
      const v = Number(localStorage.getItem(VOL_KEY));
      if (v > 0 && v <= 1) setVolume(v);
    } catch { /* nessun accesso allo storage: valori di default */ }
  }, []);

  useEffect(() => {
    if (!data?.url) return;
    const a = new Audio(data.url);
    a.loop = true;
    a.preload = "auto";
    a.onplay = () => setPlaying(true);
    a.onpause = () => setPlaying(false);
    el.current = a;
    let off = false;
    try { off = localStorage.getItem(OFF_KEY) === "1"; } catch { /* default: acceso */ }
    if (!off) play();
    const onMetronome = () => pause();
    window.addEventListener(METRONOME_START, onMetronome);
    return () => {
      window.removeEventListener(METRONOME_START, onMetronome);
      stopFade();
      a.pause();
      a.src = "";
      el.current = null;
    };
  }, [data?.url]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { if (el.current && !fade.current) el.current.volume = volume; }, [volume]);

  const toggle = () => {
    try { localStorage.setItem(OFF_KEY, playing ? "1" : "0"); } catch { /* ignora */ }
    if (playing) pause(); else play();
  };
  const changeVolume = (v: number) => {
    setVolume(v);
    try { localStorage.setItem(VOL_KEY, String(v)); } catch { /* ignora */ }
  };

  if (!data?.url) return null;
  return (
    <div className="glass animate-rise fixed bottom-5 left-5 z-40 flex max-w-[calc(100vw-2.5rem)] items-center gap-3 rounded-full border py-2 pl-2 pr-4 text-sm shadow-soft">
      <button onClick={toggle} aria-label={playing ? "Metti in pausa l'anteprima" : "Ascolta l'anteprima"}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-transform active:scale-95">
        {playing ? <Pause className="h-4 w-4" /> : <Play className="ml-0.5 h-4 w-4" />}
      </button>
      <div className="min-w-0">
        <p className="flex items-center gap-2 truncate text-xs text-muted-foreground">
          {playing ? <><Equalizer bpm={100} /> In sottofondo</> : "Anteprima del brano"}
        </p>
        <p className="truncate">{title}</p>
      </div>
      <label className="hidden items-center gap-1.5 sm:flex" title="Volume">
        {volume < 0.02 ? <VolumeX className="h-4 w-4 text-muted-foreground" /> : <Volume1 className="h-4 w-4 text-muted-foreground" />}
        <input type="range" min={0} max={0.6} step={0.01} value={volume} onChange={(e) => changeVolume(+e.target.value)} className="w-20 accent-[var(--primary)]" aria-label="Volume anteprima" />
      </label>
      {data.page && (
        <a href={data.page} target="_blank" rel="noreferrer" className="shrink-0 text-xs text-muted-foreground hover:text-foreground" title="Anteprima fornita da Apple Music">
          Apple Music <ExternalLink className="inline h-3 w-3" />
        </a>
      )}
    </div>
  );
}
