import { useId } from "react";

// Disegni vettoriali degli amplificatori: forma (testata su cassa o combo) e colori di ogni modello del catalogo.
// Nessuna foto e nessun logo.

const W = 260;
const H = 100;

// Colore più chiaro o più scuro, per luci e ombre.
function shade(hex: string, amt: number) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return hex;
  const n = parseInt(m[1]!, 16);
  const ch = (v: number) => Math.round(Math.min(255, Math.max(0, amt >= 0 ? v + (255 - v) * amt : v * (1 + amt))));
  const r = ch((n >> 16) & 255), g = ch((n >> 8) & 255), b = ch(n & 255);
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

type AmpStyle = { layout: "stack" | "combo" | "bass-stack"; tolex: string; grill: string; grillPattern: "weave" | "diamond" | "check" | "plain" | "plate"; panel: string; piping?: string; knobs: string; headGrill?: string };
const AMP_STYLE: Record<string, AmpStyle> = {
  "marshall-jcm800": { layout: "stack", tolex: "#151515", grill: "#2a2a2a", grillPattern: "check", panel: "#c9a64a", piping: "#e8e2d0", knobs: "#111" },
  "marshall-plexi": { layout: "stack", tolex: "#151515", grill: "#bfae8a", grillPattern: "weave", panel: "#d6b75a", piping: "#e8e2d0", knobs: "#111" },
  "mesa-rectifier": { layout: "stack", tolex: "#141414", grill: "#1d1d1d", grillPattern: "plain", panel: "#2b2b2b", knobs: "#d7d7d7", headGrill: "plate" },
  "mesa-mk": { layout: "combo", tolex: "#151515", grill: "#2b2b2b", grillPattern: "plain", panel: "#202020", knobs: "#d7d7d7" },
  "vox-ac30": { layout: "combo", tolex: "#1a1a1a", grill: "#6b4a34", grillPattern: "diamond", panel: "#b8763a", piping: "#e8e2d0", knobs: "#e9e2cf" },
  "peavey-5150": { layout: "stack", tolex: "#151515", grill: "#2a2a2a", grillPattern: "check", panel: "#1e1e1e", knobs: "#d7d7d7" },
  "orange-rockerverb": { layout: "stack", tolex: "#ef7a1a", grill: "#d8ccad", grillPattern: "weave", panel: "#f2efe6", knobs: "#111" },
  "boss-katana": { layout: "combo", tolex: "#161616", grill: "#222", grillPattern: "plain", panel: "#2a2a2a", knobs: "#ff8a1a" },
  "ampeg-svt": { layout: "bass-stack", tolex: "#151515", grill: "#9aa3ad", grillPattern: "check", panel: "#c9ced4", knobs: "#111", piping: "#3d6cc4" },
  "fender-bassman": { layout: "bass-stack", tolex: "#151515", grill: "#b9bdc2", grillPattern: "weave", panel: "#1e1e1e", knobs: "#e6e6e6" },
  darkglass: { layout: "stack", tolex: "#121212", grill: "#1d1d1d", grillPattern: "plain", panel: "#0f0f0f", knobs: "#e6e6e6" },
};
const DEFAULT_AMP: AmpStyle = { layout: "stack", tolex: "#151515", grill: "#2a2a2a", grillPattern: "plain", panel: "#222", knobs: "#ddd" };

function GrillPattern({ id, s }: { id: string; s: AmpStyle }) {
  const c = s.grill;
  if (s.grillPattern === "diamond")
    return (
      <pattern id={id} width="8" height="8" patternUnits="userSpaceOnUse">
        <rect width="8" height="8" fill={c} />
        <path d="M4 0 L8 4 L4 8 L0 4 Z" fill={shade(c, 0.35)} opacity={0.8} />
      </pattern>
    );
  if (s.grillPattern === "check")
    return (
      <pattern id={id} width="3" height="3" patternUnits="userSpaceOnUse">
        <rect width="3" height="3" fill={c} />
        <rect width="1.5" height="1.5" fill={shade(c, 0.25)} />
        <rect x="1.5" y="1.5" width="1.5" height="1.5" fill={shade(c, 0.25)} />
      </pattern>
    );
  if (s.grillPattern === "weave")
    return (
      <pattern id={id} width="4" height="4" patternUnits="userSpaceOnUse">
        <rect width="4" height="4" fill={c} />
        <path d="M0 1 H4 M1 0 V4" stroke={shade(c, -0.25)} strokeWidth={0.6} />
      </pattern>
    );
  if (s.grillPattern === "plate")
    return (
      <pattern id={id} width="5" height="5" patternUnits="userSpaceOnUse">
        <rect width="5" height="5" fill="#b9bec4" />
        <path d="M1 2 L2.5 1 M3 4 L4.5 3" stroke="#fff" strokeWidth={0.6} opacity={0.8} />
      </pattern>
    );
  return (
    <pattern id={id} width="2" height="2" patternUnits="userSpaceOnUse">
      <rect width="2" height="2" fill={c} />
      <circle cx="1" cy="1" r="0.35" fill={shade(c, 0.3)} />
    </pattern>
  );
}

export function AmpArt({ ampId, className = "" }: { ampId: string; className?: string }) {
  const uid = `a${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const s = AMP_STYLE[ampId] ?? DEFAULT_AMP;
  const grill = `url(#${uid}-grill)`;
  const knobs = (x: number, y: number, n: number, gap = 7) =>
    Array.from({ length: n }, (_, i) => <circle key={i} cx={x + i * gap} cy={y} r={2} fill={s.knobs} stroke="#000" strokeOpacity={0.4} strokeWidth={0.4} />);
  const box = (x: number, y: number, w: number, h: number) => (
    <>
      <rect x={x} y={y} width={w} height={h} rx={3} transform="translate(2 3)" fill="#000" opacity={0.3} />
      <rect x={x} y={y} width={w} height={h} rx={3} fill={s.tolex} stroke="#000" strokeOpacity={0.5} strokeWidth={0.6} />
      {[[x, y], [x + w, y], [x, y + h], [x + w, y + h]].map(([cx, cy], k) => <circle key={k} cx={cx! + (k % 2 ? -2.5 : 2.5)} cy={cy! + (k < 2 ? 2.5 : -2.5)} r={2.2} fill="#9a9a9a" />)}
    </>
  );
  const speakerGrill = (x: number, y: number, w: number, h: number) => (
    <>
      <rect x={x} y={y} width={w} height={h} rx={2} fill={grill} />
      {s.piping && <rect x={x} y={y} width={w} height={h} rx={2} fill="none" stroke={s.piping} strokeWidth={1} />}
      <rect x={x} y={y} width={w} height={h} rx={2} fill={`url(#${uid}-shade)`} opacity={0.3} />
    </>
  );
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={className} role="img" aria-label="Disegno dell'amplificatore">
      <defs>
        <GrillPattern id={`${uid}-grill`} s={s} />
        <linearGradient id={`${uid}-shade`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#fff" stopOpacity={0.2} /><stop offset="1" stopColor="#000" stopOpacity={0.5} /></linearGradient>
      </defs>
      {s.layout === "combo" ? (
        <>
          {box(56, 14, 148, 82)}
          <rect x={60} y={18} width={140} height={16} rx={1.5} fill={s.panel} />
          {knobs(70, 26, 11, 11)}
          <rect x={86} y={10} width={88} height={4} rx={2} fill="#2a2a2a" />
          {speakerGrill(62, 38, 136, 52)}
        </>
      ) : (
        <>
          {/* testata */}
          {box(s.layout === "bass-stack" ? 84 : 66, 4, s.layout === "bass-stack" ? 92 : 128, 26)}
          {s.headGrill === "plate"
            ? <rect x={70} y={8} width={120} height={18} rx={1.5} fill={`url(#${uid}-grill)`} />
            : <rect x={s.layout === "bass-stack" ? 88 : 70} y={8} width={s.layout === "bass-stack" ? 84 : 120} height={8} rx={1} fill={s.layout === "stack" && s.grillPattern !== "plain" ? grill : shade(s.tolex, 0.12)} />}
          <rect x={s.layout === "bass-stack" ? 88 : 70} y={s.headGrill === "plate" ? 20 : 17} width={s.layout === "bass-stack" ? 84 : 120} height={s.headGrill === "plate" ? 7 : 10} rx={1} fill={s.panel} />
          {knobs(s.layout === "bass-stack" ? 96 : 80, s.headGrill === "plate" ? 23.5 : 22, s.layout === "bass-stack" ? 10 : 13, s.layout === "bass-stack" ? 7.5 : 8.2)}
          {/* cassa */}
          {box(s.layout === "bass-stack" ? 84 : 66, 32, s.layout === "bass-stack" ? 92 : 128, 64)}
          {speakerGrill(s.layout === "bass-stack" ? 88 : 70, 36, s.layout === "bass-stack" ? 84 : 120, 56)}
        </>
      )}
    </svg>
  );
}
