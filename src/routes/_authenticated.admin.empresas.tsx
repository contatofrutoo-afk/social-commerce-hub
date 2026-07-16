import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Building2, Search, Plus, Shield, ShieldOff, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const STATUS_MAP_TO_EN: Record<string, string> = {
  ativo: "active",
  bloqueado: "blocked",
  teste: "trial",
  cancelado: "cancelled",
};

export const Route = createFileRoute("/_authenticated/admin/empresas")({
  component: WeazeEmpresas,
  head: () => ({ meta: [{ title: "Empresas — WEAZE Admin" }] }),
});

const statusBadgeClass = (s: string) =>
  s === "ativo"
    ? "bg-green-100 text-green-800 border-green-300 hover:bg-green-200"
    : s === "bloqueado"
      ? "bg-red-100 text-red-800 border-red-300 hover:bg-red-200"
      : s === "teste"
        ? "bg-yellow-100 text-yellow-800 border-yellow-300 hover:bg-yellow-200"
        : "bg-gray-100 text-gray-800 border-gray-300 hover:bg-gray-200";
const statusLabel = (s: string) =>
  s === "ativo" ? "Ativo" : s === "bloqueado" ? "Bloqueado" : s === "teste" ? "Teste" : "Cancelado";
const paymentLabel = (s: string) =>
  s === "paid" ? "Pago" : s === "pending" ? "Pendente" : s === "overdue" ? "Atrasado" : "Cancelado";

function WeazeEmpresas() {
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [companies, setCompanies] = useState<any[]>([]);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const { data } = await supabase.from("companies").select("*").order("name");
        setCompanies(data ?? []);
      } catch (err) {
        console.error("Erro ao carregar empresas:", err);
        toast.error("Erro ao carregar empresas.");
      }
      setLoading(false);
    })();
  }, []);

  const filtered = companies.filter(
    (c: any) => !search || c.name?.toLowerCase().includes(search.toLowerCase()),
  );

  const toggleStatus = async (e: React.MouseEvent, c: any) => {
    e.preventDefault();
    e.stopPropagation();
    const newStatus = c.status === "bloqueado" ? "ativo" : "bloqueado";
    setTogglingId(c.id);
    try {
      const { error } = await supabase
        .from("companies")
        .update({ status: newStatus })
        .eq("id", c.id);
      if (error) {
        if (
          error.code === "42703" ||
          error.message?.includes("column") ||
          error.message?.includes("does not exist")
        ) {
          const { error: fbErr } = await supabase
            .from("company_admin")
            .upsert(
              { company_id: c.id, status: STATUS_MAP_TO_EN[newStatus] ?? newStatus },
              { onConflict: "company_id" },
            );
          if (fbErr) throw fbErr;
        } else {
          throw error;
        }
      }
      setCompanies((prev) =>
        prev.map((co) => (co.id === c.id ? { ...co, status: newStatus } : co)),
      );
      toast.success(newStatus === "bloqueado" ? "Empresa bloqueada!" : "Empresa desbloqueada!");
    } catch (err: any) {
      toast.error(err.message ?? "Erro ao alterar status");
    } finally {
      setTogglingId(null);
    }
  };

  const deleteCompany = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const { error } = await (supabase as any).rpc("delete_company", {
        _company_id: deleteTarget.id,
      });
      if (error) throw error;
      setCompanies((prev) => prev.filter((c) => c.id !== deleteTarget.id));
      toast.success(`Empresa "${deleteTarget.name}" excluída!`);
      setDeleteTarget(null);
    } catch (err: any) {
      toast.error(err.message ?? "Erro ao excluir empresa");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl">Empresas</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Gerencie empresas cadastradas na plataforma.
          </p>
        </div>
        <Link to="/admin/empresas/$id" params={{ id: "nova" }}>
          <Button>
            <Plus className="h-4 w-4 mr-1" /> Nova Empresa
          </Button>
        </Link>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar empresa..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            <Building2 className="mx-auto h-8 w-8 mb-2 opacity-40" />
            <p>Nenhuma empresa encontrada.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((c: any) => (
            <Link key={c.id} to="/admin/empresas/$id" params={{ id: c.id }} className="block">
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-display font-semibold">{c.name ?? "—"}</h3>
                      <p className="text-xs text-muted-foreground">
                        {c.responsible ?? c.city ?? "—"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={statusBadgeClass(c.status)}>{statusLabel(c.status)}</Badge>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        disabled={togglingId === c.id}
                        onClick={(e) => toggleStatus(e, c)}
                        title={c.status === "bloqueado" ? "Desbloquear" : "Bloquear"}
                      >
                        {c.status === "bloqueado" ? (
                          <ShieldOff className="h-4 w-4 text-red-600" />
                        ) : (
                          <Shield className="h-4 w-4 text-green-600" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setDeleteTarget(c);
                        }}
                        title="Excluir empresa"
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground mt-2">
                    <div>
                      <span className="block text-[10px] uppercase tracking-wider">Plano</span>
                      <span className="font-medium text-foreground">{c.plan_type}</span>
                    </div>
                    <div>
                      <span className="block text-[10px] uppercase tracking-wider">Valor</span>
                      <span className="font-medium text-foreground">
                        R$ {Number(c.monthly_fee).toFixed(2)}
                      </span>
                    </div>
                    <div>
                      <span className="block text-[10px] uppercase tracking-wider">Status</span>
                      <span
                        className={cn(
                          "font-medium",
                          c.payment_status === "paid"
                            ? "text-green-600"
                            : c.payment_status === "overdue"
                              ? "text-destructive"
                              : "text-muted-foreground",
                        )}
                      >
                        {paymentLabel(c.payment_status)}
                      </span>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground mt-1 pt-2 border-t border-border">
                    <div>
                      <span className="block text-[10px] uppercase tracking-wider">Vencimento</span>
                      <span>
                        {c.next_due_date
                          ? new Date(c.next_due_date).toLocaleDateString("pt-BR")
                          : "—"}
                      </span>
                    </div>
                    <div>
                      <span className="block text-[10px] uppercase tracking-wider">
                        Último Pagamento
                      </span>
                      <span>
                        {c.last_payment_date
                          ? new Date(c.last_payment_date).toLocaleDateString("pt-BR")
                          : "—"}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir empresa</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir <strong>{deleteTarget?.name}</strong>? Todos os dados
              associados serão removidos permanentemente.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleting}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={deleteCompany} disabled={deleting}>
              {deleting ? "Excluindo…" : "Excluir"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
