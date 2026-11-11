export function Knob({ label, value, max = 10 }: { label: string; value: number; max?: number }) {
  const angle = -135 + (value / max) * 270;
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative h-16 w-16">
        <svg viewBox="0 0 64 64" className="absolute inset-0">
          {Array.from({ length: 11 }).map((_, i) => {
            const a = ((-135 + i * 27) * Math.PI) / 180;
            return (
              <line key={i} x1={32 + Math.sin(a) * 27} y1={32 - Math.cos(a) * 27} x2={32 + Math.sin(a) * 30} y2={32 - Math.cos(a) * 30}
                className={i <= value ? "stroke-primary" : "stroke-muted-foreground/40"} strokeWidth="1.5" />
            );
          })}
        </svg>
        <div className="absolute inset-[9px] rounded-full bg-secondary shadow-soft ring-1 ring-border" style={{ transform: `rotate(${angle}deg)` }}>
          <div className="mx-auto mt-1 h-3 w-0.5 rounded-full bg-primary" />
        </div>
      </div>
      <div className="text-center">
        <div className="text-[11px] uppercase tracking-widest text-muted-foreground">{label}</div>
        <div className="font-mono text-sm">{value}</div>
      </div>
    </div>
  );
}
