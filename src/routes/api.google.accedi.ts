import { createFileRoute } from "@tanstack/react-router";
import { startGoogleLogin } from "@/lib/server/google.server";

// Avvio dell'accesso con Google: redirect alla pagina di Google.
export const Route = createFileRoute("/api/google/accedi")({
  server: { handlers: { GET: () => startGoogleLogin() } },
});
