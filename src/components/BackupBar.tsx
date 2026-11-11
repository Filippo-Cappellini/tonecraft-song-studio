import { useRef, useState } from "react";
import { Download, Upload } from "lucide-react";
import { exportBackup, importBackup } from "@/lib/progress";

/** Backup dei progressi: i dati sono solo in questo browser, così non si perdono. */
export function BackupBar() {
  const input = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const onFile = async (f: File | undefined) => {
    if (!f) return;
    try {
      const p = await importBackup(f);
      setMsg({ ok: true, text: `Backup ripristinato: ${p.lessons.length} lezioni, ${p.favorites.length} preferiti, ${p.artists.length} artisti, ${Object.keys(p.log).length} giorni di pratica.` });
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : "Non sono riuscito a leggere il file." });
    }
    if (input.current) input.current.value = "";
  };
  return (
    <div className="mt-4 flex flex-wrap items-center gap-3 rounded-2xl border p-4 text-sm">
      <p className="mr-auto text-muted-foreground">I tuoi progressi sono salvati solo in questo browser. Scarica un backup per non perderli o per spostarli su un altro dispositivo.</p>
      <button onClick={() => { exportBackup(); setMsg({ ok: true, text: "Backup scaricato." }); }} className="inline-flex items-center gap-2 rounded-full border px-4 py-2 hover:border-foreground/40">
        <Download className="h-4 w-4" /> Scarica backup
      </button>
      <button onClick={() => input.current?.click()} className="inline-flex items-center gap-2 rounded-full border px-4 py-2 hover:border-foreground/40">
        <Upload className="h-4 w-4" /> Ripristina
      </button>
      <input ref={input} type="file" accept="application/json,.json" className="hidden" onChange={(e) => void onFile(e.target.files?.[0])} />
      {msg && <p className={`w-full text-xs ${msg.ok ? "text-emerald-300" : "text-rose-300"}`} role="status">{msg.text}</p>}
    </div>
  );
}

