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

function isInvalidCredentialsError(err: { code?: string; message?: string } | null): boolean {
  if (!err) return false;
  const code = err.code;
  const msg = (err.message || "").toLowerCase();
  return (
    code === "invalid_credentials" ||
    msg.includes("invalid login credentials") ||
    msg.includes("invalid credentials")
  );
}

/**
 * Aguarda a sessão estar de fato persistida antes de navegar. No PWA instalado
 * a gravação pode terminar depois da resposta do login.
 */
async function waitForPersistedSession(timeoutMs = 3000): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const { data } = await supabase.auth.getSession().catch(() => ({ data: { session: null } }));
    if (data.session) return true;
    await new Promise((r) => setTimeout(r, 100));
  }
  return false;
}

function AuthPage() {
  const navigate = useNavigate();
  const { redirect } = Route.useSearch();
  const destination = redirect ?? "/app";
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [acceptPrivacy, setAcceptPrivacy] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: destination as never });
    }).catch(() => {});
  }, [destination, navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (mode === "signup" && !(acceptTerms && acceptPrivacy)) {
      toast.error("É necessário aceitar os Termos de Uso e a Política de Privacidade.");
      return;
    }
    setLoading(true);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { emailRedirectTo: window.location.origin + destination },
        });
        if (error) {
          const msg = (error.message || "").toLowerCase();
          const code = (error as any).code;
          const alreadyRegistered =
            error.status === 422 ||
            code === "user_already_exists" ||
            isInvalidCredentialsError(error as any) ||
            msg.includes("already registered") ||
            msg.includes("already been registered") ||
            msg.includes("user already");
          if (alreadyRegistered) {
            toast.error("Este email já está cadastrado. Faça login para continuar.");
            setMode("signin");
            setLoading(false);
            return;
          }
          throw error;
        }
        if (!data.session) {
          // Supabase com "Confirm email" ligado: auto-confirma a conta recém-criada
          // via service role (acesso direto, como na web) e abre a sessão.
          try {
            const { confirmSignupEmail } = await import("@/lib/auth-auto-confirm.functions");
            await confirmSignupEmail({ data: { userId: data.user?.id ?? "" } });
          } catch {
            /* se a auto-confirmação falhar, segue para o login direto */
          }
          const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
            email: email.trim(),
            password,
          });
          if (signInError || !signInData.session) {
            toast.success("Conta criada! Faça login para continuar.");
            setMode("signin");
            setLoading(false);
            return;
          }
        }

        // Registro dos aceites legais (data, hora, versão e usuário).
        try {
          if (data.user) await recordLegalConsents(data.user.id);
        } catch { /* silencioso */ }
        // Novo cadastro B2B: garante empresa e vai direto para /payment,
        // evitando flicker do painel enquanto o status é verificado.
        try {
          await (supabase as any).rpc("ensure_super_admin");
        } catch { /* silencioso */ }
        try {
          const { ensureUserRole } = await import("@/lib/auth.functions");
          await ensureUserRole();
        } catch { /* silencioso */ }
        navigate({ to: "/payment" });
        return;
      } else {
        // Autofills/teclados móveis podem anexar um espaço invisível no fim do
        // email/senha. E mais: se a conta foi cadastrada com a senha já contendo
        // um espaço no fim (ex.: preenchimento automático no momento do cadastro),
        // digitar a senha "limpa" sempre falha com invalid_credentials — o que
        // causa "hora entra (autofill usa o valor salvo), hora não entra (digitação)".
        // Fazemos até 3 tentativas cobrindo os dois sentidos antes de mostrar o erro.
        let result = await supabase.auth.signInWithPassword({ email, password });
        if (result.error && isInvalidCredentialsError(result.error)) {
          result = await supabase.auth.signInWithPassword({
            email: email.trim(),
            password: password.trim(),
          });
        }
        if (result.error && isInvalidCredentialsError(result.error)) {
          result = await supabase.auth.signInWithPassword({
            email: email.trim(),
            password: password + " ",
          });
        }
        const { error } = result;
        if (error) {
          const code = error.code;
          const msg = (error.message || "").toLowerCase();
          if (code === "email_not_confirmed" || msg.includes("email not confirmed")) {
            toast.error(
              "Seu email ainda não foi confirmado. Reenvie o link de confirmação e clique nele para ativar sua conta.",
            );
            setLoading(false);
            return;
          }
          if (isInvalidCredentialsError(error)) {
            toast.error(
              "Email ou senha incorretos. Dica: confira se não há um espaço sobrando no fim do email ou da senha.",
            );
            setLoading(false);
            return;
          }
          throw error;
        }
      }
      // No app instalado (PWA standalone) a gravação da sessão pode terminar
      // depois do retorno do login; navegar antes disso derrubava o usuário
      // de volta para /auth. Aguardamos a sessão estar realmente disponível.
      await waitForPersistedSession();

      // Auto-promoção do super admin (admin@weaze.com.br)
      try {
        const { data: isAdmin } = await (supabase as any).rpc("ensure_super_admin");
        if (isAdmin) {
          navigate({ to: "/admin", replace: true });
          return;
        }
      } catch {
        // silencioso — usuário comum
      }
      navigate({ to: destination as never, replace: true });
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
          <Link to="/" className="inline-flex items-center gap-2 text-primary-foreground/80 hover:text-primary-foreground">
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
        <div className="text-xs text-primary-foreground/60">
          © {new Date().getFullYear()} WEAZE
        </div>
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
            {mode === "signin" ? "Bem-vindo de volta" : "Crie sua conta"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {mode === "signin"
              ? "Entre no painel do seu estabelecimento."
              : "Comece a transformar visitas em relacionamento."}
          </p>

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
              <Label htmlFor="pass">Senha</Label>
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
                    <Link to="/termos" target="_blank" className="font-semibold text-primary hover:underline">
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
                    <Link to="/privacy" target="_blank" className="font-semibold text-primary hover:underline">
                      Política de Privacidade
                    </Link>
                    .
                  </span>
                </label>
              </div>
            )}

            <Button
              type="submit"
              size="lg"
              className="w-full shadow-elegant"
              disabled={loading || (mode === "signup" && !(acceptTerms && acceptPrivacy))}
            >
              {loading ? "Aguarde…" : mode === "signin" ? "Entrar no painel" : "Criar minha conta"}
            </Button>
          </form>

          <div className="mt-6 text-center text-sm text-muted-foreground">
            {mode === "signin" ? "Ainda não tem conta?" : "Já tem uma conta?"}{" "}
            <button
              type="button"
              onClick={() => setMode((m) => (m === "signin" ? "signup" : "signin"))}
              className="font-semibold text-primary hover:underline"
            >
              {mode === "signin" ? "Criar conta grátis" : "Entrar"}
            </button>
          </div>

          <div className="mt-8 flex items-center justify-center gap-4 border-t border-border/60 pt-5 text-xs text-muted-foreground">
            <Link to="/termos" className="hover:text-foreground">Termos de Uso</Link>
            <span className="text-border">•</span>
            <Link to="/privacy" className="hover:text-foreground">Política de Privacidade</Link>
          </div>

        </div>
      </div>
    </div>
  );
}
