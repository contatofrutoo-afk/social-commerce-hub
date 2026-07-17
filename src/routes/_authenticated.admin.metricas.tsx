import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  DollarSign,
  Building2,
  TrendingUp,
  CreditCard,
  Activity,
  Users,
  Zap,
  HeartPulse,
  Lightbulb,
  ArrowUpRight,
  ArrowDownRight,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  BarChart3,
  ShoppingCart,
  QrCode,
  MessageSquare,
  Eye,
  Package,
  Send,
  UserCheck,
  Shield,
  Flame,
  TrendingDown,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/metricas")({
  component: WeazeMetricas,
  head: () => ({ meta: [{ title: "Métricas — WEAZE Admin" }] }),
});

const PERIODS = [
  { key: "hoje", label: "Hoje" },
  { key: "7d", label: "7 dias" },
  { key: "30d", label: "30 dias" },
  { key: "90d", label: "90 dias" },
  { key: "ano", label: "Ano" },
] as const;

type PeriodKey = (typeof PERIODS)[number]["key"];

function getPeriodRange(key: PeriodKey) {
  const now = new Date();
  const end = now.toISOString();
  let start: Date;
  switch (key) {
    case "hoje":
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      break;
    case "7d":
      start = new Date(now.getTime() - 7 * 86400_000);
      break;
    case "30d":
      start = new Date(now.getTime() - 30 * 86400_000);
      break;
    case "90d":
      start = new Date(now.getTime() - 90 * 86400_000);
      break;
    case "ano":
      start = new Date(now.getTime() - 365 * 86400_000);
      break;
  }
  return { start: start.toISOString(), end, now: now.toISOString() };
}

function fmtCurrency(n: number) {
  return `R$ ${n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtInt(n: number) {
  return n.toLocaleString("pt-BR");
}

function fmtPercent(n: number) {
  return `${n.toFixed(1)}%`;
}

function getMonthStart() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString();
}

function getMonthEnd() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59).toISOString();
}

function getWeekStart() {
  const d = new Date();
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.getFullYear(), d.getMonth(), diff).toISOString();
}

function getWeekEnd() {
  const d = new Date();
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.getFullYear(), d.getMonth(), diff + 6, 23, 59, 59).toISOString();
}

// ── Shared UI Components ──────────────────────────────────────────────

type MetricCardProps = {
  label: string;
  value: string;
  secondary?: string;
  icon?: React.ElementType;
  variant?: "default" | "positive" | "negative" | "warning" | "info";
  progress?: number;
};

function MetricCard({ label, value, secondary, icon: Icon, variant, progress }: MetricCardProps) {
  return (
    <Card className="relative overflow-hidden">
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <p className="text-xs uppercase tracking-widest text-muted-foreground truncate">
              {label}
            </p>
            <p
              className={cn(
                "font-display text-2xl mt-1",
                variant === "positive" && "text-emerald-600",
                variant === "negative" && "text-destructive",
                variant === "warning" && "text-orange-500",
                variant === "info" && "text-blue-600",
              )}
            >
              {value}
            </p>
            {secondary && <p className="text-xs text-muted-foreground mt-1">{secondary}</p>}
          </div>
          {Icon && (
            <div
              className={cn(
                "h-8 w-8 rounded-lg grid place-items-center shrink-0",
                variant === "positive" && "bg-emerald-50 text-emerald-600",
                variant === "negative" && "bg-red-50 text-destructive",
                variant === "warning" && "bg-orange-50 text-orange-500",
                variant === "info" && "bg-blue-50 text-blue-600",
                !variant && "bg-muted text-muted-foreground",
              )}
            >
              <Icon className="h-4 w-4" />
            </div>
          )}
        </div>
        {progress !== undefined && (
          <div className="mt-3">
            <Progress value={progress} className="h-1.5" />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function SectionHeader({
  icon: Icon,
  title,
  description,
  badge,
}: {
  icon: React.ElementType;
  title: string;
  description?: string;
  badge?: { label: string; variant?: "default" | "secondary" | "destructive" | "outline" };
}) {
  return (
    <div className="flex items-center gap-3 mb-1">
      <div className="h-9 w-9 rounded-lg bg-brand/10 grid place-items-center">
        <Icon className="h-5 w-5 text-brand" />
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <h3 className="font-display text-lg">{title}</h3>
          {badge && <Badge variant={badge.variant ?? "secondary"}>{badge.label}</Badge>}
        </div>
        {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
      </div>
    </div>
  );
}

function InsightCard({
  children,
  variant = "default",
}: {
  children: React.ReactNode;
  variant?: "default" | "warning" | "danger" | "success";
}) {
  return (
    <div
      className={cn(
        "rounded-lg border px-4 py-3 text-sm flex items-start gap-3",
        variant === "success" && "border-emerald-200 bg-emerald-50 text-emerald-800",
        variant === "warning" && "border-orange-200 bg-orange-50 text-orange-800",
        variant === "danger" && "border-red-200 bg-red-50 text-red-800",
        variant === "default" && "border-blue-200 bg-blue-50 text-blue-800",
      )}
    >
      <Lightbulb className="h-4 w-4 mt-0.5 shrink-0" />
      <span>{children}</span>
    </div>
  );
}

function SkeletonCard() {
  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-7 w-16" />
        <Skeleton className="h-3 w-24" />
      </CardContent>
    </Card>
  );
}

function SkeletonSection() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-48" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    </div>
  );
}

// ── Data Types & Fetching ─────────────────────────────────────────────

type RawData = {
  companies: any[];
  payments: any[];
  orders: any[];
  checkins: any[];
  posts: any[];
  reactions: any[];
  comments: any[];
  products: any[];
  customers: any[];
  licenses: any[];
  tables: any[];
  orderItems: any[];
};

async function fetchAllData(): Promise<RawData> {
  const [
    { data: companies },
    { data: payments },
    { data: orders },
    { data: checkins },
    { data: posts },
    { data: reactions },
    { data: comments },
    { data: products },
    { data: customers },
    { data: licenses },
    { data: tables },
    { data: orderItems },
  ] = await Promise.all([
    supabase.from("companies").select("*"),
    supabase.from("company_payments").select("*"),
    supabase.from("orders").select("*"),
    supabase.from("checkins").select("*"),
    supabase.from("posts").select("*"),
    supabase.from("post_reactions").select("*"),
    supabase.from("comments").select("*"),
    supabase.from("products").select("*"),
    supabase.from("customers").select("*"),
    supabase.from("company_licenses").select("*"),
    supabase.from("tables").select("*"),
    supabase.from("order_items").select("*"),
  ]);

  return {
    companies: companies ?? [],
    payments: payments ?? [],
    orders: orders ?? [],
    checkins: checkins ?? [],
    posts: posts ?? [],
    reactions: reactions ?? [],
    comments: comments ?? [],
    products: products ?? [],
    customers: customers ?? [],
    licenses: licenses ?? [],
    tables: tables ?? [],
    orderItems: orderItems ?? [],
  };
}

// ── Metrics Computation ───────────────────────────────────────────────

function computeMetrics(raw: RawData, range: { start: string; end: string; now: string }) {
  const {
    companies,
    payments,
    orders,
    checkins,
    posts,
    reactions,
    comments,
    products,
    customers,
    licenses,
    tables,
    orderItems,
  } = raw;

  const now = new Date(range.now);
  const todayStr = now.toISOString().slice(0, 10);
  const monthStart = getMonthStart();
  const monthEnd = getMonthEnd();
  const weekStart = getWeekStart();
  const weekEnd = getWeekEnd();

  // Company classification
  const activeStatuses = new Set(["ativo", "teste"]);
  const activeCompanies = companies.filter((c: any) => activeStatuses.has(c.status));
  const ativoCompanies = companies.filter((c: any) => c.status === "ativo");
  const testeCompanies = companies.filter((c: any) => c.status === "teste");
  const blockedCompanies = companies.filter((c: any) => c.status === "bloqueado");
  const canceledCompanies = companies.filter((c: any) => c.status === "cancelado");
  const paidCompanies = companies.filter((c: any) => c.payment_status === "paid");
  const overdueCompanies = companies.filter(
    (c: any) => c.payment_status === "overdue" || c.payment_status === "late",
  );

  // New companies
  const newCompaniesPeriod = companies.filter((c: any) => c.created_at >= range.start);
  const newCompaniesMonth = companies.filter((c: any) => c.created_at >= monthStart);

  // ── 1. Financeiro ──
  const paymentsPaid = payments.filter((p: any) => p.status === "paid");
  const paymentsPeriod = paymentsPaid.filter((p: any) => p.payment_date >= range.start);
  const totalPaidReceived = paymentsPeriod.reduce((s: number, p: any) => s + (p.amount ?? 0), 0);

  const activeMonthlyFee = activeCompanies.reduce(
    (s: number, c: any) => s + (Number(c.monthly_fee) || 0),
    0,
  );
  const canceledMonthlyFee = canceledCompanies.reduce(
    (s: number, c: any) => s + (Number(c.monthly_fee) || 0),
    0,
  );
  const overdueAmount = overdueCompanies.reduce(
    (s: number, c: any) => s + (Number(c.monthly_fee) || 0),
    0,
  );
  const mrr = activeMonthlyFee;
  const arr = mrr * 12;

  const predictedMonthRevenue = companies
    .filter((c: any) => {
      if (!c.next_due_date) return false;
      const d = c.next_due_date.slice(0, 10);
      return d >= monthStart.slice(0, 10) && d <= monthEnd.slice(0, 10);
    })
    .reduce((s: number, c: any) => s + (Number(c.monthly_fee) || 0), 0);

  // ── 2. Empresas ──
  const totalCompanies = companies.length;
  const inactiveCount = companies.length - activeCompanies.length;

  // ── 3. Crescimento ──
  const churnRate = totalCompanies > 0 ? (canceledCompanies.length / totalCompanies) * 100 : 0;
  const avgAgeDays =
    activeCompanies.length > 0
      ? activeCompanies
          .map((c: any) => (now.getTime() - new Date(c.created_at).getTime()) / 86400_000)
          .filter((a: number) => a > 0)
          .reduce((s: number, a: number, _, arr: number[]) => s + a / arr.length, 0)
      : 0;

  const retention30d = activeCompanies.filter(
    (c: any) => (now.getTime() - new Date(c.created_at).getTime()) / 86400_000 >= 30,
  ).length;
  const retention90d = activeCompanies.filter(
    (c: any) => (now.getTime() - new Date(c.created_at).getTime()) / 86400_000 >= 90,
  ).length;
  const retention365d = activeCompanies.filter(
    (c: any) => (now.getTime() - new Date(c.created_at).getTime()) / 86400_000 >= 365,
  ).length;

  // ── 4. Cobranças ──
  const nearDueCompanies = companies.filter((c: any) => {
    if (!c.next_due_date) return false;
    const d = c.next_due_date.slice(0, 10);
    return d >= todayStr && d <= weekEnd.slice(0, 10) && c.payment_status !== "paid";
  });
  const overdueDueCompanies = companies.filter((c: any) => {
    if (!c.next_due_date) return false;
    return c.next_due_date.slice(0, 10) < todayStr && c.payment_status !== "paid";
  });
  const blockedUnpaid = blockedCompanies.filter(
    (c: any) => c.payment_status === "overdue" || c.payment_status === "late",
  );
  const predictedWeekRevenue = companies
    .filter((c: any) => {
      if (!c.next_due_date) return false;
      const d = c.next_due_date.slice(0, 10);
      return d >= weekStart.slice(0, 10) && d <= weekEnd.slice(0, 10);
    })
    .reduce((s: number, c: any) => s + (Number(c.monthly_fee) || 0), 0);

  // ── 5. Utilização ──
  const ordersPeriod = orders.filter((o: any) => o.created_at >= range.start);
  const completedOrders = ordersPeriod.filter((o: any) => o.status === "completed");
  const ordersCompanyIds = new Set(ordersPeriod.map((o: any) => o.company_id));
  const checkinsPeriod = checkins.filter((c: any) => c.created_at >= range.start);
  const qrCheckins = checkinsPeriod.filter((c: any) => c.source === "qrcode" || c.source === "qr");
  const postsPeriod = posts.filter((p: any) => p.created_at >= range.start);
  const postsCompanyIds = new Set(postsPeriod.map((p: any) => p.company_id));
  const reactionsPeriod = reactions.filter((r: any) => r.created_at >= range.start);
  const commentsPeriod = comments.filter((c: any) => c.created_at >= range.start);
  const totalInteractionsPeriod = reactionsPeriod.length + commentsPeriod.length;
  const productsPeriod = products.filter((p: any) => p.created_at >= range.start);
  const productsCompanyIds = new Set(productsPeriod.map((p: any) => p.company_id));
  const customersActive = customers.filter((c: any) => {
    if (!c.last_visit_at) return c.created_at >= range.start;
    return c.last_visit_at >= range.start;
  });
  const totalProductsSold = orderItems.reduce((s: number, oi: any) => s + (oi.quantity ?? 0), 0);

  // Activity windows
  const activityThreshold7d = new Date(now.getTime() - 7 * 86400_000).toISOString();
  const activityThreshold15d = new Date(now.getTime() - 15 * 86400_000).toISOString();
  const activityThreshold30d = new Date(now.getTime() - 30 * 86400_000).toISOString();

  const companiesActive7d = new Set<string>();
  const companiesActive15d = new Set<string>();
  const companiesActive30d = new Set<string>();

  [...checkins, ...orders, ...posts].forEach((item: any) => {
    const ts = item.created_at || item.start_time;
    if (!ts) return;
    const cid = item.company_id;
    if (ts >= activityThreshold7d) companiesActive7d.add(cid);
    if (ts >= activityThreshold15d) companiesActive15d.add(cid);
    if (ts >= activityThreshold30d) companiesActive30d.add(cid);
  });

  const companiesActiveToday = checkinsPeriod.filter((c: any) => c.created_at >= todayStr).length;

  // ── 6. Engajamento ──
  const companiesWithOrdersToday = new Set(ordersPeriod.map((o: any) => o.company_id));
  const companiesWithPostsToday = new Set(postsPeriod.map((p: any) => p.company_id));
  const companiesWithProductsToday = new Set(productsPeriod.map((p: any) => p.company_id));

  // ── 8. Saúde ──
  const orderCountByCompany = new Map<string, number>();
  ordersPeriod.forEach((o: any) => {
    orderCountByCompany.set(o.company_id, (orderCountByCompany.get(o.company_id) ?? 0) + 1);
  });
  const checkinCountByCompany = new Map<string, number>();
  checkinsPeriod.forEach((c: any) => {
    checkinCountByCompany.set(c.company_id, (checkinCountByCompany.get(c.company_id) ?? 0) + 1);
  });
  const postCountByCompany = new Map<string, number>();
  postsPeriod.forEach((p: any) => {
    postCountByCompany.set(p.company_id, (postCountByCompany.get(p.company_id) ?? 0) + 1);
  });

  let highEngagement = 0;
  let lowEngagement = 0;
  let atRisk = 0;

  activeCompanies.forEach((c: any) => {
    const score =
      (orderCountByCompany.get(c.id) ?? 0) +
      (checkinCountByCompany.get(c.id) ?? 0) * 2 +
      (postCountByCompany.get(c.id) ?? 0) * 3;
    if (score >= 10) highEngagement++;
    else if (score >= 1) lowEngagement++;
    else atRisk++;
  });

  const recentLoginCompanyIds = new Set<string>();
  const nowMinus30d = new Date(now.getTime() - 30 * 86400_000).toISOString();
  [...checkins, ...orders, ...posts].forEach((item: any) => {
    const ts = item.created_at || item.start_time;
    if (ts && ts >= nowMinus30d) recentLoginCompanyIds.add(item.company_id);
  });
  const noRecentLogin = activeCompanies.filter((c: any) => !recentLoginCompanyIds.has(c.id));

  // ── 9. Insights ──
  const insights: { text: string; variant: "default" | "warning" | "danger" | "success" }[] = [];

  if (nearDueCompanies.length > 0) {
    insights.push({
      text: `Existem ${nearDueCompanies.length} empresa${nearDueCompanies.length > 1 ? "s" : ""} próxima${nearDueCompanies.length > 1 ? "s" : ""} do vencimento.`,
      variant: "warning",
    });
  }

  if (overdueDueCompanies.length > 0) {
    insights.push({
      text: `${overdueDueCompanies.length} empresa${overdueDueCompanies.length > 1 ? "s" : ""} com pagamento em atraso.`,
      variant: "danger",
    });
  }

  if (newCompaniesMonth.length > 0) {
    insights.push({
      text: `${newCompaniesMonth.length} nova${newCompaniesMonth.length > 1 ? "s" : ""} empresa${newCompaniesMonth.length > 1 ? "s" : ""} cadastrada${newCompaniesMonth.length > 1 ? "s" : ""} neste mês.`,
      variant: "success",
    });
  }

  if (churnRate > 10) {
    insights.push({
      text: `O churn está elevado (${fmtPercent(churnRate)}). Atenção às empresas canceladas.`,
      variant: "danger",
    });
  } else if (churnRate > 5) {
    insights.push({
      text: `O churn está em ${fmtPercent(churnRate)}. Monitorar cancelamentos.`,
      variant: "warning",
    });
  } else if (churnRate > 0) {
    insights.push({
      text: `O churn está em ${fmtPercent(churnRate)}%, dentro do esperado.`,
      variant: "default",
    });
  }

  const inactive30d = activeCompanies.filter((c: any) => !companiesActive30d.has(c.id));
  if (inactive30d.length > 0) {
    insights.push({
      text: `${inactive30d.length} empresa${inactive30d.length > 1 ? "s" : ""} ${inactive30d.length > 1 ? "estão" : "está"} sem atividade há mais de 30 dias.`,
      variant: "warning",
    });
  }

  if (productsCompanyIds.size > 0 && ordersCompanyIds.size > 0) {
    insights.push({
      text: "Empresas que cadastram produtos tendem a receber mais pedidos.",
      variant: "default",
    });
  }

  const highFreqPosters = activeCompanies.filter(
    (c: any) => (postCountByCompany.get(c.id) ?? 0) >= 3,
  );
  const highFreqOrderers = activeCompanies.filter(
    (c: any) => (orderCountByCompany.get(c.id) ?? 0) >= 5,
  );
  if (highFreqPosters.length > 0 && highFreqOrderers.length > 0) {
    insights.push({
      text: "Empresas com maior frequência de publicações apresentam maior engajamento.",
      variant: "success",
    });
  }

  if (blockedUnpaid.length > 0) {
    insights.push({
      text: `${blockedUnpaid.length} empresa${blockedUnpaid.length > 1 ? "s" : ""} bloqueada${blockedUnpaid.length > 1 ? "s" : ""} por inadimplência.`,
      variant: "danger",
    });
  }

  // ── Return all metrics ──
  return {
    financeiro: {
      mrr,
      arr,
      predictedMonthRevenue,
      totalPaidReceived,
      overdueAmount,
      canceledMonthlyFee,
      paidCompaniesCount: paidCompanies.length,
      overdueCompaniesCount: overdueCompanies.length,
      totalCompanies,
    },
    empresas: {
      total: totalCompanies,
      ativo: ativoCompanies.length,
      teste: testeCompanies.length,
      bloqueado: blockedCompanies.length,
      cancelado: canceledCompanies.length,
      novasMes: newCompaniesMonth.length,
      novasPeriodo: newCompaniesPeriod.length,
      semAtividade: inactiveCount,
    },
    crescimento: {
      novos: newCompaniesPeriod.length,
      cancelamentos: canceledCompanies.length,
      saldoLiquido: newCompaniesPeriod.length - canceledCompanies.length,
      churnRate,
      retencionRate: 100 - churnRate,
      tempoMedioDias: avgAgeDays,
      retention30d,
      retention90d,
      retention365d,
      totalCompanies,
    },
    cobrancas: {
      proximasVencimento: nearDueCompanies.length,
      vencidas: overdueDueCompanies.length,
      pagas: paidCompanies.length,
      bloqueadasInadimplencia: blockedUnpaid.length,
      previstoSemana: predictedWeekRevenue,
      previstoMes: predictedMonthRevenue,
    },
    utilizacao: {
      empresasHoje: companiesActiveToday,
      empresas7d: companiesActive7d.size,
      empresas30d: companiesActive30d.size,
      pedidos: ordersPeriod.length,
      checkins: checkinsPeriod.length,
      publicacoes: postsPeriod.length,
      interacoes: totalInteractionsPeriod,
      qrCodes: qrCheckins.length,
      produtosVisualizados: 0,
      pedidosEnviados: completedOrders.length,
      clientesAtivos: customersActive.length,
    },
    engajamento: {
      publicaramHoje: companiesWithPostsToday.size,
      receberamPedidos: companiesWithOrdersToday.size,
      cadastraramProdutos: companiesWithProductsToday.size,
      usaramCatalogo: 0,
      responderamPedidos: 0,
      usaramAtendimento: 0,
      usaramCRM: 0,
      semUso7d: activeCompanies.length - companiesActive7d.size,
      semUso15d: activeCompanies.length - companiesActive15d.size,
      semUso30d: activeCompanies.length - companiesActive30d.size,
    },
    impacto: {
      totalPedidos: orders.length,
      receitaMovimentada: orders.reduce((s: number, o: any) => s + (Number(o.total) || 0), 0),
      clientesB2C: customers.length,
      totalCheckins: checkins.length,
      totalQrScans: checkins.filter((c: any) => c.source === "qrcode" || c.source === "qr").length,
      totalProdutos: products.length,
      produtosVendidos: totalProductsSold,
      totalPublicacoes: posts.length,
      totalInteracoes: reactions.length + comments.length,
    },
    saude: {
      altoEngajamento: highEngagement,
      poucoAtivo: lowEngagement,
      emRisco: atRisk,
      cresceram: 0,
      reduziram: 0,
      semLoginRecente: noRecentLogin.length,
      activeCount: activeCompanies.length,
    },
    insights,
  };
}

type Metrics = ReturnType<typeof computeMetrics>;

// ── Section Components ────────────────────────────────────────────────

function FinanceiroSection({ data }: { data: Metrics["financeiro"] }) {
  const payingRate =
    data.totalCompanies > 0 ? (data.paidCompaniesCount / data.totalCompanies) * 100 : 0;

  return (
    <div className="space-y-4">
      <SectionHeader
        icon={DollarSign}
        title="Financeiro"
        description="Indicadores financeiros do SaaS baseados nos planos e pagamentos cadastrados"
      />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard
          label="MRR"
          value={fmtCurrency(data.mrr)}
          icon={DollarSign}
          secondary="Receita mensal recorrente"
          variant="info"
        />
        <MetricCard
          label="ARR"
          value={fmtCurrency(data.arr)}
          icon={TrendingUp}
          secondary="Anual recorrente"
        />
        <MetricCard
          label="Receita Prevista (mês)"
          value={fmtCurrency(data.predictedMonthRevenue)}
          icon={BarChart3}
        />
        <MetricCard
          label="Receita Recebida (período)"
          value={fmtCurrency(data.totalPaidReceived)}
          icon={CheckCircle2}
          variant="positive"
        />
        <MetricCard
          label="Receita em Atraso"
          value={fmtCurrency(data.overdueAmount)}
          icon={AlertTriangle}
          variant={data.overdueAmount > 0 ? "warning" : "default"}
        />
        <MetricCard
          label="Receita Perdida"
          value={fmtCurrency(data.canceledMonthlyFee)}
          icon={XCircle}
          variant={data.canceledMonthlyFee > 0 ? "negative" : "default"}
          secondary="Cancelamentos"
        />
        <MetricCard
          label="Empresas Pagantes"
          value={fmtInt(data.paidCompaniesCount)}
          icon={CheckCircle2}
          secondary={`de ${fmtInt(data.totalCompanies)}`}
          progress={payingRate}
          variant="positive"
        />
        <MetricCard
          label="Empresas Inadimplentes"
          value={fmtInt(data.overdueCompaniesCount)}
          icon={AlertTriangle}
          variant={data.overdueCompaniesCount > 0 ? "negative" : "default"}
        />
      </div>
    </div>
  );
}

function EmpresasSection({ data }: { data: Metrics["empresas"] }) {
  const ativoRate = data.total > 0 ? (data.ativo / data.total) * 100 : 0;

  return (
    <div className="space-y-4">
      <SectionHeader
        icon={Building2}
        title="Empresas"
        description="Visão geral da base de clientes"
      />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard label="Total" value={fmtInt(data.total)} icon={Building2} />
        <MetricCard
          label="Ativas"
          value={fmtInt(data.ativo)}
          icon={CheckCircle2}
          variant="positive"
          progress={ativoRate}
        />
        <MetricCard label="Em Teste" value={fmtInt(data.teste)} icon={Clock} variant="warning" />
        <MetricCard
          label="Bloqueadas"
          value={fmtInt(data.bloqueado)}
          icon={XCircle}
          variant={data.bloqueado > 0 ? "negative" : "default"}
        />
        <MetricCard
          label="Canceladas"
          value={fmtInt(data.cancelado)}
          icon={XCircle}
          variant={data.cancelado > 0 ? "negative" : "default"}
        />
        <MetricCard
          label="Cadastradas no Mês"
          value={fmtInt(data.novasMes)}
          icon={ArrowUpRight}
          variant="positive"
        />
        <MetricCard label="Novas (período)" value={fmtInt(data.novasPeriodo)} icon={TrendingUp} />
        <MetricCard
          label="Sem Atividade"
          value={fmtInt(data.semAtividade)}
          icon={AlertTriangle}
          variant="warning"
        />
      </div>
    </div>
  );
}

function CrescimentoSection({ data }: { data: Metrics["crescimento"] }) {
  return (
    <div className="space-y-4">
      <SectionHeader
        icon={TrendingUp}
        title="Crescimento"
        description="Indicadores de evolução da base de clientes"
      />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard
          label="Novos Clientes (período)"
          value={fmtInt(data.novos)}
          icon={ArrowUpRight}
          variant="positive"
        />
        <MetricCard
          label="Cancelamentos"
          value={fmtInt(data.cancelamentos)}
          icon={ArrowDownRight}
          variant="negative"
        />
        <MetricCard
          label="Saldo Líquido"
          value={fmtInt(data.saldoLiquido)}
          icon={data.saldoLiquido >= 0 ? TrendingUp : TrendingDown}
          variant={data.saldoLiquido >= 0 ? "positive" : "negative"}
        />
        <MetricCard
          label="Churn"
          value={fmtPercent(data.churnRate)}
          icon={TrendingDown}
          variant={data.churnRate > 10 ? "negative" : data.churnRate > 5 ? "warning" : "positive"}
          progress={data.churnRate}
        />
        <MetricCard
          label="Retenção"
          value={fmtPercent(data.retencionRate)}
          icon={Shield}
          variant={
            data.retencionRate > 90 ? "positive" : data.retencionRate > 70 ? "warning" : "negative"
          }
          progress={data.retencionRate}
        />
        <MetricCard
          label="Tempo Médio como Cliente"
          value={`${Math.round(data.tempoMedioDias)} dias`}
          icon={Clock}
          secondary={
            data.tempoMedioDias > 0 ? `~${(data.tempoMedioDias / 30).toFixed(1)} meses` : undefined
          }
        />
        <MetricCard
          label="Retenção 30 dias"
          value={data.retention30d > 0 ? fmtInt(data.retention30d) : "—"}
          icon={CheckCircle2}
          secondary={
            data.retention30d > 0
              ? `${((data.retention30d / data.totalCompanies) * 100).toFixed(0)}% do total`
              : "Dados insuficientes"
          }
        />
        <MetricCard
          label="Retenção 90 dias"
          value={data.retention90d > 0 ? fmtInt(data.retention90d) : "—"}
          icon={CheckCircle2}
          secondary={
            data.retention90d > 0
              ? `${((data.retention90d / data.totalCompanies) * 100).toFixed(0)}% do total`
              : "Dados insuficientes"
          }
        />
        <MetricCard
          label="Retenção 365 dias"
          value={data.retention365d > 0 ? fmtInt(data.retention365d) : "—"}
          icon={CheckCircle2}
          secondary={
            data.retention365d > 0
              ? `${((data.retention365d / data.totalCompanies) * 100).toFixed(0)}% do total`
              : "Dados insuficientes"
          }
        />
      </div>
    </div>
  );
}

function CobrancasSection({ data }: { data: Metrics["cobrancas"] }) {
  return (
    <div className="space-y-4">
      <SectionHeader
        icon={CreditCard}
        title="Cobranças"
        description="Controle de vencimentos e pagamentos baseado nos dados cadastrados"
      />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard
          label="Próximas do Vencimento"
          value={fmtInt(data.proximasVencimento)}
          icon={Clock}
          variant={data.proximasVencimento > 0 ? "warning" : "default"}
        />
        <MetricCard
          label="Vencidas"
          value={fmtInt(data.vencidas)}
          icon={AlertTriangle}
          variant={data.vencidas > 0 ? "negative" : "default"}
        />
        <MetricCard
          label="Pagas"
          value={fmtInt(data.pagas)}
          icon={CheckCircle2}
          variant="positive"
        />
        <MetricCard
          label="Bloqueadas por Inadimplência"
          value={fmtInt(data.bloqueadasInadimplencia)}
          icon={XCircle}
          variant={data.bloqueadasInadimplencia > 0 ? "negative" : "default"}
        />
        <MetricCard
          label="Recebimentos Previstos (semana)"
          value={fmtCurrency(data.previstoSemana)}
          icon={DollarSign}
        />
        <MetricCard
          label="Recebimentos Previstos (mês)"
          value={fmtCurrency(data.previstoMes)}
          icon={DollarSign}
        />
      </div>
    </div>
  );
}

function UtilizacaoSection({ data }: { data: Metrics["utilizacao"] }) {
  return (
    <div className="space-y-4">
      <SectionHeader
        icon={Activity}
        title="Utilização da Plataforma"
        description="Atividade real das empresas na plataforma"
      />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard
          label="Empresas Utilizando Hoje"
          value={fmtInt(data.empresasHoje)}
          icon={Activity}
          variant="info"
        />
        <MetricCard label="Empresas (7 dias)" value={fmtInt(data.empresas7d)} icon={Activity} />
        <MetricCard label="Empresas (30 dias)" value={fmtInt(data.empresas30d)} icon={Activity} />
        <MetricCard label="Pedidos Realizados" value={fmtInt(data.pedidos)} icon={ShoppingCart} />
        <MetricCard label="Check-ins" value={fmtInt(data.checkins)} icon={UserCheck} />
        <MetricCard label="Publicações" value={fmtInt(data.publicacoes)} icon={MessageSquare} />
        <MetricCard label="Interações" value={fmtInt(data.interacoes)} icon={HeartPulse} />
        <MetricCard label="QR Codes Escaneados" value={fmtInt(data.qrCodes)} icon={QrCode} />
        <MetricCard
          label="Produtos Visualizados"
          value="—"
          icon={Eye}
          secondary="Dados insuficientes"
        />
        <MetricCard label="Pedidos Enviados" value={fmtInt(data.pedidosEnviados)} icon={Send} />
        <MetricCard label="Clientes Ativos" value={fmtInt(data.clientesAtivos)} icon={Users} />
      </div>
    </div>
  );
}

function EngajamentoSection({ data }: { data: Metrics["engajamento"] }) {
  return (
    <div className="space-y-4">
      <SectionHeader
        icon={Flame}
        title="Engajamento das Empresas"
        description="Nível de atividade e uso dos recursos por parte dos clientes"
      />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard
          label="Publicaram (período)"
          value={fmtInt(data.publicaramHoje)}
          icon={MessageSquare}
          variant="info"
        />
        <MetricCard
          label="Receberam Pedidos"
          value={fmtInt(data.receberamPedidos)}
          icon={ShoppingCart}
        />
        <MetricCard
          label="Cadastraram Produtos"
          value={fmtInt(data.cadastraramProdutos)}
          icon={Package}
        />
        <MetricCard label="Usaram Catálogo Inteligente" value="—" secondary="Dados insuficientes" />
        <MetricCard label="Responderam Pedidos" value="—" secondary="Dados insuficientes" />
        <MetricCard label="Usaram Atendimento" value="—" secondary="Dados insuficientes" />
        <MetricCard label="Usaram CRM" value="—" secondary="Dados insuficientes" />
        <MetricCard
          label="Sem uso há 7 dias"
          value={fmtInt(data.semUso7d)}
          icon={AlertTriangle}
          variant={data.semUso7d > 0 ? "warning" : "default"}
        />
        <MetricCard
          label="Sem uso há 15 dias"
          value={fmtInt(data.semUso15d)}
          icon={AlertTriangle}
          variant={data.semUso15d > 0 ? "warning" : "default"}
        />
        <MetricCard
          label="Sem uso há 30 dias"
          value={fmtInt(data.semUso30d)}
          icon={XCircle}
          variant={data.semUso30d > 0 ? "negative" : "default"}
        />
      </div>
    </div>
  );
}

function ImpactoSection({ data }: { data: Metrics["impacto"] }) {
  return (
    <div className="space-y-4">
      <SectionHeader
        icon={Zap}
        title="Impacto da weaze"
        description="Valor gerado pela weaze para os estabelecimentos"
        badge={{ label: "Valor Gerado", variant: "default" }}
      />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard
          label="Pedidos Movimentados"
          value={fmtInt(data.totalPedidos)}
          icon={ShoppingCart}
          variant="info"
        />
        <MetricCard
          label="Receita Movimentada"
          value={fmtCurrency(data.receitaMovimentada)}
          icon={DollarSign}
          variant="positive"
        />
        <MetricCard
          label="Clientes B2C Cadastrados"
          value={fmtInt(data.clientesB2C)}
          icon={Users}
        />
        <MetricCard
          label="Check-ins Realizados"
          value={fmtInt(data.totalCheckins)}
          icon={UserCheck}
        />
        <MetricCard label="QR Codes Escaneados" value={fmtInt(data.totalQrScans)} icon={QrCode} />
        <MetricCard
          label="Produtos Cadastrados"
          value={fmtInt(data.totalProdutos)}
          icon={Package}
        />
        <MetricCard
          label="Produtos Vendidos"
          value={fmtInt(data.produtosVendidos)}
          icon={ShoppingCart}
          variant="positive"
        />
        <MetricCard
          label="Publicações Realizadas"
          value={fmtInt(data.totalPublicacoes)}
          icon={MessageSquare}
        />
        <MetricCard
          label="Interações Registradas"
          value={fmtInt(data.totalInteracoes)}
          icon={HeartPulse}
        />
      </div>
    </div>
  );
}

function SaudeSection({ data }: { data: Metrics["saude"] }) {
  const total = data.activeCount;
  const highPct = total > 0 ? (data.altoEngajamento / total) * 100 : 0;
  const lowPct = total > 0 ? (data.poucoAtivo / total) * 100 : 0;
  const riskPct = total > 0 ? (data.emRisco / total) * 100 : 0;

  return (
    <div className="space-y-4">
      <SectionHeader
        icon={HeartPulse}
        title="Saúde do SaaS"
        description="Classificação automática do nível de atividade das empresas"
      />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard
          label="Empresas em Risco"
          value={fmtInt(data.emRisco)}
          icon={AlertTriangle}
          variant={data.emRisco > 0 ? "negative" : "default"}
          secondary="Sem atividade no período"
          progress={riskPct}
        />
        <MetricCard
          label="Pouco Ativas"
          value={fmtInt(data.poucoAtivo)}
          icon={Clock}
          variant="warning"
          secondary="Atividade baixa no período"
          progress={lowPct}
        />
        <MetricCard
          label="Muito Engajadas"
          value={fmtInt(data.altoEngajamento)}
          icon={Flame}
          variant="positive"
          secondary="Alta atividade no período"
          progress={highPct}
        />
        <MetricCard
          label="Cresceram (período)"
          value="—"
          icon={TrendingUp}
          secondary="Dados insuficientes"
        />
        <MetricCard
          label="Reduziram Atividade"
          value="—"
          icon={TrendingDown}
          secondary="Dados insuficientes"
        />
        <MetricCard
          label="Sem Login Recente (30d)"
          value={fmtInt(data.semLoginRecente)}
          icon={Shield}
          variant={data.semLoginRecente > 0 ? "warning" : "default"}
        />
      </div>
    </div>
  );
}

function InsightsSection({ data }: { data: Metrics["insights"] }) {
  if (data.length === 0) {
    return (
      <div className="space-y-4">
        <SectionHeader
          icon={Lightbulb}
          title="Insights Automáticos"
          description="Análises geradas automaticamente com base nos dados reais"
        />
        <div className="text-sm text-muted-foreground py-4 text-center">
          Nenhum insight disponível para o período selecionado.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <SectionHeader
        icon={Lightbulb}
        title="Insights Automáticos"
        description="Análises geradas automaticamente com base nos dados reais"
        badge={{ label: `${data.length} insight${data.length > 1 ? "s" : ""}` }}
      />
      <div className="space-y-2">
        {data.map((insight, i) => (
          <InsightCard key={i} variant={insight.variant}>
            {insight.text}
          </InsightCard>
        ))}
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────

const SECTION_TABS = [
  { value: "insights", label: "Insights", icon: Lightbulb },
  { value: "financeiro", label: "Financeiro", icon: DollarSign },
  { value: "empresas", label: "Empresas", icon: Building2 },
  { value: "crescimento", label: "Crescimento", icon: TrendingUp },
  { value: "cobrancas", label: "Cobranças", icon: CreditCard },
  { value: "utilizacao", label: "Utilização", icon: Activity },
  { value: "engajamento", label: "Engajamento", icon: Flame },
  { value: "impacto", label: "Impacto", icon: Zap },
  { value: "saude", label: "Saúde", icon: HeartPulse },
] as const;

function WeazeMetricas() {
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<PeriodKey>("30d");
  const [raw, setRaw] = useState<RawData | null>(null);
  const [activeTab, setActiveTab] = useState("insights");

  const range = useMemo(() => getPeriodRange(period), [period]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const data = await fetchAllData();
        setRaw(data);
      } catch (err) {
        console.error("Erro ao carregar métricas:", err);
        toast.error("Erro ao carregar métricas.");
      }
      setLoading(false);
    })();
  }, []);

  const metrics = useMemo(() => {
    if (!raw) return null;
    return computeMetrics(raw, range);
  }, [raw, range]);

  const activePeriod = PERIODS.find((p) => p.key === period)!;

  return (
    <div className={cn("space-y-6", loading && "opacity-60")}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl">Métricas</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Painel de gestão SaaS — <span className="font-medium">{activePeriod.label}</span>
          </p>
        </div>
        <div className="flex gap-1 bg-muted rounded-lg p-1">
          {PERIODS.map((p) => (
            <button
              key={p.key}
              onClick={() => setPeriod(p.key)}
              className={cn(
                "px-3 py-1.5 text-xs font-medium rounded-md transition-colors",
                period === p.key
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {loading && (
        <div className="space-y-8">
          <SkeletonSection />
          <SkeletonSection />
        </div>
      )}

      {metrics && (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <div className="overflow-x-auto scrollbar-hide">
            <TabsList className="h-auto flex-wrap gap-1 bg-transparent p-0 w-full justify-start">
              {SECTION_TABS.map(({ value, label, icon: Icon }) => (
                <TabsTrigger
                  key={value}
                  value={value}
                  className="gap-1.5 px-3 py-2 text-xs data-[state=active]:bg-brand data-[state=active]:text-brand-foreground"
                >
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          <TabsContent value="insights">
            <InsightsSection data={metrics.insights} />
          </TabsContent>
          <TabsContent value="financeiro">
            <FinanceiroSection data={metrics.financeiro} />
          </TabsContent>
          <TabsContent value="empresas">
            <EmpresasSection data={metrics.empresas} />
          </TabsContent>
          <TabsContent value="crescimento">
            <CrescimentoSection data={metrics.crescimento} />
          </TabsContent>
          <TabsContent value="cobrancas">
            <CobrancasSection data={metrics.cobrancas} />
          </TabsContent>
          <TabsContent value="utilizacao">
            <UtilizacaoSection data={metrics.utilizacao} />
          </TabsContent>
          <TabsContent value="engajamento">
            <EngajamentoSection data={metrics.engajamento} />
          </TabsContent>
          <TabsContent value="impacto">
            <ImpactoSection data={metrics.impacto} />
          </TabsContent>
          <TabsContent value="saude">
            <SaudeSection data={metrics.saude} />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
