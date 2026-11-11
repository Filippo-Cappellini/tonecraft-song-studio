import { useEffect, useState } from "react";

export type Setup = { instrument?: string | undefined; brand?: string | undefined; model?: string | undefined; amp?: string | undefined };
const KEY = "musicstudio.setup";
const EVT = "musicstudio-setup";

export function readSetup(): Setup {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || "{}") as Record<string, unknown> | null;
    if (!raw || typeof raw !== "object") return {};
    // Solo i campi attesi, e solo se sono testo: dati vecchi o rovinati non devono rompere le pagine.
    const s: Setup = {};
    for (const k of ["instrument", "brand", "model", "amp"] as const) if (typeof raw[k] === "string") s[k] = raw[k] as string;
    return s;
  } catch {
    return {};
  }
}

export function saveSetup(s: Setup) {
  localStorage.setItem(KEY, JSON.stringify(s));
  window.dispatchEvent(new Event(EVT));
}

export function useSetup() {
  const [setup, setSetup] = useState<Setup>({});
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const sync = () => setSetup(readSetup());
    sync();
    setReady(true);
    window.addEventListener(EVT, sync);
    return () => window.removeEventListener(EVT, sync);
  }, []);
  return { setup, ready };
}
