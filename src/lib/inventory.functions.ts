import { createServerFn } from "@tanstack/react-start";
import { cleanText, inputFields, inputObject } from "./safe-url";
import {
  cartProblems,
  MOVEMENT_KINDS,
  PAYMENTS,
  type MovementKind,
  type Payment,
  type Shop,
} from "./shop";
import { db, dbErrorMessage } from "./server/db.server";
import { audit, requireStaff } from "./server/auth.server";

// Negozio e magazzino: prodotti, movimenti di giacenza, vendite al banco, riepilogo e negozi online.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const uuidOrNull = (v: unknown) => (typeof v === "string" && UUID.test(v) ? v : null);
const int = (v: unknown, min: number, max: number) => {
  const n =
    typeof v === "number"
      ? v
      : typeof v === "string" && /^-?\d{1,10}$/.test(v.trim())
        ? Number(v)
        : NaN;
  return Number.isInteger(n) && n >= min && n <= max ? n : null;
};
const likePattern = (q: string) => `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

export type Product = {
  id: string;
  sku: string;
  name: string;
  category: string;
  brand: string;
  model_id: string | null;
  supplier_id: string | null;
  supplier_name: string | null;
  cost_cents: number;
  price_cents: number;
  vat: number;
  stock: number;
  min_stock: number;
  location: string;
  notes: string;
  active: boolean;
  updated_at: string;
};

export const listProducts = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => {
    const o = inputFields<"includeInactive" | "lowOnly" | "q">(d);
    return {
      q: cleanText(o.q, 100),
      lowOnly: o.lowOnly === true,
      includeInactive: o.includeInactive === true,
    };
  })
  .handler(async ({ data }) => {
    await requireStaff(["magazzino", "vendite"]);
    const sql = db();
    const q = data.q ? likePattern(data.q) : null;
    return sql<Product[]>`
      select p.id, p.sku, p.name, p.category, p.brand, p.model_id, p.supplier_id, s.name as supplier_name,
             p.cost_cents, p.price_cents, p.vat, p.stock, p.min_stock, p.location, p.notes, p.active, p.updated_at::text
      from products p left join suppliers s on s.id = p.supplier_id
      where (${data.includeInactive} or p.active)
        and (${q}::text is null or p.name ilike ${q} or p.sku ilike ${q} or p.brand ilike ${q} or p.category ilike ${q})
        and (not ${data.lowOnly} or p.stock <= p.min_stock)
      order by p.name limit 500`;
  });

export const saveProduct = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => {
    const o = inputFields<
      | "active"
      | "brand"
      | "category"
      | "cost_cents"
      | "id"
      | "initial_stock"
      | "location"
      | "min_stock"
      | "model_id"
      | "name"
      | "notes"
      | "price_cents"
      | "sku"
      | "supplier_id"
      | "vat"
    >(d);
    return {
      id: uuidOrNull(o.id),
      sku: cleanText(o.sku, 60),
      name: cleanText(o.name, 200),
      category: cleanText(o.category, 60) || "Accessori",
      brand: cleanText(o.brand, 80),
      model_id: cleanText(o.model_id, 120) || null,
      supplier_id: uuidOrNull(o.supplier_id),
      cost_cents: int(o.cost_cents, 0, 2_000_000_000),
      price_cents: int(o.price_cents, 0, 2_000_000_000),
      vat: int(o.vat, 0, 100),
      min_stock: int(o.min_stock, 0, 1_000_000),
      initial_stock: int(o.initial_stock ?? 0, 0, 1_000_000),
      location: cleanText(o.location, 80),
      notes: cleanText(o.notes, 2000),
      active: o.active !== false,
    };
  })
  .handler(async ({ data }): Promise<{ ok: true; id: string } | { ok: false; error: string }> => {
    const me = await requireStaff("magazzino");
    if (!data.sku || !data.name)
      return { ok: false, error: "Codice (SKU) e nome sono obbligatori." };
    if (data.cost_cents === null || data.price_cents === null)
      return { ok: false, error: "Prezzi non validi." };
    if (data.vat === null || data.min_stock === null || data.initial_stock === null)
      return { ok: false, error: "Valori numerici non validi." };
    const sql = db();
    const fields = {
      sku: data.sku,
      name: data.name,
      category: data.category,
      brand: data.brand,
      model_id: data.model_id,
      supplier_id: data.supplier_id,
      cost_cents: data.cost_cents,
      price_cents: data.price_cents,
      vat: data.vat,
      min_stock: data.min_stock,
      location: data.location,
      notes: data.notes,
      active: data.active,
    };
    try {
      const id = await sql.begin(async (tx) => {
        if (data.id) {
          const res =
            await tx`update products set ${tx(fields)}, updated_at = now() where id = ${data.id}`;
          if (!res.count) throw new Error("NON_TROVATO");
          return data.id;
        }
        const [p] = await tx<
          { id: string }[]
        >`insert into products ${tx({ ...fields, stock: data.initial_stock })} returning id`;
        if (data.initial_stock) {
          await tx`insert into stock_movements (product_id, quantity, kind, note, user_id)
                   values (${p!.id}, ${data.initial_stock}, 'carico', 'Giacenza iniziale', ${me.id})`;
        }
        return p!.id;
      });
      await audit(me, data.id ? "modifica prodotto" : "nuovo prodotto", "products", id, data.sku);
      return { ok: true, id };
    } catch (e) {
      if (e instanceof Error && e.message === "NON_TROVATO")
        return { ok: false, error: "Il prodotto non esiste più." };
      if (typeof e === "object" && e && "code" in e && (e as { code: string }).code === "23503")
        return { ok: false, error: "Modello del catalogo o fornitore inesistente." };
      return { ok: false, error: dbErrorMessage(e) };
    }
  });

/** Carico, scarico, reso o rettifica: la giacenza cambia insieme al movimento, nella stessa transazione. */
export const addStockMovement = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => {
    const o = inputFields<"kind" | "note" | "productId" | "quantity">(d);
    const kind =
      typeof o.kind === "string" && o.kind in MOVEMENT_KINDS && o.kind !== "vendita"
        ? (o.kind as MovementKind)
        : null;
    return {
      productId: uuidOrNull(o.productId),
      kind,
      quantity: int(o.quantity, -1_000_000, 1_000_000),
      note: cleanText(o.note, 300),
    };
  })
  .handler(
    async ({ data }): Promise<{ ok: true; stock: number } | { ok: false; error: string }> => {
      const me = await requireStaff("magazzino");
      if (!data.productId || !data.kind || !data.quantity)
        return { ok: false, error: "Dati del movimento non validi." };
      const sign = MOVEMENT_KINDS[data.kind].sign;
      // Carico/reso sempre in entrata, scarico sempre in uscita; la rettifica usa il segno indicato.
      const qty = sign === 0 ? data.quantity : sign * Math.abs(data.quantity);
      const sql = db();
      try {
        const stock = await sql.begin(async (tx) => {
          const [p] = await tx<
            { stock: number }[]
          >`select stock from products where id = ${data.productId} for update`;
          if (!p) throw new Error("NON_TROVATO");
          if (p.stock + qty < 0) throw new Error("GIACENZA");
          await tx`insert into stock_movements (product_id, quantity, kind, note, user_id) values (${data.productId}, ${qty}, ${data.kind!}, ${data.note}, ${me.id})`;
          const [u] = await tx<
            { stock: number }[]
          >`update products set stock = stock + ${qty}, updated_at = now() where id = ${data.productId} returning stock`;
          return u!.stock;
        });
        await audit(me, data.kind, "stock_movements", data.productId, String(qty));
        return { ok: true, stock };
      } catch (e) {
        if (e instanceof Error && e.message === "NON_TROVATO")
          return { ok: false, error: "Prodotto non trovato." };
        if (e instanceof Error && e.message === "GIACENZA")
          return { ok: false, error: "La giacenza non può diventare negativa." };
        return { ok: false, error: dbErrorMessage(e) };
      }
    },
  );

export type Movement = {
  id: string;
  created_at: string;
  product_id: string;
  product_name: string;
  sku: string;
  quantity: number;
  kind: MovementKind;
  note: string;
  username: string | null;
  sale_number: number | null;
};

export const listMovements = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => ({
    productId: uuidOrNull(inputFields<"productId">(d).productId),
  }))
  .handler(async ({ data }) => {
    await requireStaff("magazzino");
    return db()<Movement[]>`
      select m.id, m.created_at::text, m.product_id, p.name as product_name, p.sku, m.quantity, m.kind, m.note,
             u.username, s.number as sale_number
      from stock_movements m join products p on p.id = m.product_id
      left join staff_users u on u.id = m.user_id left join sales s on s.id = m.sale_id
      where (${data.productId}::uuid is null or m.product_id = ${data.productId})
      order by m.created_at desc limit 300`;
  });

// --- Vendite ---------------------------------------------------------------------------------------
/** Errore con messaggio da mostrare a chi vende. */
class SaleError extends Error {}

export const createSale = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => {
    const o = inputFields<"customerId" | "lines" | "note" | "payment">(d);
    const lines = (Array.isArray(o.lines) ? o.lines.slice(0, 100) : []).map((l) => {
      const x = inputFields<"productId" | "quantity" | "unitPriceCents">(l);
      return {
        productId: uuidOrNull(x.productId) ?? "",
        quantity: int(x.quantity, 1, 10_000) ?? 0,
        unitPriceCents: int(x.unitPriceCents, 0, 2_000_000_000) ?? -1,
      };
    });
    const payment =
      typeof o.payment === "string" && o.payment in PAYMENTS ? (o.payment as Payment) : null;
    return { lines, payment, customerId: uuidOrNull(o.customerId), note: cleanText(o.note, 300) };
  })
  .handler(
    async ({ data }): Promise<{ ok: true; number: number } | { ok: false; error: string }> => {
      const me = await requireStaff("vendite");
      if (!data.payment) return { ok: false, error: "Scegli il metodo di pagamento." };
      if (data.lines.some((l) => !l.productId || l.quantity <= 0 || l.unitPriceCents < 0))
        return { ok: false, error: "Righe del carrello non valide." };
      const sql = db();
      try {
        const sale = await sql.begin(async (tx) => {
          const ids = [...new Set(data.lines.map((l) => l.productId))];
          // Righe bloccate fino alla fine: due vendite insieme non possono superare la giacenza.
          const products = ids.length
            ? await tx<
                { id: string; name: string; stock: number; active: boolean }[]
              >`select id, name, stock, active from products where id in ${tx(ids)} order by id for update`
            : [];
          const problems = cartProblems(
            data.lines,
            new Map(products.filter((p) => p.active).map((p) => [p.id, p])),
          );
          if (problems.length) throw new SaleError(problems.join(" "));
          const total = data.lines.reduce((t, l) => t + l.quantity * l.unitPriceCents, 0);
          if (total > 2_000_000_000) throw new SaleError("Totale troppo alto.");
          const [s] = await tx<{ id: string; number: number }[]>`
          insert into sales (customer_id, user_id, payment, total_cents, note)
          values (${data.customerId}, ${me.id}, ${data.payment!}, ${total}, ${data.note}) returning id, number`;
          for (const l of data.lines) {
            await tx`insert into sale_items (sale_id, product_id, quantity, unit_price_cents) values (${s!.id}, ${l.productId}, ${l.quantity}, ${l.unitPriceCents})`;
            await tx`insert into stock_movements (product_id, quantity, kind, note, sale_id, user_id) values (${l.productId}, ${-l.quantity}, 'vendita', '', ${s!.id}, ${me.id})`;
            await tx`update products set stock = stock - ${l.quantity}, updated_at = now() where id = ${l.productId}`;
          }
          return s!;
        });
        await audit(me, "vendita", "sales", sale.id, `n. ${sale.number}`);
        return { ok: true, number: sale.number };
      } catch (e) {
        if (e instanceof SaleError) return { ok: false, error: e.message };
        return { ok: false, error: dbErrorMessage(e) };
      }
    },
  );
export type SaleRow = {
  id: string;
  number: number;
  created_at: string;
  payment: Payment;
  total_cents: number;
  note: string;
  canceled_at: string | null;
  customer_name: string | null;
  username: string | null;
  items: { name: string; sku: string; quantity: number; unit_price_cents: number }[];
};

export const listSales = createServerFn({ method: "GET" }).handler(async () => {
  await requireStaff("vendite");
  return db()<SaleRow[]>`
    select s.id, s.number, s.created_at::text, s.payment, s.total_cents, s.note, s.canceled_at::text,
           c.full_name as customer_name, u.username,
           coalesce((select json_agg(json_build_object('name', p.name, 'sku', p.sku, 'quantity', i.quantity, 'unit_price_cents', i.unit_price_cents) order by p.name)
                     from sale_items i join products p on p.id = i.product_id where i.sale_id = s.id), '[]'::json) as items
    from sales s left join customers c on c.id = s.customer_id left join staff_users u on u.id = s.user_id
    order by s.created_at desc limit 200`;
});

/** Annulla una vendita: la merce torna in giacenza con un movimento di reso. */
export const cancelSale = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => ({ id: uuidOrNull(inputFields<"id">(d).id) }))
  .handler(async ({ data }): Promise<{ ok: true } | { ok: false; error: string }> => {
    const me = await requireStaff("magazzino");
    if (!data.id) return { ok: false, error: "Vendita non valida." };
    const sql = db();
    try {
      const number = await sql.begin(async (tx) => {
        const [s] = await tx<
          { number: number; canceled_at: string | null }[]
        >`select number, canceled_at from sales where id = ${data.id} for update`;
        if (!s) throw new SaleError("Vendita non trovata.");
        if (s.canceled_at) throw new SaleError("Vendita già annullata.");
        const items = await tx<
          { product_id: string; quantity: number }[]
        >`select product_id, quantity from sale_items where sale_id = ${data.id}`;
        for (const i of items) {
          await tx`insert into stock_movements (product_id, quantity, kind, note, sale_id, user_id)
                   values (${i.product_id}, ${i.quantity}, 'reso', ${`Annullo vendita n. ${s.number}`}, ${data.id}, ${me.id})`;
          await tx`update products set stock = stock + ${i.quantity}, updated_at = now() where id = ${i.product_id}`;
        }
        await tx`update sales set canceled_at = now() where id = ${data.id}`;
        return s.number;
      });
      await audit(me, "annullo vendita", "sales", data.id, `n. ${number}`);
      return { ok: true };
    } catch (e) {
      if (e instanceof SaleError) return { ok: false, error: e.message };
      return { ok: false, error: dbErrorMessage(e) };
    }
  });

// --- Riepilogo e negozi online --------------------------------------------------------------------
export type Dashboard = {
  products: number;
  units: number;
  stockValueCents: number;
  lowStock: { id: string; name: string; sku: string; stock: number; min_stock: number }[];
  todayCents: number;
  todaySales: number;
  monthCents: number;
  monthSales: number;
  last30: { day: string; cents: number }[];
  top: { name: string; quantity: number; cents: number }[];
};

export const getDashboard = createServerFn({ method: "GET" }).handler(
  async (): Promise<Dashboard> => {
    await requireStaff(["magazzino", "vendite"]);
    const sql = db();
    const [[totals], lowStock, [today], [month], last30, top] = await Promise.all([
      sql<{ products: number; units: number; value: number }[]>`
      select count(*)::int as products, coalesce(sum(stock), 0)::int8 as units, coalesce(sum(stock::int8 * cost_cents), 0)::int8 as value from products where active`,
      sql<
        Dashboard["lowStock"]
      >`select id, name, sku, stock, min_stock from products where active and stock <= min_stock order by stock, name limit 20`,
      sql<
        { cents: number; n: number }[]
      >`select coalesce(sum(total_cents), 0)::int8 as cents, count(*)::int as n from sales where canceled_at is null and created_at >= date_trunc('day', now())`,
      sql<
        { cents: number; n: number }[]
      >`select coalesce(sum(total_cents), 0)::int8 as cents, count(*)::int as n from sales where canceled_at is null and created_at >= date_trunc('month', now())`,
      sql<{ day: string; cents: number }[]>`
      select d::date::text as day, coalesce(sum(s.total_cents), 0)::int8 as cents
      from generate_series(date_trunc('day', now()) - interval '29 days', date_trunc('day', now()), interval '1 day') d
      left join sales s on s.canceled_at is null and date_trunc('day', s.created_at) = d
      group by d order by d`,
      sql<Dashboard["top"]>`
      select p.name, sum(i.quantity)::int as quantity, sum(i.quantity::int8 * i.unit_price_cents)::int8 as cents
      from sale_items i join sales s on s.id = i.sale_id join products p on p.id = i.product_id
      where s.canceled_at is null and s.created_at >= now() - interval '30 days'
      group by p.name order by quantity desc limit 5`,
    ]);
    return {
      products: totals?.products ?? 0,
      units: totals?.units ?? 0,
      stockValueCents: totals?.value ?? 0,
      lowStock,
      todayCents: today?.cents ?? 0,
      todaySales: today?.n ?? 0,
      monthCents: month?.cents ?? 0,
      monthSales: month?.n ?? 0,
      last30,
      top,
    };
  },
);

export const listShops = createServerFn({ method: "GET" }).handler(async () => {
  await requireStaff();
  return db()<
    Shop[]
  >`select id, name, website, search_url, description from shops order by sort, name`;
});

/** Clienti e fornitori per i menu del gestionale. */
export const listContacts = createServerFn({ method: "GET" }).handler(async () => {
  const me = await requireStaff(["magazzino", "vendite"]);
  const sql = db();
  const [customers, suppliers] = await Promise.all([
    sql<
      { id: string; label: string }[]
    >`select id, full_name as label from customers order by full_name limit 5000`,
    me.role === "vendite"
      ? Promise.resolve([])
      : sql<
          { id: string; label: string }[]
        >`select id, name as label from suppliers order by name limit 5000`,
  ]);
  return { customers, suppliers };
});
