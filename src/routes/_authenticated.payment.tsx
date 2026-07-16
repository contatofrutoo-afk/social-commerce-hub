import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  CheckCircle2,
  Copy,
  MessageCircle,
  ShieldAlert,
  Sparkles,
  Clock,
  XCircle,
  LogOut,
} from "lucide-react";
import qrMensalidade from "@/assets/qr-mensalidade-weaze.png.asset.json";
import { Logo } from "@/components/logo";

// Link de pagamento weaze
const PIX_KEY = "https://mpago.la/17de55g";
const PLAN_PRICE = "R$ 247/mês";
const PLAN_NAME = "weaze PRO";

export const Route = createFileRoute("/_authenticated/payment")({
  ssr: false,
  component: PaymentPage,
  head: () => ({
    meta: [{ title: "Finalize sua assinatura — weaze" }],
  }),
});

const BENEFITS = [
  "Feed Social",
  "CRM Inteligente",
  "Catálogo Inteligente",
  "Pedidos",
  "Dashboard",
  "Atendimento",
  "QR Codes",
  "Clientes ilimitados",
  "Produtos ilimitados",
  "Integrações futuras",
];

function PaymentPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [informing, setInforming] = useState(false);
  const [methodDialogOpen, setMethodDialogOpen] = useState(false);
  const [selectedMethod, setSelectedMethod] = useState<string>("PIX");

  const [companyName, setCompanyName] = useState("");
  const [responsible, setResponsible] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [profileSaved, setProfileSaved] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);

  const { data: role } = useQuery({
    queryKey: ["my-role"],
    queryFn: async () => {
      const { data } = await supabase
        .from("user_roles")
        .select("*, company:companies(*)")
        .limit(1)
        .maybeSingle();
      return data;
    },
  });

  const company = role?.company as any;

  // Preenche o formulário quando os dados da empresa chegam
  useEffect(() => {
    if (company) {
      setCompanyName(company.name === "Minha Empresa" ? "" : company.name ?? "");
      setResponsible(company.responsible ?? "");
      setEmail(company.email_principal ?? "");
      setPhone(company.phone ?? "");
      setCity(company.city ?? "");
      // Se já tem dados preenchidos, considera salvo
      if (company.responsible || company.city) {
        setProfileSaved(true);
      }
    }
  }, [company?.id]);

  const { data: settings } = useQuery({
    queryKey: ["admin-settings-block"],
    queryFn: async () => {
      const { data } = await supabase
        .from("admin_settings")
        .select("admin_contact")
        .limit(1)
        .maybeSingle();
      return data;
    },
  });

  const status = company?.status as string | undefined;

  // Touch login on entry (para rastreio de atividade)
  useEffect(() => {
    (async () => {
      try {
        await (supabase as any).rpc("touch_company_login");
      } catch {
        /* silencioso */
      }
    })();
  }, []);

  // Se já está ativo/teste, sai daqui
  useEffect(() => {
    if (status === "ativo" || status === "teste") {
      navigate({ to: "/app" });
    }
  }, [status, navigate]);

  const whatsappHref = settings?.admin_contact
    ? `https://wa.me/${settings.admin_contact.replace(/\D/g, "")}`
    : undefined;

  async function copyPix() {
    try {
      await navigator.clipboard.writeText(PIX_KEY);
      toast.success("Link de pagamento copiado!");
    } catch {
      toast.error("Não foi possível copiar. Copie manualmente: " + PIX_KEY);
    }
  }

  const canSubmitProfile = companyName.trim().length > 0 && responsible.trim().length > 0;

  async function saveProfile() {
    if (!company?.id || !canSubmitProfile) return;
    setSavingProfile(true);
    try {
      const { error } = await supabase
        .from("companies")
        .update({
          name: companyName.trim(),
          responsible: responsible.trim(),
          email_principal: email.trim() || null,
          phone: phone.trim() || null,
          city: city.trim() || null,
        })
        .eq("id", company.id);
      if (error) throw error;
      setProfileSaved(true);
      toast.success("Dados do estabelecimento salvos!");
      await queryClient.invalidateQueries({ queryKey: ["my-role"] });
    } catch (err: any) {
      toast.error(err?.message ?? "Erro ao salvar dados.");
    } finally {
      setSavingProfile(false);
    }
  }

  async function confirmInformPayment() {
    setInforming(true);
    try {
      const { error } = await (supabase as any).rpc("mark_payment_informed", {
        _method: selectedMethod,
      });
      if (error) throw error;
      toast.success("Pagamento informado! Aguarde a confirmação da equipe weaze.");
      setMethodDialogOpen(false);
      await queryClient.invalidateQueries({ queryKey: ["my-role"] });
    } catch (err: any) {
      toast.error(err?.message ?? "Erro ao informar pagamento.");
    } finally {
      setInforming(false);
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  }

  // ============ Estados que não são "aguardando_pagamento" ============

  if (status === "pagamento_em_analise") {
    return (
      <StatusScreen
        icon={<Clock className="h-16 w-16 text-orange-500" />}
        title="Pagamento em análise"
        description="Recebemos sua solicitação. Nossa equipe irá validar seu pagamento. Seu acesso será liberado após a confirmação."
        whatsappHref={whatsappHref}
        onSignOut={signOut}
      />
    );
  }

  if (status === "bloqueado") {
    return (
      <StatusScreen
        icon={<ShieldAlert className="h-16 w-16 text-destructive" />}
        title="Seu acesso foi bloqueado temporariamente"
        description="Seu acesso encontra-se indisponível. Entre em contato com a equipe weaze para regularização."
        whatsappHref={whatsappHref}
        onSignOut={signOut}
      />
    );
  }

  if (status === "cancelado") {
    return (
      <StatusScreen
        icon={<XCircle className="h-16 w-16 text-muted-foreground" />}
        title="Sua assinatura foi encerrada"
        description="Para voltar a usar a weaze, reative sua assinatura informando um novo pagamento."
        primaryAction={
          <Button size="lg" onClick={() => setMethodDialogOpen(true)} disabled={informing}>
            {informing ? "Enviando…" : "Reativar assinatura"}
          </Button>
        }
        whatsappHref={whatsappHref}
        onSignOut={signOut}
      />
    );
  }

  // ============ Fluxo principal: aguardando_pagamento ============

  return (
    <div className="min-h-screen dash-surface">
      <header className="border-b bg-card/70 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <Logo className="h-7" />
          <button
            onClick={signOut}
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <LogOut className="h-4 w-4" /> Sair
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-10">
        <div className="mb-8 text-center">
          <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-primary">
            <Sparkles className="h-3.5 w-3.5" /> Finalize sua assinatura
          </div>
          <h1 className="mt-4 font-display text-3xl font-extrabold tracking-tight md:text-4xl">
            Seu cadastro foi realizado com sucesso
          </h1>
          <p className="mt-2 text-muted-foreground">
            Para liberar seu acesso à weaze basta finalizar sua assinatura abaixo.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Dados do Estabelecimento */}
          <div className="dash-card p-6 md:col-span-2">
            <div className="mb-1 text-xs font-semibold uppercase tracking-widest text-primary">
              Dados do Estabelecimento
            </div>
            <h2 className="font-display text-xl font-bold">
              {profileSaved ? "Dados confirmados" : "Preencha os dados do seu negócio"}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Essas informações serão exibidas no painel administrativo da weaze.
            </p>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="c-name">Nome do estabelecimento *</Label>
                <input
                  id="c-name"
                  value={companyName}
                  onChange={(e) => { setCompanyName(e.target.value); setProfileSaved(false); }}
                  placeholder="Ex: Café do Centro"
                  className="mt-1.5 flex h-10 w-full rounded-lg border bg-background px-3 py-2 text-sm"
                />
              </div>
              <div>
                <Label htmlFor="c-responsible">Responsável *</Label>
                <input
                  id="c-responsible"
                  value={responsible}
                  onChange={(e) => { setResponsible(e.target.value); setProfileSaved(false); }}
                  placeholder="Nome do responsável"
                  className="mt-1.5 flex h-10 w-full rounded-lg border bg-background px-3 py-2 text-sm"
                />
              </div>
              <div>
                <Label htmlFor="c-email">Email</Label>
                <input
                  id="c-email"
                  type="email"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setProfileSaved(false); }}
                  placeholder="contato@empresa.com"
                  className="mt-1.5 flex h-10 w-full rounded-lg border bg-background px-3 py-2 text-sm"
                />
              </div>
              <div>
                <Label htmlFor="c-phone">Telefone</Label>
                <input
                  id="c-phone"
                  value={phone}
                  onChange={(e) => { setPhone(e.target.value); setProfileSaved(false); }}
                  placeholder="(11) 99999-0000"
                  className="mt-1.5 flex h-10 w-full rounded-lg border bg-background px-3 py-2 text-sm"
                />
              </div>
              <div>
                <Label htmlFor="c-city">Cidade</Label>
                <input
                  id="c-city"
                  value={city}
                  onChange={(e) => { setCity(e.target.value); setProfileSaved(false); }}
                  placeholder="São Paulo"
                  className="mt-1.5 flex h-10 w-full rounded-lg border bg-background px-3 py-2 text-sm"
                />
              </div>
              <div className="flex items-end">
                {!profileSaved ? (
                  <Button
                    onClick={saveProfile}
                    disabled={!canSubmitProfile || savingProfile}
                    className="w-full"
                  >
                    {savingProfile ? "Salvando…" : "Salvar dados"}
                  </Button>
                ) : (
                  <div className="flex items-center gap-2 text-sm text-emerald-600">
                    <CheckCircle2 className="h-4 w-4" /> Dados salvos
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Plano */}
          <div className="dash-card p-6">
            <div className="mb-1 text-xs font-semibold uppercase tracking-widest text-primary">
              Plano
            </div>
            <h2 className="font-display text-2xl font-bold">{PLAN_NAME}</h2>
            <div className="mt-2 flex items-baseline gap-1">
              <span className="number-display text-4xl font-extrabold">{PLAN_PRICE}</span>
            </div>
            <ul className="mt-6 space-y-2">
              {BENEFITS.map((b) => (
                <li key={b} className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-primary" /> {b}
                </li>
              ))}
            </ul>
          </div>

          {/* Pagamento */}
          <div className="dash-card p-6">
            <div className="mb-1 text-xs font-semibold uppercase tracking-widest text-primary">
              Pagamento via PIX
            </div>
            <h2 className="font-display text-xl font-bold">Escaneie o QR Code</h2>
            <div className="mt-4 flex justify-center">
              <img
                src={qrMensalidade.url}
                alt="QR Code PIX weaze"
                className="h-56 w-56 rounded-md border bg-white p-2"
              />
            </div>

            <div className="mt-4">
              <div className="text-xs font-medium text-muted-foreground">Link de pagamento</div>
              <div className="mt-1 flex items-center gap-2 rounded-lg border bg-muted/40 p-2">
                <code className="flex-1 truncate text-sm">{PIX_KEY}</code>
                <Button size="sm" variant="secondary" onClick={copyPix} className="gap-1">
                  <Copy className="h-3.5 w-3.5" /> Copiar
                </Button>
              </div>
            </div>

            <div className="mt-6 space-y-2">
              <Button
                className="w-full"
                size="lg"
                onClick={() => setMethodDialogOpen(true)}
                disabled={informing || !profileSaved}
              >
                {informing ? "Enviando…" : "Já realizei o pagamento"}
              </Button>
              {!profileSaved && (
                <p className="text-center text-xs text-muted-foreground">
                  Preencha os dados do estabelecimento acima para continuar.
                </p>
              )}
              {whatsappHref && (
                <a href={whatsappHref} target="_blank" rel="noreferrer">
                  <Button variant="outline" className="w-full gap-2" size="lg">
                    <MessageCircle className="h-4 w-4" /> Falar no WhatsApp
                  </Button>
                </a>
              )}
            </div>
          </div>
        </div>

        <p className="mt-8 text-center text-xs text-muted-foreground">
          Após confirmarmos seu pagamento, seu acesso será liberado automaticamente.
        </p>
      </main>

      <PaymentMethodDialog
        open={methodDialogOpen}
        onOpenChange={setMethodDialogOpen}
        method={selectedMethod}
        setMethod={setSelectedMethod}
        onConfirm={confirmInformPayment}
        loading={informing}
      />
    </div>
  );
}

function PaymentMethodDialog({
  open,
  onOpenChange,
  method,
  setMethod,
  onConfirm,
  loading,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  method: string;
  setMethod: (m: string) => void;
  onConfirm: () => void;
  loading: boolean;
}) {
  const opts = ["PIX", "Cartão", "Dinheiro", "Outro"];
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Confirmar pagamento</DialogTitle>
          <DialogDescription>
            Selecione o método utilizado. Após confirmar, sua solicitação entrará em análise pela equipe weaze.
          </DialogDescription>
        </DialogHeader>
        <RadioGroup value={method} onValueChange={setMethod} className="grid grid-cols-2 gap-2 py-2">
          {opts.map((o) => (
            <label
              key={o}
              className="flex cursor-pointer items-center gap-2 rounded-lg border p-3 hover:bg-accent"
            >
              <RadioGroupItem value={o} id={`m-${o}`} />
              <Label htmlFor={`m-${o}`} className="cursor-pointer">{o}</Label>
            </label>
          ))}
        </RadioGroup>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={onConfirm} disabled={loading}>
            {loading ? "Enviando…" : "Confirmar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function StatusScreen({
  icon,
  title,
  description,
  primaryAction,
  whatsappHref,
  onSignOut,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  primaryAction?: React.ReactNode;
  whatsappHref?: string;
  onSignOut: () => void;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-muted/30 px-4 py-10 text-center">
      <div className="max-w-md">
        <div className="mx-auto mb-6 flex justify-center">{icon}</div>
        <h1 className="font-display text-2xl font-bold mb-3">{title}</h1>
        <p className="text-muted-foreground mb-6">{description}</p>
        <div className="flex flex-col gap-2">
          {primaryAction}
          {whatsappHref && (
            <a href={whatsappHref} target="_blank" rel="noreferrer">
              <Button variant="outline" className="w-full gap-2">
                <MessageCircle className="h-4 w-4" /> Falar no WhatsApp
              </Button>
            </a>
          )}
          <button
            onClick={onSignOut}
            className="mt-2 inline-flex items-center justify-center gap-2 text-xs text-muted-foreground hover:text-foreground"
          >
            <LogOut className="h-3.5 w-3.5" /> Sair
          </button>
        </div>
      </div>
    </div>
  );
}
