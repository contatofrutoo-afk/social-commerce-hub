import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { paymentService } from "@/services/payment";

export const Route = createFileRoute("/oauth/mercadopago/callback")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>) => ({
    code: typeof search.code === "string" && search.code ? search.code : undefined,
    state: typeof search.state === "string" && search.state ? search.state : undefined,
    error: typeof search.error === "string" && search.error ? search.error : undefined,
  }),
  component: CallbackPage,
  head: () => ({ meta: [{ title: "Conectando — WEAZE" }] }),
});

type Phase = "processing" | "success" | "cancelled" | "invalid_token" | "unavailable";

function CallbackPage() {
  const { code, state, error } = Route.useSearch();
  const [phase, setPhase] = useState<Phase>(error || !code ? "cancelled" : "processing");
  const [reason, setReason] = useState<string | null>(null);

  useEffect(() => {
    if (error || !code) return;

    let active = true;
    (async () => {
      try {
        const result = await paymentService.exchangeCode(code, state ?? "");
        if (!active) return;
        switch (result.status) {
          case "success":
            setPhase("success");
            break;
          case "unavailable":
            if ("reason" in result && result.reason) setReason(result.reason);
            setPhase("unavailable");
            break;
          case "invalid_state":
          case "invalid_token":
          case "unauthorized":
          default:
            if ("reason" in result && result.reason) setReason(result.reason);
            setPhase("invalid_token");
            break;
        }
      } catch (err) {
        if (active) {
          setReason(err instanceof Error ? err.message : String(err));
          setPhase("invalid_token");
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [code, state, error]);

  const content: Record<Phase, { icon: React.ReactNode; title: string; description: string }> = {
    processing: {
      icon: <Loader2 className="size-8 animate-spin text-muted-foreground" />,
      title: "Conectando ao Mercado Pago...",
      description: "Estamos conectando sua conta ao Mercado Pago, aguarde um instante...",
    },
    success: {
      icon: <CheckCircle2 className="size-8 text-emerald-500" />,
      title: "Conta conectada com sucesso!",
      description: "Sua conta do Mercado Pago já está vinculada ao painel financeiro.",
    },
    cancelled: {
      icon: <XCircle className="size-8 text-muted-foreground" />,
      title: "Conexão cancelada.",
      description: "Nenhuma conta foi conectada. Você pode tentar novamente quando quiser.",
    },
    invalid_token: {
      icon: <XCircle className="size-8 text-destructive" />,
      title: "Não foi possível conectar sua conta. Tente novamente.",
      description: reason
        ? `O Mercado Pago retornou: ${reason}.`
        : "O link de autorização pode ter expirado. Inicie uma nova conexão pelo painel.",
    },
    unavailable: {
      icon: <XCircle className="size-8 text-destructive" />,
      title: "Mercado Pago indisponível no momento.",
      description: reason
        ? `Detalhe: ${reason}.`
        : "Não foi possível concluir a conexão agora. Tente novamente em alguns instantes.",
    },
  };

  const { icon, title, description } = content[phase];

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/30 p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Mercado Pago</CardTitle>
          <CardDescription>Integração com o painel financeiro</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-4 text-center">
          <div>{icon}</div>
          <p className="text-lg font-semibold">{title}</p>
          <p className="text-sm text-muted-foreground">{description}</p>
          {phase !== "processing" && (
            <Button className="mt-2" asChild>
              <Link to="/app/financeiro">Voltar ao Financeiro</Link>
            </Button>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
