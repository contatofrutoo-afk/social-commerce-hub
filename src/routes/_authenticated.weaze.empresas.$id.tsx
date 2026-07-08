import { createFileRoute, useParams, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ArrowLeft, Ban, CheckCircle, Lock, Unlock, Save, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/weaze/empresas/$id")({
  component: WeazeEmpresaFicha,
  head: () => ({ meta: [{ title: "Empresa — WEAZE Admin" }] }),
});

const statusOptions = [
  { value: "active", label: "Ativo", color: "default" },
  { value: "trial", label: "Em Teste", color: "secondary" },
  { value: "blocked", label: "Bloqueado", color: "destructive" },
  { value: "cancelled", label: "Cancelado", color: "outline" },
] as const;

const planOptions = ["Mensal", "Anual", "Promocional", "Personalizado"];
const paymentMethods = ["PIX", "Cartão", "Dinheiro", "Outro"];
const paymentStatuses = [
  { value: "paid", label: "Pago" },
  { value: "pending", label: "Em Aberto" },
  { value: "overdue", label: "Atrasado" },
  { value: "cancelled", label: "Cancelado" },
];

function WeazeEmpresaFicha() {
  const { id } = useParams({ from: "/_authenticated/weaze/empresas/$id" });
  const nav = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tenant, setTenant] = useState<any>(null);
  const [admin, setAdmin] = useState<any>(null);
  const [form, setForm] = useState({
    status: "active", planType: "Mensal", monthlyFee: 237,
    nextDueDate: "", lastPaymentDate: "",
    paymentMethod: "PIX", paymentStatus: "pending", internalNotes: "",
  });
  const [payments, setPayments] = useState<any[]>([]);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const { data: tenantData } = await supabase.from("companies").select("*").eq("id", id).single();
        if (cancelled) return;
        if (!tenantData) { nav({ to: "/weaze/empresas" }); return; }
        setTenant(tenantData);

        let adminData: any = null;
        try {
          const res = await supabase.from("company_admin").select("*").eq("company_id", id).single();
          adminData = res.data;
        } catch { /* not found */ }

        let paymentData: any[] = [];
        try {
          const res = await supabase.from("company_payments").select("*").eq("company_id", id).order("created_at", { ascending: false });
          paymentData = res.data ?? [];
        } catch { /* not found */ }

        if (adminData) {
          setAdmin(adminData);
          setForm({
            status: adminData.status, planType: adminData.plan_type,
            monthlyFee: Number(adminData.monthly_fee),
            nextDueDate: adminData.next_due_date ?? "", lastPaymentDate: adminData.last_payment_date ?? "",
            paymentMethod: adminData.payment_method, paymentStatus: adminData.payment_status,
            internalNotes: adminData.internal_notes ?? "",
          });
        } else {
          try {
            const { data: settings } = await supabase.from("admin_settings").select("default_plan_value").single();
            if (!cancelled) setForm((prev) => ({ ...prev, monthlyFee: Number(settings?.default_plan_value ?? 237) }));
          } catch { /* not found */ }
        }
        if (!cancelled) { setPayments(paymentData); setLoading(false); }
      } catch { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [id, nav]);

  async function handleSave() {
    if (!id) return;
    setSaving(true);
    try {
      const payload = {
        company_id: id, status: form.status, plan_type: form.planType,
        monthly_fee: form.monthlyFee, next_due_date: form.nextDueDate || null,
        last_payment_date: form.lastPaymentDate || null, payment_method: form.paymentMethod,
        payment_status: form.paymentStatus, internal_notes: form.internalNotes,
        blocked_at: form.status === "blocked" ? new Date().toISOString() : admin?.blocked_at ?? null,
        blocked_reason: form.status === "blocked" ? "Bloqueado manualmente pela WEAZE" : "",
      };
      if (admin) {
        const { error } = await supabase.from("company_admin").update(payload).eq("company_id", id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("company_admin").insert(payload);
        if (error) throw error;
      }
      toast.success("Dados salvos com sucesso!");
      const { data: refresh } = await supabase.from("company_admin").select("*").eq("company_id", id).single();
      if (refresh) setAdmin(refresh);
    } catch (err: any) {
      toast.error(err.message ?? "Erro ao salvar");
    } finally { setSaving(false); }
  }

  async function toggleBlock(block: boolean) {
    setForm((prev) => ({ ...prev, status: block ? "blocked" : "active" }));
    setSaving(true);
    try {
      const payload: any = {
        company_id: id, status: block ? "blocked" : "active",
        plan_type: form.planType, monthly_fee: form.monthlyFee,
        next_due_date: form.nextDueDate || null, last_payment_date: form.lastPaymentDate || null,
        payment_method: form.paymentMethod, payment_status: form.paymentStatus,
        internal_notes: form.internalNotes,
        blocked_at: block ? new Date().toISOString() : null,
        blocked_reason: block ? "Bloqueado manualmente pela WEAZE" : "",
      };
      if (admin) { await supabase.from("company_admin").update(payload).eq("company_id", id); }
      else { await supabase.from("company_admin").insert(payload); }
      toast.success(block ? "Acesso bloqueado!" : "Acesso liberado!");
      const { data: refresh } = await supabase.from("company_admin").select("*").eq("company_id", id).single();
      if (refresh) {
        setAdmin(refresh);
        setForm((prev) => ({ ...prev, status: refresh.status, blocked_at: refresh.blocked_at, blocked_reason: refresh.blocked_reason }));
      }
    } catch (err: any) {
      toast.error(err.message ?? "Erro");
      setForm((prev) => ({ ...prev, status: block ? "active" : "blocked" }));
    } finally { setSaving(false); }
  }

  if (loading) return <p className="text-sm text-muted-foreground">Carregando...</p>;
  if (!tenant) return null;

  const isBlocked = form.status === "blocked";

  return (
    <div className="space-y-6 max-w-4xl">
      <button onClick={() => nav({ to: "/weaze/empresas" })} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3 w-3" /> Voltar para Empresas
      </button>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl">{tenant.name}</h1>
          <p className="text-sm text-muted-foreground">{tenant.city ?? "—"} · {tenant.slug}</p>
        </div>
        <div className="flex gap-2">
          {isBlocked ? (
            <Button onClick={() => toggleBlock(false)} disabled={saving} variant="outline" className="border-green-500 text-green-600 hover:bg-green-50">
              <Unlock className="h-4 w-4 mr-1" /> Liberar Acesso
            </Button>
          ) : (
            <Button onClick={() => toggleBlock(true)} disabled={saving} variant="outline" className="border-destructive text-destructive hover:bg-destructive/10">
              <Lock className="h-4 w-4 mr-1" /> Bloquear Acesso
            </Button>
          )}
          <Button onClick={handleSave} disabled={saving}>
            <Save className="h-4 w-4 mr-1" /> Salvar
          </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="font-display text-base">Informações da Empresa</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div><Label>Nome</Label><p className="text-sm font-medium">{tenant.name}</p></div>
            <div><Label>Responsável</Label><p className="text-sm">{tenant.responsible ?? "—"}</p></div>
            <div><Label>Telefone</Label><p className="text-sm">{tenant.phone ?? "—"}</p></div>
            <div><Label>Email</Label><p className="text-sm break-all">{tenant.email_principal ?? tenant.responsible_email ?? "—"}</p></div>
            <div><Label>Cidade</Label><p className="text-sm">{tenant.city ?? "—"}</p></div>
            <div><Label>Data de Cadastro</Label><p className="text-sm">{tenant.created_at ? new Date(tenant.created_at).toLocaleDateString("pt-BR") : "—"}</p></div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="font-display text-base">Plano e Financeiro</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="planType">Plano</Label>
              <select id="planType" value={form.planType} onChange={(e) => setForm((p) => ({ ...p, planType: e.target.value }))}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                {planOptions.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <Label htmlFor="monthlyFee">Valor Mensal (R$)</Label>
              <Input id="monthlyFee" type="number" value={form.monthlyFee} onChange={(e) => setForm((p) => ({ ...p, monthlyFee: Number(e.target.value) }))} />
            </div>
            <div>
              <Label htmlFor="nextDueDate">Próximo Vencimento</Label>
              <Input id="nextDueDate" type="date" value={form.nextDueDate} onChange={(e) => setForm((p) => ({ ...p, nextDueDate: e.target.value }))} />
            </div>
            <div>
              <Label htmlFor="lastPaymentDate">Último Pagamento</Label>
              <Input id="lastPaymentDate" type="date" value={form.lastPaymentDate} onChange={(e) => setForm((p) => ({ ...p, lastPaymentDate: e.target.value }))} />
            </div>
            <div>
              <Label htmlFor="paymentMethod">Forma de Pagamento</Label>
              <select id="paymentMethod" value={form.paymentMethod} onChange={(e) => setForm((p) => ({ ...p, paymentMethod: e.target.value }))}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                {paymentMethods.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <Label htmlFor="paymentStatus">Status do Pagamento</Label>
              <select id="paymentStatus" value={form.paymentStatus} onChange={(e) => setForm((p) => ({ ...p, paymentStatus: e.target.value }))}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                {paymentStatuses.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="font-display text-base">Status</CardTitle></CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {statusOptions.map((opt) => (
              <button key={opt.value} onClick={() => setForm((p) => ({ ...p, status: opt.value }))}
                className={cn("px-4 py-2 rounded-lg text-sm border transition-colors",
                  form.status === opt.value ? "bg-foreground text-background border-foreground" : "bg-background text-muted-foreground border-input hover:border-foreground"
                )}>
                {opt.label}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="font-display text-base">Observações Internas</CardTitle></CardHeader>
        <CardContent>
          <Textarea value={form.internalNotes} onChange={(e) => setForm((p) => ({ ...p, internalNotes: e.target.value }))}
            placeholder="Anotações internas (não visível para o cliente)" rows={4} />
        </CardContent>
      </Card>

      {payments.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="font-display text-base">Histórico de Pagamentos</CardTitle></CardHeader>
          <CardContent className="p-0">
            <div className="divide-y text-sm">
              {payments.map((p: any) => (
                <div key={p.id} className="flex items-center justify-between px-5 py-3">
                  <div>
                    <span className="font-medium">R$ {Number(p.amount).toLocaleString("pt-BR")}</span>
                    <span className="text-muted-foreground ml-2">{p.payment_method}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-muted-foreground">{new Date(p.payment_date).toLocaleDateString("pt-BR")}</span>
                    <Badge variant={p.status === "paid" ? "default" : p.status === "overdue" ? "destructive" : "secondary"} className="ml-2">
                      {p.status === "paid" ? "Pago" : p.status === "pending" ? "Pendente" : p.status === "overdue" ? "Atrasado" : "Cancelado"}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex items-center gap-4 pb-8">
        {isBlocked ? (
          <Button onClick={() => toggleBlock(false)} disabled={saving} size="lg" className="bg-green-600 hover:bg-green-700">
            <CheckCircle className="h-5 w-5 mr-2" /> Liberar Acesso
          </Button>
        ) : (
          <Button onClick={() => toggleBlock(true)} disabled={saving} size="lg" variant="destructive">
            <Ban className="h-5 w-5 mr-2" /> Bloquear Acesso
          </Button>
        )}
        <Button onClick={handleSave} disabled={saving} size="lg">
          <Save className="h-5 w-5 mr-2" /> Salvar Alterações
        </Button>
      </div>
    </div>
  );
}
