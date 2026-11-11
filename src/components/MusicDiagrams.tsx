import { NOTE_IT, NOTE_NAMES, pc, type ChordShape } from "@/lib/theory";

/** Diagramma di un accordo per chitarra: corde in verticale, tasti in orizzontale, pallini con il numero del dito. */
export function ChordDiagram({ chord, size = 140 }: { chord: ChordShape; size?: number }) {
  const played = chord.frets.filter((f) => f > 0);
  const maxFret = Math.max(0, ...played);
  const base = maxFret > 4 ? Math.min(...played) : 1;
  const w = size, h = size * 1.2, padX = 18, top = 30, rows = 5;
  const gx = (w - padX * 2) / 5, gy = (h - top - 12) / rows;
  const x = (s: number) => padX + s * gx;
  const y = (f: number) => top + (f - base + 0.5) * gy;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h} role="img" aria-label={`Accordo ${chord.name}`} className="text-foreground">
      {base === 1 ? (
        <rect x={padX} y={top - 4} width={gx * 5} height={4} rx={1} className="fill-current" />
      ) : (
        <text x={4} y={top + gy * 0.65} className="fill-muted-foreground text-[10px]">{base}</text>
      )}
      {Array.from({ length: rows + 1 }, (_, r) => (
        <line key={`f${r}`} x1={padX} x2={padX + gx * 5} y1={top + r * gy} y2={top + r * gy} className="stroke-current opacity-30" />
      ))}
      {Array.from({ length: 6 }, (_, s) => (
        <line key={`s${s}`} x1={x(s)} x2={x(s)} y1={top} y2={top + rows * gy} className="stroke-current opacity-50" strokeWidth={1 + (5 - s) * 0.25} />
      ))}
      {chord.barre && (
        <rect x={x(chord.frets.indexOf(chord.barre)) - 7} y={y(chord.barre) - 7} rx={7} height={14}
          width={x(5) - x(chord.frets.indexOf(chord.barre)) + 14} className="fill-primary" />
      )}
      {chord.frets.map((f, s) =>
        f < 0 ? (
          <text key={s} x={x(s)} y={top - 10} textAnchor="middle" className="fill-muted-foreground text-[11px]">×</text>
        ) : f === 0 ? (
          <circle key={s} cx={x(s)} cy={top - 14} r={4} className="fill-none stroke-current" />
        ) : (
          <g key={s}>
            <circle cx={x(s)} cy={y(f)} r={7.5} className={pc(40 + [0, 5, 10, 15, 19, 24][s]! + f) === chord.root ? "fill-orange-500" : "fill-primary"} />
            {chord.fingers[s] ? <text x={x(s)} y={y(f) + 3.5} textAnchor="middle" className="fill-primary-foreground text-[10px] font-semibold">{chord.fingers[s]}</text> : null}
          </g>
        ),
      )}
    </svg>
  );
}

/** Manico di chitarra o basso con le note di una scala o di un accordo evidenziate (la tonica in arancio). */
export function Fretboard({ tuning, notes, root, frets = 12, showNames = true }: { tuning: number[]; notes: number[]; root: number; frets?: number; showNames?: boolean }) {
  const strings = [...tuning].reverse(); // corda più acuta in alto, come nelle tablature
  const cellW = 54, rowH = 28, left = 34, top = 14;
  const w = left + cellW * (frets + 1) + 10, h = top + rowH * (strings.length - 1) + 30;
  const set = new Set(notes.map((n) => ((n % 12) + 12) % 12));
  const fx = (f: number) => (f === 0 ? left - 14 : left + cellW * (f - 0.5));
  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h} role="img" aria-label="Manico con le note della scala" className="text-foreground">
        <rect x={left} y={top - 6} width={cellW * frets} height={rowH * (strings.length - 1) + 12} rx={4} className="fill-[#3a2416] opacity-60" />
        {[3, 5, 7, 9, 15, 17].filter((f) => f <= frets).map((f) => (
          <circle key={f} cx={left + cellW * (f - 0.5)} cy={top + (rowH * (strings.length - 1)) / 2} r={5} className="fill-foreground opacity-15" />
        ))}
        {frets >= 12 && [1, 3].map((k) => (
          <circle key={k} cx={left + cellW * 11.5} cy={top + ((rowH * (strings.length - 1)) / 4) * k} r={5} className="fill-foreground opacity-15" />
        ))}
        {Array.from({ length: frets + 1 }, (_, f) => (
          <line key={f} x1={left + cellW * f} x2={left + cellW * f} y1={top - 6} y2={top + rowH * (strings.length - 1) + 6}
            className={f === 0 ? "stroke-current" : "stroke-current opacity-30"} strokeWidth={f === 0 ? 4 : 1.5} />
        ))}
        {strings.map((open, i) => (
          <g key={i}>
            <line x1={left} x2={left + cellW * frets} y1={top + i * rowH} y2={top + i * rowH} className="stroke-current opacity-60" strokeWidth={1 + i * 0.35} />
            {Array.from({ length: frets + 1 }, (_, f) => {
              const n = pc(open + f);
              if (!set.has(n)) return null;
              const isRoot = n === root;
              return (
                <g key={f}>
                  <circle cx={fx(f)} cy={top + i * rowH} r={11} className={isRoot ? "fill-orange-500" : "fill-primary"} opacity={f === 0 ? 0.85 : 1} />
                  {showNames && <text x={fx(f)} y={top + i * rowH + 3.5} textAnchor="middle" className="fill-primary-foreground text-[9px] font-semibold">{NOTE_NAMES[n]}</text>}
                </g>
              );
            })}
          </g>
        ))}
        {Array.from({ length: frets }, (_, f) => (
          <text key={f} x={left + cellW * (f + 0.5)} y={h - 4} textAnchor="middle" className="fill-muted-foreground text-[10px]">{f + 1}</text>
        ))}
      </svg>
    </div>
  );
}

/** Tastiera del pianoforte (due ottave da Do) con le note evidenziate; cliccando un tasto si sente. */
export function PianoKeys({ notes, root, onPlay, octaves = 2 }: { notes: number[]; root: number; onPlay?: (pitchClass: number, octave: number) => void; octaves?: number }) {
  const set = new Set(notes.map((n) => ((n % 12) + 12) % 12));
  const whites = [0, 2, 4, 5, 7, 9, 11], blacks = [1, 3, 6, 8, 10];
  const ww = 36, wh = 140, bw = 22, bh = 88;
  const keys = Array.from({ length: octaves }, (_, o) => o);
  const whiteX = (o: number, n: number) => (o * 7 + whites.indexOf(n)) * ww;
  const blackX = (o: number, n: number) => (o * 7 + whites.indexOf(n - 1)) * ww + ww - bw / 2;
  const color = (n: number, white: boolean) => (n === root ? "fill-orange-500" : set.has(n) ? "fill-primary" : white ? "fill-[#f4efe6]" : "fill-[#141210]");
  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${ww * 7 * octaves} ${wh + 2}`} width={ww * 7 * octaves} height={wh + 2} role="img" aria-label="Tastiera con le note evidenziate">
        {keys.flatMap((o) => whites.map((n) => (
          <g key={`w${o}-${n}`} onClick={() => onPlay?.(n, o)} className="cursor-pointer">
            <rect x={whiteX(o, n)} y={0} width={ww - 2} height={wh} rx={4} className={`${color(n, true)} stroke-black/40 transition-opacity hover:opacity-80`} />
            {set.has(n) && <text x={whiteX(o, n) + ww / 2 - 1} y={wh - 12} textAnchor="middle" className="fill-primary-foreground text-[10px] font-semibold">{NOTE_IT[n]}</text>}
          </g>
        )))}
        {keys.flatMap((o) => blacks.map((n) => (
          <g key={`b${o}-${n}`} onClick={() => onPlay?.(n, o)} className="cursor-pointer">
            <rect x={blackX(o, n)} y={0} width={bw} height={bh} rx={3} className={`${color(n, false)} transition-opacity hover:opacity-80`} />
            {set.has(n) && <text x={blackX(o, n) + bw / 2} y={bh - 10} textAnchor="middle" className="fill-primary-foreground text-[8px] font-semibold">{NOTE_NAMES[n]}</text>}
          </g>
        )))}
      </svg>
    </div>
  );
}
