import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { clearSession, clearLastProfile } from "@/lib/session";
import { Logo } from "@/components/logo";
import { QrCode } from "lucide-react";

export const Route = createFileRoute("/c/$companySlug/desconexao")({
  component: DesconexaoPage,
});

function DesconexaoPage() {
  const { companySlug } = Route.useParams();

  useEffect(() => {
    clearSession();
    clearLastProfile();
  }, []);

  return (
    <div className="flex min-h-[80vh] flex-col items-center justify-center px-6 text-center">
      <div className="mb-8">
        <Logo className="h-12 w-auto" />
      </div>

      <div className="space-y-4 max-w-sm">
        <div className="mx-auto grid size-16 place-items-center rounded-full bg-primary/10">
          <QrCode className="size-8 text-primary" />
        </div>

        <h1 className="font-poppins text-2xl font-bold tracking-tight">
          Muito obrigado pela sua visita!
        </h1>

        <p className="text-sm text-muted-foreground leading-relaxed">
          Sua sessão foi encerrada. Para acessar novamente, escaneie o{" "}
          <strong>QR code</strong> ou acesse pelo <strong>link</strong> fornecido pelo estabelecimento.
        </p>

        <div className="pt-4">
          <Link
            to="/c/$companySlug"
            params={{ companySlug }}
            className="inline-flex items-center justify-center rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Fazer check-in novamente
          </Link>
        </div>
      </div>
    </div>
  );
}
