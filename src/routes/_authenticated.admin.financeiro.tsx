import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin/financeiro")({
  component: WeazeFinanceiro,
  head: () => ({ meta: [{ title: "Financeiro — WEAZE Admin" }] }),
});

const paymentStatusLabel: Record<string, string> = {
  paid: "Pago", pending: "Em Aberto", overdue: "Atrasado", cancelled: "Cancelado",
};

const paymentStatusColor: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  paid: "default", pending: "secondary", overdue: "destructive", cancelled: "outline",
};

function WeazeFinanceiro() {
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const { data } = await supabase
          .from("companies")
          .select("id, name, slug, city, responsible, status, plan_type, monthly_fee, payment_status, payment_method, next_due_date, last_payment_date")
          .order("name");
        setRows(data ?? []);
      } catch { /* table may not exist */ }
      setLoading(false);
    })();
  }, []);

  const filtered = rows.filter((r: any) =>
    !search || r.name?.toLowerCase().includes(search.toLowerCase())
  );

  const kpis = (() => {
    let receivable = 0, received = 0, overdue = 0;
    let pendingCount = 0, paidCount = 0, overdueCount = 0;
    (rows ?? []).forEach((r: any) => {
      const fee = Number(r.monthly_fee) || 0;
      if (r.payment_status === "paid") { received += fee; paidCount++; }
      else if (r.payment_status === "pending") { receivable += fee; pendingCount++; }
      else if (r.payment_status === "overdue") { receivable += fee; overdueCount++; overdue += fee; }
    });
    return { receivable, received, overdue, pendingCount, paidCount, overdueCount, avgTicket: paidCount > 0 ? received / paidCount : 0 };
  })();

  return (
    <div className={cn("space-y-6", loading && "opacity-50 pointer-events-none")}>
      <div>
        <h1 className="font-display text-3xl">Financeiro</h1>
        <p className="text-muted-foreground text-sm mt-1">Controle financeiro dos estabelecimentos.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-5">
            <p className="text-xs uppercase tracking-widest text-muted-foreground">A Receber</p>
            <p className="font-display text-2xl mt-1">R$ {kpis.receivable.toLocaleString("pt-BR")}</p>
            <p className="text-xs text-muted-foreground mt-1">{kpis.pendingCount} pendentes</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-xs uppercase tracking-widest text-muted-foreground">Recebido</p>
            <p className="font-display text-2xl mt-1">R$ {kpis.received.toLocaleString("pt-BR")}</p>
            <p className="text-xs text-muted-foreground mt-1">{kpis.paidCount} pagos</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-xs uppercase tracking-widest text-muted-foreground">Em Atraso</p>
            <p className="font-display text-2xl mt-1 text-destructive">R$ {kpis.overdue.toLocaleString("pt-BR")}</p>
            <p className="text-xs text-muted-foreground mt-1">{kpis.overdueCount} empresas</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-xs uppercase tracking-widest text-muted-foreground">Ticket Médio</p>
            <p className="font-display text-2xl mt-1">R$ {kpis.avgTicket.toLocaleString("pt-BR")}</p>
            <p className="text-xs text-muted-foreground mt-1">por empresa</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="font-display text-base">Todas as Empresas</CardTitle>
            <div className="relative max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar empresa..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-9 text-sm" />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <p className="p-5 text-sm text-muted-foreground text-center">Nenhum registro encontrado.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs uppercase text-muted-foreground">
                    <th className="px-5 py-3 font-medium">Empresa</th>
                    <th className="px-5 py-3 font-medium">Responsável</th>
                    <th className="px-5 py-3 font-medium">Plano</th>
                    <th className="px-5 py-3 font-medium">Valor</th>
                    <th className="px-5 py-3 font-medium">Último Pagamento</th>
                    <th className="px-5 py-3 font-medium">Vencimento</th>
                    <th className="px-5 py-3 font-medium">Forma</th>
                    <th className="px-5 py-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r: any) => (
                    <tr key={r.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="px-5 py-3">
                        <Link to="/admin/empresas/$id" params={{ id: r.id }} className="font-medium hover:underline">
                          {r.name ?? "—"}
                        </Link>
                      </td>
                      <td className="px-5 py-3 text-muted-foreground">{r.responsible ?? "—"}</td>
                      <td className="px-5 py-3">{r.plan_type}</td>
                      <td className="px-5 py-3 font-medium">R$ {Number(r.monthly_fee).toFixed(2)}</td>
                      <td className="px-5 py-3 text-muted-foreground">{r.last_payment_date ? new Date(r.last_payment_date).toLocaleDateString("pt-BR") : "—"}</td>
                      <td className="px-5 py-3 text-muted-foreground">{r.next_due_date ? new Date(r.next_due_date).toLocaleDateString("pt-BR") : "—"}</td>
                      <td className="px-5 py-3">{r.payment_method}</td>
                      <td className="px-5 py-3">
                        <Badge variant={paymentStatusColor[r.payment_status] ?? "secondary"}>{paymentStatusLabel[r.payment_status] ?? r.payment_status}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
