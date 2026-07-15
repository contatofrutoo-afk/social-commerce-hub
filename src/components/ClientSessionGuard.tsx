import { useState, useEffect, useCallback } from "react";
import { useNavigate, useParams } from "@tanstack/react-router";
import { getSessionForCompany, clearSession, clearLastProfile, getSessionRemainingMs } from "@/lib/session";
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

  const redirectToCheckin = useCallback(() => {
    clearSession();
    clearLastProfile();
    navigate({ to: "/c/$companySlug", params: { companySlug } });
  }, [companySlug, navigate]);

  useEffect(() => {
    const remaining = getSessionRemainingMs();
    if (remaining === null) return;

    if (remaining <= 0) {
      setExpired(true);
      setCountdown("00:00");
      clearSession();
      clearLastProfile();
      navigate({ to: "/c/$companySlug", params: { companySlug } });
      return;
    }

    setCountdown(formatTimeRemaining(remaining));
    setShowWarning(remaining <= SESSION_WARNING_MS);
  }, [companySlug, navigate]);

  useEffect(() => {
    const session = getSessionForCompany(companySlug);
    if (!session?.createdAt) return;

    const check = () => {
      const remaining = getSessionRemainingMs();
      if (remaining === null) return;

      if (remaining <= 0) {
        setExpired(true);
        setCountdown("00:00");
        clearSession();
        clearLastProfile();
        navigate({ to: "/c/$companySlug", params: { companySlug } });
        return;
      }

      setCountdown(formatTimeRemaining(remaining));
      setShowWarning(remaining <= SESSION_WARNING_MS);
    };

    check();
    const interval = setInterval(check, CHECK_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [companySlug, navigate]);

  useEffect(() => {
    const session = getSessionForCompany(companySlug);
    if (!session?.createdAt || expired) return;

    const tick = () => {
      const remaining = getSessionRemainingMs();
      if (remaining === null || remaining <= 0) {
        setExpired(true);
        setCountdown("00:00");
        clearSession();
        clearLastProfile();
        navigate({ to: "/c/$companySlug", params: { companySlug } });
        return;
      }
      setCountdown(formatTimeRemaining(remaining));
      setShowWarning(remaining <= SESSION_WARNING_MS);
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [companySlug, expired, navigate]);

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
              onClick={redirectToCheckin}
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
              onClick={redirectToCheckin}
            >
              Fazer check-in novamente
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
