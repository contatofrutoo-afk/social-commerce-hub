import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ArrowRight,
  Banknote,
  Calendar,
  CheckCircle2,
  Clock,
  CreditCard,
  Eye,
  Flame,
  Heart,
  Lightbulb,
  Megaphone,
  MessageCircle,
  Minus,
  Package,
  Sparkles,
  Store,
  Target,
  TrendingDown,
  TrendingUp,
  Users,
  Zap,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/persona")({
  component: InteligenciaWeazePage,
  head: () => ({ meta: [{ title: "Inteligência WEAZE — WEAZE" }] }),
});

type PeriodKey = "today" | "7d" | "30d" | "90d" | "year";

const PERIOD_LABELS: Record<PeriodKey, string> = {
  today: "Hoje",
  "7d": "7 dias",
  "30d": "30 dias",
  "90d": "90 dias",
  year: "Ano",
};

const PERIOD_LABELS_LONG: Record<PeriodKey, string> = {
  today: "hoje",
  "7d": "últimos 7 dias",
  "30d": "últimos 30 dias",
  "90d": "últimos 90 dias",
  year: "este ano",
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

function getPrevBounds(period: PeriodKey) {
  const { start, end } = getPeriodBounds(period);
  if (period === "today") {
    return { start: start - 86400000, end: start };
  }
  const len = end - start;
  return { start: start - len, end: start };
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

function InteligenciaWeazePage() {
  const companyId = useCompanyId();
  const [period, setPeriod] = useState<PeriodKey>("30d");
  const { start: pStart, end: pEnd } = getPeriodBounds(period);
  const prevBounds = getPrevBounds(period);

  // ── Data ──
  const { data, isLoading } = useQuery({
    queryKey: ["weaze-inteligencia", companyId],
    queryFn: async () => {
      const [customers, checkins, orders, events, posts, reactions, comments, likes, products] =
        await Promise.all([
          supabase
            .from("customers")
            .select("id, first_visit_at, last_visit_at, visit_count, created_at")
            .eq("company_id", companyId!)
            .then((r) => r.data ?? []),
          supabase
            .from("checkins")
            .select("id, context, source, created_at, customer_id")
            .eq("company_id", companyId!)
            .then((r) => r.data ?? []),
          supabase
            .from("orders")
            .select(
              "id, status, payment_status, payment_method, payment_provider, total, created_at, payment_approved_at, customer_id, order_items(product_id, quantity, unit_price)",
            )
            .eq("company_id", companyId!)
            .then((r) => r.data ?? []),
          supabase
            .from("product_events")
            .select("event_type, product_id, customer_id, created_at")
            .eq("company_id", companyId!)
            .then((r) => r.data ?? []),
          supabase
            .from("posts")
            .select(
              "id, text, category, author_type, customer_id, created_at, post_products(product:products(id, name, category))",
            )
            .eq("company_id", companyId!)
            .then((r) => r.data ?? []),
          supabase
            .from("post_reactions")
            .select("post_id, type, customer_id, created_at, post:posts!inner(company_id)")
            .eq("post.company_id", companyId!)
            .then((r) => r.data ?? []),
          supabase
            .from("comments")
            .select("id, post_id, customer_id, created_at, post:posts!inner(company_id)")
            .eq("post.company_id", companyId!)
            .then((r) => r.data ?? []),
          supabase
            .from("product_likes")
            .select("product_id, customer_id, created_at, product:products!inner(company_id)")
            .eq("product.company_id", companyId!)
            .then((r) => r.data ?? []),
          supabase
            .from("products")
            .select("id, name, category, price, available")
            .eq("company_id", companyId!)
            .then((r) => r.data ?? []),
        ]);
      return {
        customers: customers as any[],
        checkins: checkins as any[],
        orders: orders as any[],
        events: events as any[],
        posts: posts as any[],
        reactions: reactions as any[],
        comments: comments as any[],
        likes: likes as any[],
        products: products as any[],
      };
    },
    enabled: !!companyId,
  });

  const customers = data?.customers ?? [];
  const checkins = data?.checkins ?? [];
  const orders = data?.orders ?? [];
  const events = data?.events ?? [];
  const posts = data?.posts ?? [];
  const reactions = data?.reactions ?? [];
  const comments = data?.comments ?? [];
  const likes = data?.likes ?? [];
  const products = data?.products ?? [];

  const productMap = useMemo(() => {
    const m = new Map<string, any>();
    (products ?? []).forEach((p: any) => m.set(p.id, p));
    return m;
  }, [products]);

  // ── Period-filtered data ──
  const periodOrders = useMemo(
    () => (orders ?? []).filter((o: any) => inRange(o.created_at, pStart, pEnd)),
    [orders, pStart, pEnd],
  );
  const periodCheckins = useMemo(
    () => (checkins ?? []).filter((c: any) => inRange(c.created_at, pStart, pEnd)),
    [checkins, pStart, pEnd],
  );
  const periodEvents = useMemo(
    () => (events ?? []).filter((e: any) => inRange(e.created_at, pStart, pEnd)),
    [events, pStart, pEnd],
  );
  const periodReactions = useMemo(
    () => (reactions ?? []).filter((r: any) => inRange(r.created_at, pStart, pEnd)),
    [reactions, pStart, pEnd],
  );
  const periodComments = useMemo(
    () => (comments ?? []).filter((c: any) => inRange(c.created_at, pStart, pEnd)),
    [comments, pStart, pEnd],
  );
  const periodLikes = useMemo(
    () => (likes ?? []).filter((l: any) => inRange(l.created_at, pStart, pEnd)),
    [likes, pStart, pEnd],
  );
  const prevOrders = useMemo(
    () =>
      (orders ?? []).filter((o: any) => inRange(o.created_at, prevBounds.start, prevBounds.end)),
    [orders, prevBounds],
  );

  // ══════════════════════════════════════════════════
  // PRODUTOS
  // ══════════════════════════════════════════════════
  const productStats = useMemo(() => {
    const sold: Record<string, { qty: number; rev: number }> = {};
    const viewed: Record<string, number> = {};
    const carted: Record<string, number> = {};
    periodOrders.forEach((o: any) => {
      (o.order_items ?? []).forEach((i: any) => {
        if (!sold[i.product_id]) sold[i.product_id] = { qty: 0, rev: 0 };
        sold[i.product_id].qty += i.quantity;
        sold[i.product_id].rev += Number(i.unit_price) * i.quantity;
      });
    });
    periodEvents.forEach((e: any) => {
      if (e.event_type === "view") viewed[e.product_id] = (viewed[e.product_id] ?? 0) + 1;
      if (e.event_type === "cart_add") carted[e.product_id] = (carted[e.product_id] ?? 0) + 1;
    });
    const liked: Record<string, number> = {};
    periodLikes.forEach((l: any) => {
      liked[l.product_id] = (liked[l.product_id] ?? 0) + 1;
    });

    const name = (id: string) => productMap.get(id)?.name ?? "Item";

    const bestSellers = Object.entries(sold)
      .map(([id, v]) => ({ id, name: name(id), qty: v.qty, rev: v.rev }))
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 5);
    const mostViewed = Object.entries(viewed)
      .map(([id, count]) => ({ id, name: name(id), count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
    const mostLiked = Object.entries(liked)
      .map(([id, count]) => ({ id, name: name(id), count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
    const conv = Object.entries(viewed)
      .map(([id, v]) => ({
        id,
        name: name(id),
        views: v,
        sales: sold[id]?.qty ?? 0,
        rate: v > 0 ? ((sold[id]?.qty ?? 0) / v) * 100 : 0,
      }))
      .filter((x) => x.views > 0)
      .sort((a, b) => b.rate - a.rate)
      .slice(0, 5);
    const boughtSet = new Set(Object.keys(sold));
    const interest = Object.entries(viewed)
      .map(([id, count]) => ({ id, name: name(id), views: count, likes: liked[id] ?? 0 }))
      .filter((x) => !boughtSet.has(x.id))
      .sort((a, b) => b.views + b.likes - (a.views + a.likes))
      .slice(0, 5);

    return { bestSellers, mostViewed, mostLiked, conv, interest };
  }, [periodOrders, periodEvents, periodLikes, productMap]);

  const categoryTrend = useMemo(() => {
    const qtyIn = (arr: any[]) => {
      const m: Record<string, number> = {};
      arr.forEach((o: any) => {
        (o.order_items ?? []).forEach((i: any) => {
          const cat = productMap.get(i.product_id)?.category || "Sem categoria";
          m[cat] = (m[cat] ?? 0) + i.quantity;
        });
      });
      return m;
    };
    const cur = qtyIn(periodOrders);
    const prev = qtyIn(prevOrders);
    const cats = new Set([...Object.keys(cur), ...Object.keys(prev)]);
    const growing: { cat: string; cur: number; growth: number }[] = [];
    const declining: { cat: string; cur: number; growth: number }[] = [];
    cats.forEach((cat) => {
      const c = cur[cat] ?? 0;
      const p = prev[cat] ?? 0;
      const growth = p > 0 ? ((c - p) / p) * 100 : c > 0 ? 100 : 0;
      if (c > p && c >= 1) growing.push({ cat, cur: c, growth });
      else if (p > c && p >= 1) declining.push({ cat, cur: c, growth });
    });
    growing.sort((a, b) => b.growth - a.growth);
    declining.sort((a, b) => a.growth - b.growth);
    return { growing, declining };
  }, [periodOrders, prevOrders, productMap]);

  // ══════════════════════════════════════════════════
  // CLIENTES
  // ══════════════════════════════════════════════════
  const customerStats = useMemo(() => {
    const active = new Set<string>();
    periodCheckins.forEach((c: any) => c.customer_id && active.add(c.customer_id));
    periodOrders.forEach((o: any) => o.customer_id && active.add(o.customer_id));
    const newCount = customers.filter((c: any) => inRange(c.first_visit_at, pStart, pEnd)).length;

    const perCust: Record<string, number> = {};
    periodCheckins.forEach((c: any) => {
      if (c.customer_id) perCust[c.customer_id] = (perCust[c.customer_id] ?? 0) + 1;
    });
    const returningCount = Object.values(perCust).filter((n) => n >= 2).length;
    const returnRate = active.size ? (returningCount / active.size) * 100 : 0;

    const hours: Record<number, number> = {};
    const days: Record<number, number> = {};
    periodCheckins.forEach((c: any) => {
      const h = new Date(c.created_at).getHours();
      hours[h] = (hours[h] ?? 0) + 1;
      const d = new Date(c.created_at).getDay();
      days[d] = (days[d] ?? 0) + 1;
    });
    const topHour = Object.entries(hours).sort((a, b) => b[1] - a[1])[0];
    const topDay = Object.entries(days).sort((a, b) => b[1] - a[1])[0];

    const engaged = new Set<string>();
    periodReactions.forEach((r: any) => r.customer_id && engaged.add(r.customer_id));
    periodComments.forEach((c: any) => c.customer_id && engaged.add(c.customer_id));
    posts.forEach((p: any) => p.customer_id && engaged.add(p.customer_id));

    const buyers = new Set(periodOrders.map((o: any) => o.customer_id).filter(Boolean));

    return {
      activeCount: active.size,
      newCount,
      returningCount,
      returnRate,
      topHour: topHour ? Number(topHour[0]) : null,
      topDay: topDay ? Number(topDay[0]) : null,
      engagedCount: engaged.size,
      buyerCount: buyers.size,
      checkinCount: periodCheckins.length,
    };
  }, [
    customers,
    periodCheckins,
    periodOrders,
    periodReactions,
    periodComments,
    posts,
    pStart,
    pEnd,
  ]);

  // ══════════════════════════════════════════════════
  // PUBLICAÇÕES
  // ══════════════════════════════════════════════════
  const postStats = useMemo(() => {
    const engByPost: Record<string, { reactions: number; comments: number }> = {};
    periodReactions.forEach((r: any) => {
      if (!engByPost[r.post_id]) engByPost[r.post_id] = { reactions: 0, comments: 0 };
      engByPost[r.post_id].reactions++;
    });
    periodComments.forEach((c: any) => {
      if (!engByPost[c.post_id]) engByPost[c.post_id] = { reactions: 0, comments: 0 };
      engByPost[c.post_id].comments++;
    });

    const ordersByProduct: Record<string, number> = {};
    periodOrders.forEach((o: any) => {
      (o.order_items ?? []).forEach((i: any) => {
        ordersByProduct[i.product_id] = (ordersByProduct[i.product_id] ?? 0) + i.quantity;
      });
    });

    const withEng = posts.map((p: any) => ({
      id: p.id,
      text: p.text,
      category: p.category,
      eng: (engByPost[p.id]?.reactions ?? 0) + (engByPost[p.id]?.comments ?? 0),
      orders: (p.post_products ?? []).reduce(
        (s: number, pp: any) => s + (ordersByProduct[pp.product?.id] ?? 0),
        0,
      ),
    }));

    const topPosts = [...withEng].sort((a, b) => b.eng - a.eng).slice(0, 5);
    const postOrders = withEng
      .filter((p) => p.orders > 0)
      .sort((a, b) => b.orders - a.orders)
      .slice(0, 5);

    const catEng: Record<string, number> = {};
    posts.forEach((p: any) => {
      if (!p.category) return;
      catEng[p.category] =
        (catEng[p.category] ?? 0) +
        (engByPost[p.id]?.reactions ?? 0) +
        (engByPost[p.id]?.comments ?? 0);
    });
    const topCategories = Object.entries(catEng)
      .map(([cat, count]) => ({ cat, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 4);

    const hourCount: Record<number, number> = {};
    periodReactions.forEach((r: any) => {
      const h = new Date(r.created_at).getHours();
      hourCount[h] = (hourCount[h] ?? 0) + 1;
    });
    periodComments.forEach((c: any) => {
      const h = new Date(c.created_at).getHours();
      hourCount[h] = (hourCount[h] ?? 0) + 1;
    });
    const bestHour = Object.entries(hourCount).sort((a, b) => b[1] - a[1])[0];

    return {
      topPosts,
      postOrders,
      topCategories,
      bestHour: bestHour ? Number(bestHour[0]) : null,
    };
  }, [posts, periodReactions, periodComments, periodOrders]);

  // ══════════════════════════════════════════════════
  // PAGAMENTOS
  // ══════════════════════════════════════════════════
  const paymentStats = useMemo(() => {
    const total = periodOrders.length;
    const paid = periodOrders.filter((o: any) => o.payment_status === "paid");
    const pending = periodOrders.filter(
      (o: any) => o.payment_status === "pending" || o.status === "awaiting_payment",
    );
    const failed = periodOrders.filter(
      (o: any) => o.payment_status === "failed" || o.payment_status === "cancelled",
    );
    const paidTotal = paid.reduce((s: number, o: any) => s + Number(o.total || 0), 0);
    const pendingTotal = pending.reduce((s: number, o: any) => s + Number(o.total || 0), 0);
    const approvalRate = total ? (paid.length / total) * 100 : 0;

    const times: number[] = [];
    paid.forEach((o: any) => {
      if (!o.payment_approved_at) return;
      const d =
        (new Date(o.payment_approved_at).getTime() - new Date(o.created_at).getTime()) / 60000;
      if (Number.isFinite(d) && d >= 0) times.push(d);
    });
    const avgTimeMinutes = times.length ? times.reduce((a, b) => a + b, 0) / times.length : null;

    const methods: Record<string, { count: number; total: number }> = {};
    periodOrders.forEach((o: any) => {
      const m = o.payment_method ?? "não informado";
      if (!methods[m]) methods[m] = { count: 0, total: 0 };
      methods[m].count++;
      methods[m].total += Number(o.total || 0);
    });
    const methodList = Object.entries(methods)
      .map(([method, v]) => ({ method, ...v }))
      .sort((a, b) => b.total - a.total);

    return {
      total,
      paidCount: paid.length,
      pendingCount: pending.length,
      failedCount: failed.length,
      paidTotal,
      pendingTotal,
      approvalRate,
      avgTimeMinutes,
      methodList,
    };
  }, [periodOrders]);

  // ══════════════════════════════════════════════════
  // ALERTAS, OPORTUNIDADES, RECOMENDAÇÕES, INSIGHTS
  // ══════════════════════════════════════════════════
  const alerts = useMemo(() => {
    const list: { label: string; description: string; severity: "alert" | "warning" | "info" }[] =
      [];

    if (periodOrders.length >= 5 && paymentStats.approvalRate < 60) {
      list.push({
        label: "Muitos pedidos sem pagamento",
        description: `${paymentStats.approvalRate.toFixed(0)}% dos pedidos do período foram pagos. Vale revisar o processo de cobrança e lembrar o cliente de finalizar.`,
        severity: "alert",
      });
    }

    const viewers = new Set(
      periodEvents
        .filter((e: any) => e.event_type === "view")
        .map((e: any) => e.customer_id)
        .filter(Boolean),
    );
    const carters = new Set(
      periodEvents
        .filter((e: any) => e.event_type === "cart_add")
        .map((e: any) => e.customer_id)
        .filter(Boolean),
    );
    const buyers = new Set(periodOrders.map((o: any) => o.customer_id).filter(Boolean));
    if (carters.size > 0 && buyers.size > 0) {
      const abandoned = new Set([...carters].filter((cid) => !buyers.has(cid)));
      const pct = (abandoned.size / carters.size) * 100;
      if (pct >= 40) {
        list.push({
          label: "Sacola montada sem finalizar compra",
          description: `${pct.toFixed(0)}% dos clientes que adicionaram à sacola não concluíram o pedido. Um lembrete ou incentivo pode recuperar essas vendas.`,
          severity: "alert",
        });
      }
    }
    if (viewers.size > 0 && carters.size > 0) {
      const noCart = new Set([...viewers].filter((cid) => !carters.has(cid)));
      const pct = (noCart.size / viewers.size) * 100;
      if (pct >= 50) {
        list.push({
          label: "Visualizam produtos sem adicionar",
          description: `${pct.toFixed(0)}% dos clientes visualizam produtos mas não colocam na sacola. Avalie preço, descrição e fotos dos itens.`,
          severity: "warning",
        });
      }
    }

    if (paymentStats.pendingTotal > 0) {
      list.push({
        label: "Pedidos aguardando pagamento",
        description: `${paymentStats.pendingCount} pedido${paymentStats.pendingCount > 1 ? "s" : ""} em aberto somando ${formatBRL(paymentStats.pendingTotal)}. Acompanhe para evitar cancelamentos.`,
        severity: "warning",
      });
    }

    if (customerStats.returnRate < 25 && customerStats.activeCount >= 5) {
      list.push({
        label: "Baixo retorno de clientes",
        description: `Apenas ${customerStats.returnRate.toFixed(0)}% dos clientes do período voltaram mais de uma vez. Reforçar a experiência pode aumentar a fidelidade.`,
        severity: "info",
      });
    }

    return list;
  }, [periodOrders, paymentStats, periodEvents, customerStats]);

  const opportunities = useMemo(() => {
    const list: { recommendation: string; reason: string }[] = [];

    if (productStats.bestSellers[0]) {
      const p = productStats.bestSellers[0];
      list.push({
        recommendation: `Destaque "${p.name}" nas próximas publicações`,
        reason: `É o produto mais vendido do período (${p.qty} unidade${p.qty > 1 ? "s" : ""}, ${formatBRL(p.rev)}). Produtos já aceitos pelo público convertem melhor.`,
      });
    }

    if (categoryTrend.growing[0]) {
      const c = categoryTrend.growing[0];
      list.push({
        recommendation: `Aposte na categoria "${c.cat}"`,
        reason: `As vendas dessa categoria cresceram ${c.growth.toFixed(0)}% em relação ao período anterior. É um bom momento para novidades e reforço de estoque.`,
      });
    }

    if (postStats.bestHour != null) {
      list.push({
        recommendation: `Publique perto das ${String(postStats.bestHour).padStart(2, "0")}h`,
        reason: `É quando seu público mais interage no feed. Publicar 1 a 2 horas antes aumenta a chance de engajamento.`,
      });
    }

    if (customerStats.returningCount >= 3) {
      list.push({
        recommendation: "Crie um programa de fidelidade",
        reason: `${customerStats.returningCount} cliente${customerStats.returningCount > 1 ? "s" : ""} retornou${customerStats.returningCount > 1 ? "ram" : ""} mais de uma vez no período. Recompensar recompra é o caminho mais barato de vender mais.`,
      });
    }

    if (productStats.interest[0]) {
      const p = productStats.interest[0];
      list.push({
        recommendation: `Transforme interesse em venda: "${p.name}"`,
        reason: `${p.views} visualizaç${p.views > 1 ? "ões" : "ão"} sem nenhuma venda. Oferecer um incentivo ou reposicionar o produto pode destravar esse público.`,
      });
    }

    return list;
  }, [productStats, categoryTrend, postStats, customerStats]);

  const recommendations = useMemo(() => {
    const list: { title: string; detail: string; icon: any; tone: "action" | "alert" | "info" }[] =
      [];

    if (paymentStats.pendingCount > 0) {
      list.push({
        title: `Acompanhe ${paymentStats.pendingCount} pedido${paymentStats.pendingCount > 1 ? "s" : ""} aguardando pagamento`,
        detail: `${formatBRL(paymentStats.pendingTotal)} em aberto. Lembre os clientes para reduzir cancelamentos.`,
        icon: Clock,
        tone: "alert",
      });
    }

    if (productStats.interest[0]) {
      const p = productStats.interest[0];
      list.push({
        title: `Promova "${p.name}" para quem já visualizou`,
        detail: `${p.views} pessoas viram o produto sem comprar. Uma oferta pontual pode converter.`,
        icon: Eye,
        tone: "action",
      });
    }

    if (postStats.bestHour != null) {
      list.push({
        title: `Publique conteúdo por volta das ${String(postStats.bestHour).padStart(2, "0")}h`,
        detail:
          "Aproveite o horário em que seu público mais interage para colocar novidades no ar.",
        icon: Megaphone,
        tone: "action",
      });
    }

    if (categoryTrend.declining[0]) {
      const c = categoryTrend.declining[0];
      list.push({
        title: `Revise a categoria "${c.cat}", que caiu ${Math.abs(c.growth).toFixed(0)}%`,
        detail: "Verifique estoque, preço e apresentação dos itens dessa categoria.",
        icon: TrendingDown,
        tone: "info",
      });
    }

    if (customerStats.buyerCount > 0 && customerStats.engagedCount < customerStats.buyerCount) {
      list.push({
        title: "Peça avaliações e fotos após a compra",
        detail: `Você tem ${customerStats.buyerCount} compradore${customerStats.buyerCount > 1 ? "s" : ""} e pouca interação. Conteúdo de clientes atrai novos pedidos.`,
        icon: MessageCircle,
        tone: "info",
      });
    }

    if (list.length === 0 && periodOrders.length > 0) {
      list.push({
        title: "Continue publicando nos horários de pico",
        detail:
          "Seus números estão saudáveis. Manter a frequência de conteúdo é o melhor próximo passo.",
        icon: CheckCircle2,
        tone: "action",
      });
    }

    return list;
  }, [paymentStats, productStats, postStats, categoryTrend, customerStats, periodOrders]);

  const weazeInsights = useMemo(() => {
    const list: { text: string; tone: "positive" | "alert" | "info" }[] = [];
    const prev = paymentStats.paidTotal > 0 && prevOrders.length > 0;
    if (prev) {
      const prevPaid = prevOrders
        .filter((o: any) => o.payment_status === "paid")
        .reduce((s: number, o: any) => s + Number(o.total || 0), 0);
      if (prevPaid > 0) {
        const growth = ((paymentStats.paidTotal - prevPaid) / prevPaid) * 100;
        if (Math.abs(growth) >= 5) {
          list.push({
            text:
              growth > 0
                ? `A receita cresceu ${growth.toFixed(0)}% em relação ao período anterior.`
                : `A receita caiu ${Math.abs(growth).toFixed(0)}% em relação ao período anterior.`,
            tone: growth > 0 ? "positive" : "alert",
          });
        }
      }
    }

    if (productStats.bestSellers[0]) {
      list.push({
        text: `${productStats.bestSellers[0].name} é o produto mais vendido, gerando ${formatBRL(productStats.bestSellers[0].rev)}.`,
        tone: "info",
      });
    }

    if (customerStats.topDay != null) {
      list.push({
        text: `${DAY_NAMES[customerStats.topDay]} é o dia com mais movimento do período.`,
        tone: "info",
      });
    }

    if (customerStats.activeCount > 0 && customerStats.engagedCount > 0) {
      const engPct = (customerStats.engagedCount / customerStats.activeCount) * 100;
      list.push({
        text: `${engPct.toFixed(0)}% dos clientes ativos interagem com o feed (curtidas, comentários ou publicações).`,
        tone: engPct >= 20 ? "positive" : "info",
      });
    }

    if (paymentStats.approvalRate > 0) {
      list.push({
        text: `${paymentStats.approvalRate.toFixed(0)}% dos pedidos são pagos${paymentStats.avgTimeMinutes != null ? `, em média ${Math.round(paymentStats.avgTimeMinutes)} min após a criação` : ""}.`,
        tone: paymentStats.approvalRate >= 70 ? "positive" : "alert",
      });
    }

    return list.slice(0, 5);
  }, [paymentStats, productStats, customerStats, prevOrders]);

  const topRecommendation = recommendations[0]?.title ?? "manter a frequência de publicações";

  const executiveSummary = useMemo(() => {
    if (periodOrders.length === 0) {
      return `Ainda não há movimentação suficiente em ${PERIOD_LABELS_LONG[period]}. Conforme check-ins, pedidos e interações chegarem, este resumo passa a ser gerado automaticamente.`;
    }
    const ticket = paymentStats.paidCount ? paymentStats.paidTotal / paymentStats.paidCount : 0;
    const parts: string[] = [];
    parts.push(
      `Neste período, o negócio faturou ${formatBRL(paymentStats.paidTotal)} com ${paymentStats.paidCount} pedido${paymentStats.paidCount > 1 ? "s" : ""} pagos e ticket médio de ${formatBRL(ticket)}.`,
    );
    if (productStats.bestSellers[0]) {
      parts.push(`O produto que mais vendeu foi "${productStats.bestSellers[0].name}".`);
    }
    if (customerStats.topDay != null) {
      parts.push(
        `${DAY_NAMES[customerStats.topDay].charAt(0).toUpperCase()}${DAY_NAMES[customerStats.topDay].slice(1)} é o dia de maior movimento${customerStats.topHour != null ? `, com pico por volta das ${String(customerStats.topHour).padStart(2, "0")}h` : ""}.`,
      );
    }
    if (categoryTrend.growing[0]) {
      parts.push(`A categoria "${categoryTrend.growing[0].cat}" está em alta.`);
    }
    if (customerStats.activeCount > 0) {
      parts.push(
        `${customerStats.activeCount} cliente${customerStats.activeCount > 1 ? "s" : ""} estiveram ativos, sendo ${customerStats.newCount} novo${customerStats.newCount > 1 ? "s" : ""}.`,
      );
    }
    parts.push(`O próximo passo recomendado é: ${topRecommendation.toLowerCase()}.`);
    return parts.join(" ");
  }, [
    periodOrders,
    paymentStats,
    productStats,
    customerStats,
    categoryTrend,
    period,
    topRecommendation,
  ]);

  // ══════════════════════════════════════════════════
  // COMPARATIVOS
  // ══════════════════════════════════════════════════
  const comparativos = useMemo(() => {
    const keys: PeriodKey[] = ["today", "7d", "30d", "90d", "year"];
    return keys.map((k) => {
      const { start, end } = getPeriodBounds(k);
      const prev = getPrevBounds(k);
      const o = orders.filter((x: any) => inRange(x.created_at, start, end));
      const po = orders.filter((x: any) => inRange(x.created_at, prev.start, prev.end));
      const paid = o.filter((x: any) => x.payment_status === "paid");
      const paidPrev = po.filter((x: any) => x.payment_status === "paid");
      const rev = paid.reduce((s: number, x: any) => s + Number(x.total || 0), 0);
      const revPrev = paidPrev.reduce((s: number, x: any) => s + Number(x.total || 0), 0);
      const cust = new Set<string>();
      checkins
        .filter((c: any) => inRange(c.created_at, start, end))
        .forEach((c: any) => c.customer_id && cust.add(c.customer_id));
      o.forEach((x: any) => x.customer_id && cust.add(x.customer_id));
      const custPrev = new Set<string>();
      checkins
        .filter((c: any) => inRange(c.created_at, prev.start, prev.end))
        .forEach((c: any) => c.customer_id && custPrev.add(c.customer_id));
      po.forEach((x: any) => x.customer_id && custPrev.add(x.customer_id));
      const conversao = o.length ? (paid.length / o.length) * 100 : 0;
      const conversaoPrev = po.length ? (paidPrev.length / po.length) * 100 : 0;
      const ticket = paid.length ? rev / paid.length : 0;
      const ticketPrev = paidPrev.length ? revPrev / paidPrev.length : 0;
      return {
        period: k,
        receita: rev,
        receitaPrev: revPrev,
        pedidos: o.length,
        pedidosPrev: po.length,
        ticket,
        ticketPrev,
        clientes: cust.size,
        clientesPrev: custPrev.size,
        conversao,
        conversaoPrev,
        pagamentos: paid.length,
        pagamentosPrev: paidPrev.length,
      };
    });
  }, [orders, checkins]);

  const compRows = [
    {
      key: "receita",
      label: "Receita",
      get: (r: any) => r.receita,
      getPrev: (r: any) => r.receitaPrev,
      fmt: (v: number) => formatBRL(v),
    },
    {
      key: "pedidos",
      label: "Pedidos",
      get: (r: any) => r.pedidos,
      getPrev: (r: any) => r.pedidosPrev,
      fmt: (v: number) => v.toLocaleString("pt-BR"),
    },
    {
      key: "ticket",
      label: "Ticket médio",
      get: (r: any) => r.ticket,
      getPrev: (r: any) => r.ticketPrev,
      fmt: (v: number) => formatBRL(v),
    },
    {
      key: "clientes",
      label: "Clientes",
      get: (r: any) => r.clientes,
      getPrev: (r: any) => r.clientesPrev,
      fmt: (v: number) => v.toLocaleString("pt-BR"),
    },
    {
      key: "conversao",
      label: "Conversão",
      get: (r: any) => r.conversao,
      getPrev: (r: any) => r.conversaoPrev,
      fmt: (v: number) => `${v.toFixed(0)}%`,
    },
    {
      key: "pagamentos",
      label: "Pagamentos",
      get: (r: any) => r.pagamentos,
      getPrev: (r: any) => r.pagamentosPrev,
      fmt: (v: number) => v.toLocaleString("pt-BR"),
    },
  ];

  // ── Render ──

  if (!companyId || isLoading)
    return <div className="py-8 text-center text-muted-foreground">Carregando...</div>;

  const hasAnyData =
    orders.length > 0 || checkins.length > 0 || events.length > 0 || posts.length > 0;

  const ticketCurrent = paymentStats.paidCount
    ? paymentStats.paidTotal / paymentStats.paidCount
    : 0;

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Inteligência WEAZE</h1>
          <p className="text-sm text-muted-foreground">
            Consultor automático do seu negócio, baseado apenas em dados reais da plataforma
          </p>
        </div>
        <PeriodSelector current={period} onChange={setPeriod} />
      </div>

      {!hasAnyData ? (
        <div className="rounded-xl border border-dashed bg-muted/20 p-8 text-center">
          <Sparkles className="mx-auto mb-3 size-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Ainda não há dados suficientes para gerar as análises. Assim que seus clientes fizerem
            check-in, pedidos e interações, a Inteligência WEAZE começa a funcionar.
          </p>
        </div>
      ) : (
        <>
          {/* ── KPI strip ── */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            <KpiCard
              label="Receita (paga)"
              value={formatBRL(paymentStats.paidTotal)}
              icon={Banknote}
            />
            <KpiCard
              label="Pedidos"
              value={periodOrders.length.toLocaleString("pt-BR")}
              icon={Package}
            />
            <KpiCard label="Ticket médio" value={formatBRL(ticketCurrent)} icon={Target} />
            <KpiCard
              label="Clientes ativos"
              value={customerStats.activeCount.toLocaleString("pt-BR")}
              icon={Users}
            />
            <KpiCard
              label="Conversão"
              value={`${paymentStats.approvalRate.toFixed(0)}%`}
              icon={CheckCircle2}
            />
          </div>

          {/* ── BLOCK 1: RESUMO EXECUTIVO ── */}
          <Section title="Resumo Executivo" icon={Sparkles}>
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-5">
              <p className="text-sm leading-relaxed text-foreground">{executiveSummary}</p>
            </div>
          </Section>

          {/* ── BLOCKS 2 + 3: OPORTUNIDADES + ALERTAS ── */}
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="space-y-6">
              <Section title="Oportunidades" icon={Store}>
                {opportunities.length === 0 ? (
                  <EmptyCard />
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {opportunities.map((o, i) => (
                      <div
                        key={i}
                        className="rounded-xl border border-green-500/30 bg-green-500/5 p-4"
                      >
                        <div className="mb-1 flex items-center gap-1.5">
                          <TrendingUp className="size-3.5 text-green-600" />
                          <span className="text-sm font-bold">{o.recommendation}</span>
                        </div>
                        <p className="text-xs leading-relaxed text-muted-foreground">{o.reason}</p>
                      </div>
                    ))}
                  </div>
                )}
              </Section>
            </div>
            <div className="space-y-6">
              <Section title="Alertas" icon={AlertTriangle}>
                {alerts.length === 0 ? (
                  <EmptyCard text="Nenhum alerta relevante no momento. Bom trabalho!" />
                ) : (
                  <div className="grid gap-3">
                    {alerts.map((a, i) => (
                      <div
                        key={i}
                        className={`rounded-xl border p-4 ${
                          a.severity === "alert"
                            ? "border-destructive/30 bg-destructive/5"
                            : a.severity === "warning"
                              ? "border-orange-500/30 bg-orange-500/5"
                              : "border-blue-500/30 bg-blue-500/5"
                        }`}
                      >
                        <div className="mb-1 flex items-center gap-1.5">
                          <AlertTriangle
                            className={`size-3.5 ${
                              a.severity === "alert"
                                ? "text-destructive"
                                : a.severity === "warning"
                                  ? "text-orange-500"
                                  : "text-blue-500"
                            }`}
                          />
                          <span className="text-sm font-bold">{a.label}</span>
                        </div>
                        <p className="text-xs leading-relaxed text-muted-foreground">
                          {a.description}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </Section>
            </div>
          </div>

          {/* ── BLOCK 4: PRODUTOS ── */}
          <Section title="Produtos" icon={Package}>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              <RankCard
                title="Mais vendidos"
                icon={Flame}
                items={productStats.bestSellers}
                primary={(it: any) => it.name}
                secondary={(it: any) => `${it.qty} un · ${formatBRL(it.rev)}`}
              />
              <RankCard
                title="Mais visualizados"
                icon={Eye}
                items={productStats.mostViewed}
                primary={(it: any) => it.name}
                secondary={(it: any) => `${it.count} views`}
              />
              <RankCard
                title="Mais curtidos"
                icon={Heart}
                items={productStats.mostLiked}
                primary={(it: any) => it.name}
                secondary={(it: any) => `${it.count} curtida${it.count > 1 ? "s" : ""}`}
              />
              <RankCard
                title="Melhor conversão"
                icon={Target}
                items={productStats.conv}
                primary={(it: any) => it.name}
                secondary={(it: any) => `${it.rate.toFixed(0)}% (${it.sales}/${it.views})`}
              />
              <RankCard
                title="Interesse sem venda"
                icon={Eye}
                items={productStats.interest}
                primary={(it: any) => it.name}
                secondary={(it: any) => `${it.views} views`}
              />
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border bg-card p-4">
                <div className="mb-2 flex items-center gap-2">
                  <TrendingUp className="size-4 text-green-600" />
                  <h3 className="text-sm font-semibold">Categorias em crescimento</h3>
                </div>
                {categoryTrend.growing.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    Sem categorias em alta no período.
                  </p>
                ) : (
                  <ul className="space-y-1.5">
                    {categoryTrend.growing.map((c) => (
                      <li key={c.cat} className="flex items-center justify-between text-xs">
                        <span className="font-medium">{c.cat}</span>
                        <span className="flex items-center gap-1 font-semibold text-green-600">
                          <ArrowUp className="size-3" /> +{c.growth.toFixed(0)}%
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="rounded-xl border bg-card p-4">
                <div className="mb-2 flex items-center gap-2">
                  <TrendingDown className="size-4 text-red-500" />
                  <h3 className="text-sm font-semibold">Categorias em queda</h3>
                </div>
                {categoryTrend.declining.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    Nenhuma categoria caindo no período.
                  </p>
                ) : (
                  <ul className="space-y-1.5">
                    {categoryTrend.declining.map((c) => (
                      <li key={c.cat} className="flex items-center justify-between text-xs">
                        <span className="font-medium">{c.cat}</span>
                        <span className="flex items-center gap-1 font-semibold text-red-500">
                          <ArrowDown className="size-3" /> {Math.abs(c.growth).toFixed(0)}%
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </Section>

          {/* ── BLOCK 5: CLIENTES ── */}
          <Section title="Clientes" icon={Users}>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <InfoPill
                label="Ativos no período"
                value={customerStats.activeCount.toLocaleString("pt-BR")}
              />
              <InfoPill
                label="Novos clientes"
                value={customerStats.newCount.toLocaleString("pt-BR")}
              />
              <InfoPill
                label="Retorno (2+ visitas)"
                value={`${customerStats.returnRate.toFixed(0)}%`}
              />
              <InfoPill
                label="Melhor dia / horário"
                value={
                  customerStats.topDay != null
                    ? `${DAY_NAMES[customerStats.topDay]} · ${customerStats.topHour != null ? `${String(customerStats.topHour).padStart(2, "0")}h` : "—"}`
                    : "—"
                }
              />
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <MiniStat
                label="Check-ins"
                value={customerStats.checkinCount.toLocaleString("pt-BR")}
                icon={Calendar}
              />
              <MiniStat
                label="Clientes que compraram"
                value={customerStats.buyerCount.toLocaleString("pt-BR")}
                icon={Package}
              />
              <MiniStat
                label="Clientes que interagem"
                value={customerStats.engagedCount.toLocaleString("pt-BR")}
                icon={MessageCircle}
              />
            </div>
          </Section>

          {/* ── BLOCK 6: PUBLICAÇÕES ── */}
          <Section title="Publicações" icon={Megaphone}>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <RankCard
                title="Maior engajamento"
                icon={MessageCircle}
                items={postStats.topPosts}
                primary={(it: any) =>
                  it.text || `Publicação ${it.category ? `(${it.category})` : ""}`
                }
                secondary={(it: any) => `${it.eng} interações`}
              />
              <RankCard
                title="Que geraram pedidos"
                icon={Package}
                items={postStats.postOrders}
                primary={(it: any) =>
                  it.text || `Publicação ${it.category ? `(${it.category})` : ""}`
                }
                secondary={(it: any) => `${it.orders} un vendidas`}
              />
              <RankCard
                title="Categorias mais engajadas"
                icon={Flame}
                items={postStats.topCategories}
                primary={(it: any) => it.cat}
                secondary={(it: any) => `${it.count} interações`}
              />
              <div className="rounded-xl border bg-card p-4">
                <div className="mb-3 flex items-center gap-2">
                  <Clock className="size-4 text-primary" />
                  <h3 className="text-sm font-semibold">Horário ideal</h3>
                </div>
                {postStats.bestHour == null ? (
                  <p className="text-xs text-muted-foreground">Sem interações no período.</p>
                ) : (
                  <div className="text-center">
                    <div className="text-2xl font-bold text-primary">
                      {String(postStats.bestHour).padStart(2, "0")}h
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Pico de curtidas e comentários. Publique 1 a 2 horas antes.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </Section>

          {/* ── BLOCK 7: PAGAMENTOS ── */}
          <Section title="Pagamentos" icon={Banknote}>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <KpiCard
                label="Taxa de aprovação"
                value={`${paymentStats.approvalRate.toFixed(0)}%`}
                icon={CheckCircle2}
              />
              <KpiCard
                label="Tempo até pagamento"
                value={
                  paymentStats.avgTimeMinutes != null
                    ? `${Math.round(paymentStats.avgTimeMinutes)} min`
                    : "—"
                }
                icon={Clock}
              />
              <KpiCard
                label="Pedidos pagos"
                value={paymentStats.paidCount.toLocaleString("pt-BR")}
                icon={Banknote}
              />
              <KpiCard
                label="Aguardando pagamento"
                value={`${paymentStats.pendingCount.toLocaleString("pt-BR")} · ${formatBRL(paymentStats.pendingTotal)}`}
                icon={CreditCard}
              />
            </div>
            <div className="mt-3 rounded-xl border bg-card p-4">
              <h3 className="mb-3 text-sm font-semibold">Métodos de pagamento</h3>
              {paymentStats.methodList.length === 0 ? (
                <p className="text-xs text-muted-foreground">Sem dados de pagamento no período.</p>
              ) : (
                <div className="grid gap-3 sm:grid-cols-3">
                  {paymentStats.methodList.map((m) => (
                    <div key={m.method} className="rounded-lg bg-muted/50 px-3 py-2">
                      <div className="text-[10px] uppercase text-muted-foreground">{m.method}</div>
                      <div className="mt-0.5 text-sm font-bold">
                        {formatBRL(m.total)} · {m.count} pedido{m.count > 1 ? "s" : ""}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Section>

          {/* ── BLOCK 8: O QUE FAZER AGORA ── */}
          <Section title="O que fazer agora" icon={Zap}>
            <div className="grid gap-3 sm:grid-cols-2">
              {recommendations.map((r, i) => (
                <div key={i} className="rounded-xl border bg-card p-4">
                  <div className="mb-1 flex items-center gap-2">
                    <span
                      className={cn(
                        "grid size-7 shrink-0 place-items-center rounded-lg",
                        r.tone === "alert"
                          ? "bg-orange-500/10 text-orange-500"
                          : r.tone === "info"
                            ? "bg-blue-500/10 text-blue-500"
                            : "bg-primary/10 text-primary",
                      )}
                    >
                      <r.icon className="size-4" />
                    </span>
                    <span className="text-sm font-bold">{r.title}</span>
                  </div>
                  <p className="ml-9 text-xs leading-relaxed text-muted-foreground">{r.detail}</p>
                </div>
              ))}
            </div>
          </Section>

          {/* ── BLOCK 9: INSIGHTS WEAZE ── */}
          <Section title="Insights WEAZE" icon={Lightbulb}>
            <div className="grid gap-3 sm:grid-cols-2">
              {weazeInsights.map((ins, i) => (
                <div
                  key={i}
                  className={cn(
                    "flex items-start gap-2.5 rounded-xl border p-4",
                    ins.tone === "positive"
                      ? "border-green-500/30 bg-green-500/5"
                      : ins.tone === "alert"
                        ? "border-orange-500/30 bg-orange-500/5"
                        : "border-blue-500/30 bg-blue-500/5",
                  )}
                >
                  <Lightbulb
                    className={cn(
                      "mt-0.5 size-4 shrink-0",
                      ins.tone === "positive"
                        ? "text-green-600"
                        : ins.tone === "alert"
                          ? "text-orange-500"
                          : "text-blue-500",
                    )}
                  />
                  <p className="text-xs leading-relaxed text-foreground">{ins.text}</p>
                </div>
              ))}
            </div>
          </Section>

          {/* ── BLOCK 10: COMPARATIVOS ── */}
          <Section title="Comparativos" icon={Calendar}>
            <div className="overflow-x-auto rounded-xl border bg-card">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="px-4 py-2.5 text-xs font-semibold uppercase text-muted-foreground">
                      Métrica
                    </th>
                    {(Object.entries(PERIOD_LABELS) as [PeriodKey, string][]).map(
                      ([key, label]) => (
                        <th
                          key={key}
                          className="px-3 py-2.5 text-xs font-semibold uppercase text-muted-foreground"
                        >
                          {label}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody>
                  {compRows.map((row) => {
                    const max = Math.max(...comparativos.map((r) => row.get(r)), 1);
                    return (
                      <tr key={row.key} className="border-b last:border-0">
                        <td className="px-4 py-3 text-xs font-semibold">{row.label}</td>
                        {comparativos.map((c) => (
                          <td key={c.period} className="px-3 py-3">
                            <div className="font-bold">{row.fmt(row.get(c))}</div>
                            <div className="mt-1 h-1 w-full max-w-20 overflow-hidden rounded-full bg-muted">
                              <div
                                className={cn(
                                  "h-full rounded-full",
                                  row.get(c) > 0 ? "bg-primary/60" : "bg-muted",
                                )}
                                style={{ width: `${Math.min(100, (row.get(c) / max) * 100)}%` }}
                              />
                            </div>
                            <TrendChip cur={row.get(c)} prev={row.getPrev(c)} />
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
              <ArrowRight className="size-3" />
              Cada valor é comparado com o período anterior de mesma duração.
            </div>
          </Section>
        </>
      )}
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
          className={cn(
            "rounded-lg px-3 py-1.5 text-xs font-medium transition-all",
            key === current
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
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
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {title}
        </h2>
      </div>
      {children}
    </div>
  );
}

function KpiCard({ label, value, icon: Icon }: { label: string; value: string; icon: any }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        <Icon className="size-3.5" />
        {label}
      </div>
      <div className="mt-1.5 text-lg font-bold">{value}</div>
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

function MiniStat({ label, value, icon: Icon }: { label: string; value: string; icon: any }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        <Icon className="size-3.5" />
        {label}
      </div>
      <div className="mt-1.5 text-lg font-bold">{value}</div>
    </div>
  );
}

function RankCard({
  title,
  icon: Icon,
  items,
  primary,
  secondary,
}: {
  title: string;
  icon: any;
  items: any[];
  primary: (it: any) => string;
  secondary: (it: any) => string;
}) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="mb-3 flex items-center gap-2">
        <Icon className="size-4 text-primary" />
        <h3 className="text-sm font-semibold">{title}</h3>
      </div>
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground">Sem dados ainda.</p>
      ) : (
        <ol className="space-y-2">
          {items.map((it, i) => (
            <li key={i} className="flex items-center justify-between gap-2 text-xs">
              <span className="flex min-w-0 items-center gap-2">
                <span className="grid size-5 shrink-0 place-items-center rounded-md bg-muted text-[10px] font-bold text-muted-foreground">
                  {i + 1}
                </span>
                <span className="truncate font-medium">{primary(it)}</span>
              </span>
              <span className="shrink-0 text-muted-foreground">{secondary(it)}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function TrendChip({ cur, prev }: { cur: number; prev: number }) {
  const d = prev > 0 ? ((cur - prev) / prev) * 100 : cur > 0 ? 100 : 0;
  const flat = Math.abs(d) < 2;
  return (
    <span
      className={cn(
        "mt-1 inline-flex items-center gap-0.5 text-[10px] font-semibold",
        flat ? "text-muted-foreground" : d > 0 ? "text-green-600" : "text-red-500",
      )}
    >
      {flat ? (
        <Minus className="size-3" />
      ) : d > 0 ? (
        <ArrowUp className="size-3" />
      ) : (
        <ArrowDown className="size-3" />
      )}
      {flat ? "estável" : `${Math.abs(d).toFixed(0)}%`}
    </span>
  );
}

function EmptyCard({ text = "Sem dados suficientes ainda." }: { text?: string }) {
  return (
    <div className="rounded-xl border border-dashed bg-muted/20 p-4 text-center text-xs text-muted-foreground">
      {text}
    </div>
  );
}

export default InteligenciaWeazePage;
