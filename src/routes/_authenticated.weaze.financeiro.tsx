import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DollarSign, TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/weaze/financeiro")({
  component: WeazeFinanceiro,
  head: () => ({ meta: [{ title: "Financeiro — WEAZE Admin" }] }),
});

function WeazeFinanceiro() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({
    totalReceivable: 0, totalReceived: 0, totalOverdue: 0,
    pendingCount: 0, overdueCount: 0, paidCount: 0, avgTicket: 0,
    payments: [] as any[], recentPayments: [] as any[],
  });

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const { data: adminRows } = await supabase.from("company_admin").select("company_id, monthly_fee, payment_status, next_due_date, companies!inner(name)");
        const { data: payments } = await supabase.from("company_payments").select("*, company_id").order("created_at", { ascending: false }).limit(50);

        let totalReceivable = 0, totalReceived = 0, paidCount = 0, pendingCount = 0, overdueCount = 0;

        (adminRows ?? []).forEach((a: any) => {
          const fee = Number(a.monthly_fee) || 0;
          if (a.payment_status === "paid") { totalReceived += fee; paidCount++; }
          else if (a.payment_status === "pending") { totalReceivable += fee; pendingCount++; }
          else if (a.payment_status === "overdue") { totalReceivable += fee; overdueCount++; }
        });

        setData({
          totalReceivable, totalReceived,
          totalOverdue: (adminRows ?? []).filter((a: any) => a.payment_status === "overdue").reduce((s: number, a: any) => s + (Number(a.monthly_fee) || 0), 0),
          pendingCount, overdueCount, paidCount,
          avgTicket: paidCount > 0 ? totalReceived / paidCount : 0,
          payments: adminRows ?? [], recentPayments: payments ?? [],
        });
      } catch { /* table may not exist */ }
      setLoading(false);
    })();
  }, []);

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
            <p className="font-display text-2xl mt-1">R$ {data.totalReceivable.toLocaleString("pt-BR")}</p>
            <p className="text-xs text-muted-foreground mt-1">{data.pendingCount} pendentes</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-xs uppercase tracking-widest text-muted-foreground">Recebido</p>
            <p className="font-display text-2xl mt-1">R$ {data.totalReceived.toLocaleString("pt-BR")}</p>
            <p className="text-xs text-muted-foreground mt-1">{data.paidCount} pagos</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-xs uppercase tracking-widest text-muted-foreground">Em Atraso</p>
            <p className="font-display text-2xl mt-1 text-destructive">R$ {data.totalOverdue.toLocaleString("pt-BR")}</p>
            <p className="text-xs text-muted-foreground mt-1">{data.overdueCount} empresas</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-xs uppercase tracking-widest text-muted-foreground">Ticket Médio</p>
            <p className="font-display text-2xl mt-1">R$ {data.avgTicket.toLocaleString("pt-BR")}</p>
            <p className="text-xs text-muted-foreground mt-1">por empresa</p>
          </CardContent>
        </Card>
      </div>

      {data.recentPayments.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="font-display text-base">Últimos Pagamentos</CardTitle></CardHeader>
          <CardContent className="p-0">
            <div className="divide-y text-sm">
              {data.recentPayments.slice(0, 20).map((p: any) => (
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
    </div>
  );
}
