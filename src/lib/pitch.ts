// Riconoscimento della nota suonata (per l'accordatore), con l'autocorrelazione del segnale del microfono.
/** Riconosce la frequenza fondamentale con l'autocorrelazione. Restituisce -1 se il suono è troppo debole. */
export function detectPitch(buf: Float32Array, sampleRate: number): number {
  let rms = 0;
  for (let i = 0; i < buf.length; i++) rms += buf[i]! * buf[i]!;
  if (Math.sqrt(rms / buf.length) < 0.01) return -1;
  const minLag = Math.floor(sampleRate / 1400), maxLag = Math.floor(sampleRate / 27);
  const n = buf.length - maxLag;
  const c = new Float32Array(maxLag + 2);
  for (let lag = minLag; lag <= maxLag + 1; lag++) {
    let sum = 0;
    for (let i = 0; i < n; i++) sum += buf[i]! * buf[i + lag]!;
    c[lag] = sum;
  }
  let energy = 0;
  for (let i = 0; i < n; i++) energy += buf[i]! * buf[i]!;
  // Primo picco forte: evita di agganciare l'ottava sotto.
  let best = -1, bestVal = 0;
  for (let lag = minLag + 1; lag <= maxLag; lag++) if (c[lag]! > bestVal) { bestVal = c[lag]!; best = lag; }
  if (best < 0 || bestVal < energy * 0.3) return -1;
  for (let lag = minLag + 1; lag <= maxLag; lag++) {
    if (c[lag]! > c[lag - 1]! && c[lag]! >= c[lag + 1]! && c[lag]! > bestVal * 0.9) { best = lag; break; }
  }
  const a = c[best - 1]!, b = c[best]!, d = c[best + 1]!;
  const shift = (a - d) / (2 * (a - 2 * b + d) || 1);
  return sampleRate / (best + (Number.isFinite(shift) ? shift : 0));
}
