/* eslint-disable @typescript-eslint/no-explicit-any */
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  orderRepository,
  checkinRepository,
  postRepository,
  dashboardRepository,
} from "@/repositories";
import { relativeTime, formatBRL } from "@/lib/format";
import {
  Users,
  UserCheck,
  Eye,
  ShoppingBag,
  Receipt,
  CheckCircle2,
  PackageCheck,
  Wallet,
  TrendingUp,
  Trophy,
  Sparkles,
  Store,
  Clock,
  Calendar,
  AlertTriangle,
  Info,
  ArrowUp,
  ArrowDown,
  Plus,
  Megaphone,
  Percent,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/")({
  component: DashboardPage,
  head: () => ({ meta: [{ title: "Dashboard — WEAZE" }] }),
});

type PeriodKey = "today" | "7d" | "30d" | "90d" | "year";

const PERIOD_LABELS: Record<PeriodKey, string> = {
  today: "Hoje",
  "7d": "7 dias",
  "30d": "30 dias",
  "90d": "90 dias",
  year: "Este ano",
};

function getPeriodBounds(period: PeriodKey) {
  const now = Date.now();
  const day = 86400000;
  switch (period) {
    case "today": {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      return { start: d.getTime(), end: now, duration: now - d.getTime() };
    }
    case "7d":
      return { start: now - 7 * day, end: now, duration: 7 * day };
    case "30d":
      return { start: now - 30 * day, end: now, duration: 30 * day };
    case "90d":
      return { start: now - 90 * day, end: now, duration: 90 * day };
    case "year": {
      const d = new Date();
      d.setMonth(0, 1);
      d.setHours(0, 0, 0, 0);
      return { start: d.getTime(), end: now, duration: now - d.getTime() };
    }
  }
}

function getComparisonBounds(period: PeriodKey) {
  const { start, duration } = getPeriodBounds(period);
  return { start: start - duration, end: start };
}

function inRange(ts: string | number | Date | null | undefined, start: number, end: number) {
  if (!ts) return false;
  const t = new Date(ts).getTime();
  return t >= start && t <= end;
}

function computeChange(current: number, previous: number) {
  if (previous <= 0)
    return current > 0 ? { pct: 100, dir: "up" as const } : { pct: 0, dir: "flat" as const };
  return {
    pct: ((current - previous) / previous) * 100,
    dir: current >= previous ? ("up" as const) : ("down" as const),
  };
}

function pctStr(pct: number) {
  return (pct >= 0 ? "+" : "") + pct.toFixed(1) + "%";
}

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
}

function longDate() {
  return new Date().toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

function useCompany() {
  const { data: role } = useQuery({
    queryKey: ["my-role"],
    queryFn: async () => {
      const { data } = await supabase
        .from("user_roles")
        .select("*, company:companies(*)")
        .limit(1)
        .maybeSingle();
      return data;
    },
  });
  const anyRole = role as any;
  return {
    id: (anyRole?.company_id as string) ?? undefined,
    name: (anyRole?.company?.name as string) ?? undefined,
  };
}

function DashboardPage() {
  const company = useCompany();
  const companyId = company.id;
  const [period, setPeriod] = useState<PeriodKey>("30d");

  const { data: orders } = useQuery({
    queryKey: ["orders", companyId],
    queryFn: () => orderRepository.listByCompany(companyId!),
    enabled: !!companyId,
    refetchInterval: 30_000,
  });
  const { data: present } = useQuery({
    queryKey: ["present", companyId],
    queryFn: () => checkinRepository.listPresentByCompany(companyId!),
    enabled: !!companyId,
    refetchInterval: 15_000,
  });
  const { data: posts } = useQuery({
    queryKey: ["feed-b2b", companyId],
    queryFn: () => postRepository.listByCompany(companyId!),
    enabled: !!companyId,
  });
  const { data: allCheckins } = useQuery({
    queryKey: ["all-checkins", companyId],
    queryFn: async () => {
      const { data } = await supabase
        .from("checkins")
        .select("context, source, created_at, customer_id, customer:customers(name)")
        .eq("company_id", companyId!)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
    enabled: !!companyId,
    refetchInterval: 30_000,
  });
  const { data: insights } = useQuery({
    queryKey: ["insights", companyId],
    queryFn: () => dashboardRepository.getInsights(companyId!),
    enabled: !!companyId,
  });

  const { start: pStart, end: pEnd } = getPeriodBounds(period);
  const { start: prevStart, end: prevEnd } = getComparisonBounds(period);

  const { data: productEvents } = useQuery({
    queryKey: ["product-events", companyId, prevStart],
    queryFn: async () => {
      const { data } = await supabase
        .from("product_events")
        .select("event_type, created_at, customer_id")
        .eq("company_id", companyId!)
        .gte("created_at", new Date(prevStart).toISOString())
        .order("created_at", { ascending: false });
      return data ?? [];
    },
    enabled: !!companyId,
  });

  const todayStart = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }, []);

  const presentCount = useMemo(() => {
    if (!present) return 0;
    const seen = new Set<string>();
    present.forEach((c: any) => {
      const cid = c.customer_id ?? c.customer?.id;
      if (cid) seen.add(cid);
    });
    return seen.size;
  }, [present]);

  const periodOrders = useMemo(
    () => (orders ?? []).filter((o) => inRange(o.createdAt, pStart, pEnd)),
    [orders, pStart, pEnd],
  );
  const prevPeriodOrders = useMemo(
    () => (orders ?? []).filter((o) => inRange(o.createdAt, prevStart, prevEnd)),
    [orders, prevStart, prevEnd],
  );
  const paidPeriodOrders = useMemo(
    () => periodOrders.filter((o) => o.paymentStatus === "paid"),
    [periodOrders],
  );
  const prevPaid = useMemo(
    () => prevPeriodOrders.filter((o) => o.paymentStatus === "paid"),
    [prevPeriodOrders],
  );

  const kpis = useMemo(() => {
    const active = periodOrders.filter((o) => o.status !== "cancelled");
    const prevActive = prevPeriodOrders.filter((o) => o.status !== "cancelled");
    const revenue = paidPeriodOrders.reduce((s, o) => s + o.total, 0);
    const prevRevenue = prevPaid.reduce((s, o) => s + o.total, 0);
    const ticket = paidPeriodOrders.length > 0 ? revenue / paidPeriodOrders.length : 0;
    const prevTicket = prevPaid.length > 0 ? prevRevenue / prevPaid.length : 0;
    const served = new Set(paidPeriodOrders.map((o) => o.customerId)).size;
    const prevServed = new Set(prevPaid.map((o) => o.customerId)).size;

    const champMap: Record<string, { name: string; qty: number; total: number }> = {};
    paidPeriodOrders.forEach((o) =>
      o.items.forEach((i) => {
        const key = i.productId || i.productName;
        if (!champMap[key]) champMap[key] = { name: i.productName || "Item", qty: 0, total: 0 };
        champMap[key].qty += i.quantity;
        champMap[key].total += i.quantity * i.unitPrice;
      }),
    );
    const champ = Object.values(champMap).sort((a, b) => b.qty - a.qty)[0] ?? null;

    return {
      orderCount: active.length,
      prevOrderCount: prevActive.length,
      revenue,
      prevRevenue,
      ticket,
      prevTicket,
      served,
      prevServed,
      champ,
    };
  }, [periodOrders, prevPeriodOrders, paidPeriodOrders, prevPaid]);

  const funnel = useMemo(() => {
    const checkins = (allCheckins ?? []) as any[];
    const events = (productEvents ?? []) as any[];

    const checkinCount = checkins.filter((c) => inRange(c.created_at, pStart, pEnd)).length;
    const prevCheckin = checkins.filter((c) => inRange(c.created_at, prevStart, prevEnd)).length;
    const activeCustomers = new Set(
      checkins.filter((c) => inRange(c.created_at, pStart, pEnd)).map((c) => c.customer_id),
    ).size;
    const prevActive = new Set(
      checkins.filter((c) => inRange(c.created_at, prevStart, prevEnd)).map((c) => c.customer_id),
    ).size;
    const views = events.filter(
      (e) => e.event_type === "view" && inRange(e.created_at, pStart, pEnd),
    ).length;
    const prevViews = events.filter(
      (e) => e.event_type === "view" && inRange(e.created_at, prevStart, prevEnd),
    ).length;
    const cartAdds = events.filter(
      (e) => e.event_type === "cart_add" && inRange(e.created_at, pStart, pEnd),
    ).length;
    const prevCartAdds = events.filter(
      (e) => e.event_type === "cart_add" && inRange(e.created_at, prevStart, prevEnd),
    ).length;
    const completedCount = (orders ?? []).filter(
      (o) => o.status === "completed" && inRange(o.createdAt, pStart, pEnd),
    ).length;
    const prevCompleted = (orders ?? []).filter(
      (o) => o.status === "completed" && inRange(o.createdAt, prevStart, prevEnd),
    ).length;

    const steps = [
      { key: "checkins", label: "Check-ins", value: checkinCount, prev: prevCheckin, icon: Users },
      {
        key: "active",
        label: "Clientes ativos",
        value: activeCustomers,
        prev: prevActive,
        icon: UserCheck,
      },
      { key: "views", label: "Produtos visualizados", value: views, prev: prevViews, icon: Eye },
      { key: "cart", label: "Sacolas", value: cartAdds, prev: prevCartAdds, icon: ShoppingBag },
      {
        key: "orders",
        label: "Pedidos",
        value: periodOrders.length,
        prev: prevPeriodOrders.length,
        icon: Receipt,
      },
      {
        key: "paid",
        label: "Pagamentos aprovados",
        value: paidPeriodOrders.length,
        prev: prevPaid.length,
        icon: Wallet,
      },
      {
        key: "completed",
        label: "Concluídos",
        value: completedCount,
        prev: prevCompleted,
        icon: PackageCheck,
      },
    ];
    const max = Math.max(...steps.map((s) => s.value), 1);
    return { steps, max };
  }, [
    allCheckins,
    productEvents,
    periodOrders,
    prevPeriodOrders,
    paidPeriodOrders,
    prevPaid,
    orders,
    pStart,
    pEnd,
    prevStart,
    prevEnd,
  ]);

  const todaySummary = useMemo(() => {
    const todaysOrders = (orders ?? []).filter((o) => inRange(o.createdAt, todayStart, Date.now()));
    const paidToday = todaysOrders.filter((o) => o.paymentStatus === "paid");
    const revenueToday = paidToday.reduce((s, o) => s + o.total, 0);
    const checkinsToday = (allCheckins ?? []).filter((c: any) =>
      inRange(c.created_at, todayStart, Date.now()),
    ).length;
    return {
      ordersToday: todaysOrders.filter((o) => o.status !== "cancelled").length,
      revenueToday,
      ticketToday: paidToday.length > 0 ? revenueToday / paidToday.length : 0,
      checkinsToday,
      awaiting: todaysOrders.filter(
        (o) => o.paymentStatus === "pending" || o.status === "awaiting_payment",
      ).length,
      inProduction: todaysOrders.filter((o) =>
        ["payment_approved", "preparing", "ready"].includes(o.status),
      ).length,
      paidTodayCount: paidToday.length,
    };
  }, [orders, allCheckins, todayStart]);

  const liveEvents = useMemo(() => {
    const since = Date.now() - 60 * 60 * 1000;
    const list: { text: string; ts: string; type: string }[] = [];
    (orders ?? []).forEach((o) => {
      if (o.status !== "cancelled" && inRange(o.createdAt, since, Date.now())) {
        list.push({
          text: `Pedido de ${formatBRL(o.total)}${o.tableLabel ? ` · ${o.tableLabel}` : ""}`,
          ts: o.createdAt,
          type: "order",
        });
      }
    });
    (allCheckins ?? []).forEach((c: any) => {
      if (inRange(c.created_at, since, Date.now())) {
        list.push({
          text: `${c.customer?.name ?? "Cliente"} fez check-in`,
          ts: c.created_at,
          type: "checkin",
        });
      }
    });
    list.sort((a, b) => (b.ts > a.ts ? 1 : -1));
    return list.slice(0, 6);
  }, [orders, allCheckins]);

  const allActivities = useMemo(() => {
    const list: { text: string; ts: string; type: string }[] = [];
    (allCheckins ?? []).slice(0, 12).forEach((c: any) =>
      list.push({
        text: `${c.customer?.name ?? "Cliente"} fez check-in`,
        ts: c.created_at,
        type: "checkin",
      }),
    );
    (orders ?? []).slice(0, 12).forEach((o) =>
      list.push({
        text: `Pedido de ${formatBRL(o.total)}${o.tableLabel ? ` · ${o.tableLabel}` : ""}`,
        ts: o.createdAt,
        type: "order",
      }),
    );
    (posts ?? []).slice(0, 12).forEach((p) =>
      list.push({
        text:
          p.authorType === "business"
            ? "Nova publicação do estabelecimento"
            : "Nova publicação de cliente",
        ts: p.createdAt,
        type: "post",
      }),
    );
    list.sort((a, b) => (b.ts > a.ts ? 1 : -1));
    return list;
  }, [allCheckins, orders, posts]);

  const weazeInsights = useMemo(() => {
    const list: { type: "alert" | "positive" | "info"; title: string; description: string }[] = [];
    list.push(...(insights ?? []));
    const orderComp = computeChange(kpis?.orderCount ?? 0, kpis?.prevOrderCount ?? 0);
    if (kpis && orderComp.dir === "up" && orderComp.pct > 10) {
      list.push({
        type: "positive",
        title: "Pedidos em alta",
        description: `Pedidos ${pctStr(orderComp.pct)} em relação ao período anterior.`,
      });
    } else if (kpis && orderComp.dir === "down" && orderComp.pct > 10) {
      list.push({
        type: "alert",
        title: "Pedidos em queda",
        description: `Pedidos ${pctStr(orderComp.pct)} em relação ao período anterior.`,
      });
    }
    const revenueComp = computeChange(kpis?.revenue ?? 0, kpis?.prevRevenue ?? 0);
    if (kpis && revenueComp.dir === "up" && revenueComp.pct > 10) {
      list.push({
        type: "positive",
        title: "Receita crescendo",
        description: `Receita ${pctStr(revenueComp.pct)} no período. Continue assim!`,
      });
    }
    const cartStep = funnel.steps.find((s) => s.key === "cart");
    const paidStep = funnel.steps.find((s) => s.key === "paid");
    if (cartStep && paidStep && cartStep.value > 3 && paidStep.value === 0) {
      list.push({
        type: "info",
        title: "Sacolas sem pagamento",
        description: `${cartStep.value} produto(s) foram adicionados à sacola, mas nenhum pagamento foi aprovado. Revise o checkout.`,
      });
    }
    return list.slice(0, 3);
  }, [insights, kpis, funnel]);

  if (!companyId) return <div>Carregando…</div>;

  return (
    <div className="dash-surface -m-6 space-y-6 p-6 pb-8 md:-m-6 md:p-6">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-xl kpi-accent">
            <Store className="size-5" />
          </span>
          <div>
            <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
              {company.name ?? "Estabelecimento"}
            </p>
            <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
              {greeting()}!
            </h1>
            <p className="mt-0.5 text-sm capitalize text-muted-foreground">{longDate()}</p>
          </div>
        </div>
        <PeriodSelector current={period} onChange={setPeriod} />
      </header>

      <section className="dash-card p-5">
        <div className="flex items-center gap-2">
          <span className="relative flex size-2.5">
            <span className="absolute inline-flex size-2.5 animate-ping rounded-full bg-green-500/70" />
            <span className="relative inline-flex size-2.5 rounded-full bg-green-500" />
          </span>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Acontecendo Agora
          </h2>
          <span className="ml-auto rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
            Ao vivo
          </span>
        </div>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <LiveTile
            icon={Users}
            label="Clientes presentes"
            value={String(presentCount)}
            sub="agora no estabelecimento"
          />
          <LiveTile
            icon={Clock}
            label="Aguardando pagamento"
            value={String(todaySummary.awaiting)}
            sub="pedidos em aberto hoje"
          />
          <LiveTile
            icon={PackageCheck}
            label="Em produção"
            value={String(todaySummary.inProduction)}
            sub="preparo e pronto hoje"
          />
          <LiveTile
            icon={Wallet}
            label="Pagos hoje"
            value={String(todaySummary.paidTodayCount)}
            sub={formatBRL(todaySummary.revenueToday)}
          />
        </div>
        {liveEvents.length > 0 && (
          <div className="mt-4 space-y-1 border-t pt-3">
            <p className="mb-2 text-xs font-medium uppercase tracking-widest text-muted-foreground">
              Atividade recente
            </p>
            {liveEvents.map((e, i) => (
              <div
                key={i}
                className="flex items-center justify-between gap-2 rounded-lg px-3 py-1.5 text-sm transition-colors hover:bg-muted/50"
              >
                <div className="flex items-center gap-2 truncate">
                  <ActivityDot type={e.type} />
                  <span className="truncate">{e.text}</span>
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">{relativeTime(e.ts)}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Métricas do período
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
          {kpis ? (
            <>
              <KpiCard
                icon={Wallet}
                label="Receita"
                value={kpis.revenue}
                prevValue={kpis.prevRevenue}
                format="brl"
              />
              <KpiCard
                icon={Receipt}
                label="Pedidos"
                value={kpis.orderCount}
                prevValue={kpis.prevOrderCount}
              />
              <KpiCard
                icon={TrendingUp}
                label="Ticket médio"
                value={kpis.ticket}
                prevValue={kpis.prevTicket}
                format="brl"
              />
              <KpiCard
                icon={UserCheck}
                label="Clientes atendidos"
                value={kpis.served}
                prevValue={kpis.prevServed}
              />
              <ChampionCard champ={kpis.champ} />
              <InsightCard insight={weazeInsights[0]} />
            </>
          ) : (
            <>
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </>
          )}
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-3">
        <section className="dash-card p-5 xl:col-span-2">
          <div className="mb-1 flex items-center gap-2">
            <TrendingUp className="size-4 text-primary" />
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Jornada do Cliente
            </h2>
          </div>
          <p className="mb-4 text-xs text-muted-foreground">
            Da visita à conclusão do pedido — comparado ao período anterior
          </p>
          <div className="space-y-2">
            {funnel.steps.map((step, i) => {
              const prevValue = i > 0 ? funnel.steps[i - 1].value : 0;
              const rate = prevValue > 0 ? (step.value / prevValue) * 100 : null;
              const width = (step.value / funnel.max) * 100;
              return (
                <div key={step.key} className="flex items-center gap-3">
                  <div className="flex w-44 shrink-0 items-center gap-2 text-xs font-medium text-muted-foreground sm:w-48">
                    <span className="grid size-6 shrink-0 place-items-center rounded-lg kpi-accent">
                      <step.icon className="size-3.5" />
                    </span>
                    <span className="truncate">{step.label}</span>
                  </div>
                  <div className="relative h-9 flex-1 overflow-hidden rounded-lg bg-muted/50">
                    <div
                      className="h-full rounded-lg bg-gradient-to-r from-primary to-primary/60 transition-all"
                      style={{ width: `${width}%` }}
                    />
                    <div className="absolute inset-0 flex items-center justify-between px-3 text-xs font-medium">
                      <span className="number-display">{step.value}</span>
                      {rate != null && (
                        <span className="text-muted-foreground">{rate.toFixed(0)}%</span>
                      )}
                    </div>
                  </div>
                  <div className="hidden w-24 shrink-0 justify-end md:flex">
                    <TrendPill {...computeChange(step.value, step.prev)} />
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="dash-card p-5">
          <div className="mb-4 flex items-center gap-2">
            <Calendar className="size-4 text-primary" />
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Resumo do Dia
            </h2>
          </div>
          <div className="space-y-3">
            <DayRow label="Pedidos hoje" value={String(todaySummary.ordersToday)} />
            <DayRow label="Receita hoje" value={formatBRL(todaySummary.revenueToday)} />
            <DayRow label="Ticket médio hoje" value={formatBRL(todaySummary.ticketToday)} />
            <DayRow label="Check-ins hoje" value={String(todaySummary.checkinsToday)} />
            <DayRow label="Clientes presentes" value={String(presentCount)} />
          </div>
          <Link
            to="/app/pedidos"
            className="mt-5 flex items-center justify-center gap-1 rounded-lg bg-primary/10 px-4 py-2 text-xs font-semibold text-primary transition-colors hover:bg-primary/20"
          >
            Ver pedidos
          </Link>
        </section>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <section className="dash-card p-5 xl:col-span-2">
          <div className="mb-3 flex items-center gap-2">
            <Clock className="size-4 text-primary" />
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Últimas Atividades
            </h2>
          </div>
          {allActivities.length > 0 ? (
            <ul className="space-y-1">
              {allActivities.slice(0, 15).map((a, i) => (
                <li
                  key={i}
                  className="flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-muted/50"
                >
                  <div className="flex items-center gap-2 truncate">
                    <ActivityDot type={a.type} />
                    <span className="truncate">{a.text}</span>
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {relativeTime(a.ts)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">Nenhuma atividade ainda.</p>
          )}
        </section>

        <section className="dash-card p-5">
          <div className="mb-3 flex items-center gap-2">
            <Sparkles className="size-4 text-primary" />
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Ações Rápidas
            </h2>
          </div>
          <div className="grid grid-cols-1 gap-2">
            <QuickAction to="/app/produtos" icon={Plus} label="Novo Produto" />
            <QuickAction to="/app/feed" icon={Megaphone} label="Nova Publicação" />
            <QuickAction to="/app/produtos" icon={Percent} label="Criar Promoção" />
            <QuickAction to="/app/pedidos" icon={Receipt} label="Ver Pedidos" />
            <QuickAction to="/app/financeiro" icon={Wallet} label="Abrir Financeiro" />
          </div>
        </section>
      </div>

      <section>
        <div className="mb-3 flex items-center gap-2">
          <Sparkles className="size-4 text-primary" />
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Inteligência WEAZE
          </h2>
        </div>
        {weazeInsights.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {weazeInsights.map((ins, i) => {
              const iconMap: Record<string, any> = {
                alert: AlertTriangle,
                positive: CheckCircle2,
                info: Info,
              };
              const Icon = iconMap[ins.type] ?? Info;
              const colorMap: Record<string, string> = {
                alert: "border-destructive/30 bg-destructive/10",
                positive: "border-green-500/30 bg-green-500/10",
                info: "border-blue-500/30 bg-blue-500/10",
              };
              return (
                <div key={i} className={`rounded-xl border p-4 ${colorMap[ins.type] ?? ""}`}>
                  <div className="flex items-start gap-2">
                    <Icon
                      className={`mt-0.5 size-5 shrink-0 ${
                        ins.type === "alert"
                          ? "text-destructive"
                          : ins.type === "positive"
                            ? "text-green-600"
                            : "text-blue-600"
                      }`}
                    />
                    <div>
                      <div className="text-sm font-semibold">{ins.title}</div>
                      <p className="text-xs text-muted-foreground">{ins.description}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="dash-card p-5 text-sm text-muted-foreground">
            Ainda não há insights suficientes. Continue movimentando seu estabelecimento.
          </div>
        )}
      </section>
    </div>
  );
}

function LiveTile({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: any;
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="rounded-xl border bg-muted/30 p-4">
      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <span className="grid size-6 place-items-center rounded-lg kpi-accent">
          <Icon className="size-3.5" />
        </span>
        {label}
      </div>
      <div className="mt-2 number-display text-3xl">{value}</div>
      <div className="text-xs text-muted-foreground">{sub}</div>
    </div>
  );
}

function DayRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-muted/50 pb-2 text-sm last:border-0 last:pb-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold">{value}</span>
    </div>
  );
}

function QuickAction({ to, icon: Icon, label }: { to: string; icon: any; label: string }) {
  return (
    <Link
      to={to}
      className="flex items-center gap-3 rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors hover:border-primary/30 hover:bg-muted/50"
    >
      <span className="grid size-8 place-items-center rounded-lg kpi-accent">
        <Icon className="size-4" />
      </span>
      {label}
    </Link>
  );
}

function ChampionCard({ champ }: { champ: { name: string; qty: number; total: number } | null }) {
  return (
    <div className="dash-card p-5">
      <div className="flex items-start justify-between">
        <span className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
          Produto campeão
        </span>
        <span className="grid size-9 place-items-center rounded-xl bg-amber-500/10 text-amber-600">
          <Trophy className="size-4" />
        </span>
      </div>
      {champ ? (
        <>
          <div className="mt-3 truncate text-xl font-bold leading-tight">{champ.name}</div>
          <div className="mt-1 text-xs text-muted-foreground">
            {champ.qty} vendido{champ.qty > 1 ? "s" : ""} · {formatBRL(champ.total)}
          </div>
        </>
      ) : (
        <div className="mt-3 text-sm text-muted-foreground">Sem vendas no período</div>
      )}
    </div>
  );
}

function InsightCard({
  insight,
}: {
  insight?: { type: string; title: string; description: string };
}) {
  return (
    <div className="dash-card bg-gradient-to-br from-primary/10 via-transparent to-transparent p-5">
      <div className="flex items-start justify-between">
        <span className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
          Insight WEAZE
        </span>
        <span className="grid size-9 place-items-center rounded-xl bg-primary/10 text-primary">
          <Sparkles className="size-4" />
        </span>
      </div>
      {insight ? (
        <>
          <div className="mt-3 text-sm font-bold leading-snug">{insight.title}</div>
          <p className="mt-1 text-xs text-muted-foreground">{insight.description}</p>
        </>
      ) : (
        <div className="mt-3 text-sm text-muted-foreground">
          Dados insuficientes para um insight. Aguarde mais movimentação.
        </div>
      )}
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="dash-card p-5">
      <div className="h-3 w-20 animate-pulse rounded bg-muted" />
      <div className="mt-3 h-8 w-24 animate-pulse rounded bg-muted" />
      <div className="mt-2 h-3 w-16 animate-pulse rounded bg-muted" />
    </div>
  );
}

function ActivityDot({ type }: { type: string }) {
  const colors: Record<string, string> = {
    checkin: "bg-blue-500",
    order: "bg-green-500",
    post: "bg-purple-500",
    reaction: "bg-pink-500",
  };
  return (
    <span className={`size-2 shrink-0 rounded-full ${colors[type] ?? "bg-muted-foreground"}`} />
  );
}

function PeriodSelector({
  current,
  onChange,
}: {
  current: PeriodKey;
  onChange: (k: PeriodKey) => void;
}) {
  return (
    <div className="inline-flex max-w-full gap-1 overflow-x-auto rounded-full border bg-card/70 p-1 backdrop-blur">
      {(Object.entries(PERIOD_LABELS) as [PeriodKey, string][]).map(([key, label]) => (
        <button
          key={key}
          onClick={() => onChange(key)}
          className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all ${
            key === current
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function KpiCard({
  icon: Icon,
  label,
  value,
  prevValue,
  format,
}: {
  icon: any;
  label: string;
  value: number;
  prevValue?: number;
  format?: "brl" | "min";
}) {
  const display =
    format === "brl" ? formatBRL(value) : format === "min" ? `${value}min` : String(value);
  const comp = computeChange(value, prevValue ?? 0);

  return (
    <div className="dash-card group relative overflow-hidden p-5 hover:dash-card-hover">
      <div className="pointer-events-none absolute -right-8 -top-8 size-24 rounded-full bg-primary/5 blur-2xl transition-opacity group-hover:opacity-100" />
      <div className="relative flex items-start justify-between">
        <span className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
          {label}
        </span>
        <span className="grid size-9 place-items-center rounded-xl kpi-accent">
          <Icon className="size-4" />
        </span>
      </div>
      <div className="relative mt-3 number-display text-3xl">{display}</div>
      <div className="relative mt-2">
        {prevValue != null ? (
          <ComparisonBadge {...comp} />
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </div>
    </div>
  );
}

function ComparisonBadge({ pct, dir }: { pct: number; dir: "up" | "down" | "flat" }) {
  if (dir === "flat") return <span className="text-xs text-muted-foreground">— sem alteração</span>;
  const Icon = dir === "up" ? ArrowUp : ArrowDown;
  const badge =
    dir === "up"
      ? "text-green-700 bg-green-500/10 border-green-500/20"
      : "text-destructive bg-destructive/10 border-destructive/20";
  return (
    <span className="inline-flex items-center gap-1 text-xs">
      <span
        className={`inline-flex items-center gap-0.5 rounded-full border px-1.5 py-0.5 font-semibold ${badge}`}
      >
        <Icon className="size-3" />
        {pctStr(pct)}
      </span>
      <span className="text-muted-foreground">vs anterior</span>
    </span>
  );
}

function TrendPill({ pct, dir }: { pct: number; dir: "up" | "down" | "flat" }) {
  if (dir === "flat") return <span className="text-xs text-muted-foreground">—</span>;
  const Icon = dir === "up" ? ArrowUp : ArrowDown;
  const cls =
    dir === "up"
      ? "text-green-700 bg-green-500/10 border-green-500/20"
      : "text-destructive bg-destructive/10 border-destructive/20";
  return (
    <span
      className={`inline-flex items-center gap-0.5 rounded-full border px-1.5 py-0.5 text-xs font-semibold ${cls}`}
    >
      <Icon className="size-3" />
      {pctStr(pct)}
    </span>
  );
}
