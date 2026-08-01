import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { acceptConsent } from "@/lib/consent";

/**
 * Tela de consentimento LGPD exibida ANTES do acesso ao Feed/Catálogo quando
 * o cliente entra pelo QR Code Geral ou QR Code da Mesa.
 * Não coleta nenhum dado pessoal: apenas registra localmente a aceitação.
 * Quando `busy`, permanece na tela (sem trocar de página) enquanto o
 * onboarding roda em segundo plano — evita flicker antes do feed.
 */
export function ConsentScreen({
  onAccepted,
  busy = false,
}: {
  onAccepted: () => void;
  busy?: boolean;
}) {
  const [terms, setTerms] = useState(false);
  const [privacy, setPrivacy] = useState(false);
  const canAccess = terms && privacy;

  function handleAccept() {
    if (busy) return;
    acceptConsent();
    onAccepted();
  }

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

      <div className="relative z-10 mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center px-6 py-12">
        <Logo className="mb-8 h-16 w-auto drop-shadow-[0_10px_40px_rgba(139,92,246,0.35)] sm:h-20" />

        <div className="w-full rounded-3xl border border-border/60 bg-card/70 p-6 shadow-elegant backdrop-blur-xl sm:p-8">
          <h1 className="font-poppins text-2xl font-extrabold tracking-tight sm:text-3xl">
            Bem-vindo à Weaze!
          </h1>

          <p className="mt-3 text-sm leading-relaxed text-muted-foreground sm:text-base">
            Utilizamos algumas informações de navegação e interação durante o uso
            da plataforma para melhorar sua experiência.
          </p>

          <div className="mt-6 space-y-4">
            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border/60 bg-background/60 p-4">
              <Checkbox
                checked={terms}
                onCheckedChange={(v) => setTerms(v === true)}
                className="mt-0.5"
              />
              <span className="text-sm leading-relaxed text-muted-foreground">
                Li e concordo com os{" "}
                <Link
                  to="/termos"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-primary underline"
                >
                  Termos de Uso
                </Link>
                .
              </span>
            </label>

            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border/60 bg-background/60 p-4">
              <Checkbox
                checked={privacy}
                onCheckedChange={(v) => setPrivacy(v === true)}
                className="mt-0.5"
              />
              <span className="text-sm leading-relaxed text-muted-foreground">
                Li e concordo com a{" "}
                <Link
                  to="/privacy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-primary underline"
                >
                  Política de Privacidade
                </Link>
                .
              </span>
            </label>
          </div>

          <Button
            className="mt-6 w-full"
            size="lg"
            disabled={!canAccess || busy}
            onClick={handleAccept}
          >
            {busy ? "Acessando..." : "Acessar"}
          </Button>
        </div>
      </div>
    </div>
  );
}
