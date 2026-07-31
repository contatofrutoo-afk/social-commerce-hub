import { createFileRoute, redirect } from "@tanstack/react-router";

// Rota legada — mantém links antigos funcionando.
export const Route = createFileRoute("/privacidade")({
  beforeLoad: () => {
    throw redirect({ to: "/privacy" });
  },
  component: () => null,
});
