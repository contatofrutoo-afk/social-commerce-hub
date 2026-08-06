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

/** Botão "Baixar aplicativo": visível apenas quando o navegador suporta instalação. */
export function usePwaInstall(): {
  canInstall: boolean;
  install: () => Promise<boolean>;
} {
  const [canInstall, setCanInstall] = useState(installable);

  useEffect(() => {
    const sync = () => setCanInstall(installable);
    sync();
    window.addEventListener(INSTALLABLE_EVENT, sync);
    return () => window.removeEventListener(INSTALLABLE_EVENT, sync);
  }, []);

  const install = useCallback(async () => {
    if (!deferredPrompt) return false;
    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    installable = false;
    deferredPrompt = null;
    window.dispatchEvent(new Event(INSTALLABLE_EVENT));
    return choice.outcome === "accepted";
  }, []);

  return { canInstall, install };
}
