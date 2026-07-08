import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Building2, Search, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/admin/empresas")({
  component: WeazeEmpresas,
  head: () => ({ meta: [{ title: "Empresas — WEAZE Admin" }] }),
});

const statusColor = (s: string) =>
  s === "ativo" ? "default" : s === "teste" ? "secondary" : s === "bloqueado" ? "destructive" : "outline";
const statusLabel = (s: string) =>
  s === "ativo" ? "Ativo" : s === "bloqueado" ? "Bloqueado" : s === "teste" ? "Teste" : "Cancelado";
const paymentLabel = (s: string) =>
  s === "paid" ? "Pago" : s === "pending" ? "Pendente" : s === "overdue" ? "Atrasado" : "Cancelado";

function WeazeEmpresas() {
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [companies, setCompanies] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const { data } = await supabase.from("companies").select("*").order("name");
        setCompanies(data ?? []);
      } catch { /* table may not exist */ }
      setLoading(false);
    })();
  }, []);

  const filtered = companies.filter((c: any) =>
    !search || c.name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl">Empresas</h1>
          <p className="text-muted-foreground text-sm mt-1">Gerencie empresas cadastradas na plataforma.</p>
        </div>
        <Link to="/admin/empresas/$id" params={{ id: "nova" }}>
          <Button><Plus className="h-4 w-4 mr-1" /> Nova Empresa</Button>
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
                      <p className="text-xs text-muted-foreground">{c.responsible ?? c.city ?? "—"}</p>
                    </div>
                    <Badge variant={statusColor(c.status) as any}>{statusLabel(c.status)}</Badge>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground mt-2">
                    <div><span className="block text-[10px] uppercase tracking-wider">Plano</span><span className="font-medium text-foreground">{c.plan_type}</span></div>
                    <div><span className="block text-[10px] uppercase tracking-wider">Valor</span><span className="font-medium text-foreground">R$ {Number(c.monthly_fee).toFixed(2)}</span></div>
                    <div><span className="block text-[10px] uppercase tracking-wider">Status</span><span className={cn("font-medium", c.payment_status === "paid" ? "text-green-600" : c.payment_status === "overdue" ? "text-destructive" : "text-muted-foreground")}>{paymentLabel(c.payment_status)}</span></div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground mt-1 pt-2 border-t border-border">
                    <div><span className="block text-[10px] uppercase tracking-wider">Vencimento</span><span>{c.next_due_date ? new Date(c.next_due_date).toLocaleDateString("pt-BR") : "—"}</span></div>
                    <div><span className="block text-[10px] uppercase tracking-wider">Último Pagamento</span><span>{c.last_payment_date ? new Date(c.last_payment_date).toLocaleDateString("pt-BR") : "—"}</span></div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
