import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { RefreshCw, Landmark, TrendingUp, ShoppingCart, Receipt, HandCoins, Search } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, XAxis, YAxis } from "recharts";

export const Route = createFileRoute("/_authenticated/admin/financeiro-plataforma")({
  component: WeazeFinanceiroPlataforma,
  head: () => ({ meta: [{ title: "Financeiro da Plataforma — WEAZE Admin" }] }),
});

const PERIODS = [
  { key: "hoje", label: "Hoje" },
  { key: "7d", label: "7 dias" },
  { key: "30d", label: "30 dias" },
  { key: "90d", label: "90 dias" },
  { key: "ano", label: "Ano" },
] as const;

type PeriodKey = (typeof PERIODS)[number]["key"];

type PaymentRow = {
  id: string;
  company_id: string;
  company_name: string | null;
  order_id: string | null;
  payment_origin: string;
  payment_method: string;
  payment_status: string;
  gross_amount: number;
  net_amount: number;
  mercadopago_payment_id: string | null;
  paid_at: string | null;
  created_at: string;
};

const METHOD_META: Record<string, { label: string; color: string }> = {
  pix: { label: "Pix", color: "#10b981" },
  credit_card: { label: "Cartão de Crédito", color: "#6366f1" },
  debit_card: { label: "Cartão de Débito", color: "#f59e0b" },
  cash: { label: "No Caixa", color: "#f43f5e" },
  other: { label: "Outro", color: "#94a3b8" },
};

const ORIGIN_META: Record<string, { label: string }> = {
  mercado_pago: { label: "Mercado Pago" },
  cashier: { label: "No Caixa" },
};

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
  return { start: start.toISOString(), end };
}

function getPreviousRange(range: { start: string; end: string }) {
  const duration = new Date(range.end).getTime() - new Date(range.start).getTime();
  return {
    start: new Date(new Date(range.start).getTime() - duration).toISOString(),
    end: range.start,
  };
}

function fmtCurrency(n: number) {
  return `R$ ${n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtCurrencyCompact(n: number) {
  if (n >= 1_000_000) return `R$ ${(n / 1_000_000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}M`;
  if (n >= 1_000) return `R$ ${(n / 1_000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}k`;
  return `R$ ${n.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`;
}

function fmtInt(n: number) {
  return n.toLocaleString("pt-BR");
}

type CompanyRow = { id: string; name: string; city: string | null; status: string };

function MetricCard({
  label,
  value,
  secondary,
  icon: Icon,
  variant,
}: {
  label: string;
  value: string;
  secondary?: string;
  icon: React.ElementType;
  variant?: "positive" | "negative" | "warning" | "info";
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
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
      </CardContent>
    </Card>
  );
}

const revenueConfig: ChartConfig = {
  mercadoPago: { label: "Mercado Pago", color: "#6366f1" },
  cashier: { label: "No Caixa", color: "#f43f5e" },
};

const ordersConfig: ChartConfig = {
  pedidos: { label: "Pedidos", color: "#10b981" },
};

const methodConfig: ChartConfig = {
  pix: { label: "Pix", color: METHOD_META.pix.color },
  credit_card: { label: "Cartão de Crédito", color: METHOD_META.credit_card.color },
  debit_card: { label: "Cartão de Débito", color: METHOD_META.debit_card.color },
  cash: { label: "No Caixa", color: METHOD_META.cash.color },
  other: { label: "Outro", color: METHOD_META.other.color },
};

const topConfig: ChartConfig = {
  total: { label: "Faturamento", color: "#6366f1" },
};

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

function WeazeFinanceiroPlataforma() {
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<PeriodKey>("30d");
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [companies, setCompanies] = useState<CompanyRow[]>([]);
  const [reload, setReload] = useState(0);
  const [companyFilter, setCompanyFilter] = useState("__all");
  const [methodFilter, setMethodFilter] = useState("__all");
  const [originFilter, setOriginFilter] = useState("__all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [paymentsRes, companiesRes] = await Promise.all([
          (supabase as any).rpc("admin_list_platform_payments"),
          supabase.from("companies").select("id, name, city, status").order("name"),
        ]);
        if (paymentsRes.error) throw paymentsRes.error;
        setPayments((paymentsRes.data ?? []) as PaymentRow[]);
        setCompanies(companiesRes.data ?? []);
      } catch (err) {
        console.error("Erro ao carregar financeiro da plataforma:", err);
        toast.error("Erro ao carregar dados financeiros.");
      }
      setLoading(false);
    })();
  }, [reload]);

  const range = useMemo(() => getPeriodRange(period), [period]);
  const prevRange = useMemo(() => getPreviousRange(range), [range]);

  const filtered = useMemo(() => {
    const startTs = new Date(range.start).getTime();
    const endTs = new Date(range.end).getTime();
    return payments.filter((p) => {
      if (!p.paid_at) return false;
      const t = new Date(p.paid_at).getTime();
      if (t < startTs || t > endTs) return false;
      if (companyFilter !== "__all" && p.company_id !== companyFilter) return false;
      if (methodFilter !== "__all" && p.payment_method !== methodFilter) return false;
      if (originFilter !== "__all" && p.payment_origin !== originFilter) return false;
      return true;
    });
  }, [payments, range, companyFilter, methodFilter, originFilter]);

  const approved = useMemo(() => filtered.filter((p) => p.payment_status === "approved"), [filtered]);

  const kpis = useMemo(() => {
    const sum = (list: PaymentRow[], origin?: string) =>
      list.reduce((s, p) => {
        if (origin && p.payment_origin !== origin) return s;
        return s + (Number(p.gross_amount) || 0);
      }, 0);

    const gmv = sum(approved);
    const gmvMp = sum(approved, "mercado_pago");
    const gmvCashier = sum(approved, "cashier");
    const net = approved.reduce((s, p) => s + (Number(p.net_amount) || 0), 0);
    const pedidos = approved.length;

    const prevApproved = payments.filter(
      (p) =>
        p.payment_status === "approved" &&
        p.paid_at &&
        new Date(p.paid_at).getTime() >= new Date(prevRange.start).getTime() &&
        new Date(p.paid_at).getTime() <= new Date(prevRange.end).getTime(),
    );
    const prevGmv = sum(prevApproved);
    const growth = prevGmv > 0 ? ((gmv - prevGmv) / prevGmv) * 100 : gmv > 0 ? 100 : 0;

    const companiesWithSales = new Set(approved.map((p) => p.company_id)).size;

    return {
      gmv,
      gmvMp,
      gmvCashier,
      net,
      pedidos,
      ticket: pedidos > 0 ? gmv / pedidos : 0,
      growth,
      companiesWithSales,
    };
  }, [approved, payments, prevRange]);

  const revenueSeries = useMemo(() => {
    const groupBy = period === "ano" ? "month" : "day";
    const buckets = new Map<
      string,
      { sortKey: string; label: string; mercadoPago: number; cashier: number }
    >();
    approved.forEach((p) => {
      const d = new Date(p.paid_at!);
      const sortKey =
        groupBy === "month"
          ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
          : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const label =
        groupBy === "month"
          ? d.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" })
          : d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
      const bucket = buckets.get(sortKey) ?? { sortKey, label, mercadoPago: 0, cashier: 0 };
      if (p.payment_origin === "mercado_pago") bucket.mercadoPago += Number(p.gross_amount) || 0;
      else bucket.cashier += Number(p.gross_amount) || 0;
      buckets.set(sortKey, bucket);
    });
    return Array.from(buckets.values())
      .sort((a, b) => a.sortKey.localeCompare(b.sortKey))
      .map(({ sortKey: _sortKey, ...rest }) => rest);
  }, [approved, period]);

  const ordersSeries = useMemo(() => {
    const groupBy = period === "ano" ? "month" : "day";
    const buckets = new Map<string, { sortKey: string; label: string; pedidos: number }>();
    approved.forEach((p) => {
      const d = new Date(p.paid_at!);
      const sortKey =
        groupBy === "month"
          ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
          : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const label =
        groupBy === "month"
          ? d.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" })
          : d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
      const bucket = buckets.get(sortKey) ?? { sortKey, label, pedidos: 0 };
      bucket.pedidos += 1;
      buckets.set(sortKey, bucket);
    });
    return Array.from(buckets.values())
      .sort((a, b) => a.sortKey.localeCompare(b.sortKey))
      .map(({ sortKey: _sortKey, ...rest }) => rest);
  }, [approved, period]);

  const methodData = useMemo(() => {
    const byMethod = new Map<string, number>();
    approved.forEach((p) => {
      byMethod.set(p.payment_method, (byMethod.get(p.payment_method) ?? 0) + (Number(p.gross_amount) || 0));
    });
    return Array.from(byMethod.entries())
      .map(([key, value]) => ({
        key,
        name: key,
        value: Number(value.toFixed(2)),
        fill: `var(--color-${key})`,
      }))
      .sort((a, b) => b.value - a.value);
  }, [approved]);

  const establishments = useMemo(() => {
    const companyById = new Map(companies.map((c) => [c.id, c]));
    const map = new Map<
      string,
      {
        id: string;
        name: string;
        city: string | null;
        status: string;
        pedidos: number;
        mp: number;
        cashier: number;
        total: number;
        last: string;
      }
    >();
    approved.forEach((p) => {
      const item = map.get(p.company_id) ?? {
        id: p.company_id,
        name: companyById.get(p.company_id)?.name ?? p.company_name ?? "—",
        city: companyById.get(p.company_id)?.city ?? null,
        status: companyById.get(p.company_id)?.status ?? "ativo",
        pedidos: 0,
        mp: 0,
        cashier: 0,
        total: 0,
        last: p.paid_at!,
      };
      item.pedidos += 1;
      if (p.payment_origin === "mercado_pago") item.mp += Number(p.gross_amount) || 0;
      else item.cashier += Number(p.gross_amount) || 0;
      item.total = item.mp + item.cashier;
      if (!item.last || p.paid_at! > item.last) item.last = p.paid_at!;
      map.set(p.company_id, item);
    });
    return Array.from(map.values())
      .sort((a, b) => b.total - a.total)
      .map((e) => ({
        ...e,
        ticket: e.pedidos > 0 ? e.total / e.pedidos : 0,
      }));
  }, [approved, companies]);

  const topEstablishments = useMemo(() => {
    const top = establishments.slice(0, 8).map((e) => ({
      name: e.name.length > 22 ? `${e.name.slice(0, 22)}…` : e.name,
      total: Number(e.total.toFixed(2)),
    }));
    return top.length > 0 ? top : [];
  }, [establishments]);

  const searchedEstablishments = useMemo(() => {
    if (!search) return establishments;
    const q = search.toLowerCase();
    return establishments.filter((e) => e.name.toLowerCase().includes(q) || (e.city ?? "").toLowerCase().includes(q));
  }, [establishments, search]);

  const activePeriod = PERIODS.find((p) => p.key === period)!;

  return (
    <div className={cn("space-y-6", loading && "opacity-60")}>
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl">Financeiro da Plataforma</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Volume financeiro global dos estabelecimentos —{" "}
            <span className="font-medium">{activePeriod.label}</span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
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
          <Button onClick={() => setReload((r) => r + 1)} variant="outline" size="sm" className="gap-1.5">
            <RefreshCw className="h-3.5 w-3.5" />
            Atualizar
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <Select value={companyFilter} onValueChange={setCompanyFilter}>
          <SelectTrigger className="w-52 h-9 text-sm">
            <SelectValue placeholder="Estabelecimento" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all">Todos os estabelecimentos</SelectItem>
            {companies.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={originFilter} onValueChange={setOriginFilter}>
          <SelectTrigger className="w-40 h-9 text-sm">
            <SelectValue placeholder="Origem" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all">Todas as origens</SelectItem>
            {Object.entries(ORIGIN_META).map(([key, meta]) => (
              <SelectItem key={key} value={key}>
                {meta.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={methodFilter} onValueChange={setMethodFilter}>
          <SelectTrigger className="w-48 h-9 text-sm">
            <SelectValue placeholder="Forma de pagamento" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all">Todas as formas</SelectItem>
            {Object.entries(METHOD_META).map(([key, meta]) => (
              <SelectItem key={key} value={key}>
                {meta.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <MetricCard
              label="GMV Total"
              value={fmtCurrency(kpis.gmv)}
              icon={TrendingUp}
              secondary={`${kpis.growth >= 0 ? "+" : ""}${kpis.growth.toFixed(1)}% vs período anterior`}
              variant={kpis.growth >= 0 ? "positive" : "negative"}
            />
            <MetricCard
              label="GMV Mercado Pago"
              value={fmtCurrency(kpis.gmvMp)}
              icon={Landmark}
              secondary={`${kpis.gmv > 0 ? ((kpis.gmvMp / kpis.gmv) * 100).toFixed(1) : "0.0"}% do total`}
              variant="info"
            />
            <MetricCard
              label="GMV No Caixa"
              value={fmtCurrency(kpis.gmvCashier)}
              icon={HandCoins}
              secondary={`${kpis.gmv > 0 ? ((kpis.gmvCashier / kpis.gmv) * 100).toFixed(1) : "0.0"}% do total`}
              variant="warning"
            />
            <MetricCard
              label="Pedidos Pagos"
              value={fmtInt(kpis.pedidos)}
              icon={ShoppingCart}
              secondary={`${fmtInt(kpis.companiesWithSales)} estabelecimento${kpis.companiesWithSales === 1 ? "" : "s"} com vendas`}
              variant="positive"
            />
            <MetricCard label="Ticket Médio" value={fmtCurrency(kpis.ticket)} icon={Receipt} secondary="por pedido pago" />
            <MetricCard
              label="Líquido (repasse)"
              value={fmtCurrency(kpis.net)}
              icon={Landmark}
              secondary="após taxas do gateway"
              variant="info"
            />
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="font-display text-base">Evolução da Receita</CardTitle>
                <CardDescription>GMV por {period === "ano" ? "mês" : "dia"}, separado por origem</CardDescription>
              </CardHeader>
              <CardContent>
                {revenueSeries.length === 0 ? (
                  <p className="py-12 text-center text-sm text-muted-foreground">Sem vendas no período.</p>
                ) : (
                  <ChartContainer config={revenueConfig} className="h-[260px] w-full">
                    <BarChart data={revenueSeries}>
                      <CartesianGrid vertical={false} />
                      <XAxis
                        dataKey="label"
                        tickLine={false}
                        axisLine={false}
                        tickMargin={8}
                        interval={Math.max(1, Math.floor(revenueSeries.length / 8))}
                      />
                      <YAxis tickFormatter={fmtCurrencyCompact} tickLine={false} axisLine={false} width={70} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <ChartLegend content={<ChartLegendContent />} />
                      <Bar dataKey="mercadoPago" stackId="a" fill="var(--color-mercadoPago)" radius={[0, 0, 0, 0]} />
                      <Bar dataKey="cashier" stackId="a" fill="var(--color-cashier)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ChartContainer>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="font-display text-base">
                  Pedidos {period === "ano" ? "por Mês" : "por Dia"}
                </CardTitle>
                <CardDescription>Quantidade de pedidos pagos</CardDescription>
              </CardHeader>
              <CardContent>
                {ordersSeries.length === 0 ? (
                  <p className="py-12 text-center text-sm text-muted-foreground">Sem vendas no período.</p>
                ) : (
                  <ChartContainer config={ordersConfig} className="h-[260px] w-full">
                    <BarChart data={ordersSeries}>
                      <CartesianGrid vertical={false} />
                      <XAxis
                        dataKey="label"
                        tickLine={false}
                        axisLine={false}
                        tickMargin={8}
                        interval={Math.max(1, Math.floor(ordersSeries.length / 8))}
                      />
                      <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={40} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar dataKey="pedidos" fill="var(--color-pedidos)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ChartContainer>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="font-display text-base">Distribuição por Forma de Pagamento</CardTitle>
                <CardDescription>Participação no GMV do período</CardDescription>
              </CardHeader>
              <CardContent>
                {methodData.length === 0 ? (
                  <p className="py-12 text-center text-sm text-muted-foreground">Sem vendas no período.</p>
                ) : (
                  <ChartContainer config={methodConfig} className="h-[260px] w-full">
                    <PieChart>
                      <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel nameKey="name" formatter={(v) => fmtCurrency(Number(v))} />} />
                      <Pie data={methodData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={2} strokeWidth={4}>
                        {methodData.map((d) => (
                          <Cell key={d.key} fill={d.fill} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ChartContainer>
                )}
                <div className="mt-2 space-y-1.5">
                  {methodData.map((d) => (
                    <div key={d.key} className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-1.5">
                        <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: METHOD_META[d.key]?.color ?? "#94a3b8" }} />
                        {METHOD_META[d.key]?.label ?? d.key}
                      </span>
                      <span className="text-muted-foreground">{fmtCurrency(d.value)}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="font-display text-base">Top Estabelecimentos</CardTitle>
                <CardDescription>Faturamento dos maiores estabelecimentos no período</CardDescription>
              </CardHeader>
              <CardContent>
                {topEstablishments.length === 0 ? (
                  <p className="py-12 text-center text-sm text-muted-foreground">Sem vendas no período.</p>
                ) : (
                  <ChartContainer config={topConfig} className="h-[260px] w-full">
                    <BarChart data={topEstablishments} layout="vertical" margin={{ left: 8 }}>
                      <CartesianGrid horizontal={false} />
                      <XAxis type="number" hide />
                      <YAxis
                        type="category"
                        dataKey="name"
                        width={150}
                        tickLine={false}
                        axisLine={false}
                        tick={{ fontSize: 12 }}
                      />
                      <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel nameKey="total" formatter={(v) => fmtCurrency(Number(v))} />} />
                      <Bar dataKey="total" fill="var(--color-total)" radius={4} />
                    </BarChart>
                  </ChartContainer>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Establishments table */}
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <CardTitle className="font-display text-base">Estabelecimentos</CardTitle>
                  <CardDescription>Resumo por estabelecimento no período selecionado</CardDescription>
                </div>
                <div className="relative max-w-xs w-full sm:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar estabelecimento..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9 h-9 text-sm"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {searchedEstablishments.length === 0 ? (
                <p className="p-5 text-sm text-muted-foreground text-center">
                  Nenhum estabelecimento com vendas no período.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-xs uppercase text-muted-foreground">
                        <th className="px-5 py-3 font-medium">Estabelecimento</th>
                        <th className="px-5 py-3 font-medium">Status</th>
                        <th className="px-5 py-3 font-medium text-right">Pedidos</th>
                        <th className="px-5 py-3 font-medium text-right">Mercado Pago</th>
                        <th className="px-5 py-3 font-medium text-right">No Caixa</th>
                        <th className="px-5 py-3 font-medium text-right">Total</th>
                        <th className="px-5 py-3 font-medium text-right">Ticket Médio</th>
                        <th className="px-5 py-3 font-medium text-right">Última Venda</th>
                      </tr>
                    </thead>
                    <tbody>
                      {searchedEstablishments.map((e) => (
                        <tr key={e.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                          <td className="px-5 py-3">
                            <Link
                              to="/admin/empresas/$id"
                              params={{ id: e.id }}
                              className="font-medium hover:underline"
                            >
                              {e.name}
                            </Link>
                            {e.city && <span className="text-xs text-muted-foreground ml-1.5">{e.city}</span>}
                          </td>
                          <td className="px-5 py-3">
                            <Badge variant={e.status === "ativo" || e.status === "teste" ? "default" : e.status === "bloqueado" ? "destructive" : "secondary"}>
                              {e.status}
                            </Badge>
                          </td>
                          <td className="px-5 py-3 text-right">{fmtInt(e.pedidos)}</td>
                          <td className="px-5 py-3 text-right text-muted-foreground">{fmtCurrency(e.mp)}</td>
                          <td className="px-5 py-3 text-right text-muted-foreground">{fmtCurrency(e.cashier)}</td>
                          <td className="px-5 py-3 text-right font-medium">{fmtCurrency(e.total)}</td>
                          <td className="px-5 py-3 text-right text-muted-foreground">{fmtCurrency(e.ticket)}</td>
                          <td className="px-5 py-3 text-right text-muted-foreground">
                            {e.last ? new Date(e.last).toLocaleDateString("pt-BR") : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
