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
  Sparkles,
  Lightbulb,
  BarChart3,
  ScanLine,
  Star,
  Repeat,
  UserCheck,
  Megaphone,
  ShieldAlert,
  TrendingDown,
  ThumbsUp,
  Camera,
  Gift,
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

const PERIOD_LABELS_LONG: Record<PeriodKey, string> = {
  today: "hoje",
  "7d": "últimos 7 dias",
  "30d": "últimos 30 dias",
  "90d": "últimos 90 dias",
  year: "este ano",
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
  mulher: "Mulheres",
  homem: "Homens",
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

const DAY_NAMES = [
  "domingo",
  "segunda-feira",
  "terça-feira",
  "quarta-feira",
  "quinta-feira",
  "sexta-feira",
  "sábado",
];
const DAY_NAMES_SHORT = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

function mode<T>(arr: T[]): T | null {
  if (arr.length === 0) return null;
  const counts = new Map<T, number>();
  arr.forEach((v) => counts.set(v, (counts.get(v) ?? 0) + 1));
  let max = 0;
  let result: T | null = null;
  counts.forEach((c, v) => {
    if (c > max) {
      max = c;
      result = v;
    }
  });
  return result;
}

function PersonaInteligentePage() {
  const companyId = useCompanyId();
  const [period, setPeriod] = useState<PeriodKey>("30d");
  const { start: pStart, end: pEnd } = getPeriodBounds(period);

  // ── Data queries (unchanged) ──
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

  const productMap = useMemo(() => {
    const m = new Map<string, any>();
    (products ?? []).forEach((p: any) => m.set(p.id, p));
    return m;
  }, [products]);

  const tableMap = useMemo(() => {
    const m = new Map<string, string>();
    (tables ?? []).forEach((t: any) => m.set(t.id, t.label));
    return m;
  }, [tables]);

  // ══════════════════════════════════════════════════
  // SHARED COMPUTATIONS
  // ══════════════════════════════════════════════════

  const custStats = useMemo(() => {
    const stats: Record<
      string,
      {
        orderCount: number;
        totalSpent: number;
        firstOrder: string | null;
        lastOrder: string | null;
        orderTimes: string[];
        avgItemsPerOrder: number;
        totalItems: number;
        categories: Set<string>;
        products: Set<string>;
      }
    > = {};
    (allOrders ?? []).forEach((o: any) => {
      if (!o.customer_id) return;
      if (!stats[o.customer_id])
        stats[o.customer_id] = {
          orderCount: 0,
          totalSpent: 0,
          firstOrder: null,
          lastOrder: null,
          orderTimes: [],
          avgItemsPerOrder: 0,
          totalItems: 0,
          categories: new Set(),
          products: new Set(),
        };
      const s = stats[o.customer_id];
      s.orderCount++;
      s.totalSpent += Number(o.total);
      s.orderTimes.push(o.created_at);
      if (!s.firstOrder || o.created_at < s.firstOrder) s.firstOrder = o.created_at;
      if (!s.lastOrder || o.created_at > s.lastOrder) s.lastOrder = o.created_at;
      let itemCount = 0;
      (o.order_items ?? []).forEach((i: any) => {
        itemCount += i.quantity;
        s.totalItems += i.quantity;
        s.products.add(i.product_id);
        const p = productMap.get(i.product_id);
        if (p?.category) s.categories.add(p.category);
      });
      s.avgItemsPerOrder = s.totalItems / s.orderCount;
    });
    return stats;
  }, [allOrders, productMap]);

  // Checkin times per customer
  const custCheckinTimes = useMemo(() => {
    const m: Record<string, string[]> = {};
    checkins.forEach((c: any) => {
      if (c.customer_id) {
        if (!m[c.customer_id]) m[c.customer_id] = [];
        m[c.customer_id].push(c.created_at);
      }
    });
    return m;
  }, [checkins]);

  // ══════════════════════════════════════════════════
  // SEÇÃO 1: QUEM É O MEU CLIENTE?
  // ══════════════════════════════════════════════════
  const whoIsCustomer = useMemo(() => {
    if (periodCustomers.length === 0) return null;

    // Gender
    const genderCounts: Record<string, number> = {};
    periodCustomers.forEach((c: any) => {
      const g = c.gender || "nao_informado";
      genderCounts[g] = (genderCounts[g] ?? 0) + 1;
    });
    const genderEntries = Object.entries(genderCounts).sort((a, b) => b[1] - a[1]);
    const topGender = genderEntries[0];
    const topGenderPct = topGender ? (topGender[1] / periodCustomers.length) * 100 : 0;
    const topGenderKey = topGender ? topGender[0] : "nao_informado";

    // Age
    const ageCounts: Record<string, number> = {};
    periodCustomers.forEach((c: any) => {
      const a = c.age_range || "nao_informado";
      ageCounts[a] = (ageCounts[a] ?? 0) + 1;
    });
    const ageEntries = Object.entries(ageCounts).sort((a, b) => b[1] - a[1]);
    const topAge = ageEntries[0];
    const topAgePct = topAge ? (topAge[1] / periodCustomers.length) * 100 : 0;
    const topAgeKey = topAge ? topAge[0] : "nao_informado";

    // Visit context
    const ctxCounts: Record<string, number> = {};
    checkins.forEach((c: any) => {
      const ctx = c.context || "desconhecido";
      ctxCounts[ctx] = (ctxCounts[ctx] ?? 0) + 1;
    });
    const topCtx = Object.entries(ctxCounts).sort((a, b) => b[1] - a[1])[0];

    // Best hour
    const hourCounts: Record<number, number> = {};
    checkins.forEach((c: any) => {
      const h = new Date(c.created_at).getHours();
      hourCounts[h] = (hourCounts[h] ?? 0) + 1;
    });
    const topHour = Object.entries(hourCounts).sort((a, b) => b[1] - a[1])[0];

    // Best day
    const dayCounts: Record<number, number> = {};
    checkins.forEach((c: any) => {
      const d = new Date(c.created_at).getDay();
      dayCounts[d] = (dayCounts[d] ?? 0) + 1;
    });
    const topDay = Object.entries(dayCounts).sort((a, b) => b[1] - a[1])[0];

    // Ticket
    const totalRevenue = orders.reduce((s: number, o: any) => s + Number(o.total), 0);
    const avgTicket = orders.length > 0 ? totalRevenue / orders.length : 0;

    // Frequency
    const months = getPeriodMonths(period);
    const customersWithCheckins = Object.keys(custCheckinTimes).length;
    const monthlyFreq =
      customersWithCheckins > 0 ? checkins.length / customersWithCheckins / months : null;

    // Category favorite
    const catQty: Record<string, number> = {};
    orders.forEach((o: any) => {
      (o.order_items ?? []).forEach((i: any) => {
        const p = productMap.get(i.product_id);
        const cat = p?.category || "Sem categoria";
        catQty[cat] = (catQty[cat] ?? 0) + i.quantity;
      });
    });
    const topCat = Object.entries(catQty).sort((a, b) => b[1] - a[1])[0];

    // Product favorite
    const prodQty: Record<string, number> = {};
    orders.forEach((o: any) => {
      (o.order_items ?? []).forEach((i: any) => {
        prodQty[i.product_id] = (prodQty[i.product_id] ?? 0) + i.quantity;
      });
    });
    const topProd = Object.entries(prodQty).sort((a, b) => b[1] - a[1])[0];

    // Source
    const srcCounts: Record<string, number> = {};
    checkins.forEach((c: any) => {
      const src = c.source || "desconhecido";
      srcCounts[src] = (srcCounts[src] ?? 0) + 1;
    });
    const topSrc = Object.entries(srcCounts).sort((a, b) => b[1] - a[1])[0];

    // Avg time between visits
    let totalGapMs = 0;
    let gapCount = 0;
    Object.values(custCheckinTimes).forEach((times) => {
      const sorted = [...times].sort();
      for (let i = 1; i < sorted.length; i++) {
        totalGapMs += new Date(sorted[i]).getTime() - new Date(sorted[i - 1]).getTime();
        gapCount++;
      }
    });
    const avgGapDays = gapCount > 0 ? totalGapMs / gapCount / 86400000 : null;

    // Stay duration (consecutive checkins < 2h apart)
    let totalStayMs = 0;
    let stayCount = 0;
    Object.values(custCheckinTimes).forEach((times) => {
      const sorted = [...times].sort();
      for (let i = 1; i < sorted.length; i++) {
        const gap = new Date(sorted[i]).getTime() - new Date(sorted[i - 1]).getTime();
        if (gap < 7200000) {
          totalStayMs += gap;
          stayCount++;
        }
      }
    });
    const avgStayMin = stayCount > 0 ? totalStayMs / stayCount / 60000 : null;

    // Representativity: top gender + age combo
    const comboCounts: Record<string, number> = {};
    periodCustomers.forEach((c: any) => {
      const key = `${c.gender || "nao_informado"}|${c.age_range || "nao_informado"}`;
      comboCounts[key] = (comboCounts[key] ?? 0) + 1;
    });
    const topCombo = Object.entries(comboCounts).sort((a, b) => b[1] - a[1])[0];
    const representativity = topCombo
      ? Math.round((topCombo[1] / periodCustomers.length) * 100)
      : 0;

    return {
      gender: GENDER_LABELS[topGenderKey] ?? topGenderKey,
      genderPct: topGenderPct,
      age: AGE_RANGE_LABELS[topAgeKey] ?? topAgeKey,
      agePct: topAgePct,
      context: topCtx ? topCtx[0] : "—",
      hour: topHour ? `${String(topHour[0]).padStart(2, "0")}h` : "—",
      day: topDay ? DAY_NAMES[Number(topDay[0])] : "—",
      ticket: avgTicket,
      frequency: monthlyFreq,
      category: topCat ? topCat[0] : "—",
      product: topProd ? (productMap.get(topProd[0])?.name ?? "—") : "—",
      source: topSrc ? topSrc[0] : "—",
      avgGapDays,
      avgStayMin,
      representativity,
      totalCustomers: periodCustomers.length,
      totalOrders: orders.length,
      totalCheckins: checkins.length,
    };
  }, [periodCustomers, checkins, orders, productMap, custCheckinTimes, period]);

  // ══════════════════════════════════════════════════
  // SEÇÃO 2: COMO ESSA PESSOA COMPRA?
  // ══════════════════════════════════════════════════
  const howTheyBuy = useMemo(() => {
    if (orders.length === 0 || !whoIsCustomer) return null;
    const insights: { label: string; description: string; icon: any }[] = [];

    // Average items per order
    const totalItems = orders.reduce((s: number, o: any) => {
      return s + (o.order_items ?? []).reduce((s2: number, i: any) => s2 + i.quantity, 0);
    }, 0);
    const avgItems = orders.length > 0 ? totalItems / orders.length : 0;
    if (avgItems >= 2) {
      insights.push({
        label: "Compra múltiplos itens",
        description: `Em média ${avgItems.toFixed(1)} itens por pedido, o que indica hábito de compor refeições ou experimentar variedades.`,
        icon: ShoppingCart,
      });
    } else if (avgItems >= 1) {
      insights.push({
        label: "Compra itens isolados",
        description: `Em média ${avgItems.toFixed(1)} itens por pedido. Possível perfil de compra por impulso ou necessidade pontual.`,
        icon: ShoppingCart,
      });
    }

    // Repeat purchase
    const repeatCusts = Object.values(custStats).filter((s) => s.orderCount >= 2).length;
    const totalWithOrders = Object.keys(custStats).length || 1;
    const repeatPct = (repeatCusts / totalWithOrders) * 100;
    if (repeatPct >= 40) {
      insights.push({
        label: "Retorna com frequência",
        description: `${repeatPct.toFixed(0)}% dos clientes que compraram já retornaram. Há forte hábito de recompra neste estabelecimento.`,
        icon: Repeat,
      });
    } else if (repeatPct >= 20) {
      insights.push({
        label: "Retorno moderado",
        description: `${repeatPct.toFixed(0)} dos clientes retornam. Ainda há espaço para estimular a fidelização.`,
        icon: Repeat,
      });
    } else if (repeatPct > 0) {
      insights.push({
        label: "Baixa taxa de retorno",
        description: `Apenas ${repeatPct.toFixed(0)}% dos clientes retornaram. A maioria compra apenas uma vez.`,
        icon: TrendingDown,
      });
    }

    // Hour-specific buying
    if (whoIsCustomer.hour !== "—") {
      const hourNum = parseInt(whoIsCustomer.hour);
      if (hourNum >= 18 || hourNum <= 22) {
        insights.push({
          label: "Compra predominantemente à noite",
          description: `O horário mais frequente de compra é por volta das ${whoIsCustomer.hour}, indicando consumo durante o período noturno.`,
          icon: Clock,
        });
      } else if (hourNum >= 11 && hourNum <= 14) {
        insights.push({
          label: "Compra no período do almoço",
          description: `O horário mais frequente é por volta das ${whoIsCustomer.hour}, sugerindo que o estabelecimento é opção de almoço.`,
          icon: Clock,
        });
      }
    }

    // Loyalty to products
    const avgProductsPerCust =
      Object.values(custStats).length > 0
        ? Object.values(custStats).reduce((s, c) => s + c.products.size, 0) /
          Object.values(custStats).length
        : 0;
    if (avgProductsPerCust <= 1.3) {
      insights.push({
        label: "Fiel aos mesmos produtos",
        description:
          "Os clientes tendem a pedir sempre os mesmos itens. São fieis ao que já conhecem e gostam.",
        icon: Target,
      });
    } else if (avgProductsPerCust >= 3) {
      insights.push({
        label: "Gosta de experimentar",
        description: `Cada cliente compra em média ${avgProductsPerCust.toFixed(0)} produtos diferentes, demonstrando curiosidade e disposição para experimentar.`,
        icon: Star,
      });
    }

    // Impulse (same-day first order after first visit)
    let impulseCount = 0;
    let impulseTotal = 0;
    periodCustomers.forEach((c: any) => {
      const stats = custStats[c.id];
      if (stats && stats.firstOrder && c.first_visit_at) {
        const diffHours =
          (new Date(stats.firstOrder).getTime() - new Date(c.first_visit_at).getTime()) / 3600000;
        impulseTotal++;
        if (diffHours <= 2) impulseCount++;
      }
    });
    if (impulseTotal > 0) {
      const impulsePct = (impulseCount / impulseTotal) * 100;
      if (impulsePct >= 50) {
        insights.push({
          label: "Compra por impulso",
          description: `${impulsePct.toFixed(0)}% dos clientes fazem seu primeiro pedido na mesma visita em que chegaram. Decidem rapidamente.`,
          icon: Zap,
        });
      }
    }

    // Premium vs economy
    if (orders.length > 0) {
      const ticketValues = orders.map((o: any) => Number(o.total));
      const sorted = [...ticketValues].sort((a, b) => a - b);
      const median = sorted[Math.floor(sorted.length / 2)];
      const avg = ticketValues.reduce((a, b) => a + b, 0) / ticketValues.length;
      if (avg > median * 1.3) {
        insights.push({
          label: "Compra acima da mediana",
          description:
            "O ticket médio é significativamente superior à mediana, indicando que uma parcela dos clientes opta por itens premium ou pedidos maiores.",
          icon: Crown,
        });
      }
    }

    return insights;
  }, [orders, custStats, whoIsCustomer, periodCustomers]);

  // ══════════════════════════════════════════════════
  // SEÇÃO 3: O QUE ESSA PESSOA VALORIZA?
  // ══════════════════════════════════════════════════
  const whatTheyValue = useMemo(() => {
    if (orders.length === 0) return null;
    const values: { label: string; description: string; confidence: "alta" | "média" }[] = [];

    // Variety → values novidades
    const uniqueProductsBought = new Set<string>();
    orders.forEach((o: any) => {
      (o.order_items ?? []).forEach((i: any) => uniqueProductsBought.add(i.product_id));
    });
    const totalProductsAvailable = products?.length ?? 0;
    if (totalProductsAvailable > 0) {
      const tryRate = uniqueProductsBought.size / totalProductsAvailable;
      if (tryRate >= 0.5) {
        values.push({
          label: "Novidades e variedade",
          description:
            "Os clientes demonstram interesse em experimentar diferentes opções do cardápio.",
          confidence: "alta",
        });
      }
    }

    // Premium → values qualidade
    const avgTicket = orders.reduce((s: number, o: any) => s + Number(o.total), 0) / orders.length;
    const highTicketProducts = orders.filter((o: any) => {
      const itemPrices = (o.order_items ?? []).map((i: any) => {
        const p = productMap.get(i.product_id);
        return p?.price ?? 0;
      });
      return itemPrices.some((p: number) => p > avgTicket * 0.6);
    });
    if (highTicketProducts.length > orders.length * 0.3) {
      values.push({
        label: "Qualidade e produtos diferenciados",
        description:
          "Uma parcela significativa dos pedidos inclui itens de maior valor, indicando valorização de qualidade.",
        confidence: "média",
      });
    }

    // Social interaction → values experiência
    const socialCusts = new Set<string>();
    (allComments ?? []).forEach((c: any) => {
      if (c.customer_id) socialCusts.add(c.customer_id);
    });
    (allPosts ?? []).forEach((p: any) => {
      if (p.customer_id) socialCusts.add(p.customer_id);
    });
    const socialPct =
      periodCustomers.length > 0 ? (socialCusts.size / periodCustomers.length) * 100 : 0;
    if (socialPct >= 15) {
      values.push({
        label: "Experiência e interação",
        description: `${socialPct.toFixed(0)}% dos clientes interagem socialmente com o estabelecimento. Valorizam a experiência como um todo.`,
        confidence: "alta",
      });
    }

    // Speed → values praticidade
    const repeatCusts = Object.values(custStats).filter((s) => s.orderCount >= 2).length;
    if (repeatCusts > Object.keys(custStats).length * 0.3) {
      values.push({
        label: "Praticidade e constância",
        description:
          "Os clientes retornam com frequência, sugerindo que valorizam a praticidade e a experiência conhecida.",
        confidence: "média",
      });
    }

    // Night context → values ambiente
    const nightCheckins = checkins.filter((c: any) => {
      const h = new Date(c.created_at).getHours();
      return h >= 18 || h <= 5;
    });
    if (checkins.length > 0 && nightCheckins.length / checkins.length >= 0.5) {
      values.push({
        label: "Ambiente e experiência social",
        description:
          "A maioria das visitas ocorre no período noturno, sugerindo que o ambiente e a experiência social são importantes.",
        confidence: "média",
      });
    }

    return values.length > 0 ? values : null;
  }, [orders, products, periodCustomers, allComments, allPosts, custStats, checkins, productMap]);

  // ══════════════════════════════════════════════════
  // SEÇÃO 4: O QUE MOTIVA A COMPRA?
  // ══════════════════════════════════════════════════
  const purchaseMotivation = useMemo(() => {
    if (orders.length === 0) return null;
    const motivations: { label: string; description: string; icon: any }[] = [];

    // Context-based motivation
    const ctxCounts: Record<string, number> = {};
    checkins.forEach((c: any) => {
      const ctx = c.context || "desconhecido";
      ctxCounts[ctx] = (ctxCounts[ctx] ?? 0) + 1;
    });
    const topCtx = Object.entries(ctxCounts).sort((a, b) => b[1] - a[1])[0];
    if (topCtx && topCtx[1] > checkins.length * 0.3) {
      const ctx = topCtx[0];
      if (ctx === "casal") {
        motivations.push({
          label: "A companhia do parceiro(a)",
          description:
            "A visita em casal é o principal contexto. A experiência compartilhada motiva a ida ao estabelecimento.",
          icon: Heart,
        });
      } else if (ctx === "família") {
        motivations.push({
          label: "Momento em família",
          description:
            "A visita familiar é predominante. O estabelecimento é visto como um local para reunir a família.",
          icon: Users,
        });
      } else if (ctx === "amigos") {
        motivations.push({
          label: "Encontro com amigos",
          description:
            "Os clientes costumam vir em grupo. O aspecto social e de convivência é o principal motivador.",
          icon: Users,
        });
      } else if (ctx === "sozinho") {
        motivations.push({
          label: "Necessidade individual",
          description:
            "A maioria das visitas é individual, sugerindo que o produto ou serviço atende a uma necessidade pessoal.",
          icon: UserCheck,
        });
      }
    }

    // Time-based motivation
    if (whoIsCustomer) {
      const hourNum = parseInt(whoIsCustomer.hour);
      if (!isNaN(hourNum)) {
        if (hourNum >= 7 && hourNum <= 10) {
          motivations.push({
            label: "Rotina matinal",
            description:
              "O horário de pico coincide com a rotina da manhã. O estabelecimento faz parte do hábito diário.",
            icon: Clock,
          });
        } else if (hourNum >= 11 && hourNum <= 14) {
          motivations.push({
            label: "Horário de almoço",
            description:
              "O pico de visitas ocorre no horário de almoço, indicando que o estabelecimento é opção para a refeição do meio do dia.",
            icon: Clock,
          });
        } else if (hourNum >= 18 && hourNum <= 23) {
          motivations.push({
            label: "Momento de lazer noturno",
            description:
              "As visitas concentram-se à noite, período associado a lazer, descontração e encontros sociais.",
            icon: Clock,
          });
        }
      }
    }

    // New products
    if (products && products.length > 5) {
      const recentProducts = orders.filter((o: any) => {
        return (o.order_items ?? []).some((i: any) => {
          const p = productMap.get(i.product_id);
          return p && inRange(p.created_at ?? p.id, pStart, pEnd);
        });
      });
      if (recentProducts.length > orders.length * 0.15) {
        motivations.push({
          label: "Produtos novos",
          description:
            "Uma parcela significativa dos pedidos inclui itens recentes. Novidades atraem os clientes.",
          icon: Gift,
        });
      }
    }

    // Social proof (comments before buying)
    const commentersWhoBought = new Set<string>();
    const commenterIds = new Set(
      (allComments ?? []).map((c: any) => c.customer_id).filter(Boolean),
    );
    Object.keys(custStats).forEach((cid) => {
      if (commenterIds.has(cid)) commentersWhoBought.add(cid);
    });
    if (commentersWhoBought.size > Object.keys(custStats).length * 0.15) {
      motivations.push({
        label: "Interação social pré-compra",
        description:
          "Clientes que comentam ou interagem antes de comprar. A prova social e o engajamento incentivam a purchase.",
        icon: MessageCircle,
      });
    }

    return motivations.length > 0 ? motivations : null;
  }, [orders, checkins, custStats, allComments, productMap, products, whoIsCustomer, pStart, pEnd]);

  // ══════════════════════════════════════════════════
  // SEÇÃO 5: O QUE PODE ESTAR IMPEDINDO NOVAS COMPRAS?
  // ══════════════════════════════════════════════════
  const barriers = useMemo(() => {
    const list: { label: string; description: string; severity: "alert" | "warning" | "info" }[] =
      [];

    // View but no cart
    const viewers = new Set(
      events
        .filter((e: any) => e.event_type === "view")
        .map((e: any) => e.customer_id)
        .filter(Boolean),
    );
    const cartAdders = new Set(
      events
        .filter((e: any) => e.event_type === "cart_add")
        .map((e: any) => e.customer_id)
        .filter(Boolean),
    );
    const viewNoCart = new Set([...viewers].filter((cid) => !cartAdders.has(cid)));
    if (viewNoCart.size > 0 && viewers.size > 0) {
      const pct = (viewNoCart.size / viewers.size) * 100;
      if (pct >= 40) {
        list.push({
          label: "Visualizam mas não adicionam à sacola",
          description: `${pct.toFixed(0)}% dos clientes visualizam produtos mas não os adicionam à sacola. Possíveis barreiras: preço, apresentação ou falta de incentivo.`,
          severity: "alert",
        });
      }
    }

    // Cart but no order
    const orderBuyers = new Set(orders.map((o: any) => o.customer_id).filter(Boolean));
    const cartNoOrder = new Set([...cartAdders].filter((cid) => !orderBuyers.has(cid)));
    if (cartNoOrder.size > 0 && cartAdders.size > 0) {
      const pct = (cartNoOrder.size / cartAdders.size) * 100;
      if (pct >= 30) {
        list.push({
          label: "Adicionam à sacola mas não finalizam",
          description: `${pct.toFixed(0)}% dos clientes que adicionam à sacola não concretizam a compra. Possíveis barreiras: frete, processos de checkout ou indecisão.`,
          severity: "alert",
        });
      }
    }

    // One-time buyers
    const oneTimers = Object.values(custStats).filter((s) => s.orderCount === 1).length;
    const totalWithOrders = Object.keys(custStats).length || 1;
    const oneTimerPct = (oneTimers / totalWithOrders) * 100;
    if (oneTimerPct >= 50) {
      list.push({
        label: "Maioria compra apenas uma vez",
        description: `${oneTimerPct.toFixed(0)}% dos clientes compraram apenas uma vez e não retornaram. A retenção precisa de atenção.`,
        severity: "warning",
      });
    }

    // Low return rate
    const custWithMultipleCheckins = Object.values(custCheckinTimes).filter(
      (t) => t.length >= 2,
    ).length;
    const totalWithCheckins = Object.keys(custCheckinTimes).length || 1;
    const returnPct = (custWithMultipleCheckins / totalWithCheckins) * 100;
    if (returnPct < 25 && totalWithCheckins >= 5) {
      list.push({
        label: "Baixa taxa de retorno",
        description: `Apenas ${returnPct.toFixed(0)}% dos clientes que fizeram check-in retornaram. A experiência inicial pode não estar gerando incentivo para voltar.`,
        severity: "warning",
      });
    }

    // No social engagement
    const socialCusts = new Set<string>();
    (allComments ?? []).forEach((c: any) => {
      if (c.customer_id) socialCusts.add(c.customer_id);
    });
    (allPosts ?? []).forEach((p: any) => {
      if (p.customer_id) socialCusts.add(p.customer_id);
    });
    if (orderBuyers.size > 0) {
      const silentPct = ((orderBuyers.size - socialCusts.size) / orderBuyers.size) * 100;
      if (silentPct >= 70) {
        list.push({
          label: "Baixo engajamento social",
          description: `${silentPct.toFixed(0)}% dos clientes compram mas nunca interagem. Não comentam, não compartilham e não publicam.`,
          severity: "info",
        });
      }
    }

    return list.length > 0 ? list : null;
  }, [events, custStats, custCheckinTimes, orders, allComments, allPosts]);

  // ══════════════════════════════════════════════════
  // SEÇÃO 6: COMO SE COMUNICAR?
  // ══════════════════════════════════════════════════
  const communicationAdvice = useMemo(() => {
    if (periodCustomers.length === 0) return null;
    const advice: { label: string; description: string; icon: any }[] = [];

    // Demographics → tone
    if (whoIsCustomer) {
      const ageKey = Object.entries(
        periodCustomers.reduce((acc: Record<string, number>, c: any) => {
          const a = c.age_range || "nao_informado";
          acc[a] = (acc[a] ?? 0) + 1;
          return acc;
        }, {}),
      ).sort((a, b) => b[1] - a[1])[0];

      if (ageKey) {
        const key = ageKey[0];
        if (key === "18-24" || key === "25-34") {
          advice.push({
            label: "Use linguagem jovem e visual",
            description:
              "Seu público predominante é jovem. Invista em conteúdo visual, linguagem direta e formatos como Reels e Stories.",
            icon: Camera,
          });
        } else if (key === "35-44" || key === "45-54") {
          advice.push({
            label: "Use comunicação madura e objetiva",
            description:
              "Seu público valoriza clareza e profissionalismo. Evite exageros e foque em benefícios concretos.",
            icon: Megaphone,
          });
        }
      }
    }

    // Social behavior → content type
    const commenters = new Set((allComments ?? []).map((c: any) => c.customer_id).filter(Boolean));
    const posters = new Set((allPosts ?? []).map((p: any) => p.customer_id).filter(Boolean));
    const socialCusts = new Set([...commenters, ...posters]);

    if (socialCusts.size > periodCustomers.length * 0.2) {
      advice.push({
        label: "Estimule conteúdo gerado pelo cliente",
        description:
          "Seu público interage bastante. Incentive publicações, fotos e comentários. Clientes que interagem compram mais.",
        icon: Share2,
      });
    } else if (socialCusts.size < periodCustomers.length * 0.05) {
      advice.push({
        label: "Invista em conteúdo visual profissional",
        description:
          "Seu público não costuma interagir. Foque em imagens e vídeos de alta qualidade dos seus produtos para atrair atenção.",
        icon: Camera,
      });
    }

    // Time → posting schedule
    if (whoIsCustomer && whoIsCustomer.hour !== "—") {
      const hourNum = parseInt(whoIsCustomer.hour);
      if (!isNaN(hourNum)) {
        const postHour = hourNum >= 2 ? hourNum - 2 : hourNum;
        advice.push({
          label: `Publique por volta das ${String(postHour).padStart(2, "0")}h`,
          description: `Seu público está mais ativo por volta das ${whoIsCustomer.hour}. Publique conteúdo 1 a 2 horas antes para gerar expectativa.`,
          icon: Clock,
        });
      }
    }

    // Impulse buyers → urgency
    const impulseCusts = Object.values(custStats).filter((s) => s.orderCount <= 1).length;
    const totalWithOrders = Object.keys(custStats).length || 1;
    if (impulseCusts / totalWithOrders >= 0.5) {
      advice.push({
        label: "Use urgência e exclusividade",
        description:
          "Muitos clientes compram apenas uma vez. Ofertas por tempo limitado e exclusividade podem estimular retorno.",
        icon: Zap,
      });
    }

    // Repeat buyers → loyalty
    const repeatCusts = Object.values(custStats).filter((s) => s.orderCount >= 3).length;
    if (repeatCusts >= 5) {
      advice.push({
        label: "Crie programa de fidelidade",
        description: `${repeatCusts} clientes já retornaram 3+ vezes. Um programa de pontos ou benefícios pode fortalecer essa relação.`,
        icon: Crown,
      });
    }

    return advice.length > 0 ? advice : null;
  }, [periodCustomers, whoIsCustomer, allComments, allPosts, custStats]);

  // ══════════════════════════════════════════════════
  // SEÇÃO 7: OPORTUNIDADES
  // ══════════════════════════════════════════════════
  const opportunities = useMemo(() => {
    if (orders.length === 0) return null;
    const list: { recommendation: string; reason: string; icon: any }[] = [];

    // Context campaigns
    const ctxCounts: Record<string, number> = {};
    checkins.forEach((c: any) => {
      const ctx = c.context || "desconhecido";
      ctxCounts[ctx] = (ctxCounts[ctx] ?? 0) + 1;
    });
    const topCtx = Object.entries(ctxCounts).sort((a, b) => b[1] - a[1])[0];
    if (topCtx && topCtx[1] > checkins.length * 0.25) {
      if (topCtx[0] === "casal") {
        list.push({
          recommendation: "Crie campanhas voltadas para casais",
          reason: `O contexto "casal" representa ${((topCtx[1] / checkins.length) * 100).toFixed(0)}% das visitas. Promoções para dois, experiências românticas e combos especiais podem aumentar o ticket.`,
          icon: Heart,
        });
      } else if (topCtx[0] === "família") {
        list.push({
          recommendation: "Monte combos e promoções para famílias",
          reason:
            "A maioria das visitas é em família. Refeições familiares, descontos para grupos e cardápios compartilhados podem ser atrativos.",
          icon: Users,
        });
      } else if (topCtx[0] === "amigos") {
        list.push({
          recommendation: "Estimule encontros entre amigos",
          reason:
            "Os clientes costumam vir em grupo. Happy hours, mesas compartilhadas e experiências em grupo podem ser exploradas.",
          icon: Users,
        });
      }
    }

    // Time-based opportunity
    if (whoIsCustomer && whoIsCustomer.day !== "—") {
      list.push({
        recommendation: `Destaque ofertas especiais nas ${whoIsCustomer.day}s`,
        reason: `As ${whoIsCustomer.day}s concentram o maior volume de visitas. Use este dia para lançamentos, promoções ou eventos temáticos.`,
        icon: Calendar,
      });
    }

    // Category opportunity
    if (whoIsCustomer && whoIsCustomer.category !== "—") {
      list.push({
        recommendation: `Lance novidades na categoria "${whoIsCustomer.category}"`,
        reason: `A categoria "${whoIsCustomer.category}" é a mais consumida. Novos produtos nesta categoria tendem a gerar interesse imediato.`,
        icon: Gift,
      });
    }

    // Comment engagement
    const commenterIds = new Set(
      (allComments ?? []).map((c: any) => c.customer_id).filter(Boolean),
    );
    const orderBuyers = new Set(orders.map((o: any) => o.customer_id).filter(Boolean));
    if (commenterIds.size > 0 && orderBuyers.size > 0) {
      const silentPct = ((orderBuyers.size - commenterIds.size) / orderBuyers.size) * 100;
      if (silentPct >= 50) {
        list.push({
          recommendation: "Estimule comentários após a compra",
          reason: `${silentPct.toFixed(0)}% dos clientes nunca comentam. Incentive feedbacks com mensagens como "Conte como foi sua experiência".`,
          icon: MessageCircle,
        });
      }
    }

    // Repeat customers → present new products
    const repeatCusts = Object.values(custStats).filter((s) => s.orderCount >= 2).length;
    if (repeatCusts >= 3) {
      list.push({
        recommendation: "Apresente novos produtos aos clientes recorrentes",
        reason: `${repeatCusts} clientes já retornaram. Apresentar novidades exclusivas para este grupo fortalece a fidelidade.`,
        icon: Star,
      });
    }

    // Night products
    const nightOrders = orders.filter((o: any) => {
      const h = new Date(o.created_at).getHours();
      return h >= 18 || h <= 5;
    });
    if (nightOrders.length > orders.length * 0.4) {
      list.push({
        recommendation: "Destaque produtos no período noturno",
        reason:
          "A maioria das vendas ocorre à noite. Sobremesas, bebidas e produtos para compartilhar podem ter desempenho superior neste horário.",
        icon: Clock,
      });
    }

    // LTV opportunity
    const ltvValues = Object.values(custStats).map((s) => s.totalSpent);
    const avgLTV =
      ltvValues.length > 0 ? ltvValues.reduce((a, b) => a + b, 0) / ltvValues.length : 0;
    if (avgLTV > 0) {
      const highValueCusts = Object.values(custStats).filter(
        (s) => s.totalSpent > avgLTV * 2,
      ).length;
      if (highValueCusts >= 3) {
        list.push({
          recommendation: "Crie experiência VIP para clientes de alto valor",
          reason: `${highValueCusts} clientes gastam mais que o dobro da média. Atendimento diferenciado, acessos antecipados e benefícios exclusivos podem reter este grupo.`,
          icon: Crown,
        });
      }
    }

    return list.length > 0 ? list : null;
  }, [orders, checkins, whoIsCustomer, allComments, custStats, periodCustomers]);

  // ══════════════════════════════════════════════════
  // SEÇÃO 8: RESUMO EXECUTIVO
  // ══════════════════════════════════════════════════
  const executiveSummary = useMemo(() => {
    if (!whoIsCustomer) return null;
    const s = whoIsCustomer;
    const periodLabel = PERIOD_LABELS_LONG[period];

    const parts: string[] = [];

    // Opening
    parts.push(
      `Nos últimos ${periodLabel} foi possível identificar que o principal público deste estabelecimento é formado por`,
    );
    parts.push(`${s.gender.toLowerCase()}`);
    if (s.age !== "Não informado") parts.push(`entre ${s.age.toLowerCase()}`);
    parts.push("que costumam visitar o local");

    if (s.context !== "—") parts.push(`em contexto de ${s.context}`);
    if (s.day !== "—") parts.push(`principalmente às ${s.day}`);
    if (s.hour !== "—") parts.push(`por volta das ${s.hour}`);
    parts.push(".");

    // Category and product
    if (s.category !== "—" && s.product !== "—") {
      parts.push(
        `Demonstram preferência pela categoria "${s.category}", sendo "${s.product}" o produto mais consumido.`,
      );
    } else if (s.category !== "—") {
      parts.push(`Demonstram preferência pela categoria "${s.category}".`);
    }

    // Ticket
    if (s.ticket > 0) {
      parts.push(`Apresentam ticket médio de ${formatBRL(s.ticket)}.`);
    }

    // Return frequency
    if (s.avgGapDays != null) {
      parts.push(`Retornam ao estabelecimento em média a cada ${Math.round(s.avgGapDays)} dias.`);
    }

    // Stay time
    if (s.avgStayMin != null) {
      parts.push(`Permanecem no local por aproximadamente ${Math.round(s.avgStayMin)} minutos.`);
    }

    // Representativity
    if (s.representativity > 0) {
      parts.push(
        `Este perfil representa aproximadamente ${s.representativity}% da base de clientes ativos.`,
      );
    }

    // Values inference
    if (whatTheyValue && whatTheyValue.length > 0) {
      const valueLabels = whatTheyValue.slice(0, 3).map((v) => v.label.toLowerCase());
      if (valueLabels.length === 1) {
        parts.push(`Este perfil demonstra valorizar ${valueLabels[0]}.`);
      } else if (valueLabels.length === 2) {
        parts.push(`Este perfil demonstra valorizar ${valueLabels[0]} e ${valueLabels[1]}.`);
      } else {
        parts.push(
          `Este perfil demonstra valorizar ${valueLabels.slice(0, -1).join(", ")} e ${valueLabels[valueLabels.length - 1]}.`,
        );
      }
    }

    // Communication advice
    if (communicationAdvice && communicationAdvice.length > 0) {
      parts.push(
        `Estratégias de comunicação devem priorizar ${communicationAdvice[0].label.toLowerCase()}.`,
      );
    }

    return parts.join(" ");
  }, [whoIsCustomer, period, whatTheyValue, communicationAdvice]);

  // ══════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════

  if (!companyId)
    return <div className="py-8 text-center text-muted-foreground">Carregando...</div>;

  const noData = !whoIsCustomer;

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Persona Inteligente</h1>
          <p className="text-sm text-muted-foreground">
            Consultoria automática baseada no comportamento real dos seus clientes
          </p>
        </div>
        <PeriodSelector current={period} onChange={setPeriod} />
      </div>

      {noData && (
        <div className="rounded-xl border border-dashed bg-muted/20 p-8 text-center">
          <Users className="mx-auto mb-3 size-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Dados insuficientes para gerar a análise. Aguarde novos check-ins, pedidos ou interações
            dos seus clientes.
          </p>
        </div>
      )}

      {/* ── SEÇÃO 1: QUEM É O MEU CLIENTE? ── */}
      {whoIsCustomer && (
        <Section title="Quem é o meu cliente?" icon={UserCheck}>
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-6">
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <h3 className="text-lg font-bold">Persona Principal</h3>
              <span className="rounded-full bg-primary/20 px-3 py-1 text-xs font-semibold text-primary">
                {whoIsCustomer.representativity}% da base
              </span>
            </div>
            <p className="mb-5 text-sm leading-relaxed text-muted-foreground">
              A persona que mais representa este estabelecimento é composta por{" "}
              <strong>{whoIsCustomer.gender.toLowerCase()}</strong>
              {whoIsCustomer.age !== "Não informado" && (
                <>
                  {" "}
                  entre <strong>{whoIsCustomer.age.toLowerCase()}</strong>
                </>
              )}
              {whoIsCustomer.context !== "—" && (
                <>
                  , que costumam visitar o local em contexto de{" "}
                  <strong>{whoIsCustomer.context}</strong>
                </>
              )}
              {whoIsCustomer.day !== "—" && (
                <>
                  , principalmente nas <strong>{whoIsCustomer.day}</strong>s
                </>
              )}
              {whoIsCustomer.hour !== "—" && (
                <>
                  {" "}
                  por volta das <strong>{whoIsCustomer.hour}</strong>
                </>
              )}
              . Esta persona representa{" "}
              <strong>aproximadamente {whoIsCustomer.representativity}%</strong> dos{" "}
              {whoIsCustomer.totalCustomers} clientes ativos neste período.
            </p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <InfoPill label="Ticket médio" value={formatBRL(whoIsCustomer.ticket)} />
              <InfoPill
                label="Frequência"
                value={
                  whoIsCustomer.frequency != null
                    ? `${whoIsCustomer.frequency.toFixed(1)}x / mês`
                    : "—"
                }
              />
              <InfoPill label="Categoria favorita" value={whoIsCustomer.category} />
              <InfoPill label="Produto favorito" value={whoIsCustomer.product} />
              <InfoPill label="Origem predominante" value={whoIsCustomer.source} />
              <InfoPill
                label="Retorno a cada"
                value={
                  whoIsCustomer.avgGapDays != null
                    ? `${Math.round(whoIsCustomer.avgGapDays)} dias`
                    : "—"
                }
              />
              <InfoPill
                label="Permanência"
                value={
                  whoIsCustomer.avgStayMin != null
                    ? `${Math.round(whoIsCustomer.avgStayMin)} min`
                    : "—"
                }
              />
              <InfoPill label="Melhor dia" value={whoIsCustomer.day} />
            </div>
          </div>
        </Section>
      )}

      {/* ── SEÇÃO 2: COMO ESSA PESSOA COMPRA? ── */}
      {howTheyBuy && howTheyBuy.length > 0 && (
        <Section title="Como essa pessoa compra?" icon={ShoppingCart}>
          <div className="grid gap-3 sm:grid-cols-2">
            {howTheyBuy.map((insight, i) => (
              <InsightCard key={i} {...insight} />
            ))}
          </div>
        </Section>
      )}

      {/* ── SEÇÃO 3: O QUE ESSA PESSOA VALORIZA? ── */}
      {whatTheyValue && whatTheyValue.length > 0 && (
        <Section title="O que essa pessoa valoriza?" icon={ThumbsUp}>
          <div className="grid gap-3 sm:grid-cols-2">
            {whatTheyValue.map((v, i) => (
              <div key={i} className="rounded-xl border bg-card p-4">
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-sm font-bold">{v.label}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                      v.confidence === "alta"
                        ? "bg-green-500/10 text-green-700"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    confiança {v.confidence}
                  </span>
                </div>
                <p className="text-xs leading-relaxed text-muted-foreground">{v.description}</p>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* ── SEÇÃO 4: O QUE MOTIVA A COMPRA? ── */}
      {purchaseMotivation && purchaseMotivation.length > 0 && (
        <Section title="O que motiva a compra?" icon={Lightbulb}>
          <div className="grid gap-3 sm:grid-cols-2">
            {purchaseMotivation.map((m, i) => (
              <InsightCard key={i} {...m} />
            ))}
          </div>
        </Section>
      )}

      {/* ── SEÇÃO 5: O QUE PODE ESTAR IMPEDINDO NOVAS COMPRAS? ── */}
      {barriers && barriers.length > 0 && (
        <Section title="O que pode estar impedindo novas compras?" icon={ShieldAlert}>
          <div className="grid gap-3 sm:grid-cols-2">
            {barriers.map((b, i) => (
              <div
                key={i}
                className={`rounded-xl border p-4 ${
                  b.severity === "alert"
                    ? "border-destructive/30 bg-destructive/5"
                    : b.severity === "warning"
                      ? "border-orange-500/30 bg-orange-500/5"
                      : "border-blue-500/30 bg-blue-500/5"
                }`}
              >
                <div className="mb-1 flex items-center gap-1.5">
                  <AlertTriangle
                    className={`size-3.5 ${
                      b.severity === "alert"
                        ? "text-destructive"
                        : b.severity === "warning"
                          ? "text-orange-500"
                          : "text-blue-500"
                    }`}
                  />
                  <span className="text-sm font-bold">{b.label}</span>
                </div>
                <p className="text-xs leading-relaxed text-muted-foreground">{b.description}</p>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* ── SEÇÃO 6: COMO SE COMUNICAR? ── */}
      {communicationAdvice && communicationAdvice.length > 0 && (
        <Section title="Como você deve se comunicar?" icon={Megaphone}>
          <div className="grid gap-3 sm:grid-cols-2">
            {communicationAdvice.map((a, i) => (
              <InsightCard key={i} {...a} />
            ))}
          </div>
        </Section>
      )}

      {/* ── SEÇÃO 7: OPORTUNIDADES ── */}
      {opportunities && opportunities.length > 0 && (
        <Section title="Oportunidades" icon={TrendingUp}>
          <div className="grid gap-3 sm:grid-cols-2">
            {opportunities.map((opp, i) => (
              <div key={i} className="rounded-xl border border-green-500/30 bg-green-500/5 p-4">
                <div className="mb-1 flex items-center gap-1.5">
                  <opp.icon className="size-3.5 text-green-600" />
                  <span className="text-sm font-bold">{opp.recommendation}</span>
                </div>
                <p className="text-xs leading-relaxed text-muted-foreground">{opp.reason}</p>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* ── SEÇÃO 8: RESUMO EXECUTIVO ── */}
      {executiveSummary && (
        <Section title="Resumo Executivo" icon={Sparkles}>
          <div className="rounded-xl border border-primary/20 bg-primary/10 p-6">
            <div className="flex items-start gap-3">
              <Sparkles className="mt-0.5 size-5 shrink-0 text-primary" />
              <p className="text-sm leading-relaxed text-foreground">{executiveSummary}</p>
            </div>
          </div>
        </Section>
      )}
    </div>
  );
}

// ── Helpers ──

function getPeriodMonths(period: PeriodKey): number {
  switch (period) {
    case "today":
      return 1 / 30;
    case "7d":
      return 7 / 30;
    case "30d":
      return 1;
    case "90d":
      return 3;
    case "year":
      return 12;
  }
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

function Section({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon?: any;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        {Icon && <Icon className="size-4 text-primary" />}
        <h2 className="text-sm font-semibold tracking-wide uppercase text-muted-foreground">
          {title}
        </h2>
      </div>
      {children}
    </div>
  );
}

function InsightCard({
  label,
  description,
  icon: Icon,
}: {
  label: string;
  description: string;
  icon: any;
}) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="mb-1 flex items-center gap-1.5">
        <Icon className="size-3.5 text-primary" />
        <span className="text-sm font-bold">{label}</span>
      </div>
      <p className="text-xs leading-relaxed text-muted-foreground">{description}</p>
    </div>
  );
}

function InfoPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-muted/50 px-3 py-2">
      <div className="text-[10px] uppercase text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-sm font-bold">{value}</div>
    </div>
  );
}

export default PersonaInteligentePage;
