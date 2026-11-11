import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { createIsomorphicFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { NONCE_HEADER } from "./lib/security-headers";
import { routeTree } from "./routeTree.gen";

// Nonce CSP della richiesta (impostato in src/server.ts). Sul client TanStack lo rilegge dal meta "csp-nonce".
const getCspNonce = createIsomorphicFn()
  .server(() => getRequest()?.headers.get(NONCE_HEADER) ?? undefined)
  .client(() => undefined);

export const getRouter = () => {
  const queryClient = new QueryClient();

  const nonce = getCspNonce();
  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
    ...(nonce ? { ssr: { nonce } } : {}),
  });

  return router;
};
