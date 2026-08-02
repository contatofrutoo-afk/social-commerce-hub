import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Save, KeyRound, Loader2 } from "lucide-react";
import {
  getMercadoPagoSettings,
  saveMercadoPagoSettings,
  type MercadoPagoSettingKey,
  type MercadoPagoSettingKind,
} from "@/lib/mercadopago-settings.functions";

export const Route = createFileRoute("/_authenticated/admin/configuracoes")({
  component: WeazeConfiguracoes,
  head: () => ({ meta: [{ title: "Configurações — WEAZE Admin" }] }),
});

const SETTINGS_ID = "00000000-0000-0000-0000-000000000000";

const KIND_LABEL: Record<MercadoPagoSettingKind, string> = {
  production: "Produção",
  test: "Teste",
  custom: "Custom",
};

type FieldStatus = { configured: boolean; source: "db" | "env" };

const MP_CREDENTIAL_FIELDS: {
  key: MercadoPagoSettingKey;
  label: string;
  hint: string;
  secret?: boolean;
}[] = [
  {
    key: "clientId",
    label: "Client ID",
    hint: "Identificador público da aplicação (painel do Mercado Pago → Suas integrações).",
  },
  {
    key: "clientSecret",
    label: "Client Secret",
    secret: true,
    hint: "Segredo da aplicação — nunca compartilhe ou exiba publicamente.",
  },
  {
    key: "publicKey",
    label: "Public Key",
    hint: "Chave pública (formato TEST-... ou APP_USR-...) usada pelo Checkout Bricks.",
  },
  {
    key: "accessToken",
    label: "Access Token",
    secret: true,
    hint: "Access Token da conta Mercado Pago (fallback e consulta de pagamentos).",
  },
  {
    key: "webhookSecret",
    label: "Webhook Secret",
    secret: true,
    hint: "Chave usada para validar a assinatura HMAC dos webhooks.",
  },
  {
    key: "redirectUri",
    label: "Redirect URI",
    hint: "URL de callback do OAuth. Em produção: https://<seu-dominio>/oauth/mercadopago/callback",
  },
  {
    key: "encryptionKey",
    label: "Encryption Key",
    secret: true,
    hint: "Chave AES-GCM para criptografar tokens em repouso (qualquer valor secreto).",
  },
];

function WeazeConfiguracoes() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settingsId, setSettingsId] = useState<string | null>(null);
  const [form, setForm] = useState({
    defaultPlanValue: 237,
    blockedMessage: "",
    adminContact: "",
  });
  const [mpLoading, setMpLoading] = useState(true);
  const [mpSaving, setMpSaving] = useState(false);
  const [mpStatus, setMpStatus] = useState<Record<string, FieldStatus> | null>(null);
  const [mpKinds, setMpKinds] = useState<Partial<Record<MercadoPagoSettingKey, MercadoPagoSettingKind>>>({});
  const [mpWebhookUrl, setMpWebhookUrl] = useState<string | null>(null);
  const [mpValues, setMpValues] = useState<Record<string, string>>({});

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const { data } = await supabase.from("admin_settings").select("*").limit(1).maybeSingle();
        if (data) {
          setSettingsId(data.id);
          setForm({
            defaultPlanValue: Number(data.default_plan_value ?? 237),
            blockedMessage: data.blocked_message ?? "",
            adminContact: data.admin_contact ?? "",
          });
        }
      } catch (err) {
        console.error("Erro ao carregar configurações:", err);
        toast.error("Erro ao carregar configurações.");
      }
      setLoading(false);
    })();
  }, []);

  async function handleSave() {
    setSaving(true);
    try {
      const { error } = await supabase.from("admin_settings").upsert({
        id: settingsId ?? SETTINGS_ID,
        default_plan_value: form.defaultPlanValue,
        blocked_message: form.blockedMessage,
        admin_contact: form.adminContact,
      });
      if (error) throw error;
      toast.success("Configurações salvas!");
    } catch (err: any) {
      toast.error(err.message ?? "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    (async () => {
      setMpLoading(true);
      try {
        const { data: session } = await supabase.auth.getSession();
        const jwt = session?.session?.access_token;
        if (!jwt) return;
        const result = await getMercadoPagoSettings({ data: { jwt } });
        if (result.status === "success") {
          setMpStatus(result.fields);
          setMpKinds(result.kinds ?? {});
          setMpWebhookUrl(result.webhookUrl ?? null);
        } else if (result.status === "unauthorized") {
          toast.error(
            "Sua conta não tem a permissão de administrador necessária para o Mercado Pago.",
          );
        }
      } catch {
        toast.error("Não foi possível carregar o status das credenciais.");
      }
      setMpLoading(false);
    })();
  }, []);

  async function handleSaveMercadoPago() {
    const values = Object.fromEntries(
      Object.entries(mpValues).filter(([, value]) => value && value.trim() !== ""),
    );
    if (Object.keys(values).length === 0) {
      toast.info("Preencha pelo menos uma credencial para salvar.");
      return;
    }
    setMpSaving(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      const jwt = session?.session?.access_token;
      if (!jwt) throw new Error("Sessão expirada. Faça login novamente.");
      const result = await saveMercadoPagoSettings({ data: { jwt, values } });
      if (result.status === "unauthorized") {
        toast.error("Você não tem permissão para alterar estas credenciais.");
        return;
      }
      toast.success("Credenciais do Mercado Pago salvas!");
      setMpValues({});
      const status = await getMercadoPagoSettings({ data: { jwt } });
      if (status.status === "success") {
        setMpStatus(status.fields);
        setMpKinds(status.kinds ?? {});
        setMpWebhookUrl(status.webhookUrl ?? null);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar credenciais.");
    } finally {
      setMpSaving(false);
    }
  }

  if (loading) return <p className="text-sm text-muted-foreground">Carregando...</p>;

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="font-display text-3xl">Configurações</h1>
        <p className="text-muted-foreground text-sm mt-1">Configurações globais da WEAZE.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-display text-base">Mensalidade Padrão</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="defaultPlanValue">Valor padrão (R$)</Label>
            <Input
              id="defaultPlanValue"
              type="number"
              value={form.defaultPlanValue}
              onChange={(e) => setForm((p) => ({ ...p, defaultPlanValue: Number(e.target.value) }))}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Usado como sugestão ao cadastrar novas empresas.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-display text-base">Mensagem de Bloqueio</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="blockedMessage">Mensagem exibida para empresas bloqueadas</Label>
            <Textarea
              id="blockedMessage"
              value={form.blockedMessage}
              onChange={(e) => setForm((p) => ({ ...p, blockedMessage: e.target.value }))}
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-display text-base">Contato do Administrador</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="adminContact">Contato (email ou WhatsApp)</Label>
            <Input
              id="adminContact"
              value={form.adminContact}
              onChange={(e) => setForm((p) => ({ ...p, adminContact: e.target.value }))}
              placeholder="admin@weaze.com"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Exibido no botão "Entrar em contato" da página de bloqueio.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-display text-base flex items-center gap-2">
            <KeyRound className="size-4" /> Mercado Pago — Credenciais
          </CardTitle>
          <CardDescription>
            Adicione cada credencial da aplicação do Mercado Pago. Campos vazios
            mantêm o valor atual. Elas valem para todas as empresas (OAuth, webhook
            e checkout).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2 rounded-lg border bg-muted/40 p-3 text-sm">
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium">Modo</span>
              <div className="flex flex-wrap items-center gap-2">
                {mpKinds.publicKey && (
                  <Badge variant={mpKinds.publicKey === "production" ? "default" : "secondary"}>
                    Public Key: {KIND_LABEL[mpKinds.publicKey]}
                  </Badge>
                )}
                {mpKinds.accessToken && (
                  <Badge variant={mpKinds.accessToken === "production" ? "default" : "secondary"}>
                    Access Token: {KIND_LABEL[mpKinds.accessToken]}
                  </Badge>
                )}
              </div>
            </div>
            {mpKinds.publicKey && mpKinds.accessToken && mpKinds.publicKey !== mpKinds.accessToken && (
              <p className="text-xs font-medium text-destructive">
                Public Key e Access Token estão em modos diferentes. Use as duas chaves do mesmo
                ambiente, senão os pagamentos falham.
              </p>
            )}
            {mpWebhookUrl && (
              <div className="space-y-1">
                <span className="text-xs font-medium text-muted-foreground">
                  URL do webhook (para onde o Mercado Pago envia notificações):
                </span>
                <div className="break-all font-mono text-xs">{mpWebhookUrl}</div>
              </div>
            )}
          </div>
          {mpLoading ? (
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Carregando status...
            </div>
          ) : (
            MP_CREDENTIAL_FIELDS.map(({ key, label, hint, secret }) => {
              const status = mpStatus?.[key];
              const configured = status?.configured ?? false;
              return (
                <div key={key} className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <Label htmlFor={`mp-${key}`} className="text-sm font-medium">
                      {label}
                    </Label>
                    {configured ? (
                      <Badge variant={status?.source === "db" ? "default" : "secondary"}>
                        Configurado
                        {status?.source === "db" ? " (painel)" : " (env)"}
                      </Badge>
                    ) : (
                      <Badge variant="outline">Não configurado</Badge>
                    )}
                  </div>
                  <Input
                    id={`mp-${key}`}
                    type={secret ? "password" : "text"}
                    value={mpValues[key] ?? ""}
                    onChange={(e) =>
                      setMpValues((p) => ({ ...p, [key]: e.target.value }))
                    }
                    placeholder={configured ? "•••••••••• (deixe vazio para manter)" : `Adicionar ${label}`}
                    autoComplete="off"
                  />
                  <p className="text-xs text-muted-foreground">{hint}</p>
                </div>
              );
            })
          )}
          <Button onClick={handleSaveMercadoPago} disabled={mpSaving || mpLoading}>
            <Save className="h-4 w-4 mr-1" />
            {mpSaving ? "Salvando..." : "Salvar Credenciais do Mercado Pago"}
          </Button>
        </CardContent>
      </Card>

      <Button onClick={handleSave} disabled={saving}>
        <Save className="h-4 w-4 mr-1" /> Salvar Configurações
      </Button>
    </div>
  );
}
