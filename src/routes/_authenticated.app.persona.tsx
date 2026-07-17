import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL } from "@/lib/format";
import {
  Users,
  TrendingUp,
  Clock,
  Calendar,
  ShoppingCart,
  Package,
  Eye,
  Heart,
  MessageCircle,
  Share2,
  Crown,
  UserPlus,
  Activity,
  Target,
  Zap,
  AlertTriangle,
  CheckCircle2,
  Info,
  Sparkles,
  Lightbulb,
  BarChart3,
  ScanLine,
  Star,
  Repeat,
  ArrowDown,
  UserCheck,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/persona")({
  component: PersonaInteligentePage,
  head: () => ({ meta: [{ title: "Persona Inteligente — WEAZE" }] }),
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
      return { start: d.getTime(), end: now };
    }
    case "7d":
      return { start: now - 7 * day, end: now };
    case "30d":
      return { start: now - 30 * day, end: now };
    case "90d":
      return { start: now - 90 * day, end: now };
    case "year": {
      const d = new Date();
      d.setMonth(0, 1);
      d.setHours(0, 0, 0, 0);
      return { start: d.getTime(), end: now };
    }
  }
}

function inRange(ts: string | number | Date | null | undefined, start: number, end: number) {
  if (!ts) return false;
  const t = new Date(ts).getTime();
  return t >= start && t <= end;
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

const GENDER_LABELS: Record<string, string> = {
  mulher: "Mulher",
  homem: "Homem",
  prefiro_nao_informar: "Prefiro não informar",
  nao_informado: "Não informado",
};

const AGE_RANGE_LABELS: Record<string, string> = {
  ate_17: "Até 17 anos",
  "18-24": "18–24 anos",
  "25-34": "25–34 anos",
  "35-44": "35–44 anos",
  "45-54": "45–54 anos",
  "55_mais": "55+ anos",
  nao_informado: "Não informado",
};

const DAY_NAMES = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];

const PERIOD_MONTHS: Record<PeriodKey, number> = {
  today: 1 / 30,
  "7d": 7 / 30,
  "30d": 1,
  "90d": 3,
  year: 12,
};

function PersonaInteligentePage() {
  const companyId = useCompanyId();
  const [period, setPeriod] = useState<PeriodKey>("30d");

  const { start: pStart, end: pEnd } = getPeriodBounds(period);

  // ── Data queries ──
  const { data: customers } = useQuery({
    queryKey: ["persona-customers", companyId],
    queryFn: async () => {
      const { data } = await supabase.from("customers").select("*").eq("company_id", companyId!);
      return data ?? [];
    },
    enabled: !!companyId,
  });

  const { data: allCheckins } = useQuery({
    queryKey: ["persona-checkins", companyId],
    queryFn: async () => {
      const { data } = await supabase
        .from("checkins")
        .select("context, source, created_at, customer_id, table_id")
        .eq("company_id", companyId!);
      return data ?? [];
    },
    enabled: !!companyId,
  });

  const { data: allOrders } = useQuery({
    queryKey: ["persona-orders", companyId],
    queryFn: async () => {
      const { data } = await supabase
        .from("orders")
        .select("*, order_items(*), customer:customers(id)")
        .eq("company_id", companyId!);
      return data ?? [];
    },
    enabled: !!companyId,
  });

  const { data: productEvents } = useQuery({
    queryKey: ["persona-events", companyId],
    queryFn: async () => {
      const { data } = await supabase
        .from("product_events")
        .select("event_type, product_id, customer_id, created_at")
        .eq("company_id", companyId!);
      return data ?? [];
    },
    enabled: !!companyId,
  });

  const { data: allPosts } = useQuery({
    queryKey: ["persona-posts", companyId],
    queryFn: async () => {
      const { data } = await supabase
        .from("posts")
        .select("customer_id")
        .eq("company_id", companyId!);
      return data ?? [];
    },
    enabled: !!companyId,
  });

  const { data: allComments } = useQuery({
    queryKey: ["persona-comments", companyId],
    queryFn: async () => {
      const { data } = await supabase
        .from("comments")
        .select("customer_id, text, post:posts!inner(company_id)")
        .eq("post.company_id", companyId!);
      return data ?? [];
    },
    enabled: !!companyId,
  });

  const { data: allReactions } = useQuery({
    queryKey: ["persona-reactions", companyId],
    queryFn: async () => {
      const { data } = await supabase.from("post_reactions").select("customer_id, type");
      return data ?? [];
    },
    enabled: !!companyId,
  });

  const { data: products } = useQuery({
    queryKey: ["persona-products", companyId],
    queryFn: async () => {
      const { data } = await supabase
        .from("products")
        .select("id, name, category, price")
        .eq("company_id", companyId!);
      return data ?? [];
    },
    enabled: !!companyId,
  });

  const { data: tables } = useQuery({
    queryKey: ["persona-tables", companyId],
    queryFn: async () => {
      const { data } = await supabase
        .from("tables")
        .select("id, label, slug")
        .eq("company_id", companyId!);
      return data ?? [];
    },
    enabled: !!companyId,
  });

  // ── Period-filtered data ──
  const checkins = useMemo(
    () => (allCheckins ?? []).filter((c: any) => inRange(c.created_at, pStart, pEnd)),
    [allCheckins, pStart, pEnd],
  );
  const orders = useMemo(
    () => (allOrders ?? []).filter((o: any) => inRange(o.created_at, pStart, pEnd)),
    [allOrders, pStart, pEnd],
  );
  const events = useMemo(
    () => (productEvents ?? []).filter((e: any) => inRange(e.created_at, pStart, pEnd)),
    [productEvents, pStart, pEnd],
  );
  const periodCustomers = useMemo(
    () => (customers ?? []).filter((c: any) => inRange(c.last_visit_at, pStart, pEnd)),
    [customers, pStart, pEnd],
  );

  const tableMap = useMemo(() => {
    const m = new Map<string, string>();
    (tables ?? []).forEach((t: any) => m.set(t.id, t.label));
    return m;
  }, [tables]);

  const productMap = useMemo(() => {
    const m = new Map<string, any>();
    (products ?? []).forEach((p: any) => m.set(p.id, p));
    return m;
  }, [products]);

  // ══════════════════════════════════════════════════════
  // COMPUTED DATA — shared across multiple sections
  // ══════════════════════════════════════════════════════

  // Per-customer order stats (used by summary, consumption, engagement, RFM, journey, ideal client)
  const custOrderStats = useMemo(() => {
    const stats: Record<
      string,
      { orderCount: number; totalSpent: number; firstOrder: string | null; lastOrder: string | null; orderTimes: string[] }
    > = {};
    (allOrders ?? []).forEach((o: any) => {
      if (!o.customer_id) return;
      if (!stats[o.customer_id])
        stats[o.customer_id] = { orderCount: 0, totalSpent: 0, firstOrder: null, lastOrder: null, orderTimes: [] };
      const s = stats[o.customer_id];
      s.orderCount++;
      s.totalSpent += Number(o.total);
      s.orderTimes.push(o.created_at);
      if (!s.firstOrder || o.created_at < s.firstOrder) s.firstOrder = o.created_at;
      if (!s.lastOrder || o.created_at > s.lastOrder) s.lastOrder = o.created_at;
    });
    return stats;
  }, [allOrders]);

  // Product/category aggregation from orders
  const productAgg = useMemo(() => {
    const prodQty: Record<string, number> = {};
    const prodRevenue: Record<string, number> = {};
    const prodCusts: Record<string, Set<string>> = {};
    const prodRecurringCusts: Record<string, Set<string>> = {};
    const catQty: Record<string, number> = {};
    const catRevenue: Record<string, number> = {};
    const catCusts: Record<string, Set<string>> = {};

    orders.forEach((o: any) => {
      const cid = o.customer_id;
      const isRecurring = cid ? (custOrderStats[cid]?.orderCount ?? 0) >= 2 : false;
      (o.order_items ?? []).forEach((i: any) => {
        const pid = i.product_id;
        const price = Number(i.unit_price ?? i.price ?? 0) * i.quantity;
        const p = productMap.get(pid);
        const cat = p?.category || "Sem categoria";

        prodQty[pid] = (prodQty[pid] ?? 0) + i.quantity;
        prodRevenue[pid] = (prodRevenue[pid] ?? 0) + price;
        if (!prodCusts[pid]) prodCusts[pid] = new Set();
        if (cid) prodCusts[pid].add(cid);
        if (isRecurring) {
          if (!prodRecurringCusts[pid]) prodRecurringCusts[pid] = new Set();
          if (cid) prodRecurringCusts[pid].add(cid);
        }

        catQty[cat] = (catQty[cat] ?? 0) + i.quantity;
        catRevenue[cat] = (catRevenue[cat] ?? 0) + price;
        if (!catCusts[cat]) catCusts[cat] = new Set();
        if (cid) catCusts[cat].add(cid);
      });
    });

    // Product with highest avg ticket (revenue / unique customers)
    const prodAvgTicket: Record<string, number> = {};
    Object.keys(prodRevenue).forEach((pid) => {
      const custCount = prodCusts[pid]?.size ?? 1;
      prodAvgTicket[pid] = prodRevenue[pid] / custCount;
    });

    // Category with highest avg ticket
    const catAvgTicket: Record<string, number> = {};
    Object.keys(catRevenue).forEach((cat) => {
      const custCount = catCusts[cat]?.size ?? 1;
      catAvgTicket[cat] = catRevenue[cat] / custCount;
    });

    return {
      prodQty,
      prodRevenue,
      prodCusts,
      prodRecurringCusts,
      prodAvgTicket,
      catQty,
      catRevenue,
      catCusts,
      catAvgTicket,
    };
  }, [orders, productMap, custOrderStats]);

  // ══════════════════════════════════════════════════════
  // SEÇÃO 1: Resumo Executivo
  // ══════════════════════════════════════════════════════
  const summary = useMemo(() => {
    const totalCustomers = periodCustomers.length;
    const totalCheckins = checkins.length;
    const totalOrders = orders.length;

    // Dominant gender
    const genderCounts: Record<string, number> = {};
    periodCustomers.forEach((c: any) => {
      const g = c.gender || "nao_informado";
      genderCounts[g] = (genderCounts[g] ?? 0) + 1;
    });
    const dominantGender = Object.entries(genderCounts).sort((a, b) => b[1] - a[1])[0];
    const dominantGenderStr = dominantGender
      ? (GENDER_LABELS[dominantGender[0]] ?? dominantGender[0])
      : "—";

    // Dominant age range
    const ageCounts: Record<string, number> = {};
    periodCustomers.forEach((c: any) => {
      const a = c.age_range || "nao_informado";
      ageCounts[a] = (ageCounts[a] ?? 0) + 1;
    });
    const dominantAge = Object.entries(ageCounts).sort((a, b) => b[1] - a[1])[0];
    const dominantAgeStr = dominantAge ? (AGE_RANGE_LABELS[dominantAge[0]] ?? dominantAge[0]) : "—";

    // Dominant visit context
    const contextCounts: Record<string, number> = {};
    checkins.forEach((c: any) => {
      const ctx = c.context || "desconhecido";
      contextCounts[ctx] = (contextCounts[ctx] ?? 0) + 1;
    });
    const dominantCtx = Object.entries(contextCounts).sort((a, b) => b[1] - a[1])[0];
    const dominantCtxStr = dominantCtx ? dominantCtx[0] : "—";

    // Average ticket
    const totalRevenue = orders.reduce((s: number, o: any) => s + Number(o.total), 0);
    const avgTicket = orders.length > 0 ? totalRevenue / orders.length : 0;

    // Top category
    const topCat = Object.entries(productAgg.catRevenue).sort((a, b) => b[1] - a[1])[0];
    const topCategoryName = topCat ? topCat[0] : "—";

    // Champion product
    const topProd = Object.entries(productAgg.prodQty).sort((a, b) => b[1] - a[1])[0];
    const championProduct = topProd ? (productMap.get(topProd[0])?.name ?? "—") : "—";

    // Return frequency (days)
    const custTimes: Record<string, string[]> = {};
    checkins.forEach((c: any) => {
      if (c.customer_id) {
        if (!custTimes[c.customer_id]) custTimes[c.customer_id] = [];
        custTimes[c.customer_id].push(c.created_at);
      }
    });
    let totalGapMs = 0;
    let gapCount = 0;
    Object.values(custTimes).forEach((times) => {
      times.sort();
      for (let i = 1; i < times.length; i++) {
        totalGapMs += new Date(times[i]).getTime() - new Date(times[i - 1]).getTime();
        gapCount++;
      }
    });
    const avgReturnDays = gapCount > 0 ? totalGapMs / gapCount / 86400000 : null;

    // Fidelity level
    const recurringCount = Object.values(custOrderStats).filter((s) => s.orderCount >= 2).length;
    const totalWithOrders = Object.keys(custOrderStats).length || 1;
    const recurringPct = (recurringCount / totalWithOrders) * 100;
    let fidelityLevel: string;
    if (recurringPct >= 40) fidelityLevel = "Alta";
    else if (recurringPct >= 20) fidelityLevel = "Média";
    else fidelityLevel = "Baixa";

    return {
      totalCustomers,
      totalCheckins,
      totalOrders,
      dominantGender: dominantGenderStr,
      dominantAge: dominantAgeStr,
      dominantContext: dominantCtxStr,
      avgTicket,
      topCategoryName,
      championProduct,
      avgReturnDays,
      fidelityLevel,
      totalRevenue,
    };
  }, [periodCustomers, checkins, orders, productAgg, productMap, custOrderStats]);

  // ══════════════════════════════════════════════════════
  // SEÇÃO 2: Perfil Demográfico
  // ══════════════════════════════════════════════════════
  const demographic = useMemo(() => {
    const genderCounts: Record<string, number> = {};
    const ageCounts: Record<string, number> = {};

    periodCustomers.forEach((c: any) => {
      const g = c.gender || "nao_informado";
      genderCounts[g] = (genderCounts[g] ?? 0) + 1;
      const a = c.age_range || "nao_informado";
      ageCounts[a] = (ageCounts[a] ?? 0) + 1;
    });

    const totalG = periodCustomers.length || 1;
    const genderDist = Object.entries(genderCounts)
      .map(([key, count]) => ({
        key,
        label: GENDER_LABELS[key] ?? key,
        count,
        pct: (count / totalG) * 100,
      }))
      .sort((a, b) => b.count - a.count);

    const totalA = periodCustomers.length || 1;
    const ageDist = Object.entries(ageCounts)
      .map(([key, count]) => ({
        key,
        label: AGE_RANGE_LABELS[key] ?? key,
        count,
        pct: (count / totalA) * 100,
      }))
      .sort((a, b) => b.count - a.count);

    // Check data sufficiency
    const informedGender = periodCustomers.filter(
      (c: any) => c.gender && c.gender !== "nao_informado",
    ).length;
    const informedAge = periodCustomers.filter(
      (c: any) => c.age_range && c.age_range !== "nao_informado",
    ).length;
    const genderDataPct = periodCustomers.length > 0 ? (informedGender / periodCustomers.length) * 100 : 0;
    const ageDataPct = periodCustomers.length > 0 ? (informedAge / periodCustomers.length) * 100 : 0;

    return { genderDist, ageDist, genderDataPct, ageDataPct };
  }, [periodCustomers]);

  // ══════════════════════════════════════════════════════
  // SEÇÃO 3: Perfil Comportamental
  // ══════════════════════════════════════════════════════
  const behavioral = useMemo(() => {
    // Visit context
    const contextCounts: Record<string, number> = {};
    checkins.forEach((c: any) => {
      const ctx = c.context || "desconhecido";
      contextCounts[ctx] = (contextCounts[ctx] ?? 0) + 1;
    });
    const dominantCtx = Object.entries(contextCounts).sort((a, b) => b[1] - a[1])[0];
    const dominantContext = dominantCtx ? dominantCtx[0] : "—";

    // Best hour
    const hourCounts: Record<number, number> = {};
    checkins.forEach((c: any) => {
      const h = new Date(c.created_at).getHours();
      hourCounts[h] = (hourCounts[h] ?? 0) + 1;
    });
    const peakHour = Object.entries(hourCounts).sort((a, b) => b[1] - a[1])[0];
    const bestHour = peakHour ? `${String(peakHour[0]).padStart(2, "0")}h` : "—";

    // Best day
    const dayCounts: Record<string, number> = {};
    checkins.forEach((c: any) => {
      const d = DAY_NAMES[new Date(c.created_at).getDay()];
      dayCounts[d] = (dayCounts[d] ?? 0) + 1;
    });
    const peakDay = Object.entries(dayCounts).sort((a, b) => b[1] - a[1])[0];
    const bestDay = peakDay ? peakDay[0] : "—";

    // Avg time between visits
    const custTimes: Record<string, string[]> = {};
    checkins.forEach((c: any) => {
      if (c.customer_id) {
        if (!custTimes[c.customer_id]) custTimes[c.customer_id] = [];
        custTimes[c.customer_id].push(c.created_at);
      }
    });
    let totalGapMs = 0;
    let gapCount = 0;
    Object.values(custTimes).forEach((times) => {
      times.sort();
      for (let i = 1; i < times.length; i++) {
        totalGapMs += new Date(times[i]).getTime() - new Date(times[i - 1]).getTime();
        gapCount++;
      }
    });
    const avgHoursBetweenVisits = gapCount > 0 ? totalGapMs / gapCount / 3600000 : null;

    // Dominant source
    const sourceCounts: Record<string, number> = {};
    checkins.forEach((c: any) => {
      const src = c.source || "desconhecido";
      sourceCounts[src] = (sourceCounts[src] ?? 0) + 1;
    });
    const dominantSrc = Object.entries(sourceCounts).sort((a, b) => b[1] - a[1])[0];
    const dominantSource = dominantSrc ? dominantSrc[0] : "—";

    // Most used table
    const tableCounts: Record<string, number> = {};
    checkins.forEach((c: any) => {
      if (c.table_id) {
        tableCounts[c.table_id] = (tableCounts[c.table_id] ?? 0) + 1;
      }
    });
    const dominantTable = Object.entries(tableCounts).sort((a, b) => b[1] - a[1])[0];
    const dominantTableLabel = dominantTable
      ? (tableMap.get(dominantTable[0]) ?? dominantTable[0])
      : "—";

    // Monthly frequency
    const months = PERIOD_MONTHS[period] || 1;
    const uniqueCustomersWithCheckins = Object.keys(custTimes).length;
    const monthlyFrequency =
      uniqueCustomersWithCheckins > 0 ? checkins.length / uniqueCustomersWithCheckins / months : null;

    // Avg stay duration (consecutive checkins within same visit, gap < 2h)
    let totalStayMs = 0;
    let stayCount = 0;
    Object.values(custTimes).forEach((times) => {
      times.sort();
      for (let i = 1; i < times.length; i++) {
        const gap = new Date(times[i]).getTime() - new Date(times[i - 1]).getTime();
        if (gap < 7200000) {
          // < 2 hours — same visit
          totalStayMs += gap;
          stayCount++;
        }
      }
    });
    const avgStayMinutes = stayCount > 0 ? totalStayMs / stayCount / 60000 : null;

    // Context that generates highest ticket
    const ctxStats: Record<string, { total: number; count: number }> = {};
    orders.forEach((o: any) => {
      const custCheckins = checkins.filter((c: any) => c.customer_id === o.customer_id);
      const ctx =
        custCheckins.length > 0 ? custCheckins[0].context || "desconhecido" : "sem contexto";
      if (!ctxStats[ctx]) ctxStats[ctx] = { total: 0, count: 0 };
      ctxStats[ctx].total += Number(o.total);
      ctxStats[ctx].count++;
    });
    const ctxTicketEntries = Object.entries(ctxStats)
      .map(([ctx, s]) => ({ ctx, avg: s.total / s.count, count: s.count }))
      .filter((e) => e.count >= 2)
      .sort((a, b) => b.avg - a.avg);
    const bestTicketCtx = ctxTicketEntries[0] ?? null;

    // Context with highest recurrence
    const ctxReturnRates: Record<string, { returned: number; total: number }> = {};
    Object.entries(custTimes).forEach(([cid, times]) => {
      if (times.length < 2) return;
      const firstCtx = checkins.find((c: any) => c.customer_id === cid)?.context || "desconhecido";
      if (!ctxReturnRates[firstCtx]) ctxReturnRates[firstCtx] = { returned: 0, total: 0 };
      ctxReturnRates[firstCtx].total++;
      ctxReturnRates[firstCtx].returned++;
    });
    const ctxRecurrenceEntries = Object.entries(ctxReturnRates)
      .map(([ctx, s]) => ({ ctx, rate: s.total > 0 ? (s.returned / s.total) * 100 : 0, count: s.total }))
      .filter((e) => e.count >= 2)
      .sort((a, b) => b.rate - a.rate);
    const bestRecurrenceCtx = ctxRecurrenceEntries[0] ?? null;

    // Context insight text
    let contextInsight: string | null = null;
    if (bestTicketCtx && bestTicketCtx.count >= 3) {
      const overallAvg =
        orders.length > 0
          ? orders.reduce((s: number, o: any) => s + Number(o.total), 0) / orders.length
          : 0;
      if (overallAvg > 0 && bestTicketCtx.avg > overallAvg * 1.1) {
        const pctHigher = ((bestTicketCtx.avg / overallAvg - 1) * 100).toFixed(0);
        contextInsight = `Clientes que visitam como "${bestTicketCtx.ctx}" possuem ticket médio ${pctHigher}% superior.`;
      }
    }

    return {
      dominantContext,
      bestHour,
      bestDay,
      avgHoursBetweenVisits,
      dominantSource,
      dominantTableLabel,
      monthlyFrequency,
      avgStayMinutes,
      bestTicketCtx,
      bestRecurrenceCtx,
      contextInsight,
    };
  }, [checkins, tableMap, orders]);

  // ══════════════════════════════════════════════════════
  // SEÇÃO 4: Perfil de Consumo
  // ══════════════════════════════════════════════════════
  const consumption = useMemo(() => {
    const totalRevenue = orders.reduce((s: number, o: any) => s + Number(o.total), 0);
    const avgTicket = orders.length > 0 ? totalRevenue / orders.length : 0;

    // LTV
    const ltvValues = Object.values(custOrderStats).map((s) => s.totalSpent);
    const avgLTV = ltvValues.length > 0 ? ltvValues.reduce((a, b) => a + b, 0) / ltvValues.length : 0;

    // ── Produto Campeão (most sold by qty) ──
    const championProd = Object.entries(productAgg.prodQty).sort((a, b) => b[1] - a[1])[0];
    const championProduct = championProd
      ? {
          name: productMap.get(championProd[0])?.name ?? "Desconhecido",
          qty: championProd[1],
          id: championProd[0],
        }
      : null;

    // ── Produto que mais fideliza (most recurring customers) ──
    const bestLoyaltyProd = Object.entries(productAgg.prodRecurringCusts)
      .map(([pid, s]) => ({ id: pid, name: productMap.get(pid)?.name ?? "Desconhecido", count: s.size }))
      .sort((a, b) => b.count - a.count)[0] ?? null;

    // ── Produto com maior ticket médio ──
    const bestTicketProd = Object.entries(productAgg.prodAvgTicket)
      .filter(([pid]) => (productAgg.prodCusts[pid]?.size ?? 0) >= 2)
      .sort((a, b) => b[1] - a[1])[0];
    const bestTicketProduct = bestTicketProd
      ? {
          name: productMap.get(bestTicketProd[0])?.name ?? "Desconhecido",
          avg: bestTicketProd[1],
        }
      : null;

    // ── Produto que gera maior recompra (highest revenue from repeat customers) ──
    const prodRepeatRevenue: Record<string, number> = {};
    orders.forEach((o: any) => {
      const cid = o.customer_id;
      if (!cid || (custOrderStats[cid]?.orderCount ?? 0) < 2) return;
      (o.order_items ?? []).forEach((i: any) => {
        const pid = i.product_id;
        const price = Number(i.unit_price ?? i.price ?? 0) * i.quantity;
        prodRepeatRevenue[pid] = (prodRepeatRevenue[pid] ?? 0) + price;
      });
    });
    const bestRepeatProd = Object.entries(prodRepeatRevenue).sort((a, b) => b[1] - a[1])[0];
    const bestRepeatProduct = bestRepeatProd
      ? {
          name: productMap.get(bestRepeatProd[0])?.name ?? "Desconhecido",
          revenue: bestRepeatProd[1],
        }
      : null;

    // ── Categoria Campeã ──
    const championCat = Object.entries(productAgg.catQty).sort((a, b) => b[1] - a[1])[0];

    // ── Categoria mais lucrativa ──
    const mostProfitableCat = Object.entries(productAgg.catRevenue).sort((a, b) => b[1] - a[1])[0];

    // ── Categoria com maior recorrência ──
    const catRecurringCusts: Record<string, Set<string>> = {};
    orders.forEach((o: any) => {
      const cid = o.customer_id;
      if (!cid || (custOrderStats[cid]?.orderCount ?? 0) < 2) return;
      (o.order_items ?? []).forEach((i: any) => {
        const p = productMap.get(i.product_id);
        const cat = p?.category || "Sem categoria";
        if (!catRecurringCusts[cat]) catRecurringCusts[cat] = new Set();
        catRecurringCusts[cat].add(cid);
      });
    });
    const bestRecurrenceCat = Object.entries(catRecurringCusts)
      .map(([cat, s]) => ({ name: cat, count: s.size }))
      .sort((a, b) => b.count - a.count)[0] ?? null;

    // Top 5 products/categories by qty
    const topProducts = Object.entries(productAgg.prodQty)
      .map(([pid, qty]) => ({ id: pid, name: productMap.get(pid)?.name ?? "Desconhecido", qty }))
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 5);

    const topCategories = Object.entries(productAgg.catQty)
      .map(([cat, qty]) => ({ name: cat, qty }))
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 5);

    const mostRecurringProducts = Object.entries(productAgg.prodCusts)
      .map(([pid, custSet]) => ({
        id: pid,
        name: productMap.get(pid)?.name ?? "Desconhecido",
        uniqueCustomers: custSet.size,
      }))
      .sort((a, b) => b.uniqueCustomers - a.uniqueCustomers)
      .slice(0, 5);

    const mostRecurringCats = Object.entries(productAgg.catCusts)
      .map(([cat, custSet]) => ({ name: cat, uniqueCustomers: custSet.size }))
      .sort((a, b) => b.uniqueCustomers - a.uniqueCustomers)
      .slice(0, 5);

    return {
      avgTicket,
      avgLTV,
      championProduct,
      bestLoyaltyProd,
      bestTicketProduct,
      bestRepeatProduct,
      championCat,
      mostProfitableCat,
      bestRecurrenceCat,
      topProducts,
      topCategories,
      mostRecurringProducts,
      mostRecurringCats,
    };
  }, [orders, productMap, productAgg, custOrderStats]);

  // ══════════════════════════════════════════════════════
  // SEÇÃO 5: Perfil de Engajamento
  // ══════════════════════════════════════════════════════
  const engagement = useMemo(() => {
    const viewers = new Set(
      events
        .filter((e: any) => e.event_type === "view")
        .map((e: any) => e.customer_id)
        .filter(Boolean),
    );
    const cartAddCust = new Set(
      events
        .filter((e: any) => e.event_type === "cart_add")
        .map((e: any) => e.customer_id)
        .filter(Boolean),
    );
    const orderCust = new Set(orders.map((o: any) => o.customer_id).filter(Boolean));

    const commenters = new Set((allComments ?? []).map((c: any) => c.customer_id).filter(Boolean));
    const posters = new Set(
      (allPosts ?? [])
        .filter((p: any) => p.customer_id)
        .map((p: any) => p.customer_id)
        .filter(Boolean),
    );

    const allSocial = new Set([...commenters, ...posters]);
    const onlyBuyers = new Set([...orderCust].filter((cid) => !allSocial.has(cid)));
    const interactAndBuy = new Set([...orderCust].filter((cid) => allSocial.has(cid)));

    // Silent customers: bought but never interacted
    const silentCustomers = new Set([...orderCust].filter((cid) => !allSocial.has(cid)));

    // Influencers: comment + share a lot (>= 3 interactions)
    const interactionCount: Record<string, number> = {};
    (allComments ?? []).forEach((c: any) => {
      if (c.customer_id) interactionCount[c.customer_id] = (interactionCount[c.customer_id] ?? 0) + 1;
    });
    (allPosts ?? []).forEach((p: any) => {
      if (p.customer_id) interactionCount[p.customer_id] = (interactionCount[p.customer_id] ?? 0) + 1;
    });
    const influencers = new Set(
      Object.entries(interactionCount)
        .filter(([, count]) => count >= 3)
        .map(([cid]) => cid),
    );

    // Promoters: interact + buy + return (>= 2 orders)
    const promoters = new Set(
      [...orderCust].filter(
        (cid) => allSocial.has(cid) && (custOrderStats[cid]?.orderCount ?? 0) >= 2,
      ),
    );

    return {
      viewers: viewers.size,
      cartAdds: cartAddCust.size,
      buyers: orderCust.size,
      commenters: commenters.size,
      posters: posters.size,
      onlyBuyers: onlyBuyers.size,
      interactAndBuy: interactAndBuy.size,
      silentCustomers: silentCustomers.size,
      influencers: influencers.size,
      promoters: promoters.size,
    };
  }, [events, orders, allComments, allPosts, custOrderStats]);

  // ══════════════════════════════════════════════════════
  // SEÇÃO 6: Segmentação Automática (RFM)
  // ══════════════════════════════════════════════════════
  const rfmSegments = useMemo(() => {
    const now = Date.now();
    const day = 86400000;

    const segments: Record<string, Set<string>> = {
      novo: new Set(),
      recorrente: new Set(),
      vip: new Set(),
      risco: new Set(),
      inativo: new Set(),
    };

    periodCustomers.forEach((c: any) => {
      const cid = c.id;
      const visitCount = c.visit_count ?? 0;
      const orderCount = custOrderStats[cid]?.orderCount ?? 0;
      const totalSpent = custOrderStats[cid]?.totalSpent ?? 0;
      const lastVisit = c.last_visit_at ? new Date(c.last_visit_at).getTime() : null;
      const daysSinceLastVisit = lastVisit ? (now - lastVisit) / day : null;

      if (daysSinceLastVisit != null && daysSinceLastVisit > 60) {
        segments.inativo.add(cid);
      } else if (daysSinceLastVisit != null && daysSinceLastVisit > 30) {
        segments.risco.add(cid);
      } else if (orderCount >= 5 || totalSpent > 1000) {
        segments.vip.add(cid);
      } else if (visitCount >= 2 || orderCount >= 1) {
        segments.recorrente.add(cid);
      } else {
        segments.novo.add(cid);
      }
    });

    const total = periodCustomers.length || 1;
    const segmentConfig: { key: string; label: string; color: string; icon: any }[] = [
      { key: "novo", label: "Cliente Novo", color: "border-blue-500/30 bg-blue-500/10", icon: UserPlus },
      { key: "recorrente", label: "Cliente Recorrente", color: "border-green-500/30 bg-green-500/10", icon: Activity },
      { key: "vip", label: "Cliente VIP", color: "border-yellow-500/30 bg-yellow-500/10", icon: Crown },
      { key: "risco", label: "Cliente em Risco", color: "border-orange-500/30 bg-orange-500/10", icon: AlertTriangle },
      { key: "inativo", label: "Cliente Inativo", color: "border-destructive/30 bg-destructive/10", icon: Zap },
    ];

    return segmentConfig.map((s) => ({
      ...s,
      count: segments[s.key].size,
      pct: (segments[s.key].size / total) * 100,
    }));
  }, [periodCustomers, custOrderStats]);

  // ══════════════════════════════════════════════════════
  // SEÇÃO 7: Jornada do Cliente
  // ══════════════════════════════════════════════════════
  const journey = useMemo(() => {
    const firstVisitCount = periodCustomers.filter((c: any) => (c.visit_count ?? 0) === 1).length;
    const firstOrderCount = Object.values(custOrderStats).filter((s) => s.orderCount === 1).length;
    const returningCount = Object.values(custOrderStats).filter(
      (s) => s.orderCount >= 2 && s.orderCount <= 4,
    ).length;
    const recorrenteCount = Object.values(custOrderStats).filter(
      (s) => s.orderCount >= 5 && s.orderCount <= 9,
    ).length;
    const vipCount = Object.values(custOrderStats).filter((s) => s.orderCount >= 10).length;

    const stages = [
      { label: "Primeira visita", count: firstVisitCount },
      { label: "Primeiro pedido", count: firstOrderCount },
      { label: "Primeiro retorno", count: returningCount },
      { label: "Cliente recorrente", count: recorrenteCount },
      { label: "Cliente VIP", count: vipCount },
    ];

    const maxStage = Math.max(...stages.map((s) => s.count), 1);

    // Evolution rates between stages
    const evolutionRates = stages.map((stage, i) => {
      if (i === 0) return { from: stage.label, to: stages[i + 1]?.label ?? "—", rate: null as number | null };
      const prev = stages[i - 1].count || 1;
      const rate = (stage.count / prev) * 100;
      return { from: stage.label, to: stages[i + 1]?.label ?? "—", rate };
    }).slice(0, -1);

    // Avg time to first order
    let totalFirstOrderDays = 0;
    let firstOrderWithDateCount = 0;
    periodCustomers.forEach((c: any) => {
      const firstVisitDate = c.first_visit_at;
      const firstOrderDate = custOrderStats[c.id]?.firstOrder;
      if (firstVisitDate && firstOrderDate) {
        const diff =
          (new Date(firstOrderDate).getTime() - new Date(firstVisitDate).getTime()) / 86400000;
        if (diff >= 0) {
          totalFirstOrderDays += diff;
          firstOrderWithDateCount++;
        }
      }
    });
    const avgDaysToFirstOrder =
      firstOrderWithDateCount > 0 ? totalFirstOrderDays / firstOrderWithDateCount : null;

    // Avg return days
    const custCheckinTimes: Record<string, string[]> = {};
    (allCheckins ?? []).forEach((c: any) => {
      if (c.customer_id) {
        if (!custCheckinTimes[c.customer_id]) custCheckinTimes[c.customer_id] = [];
        custCheckinTimes[c.customer_id].push(c.created_at);
      }
    });
    let totalCheckinGapDays = 0;
    let checkinGapCount = 0;
    Object.values(custCheckinTimes).forEach((times) => {
      times.sort();
      for (let i = 1; i < times.length; i++) {
        totalCheckinGapDays +=
          (new Date(times[i]).getTime() - new Date(times[i - 1]).getTime()) / 86400000;
        checkinGapCount++;
      }
    });
    const avgReturnDays = checkinGapCount > 0 ? totalCheckinGapDays / checkinGapCount : null;

    // Avg time to become recorrente
    const custOrderTimes: Record<string, string[]> = {};
    (allOrders ?? []).forEach((o: any) => {
      if (o.customer_id) {
        if (!custOrderTimes[o.customer_id]) custOrderTimes[o.customer_id] = [];
        custOrderTimes[o.customer_id].push(o.created_at);
      }
    });
    let totalVipDays = 0;
    let vipTimeCount = 0;
    Object.entries(custOrderTimes).forEach(([cid, times]) => {
      if (times.length >= 5) {
        times.sort();
        const cust = (customers ?? []).find((c: any) => c.id === cid);
        const firstVisitDate = cust?.first_visit_at;
        const fifthOrderDate = times[4];
        if (firstVisitDate && fifthOrderDate) {
          const diff =
            (new Date(fifthOrderDate).getTime() - new Date(firstVisitDate).getTime()) / 86400000;
          if (diff >= 0) {
            totalVipDays += diff;
            vipTimeCount++;
          }
        }
      }
    });
    const avgDaysToRecorrente = vipTimeCount > 0 ? totalVipDays / vipTimeCount : null;

    return {
      stages,
      maxStage,
      evolutionRates,
      avgDaysToFirstOrder,
      avgReturnDays,
      avgDaysToRecorrente,
    };
  }, [periodCustomers, allOrders, allCheckins, customers, custOrderStats]);

  // ══════════════════════════════════════════════════════
  // SEÇÃO 8: Oportunidades
  // ══════════════════════════════════════════════════════
  const opportunities = useMemo(() => {
    const list: {
      icon: any;
      title: string;
      description: string;
      type: "alert" | "positive" | "info";
    }[] = [];

    // 1. Context with higher ticket
    if (orders.length > 0 && behavioral.bestTicketCtx && behavioral.bestTicketCtx.count >= 3) {
      const overallAvg =
        orders.reduce((s: number, o: any) => s + Number(o.total), 0) / orders.length;
      const ctxAvg = behavioral.bestTicketCtx.avg;
      if (ctxAvg > overallAvg * 1.15) {
        const pctHigher = ((ctxAvg / overallAvg - 1) * 100).toFixed(0);
        list.push({
          icon: TrendingUp,
          title: `${behavioral.bestTicketCtx.ctx.charAt(0).toUpperCase() + behavioral.bestTicketCtx.ctx.slice(1)} possuem maior ticket médio`,
          description: `Clientes que vêm como "${behavioral.bestTicketCtx.ctx}" gastam em média ${formatBRL(ctxAvg)}, ${pctHigher}% acima da média geral de ${formatBRL(overallAvg)}.`,
          type: "positive",
        });
      }
    }

    // 2. Age range revenue contribution
    if (orders.length > 0 && customers) {
      const ageRevenue: Record<string, number> = {};
      const totalRev = orders.reduce((s: number, o: any) => s + Number(o.total), 0);
      orders.forEach((o: any) => {
        const cust = (customers ?? []).find((c: any) => c.id === o.customer_id);
        if (cust) {
          const ar = cust.age_range || "nao_informado";
          ageRevenue[ar] = (ageRevenue[ar] ?? 0) + Number(o.total);
        }
      });
      const dominantAgeRev = Object.entries(ageRevenue).sort((a, b) => b[1] - a[1])[0];
      if (dominantAgeRev && totalRev > 0) {
        const pct = (dominantAgeRev[1] / totalRev) * 100;
        const label = AGE_RANGE_LABELS[dominantAgeRev[0]] ?? dominantAgeRev[0];
        if (pct > 25) {
          list.push({
            icon: BarChart3,
            title: `Clientes ${label} representam ${pct.toFixed(0)}% da receita`,
            description: `Esta faixa etária gerou ${formatBRL(dominantAgeRev[1])} do total de ${formatBRL(totalRev)}.`,
            type: "info",
          });
        }
      }
    }

    // 3. Cart conversion rate
    const cartAddCust = new Set(
      events
        .filter((e: any) => e.event_type === "cart_add")
        .map((e: any) => e.customer_id)
        .filter(Boolean),
    );
    const orderCust = new Set(orders.map((o: any) => o.customer_id).filter(Boolean));
    const cartToOrder = Array.from(cartAddCust).filter((cid) => orderCust.has(cid)).length;
    const cartConversionRate = cartAddCust.size > 0 ? (cartToOrder / cartAddCust.size) * 100 : 0;
    if (cartAddCust.size > 0) {
      list.push({
        icon: ShoppingCart,
        title: `${cartConversionRate.toFixed(0)}% dos clientes que adicionam à sacola efetuam pedido`,
        description: `${cartToOrder} de ${cartAddCust.size} clientes que adicionaram à sacola concluíram a compra.`,
        type: cartConversionRate > 50 ? "positive" : "alert",
      });
    }

    // 4. Commenters return more
    const commenterIds = new Set(
      (allComments ?? []).map((c: any) => c.customer_id).filter(Boolean),
    );
    if (commenterIds.size > 0 && checkins.length > 0) {
      const commenterCheckinGaps: number[] = [];
      const nonCommenterCheckinGaps: number[] = [];
      const custTimes: Record<string, string[]> = {};
      checkins.forEach((c: any) => {
        if (c.customer_id) {
          if (!custTimes[c.customer_id]) custTimes[c.customer_id] = [];
          custTimes[c.customer_id].push(c.created_at);
        }
      });
      Object.entries(custTimes).forEach(([cid, times]) => {
        times.sort();
        for (let i = 1; i < times.length; i++) {
          const gap = (new Date(times[i]).getTime() - new Date(times[i - 1]).getTime()) / 86400000;
          if (commenterIds.has(cid)) {
            commenterCheckinGaps.push(gap);
          } else {
            nonCommenterCheckinGaps.push(gap);
          }
        }
      });
      const avgCommenterGap =
        commenterCheckinGaps.length > 0
          ? commenterCheckinGaps.reduce((a, b) => a + b, 0) / commenterCheckinGaps.length
          : null;
      const avgNonCommenterGap =
        nonCommenterCheckinGaps.length > 0
          ? nonCommenterCheckinGaps.reduce((a, b) => a + b, 0) / nonCommenterCheckinGaps.length
          : null;
      if (
        avgCommenterGap != null &&
        avgNonCommenterGap != null &&
        avgCommenterGap < avgNonCommenterGap * 0.85
      ) {
        list.push({
          icon: MessageCircle,
          title: "Clientes que comentam retornam mais",
          description: `Clientes que comentam retornam em média a cada ${avgCommenterGap.toFixed(1)} dias, contra ${avgNonCommenterGap.toFixed(1)} dias dos que não comentam.`,
          type: "positive",
        });
      }
    }

    // 5. Most profitable category insight
    if (consumption.mostProfitableCat && orders.length > 0) {
      const cat = consumption.mostProfitableCat[0];
      const revenue = consumption.mostProfitableCat[1];
      const totalRev = orders.reduce((s: number, o: any) => s + Number(o.total), 0);
      const pct = (revenue / totalRev) * 100;
      if (pct > 20) {
        list.push({
          icon: Star,
          title: `Categoria "${cat}" é a mais lucrativa`,
          description: `Representa ${pct.toFixed(0)}% do faturamento total (${formatBRL(revenue)}).`,
          type: "info",
        });
      }
    }

    // 6. Product that drives highest ticket
    if (consumption.bestTicketProduct) {
      list.push({
        icon: Target,
        title: `"${consumption.bestTicketProduct.name}" gera o maior ticket médio`,
        description: `Cada cliente que compra este produto gasta em média ${formatBRL(consumption.bestTicketProduct.avg)}.`,
        type: "info",
      });
    }

    // 7. Fidelity insight
    if (consumption.bestLoyaltyProd) {
      list.push({
        icon: Repeat,
        title: `"${consumption.bestLoyaltyProd.name}" mais fideliza clientes`,
        description: `${consumption.bestLoyaltyProd.count} clientes recorrentes já compraram este produto.`,
        type: "positive",
      });
    }

    // 8. Silent customers warning
    if (engagement.silentCustomers > 0 && engagement.buyers > 0) {
      const silentPct = (engagement.silentCustomers / engagement.buyers) * 100;
      if (silentPct > 50) {
        list.push({
          icon: AlertTriangle,
          title: `${silentPct.toFixed(0)}% dos clientes nunca interagem`,
          description: `${engagement.silentCustomers} de ${engagement.buyers} clientes compram mas nunca comentam ou compartilham. Considere incentivar a interação.`,
          type: "alert",
        });
      }
    }

    // 9. Influencers value
    if (engagement.influencers > 0 && engagement.buyers > 0) {
      const influencerPct = (engagement.influencers / engagement.buyers) * 100;
      list.push({
        icon: Share2,
        title: `${engagement.influencers} clientes influenciadores (${influencerPct.toFixed(0)}% da base)`,
        description: `Estes clientes comentam e compartilham frequentemente, gerando visibilidade orgânica para o negócio.`,
        type: "positive",
      });
    }

    // 10. Promoters insight
    if (engagement.promoters > 0) {
      list.push({
        icon: Heart,
        title: `${engagement.promoters} clientes promotores`,
        description: `Interagem, compram e retornam. São os clientes mais valiosos para o crescimento sustentável.`,
        type: "positive",
      });
    }

    return list;
  }, [orders, checkins, events, customers, allComments, behavioral, consumption, engagement]);

  // ══════════════════════════════════════════════════════
  // SEÇÃO 9: Perfil do Cliente Ideal (NOVA)
  // ══════════════════════════════════════════════════════
  const idealClient = useMemo(() => {
    if (periodCustomers.length === 0 || orders.length === 0) return null;

    const totalRevenue = orders.reduce((s: number, o: any) => s + Number(o.total), 0);

    // Revenue share of top gender + age combo
    const comboRevenue: Record<string, number> = {};
    orders.forEach((o: any) => {
      const cust = (customers ?? []).find((c: any) => c.id === o.customer_id);
      if (cust) {
        const key = `${cust.gender || "nao_informado"}|${cust.age_range || "nao_informado"}`;
        comboRevenue[key] = (comboRevenue[key] ?? 0) + Number(o.total);
      }
    });
    const topCombo = Object.entries(comboRevenue).sort((a, b) => b[1] - a[1])[0];
    const topComboRevenuePct = topCombo ? (topCombo[1] / totalRevenue) * 100 : 0;
    const [topGender, topAge] = topCombo ? topCombo[0].split("|") : ["—", "—"];

    // Context of top revenue customers
    const topCustomers = new Set(
      orders
        .sort((a: any, b: any) => Number(b.total) - Number(a.total))
        .slice(0, Math.ceil(orders.length * 0.3))
        .map((o: any) => o.customer_id)
        .filter(Boolean),
    );
    const topCtxCounts: Record<string, number> = {};
    checkins.forEach((c: any) => {
      if (topCustomers.has(c.customer_id)) {
        const ctx = c.context || "desconhecido";
        topCtxCounts[ctx] = (topCtxCounts[ctx] ?? 0) + 1;
      }
    });
    const idealContext = Object.entries(topCtxCounts).sort((a, b) => b[1] - a[1])[0];

    // Best hour for top customers
    const topHourCounts: Record<number, number> = {};
    checkins.forEach((c: any) => {
      if (topCustomers.has(c.customer_id)) {
        const h = new Date(c.created_at).getHours();
        topHourCounts[h] = (topHourCounts[h] ?? 0) + 1;
      }
    });
    const idealHour = Object.entries(topHourCounts).sort((a, b) => b[1] - a[1])[0];

    // Best day for top customers
    const topDayCounts: Record<string, number> = {};
    checkins.forEach((c: any) => {
      if (topCustomers.has(c.customer_id)) {
        const d = DAY_NAMES[new Date(c.created_at).getDay()];
        topDayCounts[d] = (topDayCounts[d] ?? 0) + 1;
      }
    });
    const idealDay = Object.entries(topDayCounts).sort((a, b) => b[1] - a[1])[0];

    // Ticket for top customers
    const topOrderTotals = orders
      .filter((o: any) => topCustomers.has(o.customer_id))
      .map((o: any) => Number(o.total));
    const idealTicket =
      topOrderTotals.length > 0
        ? topOrderTotals.reduce((a, b) => a + b, 0) / topOrderTotals.length
        : 0;

    // Frequency for top customers
    const topCustIds = Array.from(topCustomers);
    const topFreqs = topCustIds
      .map((cid) => custOrderStats[cid]?.orderCount ?? 0)
      .filter((n) => n > 0);
    const idealFrequency =
      topFreqs.length > 0 ? topFreqs.reduce((a, b) => a + b, 0) / topFreqs.length : 0;

    // Time between visits for top customers
    const topCustTimes: Record<string, string[]> = {};
    checkins.forEach((c: any) => {
      if (topCustomers.has(c.customer_id)) {
        if (!topCustTimes[c.customer_id]) topCustTimes[c.customer_id] = [];
        topCustTimes[c.customer_id].push(c.created_at);
      }
    });
    let topGapDays = 0;
    let topGapCount = 0;
    Object.values(topCustTimes).forEach((times) => {
      times.sort();
      for (let i = 1; i < times.length; i++) {
        topGapDays +=
          (new Date(times[i]).getTime() - new Date(times[i - 1]).getTime()) / 86400000;
        topGapCount++;
      }
    });
    const idealReturnInterval = topGapCount > 0 ? topGapDays / topGapCount : null;

    // Favorite category for top customers
    const topCatCounts: Record<string, number> = {};
    orders.forEach((o: any) => {
      if (!topCustomers.has(o.customer_id)) return;
      (o.order_items ?? []).forEach((i: any) => {
        const p = productMap.get(i.product_id);
        const cat = p?.category || "Sem categoria";
        topCatCounts[cat] = (topCatCounts[cat] ?? 0) + i.quantity;
      });
    });
    const idealCategory = Object.entries(topCatCounts).sort((a, b) => b[1] - a[1])[0];

    // Favorite product for top customers
    const topProdCounts: Record<string, number> = {};
    orders.forEach((o: any) => {
      if (!topCustomers.has(o.customer_id)) return;
      (o.order_items ?? []).forEach((i: any) => {
        topProdCounts[i.product_id] = (topProdCounts[i.product_id] ?? 0) + i.quantity;
      });
    });
    const idealProduct = Object.entries(topProdCounts).sort((a, b) => b[1] - a[1])[0];

    // Fidelity level
    const topRecurring = topCustIds.filter((cid) => (custOrderStats[cid]?.orderCount ?? 0) >= 2).length;
    const topFidelityPct = topCustIds.length > 0 ? (topRecurring / topCustIds.length) * 100 : 0;

    // Return probability
    const returningTop = topCustIds.filter((cid) => (custOrderStats[cid]?.orderCount ?? 0) >= 2).length;
    const returnProb = topCustIds.length > 0 ? (returningTop / topCustIds.length) * 100 : 0;

    return {
      revenuePct: topComboRevenuePct,
      gender: GENDER_LABELS[topGender] ?? topGender,
      ageRange: AGE_RANGE_LABELS[topAge] ?? topAge,
      context: idealContext ? idealContext[0] : "—",
      hour: idealHour ? `${String(idealHour[0]).padStart(2, "0")}h` : "—",
      day: idealDay ? idealDay[0] : "—",
      ticket: idealTicket,
      frequency: idealFrequency,
      returnInterval: idealReturnInterval,
      category: idealCategory ? idealCategory[0] : "—",
      product: idealProduct ? (productMap.get(idealProduct[0])?.name ?? "—") : "—",
      fidelityPct: topFidelityPct,
      returnProb,
    };
  }, [periodCustomers, orders, checkins, customers, productMap, custOrderStats]);

  // ══════════════════════════════════════════════════════
  // SEÇÃO 10: Resumo Inteligente
  // ══════════════════════════════════════════════════════
  const smartSummary = useMemo(() => {
    const g = summary.dominantGender;
    const a = summary.dominantAge;
    const ctx = summary.dominantContext;
    const day = behavioral.bestDay;
    const hour = behavioral.bestHour;
    const ticket = summary.avgTicket;
    const returnDays = summary.avgReturnDays;
    const topCat = summary.topCategoryName;
    const champion = summary.championProduct;
    const fidelity = summary.fidelityLevel;
    const months = PERIOD_MONTHS[period] || 1;
    const periodLabel =
      period === "today"
        ? "hoje"
        : period === "7d"
          ? "últimos 7 dias"
          : period === "30d"
            ? "últimos 30 dias"
            : period === "90d"
              ? "últimos 90 dias"
              : "este ano";

    const sentences: string[] = [];

    // Opening
    sentences.push(
      `A análise dos ${periodLabel} demonstra que o principal público deste estabelecimento é formado por`,
    );

    if (g !== "—") {
      sentences.push(`${g.toLowerCase()}`);
    } else {
      sentences.push("diversos perfis de clientes");
    }

    if (a !== "—") {
      sentences.push(`entre ${a.toLowerCase()}`);
    }

    sentences.push("que costumam visitar o local");

    if (ctx !== "—") {
      sentences.push(`em contexto de ${ctx}`);
    }

    if (day !== "—" || hour !== "—") {
      const timeParts: string[] = [];
      if (day !== "—") timeParts.push(`no${day === "segunda" || day === "terça" || day === "quarta" || day === "quinta" ? "" : ""} ${day}`);
      if (hour !== "—") timeParts.push(`às ${hour}`);
      if (timeParts.length > 0) sentences.push(`principalmente ${timeParts.join(" ")}`);
    }
    sentences.push(".");

    // Ticket and revenue
    if (ticket > 0) {
      sentences.push(`Apresentam ticket médio de ${formatBRL(ticket)}`);
      if (summary.totalRevenue > 0) {
        sentences.push(
          `e foram responsáveis por ${formatBRL(summary.totalRevenue)} em faturamento no período.`,
        );
      } else {
        sentences.push(".");
      }
    }

    // Return frequency
    if (returnDays != null) {
      sentences.push(
        `Retornam ao estabelecimento em média a cada ${returnDays.toFixed(0)} dias.`,
      );
    }

    // Monthly frequency
    if (behavioral.monthlyFrequency != null && behavioral.monthlyFrequency > 0) {
      sentences.push(
        `A frequência média mensal é de ${behavioral.monthlyFrequency.toFixed(1)} visitas por cliente.`,
      );
    }

    // Category and product preference
    if (topCat && topCat !== "—") {
      sentences.push(
        `Apresentam preferência pela categoria "${topCat}"`,
      );
      if (champion && champion !== "—") {
        sentences.push(`sendo "${champion}" o produto mais consumido.`);
      } else {
        sentences.push(".");
      }
    }

    // Context insight
    if (behavioral.contextInsight) {
      sentences.push(behavioral.contextInsight);
    }

    // Fidelity
    sentences.push(
      `O nível de fidelização da base é ${fidelity.toLowerCase()}, com ${summary.avgReturnDays != null ? `retornos a cada ${summary.avgReturnDays.toFixed(0)} dias` : "poucos dados de retorno até o momento"}.`,
    );

    return sentences.join(" ");
  }, [summary, behavioral, period]);

  if (!companyId)
    return <div className="py-8 text-center text-muted-foreground">Carregando...</div>;

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Persona Inteligente</h1>
          <p className="text-sm text-muted-foreground">
            Análise coletiva do perfil dos seus clientes
          </p>
        </div>
        <PeriodSelector current={period} onChange={setPeriod} />
      </div>

      {/* ── SEÇÃO 1: Resumo Executivo ── */}
      <Section title="Resumo Executivo">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <MetricCard
            icon={Users}
            label="Base analisada"
            value={`${summary.totalCustomers} clientes · ${summary.totalCheckins} checkins · ${summary.totalOrders} pedidos`}
          />
          <MetricCard
            icon={Target}
            label="Persona principal"
            value={`${summary.dominantGender} · ${summary.dominantAge} · ${summary.dominantContext}`}
          />
          <MetricCard icon={TrendingUp} label="Ticket médio" value={formatBRL(summary.avgTicket)} />
          <MetricCard
            icon={Star}
            label="Categoria favorita"
            value={summary.topCategoryName}
          />
          <MetricCard
            icon={Package}
            label="Produto campeão"
            value={summary.championProduct}
          />
          <MetricCard
            icon={Activity}
            label="Nível de fidelização"
            value={summary.fidelityLevel}
          />
        </div>
      </Section>

      {/* ── SEÇÃO 2: Perfil Demográfico ── */}
      <Section title="Perfil Demográfico">
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl border bg-card p-4">
            <h3 className="mb-3 text-sm font-semibold">Distribuição por sexo</h3>
            <div className="space-y-2">
              {demographic.genderDist.length > 0 ? (
                demographic.genderDist.map((g) => {
                  const maxCount = Math.max(...demographic.genderDist.map((x) => x.count), 1);
                  const pct = (g.count / maxCount) * 100;
                  return (
                    <div key={g.key}>
                      <div className="mb-1 flex items-center justify-between text-xs">
                        <span className="font-medium">{g.label}</span>
                        <span className="text-muted-foreground">
                          {g.count} clientes ({g.pct.toFixed(1)}%)
                        </span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-muted">
                        <div className="h-2 rounded-full bg-primary" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })
              ) : (
                <p className="text-xs text-muted-foreground">Sem dados de sexo no período.</p>
              )}
            </div>
            {demographic.genderDataPct < 50 && periodCustomers.length > 0 && (
              <p className="mt-3 rounded-lg bg-muted/50 p-2 text-xs text-muted-foreground">
                Quanto mais clientes informarem esses dados, mais precisa será a Persona Inteligente.
              </p>
            )}
          </div>
          <div className="rounded-xl border bg-card p-4">
            <h3 className="mb-3 text-sm font-semibold">Distribuição por faixa etária</h3>
            <div className="space-y-2">
              {demographic.ageDist.length > 0 ? (
                demographic.ageDist.map((a) => {
                  const maxCount = Math.max(...demographic.ageDist.map((x) => x.count), 1);
                  const pct = (a.count / maxCount) * 100;
                  return (
                    <div key={a.key}>
                      <div className="mb-1 flex items-center justify-between text-xs">
                        <span className="font-medium">{a.label}</span>
                        <span className="text-muted-foreground">
                          {a.count} clientes ({a.pct.toFixed(1)}%)
                        </span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-muted">
                        <div className="h-2 rounded-full bg-primary" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })
              ) : (
                <p className="text-xs text-muted-foreground">
                  Sem dados de faixa etária no período.
                </p>
              )}
            </div>
            {demographic.ageDataPct < 50 && periodCustomers.length > 0 && (
              <p className="mt-3 rounded-lg bg-muted/50 p-2 text-xs text-muted-foreground">
                Quanto mais clientes informarem esses dados, mais precisa será a Persona Inteligente.
              </p>
            )}
          </div>
        </div>
      </Section>

      {/* ── SEÇÃO 3: Perfil Comportamental ── */}
      <Section title="Perfil Comportamental">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <MetricCard
            icon={Users}
            label="Tipo de visita predominante"
            value={behavioral.dominantContext}
          />
          <MetricCard icon={Clock} label="Melhor horário" value={behavioral.bestHour} />
          <MetricCard icon={Calendar} label="Melhor dia" value={behavioral.bestDay} />
          <MetricCard
            icon={Clock}
            label="Tempo médio entre visitas"
            value={
              behavioral.avgHoursBetweenVisits != null
                ? `${behavioral.avgHoursBetweenVisits.toFixed(1)}h`
                : "—"
            }
          />
          <MetricCard
            icon={ScanLine}
            label="Origem predominante"
            value={behavioral.dominantSource}
          />
          <MetricCard
            icon={Package}
            label="Mesa mais utilizada"
            value={behavioral.dominantTableLabel}
          />
          <MetricCard
            icon={Clock}
            label="Tempo médio de permanência"
            value={
              behavioral.avgStayMinutes != null
                ? `${behavioral.avgStayMinutes.toFixed(0)} min`
                : "—"
            }
          />
          <MetricCard
            icon={Repeat}
            label="Frequência média mensal"
            value={
              behavioral.monthlyFrequency != null
                ? `${behavioral.monthlyFrequency.toFixed(1)}x`
                : "—"
            }
          />
        </div>
        {behavioral.contextInsight && (
          <div className="mt-3 rounded-xl border border-primary/20 bg-primary/5 p-4">
            <div className="flex items-start gap-2">
              <Lightbulb className="mt-0.5 size-4 shrink-0 text-primary" />
              <p className="text-xs leading-relaxed text-foreground">{behavioral.contextInsight}</p>
            </div>
          </div>
        )}
        {behavioral.bestTicketCtx && behavioral.bestTicketCtx.count >= 3 && (
          <div className="mt-2 rounded-xl border bg-card p-4">
            <h3 className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
              Ticket por tipo de visita
            </h3>
            <div className="space-y-1">
              {Object.entries(
                (() => {
                  const ctxStats: Record<string, { total: number; count: number }> = {};
                  orders.forEach((o: any) => {
                    const custCheckins = checkins.filter((c: any) => c.customer_id === o.customer_id);
                    const ctx = custCheckins.length > 0 ? custCheckins[0].context || "desconhecido" : "sem contexto";
                    if (!ctxStats[ctx]) ctxStats[ctx] = { total: 0, count: 0 };
                    ctxStats[ctx].total += Number(o.total);
                    ctxStats[ctx].count++;
                  });
                  return ctxStats;
                })(),
              )
                .map(([ctx, s]) => ({ ctx, avg: s.total / s.count, count: s.count }))
                .filter((e) => e.count >= 2)
                .sort((a, b) => b.avg - a.avg)
                .slice(0, 5)
                .map((e) => (
                  <div key={e.ctx} className="flex justify-between text-xs">
                    <span className="truncate">{e.ctx}</span>
                    <span className="ml-2 shrink-0 font-semibold">
                      {formatBRL(e.avg)} ({e.count} pedidos)
                    </span>
                  </div>
                ))}
            </div>
          </div>
        )}
      </Section>

      {/* ── SEÇÃO 4: Perfil de Consumo ── */}
      <Section title="Perfil de Consumo">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <MetricCard
            icon={TrendingUp}
            label="Ticket médio"
            value={formatBRL(consumption.avgTicket)}
          />
          <MetricCard icon={Crown} label="LTV médio" value={formatBRL(consumption.avgLTV)} />
        </div>

        {/* Produto Campeão + Fideliza + Ticket + Recompra */}
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/5 p-4">
            <div className="mb-1 flex items-center gap-1.5">
              <Star className="size-3.5 text-yellow-600" />
              <h3 className="text-xs font-semibold uppercase text-muted-foreground">Produto Campeão</h3>
            </div>
            {consumption.championProduct ? (
              <p className="text-sm font-bold">{consumption.championProduct.name}</p>
            ) : (
              <p className="text-xs text-muted-foreground">Sem dados.</p>
            )}
          </div>
          <div className="rounded-xl border border-green-500/30 bg-green-500/5 p-4">
            <div className="mb-1 flex items-center gap-1.5">
              <Repeat className="size-3.5 text-green-600" />
              <h3 className="text-xs font-semibold uppercase text-muted-foreground">Mais fideliza</h3>
            </div>
            {consumption.bestLoyaltyProd ? (
              <p className="text-sm font-bold">{consumption.bestLoyaltyProd.name}</p>
            ) : (
              <p className="text-xs text-muted-foreground">Sem dados.</p>
            )}
          </div>
          <div className="rounded-xl border border-blue-500/30 bg-blue-500/5 p-4">
            <div className="mb-1 flex items-center gap-1.5">
              <TrendingUp className="size-3.5 text-blue-600" />
              <h3 className="text-xs font-semibold uppercase text-muted-foreground">Maior ticket</h3>
            </div>
            {consumption.bestTicketProduct ? (
              <>
                <p className="text-sm font-bold">{consumption.bestTicketProduct.name}</p>
                <p className="text-xs text-muted-foreground">{formatBRL(consumption.bestTicketProduct.avg)}</p>
              </>
            ) : (
              <p className="text-xs text-muted-foreground">Sem dados.</p>
            )}
          </div>
          <div className="rounded-xl border border-purple-500/30 bg-purple-500/5 p-4">
            <div className="mb-1 flex items-center gap-1.5">
              <UserCheck className="size-3.5 text-purple-600" />
              <h3 className="text-xs font-semibold uppercase text-muted-foreground">Gera recompra</h3>
            </div>
            {consumption.bestRepeatProduct ? (
              <p className="text-sm font-bold">{consumption.bestRepeatProduct.name}</p>
            ) : (
              <p className="text-xs text-muted-foreground">Sem dados.</p>
            )}
          </div>
        </div>

        {/* Categorias Campeã + Lucrativa + Recorrência */}
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border bg-card p-4">
            <h3 className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Categoria Campeã</h3>
            {consumption.championCat ? (
              <p className="text-sm font-bold">{consumption.championCat[0]}</p>
            ) : (
              <p className="text-xs text-muted-foreground">Sem dados.</p>
            )}
          </div>
          <div className="rounded-xl border bg-card p-4">
            <h3 className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Categoria mais lucrativa</h3>
            {consumption.mostProfitableCat ? (
              <>
                <p className="text-sm font-bold">{consumption.mostProfitableCat[0]}</p>
                <p className="text-xs text-muted-foreground">{formatBRL(consumption.mostProfitableCat[1])}</p>
              </>
            ) : (
              <p className="text-xs text-muted-foreground">Sem dados.</p>
            )}
          </div>
          <div className="rounded-xl border bg-card p-4">
            <h3 className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Categoria com maior recorrência</h3>
            {consumption.bestRecurrenceCat ? (
              <p className="text-sm font-bold">{consumption.bestRecurrenceCat.name}</p>
            ) : (
              <p className="text-xs text-muted-foreground">Sem dados.</p>
            )}
          </div>
        </div>

        {/* Top 5s */}
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-xl border bg-card p-4">
            <h3 className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
              Top 5 produtos por volume
            </h3>
            {consumption.topProducts.length > 0 ? (
              <div className="space-y-1">
                {consumption.topProducts.map((p, i) => (
                  <div key={p.id} className="flex justify-between text-xs">
                    <span className="truncate">
                      {i + 1}. {p.name}
                    </span>
                    <span className="ml-2 shrink-0 font-semibold">{p.qty} uni</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">Sem dados.</p>
            )}
          </div>
          <div className="rounded-xl border bg-card p-4">
            <h3 className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
              Top 5 categorias por volume
            </h3>
            {consumption.topCategories.length > 0 ? (
              <div className="space-y-1">
                {consumption.topCategories.map((c, i) => (
                  <div key={c.name} className="flex justify-between text-xs">
                    <span className="truncate">
                      {i + 1}. {c.name}
                    </span>
                    <span className="ml-2 shrink-0 font-semibold">{c.qty} uni</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">Sem dados.</p>
            )}
          </div>
          <div className="rounded-xl border bg-card p-4">
            <h3 className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
              Produtos com maior recorrência
            </h3>
            {consumption.mostRecurringProducts.length > 0 ? (
              <div className="space-y-1">
                {consumption.mostRecurringProducts.map((p, i) => (
                  <div key={p.id} className="flex justify-between text-xs">
                    <span className="truncate">
                      {i + 1}. {p.name}
                    </span>
                    <span className="ml-2 shrink-0 font-semibold">
                      {p.uniqueCustomers} clientes
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">Sem dados.</p>
            )}
          </div>
          <div className="rounded-xl border bg-card p-4">
            <h3 className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
              Categorias com maior recorrência
            </h3>
            {consumption.mostRecurringCats.length > 0 ? (
              <div className="space-y-1">
                {consumption.mostRecurringCats.map((c, i) => (
                  <div key={c.name} className="flex justify-between text-xs">
                    <span className="truncate">
                      {i + 1}. {c.name}
                    </span>
                    <span className="ml-2 shrink-0 font-semibold">
                      {c.uniqueCustomers} clientes
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">Sem dados.</p>
            )}
          </div>
        </div>
      </Section>

      {/* ── SEÇÃO 5: Perfil de Engajamento ── */}
      <Section title="Perfil de Engajamento">
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="rounded-xl border bg-card p-4">
            <h3 className="mb-3 text-sm font-semibold">Funil de Conversão</h3>
            {[
              { label: "Visualizadores", value: engagement.viewers, icon: Eye },
              { label: "Adicionaram à Sacola", value: engagement.cartAdds, icon: ShoppingCart },
              { label: "Pedidos", value: engagement.buyers, icon: Package },
            ].map((step, i, arr) => {
              const maxVal = Math.max(...arr.map((s) => s.value), 1);
              const barWidth = (step.value / maxVal) * 100;
              return (
                <div key={step.label} className="mb-3">
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1">
                      <step.icon className="size-3 text-primary" />
                      {step.label}
                    </span>
                    <span className="font-semibold">{step.value}</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-muted">
                    <div
                      className="h-2 rounded-full bg-primary"
                      style={{ width: `${barWidth}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          <div className="rounded-xl border bg-card p-4">
            <h3 className="mb-3 text-sm font-semibold">Perfis de Comportamento</h3>
            <div className="space-y-2">
              <div className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2 text-xs">
                <span className="flex items-center gap-1">
                  <Zap className="size-3 text-orange-500" /> Clientes silenciosos
                </span>
                <span className="font-semibold">{engagement.silentCustomers}</span>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2 text-xs">
                <span className="flex items-center gap-1">
                  <Share2 className="size-3 text-blue-500" /> Clientes influenciadores
                </span>
                <span className="font-semibold">{engagement.influencers}</span>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2 text-xs">
                <span className="flex items-center gap-1">
                  <Heart className="size-3 text-pink-500" /> Clientes promotores
                </span>
                <span className="font-semibold">{engagement.promoters}</span>
              </div>
            </div>
          </div>
          <div className="rounded-xl border bg-card p-4">
            <h3 className="mb-3 text-sm font-semibold">Comportamento Social</h3>
            <div className="space-y-2">
              <div className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2 text-xs">
                <span className="flex items-center gap-1">
                  <MessageCircle className="size-3 text-primary" /> Clientes que comentam
                </span>
                <span className="font-semibold">{engagement.commenters}</span>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2 text-xs">
                <span className="flex items-center gap-1">
                  <Share2 className="size-3 text-primary" /> Clientes que compartilham
                </span>
                <span className="font-semibold">{engagement.posters}</span>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2 text-xs">
                <span className="flex items-center gap-1">
                  <ShoppingCart className="size-3 text-primary" /> Apenas compram
                </span>
                <span className="font-semibold">{engagement.onlyBuyers}</span>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2 text-xs">
                <span className="flex items-center gap-1">
                  <Heart className="size-3 text-primary" /> Interagem e compram
                </span>
                <span className="font-semibold">{engagement.interactAndBuy}</span>
              </div>
            </div>
          </div>
        </div>
      </Section>

      {/* ── SEÇÃO 6: Segmentação Automática (RFM) ── */}
      <Section title="Segmentação Automática (RFM)">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {rfmSegments.map((seg) => (
            <div key={seg.key} className={`rounded-xl border p-4 ${seg.color}`}>
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold">{seg.label}</span>
                <seg.icon className="size-4" />
              </div>
              <div className="mt-1 text-2xl font-bold">{seg.count}</div>
              <div className="text-xs text-muted-foreground">{seg.pct.toFixed(1)}% da base</div>
            </div>
          ))}
        </div>
      </Section>

      {/* ── SEÇÃO 7: Jornada do Cliente ── */}
      <Section title="Jornada do Cliente">
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl border bg-card p-4">
            <h3 className="mb-3 text-sm font-semibold">Funil de Evolução</h3>
            <div className="space-y-1">
              {journey.stages.map((stage, i) => {
                const barWidth = (stage.count / journey.maxStage) * 100;
                const isFirst = i === 0;
                return (
                  <div key={stage.label}>
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className="font-medium">{stage.label}</span>
                      <span className="font-semibold">{stage.count}</span>
                    </div>
                    <div className="h-3 w-full rounded-full bg-muted">
                      <div
                        className="h-3 rounded-full bg-primary"
                        style={{ width: `${barWidth}%` }}
                      />
                    </div>
                    {!isFirst && journey.evolutionRates[i - 1]?.rate != null && (
                      <div className="mb-2 mt-0.5 flex items-center gap-1 text-[10px] text-muted-foreground">
                        <ArrowDown className="size-2.5" />
                        <span>
                          {journey.evolutionRates[i - 1].rate!.toFixed(0)}% evoluem para esta etapa
                        </span>
                      </div>
                    )}
                    {isFirst && <div className="mb-2" />}
                  </div>
                );
              })}
            </div>
          </div>
          <div className="rounded-xl border bg-card p-4">
            <h3 className="mb-3 text-sm font-semibold">Tempos Médios</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2 text-xs">
                <span>Tempo médio até primeiro pedido</span>
                <span className="font-semibold">
                  {journey.avgDaysToFirstOrder != null
                    ? `${journey.avgDaysToFirstOrder.toFixed(1)} dias`
                    : "—"}
                </span>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2 text-xs">
                <span>Tempo médio para retorno</span>
                <span className="font-semibold">
                  {journey.avgReturnDays != null ? `${journey.avgReturnDays.toFixed(1)} dias` : "—"}
                </span>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2 text-xs">
                <span>Tempo médio para se tornar recorrente</span>
                <span className="font-semibold">
                  {journey.avgDaysToRecorrente != null
                    ? `${journey.avgDaysToRecorrente.toFixed(1)} dias`
                    : "—"}
                </span>
              </div>
            </div>
          </div>
        </div>
      </Section>

      {/* ── SEÇÃO 8: Oportunidades ── */}
      {opportunities.length > 0 && (
        <Section title="Oportunidades">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {opportunities.map((opp, i) => {
              const colorMap: Record<string, string> = {
                alert: "border-destructive/30 bg-destructive/10",
                positive: "border-green-500/30 bg-green-500/10",
                info: "border-blue-500/30 bg-blue-500/10",
              };
              return (
                <div key={i} className={`rounded-xl border p-4 ${colorMap[opp.type] ?? ""}`}>
                  <div className="flex items-start gap-2">
                    <opp.icon
                      className={`mt-0.5 size-5 shrink-0 ${opp.type === "alert" ? "text-destructive" : opp.type === "positive" ? "text-green-600" : "text-blue-600"}`}
                    />
                    <div>
                      <div className="text-sm font-semibold">{opp.title}</div>
                      <p className="text-xs text-muted-foreground">{opp.description}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Section>
      )}

      {/* ── SEÇÃO 9: Perfil do Cliente Ideal ── */}
      {idealClient && (
        <Section title="Perfil do Cliente Ideal">
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-5">
            <div className="mb-4 flex items-center gap-2">
              <UserCheck className="size-5 text-primary" />
              <h3 className="text-base font-bold">Cliente Ideal</h3>
              <span className="rounded-full bg-primary/20 px-2 py-0.5 text-xs font-semibold text-primary">
                {idealClient.revenuePct.toFixed(0)}% da receita
              </span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-lg bg-muted/50 p-3">
                <div className="text-xs text-muted-foreground">Sexo predominante</div>
                <div className="mt-0.5 text-sm font-bold">{idealClient.gender}</div>
              </div>
              <div className="rounded-lg bg-muted/50 p-3">
                <div className="text-xs text-muted-foreground">Faixa etária</div>
                <div className="mt-0.5 text-sm font-bold">{idealClient.ageRange}</div>
              </div>
              <div className="rounded-lg bg-muted/50 p-3">
                <div className="text-xs text-muted-foreground">Tipo de visita</div>
                <div className="mt-0.5 text-sm font-bold">{idealClient.context}</div>
              </div>
              <div className="rounded-lg bg-muted/50 p-3">
                <div className="text-xs text-muted-foreground">Melhor horário</div>
                <div className="mt-0.5 text-sm font-bold">{idealClient.hour}</div>
              </div>
              <div className="rounded-lg bg-muted/50 p-3">
                <div className="text-xs text-muted-foreground">Melhor dia</div>
                <div className="mt-0.5 text-sm font-bold">{idealClient.day}</div>
              </div>
              <div className="rounded-lg bg-muted/50 p-3">
                <div className="text-xs text-muted-foreground">Ticket médio</div>
                <div className="mt-0.5 text-sm font-bold">{formatBRL(idealClient.ticket)}</div>
              </div>
              <div className="rounded-lg bg-muted/50 p-3">
                <div className="text-xs text-muted-foreground">Frequência média</div>
                <div className="mt-0.5 text-sm font-bold">
                  {idealClient.frequency.toFixed(1)} pedidos
                </div>
              </div>
              <div className="rounded-lg bg-muted/50 p-3">
                <div className="text-xs text-muted-foreground">Intervalo entre visitas</div>
                <div className="mt-0.5 text-sm font-bold">
                  {idealClient.returnInterval != null
                    ? `${idealClient.returnInterval.toFixed(0)} dias`
                    : "—"}
                </div>
              </div>
              <div className="rounded-lg bg-muted/50 p-3">
                <div className="text-xs text-muted-foreground">Categoria favorita</div>
                <div className="mt-0.5 text-sm font-bold">{idealClient.category}</div>
              </div>
              <div className="rounded-lg bg-muted/50 p-3">
                <div className="text-xs text-muted-foreground">Produto favorito</div>
                <div className="mt-0.5 text-sm font-bold">{idealClient.product}</div>
              </div>
              <div className="rounded-lg bg-muted/50 p-3">
                <div className="text-xs text-muted-foreground">Nível de fidelização</div>
                <div className="mt-0.5 text-sm font-bold">
                  {idealClient.fidelityPct.toFixed(0)}% recorrentes
                </div>
              </div>
              <div className="rounded-lg bg-muted/50 p-3">
                <div className="text-xs text-muted-foreground">Probabilidade de retorno</div>
                <div className="mt-0.5 text-sm font-bold">
                  {idealClient.returnProb.toFixed(0)}%
                </div>
              </div>
            </div>
          </div>
        </Section>
      )}

      {/* ── SEÇÃO 10: Resumo Inteligente ── */}
      <Section title="Resumo Inteligente">
        <div className="rounded-xl border border-primary/20 bg-primary/10 p-5">
          <div className="flex items-start gap-3">
            <Sparkles className="mt-0.5 size-5 shrink-0 text-primary" />
            <p className="text-sm leading-relaxed text-foreground">{smartSummary}</p>
          </div>
        </div>
      </Section>
    </div>
  );
}

// ── Sub-components ──

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
          className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${key === current ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
}: {
  icon: any;
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-xl border bg-card p-4 transition-shadow hover:shadow-sm">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{label}</span>
        <Icon className="size-4 text-primary" />
      </div>
      <div className="mt-2 text-2xl font-bold">{value}</div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="mb-3 text-sm font-semibold tracking-wide uppercase text-muted-foreground">
        {title}
      </h2>
      {children}
    </div>
  );
}

export default PersonaInteligentePage;
