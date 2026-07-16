import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CheckCircle2, XCircle, Ban, RotateCcw, ArchiveX, Filter } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin/aprovacoes")({
  component: ApprovalsPage,
  head: () => ({ meta: [{ title: "Aprovações de Pagamento — WEAZE Admin" }] }),
});

type Company = {
  id: string;
  name: string;
  slug: string;
  responsible: string | null;
  responsible_email: string | null;
  email_principal: string | null;
  phone: string | null;
  city: string | null;
  plan_type: string;
  status: string;
  payment_method: string;
  payment_informed_at: string | null;
  payment_confirmation_date: string | null;
  approved_at: string | null;
  blocked_at: string | null;
  blocked_reason: string | null;
  internal_notes: string | null;
  created_at: string;
};

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  aguardando_pagamento: { label: "Aguardando pagamento", className: "bg-amber-500/10 text-amber-700" },
  pagamento_em_analise: { label: "Em análise", className: "bg-blue-500/10 text-blue-700" },
  ativo: { label: "Ativo", className: "bg-emerald-500/10 text-emerald-700" },
  teste: { label: "Teste", className: "bg-purple-500/10 text-purple-700" },
  bloqueado: { label: "Bloqueado", className: "bg-red-500/10 text-red-700" },
  cancelado: { label: "Cancelado", className: "bg-muted text-muted-foreground" },
};

function formatDate(v: string | null) {
  if (!v) return "—";
  try {
    return new Date(v).toLocaleString("pt-BR");
  } catch {
    return v;
  }
}

function ApprovalsPage() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<string>("pagamento_em_analise");
  const [blockingId, setBlockingId] = useState<string | null>(null);
  const [blockReason, setBlockReason] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const { data: companies, isLoading } = useQuery({
    queryKey: ["admin-approvals-companies", filter],
    queryFn: async () => {
      let query = supabase
        .from("companies")
        .select(
          "id, name, slug, responsible, responsible_email, email_principal, phone, city, plan_type, status, payment_method, payment_informed_at, payment_confirmation_date, approved_at, blocked_at, blocked_reason, internal_notes, created_at",
        )
        .order("payment_informed_at", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false });
      if (filter !== "all") query = query.eq("status", filter);
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as unknown as Company[];
    },
  });

  async function setStatus(companyId: string, newStatus: string, reason?: string) {
    setBusyId(companyId);
    try {
      const { error } = await (supabase as any).rpc("admin_set_company_status", {
        _company_id: companyId,
        _new_status: newStatus,
        _reason: reason ?? null,
      });
      if (error) throw error;
      toast.success("Status atualizado.");
      await queryClient.invalidateQueries({ queryKey: ["admin-approvals-companies"] });
    } catch (err: any) {
      toast.error(err?.message ?? "Erro ao atualizar status.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="dash-surface -m-4 space-y-6 p-4 md:-m-8 md:p-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">Aprovações de Pagamento</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Libere, bloqueie, rejeite ou cancele o acesso das empresas.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pagamento_em_analise">Em análise (fila)</SelectItem>
              <SelectItem value="aguardando_pagamento">Aguardando pagamento</SelectItem>
              <SelectItem value="ativo">Ativas</SelectItem>
              <SelectItem value="bloqueado">Bloqueadas</SelectItem>
              <SelectItem value="cancelado">Canceladas</SelectItem>
              <SelectItem value="teste">Em teste</SelectItem>
              <SelectItem value="all">Todas</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <div className="dash-card p-6 text-sm text-muted-foreground">Carregando…</div>
      ) : (companies?.length ?? 0) === 0 ? (
        <div className="dash-card p-8 text-center text-sm text-muted-foreground">
          Nenhuma empresa neste filtro.
        </div>
      ) : (
        <div className="space-y-4">
          {companies!.map((c) => {
            const st = STATUS_LABELS[c.status] ?? { label: c.status, className: "bg-muted" };
            const busy = busyId === c.id;
            return (
              <div key={c.id} className="dash-card p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-display text-lg font-bold">{c.name}</h3>
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
                          st.className,
                        )}
                      >
                        {st.label}
                      </span>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1.5 text-xs text-muted-foreground md:grid-cols-4">
                      <Field label="Responsável" value={c.responsible} />
                      <Field label="Email" value={c.responsible_email || c.email_principal} />
                      <Field label="Telefone" value={c.phone} />
                      <Field label="Cidade" value={c.city} />
                      <Field label="Plano" value={c.plan_type} />
                      <Field label="Forma pagto." value={c.payment_method} />
                      <Field label="Cadastro" value={formatDate(c.created_at)} />
                      <Field label="Solicitação" value={formatDate(c.payment_informed_at)} />
                      {c.approved_at && <Field label="Liberado em" value={formatDate(c.approved_at)} />}
                      {c.blocked_at && <Field label="Bloqueado em" value={formatDate(c.blocked_at)} />}
                    </div>
                    {c.blocked_reason && (
                      <p className="mt-2 text-xs text-red-600">Motivo: {c.blocked_reason}</p>
                    )}
                    {c.internal_notes && (
                      <p className="mt-2 text-xs italic text-muted-foreground">Obs.: {c.internal_notes}</p>
                    )}
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {c.status !== "ativo" && (
                    <Button
                      size="sm"
                      disabled={busy}
                      onClick={() => setStatus(c.id, "ativo")}
                      className="gap-1"
                    >
                      <CheckCircle2 className="h-4 w-4" /> Liberar acesso
                    </Button>
                  )}
                  {c.status === "pagamento_em_analise" && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy}
                      onClick={() => setStatus(c.id, "aguardando_pagamento")}
                      className="gap-1"
                    >
                      <XCircle className="h-4 w-4" /> Rejeitar pagamento
                    </Button>
                  )}
                  {c.status !== "bloqueado" && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy}
                      onClick={() => {
                        setBlockingId(c.id);
                        setBlockReason("");
                      }}
                      className="gap-1 border-red-200 text-red-700 hover:bg-red-50"
                    >
                      <Ban className="h-4 w-4" /> Bloquear
                    </Button>
                  )}
                  {c.status === "bloqueado" && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy}
                      onClick={() => setStatus(c.id, "ativo")}
                      className="gap-1"
                    >
                      <RotateCcw className="h-4 w-4" /> Reativar
                    </Button>
                  )}
                  {c.status !== "cancelado" && (
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={busy}
                      onClick={() => setStatus(c.id, "cancelado")}
                      className="gap-1 text-muted-foreground"
                    >
                      <ArchiveX className="h-4 w-4" /> Cancelar
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={!!blockingId} onOpenChange={(o) => !o && setBlockingId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bloquear empresa</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="reason">Motivo (opcional)</Label>
            <Input
              id="reason"
              value={blockReason}
              onChange={(e) => setBlockReason(e.target.value)}
              placeholder="Ex.: falta de pagamento após tentativa"
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setBlockingId(null)}>
              Cancelar
            </Button>
            <Button
              onClick={async () => {
                if (!blockingId) return;
                const id = blockingId;
                setBlockingId(null);
                await setStatus(id, "bloqueado", blockReason || undefined);
              }}
            >
              Bloquear
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="min-w-0">
      <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">
        {label}
      </div>
      <div className="truncate text-foreground">{value || "—"}</div>
    </div>
  );
}
