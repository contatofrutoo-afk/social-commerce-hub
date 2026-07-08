import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Save } from "lucide-react";

export const Route = createFileRoute("/_authenticated/weaze/configuracoes")({
  component: WeazeConfiguracoes,
  head: () => ({ meta: [{ title: "Configurações — WEAZE Admin" }] }),
});

const SETTINGS_ID = "00000000-0000-0000-0000-000000000000";

function WeazeConfiguracoes() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    defaultPlanValue: 237, blockedMessage: "", adminContact: "",
  });

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const { data } = await supabase.from("admin_settings").select("*").single();
        if (data) {
          setForm({
            defaultPlanValue: Number(data.default_plan_value ?? 237),
            blockedMessage: data.blocked_message ?? "",
            adminContact: data.admin_contact ?? "",
          });
        }
      } catch { /* table may not exist */ }
      setLoading(false);
    })();
  }, []);

  async function handleSave() {
    setSaving(true);
    try {
      const { error } = await supabase.from("admin_settings").upsert({
        id: SETTINGS_ID, default_plan_value: form.defaultPlanValue,
        blocked_message: form.blockedMessage, admin_contact: form.adminContact,
      });
      if (error) throw error;
      toast.success("Configurações salvas!");
    } catch (err: any) {
      toast.error(err.message ?? "Erro ao salvar");
    } finally { setSaving(false); }
  }

  if (loading) return <p className="text-sm text-muted-foreground">Carregando...</p>;

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="font-display text-3xl">Configurações</h1>
        <p className="text-muted-foreground text-sm mt-1">Configurações globais da WEAZE.</p>
      </div>

      <Card>
        <CardHeader><CardTitle className="font-display text-base">Mensalidade Padrão</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="defaultPlanValue">Valor padrão (R$)</Label>
            <Input id="defaultPlanValue" type="number" value={form.defaultPlanValue}
              onChange={(e) => setForm((p) => ({ ...p, defaultPlanValue: Number(e.target.value) }))} />
            <p className="text-xs text-muted-foreground mt-1">Usado como sugestão ao cadastrar novas empresas.</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="font-display text-base">Mensagem de Bloqueio</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="blockedMessage">Mensagem exibida para empresas bloqueadas</Label>
            <Textarea id="blockedMessage" value={form.blockedMessage}
              onChange={(e) => setForm((p) => ({ ...p, blockedMessage: e.target.value }))} rows={3} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="font-display text-base">Contato do Administrador</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="adminContact">Contato (email ou WhatsApp)</Label>
            <Input id="adminContact" value={form.adminContact}
              onChange={(e) => setForm((p) => ({ ...p, adminContact: e.target.value }))}
              placeholder="admin@weaze.com" />
            <p className="text-xs text-muted-foreground mt-1">Exibido no botão "Entrar em contato" da página de bloqueio.</p>
          </div>
        </CardContent>
      </Card>

      <Button onClick={handleSave} disabled={saving}>
        <Save className="h-4 w-4 mr-1" /> Salvar Configurações
      </Button>
    </div>
  );
}
