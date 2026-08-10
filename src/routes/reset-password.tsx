import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/logo";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/reset-password")({
  ssr: false,
  component: ResetPasswordPage,
  head: () => ({
    meta: [
      { title: "Redefinir senha — weaze" },
      {
        name: "description",
        content: "Defina uma nova senha para acessar o painel weaze do seu estabelecimento.",
      },
      { property: "og:title", content: "Redefinir senha — weaze" },
      {
        property: "og:description",
        content: "Defina uma nova senha para acessar o painel weaze.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // O link de recuperação entrega a sessão via hash (#access_token=...&type=recovery).
    // O supabase-js processa o hash automaticamente; aguardamos a sessão existir.
    let alive = true;
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (alive && session) setReady(true);
    });
    supabase.auth.getSession().then(({ data }) => {
      if (alive && data.session) setReady(true);
    });
    const timer = setTimeout(() => alive && setReady((r) => r), 4000);
    return () => {
      alive = false;
      clearTimeout(timer);
      sub.subscription.unsubscribe();
    };
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 6) {
      toast.error("A senha precisa ter pelo menos 6 caracteres.");
      return;
    }
    if (password !== confirm) {
      toast.error("As senhas não coincidem.");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      toast.error(
        error.message?.includes("Auth session missing")
          ? "Link expirado. Solicite um novo email de redefinição."
          : (error.message ?? "Não foi possível alterar a senha."),
      );
      return;
    }
    toast.success("Senha alterada com sucesso!");
    navigate({ to: "/app", replace: true });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-md">
        <Link to="/auth" className="inline-flex items-center gap-2 text-sm text-muted-foreground">
          <ArrowLeft className="size-4" /> Voltar para o login
        </Link>
        <div className="my-8">
          <Logo className="h-20" />
        </div>
        <h1 className="font-display text-3xl font-extrabold tracking-tight">Definir nova senha</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {ready
            ? "Escolha uma nova senha para sua conta."
            : "Abra esta página pelo link enviado no seu email para redefinir a senha."}
        </p>

        <form onSubmit={submit} className="mt-8 space-y-4">
          <div>
            <Label htmlFor="new-pass">Nova senha</Label>
            <Input
              id="new-pass"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="mt-1.5 h-11"
              placeholder="Mínimo 6 caracteres"
            />
          </div>
          <div>
            <Label htmlFor="confirm-pass">Confirmar nova senha</Label>
            <Input
              id="confirm-pass"
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              minLength={6}
              className="mt-1.5 h-11"
              placeholder="Repita a nova senha"
            />
          </div>
          <Button type="submit" size="lg" className="w-full shadow-elegant" disabled={loading}>
            {loading ? "Salvando…" : "Salvar nova senha"}
          </Button>
        </form>
      </div>
    </div>
  );
}
