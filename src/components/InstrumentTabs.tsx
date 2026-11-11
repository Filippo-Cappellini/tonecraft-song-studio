import { useQuery } from "@tanstack/react-query";
import { instrumentsQuery } from "@/lib/catalog";

export function InstrumentTabs({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { data } = useQuery(instrumentsQuery);
  return (
    <div className="inline-flex rounded-full bg-secondary p-1">
      {(data ?? []).map((i) => (
        <button key={i.id} onClick={() => onChange(i.id)}
          className={`rounded-full px-4 py-1.5 text-sm transition-all ${value === i.id ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"}`}>
          {i.name.split(" ")[0]}
        </button>
      ))}
    </div>
  );
}
