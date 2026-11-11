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

  it("inoltra metodo e corpo delle richieste POST (funzioni del server)", async () => {
    const res = await server.fetch(new Request("http://localhost:8080/_serverFn/x", { method: "POST", body: "dati" }), {}, {});
    expect(await res.text()).toBe("ok POST dati");
  });
});
