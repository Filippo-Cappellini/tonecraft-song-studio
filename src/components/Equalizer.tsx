// Piccolo equalizzatore animato: barre che si muovono a tempo (bpm) come un vu-meter.
export function Equalizer({ bpm = 100, bars = 5, className = "" }: { bpm?: number; bars?: number; className?: string }) {
  const beat = 60 / Math.max(40, Math.min(240, bpm));
  return (
    <span aria-hidden className={`inline-flex h-4 items-end gap-[3px] ${className}`}>
      {Array.from({ length: bars }, (_, i) => (
        <span key={i} className="eq-bar w-[3px] rounded-full bg-primary"
          style={{ animationDuration: `${beat * (1 + (i % 3) * 0.5)}s`, animationDelay: `${-i * beat * 0.37}s` }} />
      ))}
    </span>
  );
}
