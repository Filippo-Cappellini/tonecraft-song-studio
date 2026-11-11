import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { ChevronLeft, ChevronRight, Plus, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Errors,
  errorText,
  Field,
  Forbidden,
  inputClass,
  PageTitle,
  Panel,
  useStaff,
} from "@/components/gestionale/kit";
import {
  isTableName,
  TABLE_NAMES,
  TABLES,
  tableDef,
  type Column,
  type RowValue,
  type TableDef,
  type TableName,
} from "@/lib/admin-tables";
import { deleteTableRow, listTableRows, saveTableRow, tableOptions } from "@/lib/tables.functions";

export const Route = createFileRoute("/gestionale/tabelle/$table")({
  beforeLoad: ({ params }) => {
    if (!isTableName(params.table)) throw notFound();
  },
  component: TablePage,
});

function TablePage() {
  const { table: raw } = Route.useParams();
  const table = raw as TableName;
  const def = tableDef(table);
  const staff = useStaff();
  const [q, setQ] = useState("");
  const [offset, setOffset] = useState(0);
  const [editing, setEditing] = useState<Record<string, RowValue> | "new" | null>(null);
  const allowed = staff.can("vedere");
  const canEdit = staff.can(def.perm);

  const page = useQuery({
    queryKey: ["gestionale", "table", table, q, offset],
    queryFn: () => listTableRows({ data: { table, q, offset } }),
    enabled: allowed,
    placeholderData: (p) => p,
  });
  if (!allowed) return <Forbidden />;

  const siblings = TABLE_NAMES.filter((t) => TABLES[t].group === def.group);
  const listCols = def.columns.filter((c) => c.list);
  const total = page.data?.total ?? 0;
  const size = page.data?.pageSize ?? 50;

  return (
    <>
      <PageTitle
        title={def.label}
        subtitle={`Tabella «${table}» del database${canEdit ? "." : " · sola lettura per il tuo ruolo."}`}
        actions={
          canEdit && (
            <Button onClick={() => setEditing("new")}>
              <Plus /> Nuova riga
            </Button>
          )
        }
      />
      {siblings.length > 1 && (
        <div className="mb-4 flex flex-wrap gap-2">
          {siblings.map((t) => (
            <Link
              key={t}
              to="/gestionale/tabelle/$table"
              params={{ table: t }}
              onClick={() => {
                setQ("");
                setOffset(0);
              }}
              className="rounded-full border px-3 py-1 text-sm hover:border-primary"
              activeProps={{ className: "border-primary! bg-primary/15 text-primary" }}
            >
              {TABLES[t].label}
            </Link>
          ))}
        </div>
      )}
      <Panel>
        <div className="relative mb-4">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <input
            className={`${inputClass} pl-9`}
            placeholder="Cerca"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setOffset(0);
            }}
            aria-label={`Cerca in ${def.label}`}
          />
        </div>
        {page.isError && <Errors errors={[errorText(page.error)]} />}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr className="border-b">
                {!def.autoPk && <th className="py-2 pr-3">Id</th>}
                {listCols.map((c) => (
                  <th key={c.name} className="py-2 pr-3">
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(page.data?.rows ?? []).map((r) => (
                <tr
                  key={String(r[def.pk])}
                  className="cursor-pointer border-b border-border/50 hover:bg-secondary/40"
                  onClick={() => setEditing(r)}
                >
                  {!def.autoPk && (
                    <td className="py-2 pr-3 font-mono text-xs">{String(r[def.pk])}</td>
                  )}
                  {listCols.map((c) => (
                    <td key={c.name} className="max-w-xs truncate py-2 pr-3">
                      {show(r[c.name])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {page.data?.rows.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">Nessuna riga.</p>
          )}
        </div>
        {total > size && (
          <div className="mt-4 flex items-center justify-end gap-2 text-sm">
            <span className="text-muted-foreground">
              {offset + 1}–{Math.min(offset + size, total)} di {total}
            </span>
            <Button
              size="icon"
              variant="outline"
              disabled={offset === 0}
              onClick={() => setOffset(Math.max(0, offset - size))}
              aria-label="Pagina precedente"
            >
              <ChevronLeft />
            </Button>
            <Button
              size="icon"
              variant="outline"
              disabled={offset + size >= total}
              onClick={() => setOffset(offset + size)}
              aria-label="Pagina successiva"
            >
              <ChevronRight />
            </Button>
          </div>
        )}
      </Panel>
      {editing && (
        <RowDialog
          table={table}
          def={def}
          row={editing === "new" ? null : editing}
          readOnly={!canEdit}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  );
}

const show = (v: RowValue | undefined) =>
  v === null || v === undefined || v === ""
    ? "—"
    : typeof v === "boolean"
      ? v
        ? "Sì"
        : "No"
      : String(v);

function RowDialog({
  table,
  def,
  row,
  readOnly,
  onClose,
}: {
  table: TableName;
  def: TableDef;
  row: Record<string, RowValue> | null;
  readOnly: boolean;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [values, setValues] = useState<Record<string, string | boolean>>(() =>
    Object.fromEntries(
      def.columns.map((c) => [
        c.name,
        c.type === "bool"
          ? row
            ? row[c.name] === true
            : true
          : row?.[c.name] == null
            ? ""
            : String(row[c.name]),
      ]),
    ),
  );
  const [newId, setNewId] = useState("");
  const [errors, setErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const id = row ? String(row[def.pk]) : null;

  const done = async () => {
    // Anche le pagine pubbliche rileggono il catalogo.
    await qc.invalidateQueries();
    onClose();
  };
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await saveTableRow({ data: { table, id, newId, values } });
      if (!r.ok) setErrors(r.errors);
      else await done();
    } catch (err) {
      setErrors([errorText(err)]);
    } finally {
      setBusy(false);
    }
  };
  const remove = async () => {
    if (!id || !window.confirm("Eliminare questa riga? L'operazione non si può annullare.")) return;
    try {
      const r = await deleteTableRow({ data: { table, id } });
      if (!r.ok) setErrors([r.error]);
      else await done();
    } catch (err) {
      setErrors([errorText(err)]);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {!row
              ? `Nuova riga · ${def.label}`
              : `${readOnly ? "Dettaglio" : "Modifica"} · ${show(row[def.title])}`}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
          {/* Sola lettura: tutti i campi disattivati, nessun pulsante per salvare o eliminare. */}
          <fieldset disabled={readOnly} className="contents">
            {!def.autoPk &&
              (row ? (
                <Field label={def.pkRef ? "Brano (id)" : "Id"} className="sm:col-span-2">
                  <input className={`${inputClass} font-mono`} value={id ?? ""} disabled />
                </Field>
              ) : (
                <Field
                  label={def.pkRef ? "Brano (id)" : "Id"}
                  help="Minuscole, cifre e - _ . Non si cambia più dopo il salvataggio."
                  className="sm:col-span-2"
                >
                  <RefInput
                    refTable={def.pkRef}
                    value={newId}
                    onChange={setNewId}
                    required
                    className="font-mono"
                  />
                </Field>
              ))}
            {def.columns.map((c) => (
              <ColumnInput
                key={c.name}
                c={c}
                value={values[c.name] ?? ""}
                onChange={(v) => setValues({ ...values, [c.name]: v })}
              />
            ))}
          </fieldset>
          <div className="sm:col-span-2">
            <Errors errors={errors} />
          </div>
          <div className="flex flex-wrap justify-between gap-2 sm:col-span-2">
            {row && !readOnly ? (
              <Button type="button" variant="ghost" className="text-destructive" onClick={remove}>
                <Trash2 /> Elimina
              </Button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={onClose}>
                {readOnly ? "Chiudi" : "Annulla"}
              </Button>
              {!readOnly && (
                <Button type="submit" disabled={busy}>
                  {busy ? "Salvataggio…" : "Salva"}
                </Button>
              )}
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ColumnInput({
  c,
  value,
  onChange,
}: {
  c: Column;
  value: string | boolean;
  onChange: (v: string | boolean) => void;
}) {
  const label = `${c.label}${c.required ? " *" : ""}`;
  if (c.type === "bool")
    return (
      <label className="flex items-center gap-2 self-end text-sm">
        <input
          type="checkbox"
          checked={value === true}
          onChange={(e) => onChange(e.target.checked)}
        />{" "}
        {c.label}
      </label>
    );
  const v = typeof value === "string" ? value : "";
  if (c.type === "long")
    return (
      <Field label={label} help={c.help} className="sm:col-span-2">
        <textarea
          className={inputClass}
          rows={4}
          value={v}
          onChange={(e) => onChange(e.target.value)}
          required={c.required}
          maxLength={20000}
        />
      </Field>
    );
  if (c.options)
    return (
      <Field label={label} help={c.help}>
        <select
          className={inputClass}
          value={v}
          onChange={(e) => onChange(e.target.value)}
          required={c.required}
        >
          <option value="">—</option>
          {c.options.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      </Field>
    );
  return (
    <Field label={label} help={c.help} className={c.type === "url" ? "sm:col-span-2" : undefined}>
      <RefInput
        refTable={c.ref}
        value={v}
        onChange={onChange}
        required={c.required}
        inputMode={c.type === "int" ? "numeric" : undefined}
      />
    </Field>
  );
}

/** Campo di testo; se punta a un'altra tabella propone gli id esistenti. */
function RefInput({
  refTable,
  value,
  onChange,
  required,
  className,
  inputMode,
}: {
  refTable?: TableName | undefined;
  value: string;
  onChange: (v: string) => void;
  required?: boolean | undefined;
  className?: string | undefined;
  inputMode?: "numeric" | undefined;
}) {
  const options = useQuery({
    queryKey: ["gestionale", "options", refTable],
    queryFn: () => tableOptions({ data: { table: refTable } }),
    enabled: !!refTable,
    staleTime: 60_000,
  });
  const listId = refTable ? `opzioni-${refTable}` : undefined;
  return (
    <>
      <input
        className={`${inputClass} ${className ?? ""}`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        list={listId}
        inputMode={inputMode}
        maxLength={500}
      />
      {listId && (
        <datalist id={listId}>
          {(options.data ?? []).map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </datalist>
      )}
    </>
  );
}
