import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin/metricas")({
  component: WeazeMetricas,
  head: () => ({ meta: [{ title: "Métricas — WEAZE Admin" }] }),
});

function WeazeMetricas() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({
    activeToday: 0,
    totalB2C: 0,
    totalOrders: 0,
    totalCheckins: 0,
    totalPosts: 0,
    totalInteractions: 0,
    predictedRevenue: 0,
    recurringRevenue: 0,
    blockedCount: 0,
    inactiveCount: 0,
    nearDueCount: 0,
  });

  useEffect(() => {
    (async () => {
      setLoading(true);
      const now = new Date();
      const today = now.toISOString().slice(0, 10);
      const nextWeek = new Date(now.getTime() + 7 * 86400_000).toISOString().slice(0, 10);

      try {
        const [
          { count: totalB2C },
          { count: totalOrders },
          { count: totalCheckins },
          { count: totalPosts },
          { count: totalInteractions },
          { data: companyRows },
          { data: todayCheckins },
        ] = await Promise.all([
          supabase.from("customers").select("*", { count: "exact", head: true }),
          supabase.from("orders").select("*", { count: "exact", head: true }),
          supabase.from("checkins").select("*", { count: "exact", head: true }),
          supabase.from("posts").select("*", { count: "exact", head: true }),
          supabase.from("post_reactions").select("*", { count: "exact", head: true }),
          supabase
            .from("companies")
            .select("id, status, monthly_fee, next_due_date, payment_status"),
          supabase.from("checkins").select("id").gte("start_time", today),
        ]);

        const companyList = companyRows ?? [];
        const blockedCount = companyList.filter((a: any) => a.status === "bloqueado").length;
        const nearDueCount = companyList.filter((a: any) => {
          if (!a.next_due_date) return false;
          const d = a.next_due_date.slice(0, 10);
          return d >= today && d <= nextWeek && a.payment_status !== "paid";
        }).length;
        const totalMonthly = companyList.reduce(
          (s: number, a: any) => s + (Number(a.monthly_fee) || 0),
          0,
        );
        const paidMonthly = companyList
          .filter((a: any) => a.payment_status === "paid")
          .reduce((s: number, a: any) => s + (Number(a.monthly_fee) || 0), 0);

        setData({
          activeToday: todayCheckins?.length ?? 0,
          totalB2C: totalB2C ?? 0,
          totalOrders: totalOrders ?? 0,
          totalCheckins: totalCheckins ?? 0,
          totalPosts: totalPosts ?? 0,
          totalInteractions: totalInteractions ?? 0,
          predictedRevenue: totalMonthly,
          recurringRevenue: paidMonthly,
          blockedCount,
          inactiveCount: companyList.filter(
            (a: any) => a.status !== "ativo" && a.status !== "teste",
          ).length,
          nearDueCount,
        });
      } catch (err) {
        console.error("Erro ao carregar métricas:", err);
        toast.error("Erro ao carregar métricas.");
      }
      setLoading(false);
    })();
  }, []);

  const metrics = [
    { label: "Empresas Ativas Hoje", value: data.activeToday },
    { label: "Clientes B2C Cadastrados", value: data.totalB2C },
    { label: "Pedidos Realizados", value: data.totalOrders },
    { label: "Check-ins", value: data.totalCheckins },
    { label: "Publicações", value: data.totalPosts },
    { label: "Interações", value: data.totalInteractions },
    {
      label: "Receita Prevista (mês)",
      value: `R$ ${data.predictedRevenue.toLocaleString("pt-BR")}`,
    },
    {
      label: "Receita Recorrente (paga)",
      value: `R$ ${data.recurringRevenue.toLocaleString("pt-BR")}`,
    },
    { label: "Clientes Bloqueados", value: data.blockedCount, danger: data.blockedCount > 0 },
    { label: "Empresas sem Atividade", value: data.inactiveCount, warning: data.inactiveCount > 0 },
    { label: "Próximas do Vencimento", value: data.nearDueCount, warning: data.nearDueCount > 0 },
  ];

  return (
    <div className={cn("space-y-6", loading && "opacity-50 pointer-events-none")}>
      <div>
        <h1 className="font-display text-3xl">Métricas</h1>
        <p className="text-muted-foreground text-sm mt-1">Indicadores reais da plataforma.</p>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {metrics.map((m) => (
          <Card key={m.label}>
            <CardContent className="p-5">
              <p className="text-xs uppercase tracking-widest text-muted-foreground">{m.label}</p>
              <p
                className={cn(
                  "font-display text-xl mt-1",
                  m.danger && "text-destructive",
                  m.warning && "text-orange-500",
                )}
              >
                {m.value}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
