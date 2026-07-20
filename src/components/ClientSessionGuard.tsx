import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate, useParams } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { getSessionForCompany, clearSession, clearLastProfile, getSessionRemainingMs } from "@/lib/session";
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
const TOKEN_CHECK_MS = 30 * 1000;

function formatTimeRemaining(ms: number): string {
  if (ms <= 0) return "00:00";
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export default function ClientSessionGuard() {
  const { companySlug } = useParams({ strict: false });
  const navigate = useNavigate();
  const [showWarning, setShowWarning] = useState(false);
  const [expired, setExpired] = useState(false);
  const [countdown, setCountdown] = useState("");
  const sessionRef = useRef(getSessionForCompany(companySlug));

  const redirectToDesconexão = useCallback(() => {
    clearSession();
    clearLastProfile();
    navigate({ to: "/c/$companySlug/desconexao", params: { companySlug } });
  }, [companySlug, navigate]);

  const redirectToCheckin = useCallback(() => {
    clearSession();
    clearLastProfile();
    navigate({ to: "/c/$companySlug", params: { companySlug } });
  }, [companySlug, navigate]);

  // ── Realtime: detecta rotação de session_token (checkout pelo staff) ──
  useEffect(() => {
    const session = sessionRef.current;
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
          // Token pode ter sido rotacionado — verifica no servidor
          customerRepository
            .findSelf(session.customerId, session.sessionToken)
            .then((data) => {
              if (!data) redirectToDesconexão();
            })
            .catch(() => redirectToDesconexão());
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [companySlug, redirectToDesconexão]);

  // ── Polling: verifica token no servidor a cada 30s (fallback do Realtime) ──
  useEffect(() => {
    const session = sessionRef.current;
    if (!session) return;

    const check = () => {
      customerRepository
        .findSelf(session.customerId, session.sessionToken)
        .then((data) => {
          if (!data) redirectToDesconexão();
        })
        .catch(() => redirectToDesconexão());
    };

    const interval = setInterval(check, TOKEN_CHECK_MS);
    return () => clearInterval(interval);
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
