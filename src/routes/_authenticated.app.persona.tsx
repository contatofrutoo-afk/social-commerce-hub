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

  // ── SEÇÃO 1: Resumo Executivo ──
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

    return {
      totalCustomers,
      totalCheckins,
      totalOrders,
      dominantGender: dominantGenderStr,
      dominantAge: dominantAgeStr,
      dominantContext: dominantCtxStr,
      avgTicket,
    };
  }, [periodCustomers, checkins, orders]);

  // ── SEÇÃO 2: Perfil Demográfico ──
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

    return { genderDist, ageDist };
  }, [periodCustomers]);

  // ── SEÇÃO 3: Perfil Comportamental ──
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

    return {
      dominantContext,
      bestHour,
      bestDay,
      avgHoursBetweenVisits,
      dominantSource,
      dominantTableLabel,
    };
  }, [checkins, tableMap]);

  // ── SEÇÃO 4: Perfil de Consumo ──
  const consumption = useMemo(() => {
    const totalRevenue = orders.reduce((s: number, o: any) => s + Number(o.total), 0);
    const avgTicket = orders.length > 0 ? totalRevenue / orders.length : 0;

    // LTV: total spent per customer, then average
    const custSpent: Record<string, number> = {};
    const custOrdered: Set<string> = new Set();
    orders.forEach((o: any) => {
      if (o.customer_id) {
        custSpent[o.customer_id] = (custSpent[o.customer_id] ?? 0) + Number(o.total);
        custOrdered.add(o.customer_id);
      }
    });
    const ltvValues = Object.values(custSpent);
    const avgLTV =
      ltvValues.length > 0 ? ltvValues.reduce((a, b) => a + b, 0) / ltvValues.length : 0;

    // Top products by quantity ordered
    const productQty: Record<string, number> = {};
    const productCusts: Record<string, Set<string>> = {};
    orders.forEach((o: any) => {
      (o.order_items ?? []).forEach((i: any) => {
        const pid = i.product_id;
        productQty[pid] = (productQty[pid] ?? 0) + i.quantity;
        if (!productCusts[pid]) productCusts[pid] = new Set();
        if (o.customer_id) productCusts[pid].add(o.customer_id);
      });
    });

    const topProducts = Object.entries(productQty)
      .map(([pid, qty]) => ({ id: pid, name: productMap.get(pid)?.name ?? "Desconhecido", qty }))
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 5);

    // Top categories by quantity
    const catQty: Record<string, number> = {};
    const catCusts: Record<string, Set<string>> = {};
    orders.forEach((o: any) => {
      (o.order_items ?? []).forEach((i: any) => {
        const p = productMap.get(i.product_id);
        const cat = p?.category || "Sem categoria";
        catQty[cat] = (catQty[cat] ?? 0) + i.quantity;
        if (!catCusts[cat]) catCusts[cat] = new Set();
        if (o.customer_id) catCusts[cat].add(o.customer_id);
      });
    });

    const topCategories = Object.entries(catQty)
      .map(([cat, qty]) => ({ name: cat, qty }))
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 5);

    // Products with most recurrence (most unique customers)
    const mostRecurringProducts = Object.entries(productCusts)
      .map(([pid, custSet]) => ({
        id: pid,
        name: productMap.get(pid)?.name ?? "Desconhecido",
        uniqueCustomers: custSet.size,
      }))
      .sort((a, b) => b.uniqueCustomers - a.uniqueCustomers)
      .slice(0, 5);

    // Categories with most recurrence
    const mostRecurringCats = Object.entries(catCusts)
      .map(([cat, custSet]) => ({ name: cat, uniqueCustomers: custSet.size }))
      .sort((a, b) => b.uniqueCustomers - a.uniqueCustomers)
      .slice(0, 5);

    return {
      avgTicket,
      avgLTV,
      topProducts,
      topCategories,
      mostRecurringProducts,
      mostRecurringCats,
    };
  }, [orders, productMap]);

  // ── SEÇÃO 5: Perfil de Engajamento ──
  const engagement = useMemo(() => {
    // Conversion funnel
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

    // Commenters
    const commenters = new Set((allComments ?? []).map((c: any) => c.customer_id).filter(Boolean));

    // Sharers (customers who posted)
    const posters = new Set(
      (allPosts ?? [])
        .filter((p: any) => p.customer_id)
        .map((p: any) => p.customer_id)
        .filter(Boolean),
    );

    // Only bought (never interacted socially)
    const allSocial = new Set([...commenters, ...posters]);
    const onlyBuyers = new Set([...orderCust].filter((cid) => !allSocial.has(cid)));

    // Both interact and buy
    const interactAndBuy = new Set([...orderCust].filter((cid) => allSocial.has(cid)));

    return {
      viewers: viewers.size,
      cartAdds: cartAddCust.size,
      buyers: orderCust.size,
      commenters: commenters.size,
      posters: posters.size,
      onlyBuyers: onlyBuyers.size,
      interactAndBuy: interactAndBuy.size,
    };
  }, [events, orders, allComments, allPosts]);

  // ── SEÇÃO 6: Segmentação Automática (RFM) ──
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
      const customerOrders = (allOrders ?? []).filter((o: any) => o.customer_id === cid);
      const orderCount = customerOrders.length;
      const totalSpent = customerOrders.reduce((s: number, o: any) => s + Number(o.total), 0);
      const lastVisit = c.last_visit_at ? new Date(c.last_visit_at).getTime() : null;
      const daysSinceLastVisit = lastVisit ? (now - lastVisit) / day : null;

      // Classify: runs top-down, first match wins
      if (daysSinceLastVisit != null && daysSinceLastVisit > 60) {
        segments.inativo.add(cid);
      } else if (daysSinceLastVisit != null && daysSinceLastVisit > 30) {
        segments.risco.add(cid);
      } else if (orderCount >= 5 || totalSpent > 1000) {
        segments.vip.add(cid);
      } else if (visitCount >= 2 || orderCount >= 1) {
        segments.recorrente.add(cid);
      } else if (visitCount === 1 && orderCount === 0) {
        segments.novo.add(cid);
      } else {
        segments.novo.add(cid);
      }
    });

    const total = periodCustomers.length || 1;
    const segmentConfig: { key: string; label: string; color: string; icon: any }[] = [
      {
        key: "novo",
        label: "Cliente Novo",
        color: "border-blue-500/30 bg-blue-500/10",
        icon: UserPlus,
      },
      {
        key: "recorrente",
        label: "Cliente Recorrente",
        color: "border-green-500/30 bg-green-500/10",
        icon: Activity,
      },
      {
        key: "vip",
        label: "Cliente VIP",
        color: "border-yellow-500/30 bg-yellow-500/10",
        icon: Crown,
      },
      {
        key: "risco",
        label: "Cliente em Risco",
        color: "border-orange-500/30 bg-orange-500/10",
        icon: AlertTriangle,
      },
      {
        key: "inativo",
        label: "Cliente Inativo",
        color: "border-destructive/30 bg-destructive/10",
        icon: Zap,
      },
    ];

    return segmentConfig.map((s) => ({
      ...s,
      count: segments[s.key].size,
      pct: (segments[s.key].size / total) * 100,
    }));
  }, [periodCustomers, allOrders]);

  // ── SEÇÃO 7: Jornada do Cliente ──
  const journey = useMemo(() => {
    // Count customers by order count
    const custOrderCount: Record<string, number> = {};
    const custFirstOrder: Record<string, string> = {};
    (allOrders ?? []).forEach((o: any) => {
      if (o.customer_id) {
        custOrderCount[o.customer_id] = (custOrderCount[o.customer_id] ?? 0) + 1;
        const ts = o.created_at;
        if (!custFirstOrder[o.customer_id] || ts < custFirstOrder[o.customer_id]) {
          custFirstOrder[o.customer_id] = ts;
        }
      }
    });

    const firstVisit = periodCustomers.filter((c: any) => (c.visit_count ?? 0) === 1).length;
    const firstOrder = Object.entries(custOrderCount).filter(([, count]) => count === 1).length;
    const returning = Object.entries(custOrderCount).filter(
      ([, count]) => count >= 2 && count <= 4,
    ).length;
    const recorrente = Object.entries(custOrderCount).filter(
      ([, count]) => count >= 5 && count <= 9,
    ).length;
    const vip = Object.entries(custOrderCount).filter(([, count]) => count >= 10).length;

    const stages = [
      { label: "Primeira visita", count: firstVisit },
      { label: "Primeiro pedido", count: firstOrder },
      { label: "Retorno", count: returning },
      { label: "Recorrente", count: recorrente },
      { label: "VIP", count: vip },
    ];

    const maxStage = Math.max(...stages.map((s) => s.count), 1);

    // Avg time to first order
    let totalFirstOrderDays = 0;
    let firstOrderCount = 0;
    periodCustomers.forEach((c: any) => {
      const cid = c.id;
      const firstVisitDate = c.first_visit_at;
      const firstOrderDate = custFirstOrder[cid];
      if (firstVisitDate && firstOrderDate) {
        const diff =
          (new Date(firstOrderDate).getTime() - new Date(firstVisitDate).getTime()) / 86400000;
        if (diff >= 0) {
          totalFirstOrderDays += diff;
          firstOrderCount++;
        }
      }
    });
    const avgDaysToFirstOrder = firstOrderCount > 0 ? totalFirstOrderDays / firstOrderCount : null;

    // Avg time between consecutive checkins (for repeat customers)
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

    // Avg time to become recorrente (first visit to 5th order for VIPs)
    const custOrderTimes: Record<string, string[]> = {};
    (allOrders ?? []).forEach((o: any) => {
      if (o.customer_id) {
        if (!custOrderTimes[o.customer_id]) custOrderTimes[o.customer_id] = [];
        custOrderTimes[o.customer_id].push(o.created_at);
      }
    });
    let totalVipDays = 0;
    let vipCount = 0;
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
            vipCount++;
          }
        }
      }
    });
    const avgDaysToRecorrente = vipCount > 0 ? totalVipDays / vipCount : null;

    return { stages, maxStage, avgDaysToFirstOrder, avgReturnDays, avgDaysToRecorrente };
  }, [periodCustomers, allOrders, allCheckins, customers]);

  // ── SEÇÃO 8: Oportunidades ──
  const opportunities = useMemo(() => {
    const list: {
      icon: any;
      title: string;
      description: string;
      type: "alert" | "positive" | "info";
    }[] = [];

    // Casais higher ticket
    if (orders.length > 0) {
      const ctxOrderTotal: Record<string, { total: number; count: number }> = {};
      orders.forEach((o: any) => {
        const customerCheckins = checkins.filter((c: any) => c.customer_id === o.customer_id);
        const ctx =
          customerCheckins.length > 0
            ? customerCheckins[0].context || "desconhecido"
            : "sem contexto";
        if (!ctxOrderTotal[ctx]) ctxOrderTotal[ctx] = { total: 0, count: 0 };
        ctxOrderTotal[ctx].total += Number(o.total);
        ctxOrderTotal[ctx].count++;
      });

      const overallAvg =
        orders.reduce((s: number, o: any) => s + Number(o.total), 0) / orders.length;

      Object.entries(ctxOrderTotal).forEach(([ctx, data]) => {
        const ctxAvg = data.total / data.count;
        if (data.count >= 2 && ctxAvg > overallAvg * 1.15) {
          list.push({
            icon: TrendingUp,
            title: `${ctx.charAt(0).toUpperCase() + ctx.slice(1)} possuem maior ticket médio`,
            description: `Clientes que vêm como "${ctx}" gastam em média ${formatBRL(ctxAvg)}, acima da média geral de ${formatBRL(overallAvg)}.`,
            type: "positive",
          });
        }
      });
    }

    // Age range revenue contribution
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

    // Converts better
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

    // Commenters return more
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

    return list;
  }, [orders, checkins, events, customers, allComments]);

  // ── SEÇÃO 9: Resumo Inteligente ──
  const smartSummary = useMemo(() => {
    const g = summary.dominantGender;
    const a = summary.dominantAge;
    const ctx = summary.dominantContext;
    const day = behavioral.bestDay;
    const hour = behavioral.bestHour;
    const ticket = summary.avgTicket;
    const returnDays =
      behavioral.avgHoursBetweenVisits != null
        ? (behavioral.avgHoursBetweenVisits / 24).toFixed(1)
        : null;

    // Dominant category
    const catCounts: Record<string, number> = {};
    orders.forEach((o: any) => {
      (o.order_items ?? []).forEach((i: any) => {
        const p = productMap.get(i.product_id);
        const cat = p?.category || "Sem categoria";
        catCounts[cat] = (catCounts[cat] ?? 0) + i.quantity;
      });
    });
    const dominantCat = Object.entries(catCounts).sort((a, b) => b[1] - a[1])[0];
    const dominantCategory = dominantCat ? dominantCat[0] : null;

    const parts: string[] = [];
    parts.push(`O principal público deste negócio é composto predominantemente por`);
    parts.push(`${g === "—" ? "diversos perfis" : g.toLowerCase()}`);
    if (a !== "—") {
      parts.push(`entre ${a.toLowerCase()}`);
    }
    parts.push(`que costumam visitar o estabelecimento`);
    if (ctx !== "—") {
      parts.push(`em ${ctx}`);
    }
    parts.push(`principalmente`);
    if (day !== "—") parts.push(`aos ${day}`);
    if (hour !== "—") parts.push(`entre ${hour}`);
    parts.push(".");
    if (ticket > 0) {
      parts.push(`Possuem ticket médio de ${formatBRL(ticket)}`);
    }
    if (returnDays != null) {
      parts.push(`retornam em média após ${returnDays} dias`);
    }
    if (dominantCategory) {
      parts.push(`e apresentam preferência pela categoria "${dominantCategory}"`);
    }
    parts.push(".");

    return parts.join(" ");
  }, [summary, behavioral, orders, productMap]);

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
        <div className="grid gap-3 sm:grid-cols-3">
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
        </div>
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
          <div className="rounded-xl border bg-card p-4">
            <h3 className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
              Top 5 produtos favoritos
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
              Top 5 categorias favoritas
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
        <div className="grid gap-4 lg:grid-cols-2">
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
                  <ShoppingCart className="size-3 text-primary" /> Clientes que apenas compram
                </span>
                <span className="font-semibold">{engagement.onlyBuyers}</span>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2 text-xs">
                <span className="flex items-center gap-1">
                  <Heart className="size-3 text-primary" /> Clientes que interagem e compram
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
            <h3 className="mb-3 text-sm font-semibold">Estágios da Jornada</h3>
            <div className="space-y-3">
              {journey.stages.map((stage) => {
                const barWidth = (stage.count / journey.maxStage) * 100;
                return (
                  <div key={stage.label}>
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className="font-medium">{stage.label}</span>
                      <span className="font-semibold">{stage.count}</span>
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

      {/* ── SEÇÃO 9: Resumo Inteligente ── */}
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
