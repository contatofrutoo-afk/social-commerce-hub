import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
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

const SESSION_DURATION_MS = 7 * 60 * 60 * 1000;
const SESSION_WARNING_MS = 5 * 60 * 1000;
const SESSION_TIMESTAMP_KEY = "weaze:login_timestamp";
const CHECK_INTERVAL_MS = 60 * 1000;

function formatTimeRemaining(ms: number): string {
  if (ms <= 0) return "00:00";
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function getStoredTimestamp(): number | null {
  const raw = localStorage.getItem(SESSION_TIMESTAMP_KEY);
  if (!raw) return null;
  const ts = Number(raw);
  return isNaN(ts) ? null : ts;
}

function getExpiry(ts: number): number {
  return ts + SESSION_DURATION_MS;
}

export default function SessionTimeoutGuard() {
  const navigate = useNavigate();
  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  const [showWarning, setShowWarning] = useState(false);
  const [expired, setExpired] = useState(false);
  const [countdown, setCountdown] = useState("");

  const forceLogout = useCallback(async () => {
    setExpired(true);
    setCountdown("00:00");
    localStorage.removeItem(SESSION_TIMESTAMP_KEY);
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  }, [navigate]);

  const handleLogout = useCallback(async () => {
    localStorage.removeItem(SESSION_TIMESTAMP_KEY);
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  }, [navigate]);

  useEffect(() => {
    const ts = getStoredTimestamp();
    if (!ts) {
      localStorage.setItem(SESSION_TIMESTAMP_KEY, String(Date.now()));
      setExpiresAt(getExpiry(Date.now()));
      return;
    }
    setExpiresAt(getExpiry(ts));
  }, []);

  useEffect(() => {
    if (!expiresAt) return;

    const check = () => {
      const now = Date.now();
      const remaining = expiresAt - now;

      if (remaining <= 0) {
        setExpired(true);
        setCountdown("00:00");
        localStorage.removeItem(SESSION_TIMESTAMP_KEY);
        supabase.auth.signOut().then(() => navigate({ to: "/auth" }));
        return;
      }

      setCountdown(formatTimeRemaining(remaining));
      setShowWarning(remaining <= SESSION_WARNING_MS);
    };

    check();
    const interval = setInterval(check, CHECK_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [expiresAt, navigate]);

  useEffect(() => {
    if (!expiresAt || expired) return;

    const tick = () => {
      const remaining = expiresAt - Date.now();
      if (remaining <= 0) {
        setExpired(true);
        setCountdown("00:00");
        localStorage.removeItem(SESSION_TIMESTAMP_KEY);
        supabase.auth.signOut().then(() => navigate({ to: "/auth" }));
        return;
      }
      setCountdown(formatTimeRemaining(remaining));
      setShowWarning(remaining <= SESSION_WARNING_MS);
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [expiresAt, expired, navigate]);

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
                Salve seu trabalho. Apos o encerramento, sera necessario acessar novamente via QR code ou link.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button
              variant="outline"
              className="w-full"
              onClick={handleLogout}
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
                Acesse novamente escaneando o QR code ou usando o link.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button
              className="w-full"
              onClick={() => navigate({ to: "/auth" })}
            >
              Ir para o login
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
