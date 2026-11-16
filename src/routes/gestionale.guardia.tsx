import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { ShieldBan, ShieldCheck, ShieldOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Errors,
  errorText,
  Field,
  fmtDate,
  Forbidden,
  inputClass,
  Notice,
  PageTitle,
  Panel,
  useStaff,
} from "@/components/gestionale/kit";
import { Switch } from "@/components/ui/switch";
import { banIpManually, getGuardStatus, setGuardActive, unbanIp } from "@/lib/guard.functions";

export const Route = createFileRoute("/gestionale/guardia")({ component: Guardia });

const KEY = ["gestionale", "guardia"];

// Guardia: chi ha scansionato il sito viene bloccato; da qui si vede chi e lo si sblocca.
function Guardia() {
  const staff = useStaff();
  const isAdmin = staff.can("admin");
  const qc = useQueryClient();
  const status = useQuery({
    queryKey: KEY,
    queryFn: () => getGuardStatus(),
    enabled: isAdmin,
    refetchInterval: 15_000,
  });
  const [errors, setErrors] = useState<string[]>([]);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [form, setForm] = useState({ ip: "", reason: "", hours: "" });

  if (!isAdmin) return <Forbidden />;
  const s = status.data;

  const run = async (
    key: string,
    fn: () => Promise<{ ok: true } | { ok: false; error: string }>,
    ok: string,
  ) => {
    setBusy(key);
    setErrors([]);
    setNotice("");
    try {
      const r = await fn();
      if (!r.ok) {
        setErrors([r.error]);
        return false;
      }
      setNotice(ok);
      await qc.invalidateQueries({ queryKey: ["gestionale"] });
      return true;
    } catch (e) {
      setErrors([errorText(e)]);
      return false;
    } finally {
      setBusy(null);
    }
  };

  const toggle = (on: boolean) =>
    run(
      "switch",
      () => setGuardActive({ data: { on } }),
      on ? "Guardia accesa." : "Guardia spenta: nessuno viene bloccato finché non la riaccendi.",
    );

  const unban = (ip: string) =>
    run(ip, () => unbanIp({ data: { ip } }), `${ip} sbloccato: può di nuovo aprire il sito.`);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const ip = form.ip.trim();
    void run("manual", () => banIpManually({ data: { ...form, ip } }), `${ip} bloccato.`).then(
      (ok) => ok && setForm({ ip: "", reason: "", hours: "" }),
    );
  };

  return (
    <>
      <PageTitle
        title="Guardia"
        subtitle="Chi scansiona il sito (Nmap, Nikto, sqlmap, ricerca di file nascosti…) viene bloccato. Da qui puoi sbloccarlo."
      />
      {status.isError && <Errors errors={[errorText(status.error)]} />}

      <Panel title="Stato">
        {s && (
          <ul className="space-y-1.5 text-sm">
            <li className="mb-3 flex flex-wrap items-center gap-3 rounded-xl border p-3">
              <Switch
                id="guardia-attiva"
                checked={s.switchOn && !s.forcedOff}
                disabled={s.forcedOff || busy === "switch"}
                onCheckedChange={toggle}
                aria-label="Guardia attiva"
              />
              <label htmlFor="guardia-attiva" className="flex items-center gap-2 font-medium">
                {s.enabled ? (
                  <>
                    <ShieldCheck className="h-4 w-4 text-emerald-400" /> Attiva: chi scansiona viene
                    bloccato
                  </>
                ) : (
                  <>
                    <ShieldOff className="h-4 w-4 text-amber-300" /> Spenta: non blocca nessuno
                  </>
                )}
              </label>
              {s.forcedOff && (
                <span className="w-full text-xs text-amber-200">
                  Spenta dal file di configurazione del server (GUARDIA=spenta): togli quella riga
                  per poterla accendere da qui.
                </span>
              )}
              {!s.forcedOff && s.switchedAt && (
                <span className="w-full text-xs text-muted-foreground">
                  Ultima modifica: {s.switchedBy}, {fmtDate(s.switchedAt)}. Gli indirizzi già
                  bloccati restano bloccati solo mentre è attiva.
                </span>
              )}
            </li>
            <li>
              Durata del blocco automatico:{" "}
              <span className="font-medium">
                {s.banHours ? `${s.banHours} ore` : "finché non lo sblocchi"}
              </span>
            </li>
            <li>
              Il tuo indirizzo: <code>{s.myIp}</code>
            </li>
            <li>
              Mai bloccati: questo computer
              {s.allowList.length ? (
                <>
                  , <code>{s.allowList.join(", ")}</code>
                </>
              ) : (
                " (aggiungine altri con GUARDIA_CONSENTITI)"
              )}
            </li>
          </ul>
        )}
      </Panel>

      <Panel title={`Indirizzi bloccati${s ? ` (${s.bans.length})` : ""}`} className="mt-6">
        {notice && (
          <div className="mb-3">
            <Notice>{notice}</Notice>
          </div>
        )}
        <Errors errors={errors} />
        {s && !s.bans.length && (
          <p className="text-sm text-muted-foreground">Nessun indirizzo bloccato.</p>
        )}
        {!!s?.bans.length && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr className="border-b">
                  <th className="py-2 pr-3">Indirizzo</th>
                  <th className="py-2 pr-3">Motivo</th>
                  <th className="py-2 pr-3">Quando</th>
                  <th className="py-2 pr-3">Scade</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody>
                {s.bans.map((b) => (
                  <tr key={b.ip} className="border-b border-border/50 align-top">
                    <td className="py-2 pr-3 font-mono">{b.ip}</td>
                    <td className="py-2 pr-3">
                      <div>{b.reason}</div>
                      <div className="max-w-md break-all text-xs text-muted-foreground">
                        {b.manual ? `a mano da ${b.created_by}` : "automatico"}
                        {b.hits > 1 ? ` · bloccato ${b.hits} volte` : ""}
                        {b.detail ? ` · ${b.detail}` : ""}
                      </div>
                    </td>
                    <td className="py-2 pr-3 whitespace-nowrap">{fmtDate(b.created_at)}</td>
                    <td className="py-2 pr-3 whitespace-nowrap">
                      {b.expires_at ? fmtDate(b.expires_at) : "mai"}
                    </td>
                    <td className="py-2 text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy === b.ip}
                        onClick={() => unban(b.ip)}
                      >
                        Sbanna
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel title="Blocca un indirizzo a mano" className="mt-6">
        <form
          onSubmit={submit}
          className="grid gap-3 sm:grid-cols-[1fr_1.5fr_120px_auto] sm:items-end"
        >
          <Field label="Indirizzo IP">
            <input
              className={inputClass}
              value={form.ip}
              onChange={(e) => setForm({ ...form, ip: e.target.value })}
              placeholder="192.168.1.50"
              required
              maxLength={45}
              autoComplete="off"
            />
          </Field>
          <Field label="Motivo">
            <input
              className={inputClass}
              value={form.reason}
              onChange={(e) => setForm({ ...form, reason: e.target.value })}
              maxLength={200}
            />
          </Field>
          <Field label="Ore (vuoto = sempre)">
            <input
              className={inputClass}
              type="number"
              min={1}
              value={form.hours}
              onChange={(e) => setForm({ ...form, hours: e.target.value })}
            />
          </Field>
          <Button type="submit" disabled={busy === "manual"}>
            <ShieldBan /> Blocca
          </Button>
        </form>
        <p className="mt-3 text-xs text-muted-foreground">
          Ogni blocco e sblocco finisce nel registro attività (Utenti e registro). Se resti bloccato
          tu stesso, dal computer del server:{" "}
          <code>docker compose exec app node scripts/sbanna.mjs IP</code>.
        </p>
      </Panel>
    </>
  );
}
