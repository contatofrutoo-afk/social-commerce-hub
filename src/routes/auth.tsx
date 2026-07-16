import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/logo";
import { toast } from "sonner";
import { ArrowLeft, Sparkles } from "lucide-react";

export const Route = createFileRoute("/auth")({
  validateSearch: (search: Record<string, unknown>) => ({
    redirect:
      typeof search.redirect === "string" &&
      search.redirect.startsWith("/") &&
      !search.redirect.startsWith("//")
        ? search.redirect
        : undefined,
  }),
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
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: destination as never });
    }).catch(() => {});
  }, [destination, navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
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
            setLoading(false);
            return;
          }
          throw error;
        }
        if (!data.session) {
          toast.success("Conta criada! Verifique seu email para confirmar.");
          setLoading(false);
          return;
        }
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
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
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
          <div className="mb-8 flex items-center justify-between lg:hidden">
            <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground">
              <ArrowLeft className="size-4" /> Voltar
            </Link>
            <Logo className="h-6" />
          </div>
          <div className="mb-8 hidden lg:block">
            <Logo className="h-8" />
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
            <Button type="submit" size="lg" className="w-full shadow-elegant" disabled={loading}>
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
        </div>
      </div>
    </div>
  );
}
