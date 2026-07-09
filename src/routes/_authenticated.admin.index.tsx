import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import {
  Building2,
  Users,
  Ban,
  Clock,
  DollarSign,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Activity,
} from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin/")({
  component: WeazeDashboard,
  head: () => ({ meta: [{ title: "Dashboard — WEAZE Admin" }] }),
});

function KPI({
  label,
  value,
  icon: Icon,
  hint,
  variant,
}: {
  label: string;
  value: string;
  icon?: React.ElementType;
  hint?: string;
  variant?: "default" | "warning" | "danger" | "success";
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <p className="text-xs uppercase tracking-widest text-muted-foreground">{label}</p>
        <div className="flex items-center gap-2 mt-1">
          {Icon && (
            <Icon
              className={cn(
                "h-5 w-5",
                variant === "danger"
                  ? "text-destructive"
                  : variant === "warning"
                    ? "text-orange-500"
                    : variant === "success"
                      ? "text-green-500"
                      : "text-muted-foreground",
              )}
            />
          )}
          <p className="font-display text-2xl">{value}</p>
        </div>
        {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
      </CardContent>
    </Card>
  );
}

function WeazeDashboard() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({
    totalCompanies: 0,
    activeCompanies: 0,
    blockedCompanies: 0,
    trialCompanies: 0,
    cancelledCompanies: 0,
    monthlyRevenue: 0,
    annualRevenue: 0,
    dueThisWeek: 0,
    overdue: 0,
    newThisMonth: 0,
    cancellationsThisMonth: 0,
    topCompanies: [] as { name: string; posts: number; checkins: number }[],
    inactiveCompanies: [] as string[],
  });

  useEffect(() => {
    (async () => {
      setLoading(true);
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const thisWeekEnd = new Date(now.getTime() + 7 * 86400_000).toISOString().slice(0, 10);
      const todayStr = now.toISOString().slice(0, 10);

      try {
        const [{ data: companies }, { data: allCompanies }] = await Promise.all([
          supabase.from("companies").select("id, name, created_at"),
          supabase
            .from("companies")
            .select(
              "id, name, status, plan_type, monthly_fee, next_due_date, payment_status, created_at",
            ),
        ]);

        const total = companies?.length ?? 0;
        let active = 0,
          blocked = 0,
          trial = 0,
          cancelled = 0;
        let monthlyRev = 0;
        let dueThisWeek = 0,
          overdue = 0;

        const activeCompanyIds: string[] = [];

        (allCompanies ?? []).forEach((c: any) => {
          const fee = Number(c.monthly_fee) || 0;
          monthlyRev += fee;
          if (c.status === "ativo") {
            active++;
            activeCompanyIds.push(c.id);
          } else if (c.status === "bloqueado") blocked++;
          else if (c.status === "teste") trial++;
          else if (c.status === "cancelado") cancelled++;
          if (c.next_due_date) {
            const due = c.next_due_date.slice(0, 10);
            if (due >= todayStr && due <= thisWeekEnd) dueThisWeek++;
            if (due < todayStr && c.payment_status !== "paid") overdue++;
          }
        });

        const newThisMonth =
          companies?.filter((t: any) => t.created_at >= startOfMonth).length ?? 0;

        const topCompanies: { name: string; posts: number; checkins: number }[] = [];
        const inactiveCompanies: string[] = [];

        if (activeCompanyIds.length > 0) {
          const { data: activeCompanyData } = await supabase
            .from("companies")
            .select("id, name")
            .in("id", activeCompanyIds);

          const activeNames = new Map((activeCompanyData ?? []).map((t: any) => [t.id, t.name]));

          const cids = activeCompanyIds.slice(0, 20);
          const batchResults = await Promise.all(
            cids.flatMap((cid) => [
              supabase
                .from("posts")
                .select("*", { count: "exact", head: true })
                .eq("company_id", cid),
              supabase
                .from("checkins")
                .select("*", { count: "exact", head: true })
                .gte("start_time", startOfMonth)
                .eq("company_id", cid),
            ]),
          );
          for (let i = 0; i < cids.length; i++) {
            const cid = cids[i];
            const posts = batchResults[i * 2].count ?? 0;
            const checkins = batchResults[i * 2 + 1].count ?? 0;
            const name = activeNames.get(cid) ?? "?";
            topCompanies.push({ name, posts, checkins });
            if (posts === 0 && checkins === 0) inactiveCompanies.push(name);
          }
          topCompanies.sort((a, b) => b.checkins + b.posts - (a.checkins + a.posts));
        }

        setData({
          totalCompanies: total,
          activeCompanies: active,
          blockedCompanies: blocked,
          trialCompanies: trial,
          cancelledCompanies: cancelled,
          monthlyRevenue: monthlyRev,
          annualRevenue: monthlyRev * 12,
          dueThisWeek,
          overdue,
          newThisMonth,
          cancellationsThisMonth: cancelled,
          topCompanies: topCompanies.slice(0, 10),
          inactiveCompanies,
        });
      } catch (err) {
        console.error("Erro ao carregar dashboard:", err);
        toast.error("Erro ao carregar dashboard.");
      }
      setLoading(false);
    })();
  }, []);

  return (
    <div className={cn("space-y-6", loading && "opacity-50 pointer-events-none")}>
      <div>
        <h1 className="font-display text-3xl">Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-1">Indicadores gerais da WEAZE.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPI label="Empresas Cadastradas" value={data.totalCompanies.toString()} icon={Building2} />
        <KPI
          label="Empresas Ativas"
          value={data.activeCompanies.toString()}
          icon={Building2}
          variant="success"
        />
        <KPI
          label="Empresas Bloqueadas"
          value={data.blockedCompanies.toString()}
          icon={Ban}
          variant="danger"
        />
        <KPI
          label="Empresas em Teste"
          value={data.trialCompanies.toString()}
          icon={Clock}
          variant="warning"
        />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPI
          label="Receita Mensal Prevista"
          value={`R$ ${data.monthlyRevenue.toLocaleString("pt-BR")}`}
          icon={DollarSign}
        />
        <KPI
          label="Receita Anual Prevista"
          value={`R$ ${data.annualRevenue.toLocaleString("pt-BR")}`}
          icon={TrendingUp}
        />
        <KPI
          label="Vencendo Esta Semana"
          value={data.dueThisWeek.toString()}
          icon={Clock}
          variant="warning"
        />
        <KPI
          label="Em Atraso"
          value={data.overdue.toString()}
          icon={AlertTriangle}
          variant="danger"
        />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPI
          label="Novos Clientes (Mês)"
          value={data.newThisMonth.toString()}
          icon={TrendingUp}
          variant="success"
        />
        <KPI
          label="Cancelamentos (Mês)"
          value={data.cancellationsThisMonth.toString()}
          icon={TrendingDown}
          variant="danger"
        />
        <KPI
          label="Inativas (sem atividade)"
          value={data.inactiveCompanies.length.toString()}
          icon={Activity}
          variant="warning"
        />
      </div>

      {data.topCompanies.length > 0 && (
        <Card>
          <CardContent className="p-5">
            <h3 className="font-display text-lg mb-3">Empresas com Maior Uso</h3>
            <div className="space-y-2">
              {data.topCompanies.slice(0, 5).map((c, i) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <span className="font-medium">{c.name}</span>
                  <span className="text-muted-foreground">
                    {c.checkins} check-ins · {c.posts} posts
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {data.inactiveCompanies.length > 0 && (
        <Card>
          <CardContent className="p-5">
            <h3 className="font-display text-lg mb-3">Empresas sem Atividade (mês)</h3>
            <div className="flex flex-wrap gap-2">
              {data.inactiveCompanies.map((name, i) => (
                <span
                  key={i}
                  className="text-xs bg-muted px-2 py-1 rounded-md text-muted-foreground"
                >
                  {name}
                </span>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
