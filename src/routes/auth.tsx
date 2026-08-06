import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/logo";
import { recordLegalConsents } from "@/lib/consent";
import { toast } from "sonner";
import { ArrowLeft, Sparkles } from "lucide-react";

export const Route = createFileRoute("/auth")({
  validateSearch: (search: Record<string, unknown>): { redirect?: string } => {
    const raw = search.redirect;
    const valid =
      typeof raw === "string" && raw.startsWith("/") && !raw.startsWith("//") ? raw : undefined;
    return valid ? { redirect: valid } : {};
  },
  component: AuthPage,
  head: () => ({
    meta: [
      { title: "Entrar — WEAZE" },
      { name: "description", content: "Acesse o painel WEAZE do seu estabelecimento." },
    ],
  }),
});

function AuthPage() {
  const navigate = useNavigate();
  const { redirect } = Route.useSearch();
  const destination = redirect ?? "/app";
  const [mode, setMode] = useState<"signin" | "signup" | "recovery">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [acceptPrivacy, setAcceptPrivacy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [pendingSignupEmail, setPendingSignupEmail] = useState<string | null>(null);
  const [resending, setResending] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [recoveryPassword, setRecoveryPassword] = useState("");
  const [recoveryPassword2, setRecoveryPassword2] = useState("");

  useEffect(() => {
    supabase.auth
      .getSession()
      .then(({ data }) => {
        const isRecovery =
          window.location.hash.includes("type=recovery") ||
          window.location.search.includes("type=recovery");
        if (data.session && !isRecovery) navigate({ to: destination as never });
      })
      .catch(() => {});
  }, [destination, navigate]);

  // Link "esqueci minha senha": o Supabase cria uma sessão de recovery —
  // troca para o formulário de nova senha em vez de navegar para /app.
  useEffect(() => {
    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setMode("recovery");
        setPendingSignupEmail(null);
      }
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  async function resendConfirmation() {
    if (!pendingSignupEmail) return;
    setResending(true);
    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: pendingSignupEmail,
        options: { emailRedirectTo: window.location.origin + destination },
      });
      if (error) throw error;
      toast.success(
        `Novo link enviado para ${pendingSignupEmail}. Verifique a caixa de entrada e o spam.`,
      );
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Não foi possível reenviar o email de confirmação.",
      );
    } finally {
      setResending(false);
    }
  }

  async function forgotPassword() {
    const em = email.trim();
    if (!em) {
      toast.error("Digite seu email para receber o link de recuperação.");
      return;
    }
    setResetting(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(em, {
        redirectTo: window.location.origin + "/auth",
      });
      if (error) throw error;
      toast.success(
        `Enviamos um link para redefinir sua senha em ${em}. Confira a caixa de entrada e o spam.`,
      );
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Não foi possível enviar o link de recuperação.",
      );
    } finally {
      setResetting(false);
    }
  }

  async function submitRecovery(e: React.FormEvent) {
    e.preventDefault();
    if (recoveryPassword.length < 6) {
      toast.error("A nova senha deve ter no mínimo 6 caracteres.");
      return;
    }
    if (recoveryPassword !== recoveryPassword2) {
      toast.error("As senhas não coincidem.");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: recoveryPassword });
      if (error) throw error;
      toast.success("Senha atualizada! Faça login com a nova senha.");
      await supabase.auth.signOut();
      setMode("signin");
      setRecoveryPassword("");
      setRecoveryPassword2("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao redefinir a senha.");
    } finally {
      setLoading(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (mode === "recovery") {
      await submitRecovery(e);
      return;
    }
    if (mode === "signup" && !(acceptTerms && acceptPrivacy)) {
      toast.error("É necessário aceitar os Termos de Uso e a Política de Privacidade.");
      return;
    }
    setLoading(true);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin + destination },
        });
        if (error) {
          const msg = (error.message || "").toLowerCase();
          if (
            error.status === 422 ||
            (error as any).code === "user_already_exists" ||
            msg.includes("already registered") ||
            msg.includes("already been registered") ||
            msg.includes("user already")
          ) {
            toast.error("Este email já está cadastrado. Faça login para continuar.");
            setMode("signin");
            setPendingSignupEmail(null);
            return;
          }
          throw error;
        }
        if (!data.session) {
          // Confirmação de email obrigatória: guarda o email para permitir reenvio.
          setPendingSignupEmail(email);
          toast.info(
            "Conta criada! Enviamos um link de confirmação para o seu email. Confira a caixa de entrada e também o spam.",
          );
          return;
        }
        setPendingSignupEmail(null);
        // Registro dos aceites legais (data, hora, versão e usuário).
        try {
          if (data.user) await recordLegalConsents(data.user.id);
        } catch {
          /* silencioso */
        }
        // Novo cadastro B2B: garante empresa e vai direto para /payment,
        // evitando flicker do painel enquanto o status é verificado.
        try {
          await (supabase as any).rpc("ensure_super_admin");
        } catch {
          /* silencioso */
        }
        try {
          const { ensureUserRole } = await import("@/lib/auth.functions");
          await ensureUserRole();
        } catch {
          /* silencioso */
        }
        navigate({ to: "/payment" });
        return;
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          const code = error.code;
          const msg = (error.message || "").toLowerCase();
          if (code === "email_not_confirmed" || msg.includes("email not confirmed")) {
            setPendingSignupEmail(email);
            toast.error(
              "Seu email ainda não foi confirmado. Reenvie o link de confirmação e clique nele para ativar sua conta.",
            );
            return;
          }
          if (code === "invalid_credentials" || msg.includes("invalid login credentials")) {
            setPendingSignupEmail(email);
            toast.error(
              'Email ou senha incorretos. Se acabou de criar a conta, confirme seu email no link enviado. Se esqueceu a senha, use "Esqueci minha senha".',
            );
            return;
          }
          throw error;
        }
        setPendingSignupEmail(null);
      }
      // Auto-promoção do super admin (admin@weaze.com.br)
      try {
        const { data: isAdmin } = await (supabase as any).rpc("ensure_super_admin");
        if (isAdmin) {
          navigate({ to: "/admin" });
          return;
        }
      } catch {
        // silencioso — usuário comum
      }
      navigate({ to: destination as never });
    } catch (err: any) {
      toast.error(err.message ?? "Erro");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Left visual panel */}
      <div className="weaze-gradient relative hidden overflow-hidden p-12 lg:flex lg:flex-col lg:justify-between">
        <div>
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-primary-foreground/80 hover:text-primary-foreground"
          >
            <ArrowLeft className="size-4" /> <span className="text-sm">Voltar para o site</span>
          </Link>
        </div>
        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-primary-foreground backdrop-blur">
            <Sparkles className="size-3.5" /> Painel do estabelecimento
          </div>
          <h2 className="mt-6 font-display text-5xl font-extrabold leading-tight text-primary-foreground">
            O social commerce do seu negócio,
            <br /> em tempo real.
          </h2>
          <p className="mt-4 max-w-md text-lg text-primary-foreground/80">
            Feed, pedidos, clientes e insights — tudo em um lugar.
          </p>
        </div>
        <div className="text-xs text-primary-foreground/60">© {new Date().getFullYear()} WEAZE</div>
        {/* Decorative glow */}
        <div className="pointer-events-none absolute -right-32 -top-32 size-96 rounded-full bg-white/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -left-24 size-96 rounded-full bg-white/10 blur-3xl" />
      </div>

      {/* Right form panel */}
      <div className="flex items-center justify-center bg-background p-6">
        <div className="w-full max-w-md">
          <div className="mb-10 flex items-center justify-between lg:hidden">
            <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground">
              <ArrowLeft className="size-4" /> Voltar
            </Link>
            <Logo className="h-20" />
          </div>
          <div className="mb-10 hidden lg:block">
            <Logo className="h-28" />
          </div>

          <h1 className="font-display text-3xl font-extrabold tracking-tight">
            {mode === "recovery"
              ? "Definir nova senha"
              : mode === "signin"
                ? "Bem-vindo de volta"
                : "Crie sua conta"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {mode === "recovery"
              ? "Escolha uma nova senha para sua conta."
              : mode === "signin"
                ? "Entre no painel do seu estabelecimento."
                : "Comece a transformar visitas em relacionamento."}
          </p>

          {mode === "recovery" ? (
            <form onSubmit={submit} className="mt-8 space-y-4">
              <div>
                <Label htmlFor="new-pass">Nova senha</Label>
                <Input
                  id="new-pass"
                  type="password"
                  value={recoveryPassword}
                  onChange={(e) => setRecoveryPassword(e.target.value)}
                  required
                  minLength={6}
                  className="mt-1.5 h-11"
                  placeholder="Mínimo 6 caracteres"
                />
              </div>
              <div>
                <Label htmlFor="new-pass-2">Confirmar nova senha</Label>
                <Input
                  id="new-pass-2"
                  type="password"
                  value={recoveryPassword2}
                  onChange={(e) => setRecoveryPassword2(e.target.value)}
                  required
                  minLength={6}
                  className="mt-1.5 h-11"
                  placeholder="Repita a nova senha"
                />
              </div>
              <Button type="submit" size="lg" className="w-full shadow-elegant" disabled={loading}>
                {loading ? "Salvando…" : "Definir nova senha"}
              </Button>
            </form>
          ) : (
            <form onSubmit={submit} className="mt-8 space-y-4">
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="mt-1.5 h-11"
                  placeholder="seu@estabelecimento.com"
                />
              </div>
              <div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="pass">Senha</Label>
                  {mode === "signin" && (
                    <button
                      type="button"
                      onClick={forgotPassword}
                      disabled={resetting}
                      className="text-xs font-semibold text-primary hover:underline"
                    >
                      {resetting ? "Enviando link…" : "Esqueci minha senha"}
                    </button>
                  )}
                </div>
                <Input
                  id="pass"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="mt-1.5 h-11"
                  placeholder="Mínimo 6 caracteres"
                />
              </div>

              {mode === "signup" && (
                <div className="space-y-2.5 rounded-xl border border-border/60 bg-muted/30 p-3.5">
                  <label className="flex cursor-pointer items-start gap-2.5 text-sm">
                    <input
                      type="checkbox"
                      checked={acceptTerms}
                      onChange={(e) => setAcceptTerms(e.target.checked)}
                      className="mt-0.5 size-4 accent-[hsl(var(--primary))]"
                      required
                    />
                    <span className="text-muted-foreground">
                      Li e concordo com os{" "}
                      <Link
                        to="/termos"
                        target="_blank"
                        className="font-semibold text-primary hover:underline"
                      >
                        Termos de Uso
                      </Link>
                      .
                    </span>
                  </label>
                  <label className="flex cursor-pointer items-start gap-2.5 text-sm">
                    <input
                      type="checkbox"
                      checked={acceptPrivacy}
                      onChange={(e) => setAcceptPrivacy(e.target.checked)}
                      className="mt-0.5 size-4 accent-[hsl(var(--primary))]"
                      required
                    />
                    <span className="text-muted-foreground">
                      Li e concordo com a{" "}
                      <Link
                        to="/privacy"
                        target="_blank"
                        className="font-semibold text-primary hover:underline"
                      >
                        Política de Privacidade
                      </Link>
                      .
                    </span>
                  </label>
                </div>
              )}

              {pendingSignupEmail && (
                <div className="rounded-xl border border-primary/30 bg-primary/5 p-3.5 text-sm">
                  <p className="text-muted-foreground">
                    Não recebeu o email de confirmação para{" "}
                    <span className="font-semibold text-foreground">{pendingSignupEmail}</span>?
                    Confira a caixa de spam ou reenvie o link.
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-2.5"
                    onClick={resendConfirmation}
                    disabled={resending}
                  >
                    {resending ? "Enviando…" : "Reenviar email de confirmação"}
                  </Button>
                </div>
              )}

              <Button
                type="submit"
                size="lg"
                className="w-full shadow-elegant"
                disabled={loading || (mode === "signup" && !(acceptTerms && acceptPrivacy))}
              >
                {loading
                  ? "Aguarde…"
                  : mode === "signin"
                    ? "Entrar no painel"
                    : "Criar minha conta"}
              </Button>
            </form>
          )}

          <div className="mt-6 text-center text-sm text-muted-foreground">
            {mode === "recovery" ? (
              <button
                type="button"
                onClick={() => setMode("signin")}
                className="font-semibold text-primary hover:underline"
              >
                Voltar para o login
              </button>
            ) : (
              <>
                {mode === "signin" ? "Ainda não tem conta?" : "Já tem uma conta?"}{" "}
                <button
                  type="button"
                  onClick={() => setMode((m) => (m === "signin" ? "signup" : "signin"))}
                  className="font-semibold text-primary hover:underline"
                >
                  {mode === "signin" ? "Criar conta grátis" : "Entrar"}
                </button>
              </>
            )}
          </div>

          <div className="mt-8 flex items-center justify-center gap-4 border-t border-border/60 pt-5 text-xs text-muted-foreground">
            <Link to="/termos" className="hover:text-foreground">
              Termos de Uso
            </Link>
            <span className="text-border">•</span>
            <Link to="/privacy" className="hover:text-foreground">
              Política de Privacidade
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
