import { createFileRoute } from "@tanstack/react-router";
import { finishGoogleLogin } from "@/lib/server/google.server";

// Ritorno da Google: controlli, account e sessione, poi redirect al gestionale (o ad /accedi con l'errore).
export const Route = createFileRoute("/api/google/ritorno")({
  server: { handlers: { GET: ({ request }) => finishGoogleLogin(request) } },
});
