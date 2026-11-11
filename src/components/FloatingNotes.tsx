import type { CSSProperties } from "react";

// Sfondo decorativo: note musicali che salgono, ondeggiano, compaiono e svaniscono.
// Posizioni e tempi sono fissi (pseudo-casuali ma deterministici) così server e browser disegnano lo stesso.
// - "page": dietro a tutto il sito, fisso sullo schermo.
// - "section": dentro una sezione con foto (es. la home), sopra l'immagine e sotto il testo.
const GLYPHS = ["♪", "♫", "♩", "♬", "𝄞"];

// Generatore con soli numeri interi (mulberry32): dà gli stessi valori sul server e nel browser.
const rand = (i: number, salt: number) => {
  let t = (i * 2654435761 + salt * 40503 + 0x6d2b79f5) >>> 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const r2 = (x: number) => Math.round(x * 100) / 100;

const makeNotes = (count: number, seed: number) =>
  Array.from({ length: count }, (_, k) => {
    const i = k + seed * 100;
    return {
      glyph: GLYPHS[Math.floor(rand(i, 1) * GLYPHS.length)]!,
      left: r2(rand(i, 2) * 100),
      size: r2(18 + rand(i, 3) * 38),
      duration: r2(14 + rand(i, 4) * 16),
      delay: r2(-rand(i, 5) * 30),
      sway: r2((rand(i, 6) - 0.5) * 160),
      spin: r2((rand(i, 7) - 0.5) * 60),
      opacity: r2(0.12 + rand(i, 8) * 0.22),
      accent: rand(i, 9) > 0.6,
    };
  });

const PAGE_NOTES = makeNotes(26, 0);
const SECTION_NOTES = makeNotes(14, 1);

export function FloatingNotes({ variant = "page" }: { variant?: "page" | "section" }) {
  const notes = variant === "page" ? PAGE_NOTES : SECTION_NOTES;
  return (
    <div aria-hidden
      className={`pointer-events-none overflow-hidden ${variant === "page" ? "fixed inset-0 z-0" : "absolute inset-0"}`}>
      {notes.map((n, i) => (
        <span
          key={i}
          className={`floating-note ${variant === "section" ? "floating-note--section" : ""} ${n.accent ? "text-primary" : "text-foreground"}`}
          style={{
            left: `${n.left}%`,
            fontSize: `${n.size}px`,
            animationDuration: `${n.duration}s`,
            animationDelay: `${n.delay}s`,
            "--sway": `${n.sway}px`,
            "--spin": `${n.spin}deg`,
            "--peak": String(variant === "section" ? r2(Math.min(0.5, n.opacity * 1.6)) : n.opacity),
          } as CSSProperties}
        >
          {n.glyph}
        </span>
      ))}
    </div>
  );
}
