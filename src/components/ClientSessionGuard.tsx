import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate, useParams } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import {
  getSessionForCompany,
  clearSession,
  clearLastProfile,
  getSessionRemainingMs,
  type WeazeSession,
} from "@/lib/session";
import { customerRepository } from "@/repositories";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Clock, LogOut } from "lucide-react";

const SESSION_WARNING_MS = 5 * 60 * 1000;
const CHECK_INTERVAL_MS = 60 * 1000;
const TOKEN_CHECK_MS = 15 * 1000;

function formatTimeRemaining(ms: number): string {
  if (ms <= 0) return "00:00";
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export default function ClientSessionGuard() {
  const { companySlug: companySlugParam } = useParams({ strict: false });
  const companySlug = companySlugParam ?? "";
  const navigate = useNavigate();
  const [showWarning, setShowWarning] = useState(false);
  const [expired, setExpired] = useState(false);
  const [countdown, setCountdown] = useState("");
  const [verifying, setVerifying] = useState(true);
  const [showVerifyingOverlay, setShowVerifyingOverlay] = useState(false);
  const redirectedRef = useRef(false);

  // Evita flash do overlay "Verificando sessao..." quando a verificação do token
  // é rápida (caso típico do acesso via QR, que acaba de criar a sessão).
  useEffect(() => {
    if (!verifying) {
      setShowVerifyingOverlay(false);
      return;
    }
    const t = window.setTimeout(() => setShowVerifyingOverlay(true), 300);
    return () => window.clearTimeout(t);
  }, [verifying]);

  const redirectToDesconexão = useCallback(() => {
    if (redirectedRef.current) return;
    redirectedRef.current = true;
    // Best-effort: notifica o servidor (encerra check-in ativo + rotaciona
    // token) para a saída refletir em tempo real na plataforma. Se o token já
    // foi invalidado (ex.: checkout pelo staff), a chamada falha em silêncio.
    const session = getSessionForCompany(companySlug);
    if (session) {
      customerRepository
        .logout(session.customerId, session.sessionToken, session.companyId)
        .catch(() => {});
    }
    clearSession();
    clearLastProfile();
    navigate({ to: "/c/$companySlug/desconexao", params: { companySlug } });
  }, [companySlug, navigate]);

  // ── Verificação do token ──
  // Um erro de rede/transição (restaurar aba, despertar o celular, servidor
  // momentaneamente lento) NÃO deve encerrar a sessão. Somente o servidor
  // rejeitando o token (RPC lança 'unauthorized') desloga o cliente.
  function isUnauthorizedError(e: unknown): boolean {
    const msg = (e instanceof Error ? e.message : String(e ?? "")).toLowerCase();
    return (
      msg.includes("unauthorized") ||
      msg.includes("permission denied") ||
      msg.includes("row-level security")
    );
  }

  async function checkSession(session: WeazeSession): Promise<"ok" | "unauthorized" | "error"> {
    try {
      const data = await customerRepository.findSelf(session.customerId, session.sessionToken);
      return data ? "ok" : "unauthorized";
    } catch (e) {
      return isUnauthorizedError(e) ? "unauthorized" : "error";
    }
  }

  // ── Verificação imediata do token ao montar ──
  useEffect(() => {
    const session = getSessionForCompany(companySlug);
    if (!session) {
      setVerifying(false);
      return;
    }
    let cancelled = false;

    const attempt = async (retries: number) => {
      const result = await checkSession(session);
      if (cancelled) return;
      if (result === "ok") {
        setVerifying(false);
        return;
      }
      if (result === "unauthorized") {
        redirectToDesconexão();
        return;
      }
      // Falha transitória: re-tenta com backoff (1s, 2s, 3s). Se persistir,
      // libera a página mesmo assim — o polling/realtime seguem verificando.
      if (retries > 0) {
        window.setTimeout(() => attempt(retries - 1), 1000 * (4 - retries));
        return;
      }
      setVerifying(false);
    };

    attempt(3);
    return () => {
      cancelled = true;
    };
  }, [companySlug, redirectToDesconexão]);

  // ── Realtime: detecta rotação de session_token (checkout pelo staff) ──
  useEffect(() => {
    const session = getSessionForCompany(companySlug);
    if (!session) return;

    const channel = supabase
      .channel(`session-guard-${session.customerId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "customers",
          filter: `id=eq.${session.customerId}`,
        },
        () => {
          checkSession(session).then((result) => {
            if (result === "unauthorized") redirectToDesconexão();
          });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [companySlug, redirectToDesconexão]);

  // ── Polling: verifica token no servidor a cada 15s ──
  useEffect(() => {
    const session = getSessionForCompany(companySlug);
    if (!session) return;

    const check = () => {
      checkSession(session).then((result) => {
        if (result === "unauthorized") redirectToDesconexão();
      });
    };

    const interval = setInterval(check, TOKEN_CHECK_MS);
    return () => clearInterval(interval);
  }, [companySlug, redirectToDesconexão]);

  // ── Ao voltar para a aba, revalida a sessão sem deslogar em erro de rede ──
  useEffect(() => {
    const session = getSessionForCompany(companySlug);
    if (!session) return;

    const onVisibility = () => {
      if (document.visibilityState !== "visible") return;
      checkSession(session).then((result) => {
        if (result === "unauthorized") redirectToDesconexão();
      });
    };

    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [companySlug, redirectToDesconexão]);

  // ── Timer: expiração de 7h ──
  useEffect(() => {
    const remaining = getSessionRemainingMs();
    if (remaining === null) return;

    if (remaining <= 0) {
      setExpired(true);
      setCountdown("00:00");
      redirectToDesconexão();
      return;
    }

    setCountdown(formatTimeRemaining(remaining));
    setShowWarning(remaining <= SESSION_WARNING_MS);
  }, [companySlug, redirectToDesconexão]);

  useEffect(() => {
    const session = getSessionForCompany(companySlug);
    if (!session?.createdAt) return;

    const check = () => {
      const remaining = getSessionRemainingMs();
      if (remaining === null) return;

      if (remaining <= 0) {
        setExpired(true);
        setCountdown("00:00");
        redirectToDesconexão();
        return;
      }

      setCountdown(formatTimeRemaining(remaining));
      setShowWarning(remaining <= SESSION_WARNING_MS);
    };

    check();
    const interval = setInterval(check, CHECK_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [companySlug, redirectToDesconexão]);

  useEffect(() => {
    const session = getSessionForCompany(companySlug);
    if (!session?.createdAt || expired) return;

    const tick = () => {
      const remaining = getSessionRemainingMs();
      if (remaining === null || remaining <= 0) {
        setExpired(true);
        setCountdown("00:00");
        redirectToDesconexão();
        return;
      }
      setCountdown(formatTimeRemaining(remaining));
      setShowWarning(remaining <= SESSION_WARNING_MS);
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [companySlug, expired, redirectToDesconexão]);

  // ── Enquanto verifica o token, bloqueia o conteúdo (após curto atraso) ──
  if (verifying && showVerifyingOverlay) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-background">
        <div className="text-sm text-muted-foreground animate-pulse">Verificando sessao...</div>
      </div>
    );
  }

  return (
    <>
      <AlertDialog open={showWarning && !expired}>
        <AlertDialogContent className="max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-orange-500" />
              Sessao expira em breve
            </AlertDialogTitle>
            <AlertDialogDescription className="text-center space-y-3">
              <p className="text-sm text-muted-foreground">
                Sua sessao sera encerrada automaticamente em:
              </p>
              <div className="text-4xl font-mono font-bold text-orange-500 tracking-wider">
                {countdown}
              </div>
              <p className="text-xs text-muted-foreground">
                Apos o encerramento, sera necessario fazer check-in novamente via QR code.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button
              variant="outline"
              className="w-full"
              onClick={redirectToDesconexão}
            >
              <LogOut className="w-4 h-4 mr-2" />
              Sair agora
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={expired}>
        <AlertDialogContent className="max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-red-600">
              <LogOut className="w-5 h-5" />
              Sessao encerrada
            </AlertDialogTitle>
            <AlertDialogDescription className="text-center">
              <p className="text-sm text-muted-foreground">
                Sua sessao expirou apos 7 horas de uso.
                Escaneie o QR code novamente para fazer check-in.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button
              className="w-full"
              onClick={redirectToDesconexão}
            >
              OK
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
