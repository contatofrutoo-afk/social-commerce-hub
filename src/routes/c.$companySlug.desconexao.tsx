import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { clearSession, clearLastProfile } from "@/lib/session";
import { Logo } from "@/components/logo";
import { QrCode, Sparkles } from "lucide-react";

export const Route = createFileRoute("/c/$companySlug/desconexao")({
  component: DesconexaoPage,
  head: () => ({
    meta: [
      { title: "Sessão encerrada — weaze" },
      { name: "description", content: "Sua sessão foi encerrada. Escaneie o QR code para acessar novamente." },
    ],
  }),
});

function DesconexaoPage() {
  useEffect(() => {
    clearSession();
    clearLastProfile();
  }, []);

  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      {/* Halo animado de fundo */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-40 left-1/2 size-[560px] -translate-x-1/2 rounded-full bg-primary/25 blur-3xl" />
        <div className="absolute bottom-0 right-0 size-[380px] translate-x-1/3 translate-y-1/3 rounded-full bg-primary/15 blur-3xl" />
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)",
            backgroundSize: "28px 28px",
          }}
        />
      </div>

      <div className="relative z-10 mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center px-6 py-16 text-center">
        {/* Logotipo grande */}
        <div className="mb-10 flex flex-col items-center gap-3">
          <Logo className="h-40 w-auto sm:h-52 md:h-60 drop-shadow-[0_10px_40px_rgba(139,92,246,0.35)]" />
        </div>

        {/* Card central */}
        <div className="w-full rounded-3xl border border-border/60 bg-card/70 p-8 shadow-elegant backdrop-blur-xl sm:p-10">
          <div className="mx-auto mb-6 grid size-20 place-items-center rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 ring-1 ring-primary/20">
            <QrCode className="size-10 text-primary" />
          </div>

          <div className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-primary">
            <Sparkles className="size-3" />
            Sessão encerrada
          </div>

          <h1 className="mt-4 font-poppins text-3xl font-extrabold tracking-tight sm:text-4xl">
            Muito obrigado pela sua visita!
          </h1>

          <p className="mt-4 text-base leading-relaxed text-muted-foreground">
            Sua sessão foi encerrada com segurança. Para acessar novamente,
            escaneie o <strong className="text-foreground">QR code</strong> ou use o{" "}
            <strong className="text-foreground">link</strong> fornecido pelo estabelecimento.
          </p>

          <div className="mt-8 flex items-center justify-center gap-2 text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
            <span className="h-px w-8 bg-border" />
            powered by weaze
            <span className="h-px w-8 bg-border" />
          </div>
        </div>
      </div>
    </div>
  );
}
