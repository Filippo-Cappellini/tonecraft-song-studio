import { describe, expect, it, vi } from "vitest";
import { NONCE_HEADER } from "@/lib/security-headers";

// Il vero gestore di TanStack Start viene sostituito: il test guarda solo cosa gli arriva.
const seen: Request[] = [];
vi.mock("@tanstack/react-start/server-entry", () => ({
  default: {
    fetch: async (req: Request) => {
      seen.push(req);
      return new Response(`ok ${req.method} ${await req.text()}`, { status: 200 });
    },
  },
}));

const { default: server } = await import("@/server");

describe("server.ts", () => {
  it("accetta una richiesta creata da un'altra implementazione di Request (errore 500 in sviluppo)", async () => {
    // Oggetto che somiglia a una Request ma non lo è: `new Request(questo, …)` falliva.
    const foreign = {
      url: "http://localhost:8080/brani",
      method: "GET",
      headers: new Headers({ accept: "text/html", [NONCE_HEADER]: "valore-del-client" }),
      body: null,
      signal: new AbortController().signal,
      redirect: "follow",
    } as unknown as Request;

    const res = await server.fetch(foreign, {}, {});
    expect(res.status).toBe(200);
    const got = seen.at(-1)!;
    expect(got.url).toBe("http://localhost:8080/brani");
    expect(got.headers.get("accept")).toBe("text/html");
    // Il nonce mandato dal client viene sempre sostituito da uno nuovo.
    expect(got.headers.get(NONCE_HEADER)).toBeTruthy();
    expect(got.headers.get(NONCE_HEADER)).not.toBe("valore-del-client");
  });

  it("passa all'app l'indirizzo del visitatore (serve al blocco dei tentativi di accesso)", async () => {
    const r = new Request("http://localhost:8080/brani", { headers: { "user-agent": "Firefox" } });
    Object.defineProperty(r, "ip", { value: "::ffff:192.168.50.30" });
    await server.fetch(r, {}, {});
    expect((seen.at(-1) as Request & { ip?: string }).ip).toBe("192.168.50.30");
  });

  it("guardia: chi scansiona riceve 403 e non arriva all'app, nemmeno dopo", async () => {
    const from = (path: string, ua: string) => {
      const r = new Request(`http://localhost:8080${path}`, { headers: { "user-agent": ua } });
      Object.defineProperty(r, "ip", { value: "192.168.50.99" });
      return r;
    };
    const before = seen.length;
    const first = await server.fetch(
      from("/", "Mozilla/5.0 (compatible; Nmap Scripting Engine)"),
      {},
      {},
    );
    expect(first.status).toBe(403);
    expect(await first.text()).toContain("192.168.50.99");
    const again = await server.fetch(from("/brani", "Firefox"), {}, {});
    expect(again.status).toBe(403);
    expect(seen.length).toBe(before);
  });

  it("inoltra metodo e corpo delle richieste POST (funzioni del server)", async () => {
    const res = await server.fetch(
      new Request("http://localhost:8080/_serverFn/x", { method: "POST", body: "dati" }),
      {},
      {},
    );
    expect(await res.text()).toBe("ok POST dati");
  });
});
