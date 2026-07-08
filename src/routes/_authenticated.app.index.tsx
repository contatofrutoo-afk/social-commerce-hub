/* eslint-disable @typescript-eslint/no-explicit-any */
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  customerRepository,
  productRepository,
  orderRepository,
  checkinRepository,
  postRepository,
  dashboardRepository,
} from "@/repositories";
import { relativeTime, formatBRL } from "@/lib/format";
import {
  Users,
  ShoppingCart,
  Heart,
  Sparkles,
  Store,
  User,
  Home,
  MessageCircle,
  TrendingUp,
  Clock,
  Calendar,
  Lightbulb,
  AlertTriangle,
  Info,
  CheckCircle2,
  RefreshCw,
  ArrowUp,
  ArrowDown,
  Minus,
  Eye,
  EyeOff,
  ThumbsUp,
  PackageCheck,
  UserPlus,
  UserCheck,
  Crown,
  AlertOctagon,
  UserX,
  BarChart3,
  Hash,
  Activity,
  ChevronDown,
} from "lucide-react";
import type { VisitContext } from "@/repositories";
import { useState, useMemo } from "react";

export const Route = createFileRoute("/_authenticated/app/")({
  component: DashboardPage,
});

// ─── Period helpers ───

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

function useCompanyId() {
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
  return role?.company_id as string | undefined;
}

// ─── Filters ───

function inRange(ts: string | number | Date | null | undefined, start: number, end: number) {
  if (!ts) return false;
  const t = new Date(ts).getTime();
  return t >= start && t <= end;
}

function countInRange<T>(
  items: T[],
  getTs: (item: T) => string | null | undefined,
  start: number,
  end: number,
) {
  return items.filter((i) => inRange(getTs(i), start, end)).length;
}

function sumInRange(
  items: any[],
  getTs: (item: any) => string | null | undefined,
  getVal: (item: any) => number,
  start: number,
  end: number,
) {
  return items.filter((i) => inRange(getTs(i), start, end)).reduce((s, i) => s + getVal(i), 0);
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

// ─── Dashboard Page ───

function DashboardPage() {
  const companyId = useCompanyId();
  const [period, setPeriod] = useState<PeriodKey>("30d");
  const [hiddenSections, setHiddenSections] = useState<Set<string>>(new Set());
  const [activityFilter, setActivityFilter] = useState<string>("all");

  const toggleSection = (id: string) => {
    setHiddenSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // ── Existing queries (kept intact) ──
  const { data: customers } = useQuery({
    queryKey: ["customers", companyId],
    queryFn: () => customerRepository.listByCompany(companyId!),
    enabled: !!companyId,
  });
  const { data: orders } = useQuery({
    queryKey: ["orders", companyId],
    queryFn: () => orderRepository.listByCompany(companyId!),
    enabled: !!companyId,
  });
  const { data: present } = useQuery({
    queryKey: ["present", companyId],
    queryFn: () => checkinRepository.listPresentByCompany(companyId!),
    enabled: !!companyId,
  });
  const { data: posts } = useQuery({
    queryKey: ["feed-b2b", companyId],
    queryFn: () => postRepository.listByCompany(companyId!),
    enabled: !!companyId,
  });
  const { data: metrics } = useQuery({
    queryKey: ["dashboard-metrics", companyId],
    queryFn: () => dashboardRepository.getMetrics(companyId!),
    enabled: !!companyId,
  });
  const { data: insights } = useQuery({
    queryKey: ["insights", companyId],
    queryFn: () => dashboardRepository.getInsights(companyId!),
    enabled: !!companyId,
  });
  const { data: businessMetrics } = useQuery({
    queryKey: ["business-metrics", companyId],
    queryFn: () => dashboardRepository.getBusinessMetrics(companyId!),
    enabled: !!companyId,
  });
  const { data: productMetrics } = useQuery({
    queryKey: ["product-metrics", companyId],
    queryFn: () => dashboardRepository.getProductMetrics(companyId!),
    enabled: !!companyId,
  });

  // ── New enrichment queries (for period filtering) ──
  const { data: allCheckins } = useQuery({
    queryKey: ["all-checkins", companyId],
    queryFn: async () => {
      const { data } = await supabase
        .from("checkins")
        .select("context, source, created_at, customer_id, customer:customers(name)")
        .eq("company_id", companyId)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
    enabled: !!companyId,
  });

  const { data: reactions } = useQuery({
    queryKey: ["reactions-timeline", companyId],
    queryFn: async () => {
      const { data } = await supabase
        .from("post_reactions")
        .select("type, created_at, customer_id, post:posts!inner(company_id)")
        .eq("post.company_id", companyId);
      return data ?? [];
    },
    enabled: !!companyId,
  });

  const { data: productLikes } = useQuery({
    queryKey: ["product-likes-timeline", companyId],
    queryFn: async () => {
      const { data } = await supabase
        .from("product_likes")
        .select("created_at, product_id, customer_id, product:products!inner(company_id)")
        .eq("product.company_id", companyId);
      return data ?? [];
    },
    enabled: !!companyId,
  });

  // ── Period computations ──
  const { start: pStart, end: pEnd } = getPeriodBounds(period);
  const { start: prevStart, end: prevEnd } = getComparisonBounds(period);

  const periodData = useMemo(() => {
    if (!customers || !orders) return null;

    const activeCustomers = customers.filter((c) => inRange(c.lastVisitAt, pStart, pEnd));
    const periodOrders = orders.filter((o) => inRange(o.createdAt, pStart, pEnd));
    const periodRevenue = periodOrders.reduce((s, o) => s + o.total, 0);
    const periodTicket = periodOrders.length > 0 ? periodRevenue / periodOrders.length : 0;

    // Previous period
    const prevActive = customers.filter((c) => inRange(c.lastVisitAt, prevStart, prevEnd));
    const prevOrders = orders.filter((o) => inRange(o.createdAt, prevStart, prevEnd));
    const prevRevenue = prevOrders.reduce((s, o) => s + o.total, 0);
    const prevTicket = prevOrders.length > 0 ? prevRevenue / prevOrders.length : 0;

    return {
      activeCustomers,
      periodOrders,
      periodRevenue,
      periodTicket,
      prevActive,
      prevOrders,
      prevRevenue,
      prevTicket,
    };
  }, [customers, orders, pStart, pEnd, prevStart, prevEnd]);

  // Funnel data
  const funnelData = useMemo(() => {
    const checkinCount = (allCheckins ?? []).filter((c: any) =>
      inRange(c.created_at, pStart, pEnd),
    ).length;
    const reactionCount = (reactions ?? []).filter((r: any) =>
      inRange(r.created_at, pStart, pEnd),
    ).length;
    const orderCount = (orders ?? []).filter((o) => inRange(o.createdAt, pStart, pEnd)).length;
    const completedCount = (orders ?? []).filter(
      (o) => o.status === "completed" && inRange(o.createdAt, pStart, pEnd),
    ).length;

    const prevCheckin = (allCheckins ?? []).filter((c: any) =>
      inRange(c.created_at, prevStart, prevEnd),
    ).length;
    const prevReaction = (reactions ?? []).filter((r: any) =>
      inRange(r.created_at, prevStart, prevEnd),
    ).length;
    const prevOrderCount = (orders ?? []).filter((o) =>
      inRange(o.createdAt, prevStart, prevEnd),
    ).length;
    const prevCompleted = (orders ?? []).filter(
      (o) => o.status === "completed" && inRange(o.createdAt, prevStart, prevEnd),
    ).length;

    return {
      steps: [
        { key: "checkin", label: "Check-ins", value: checkinCount, prev: prevCheckin, icon: User },
        {
          key: "reaction",
          label: "Curtidas",
          value: reactionCount,
          prev: prevReaction,
          icon: Heart,
        },
        {
          key: "order",
          label: "Pedidos",
          value: orderCount,
          prev: prevOrderCount,
          icon: ShoppingCart,
        },
        {
          key: "completed",
          label: "Concluídos",
          value: completedCount,
          prev: prevCompleted,
          icon: CheckCircle2,
        },
      ],
      maxStep: Math.max(checkinCount, reactionCount, orderCount, completedCount, 1),
    };
  }, [allCheckins, reactions, orders, pStart, pEnd, prevStart, prevEnd]);

  // Customer breakdown
  const customerBreakdown = useMemo(() => {
    if (!customers) return null;
    const now = Date.now();
    const day30 = 30 * 86400000;
    const day60 = 60 * 86400000;

    // Use all-time data for these classifications
    const novos = customers.filter((c) => inRange(c.firstVisitAt, pStart, pEnd)).length;
    const recorrentes = customers.filter(
      (c) => c.visitCount > 1 && inRange(c.lastVisitAt, pStart, pEnd),
    ).length;
    const orderCountMap: Record<string, number> = {};
    const orderTotalMap: Record<string, number> = {};
    (orders ?? []).forEach((o) => {
      orderCountMap[o.customerId] = (orderCountMap[o.customerId] ?? 0) + 1;
      orderTotalMap[o.customerId] = (orderTotalMap[o.customerId] ?? 0) + o.total;
    });
    const vip = customers.filter(
      (c) => (orderCountMap[c.id] ?? 0) >= 5 || (orderTotalMap[c.id] ?? 0) > 1000,
    ).length;
    const risco = customers.filter((c) => {
      const last = new Date(c.lastVisitAt).getTime();
      return now - last > day30 && now - last <= day60;
    }).length;
    const inativos = customers.filter(
      (c) => now - new Date(c.lastVisitAt).getTime() > day60,
    ).length;

    return { novos, recorrentes, vip, risco, inativos };
  }, [customers, orders, pStart, pEnd]);

  // Product analysis
  const productAnalysis = useMemo(() => {
    if (!productMetrics || !productLikes) return null;

    // Count product likes in period
    const filteredLikes = (productLikes ?? []).filter((l: any) =>
      inRange(l.created_at, pStart, pEnd),
    );
    const likeCountPerProduct: Record<string, number> = {};
    filteredLikes.forEach((l: any) => {
      likeCountPerProduct[l.product_id] = (likeCountPerProduct[l.product_id] ?? 0) + 1;
    });

    // Count orders in period per product
    const periodOrderItems = (orders ?? []).filter((o) => inRange(o.createdAt, pStart, pEnd));
    const orderCountPerProduct: Record<string, number> = {};
    periodOrderItems.forEach((o) => {
      o.items.forEach((i) => {
        orderCountPerProduct[i.productId] = (orderCountPerProduct[i.productId] ?? 0) + i.quantity;
      });
    });

    const withData = productMetrics.map((p) => {
      const periodLikes = likeCountPerProduct[p.id] ?? 0;
      const periodOrders = orderCountPerProduct[p.id] ?? 0;
      const totalLikes = p.likes;
      const totalOrders = p.orderCount;
      return { ...p, periodLikes, periodOrders, totalLikes, totalOrders };
    });

    const maisVendidos = [...withData].sort((a, b) => b.periodOrders - a.periodOrders).slice(0, 5);
    const maisCurtidos = [...withData].sort((a, b) => b.periodLikes - a.periodLikes).slice(0, 5);
    const maiorConversao = [...withData]
      .filter((p) => p.periodLikes > 0)
      .sort((a, b) => b.periodOrders / b.periodLikes - a.periodOrders / a.periodLikes)
      .slice(0, 5);
    const menorConversao = [...withData]
      .filter((p) => p.periodLikes > 0 && p.periodOrders > 0)
      .sort((a, b) => a.periodOrders / a.periodLikes - b.periodOrders / b.periodLikes)
      .slice(0, 5);
    const interesseSemVenda = [...withData]
      .filter((p) => p.periodLikes >= 3 && p.periodOrders === 0)
      .sort((a, b) => b.periodLikes - a.periodLikes)
      .slice(0, 5);

    return { maisVendidos, maisCurtidos, maiorConversao, menorConversao, interesseSemVenda };
  }, [productMetrics, productLikes, orders, pStart, pEnd]);

  // Audience profile (from all checkins in period)
  const audienceProfile = useMemo(() => {
    const periodCheckins = (allCheckins ?? []).filter((c: any) =>
      inRange(c.created_at, pStart, pEnd),
    );
    const ctxCounts: Record<string, number> = {};
    periodCheckins.forEach((c: any) => {
      ctxCounts[c.context] = (ctxCounts[c.context] ?? 0) + 1;
    });
    const hourCounts: Record<number, number> = {};
    periodCheckins.forEach((c: any) => {
      const h = new Date(c.created_at).getHours();
      hourCounts[h] = (hourCounts[h] ?? 0) + 1;
    });
    const dayCounts: Record<string, number> = {};
    const dayNames = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
    periodCheckins.forEach((c: any) => {
      const d = dayNames[new Date(c.created_at).getDay()];
      dayCounts[d] = (dayCounts[d] ?? 0) + 1;
    });

    const total = periodCheckins.length || 1;
    const contexts = Object.entries(ctxCounts).map(([k, v]) => ({
      label: k,
      value: v,
      pct: (v / total) * 100,
    }));
    const hours = Object.entries(hourCounts).map(([k, v]) => ({ hour: Number(k), count: v }));
    const days = Object.entries(dayCounts).map(([k, v]) => ({ day: k, count: v }));

    return { contexts, hours, days };
  }, [allCheckins, pStart, pEnd]);

  // Enhanced insights (period-aware)
  const enhancedInsights = useMemo(() => {
    const list: { type: "alert" | "positive" | "info"; title: string; description: string }[] = [];
    if (!insights) return list;

    // Copy existing insights
    list.push(...insights);

    // Period-specific insights
    if (periodData && periodData.periodOrders.length > 0) {
      const comp = computeChange(periodData.periodOrders.length, periodData.prevOrders.length);
      if (comp.dir === "up" && comp.pct > 10) {
        list.push({
          type: "positive",
          title: "Pedidos em alta",
          description: `Pedidos ${pctStr(comp.pct)} em relação ao período anterior.`,
        });
      } else if (comp.dir === "down" && comp.pct > 10) {
        list.push({
          type: "alert",
          title: "Pedidos em queda",
          description: `Pedidos ${pctStr(comp.pct)} em relação ao período anterior.`,
        });
      }
    }

    // Product interest mismatch
    if (productAnalysis && productAnalysis.interesseSemVenda.length > 0) {
      list.push({
        type: "info",
        title: "Produtos com interesse mas sem venda",
        description: `${productAnalysis.interesseSemVenda.length} produto${productAnalysis.interesseSemVenda.length > 1 ? "s" : ""} recebeu${productAnalysis.interesseSemVenda.length > 1 ? "ram" : ""} curtidas mas não teve vendas no período. Considere uma oferta especial.`,
      });
    }

    return list.slice(0, 6);
  }, [insights, periodData, productAnalysis]);

  // Activities
  const allActivities = useMemo(() => {
    const list: { text: string; ts: string; type: string }[] = [];
    (allCheckins ?? []).slice(0, 10).forEach((c: any) =>
      list.push({
        text: `Check-in de ${c.customer?.name ?? "cliente"}`,
        ts: c.created_at,
        type: "checkin",
      }),
    );
    (orders ?? []).slice(0, 10).forEach((o) =>
      list.push({
        text: `Pedido ${formatBRL(o.total)} - ${o.customerName ?? "Cliente"}`,
        ts: o.createdAt,
        type: "order",
      }),
    );
    (posts ?? []).slice(0, 10).forEach((p) =>
      list.push({
        text: `Publicação de ${p.authorType === "business" ? "estabelecimento" : (p.customerName ?? "cliente")}`,
        ts: p.createdAt,
        type: "post",
      }),
    );
    (reactions ?? [])
      .slice(0, 10)
      .forEach((r: any) =>
        list.push({ text: `Reação "${r.type}" em um post`, ts: r.created_at, type: "reaction" }),
      );
    list.sort((a, b) => (b.ts > a.ts ? 1 : -1));
    return list;
  }, [allCheckins, orders, posts, reactions]);

  const filteredActivities =
    activityFilter === "all"
      ? allActivities
      : allActivities.filter((a) => a.type === activityFilter);

  if (!companyId) return <div>Carregando…</div>;

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <PeriodSelector current={period} onChange={setPeriod} />
      </div>

      {/* Presentes agora (mini banner) */}
      {present && present.length > 0 && (
        <div className="flex items-center gap-2 rounded-xl border bg-primary/5 px-4 py-2 text-sm">
          <Store className="size-4 text-primary" />
          <span className="font-medium">{present.length}</span>
          <span className="text-muted-foreground">
            cliente{present.length > 1 ? "s" : ""} presente{present.length > 1 ? "s" : ""} agora
          </span>
        </div>
      )}

      {/* Linha 1 — KPIs */}
      <HideableSection
        id="kpi"
        hidden={hiddenSections.has("kpi")}
        onToggle={toggleSection}
        title="Métricas principais"
      >
        {periodData ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard
              icon={UserCheck}
              label="Clientes ativos"
              value={periodData.activeCustomers.length}
              prevValue={periodData.prevActive.length}
            />
            <KpiCard
              icon={ShoppingCart}
              label="Pedidos"
              value={periodData.periodOrders.length}
              prevValue={periodData.prevOrders.length}
            />
            <KpiCard
              icon={TrendingUp}
              label="Receita"
              value={periodData.periodRevenue}
              prevValue={periodData.prevRevenue}
              format="brl"
            />
            <KpiCard
              icon={BarChart3}
              label="Ticket médio"
              value={periodData.periodTicket}
              prevValue={periodData.prevTicket}
              format="brl"
            />
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </div>
        )}
      </HideableSection>

      {/* Linha 2 — Funil do Social Commerce */}
      <HideableSection
        id="funnel"
        hidden={hiddenSections.has("funnel")}
        onToggle={toggleSection}
        title="Funil do Social Commerce"
      >
        <div className="grid gap-4 lg:grid-cols-4">
          {funnelData.steps.map((step, i) => {
            const comp = computeChange(step.value, step.prev);
            const barWidth = step.value > 0 ? (step.value / funnelData.maxStep) * 100 : 0;
            return (
              <div key={step.key} className="rounded-xl border bg-card p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <step.icon className="size-4 text-primary" />
                    <span className="text-sm text-muted-foreground">{step.label}</span>
                  </div>
                  {i < 3 && (
                    <ChevronRightIcon className="size-4 text-muted-foreground/40 hidden lg:block" />
                  )}
                </div>
                <div className="mt-1 text-2xl font-bold">{step.value}</div>
                <ComparisonBadge {...comp} />
                {/* Progress bar */}
                <div className="mt-2 h-1.5 w-full rounded-full bg-muted">
                  <div
                    className="h-1.5 rounded-full bg-primary transition-all"
                    style={{ width: `${barWidth}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
        {/* Conversion arrows between steps */}
        <div className="mt-2 grid gap-4 lg:grid-cols-3">
          {funnelData.steps.slice(0, 3).map((step, i) => {
            const next = funnelData.steps[i + 1];
            const rate = step.value > 0 ? (next.value / step.value) * 100 : 0;
            const prevRate = step.prev > 0 ? (next.prev / step.prev) * 100 : 0;
            const rateComp = computeChange(rate, prevRate);
            return (
              <div
                key={step.key}
                className="rounded-lg bg-muted/50 px-3 py-2 text-center text-xs text-muted-foreground"
              >
                <span className="font-medium">{step.label}</span>
                <ArrowRight className="inline-block size-3 mx-1" />
                <span className="font-medium">{next.label}</span>
                <span className="ml-1">{rate.toFixed(1)}%</span>
                <ComparisonBadge {...rateComp} />
              </div>
            );
          })}
        </div>
      </HideableSection>

      {/* Linha 3 — Clientes */}
      <HideableSection
        id="customers"
        hidden={hiddenSections.has("customers")}
        onToggle={toggleSection}
        title="Clientes"
      >
        {customerBreakdown ? (
          <>
            <div className="grid gap-3 sm:grid-cols-5">
              <CustomerTile
                icon={UserPlus}
                label="Novos"
                value={customerBreakdown.novos}
                color="blue"
              />
              <CustomerTile
                icon={UserCheck}
                label="Recorrentes"
                value={customerBreakdown.recorrentes}
                color="green"
              />
              <CustomerTile icon={Crown} label="VIP" value={customerBreakdown.vip} color="amber" />
              <CustomerTile
                icon={AlertOctagon}
                label="Risco"
                value={customerBreakdown.risco}
                color="orange"
              />
              <CustomerTile
                icon={UserX}
                label="Inativos"
                value={customerBreakdown.inativos}
                color="red"
              />
            </div>
            {/* Existing "Clientes mais engajados" kept */}
            {metrics && metrics.mostEngagedCustomers.length > 0 && (
              <div className="mt-4">
                <h4 className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
                  Clientes mais engajados
                </h4>
                <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
                  {metrics.mostEngagedCustomers.slice(0, 5).map((c) => (
                    <li key={c.customerId} className="rounded-lg border px-3 py-2 text-sm">
                      <div className="truncate font-medium">{c.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {c.reactionCount > 0 && `${c.reactionCount} reações`}
                        {c.orderCount > 0 &&
                          (c.reactionCount > 0 ? " · " : "") + `${c.orderCount} pedidos`}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Carregando dados de clientes…</p>
        )}
      </HideableSection>

      {/* Linha 4 — Produtos */}
      <HideableSection
        id="products"
        hidden={hiddenSections.has("products")}
        onToggle={toggleSection}
        title="Produtos"
      >
        {productAnalysis ? (
          <div className="grid gap-4 lg:grid-cols-5">
            <MiniCard title="Mais vendidos" empty={productAnalysis.maisVendidos.length === 0}>
              {productAnalysis.maisVendidos.slice(0, 4).map((p) => (
                <div key={p.id} className="flex justify-between text-xs">
                  <span className="truncate">{p.name}</span>
                  <span className="font-semibold shrink-0 ml-2">{p.periodOrders}</span>
                </div>
              ))}
            </MiniCard>
            <MiniCard title="Mais curtidos" empty={productAnalysis.maisCurtidos.length === 0}>
              {productAnalysis.maisCurtidos.slice(0, 4).map((p) => (
                <div key={p.id} className="flex justify-between text-xs">
                  <span className="truncate">{p.name}</span>
                  <span className="font-semibold shrink-0 ml-2">{p.periodLikes}</span>
                </div>
              ))}
            </MiniCard>
            <MiniCard title="Maior conversão" empty={productAnalysis.maiorConversao.length === 0}>
              {productAnalysis.maiorConversao.slice(0, 4).map((p) => {
                const rate =
                  p.periodLikes > 0 ? ((p.periodOrders / p.periodLikes) * 100).toFixed(0) : "0";
                return (
                  <div key={p.id} className="flex justify-between text-xs">
                    <span className="truncate">{p.name}</span>
                    <span className="font-semibold shrink-0 ml-2">{rate}%</span>
                  </div>
                );
              })}
            </MiniCard>
            <MiniCard title="Menor conversão" empty={productAnalysis.menorConversao.length === 0}>
              {productAnalysis.menorConversao.slice(0, 4).map((p) => {
                const rate =
                  p.periodLikes > 0 ? ((p.periodOrders / p.periodLikes) * 100).toFixed(0) : "0";
                return (
                  <div key={p.id} className="flex justify-between text-xs">
                    <span className="truncate">{p.name}</span>
                    <span className="font-semibold shrink-0 ml-2">{rate}%</span>
                  </div>
                );
              })}
            </MiniCard>
            <MiniCard
              title="Interesse sem venda"
              empty={productAnalysis.interesseSemVenda.length === 0}
            >
              {productAnalysis.interesseSemVenda.slice(0, 4).map((p) => (
                <div key={p.id} className="flex justify-between text-xs">
                  <span className="truncate">{p.name}</span>
                  <span className="font-semibold shrink-0 ml-2">{p.periodLikes} ❤</span>
                </div>
              ))}
            </MiniCard>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Carregando dados de produtos…</p>
        )}
      </HideableSection>

      {/* Linha 5 — Perfil do público */}
      <HideableSection
        id="audience"
        hidden={hiddenSections.has("audience")}
        onToggle={toggleSection}
        title="Perfil do público"
      >
        {audienceProfile.contexts.length > 0 ? (
          <div className="grid gap-4 lg:grid-cols-3">
            {/* Contextos */}
            <Card title="Contexto">
              <div className="space-y-2">
                {audienceProfile.contexts.map((c) => (
                  <div key={c.label}>
                    <div className="flex justify-between text-xs">
                      <span className="capitalize">{c.label}</span>
                      <span>
                        {c.value} ({c.pct.toFixed(0)}%)
                      </span>
                    </div>
                    <div className="mt-0.5 h-1.5 w-full rounded-full bg-muted">
                      <div
                        className="h-1.5 rounded-full bg-primary"
                        style={{ width: `${c.pct}%` }}
                      />
                    </div>
                  </div>
                ))}
                {audienceProfile.contexts.length === 0 && (
                  <p className="text-xs text-muted-foreground">Nenhum check-in no período.</p>
                )}
              </div>
            </Card>
            {/* Horários */}
            <Card title="Horários de pico">
              <div className="space-y-1">
                {[8, 10, 12, 14, 16, 18, 20, 22].map((h) => {
                  const found = audienceProfile.hours.find((x) => x.hour === h);
                  const count = found?.count ?? 0;
                  const maxH = Math.max(...audienceProfile.hours.map((x) => x.count), 1);
                  const pct = (count / maxH) * 100;
                  return (
                    <div key={h} className="flex items-center gap-2 text-xs">
                      <span className="w-6 shrink-0 text-right text-muted-foreground">
                        {String(h).padStart(2, "0")}h
                      </span>
                      <div className="h-2 w-full rounded-full bg-muted">
                        <div className="h-2 rounded-full bg-primary" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="w-6 shrink-0 text-right">{count}</span>
                    </div>
                  );
                })}
              </div>
            </Card>
            {/* Dias */}
            <Card title="Dias da semana">
              <div className="space-y-1">
                {["segunda", "terça", "quarta", "quinta", "sexta", "sábado", "domingo"].map((d) => {
                  const found = audienceProfile.days.find((x) => x.day === d);
                  const count = found?.count ?? 0;
                  const maxD = Math.max(...audienceProfile.days.map((x) => x.count), 1);
                  const pct = (count / maxD) * 100;
                  return (
                    <div key={d} className="flex items-center gap-2 text-xs">
                      <span className="w-12 shrink-0 capitalize text-muted-foreground">
                        {d.slice(0, 3)}
                      </span>
                      <div className="h-2 w-full rounded-full bg-muted">
                        <div className="h-2 rounded-full bg-primary" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="w-6 shrink-0 text-right">{count}</span>
                    </div>
                  );
                })}
              </div>
            </Card>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Nenhum dado de público no período.</p>
        )}
      </HideableSection>

      {/* Linha 6 — Insights Inteligentes */}
      <HideableSection
        id="insights"
        hidden={hiddenSections.has("insights")}
        onToggle={toggleSection}
        title="Insights Inteligentes"
      >
        {enhancedInsights.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {enhancedInsights.map((ins, i) => {
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
                      className={`size-5 mt-0.5 shrink-0 ${
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
          <p className="text-sm text-muted-foreground">Nenhum insight disponível ainda.</p>
        )}
      </HideableSection>

      {/* Linha 7 — Últimas atividades */}
      <HideableSection
        id="activities"
        hidden={hiddenSections.has("activities")}
        onToggle={toggleSection}
        title="Últimas atividades"
      >
        <div className="mb-3 flex flex-wrap gap-2">
          {[
            { key: "all", label: "Todas" },
            { key: "checkin", label: "Check-ins" },
            { key: "order", label: "Pedidos" },
            { key: "post", label: "Publicações" },
            { key: "reaction", label: "Reações" },
          ].map((f) => (
            <button
              key={f.key}
              onClick={() => setActivityFilter(f.key)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                activityFilter === f.key
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        {filteredActivities.length > 0 ? (
          <ul className="space-y-1">
            {filteredActivities.slice(0, 12).map((a, i) => (
              <li
                key={i}
                className="flex justify-between gap-2 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-muted/50"
              >
                <div className="flex items-center gap-2 truncate">
                  <ActivityDot type={a.type} />
                  <span className="truncate">{a.text}</span>
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">{relativeTime(a.ts)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">Nenhuma atividade no período.</p>
        )}
      </HideableSection>
    </div>
  );
}

// ─── Shared sub-components ───

function ChevronRightIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M9 18l6-6-6-6" />
    </svg>
  );
}

function ArrowRight({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M5 12h14M12 5l7 7-7 7" />
    </svg>
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

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <h3 className="mb-3 text-sm font-semibold">{title}</h3>
      {children}
    </div>
  );
}

function MiniCard({
  title,
  empty,
  children,
}: {
  title: string;
  empty: boolean;
  children: React.ReactNode;
}) {
  return (
    <Card title={title}>
      {empty ? (
        <p className="text-xs text-muted-foreground">Sem dados no período.</p>
      ) : (
        <div className="space-y-1.5">{children}</div>
      )}
    </Card>
  );
}

function SkeletonCard() {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="h-3 w-20 animate-pulse rounded bg-muted" />
      <div className="mt-2 h-7 w-16 animate-pulse rounded bg-muted" />
      <div className="mt-1 h-3 w-12 animate-pulse rounded bg-muted" />
    </div>
  );
}

// ─── Period Selector ───

function PeriodSelector({
  current,
  onChange,
}: {
  current: PeriodKey;
  onChange: (k: PeriodKey) => void;
}) {
  return (
    <div className="flex gap-1 rounded-xl border bg-muted/30 p-1">
      {(Object.entries(PERIOD_LABELS) as [PeriodKey, string][]).map(([key, label]) => (
        <button
          key={key}
          onClick={() => onChange(key)}
          className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
            key === current
              ? "bg-card shadow-sm text-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

// ─── KPI Card with comparison ───

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
  format?: "brl";
}) {
  const display = format === "brl" ? formatBRL(value) : String(value);
  const prevNumber = prevValue ?? 0;
  const comp = computeChange(value, prevNumber);

  return (
    <div className="rounded-xl border bg-card p-4 transition-shadow hover:shadow-sm">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{label}</span>
        <Icon className="size-4 text-primary" />
      </div>
      <div className="mt-2 text-2xl font-bold">{display}</div>
      <div className="mt-1">
        <ComparisonBadge {...comp} />
      </div>
    </div>
  );
}

// ─── Comparison badge ───

function ComparisonBadge({ pct, dir }: { pct: number; dir: "up" | "down" | "flat" }) {
  if (dir === "flat") return <span className="text-xs text-muted-foreground">— sem alteração</span>;
  const Icon = dir === "up" ? ArrowUp : ArrowDown;
  const color = dir === "up" ? "text-green-600" : "text-destructive";
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${color}`}>
      <Icon className="size-3" />
      {pctStr(pct)}
      <span className="text-muted-foreground font-normal">vs período anterior</span>
    </span>
  );
}

// ─── Customer tile ───

function CustomerTile({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: any;
  label: string;
  value: number;
  color: "blue" | "green" | "amber" | "orange" | "red";
}) {
  const colors: Record<string, string> = {
    blue: "text-blue-600 bg-blue-500/10 border-blue-500/20",
    green: "text-green-600 bg-green-500/10 border-green-500/20",
    amber: "text-amber-600 bg-amber-500/10 border-amber-500/20",
    orange: "text-orange-600 bg-orange-500/10 border-orange-500/20",
    red: "text-red-600 bg-red-500/10 border-red-500/20",
  };
  return (
    <div className={`rounded-xl border p-4 text-center ${colors[color]}`}>
      <Icon className="mx-auto size-5" />
      <div className="mt-1 text-xl font-bold">{value}</div>
      <div className="text-[10px] uppercase tracking-wider">{label}</div>
    </div>
  );
}

// ─── Hideable section (card with ⋮ menu) ───

function HideableSection({
  id,
  hidden,
  onToggle,
  title,
  children,
}: {
  id: string;
  hidden: boolean;
  onToggle: (id: string) => void;
  title: string;
  children: React.ReactNode;
}) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="relative">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold tracking-wide uppercase text-muted-foreground">
          {title}
        </h2>
        <div className="relative">
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="rounded-lg p-1 text-muted-foreground hover:bg-muted/50 transition-colors"
          >
            <svg className="size-4" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="12" cy="5" r="1.5" />
              <circle cx="12" cy="12" r="1.5" />
              <circle cx="12" cy="19" r="1.5" />
            </svg>
          </button>
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 z-20 w-36 rounded-lg border bg-popover p-1 shadow-md">
                <button
                  onClick={() => {
                    onToggle(id);
                    setMenuOpen(false);
                  }}
                  className="flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-xs hover:bg-muted/50 transition-colors"
                >
                  {hidden ? <EyeOff className="size-3" /> : <Eye className="size-3" />}
                  {hidden ? "Mostrar" : "Ocultar"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
      {!hidden && children}
    </div>
  );
}
