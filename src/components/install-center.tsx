import { useCallback, useEffect, useState } from "react";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/logo";
import { CheckCircle2, Download, Smartphone } from "lucide-react";
import { detectInstallCapability, usePwaInstall, type InstallCapability } from "@/lib/pwa";

type CenterCase = "install" | "ios" | "unsupported" | "installed";

/**
 * Central de Instalação da WEAZE.
 *
 * Detecta automaticamente o sistema operacional, o navegador e o suporte a
 * instalação PWA, e oferece a melhor forma de instalar a WEAZE sem perguntar
 * nada ao usuário:
 *
 *  - Chromium (Android/Windows/desktop): instalação nativa via beforeinstallprompt.
 *  - iPhone/iPad (Safari): instruções "Adicionar à Tela de Início".
 *  - Navegadores sem suporte: orientação para usar Chrome/Edge.
 *  - Já instalado: aviso de que a WEAZE está instalada.
 */
export function InstallCenter({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const { installing, install } = usePwaInstall();
  const [cap, setCap] = useState<InstallCapability>(() => detectInstallCapability());
  const [centerCase, setCenterCase] = useState<CenterCase>("install");
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const c = detectInstallCapability();
    setCap(c);
    setNotice(null);
    if (c.standalone) setCenterCase("installed");
    else if (!c.nativeSupported && c.platform === "ios") setCenterCase("ios");
    else if (!c.nativeSupported) setCenterCase("unsupported");
    else setCenterCase("install");
  }, [open]);

  const handleInstall = useCallback(async () => {
    setNotice(null);
    const result = await install();
    if (result === "installed") setCenterCase("installed");
    else if (result === "manual") {
      setNotice(
        "A instalação automática ainda não está liberada neste navegador. Tente novamente em alguns instantes.",
      );
    }
  }, [install]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm gap-5 overflow-hidden p-0">
        <div className="flex flex-col items-center px-6 pt-8 text-center">
          <div className="mb-4 grid size-16 place-items-center rounded-2xl bg-primary/10">
            <Logo className="h-10 w-auto" />
          </div>
          <DialogHeader>
            <DialogTitle className="text-xl">Instalar WEAZE</DialogTitle>
          </DialogHeader>
          <p className="mt-2 text-sm text-muted-foreground">
            Leve a WEAZE para sua tela inicial e acesse sua plataforma como um aplicativo, com
            apenas um toque.
          </p>
        </div>

        <div className="px-6 pb-6">
          {centerCase === "install" && (
            <div className="flex flex-col gap-3">
              <div className="rounded-lg border border-border/60 bg-muted/40 p-3 text-sm text-muted-foreground">
                {cap.platform === "android"
                  ? "No Android, a WEAZE será instalada como aplicativo na tela inicial do seu celular."
                  : "A WEAZE será instalada como aplicativo no seu computador (Menu Iniciar, Área de Trabalho ou Barra de Tarefas)."}
              </div>
              <Button
                size="lg"
                className="w-full rounded-full"
                disabled={installing}
                onClick={handleInstall}
              >
                <Download className="mr-2 size-4" />
                {installing ? "Instalando..." : "Instalar aplicativo"}
              </Button>
              {notice && <p className="text-center text-xs text-muted-foreground">{notice}</p>}
            </div>
          )}

          {centerCase === "ios" && (
            <div className="flex flex-col gap-3">
              <ol className="list-decimal space-y-2 pl-5 text-left text-sm text-muted-foreground">
                <li>Toque no botão Compartilhar (quadrado com seta para cima).</li>
                <li>
                  Escolha {"\u201c"}Adicionar à Tela de Início{"\u201d"}.
                </li>
                <li>
                  Confirme com {"\u201c"}Adicionar{"\u201d"}.
                </li>
              </ol>
              <p className="text-center text-xs text-muted-foreground">
                Após isso, a WEAZE ficará instalada como aplicativo no seu iPhone ou iPad.
              </p>
            </div>
          )}

          {centerCase === "unsupported" && (
            <div className="flex flex-col gap-3 text-center">
              <Smartphone className="mx-auto size-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Seu navegador não suporta instalação automática.
              </p>
              <p className="text-sm text-muted-foreground">
                Utilize Chrome ou Microsoft Edge para instalar a WEAZE como aplicativo.
              </p>
            </div>
          )}

          {centerCase === "installed" && (
            <div className="flex flex-col gap-3 text-center">
              <CheckCircle2 className="mx-auto size-8 text-primary" />
              <p className="text-sm text-muted-foreground">
                A WEAZE já está instalada neste dispositivo.
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
