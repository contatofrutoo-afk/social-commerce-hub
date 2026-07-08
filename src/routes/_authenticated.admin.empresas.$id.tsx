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
import { ArrowLeft, Ban, CheckCircle, Lock, Unlock, Save, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin/empresas/$id")({
  component: WeazeEmpresaFicha,
  head: () => ({ meta: [{ title: "Empresa — WEAZE Admin" }] }),
});

const statusOptions = [
  { value: "ativo", label: "Ativo", color: "default" },
  { value: "teste", label: "Em Teste", color: "secondary" },
  { value: "bloqueado", label: "Bloqueado", color: "destructive" },
  { value: "cancelado", label: "Cancelado", color: "outline" },
] as const;

const STATUS_MAP_TO_EN: Record<string, string> = {
  ativo: "active",
  teste: "trial",
  bloqueado: "blocked",
  cancelado: "cancelled",
};

const planOptions = ["Mensal", "Anual", "Promocional", "Personalizado"];
const paymentMethods = ["PIX", "Cartão", "Dinheiro", "Outro"];
const paymentStatuses = [
  { value: "paid", label: "Pago" },
  { value: "pending", label: "Em Aberto" },
  { value: "overdue", label: "Atrasado" },
  { value: "cancelled", label: "Cancelado" },
];

function WeazeEmpresaFicha() {
  const { id } = useParams({ from: "/_authenticated/admin/empresas/$id" });
  const nav = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isNew, setIsNew] = useState(false);
  const [form, setForm] = useState({
    name: "", slug: "", responsible: "", phone: "", email_principal: "",
    responsible_email: "", city: "", status: "ativo" as string,
    planType: "Mensal", monthlyFee: 237,
    nextDueDate: "", lastPaymentDate: "",
    paymentMethod: "PIX", paymentStatus: "pending", internalNotes: "",
  });

  useEffect(() => {
    if (!id) return;
    if (id === "nova") {
      setIsNew(true);
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase.from("companies").select("*").eq("id", id).single();
        if (cancelled) return;
        if (error || !data) { nav({ to: "/admin/empresas" }); return; }

        let status = data.status;
        let planType = data.plan_type;
        let monthlyFee = data.monthly_fee;
        let nextDueDate = data.next_due_date;
        let lastPaymentDate = data.last_payment_date;
        let paymentMethod = data.payment_method;
        let paymentStatus = data.payment_status;
        let internalNotes = data.internal_notes;

        if (!status) {
          const { data: adminData } = await supabase.from("company_admin").select("*").eq("company_id", id).maybeSingle();
          if (adminData) {
            status = adminData.status === "active" ? "ativo" : adminData.status === "blocked" ? "bloqueado" : adminData.status === "trial" ? "teste" : "cancelado";
            planType ||= adminData.plan_type;
            monthlyFee ??= adminData.monthly_fee;
            nextDueDate ||= adminData.next_due_date;
            lastPaymentDate ||= adminData.last_payment_date;
            paymentMethod ||= adminData.payment_method;
            paymentStatus ||= adminData.payment_status;
            internalNotes ||= adminData.internal_notes;
          }
        }

        setForm({
          name: data.name ?? "",
          slug: data.slug ?? "",
          responsible: data.responsible ?? "",
          phone: data.phone ?? "",
          email_principal: data.email_principal ?? "",
          responsible_email: data.responsible_email ?? "",
          city: data.city ?? "",
          status: status ?? "ativo",
          planType: planType ?? "Mensal",
          monthlyFee: Number(monthlyFee ?? 237),
          nextDueDate: nextDueDate ?? "",
          lastPaymentDate: lastPaymentDate ?? "",
          paymentMethod: paymentMethod ?? "PIX",
          paymentStatus: paymentStatus ?? "pending",
          internalNotes: internalNotes ?? "",
        });
      } catch { nav({ to: "/admin/empresas" }); }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [id, nav]);

  async function handleSave() {
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        slug: form.slug || form.name.toLowerCase().replace(/[^a-z0-9]/g, "-").slice(0, 40),
        responsible: form.responsible || null,
        phone: form.phone || null,
        email_principal: form.email_principal || null,
        responsible_email: form.responsible_email || null,
        city: form.city || null,
        status: form.status,
        plan_type: form.planType,
        monthly_fee: form.monthlyFee,
        next_due_date: form.nextDueDate || null,
        last_payment_date: form.lastPaymentDate || null,
        payment_method: form.paymentMethod,
        payment_status: form.paymentStatus,
        internal_notes: form.internalNotes,
      };

      if (isNew) {
        const { data, error } = await supabase.from("companies").insert(payload).select().single();
        if (error) throw error;
        toast.success("Empresa cadastrada!");
        nav({ to: "/admin/empresas/$id", params: { id: data.id }, replace: true });
        setIsNew(false);
      } else {
        const { error } = await supabase.from("companies").update(payload).eq("id", id);
        if (error) {
          if (error.code === "42703" || error.message?.includes("column") || error.message?.includes("does not exist")) {
            const adminPayload = {
              company_id: id,
              status: STATUS_MAP_TO_EN[form.status] ?? form.status,
              plan_type: form.planType,
              monthly_fee: form.monthlyFee,
              next_due_date: form.nextDueDate || null,
              last_payment_date: form.lastPaymentDate || null,
              payment_method: form.paymentMethod,
              payment_status: form.paymentStatus,
              internal_notes: form.internalNotes,
            };
            const { error: fbErr } = await supabase.from("company_admin").upsert(adminPayload, { onConflict: "company_id" });
            if (fbErr) throw fbErr;
          } else {
            throw error;
          }
        }
        toast.success("Dados salvos com sucesso!");
      }
    } catch (err: any) {
      toast.error(err.message ?? "Erro ao salvar");
    } finally { setSaving(false); }
  }

  async function handleDelete() {
    if (!id || isNew) return;
    if (!confirm("Tem certeza que deseja excluir esta empresa? Esta ação não pode ser desfeita.")) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("companies").delete().eq("id", id);
      if (error) throw error;
      toast.success("Empresa excluída!");
      nav({ to: "/admin/empresas" });
    } catch (err: any) {
      toast.error(err.message ?? "Erro ao excluir");
    } finally { setSaving(false); }
  }

  async function updateStatus(newStatus: string) {
    if (newStatus === form.status || isNew) return;
    const prevStatus = form.status;
    setForm((prev) => ({ ...prev, status: newStatus }));
    setSaving(true);
    try {
      const { error } = await supabase.from("companies").update({ status: newStatus }).eq("id", id);
      if (error) {
        if (error.code === "42703" || error.message?.includes("column") || error.message?.includes("does not exist")) {
          const { error: fbErr } = await supabase.from("company_admin").upsert(
            { company_id: id, status: STATUS_MAP_TO_EN[newStatus] ?? newStatus, plan_type: form.planType, monthly_fee: form.monthlyFee, payment_method: form.paymentMethod, payment_status: form.paymentStatus, internal_notes: form.internalNotes },
            { onConflict: "company_id" }
          );
          if (fbErr) throw fbErr;
        } else {
          throw error;
        }
      }
      toast.success(
        newStatus === "ativo" ? "Empresa ativada!" :
        newStatus === "bloqueado" ? "Acesso bloqueado!" :
        newStatus === "teste" ? "Status alterado para Teste" : "Empresa cancelada"
      );
    } catch (err: any) {
      toast.error(err.message ?? "Erro ao atualizar status");
      setForm((prev) => ({ ...prev, status: prevStatus }));
    } finally { setSaving(false); }
  }

  async function toggleBlock(block: boolean) {
    await updateStatus(block ? "bloqueado" : "ativo");
  }

  if (loading) return <p className="text-sm text-muted-foreground">Carregando...</p>;

  const isBlocked = form.status === "bloqueado";

  return (
    <div className="space-y-6 max-w-4xl">
      <button onClick={() => nav({ to: "/admin/empresas" })} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3 w-3" /> Voltar para Empresas
      </button>

      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-display text-2xl">{isNew ? "Nova Empresa" : form.name}</h1>
            {!isNew && (
              <span className={cn("text-xs font-semibold px-2.5 py-0.5 rounded-full border",
                form.status === "ativo" ? "bg-green-50 text-green-700 border-green-300" :
                form.status === "bloqueado" ? "bg-red-50 text-red-700 border-red-300" :
                form.status === "teste" ? "bg-yellow-50 text-yellow-700 border-yellow-300" :
                "bg-gray-50 text-gray-600 border-gray-300"
              )}>
                {statusOptions.find(s => s.value === form.status)?.label ?? form.status}
              </span>
            )}
          </div>
          {!isNew && <p className="text-sm text-muted-foreground mt-0.5">{form.city || "—"} · {form.slug}</p>}
        </div>
        <div className="flex gap-2">
          {!isNew && (
            <>
              {isBlocked ? (
                <Button onClick={() => toggleBlock(false)} disabled={saving} variant="outline" className="border-green-500 text-green-600 hover:bg-green-50">
                  <Unlock className="h-4 w-4 mr-1" /> Liberar Acesso
                </Button>
              ) : (
                <Button onClick={() => toggleBlock(true)} disabled={saving} variant="outline" className="border-destructive text-destructive hover:bg-destructive/10">
                  <Lock className="h-4 w-4 mr-1" /> Bloquear Acesso
                </Button>
              )}
              <Button onClick={handleDelete} disabled={saving} variant="outline" className="text-muted-foreground hover:text-destructive">
                <Trash2 className="h-4 w-4 mr-1" /> Excluir
              </Button>
            </>
          )}
          <Button onClick={handleSave} disabled={saving}>
            <Save className="h-4 w-4 mr-1" /> {isNew ? "Cadastrar" : "Salvar"}
          </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="font-display text-base">Informações da Empresa</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="name">Nome da Empresa</Label>
              <Input id="name" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} />
            </div>
            <div>
              <Label htmlFor="responsible">Responsável</Label>
              <Input id="responsible" value={form.responsible} onChange={(e) => setForm((p) => ({ ...p, responsible: e.target.value }))} />
            </div>
            <div>
              <Label htmlFor="phone">Telefone</Label>
              <Input id="phone" value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} />
            </div>
            <div>
              <Label htmlFor="email_principal">Email Principal</Label>
              <Input id="email_principal" type="email" value={form.email_principal} onChange={(e) => setForm((p) => ({ ...p, email_principal: e.target.value }))} />
            </div>
            <div>
              <Label htmlFor="responsible_email">Email do Responsável</Label>
              <Input id="responsible_email" type="email" value={form.responsible_email} onChange={(e) => setForm((p) => ({ ...p, responsible_email: e.target.value }))} />
            </div>
            <div>
              <Label htmlFor="city">Cidade</Label>
              <Input id="city" value={form.city} onChange={(e) => setForm((p) => ({ ...p, city: e.target.value }))} />
            </div>
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
            {statusOptions.map((opt) => {
              const active = form.status === opt.value;
              const colorClass = opt.value === "ativo" ? "border-green-500 text-green-700 bg-green-50" :
                opt.value === "bloqueado" ? "border-red-500 text-red-700 bg-red-50" :
                opt.value === "teste" ? "border-yellow-500 text-yellow-700 bg-yellow-50" :
                "border-gray-400 text-gray-600 bg-gray-50";
              return (
                <button key={opt.value} onClick={() => updateStatus(opt.value)} disabled={saving || form.status === opt.value}
                  className={cn("px-4 py-2 rounded-lg text-sm border font-medium transition-colors",
                    active ? colorClass : "bg-background text-muted-foreground border-input hover:border-foreground"
                  )}>
                  {opt.label}
                </button>
              );
            })}
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

      <div className="flex items-center gap-4 pb-8">
        {!isNew && (
          <>
            {isBlocked ? (
              <Button onClick={() => toggleBlock(false)} disabled={saving} size="lg" className="bg-green-600 hover:bg-green-700">
                <CheckCircle className="h-5 w-5 mr-2" /> Liberar Acesso
              </Button>
            ) : (
              <Button onClick={() => toggleBlock(true)} disabled={saving} size="lg" variant="destructive">
                <Ban className="h-5 w-5 mr-2" /> Bloquear Acesso
              </Button>
            )}
          </>
        )}
        <Button onClick={handleSave} disabled={saving} size="lg">
          <Save className="h-5 w-5 mr-2" /> {isNew ? "Cadastrar Empresa" : "Salvar Alterações"}
        </Button>
      </div>
    </div>
  );
}