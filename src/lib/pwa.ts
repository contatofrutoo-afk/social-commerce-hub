import { useCallback, useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

const INSTALLABLE_EVENT = "weaze:pwa-installable";

let deferredPrompt: BeforeInstallPromptEvent | null = null;
let installable = false;

/** Registra o Service Worker e captura o evento nativo de instalação do PWA. */
export function registerPwa(): void {
  if (typeof window === "undefined") return;
  if (!("serviceWorker" in navigator)) return;

  const isSecure =
    window.location.protocol === "https:" ||
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1";
  if (!isSecure) return;

  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js", { updateViaCache: "none" }).catch(() => {});
  });

  window.addEventListener("beforeinstallprompt", (e: Event) => {
    e.preventDefault();
    deferredPrompt = e as BeforeInstallPromptEvent;
    installable = true;
    window.dispatchEvent(new Event(INSTALLABLE_EVENT));
  });

  window.addEventListener("appinstalled", () => {
    installable = false;
    deferredPrompt = null;
    window.dispatchEvent(new Event(INSTALLABLE_EVENT));
  });
}

function detectStandalone(): boolean {
  if (typeof window === "undefined") return false;
  if (window.matchMedia("(display-mode: standalone)").matches) return true;
  return "standalone" in navigator && Boolean((navigator as { standalone?: boolean }).standalone);
}

export type InstallResult = "installed" | "dismissed" | "manual";

/**
 * Aguarda o navegador disparar `beforeinstallprompt`. O Chrome só emite esse
 * evento após o primeiro gesto do usuário na página — o clique no botão é esse
 * gesto. Assim, sem um prompt já capturado, o clique aguarda alguns segundos
 * para disparar o diálogo nativo em vez de cair direto no guia manual.
 */
function waitForInstallPrompt(timeoutMs: number): Promise<BeforeInstallPromptEvent | null> {
  if (deferredPrompt) return Promise.resolve(deferredPrompt);
  return new Promise((resolve) => {
    const cleanup = (prompt: BeforeInstallPromptEvent | null) => {
      window.clearTimeout(timeout);
      window.removeEventListener("beforeinstallprompt", onEvent);
      resolve(prompt ?? deferredPrompt);
    };
    const timeout = window.setTimeout(() => cleanup(null), timeoutMs);
    function onEvent(e: Event) {
      cleanup(e as BeforeInstallPromptEvent);
    }
    window.addEventListener("beforeinstallprompt", onEvent);
  });
}

/**
 * Botão "Baixar aplicativo": fica visível em qualquer navegador, oculto apenas
 * quando o WEAZE já está aberto como aplicativo instalado.
 */
export function usePwaInstall(): {
  canInstall: boolean;
  installing: boolean;
  install: () => Promise<InstallResult>;
} {
  const [canInstall, setCanInstall] = useState(false);
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    const sync = () => setCanInstall(!detectStandalone());
    sync();
    window.addEventListener(INSTALLABLE_EVENT, sync);
    const mq = window.matchMedia("(display-mode: standalone)");
    mq.addEventListener?.("change", sync);
    return () => {
      window.removeEventListener(INSTALLABLE_EVENT, sync);
      mq.removeEventListener?.("change", sync);
    };
  }, []);

  const install = useCallback(async (): Promise<InstallResult> => {
    setInstalling(true);
    try {
      const prompt = deferredPrompt ?? (await waitForInstallPrompt(3000));
      if (prompt) {
        deferredPrompt = prompt;
        await deferredPrompt.prompt();
        const choice = await deferredPrompt.userChoice;
        deferredPrompt = null;
        installable = false;
        window.dispatchEvent(new Event(INSTALLABLE_EVENT));
        return choice.outcome === "accepted" ? "installed" : "dismissed";
      }
      return "manual";
    } finally {
      setInstalling(false);
    }
  }, []);

  return { canInstall, installing, install };
}
