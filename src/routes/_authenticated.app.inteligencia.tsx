import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { VisitContext } from "@/repositories";
import { relativeTime, formatBRL } from "@/lib/format";
import {
  ScanLine, Eye, ShoppingCart, Package, TrendingUp, Users, Clock, Calendar,
  Hash, ArrowUp, ArrowDown, Minus, Sparkles, Lightbulb, AlertTriangle,
  CheckCircle2, Info, BarChart3, Search, UserCheck, UserX, Crown,
  UserPlus, Activity, Target, Zap, ChartColumn,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/inteligencia")({
  component: InteligenciaPage,
  head: () => ({ meta: [{ title: "Inteligência do Catálogo — WEAZE" }] }),
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
    case "today": { const d = new Date(); d.setHours(0, 0, 0, 0); return { start: d.getTime(), end: now }; }
    case "7d": return { start: now - 7 * day, end: now };
    case "30d": return { start: now - 30 * day, end: now };
    case "90d": return { start: now - 90 * day, end: now };
    case "year": { const d = new Date(); d.setMonth(0, 1); d.setHours(0, 0, 0, 0); return { start: d.getTime(), end: now }; }
  }
}

function inRange(ts: string | number | Date | null | undefined, start: number, end: number) {
  if (!ts) return false;
  const t = new Date(ts).getTime();
  return t >= start && t <= end;
}

function computeChange(current: number, previous: number) {
  if (previous <= 0) return current > 0 ? { pct: 100, dir: "up" as const } : { pct: 0, dir: "flat" as const };
  return {
    pct: ((current - previous) / previous) * 100,
    dir: current >= previous ? ("up" as const) : ("down" as const),
  };
}

function pctStr(pct: number) { return (pct >= 0 ? "+" : "") + pct.toFixed(1) + "%"; }

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

function InteligenciaPage() {
  const companyId = useCompanyId();
  const [period, setPeriod] = useState<PeriodKey>("30d");
  const [productFilter, setProductFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [contextFilter, setContextFilter] = useState<string>("all");
  const [customerFilter, setCustomerFilter] = useState<string>("all");

  const { start: pStart, end: pEnd } = getPeriodBounds(period);

  // ── Raw data queries ──
  const { data: products } = useQuery({
    queryKey: ["catalogo-products", companyId],
    queryFn: async () => {
      const { data } = await supabase.from("products").select("*").eq("company_id", companyId!);
      return data ?? [];
    },
    enabled: !!companyId,
  });

  const { data: events } = useQuery({
    queryKey: ["product-events", companyId],
    queryFn: async () => {
      const { data } = await supabase
        .from("product_events")
        .select("*, customer:customers(name)")
        .eq("company_id", companyId!)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
    enabled: !!companyId,
  });

  const { data: orders } = useQuery({
    queryKey: ["orders-all", companyId],
    queryFn: async () => {
      const { data } = await supabase
        .from("orders")
        .select("*, order_items(*), customer:customers(name)")
        .eq("company_id", companyId!)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
    enabled: !!companyId,
  });

  const { data: customers } = useQuery({
    queryKey: ["customers-all", companyId],
    queryFn: async () => {
      const { data } = await supabase.from("customers").select("*").eq("company_id", companyId!);
      return data ?? [];
    },
    enabled: !!companyId,
  });

  const { data: checkins } = useQuery({
    queryKey: ["checkins-all", companyId],
    queryFn: async () => {
      const { data } = await supabase
        .from("checkins")
        .select("context, source, created_at, customer_id, table_id")
        .eq("company_id", companyId!)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
    enabled: !!companyId,
  });

  // ── Filtered data ──
  const periodEvents = useMemo(() => (events ?? []).filter((e: any) => inRange(e.created_at, pStart, pEnd)), [events, pStart, pEnd]);
  const periodOrders = useMemo(() => (orders ?? []).filter((o: any) => inRange(o.created_at, pStart, pEnd)), [orders, pStart, pEnd]);
  const periodCheckins = useMemo(() => (checkins ?? []).filter((c: any) => inRange(c.created_at, pStart, pEnd)), [checkins, pStart, pEnd]);
  const periodCustomers = useMemo(() => (customers ?? []).filter((c: any) => inRange(c.last_visit_at, pStart, pEnd)), [customers, pStart, pEnd]);

  // ── General metrics ──
  const generalMetrics = useMemo(() => {
    const scans = periodEvents.filter((e: any) => e.event_type === "scan");
    const views = periodEvents.filter((e: any) => e.event_type === "view");
    const cartAdds = periodEvents.filter((e: any) => e.event_type === "cart_add");
    const purchases = periodEvents.filter((e: any) => e.event_type === "purchase");

    const uniqueScanners = new Set(scans.map((e: any) => e.customer_id).filter(Boolean));
    const uniqueViewers = new Set(views.map((e: any) => e.customer_id).filter(Boolean));
    const uniqueBuyers = new Set(purchases.map((e: any) => e.customer_id).filter(Boolean));
    const recurring = uniqueBuyers.size > 0 ? Array.from(uniqueBuyers).filter((cid) => {
      const customerPurchases = purchases.filter((p: any) => p.customer_id === cid);
      return customerPurchases.length > 1;
    }).length : 0;

    const scannedProducts = new Set(scans.map((e: any) => e.product_id));
    const viewedProducts = new Set(views.map((e: any) => e.product_id));

    // Time between scan and purchase
    let totalScanToBuyMs = 0;
    let scanToBuyCount = 0;
    for (const buyer of uniqueBuyers) {
      const customerScans = scans.filter((s: any) => s.customer_id === buyer).sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      const customerPurchases = purchases.filter((p: any) => p.customer_id === buyer).sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      if (customerScans.length > 0 && customerPurchases.length > 0) {
        totalScanToBuyMs += new Date(customerPurchases[0].created_at).getTime() - new Date(customerScans[0].created_at).getTime();
        scanToBuyCount++;
      }
    }
    const avgScanToBuyHours = scanToBuyCount > 0 ? totalScanToBuyMs / scanToBuyCount / 3600000 : null;

    // Abandonment rate (cart_add but no purchase)
    const cartAddCustomers = new Set(cartAdds.map((e: any) => e.customer_id).filter(Boolean));
    const purchaseCustomers = new Set(purchases.map((e: any) => e.customer_id).filter(Boolean));
    const abandoned = Array.from(cartAddCustomers).filter((c) => !purchaseCustomers.has(c)).length;
    const abandonmentRate = cartAddCustomers.size > 0 ? (abandoned / cartAddCustomers.size) * 100 : 0;

    // Conversion rate (scanned -> purchased)
    const scannersWhoBought = Array.from(uniqueScanners).filter((c) => uniqueBuyers.has(c)).length;
    const conversionRate = uniqueScanners.size > 0 ? (scannersWhoBought / uniqueScanners.size) * 100 : 0;

    return {
      totalScans: scans.length,
      uniqueCustomers: uniqueScanners.size,
      recurringCustomers: recurring,
      scannedProducts: scannedProducts.size,
      scansPerDay: [] as { date: string; count: number }[],
      scansPerWeek: [] as { week: string; count: number }[],
      scansPerMonth: [] as { month: string; count: number }[],
      scansPerYear: [] as { year: string; count: number }[],
      avgScanToBuyHours,
      abandonmentRate,
      conversionRate,
      totalViews: views.length,
      uniqueViewers: uniqueViewers.size,
      viewedProducts: viewedProducts.size,
      totalCartAdds: cartAdds.length,
      totalPurchases: purchases.length,
      uniqueBuyers: uniqueBuyers.size,
    };
  }, [periodEvents]);

  // ── Funnel ──
  const funnelData = useMemo(() => {
    const scans = periodEvents.filter((e: any) => e.event_type === "scan").length;
    const views = periodEvents.filter((e: any) => e.event_type === "view").length;
    const cartAdds = periodEvents.filter((e: any) => e.event_type === "cart_add").length;
    const ordersCount = periodOrders.length;
    const completed = periodOrders.filter((o: any) => o.status === "completed").length;

    const steps = [
      { key: "scan", label: "QR Escaneado", value: scans, icon: ScanLine },
      { key: "view", label: "Produto aberto", value: views, icon: Eye },
      { key: "cart", label: "Adicionado à Sacola", value: cartAdds, icon: ShoppingCart },
      { key: "order", label: "Pedido enviado", value: ordersCount, icon: Package },
      { key: "completed", label: "Pedido concluído", value: completed, icon: CheckCircle2 },
    ];
    const maxVal = Math.max(...steps.map((s) => s.value), 1);

    const conversions = steps.slice(0, -1).map((s, i) => {
      const next = steps[i + 1];
      const rate = s.value > 0 ? (next.value / s.value) * 100 : 0;
      const loss = s.value > 0 ? ((s.value - next.value) / s.value) * 100 : 0;
      return { from: s.label, to: next.label, rate, loss };
    });

    return { steps, maxVal, conversions };
  }, [periodEvents, periodOrders]);

  // ── Product ranking ──
  const productRanking = useMemo(() => {
    if (!products) return null;
    const productMap = new Map(products.map((p: any) => [p.id, p]));

    const scanCount: Record<string, number> = {};
    const viewCount: Record<string, number> = {};
    const cartCount: Record<string, number> = {};
    const purchaseCountInEvents: Record<string, number> = {};
    const orderItemCount: Record<string, number> = {};
    const customerSet: Record<string, Set<string>> = {};
    const orderCustomerSet: Record<string, Set<string>> = {};

    periodEvents.forEach((e: any) => {
      const pid = e.product_id;
      if (e.event_type === "scan") { scanCount[pid] = (scanCount[pid] ?? 0) + 1; if (!customerSet[pid]) customerSet[pid] = new Set(); if (e.customer_id) customerSet[pid].add(e.customer_id); }
      if (e.event_type === "view") viewCount[pid] = (viewCount[pid] ?? 0) + 1;
      if (e.event_type === "cart_add") cartCount[pid] = (cartCount[pid] ?? 0) + 1;
      if (e.event_type === "purchase") purchaseCountInEvents[pid] = (purchaseCountInEvents[pid] ?? 0) + 1;
    });

    periodOrders.forEach((o: any) => {
      (o.order_items ?? []).forEach((i: any) => {
        const pid = i.product_id;
        orderItemCount[pid] = (orderItemCount[pid] ?? 0) + i.quantity;
        if (!orderCustomerSet[pid]) orderCustomerSet[pid] = new Set();
        orderCustomerSet[pid].add(o.customer_id);
      });
    });

    const allPids = new Set([...Object.keys(scanCount), ...Object.keys(viewCount), ...Object.keys(cartCount), ...Object.keys(orderItemCount)]);
    products.forEach((p: any) => allPids.add(p.id));

    const ranked = Array.from(allPids).map((pid) => {
      const p = productMap.get(pid) ?? { id: pid, name: "Desconhecido", category: null, price: 0, image_url: null };
      const scannedBy = customerSet[pid]?.size ?? 0;
      const orderedBy = orderCustomerSet[pid]?.size ?? 0;
      const convRate = scannedBy > 0 ? (orderedBy / scannedBy) * 100 : 0;
      return {
        id: pid,
        name: p.name,
        category: p.category,
        price: Number(p.price),
        imageUrl: p.image_url,
        scans: scanCount[pid] ?? 0,
        views: viewCount[pid] ?? 0,
        cartAdds: cartCount[pid] ?? 0,
        purchases: purchaseCountInEvents[pid] ?? 0,
        orderQty: orderItemCount[pid] ?? 0,
        scannedBy,
        orderedBy,
        conversionRate: convRate,
        abandoned: scannedBy > 0 && orderedBy === 0,
        neverOrdered: orderItemCount[pid] == null || orderItemCount[pid] === 0,
      };
    });

    const mostScanned = [...ranked].sort((a, b) => b.scans - a.scans).slice(0, 10);
    const mostViewed = [...ranked].sort((a, b) => b.views - a.views).slice(0, 10);
    const mostCartAdded = [...ranked].sort((a, b) => b.cartAdds - a.cartAdds).slice(0, 10);
    const mostSold = [...ranked].sort((a, b) => b.orderQty - a.orderQty).slice(0, 10);
    const abandoned = ranked.filter((r) => r.abandoned && r.scans > 0).sort((a, b) => b.scans - a.scans).slice(0, 10);
    const neverBought = ranked.filter((r) => r.neverOrdered).sort((a, b) => b.views - a.views).slice(0, 10);
    const highestConv = [...ranked].filter((r) => r.scannedBy > 0).sort((a, b) => b.conversionRate - a.conversionRate).slice(0, 10);
    const lowestConv = [...ranked].filter((r) => r.scannedBy > 0 && r.orderedBy > 0).sort((a, b) => a.conversionRate - b.conversionRate).slice(0, 10);

    return { mostScanned, mostViewed, mostCartAdded, mostSold, abandoned, neverBought, highestConv, lowestConv, all: ranked };
  }, [products, periodEvents, periodOrders]);

  // ── Category analysis ──
  const categoryAnalysis = useMemo(() => {
    if (!productRanking) return [];
    const catMap: Record<string, { products: Set<string>; scans: number; views: number; cartAdds: number; purchases: number; uniqueScanners: Set<string>; uniqueBuyers: Set<string> }> = {};
    productRanking.all.forEach((p) => {
      const cat = p.category || "Sem categoria";
      if (!catMap[cat]) catMap[cat] = { products: new Set(), scans: 0, views: 0, cartAdds: 0, purchases: 0, uniqueScanners: new Set(), uniqueBuyers: new Set() };
      catMap[cat].products.add(p.id);
      catMap[cat].scans += p.scans;
      catMap[cat].views += p.views;
      catMap[cat].cartAdds += p.cartAdds;
      catMap[cat].purchases += p.purchases;
    });
    // Track scanners per category
    periodEvents.filter((e: any) => e.event_type === "scan").forEach((e: any) => {
      const p = products?.find((pr: any) => pr.id === e.product_id);
      if (p) {
        const cat = p.category || "Sem categoria";
        if (e.customer_id) catMap[cat].uniqueScanners.add(e.customer_id);
      }
    });
    periodOrders.forEach((o: any) => {
      (o.order_items ?? []).forEach((i: any) => {
        const p = products?.find((pr: any) => pr.id === i.product_id);
        if (p) {
          const cat = p.category || "Sem categoria";
          if (o.customer_id) catMap[cat].uniqueBuyers.add(o.customer_id);
        }
      });
    });

    return Object.entries(catMap).map(([name, data]) => {
      const scanners = data.uniqueScanners.size;
      const buyers = data.uniqueBuyers.size;
      return {
        name,
        productCount: data.products.size,
        scans: data.scans,
        views: data.views,
        cartAdds: data.cartAdds,
        purchases: data.purchases,
        scanners,
        buyers,
        conversionRate: scanners > 0 ? (buyers / scanners) * 100 : 0,
        abandoned: scanners > 0 && buyers === 0,
      };
    }).sort((a, b) => b.scans - a.scans);
  }, [productRanking, periodEvents, periodOrders, products]);

  // ── Customer behavior ──
  const customerBehavior = useMemo(() => {
    const custMap: Record<string, { scans: number; views: number; cartAdds: number; purchases: number; orders: number; orderTotal: number }> = {};
    periodEvents.forEach((e: any) => {
      if (!e.customer_id) return;
      if (!custMap[e.customer_id]) custMap[e.customer_id] = { scans: 0, views: 0, cartAdds: 0, purchases: 0, orders: 0, orderTotal: 0 };
      if (e.event_type === "scan") custMap[e.customer_id].scans++;
      if (e.event_type === "view") custMap[e.customer_id].views++;
      if (e.event_type === "cart_add") custMap[e.customer_id].cartAdds++;
      if (e.event_type === "purchase") custMap[e.customer_id].purchases++;
    });
    periodOrders.forEach((o: any) => {
      if (!o.customer_id) return;
      if (!custMap[o.customer_id]) custMap[o.customer_id] = { scans: 0, views: 0, cartAdds: 0, purchases: 0, orders: 0, orderTotal: 0 };
      custMap[o.customer_id].orders++;
      custMap[o.customer_id].orderTotal += Number(o.total);
    });

    const custNames = new Map((customers ?? []).map((c: any) => [c.id, c.name || "Cliente"]));
    const entries = Object.entries(custMap).map(([id, data]) => ({
      id,
      name: custNames.get(id) ?? "Cliente",
      ...data,
      isScannerOnly: data.scans > 0 && data.purchases === 0 && data.orders === 0,
      isBuyer: data.orders > 0,
      isCurious: data.views > 0 && data.cartAdds === 0 && data.orders === 0,
      isAbandoner: data.cartAdds > 0 && data.orders === 0,
      isRecurring: data.orders > 1,
      returnedToSameProduct: false,
      viewedMultiple: data.views >= 3,
    }));

    const mostScanners = [...entries].sort((a, b) => b.scans - a.scans).slice(0, 10);
    const mostBuyers = [...entries].filter((e) => e.isBuyer).sort((a, b) => b.orders - a.orders).slice(0, 10);
    const scannersOnly = entries.filter((e) => e.isScannerOnly).sort((a, b) => b.scans - a.scans).slice(0, 10);
    const abandoners = entries.filter((e) => e.isAbandoner).sort((a, b) => b.cartAdds - a.cartAdds).slice(0, 10);
    const curious = entries.filter((e) => e.isCurious).sort((a, b) => b.views - a.views).slice(0, 10);
    const buyers = entries.filter((e) => e.isBuyer).sort((a, b) => b.orders - a.orders);
    const recurring = entries.filter((e) => e.isRecurring).sort((a, b) => b.orders - a.orders).slice(0, 10);

    return { mostScanners, mostBuyers, scannersOnly, abandoners, curious, buyers, recurring, viewedMultiple: entries.filter((e) => e.viewedMultiple).slice(0, 10) };
  }, [periodEvents, periodOrders, customers]);

  // ── Time analysis ──
  const timeAnalysis = useMemo(() => {
    const scans = periodEvents.filter((e: any) => e.event_type === "scan").sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    const views = periodEvents.filter((e: any) => e.event_type === "view").sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    const cartAdds = periodEvents.filter((e: any) => e.event_type === "cart_add").sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

    // Avg time on page (view duration - not available, use proxy)
    let totalViewMs = 0;
    let viewPairs = 0;
    const viewByCustomer: Record<string, string[]> = {};
    views.forEach((v: any) => {
      if (v.customer_id) {
        if (!viewByCustomer[v.customer_id]) viewByCustomer[v.customer_id] = [];
        viewByCustomer[v.customer_id].push(v.created_at);
      }
    });
    Object.values(viewByCustomer).forEach((times) => {
      if (times.length >= 2) {
        times.sort();
        for (let i = 1; i < times.length; i++) {
          totalViewMs += new Date(times[i]).getTime() - new Date(times[i - 1]).getTime();
          viewPairs++;
        }
      }
    });
    const avgViewTimeSec = viewPairs > 0 ? totalViewMs / viewPairs / 1000 : null;

    // Time to cart
    let totalScanToCartMs = 0;
    let scanToCartCount = 0;
    const scanByCustomer: Record<string, string[]> = {};
    scans.forEach((s: any) => {
      if (s.customer_id) {
        if (!scanByCustomer[s.customer_id]) scanByCustomer[s.customer_id] = [];
        scanByCustomer[s.customer_id].push(s.created_at);
      }
    });
    const cartByCustomer: Record<string, string[]> = {};
    cartAdds.forEach((c: any) => {
      if (c.customer_id) {
        if (!cartByCustomer[c.customer_id]) cartByCustomer[c.customer_id] = [];
        cartByCustomer[c.customer_id].push(c.created_at);
      }
    });
    Object.keys(scanByCustomer).forEach((cid) => {
      if (cartByCustomer[cid]) {
        const firstScan = new Date(scanByCustomer[cid][0]).getTime();
        const firstCart = new Date(cartByCustomer[cid][0]).getTime();
        if (firstCart > firstScan) {
          totalScanToCartMs += firstCart - firstScan;
          scanToCartCount++;
        }
      }
    });
    const avgScanToCartMin = scanToCartCount > 0 ? totalScanToCartMs / scanToCartCount / 60000 : null;

    // Time to buy
    let totalScanToBuyMs = 0;
    let scanToBuyCount = 0;
    Object.keys(scanByCustomer).forEach((cid) => {
      const customerOrders = periodOrders.filter((o: any) => o.customer_id === cid).sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      if (customerOrders.length > 0 && scanByCustomer[cid].length > 0) {
        const firstScan = new Date(scanByCustomer[cid][0]).getTime();
        const firstBuy = new Date(customerOrders[0].created_at).getTime();
        if (firstBuy > firstScan) {
          totalScanToBuyMs += firstBuy - firstScan;
          scanToBuyCount++;
        }
      }
    });
    const avgScanToBuyMin = scanToBuyCount > 0 ? totalScanToBuyMs / scanToBuyCount / 60000 : null;

    // Avg time between visits
    const customerVisitTimes: Record<string, string[]> = {};
    periodCheckins.forEach((c: any) => {
      if (c.customer_id) {
        if (!customerVisitTimes[c.customer_id]) customerVisitTimes[c.customer_id] = [];
        customerVisitTimes[c.customer_id].push(c.created_at);
      }
    });
    let totalBetweenVisitsMs = 0;
    let betweenVisitsCount = 0;
    Object.values(customerVisitTimes).forEach((times) => {
      times.sort();
      for (let i = 1; i < times.length; i++) {
        totalBetweenVisitsMs += new Date(times[i]).getTime() - new Date(times[i - 1]).getTime();
        betweenVisitsCount++;
      }
    });
    const avgBetweenVisitsHours = betweenVisitsCount > 0 ? totalBetweenVisitsMs / betweenVisitsCount / 3600000 : null;

    // Avg time between purchases
    const customerPurchaseTimes: Record<string, string[]> = {};
    periodOrders.forEach((o: any) => {
      if (o.customer_id) {
        if (!customerPurchaseTimes[o.customer_id]) customerPurchaseTimes[o.customer_id] = [];
        customerPurchaseTimes[o.customer_id].push(o.created_at);
      }
    });
    let totalBetweenPurchasesMs = 0;
    let betweenPurchasesCount = 0;
    Object.values(customerPurchaseTimes).forEach((times) => {
      times.sort();
      for (let i = 1; i < times.length; i++) {
        totalBetweenPurchasesMs += new Date(times[i]).getTime() - new Date(times[i - 1]).getTime();
        betweenPurchasesCount++;
      }
    });
    const avgBetweenPurchasesHours = betweenPurchasesCount > 0 ? totalBetweenPurchasesMs / betweenPurchasesCount / 3600000 : null;

    return { avgViewTimeSec, avgScanToCartMin, avgScanToBuyMin, avgBetweenVisitsHours, avgBetweenPurchasesHours };
  }, [periodEvents, periodOrders, periodCheckins]);

  // ── Hour/day analysis ──
  const timeBuckets = useMemo(() => {
    const hourScans: Record<number, number> = {};
    const hourPurchases: Record<number, number> = {};
    const dayScans: Record<string, number> = {};
    const dayPurchases: Record<string, number> = {};
    const dayNames = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];

    periodEvents.filter((e: any) => e.event_type === "scan").forEach((e: any) => {
      const d = new Date(e.created_at);
      const h = d.getHours();
      hourScans[h] = (hourScans[h] ?? 0) + 1;
      const day = dayNames[d.getDay()];
      dayScans[day] = (dayScans[day] ?? 0) + 1;
    });

    periodOrders.forEach((o: any) => {
      const d = new Date(o.created_at);
      const h = d.getHours();
      hourPurchases[h] = (hourPurchases[h] ?? 0) + 1;
      const day = dayNames[d.getDay()];
      dayPurchases[day] = (dayPurchases[day] ?? 0) + 1;
    });

    const peakScanHour = Object.entries(hourScans).sort((a, b) => b[1] - a[1])[0];
    const peakBuyHour = Object.entries(hourPurchases).sort((a, b) => b[1] - a[1])[0];
    const peakScanDay = Object.entries(dayScans).sort((a, b) => b[1] - a[1])[0];
    const peakBuyDay = Object.entries(dayPurchases).sort((a, b) => b[1] - a[1])[0];

    const bestConversionDays = dayNames.map((day) => {
      const scans = dayScans[day] ?? 0;
      const buys = dayPurchases[day] ?? 0;
      const rate = scans > 0 ? (buys / scans) * 100 : 0;
      return { day, scans, buys, rate };
    }).sort((a, b) => b.rate - a.rate);

    return {
      hourScans, hourPurchases, dayScans, dayPurchases,
      peakScanHour: peakScanHour ? { hour: Number(peakScanHour[0]), count: peakScanHour[1] } : null,
      peakBuyHour: peakBuyHour ? { hour: Number(peakBuyHour[0]), count: peakBuyHour[1] } : null,
      peakScanDay: peakScanDay ? { day: peakScanDay[0], count: peakScanDay[1] } : null,
      peakBuyDay: peakBuyDay ? { day: peakBuyDay[0], count: peakBuyDay[1] } : null,
      bestConversionDays,
    };
  }, [periodEvents, periodOrders]);

  // ── Context analysis ──
  const contextAnalysis = useMemo(() => {
    const contextScanners: Record<string, Set<string>> = {};
    const contextBuyers: Record<string, Set<string>> = {};
    const contextOrders: Record<string, number> = {};
    const contextOrderTotal: Record<string, number> = {};

    periodCheckins.forEach((c: any) => {
      const ctx = c.context || "desconhecido";
      if (!contextScanners[ctx]) contextScanners[ctx] = new Set();
      if (c.customer_id) contextScanners[ctx].add(c.customer_id);
    });

    periodOrders.forEach((o: any) => {
      const customerContexts = periodCheckins.filter((c: any) => c.customer_id === o.customer_id);
      const ctx = customerContexts.length > 0 ? customerContexts[0].context || "desconhecido" : "desconhecido";
      if (!contextBuyers[ctx]) contextBuyers[ctx] = new Set();
      if (!contextOrders[ctx]) contextOrders[ctx] = 0;
      if (!contextOrderTotal[ctx]) contextOrderTotal[ctx] = 0;
      if (o.customer_id) contextBuyers[ctx].add(o.customer_id);
      contextOrders[ctx]++;
      contextOrderTotal[ctx] += Number(o.total);
    });

    // Premium product buyers per context
    const premiumThreshold = 100;
    const contextPremiumBuyers: Record<string, Set<string>> = {};
    periodOrders.forEach((o: any) => {
      if (Number(o.total) > premiumThreshold) {
        const customerContexts = periodCheckins.filter((c: any) => c.customer_id === o.customer_id);
        const ctx = customerContexts.length > 0 ? customerContexts[0].context || "desconhecido" : "desconhecido";
        if (!contextPremiumBuyers[ctx]) contextPremiumBuyers[ctx] = new Set();
        if (o.customer_id) contextPremiumBuyers[ctx].add(o.customer_id);
      }
    });

    const allContexts = new Set([...Object.keys(contextScanners), ...Object.keys(contextBuyers)]);
    return Array.from(allContexts).map((ctx) => ({
      context: ctx,
      scanners: contextScanners[ctx]?.size ?? 0,
      buyers: contextBuyers[ctx]?.size ?? 0,
      orders: contextOrders[ctx] ?? 0,
      revenue: contextOrderTotal[ctx] ?? 0,
      premiumBuyers: contextPremiumBuyers[ctx]?.size ?? 0,
      conversionRate: (contextScanners[ctx]?.size ?? 0) > 0 ? ((contextBuyers[ctx]?.size ?? 0) / (contextScanners[ctx]?.size ?? 1)) * 100 : 0,
    }));
  }, [periodCheckins, periodOrders]);

  // ── Demographic analysis ──
  const demographicAnalysis = useMemo(() => {
    const genderCounts: Record<string, number> = {};
    const ageRangeCounts: Record<string, number> = {};
    const genderSpend: Record<string, number> = {};
    const ageRangeSpend: Record<string, number> = {};
    const genderOrders: Record<string, number> = {};
    const ageRangeOrders: Record<string, number> = {};

    (customers ?? []).forEach((c: any) => {
      const g = c.gender || "nao_informado";
      const a = c.age_range || "nao_informado";
      genderCounts[g] = (genderCounts[g] ?? 0) + 1;
      ageRangeCounts[a] = (ageRangeCounts[a] ?? 0) + 1;
      genderSpend[g] = (genderSpend[g] ?? 0);
      ageRangeSpend[a] = (ageRangeSpend[a] ?? 0);
      genderOrders[g] = (genderOrders[g] ?? 0);
      ageRangeOrders[a] = (ageRangeOrders[a] ?? 0);
    });

    periodOrders.forEach((o: any) => {
      const customer = (customers ?? []).find((c: any) => c.id === o.customer_id);
      if (!customer) return;
      const g = customer.gender || "nao_informado";
      const a = customer.age_range || "nao_informado";
      genderSpend[g] = (genderSpend[g] ?? 0) + Number(o.total);
      ageRangeSpend[a] = (ageRangeSpend[a] ?? 0) + Number(o.total);
      genderOrders[g] = (genderOrders[g] ?? 0) + 1;
      ageRangeOrders[a] = (ageRangeOrders[a] ?? 0) + 1;
    });

    const genderLabels: Record<string, string> = {
      mulher: "Mulher",
      homem: "Homem",
      prefiro_nao_informar: "Prefiro não informar",
      nao_informado: "Não informado",
    };
    const ageRangeLabels: Record<string, string> = {
      ate_17: "Até 17 anos",
      "18-24": "18–24 anos",
      "25-34": "25–34 anos",
      "35-44": "35–44 anos",
      "45-54": "45–54 anos",
      "55_mais": "55+ anos",
      nao_informado: "Não informado",
    };

    const genderDistribution = Object.entries(genderCounts)
      .map(([key, count]) => ({
        key,
        label: genderLabels[key] ?? key,
        count,
        avgSpend: genderOrders[key] > 0 ? genderSpend[key] / genderOrders[key] : 0,
        totalSpend: genderSpend[key] ?? 0,
        orders: genderOrders[key] ?? 0,
      }))
      .sort((a, b) => b.count - a.count);

    const ageRangeDistribution = Object.entries(ageRangeCounts)
      .map(([key, count]) => ({
        key,
        label: ageRangeLabels[key] ?? key,
        count,
        avgSpend: ageRangeOrders[key] > 0 ? ageRangeSpend[key] / ageRangeOrders[key] : 0,
        totalSpend: ageRangeSpend[key] ?? 0,
        orders: ageRangeOrders[key] ?? 0,
      }))
      .sort((a, b) => b.count - a.count);

    return { genderDistribution, ageRangeDistribution };
  }, [customers, periodOrders]);

  // ── Interest map ──
  const interestMap = useMemo(() => {
    if (!productRanking) return [];
    return productRanking.all.map((p) => {
      const totalInterest = p.views;
      const ignored = p.scans > 0 && p.views === 0;
      const fastBuy = p.views > 0 && p.orderQty > 0 && (p.views / p.orderQty) < 5;
      const slowDecision = p.views > 0 && p.orderQty > 0 && (p.views / p.orderQty) >= 10;
      return { ...p, totalInterest, ignored, fastBuy, slowDecision };
    });
  }, [productRanking]);

  // ── Automatic insights ──
  const autoInsights = useMemo(() => {
    const list: { type: "alert" | "positive" | "info"; title: string; description: string }[] = [];

    if (productRanking) {
      // High interest, low sales
      const highInterestLowSales = productRanking.all.filter((p) => p.views >= 5 && p.orderQty === 0);
      if (highInterestLowSales.length > 0) {
        list.push({
          type: "alert",
          title: "Produtos com interesse mas sem venda",
          description: `${highInterestLowSales.length} produto${highInterestLowSales.length > 1 ? "s" : ""} despert${highInterestLowSales.length > 1 ? "am" : "a"} muito interesse mas não vendeu${highInterestLowSales.length > 1 ? "ram" : ""}. Ex: ${highInterestLowSales.slice(0, 3).map((p) => p.name).join(", ")}.`,
        });
      }

      // Excellent conversion
      const highConv = productRanking.all.filter((p) => p.scannedBy >= 3 && p.conversionRate >= 50);
      if (highConv.length > 0) {
        list.push({
          type: "positive",
          title: "Produtos com excelente conversão",
          description: `${highConv.length} produto${highConv.length > 1 ? "s" : ""} com taxa de conversão acima de 50%. Destaque: ${highConv.slice(0, 3).map((p) => p.name).join(", ")}.`,
        });
      }

      // No scans
      const noScans = productRanking.all.filter((p) => p.scans === 0 && p.name !== "Desconhecido");
      if (noScans.length > 0) {
        list.push({
          type: "info",
          title: "Produtos sem escaneamentos",
          description: `${noScans.length} produto${noScans.length > 1 ? "s" : ""} nunca foi escaneado${noScans.length > 1 ? "" : ""}. Considere reposicionar os QR Codes.`,
        });
      }

      // High abandonment
      const highAbandon = productRanking.all.filter((p) => p.scannedBy >= 5 && p.orderedBy === 0);
      if (highAbandon.length > 0) {
        list.push({
          type: "alert",
          title: "Produtos com alta taxa de abandono",
          description: `${highAbandon.length} produto${highAbandon.length > 1 ? "s" : ""} fo${highAbandon.length > 1 ? "ram" : "i"} escaneado${highAbandon.length > 1 ? "s" : ""} mas nunca comprado${highAbandon.length > 1 ? "s" : ""}. Ex: ${highAbandon.slice(0, 3).map((p) => p.name).join(", ")}.`,
        });
      }
    }

    // Category trends
    if (categoryAnalysis.length > 0) {
      const growing = categoryAnalysis.filter((c) => c.scans > 0 && c.conversionRate > 30);
      const declining = categoryAnalysis.filter((c) => c.scans > 5 && c.conversionRate === 0);
      if (growing.length > 0) {
        list.push({
          type: "positive",
          title: "Categorias em crescimento",
          description: `${growing.length} categoria${growing.length > 1 ? "s" : ""} com boa conversão: ${growing.slice(0, 3).map((c) => c.name).join(", ")}.`,
        });
      }
      if (declining.length > 0) {
        list.push({
          type: "alert",
          title: "Categorias em queda",
          description: `${declining.length} categoria${declining.length > 1 ? "s" : ""} com escaneamentos mas sem vendas: ${declining.slice(0, 3).map((c) => c.name).join(", ")}.`,
        });
      }
    }

    // Time-based insights
    if (timeBuckets.peakScanHour) {
      list.push({
        type: "info",
        title: "Horário de pico de escaneamentos",
        description: `${String(timeBuckets.peakScanHour.hour).padStart(2, "0")}h é o horário com mais escaneamentos (${timeBuckets.peakScanHour.count}).`,
      });
    }

    if (timeAnalysis.avgScanToBuyMin != null) {
      const decisionTime = timeAnalysis.avgScanToBuyMin;
      if (decisionTime < 10) {
        list.push({
          type: "positive",
          title: "Decisão de compra rápida",
          description: `Em média, clientes compram ${Math.round(decisionTime)} minutos após escanear o QR Code.`,
        });
      } else if (decisionTime > 60) {
        list.push({
          type: "info",
          title: "Decisão de compra demorada",
          description: `Clientes levam em média ${Math.round(decisionTime)} minutos entre escanear e comprar. Considere oferecer incentivos.`,
        });
      }
    }

    return list.slice(0, 8);
  }, [productRanking, categoryAnalysis, timeBuckets, timeAnalysis]);

  // ── Customer-CRM cross reference ──
  const crmCrossRef = useMemo(() => {
    if (!customers) return [];
    const custEvents: Record<string, { scans: number; views: number; cartAdds: number; purchases: number; orders: number; totalSpent: number; productIds: Set<string>; categoryIds: Set<string>; abandonedIds: Set<string>; lastEvent: string | null }> = {};

    periodEvents.forEach((e: any) => {
      if (!e.customer_id) return;
      if (!custEvents[e.customer_id]) custEvents[e.customer_id] = { scans: 0, views: 0, cartAdds: 0, purchases: 0, orders: 0, totalSpent: 0, productIds: new Set(), categoryIds: new Set(), abandonedIds: new Set(), lastEvent: null };
      custEvents[e.customer_id].scans += e.event_type === "scan" ? 1 : 0;
      custEvents[e.customer_id].views += e.event_type === "view" ? 1 : 0;
      custEvents[e.customer_id].cartAdds += e.event_type === "cart_add" ? 1 : 0;
      custEvents[e.customer_id].purchases += e.event_type === "purchase" ? 1 : 0;
      custEvents[e.customer_id].productIds.add(e.product_id);
      const prod = products?.find((p: any) => p.id === e.product_id);
      if (prod?.category) custEvents[e.customer_id].categoryIds.add(prod.category);
      if (!e.created_at || (custEvents[e.customer_id].lastEvent && e.created_at > custEvents[e.customer_id].lastEvent!)) custEvents[e.customer_id].lastEvent = e.created_at;
    });

    periodOrders.forEach((o: any) => {
      if (!o.customer_id) return;
      if (!custEvents[o.customer_id]) custEvents[o.customer_id] = { scans: 0, views: 0, cartAdds: 0, purchases: 0, orders: 0, totalSpent: 0, productIds: new Set(), categoryIds: new Set(), abandonedIds: new Set(), lastEvent: null };
      custEvents[o.customer_id].orders++;
      custEvents[o.customer_id].totalSpent += Number(o.total);
      (o.order_items ?? []).forEach((i: any) => {
        custEvents[o.customer_id].productIds.add(i.product_id);
      });
    });

    // Cart adds without purchase = abandoned products
    Object.entries(custEvents).forEach(([cid, data]) => {
      const cartAddEvents = periodEvents.filter((e: any) => e.customer_id === cid && e.event_type === "cart_add");
      const purchaseProductIds = new Set(periodEvents.filter((e: any) => e.customer_id === cid && e.event_type === "purchase").map((e: any) => e.product_id));
      cartAddEvents.forEach((e: any) => {
        if (!purchaseProductIds.has(e.product_id)) data.abandonedIds.add(e.product_id);
      });
    });

    return Object.entries(custEvents).map(([id, data]) => {
      const customer = (customers ?? []).find((c: any) => c.id === id);
      const productsData = Array.from(data.productIds).map((pid) => products?.find((p: any) => p.id === pid)).filter(Boolean);
      const categories = Array.from(data.categoryIds);
      const abandonedProducts = Array.from(data.abandonedIds).map((pid) => products?.find((p: any) => p.id === pid)).filter(Boolean);
      return {
        id,
        name: customer?.name || "Cliente",
        whatsapp: customer?.whatsapp || "",
        ...data,
        favoriteProducts: productsData.slice(0, 5),
        favoriteCategories: categories.slice(0, 5),
        abandonedProducts: abandonedProducts.slice(0, 5),
        decisionTime: null as number | null,
      };
    });
  }, [customers, periodEvents, periodOrders, products]);

  if (!companyId) return <div className="py-8 text-center text-muted-foreground">Carregando...</div>;

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Inteligência do Catálogo</h1>
          <p className="text-sm text-muted-foreground">Análise completa do comportamento dos clientes com os produtos físicos</p>
        </div>
        <PeriodSelector current={period} onChange={setPeriod} />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        {products && (
          <select
            value={productFilter}
            onChange={(e) => setProductFilter(e.target.value)}
            className="rounded-lg border bg-background px-3 py-1.5 text-xs"
          >
            <option value="all">Todos os produtos</option>
            {products.map((p: any) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        )}
        {categoryAnalysis.length > 0 && (
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="rounded-lg border bg-background px-3 py-1.5 text-xs"
          >
            <option value="all">Todas as categorias</option>
            {categoryAnalysis.map((c) => (
              <option key={c.name} value={c.name}>{c.name}</option>
            ))}
          </select>
        )}
        {contextAnalysis.length > 0 && (
          <select
            value={contextFilter}
            onChange={(e) => setContextFilter(e.target.value)}
            className="rounded-lg border bg-background px-3 py-1.5 text-xs"
          >
            <option value="all">Todos os contextos</option>
            {contextAnalysis.map((c) => (
              <option key={c.context} value={c.context}>{c.context}</option>
            ))}
          </select>
        )}
        {customerBehavior.buyers.length > 0 && (
          <select
            value={customerFilter}
            onChange={(e) => setCustomerFilter(e.target.value)}
            className="rounded-lg border bg-background px-3 py-1.5 text-xs"
          >
            <option value="all">Todos os clientes</option>
            {customerBehavior.buyers.slice(0, 20).map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        )}
      </div>

      {/* Metrics overview */}
      <Section title="Métricas gerais">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard icon={ScanLine} label="Total de escaneamentos" value={generalMetrics.totalScans} />
          <MetricCard icon={Users} label="Clientes únicos" value={generalMetrics.uniqueCustomers} />
          <MetricCard icon={Eye} label="Produtos visualizados" value={generalMetrics.viewedProducts} />
          <MetricCard icon={Package} label="Produtos escaneados" value={generalMetrics.scannedProducts} />
          <MetricCard icon={UserCheck} label="Clientes recorrentes" value={generalMetrics.recurringCustomers} />
          <MetricCard icon={TrendingUp} label="Taxa de conversão" value={generalMetrics.conversionRate.toFixed(0) + "%"} />
          <MetricCard icon={Zap} label="Taxa de abandono" value={generalMetrics.abandonmentRate.toFixed(0) + "%"} />
          <MetricCard icon={Clock} label="Escaneamento → Compra" value={generalMetrics.avgScanToBuyHours != null ? `${generalMetrics.avgScanToBuyHours.toFixed(1)}h` : "—"} />
        </div>
      </Section>

      {/* Funnel */}
      <Section title="Funil de conversão">
        <div className="grid gap-4 lg:grid-cols-5">
          {funnelData.steps.map((step, i) => {
            const barWidth = step.value > 0 ? (step.value / funnelData.maxVal) * 100 : 0;
            return (
              <div key={step.key} className="rounded-xl border bg-card p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <step.icon className="size-4 text-primary" />
                    <span className="text-xs text-muted-foreground">{step.label}</span>
                  </div>
                </div>
                <div className="mt-1 text-2xl font-bold">{step.value}</div>
                <div className="mt-1 h-1.5 w-full rounded-full bg-muted">
                  <div className="h-1.5 rounded-full bg-primary" style={{ width: `${barWidth}%` }} />
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-2 space-y-1">
          {funnelData.conversions.map((c, i) => (
            <div key={i} className="flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-1.5 text-xs text-muted-foreground">
              <span className="font-medium">{c.from}</span>
              <ArrowRightIcon className="size-3" />
              <span className="font-medium">{c.to}</span>
              <span className="ml-auto">
                <span className="font-semibold text-foreground">{c.rate.toFixed(1)}%</span>
                <span className="ml-1 text-destructive">(-{c.loss.toFixed(1)}%)</span>
              </span>
            </div>
          ))}
        </div>
      </Section>

      {/* Product ranking */}
      {productRanking && (
        <Section title="Ranking de produtos">
          <div className="grid gap-4 lg:grid-cols-4">
            <MiniCard title="Mais escaneados" items={productRanking.mostScanned} render={(p) => `${p.scans}x`} />
            <MiniCard title="Mais visualizados" items={productRanking.mostViewed} render={(p) => `${p.views}x`} />
            <MiniCard title="Mais adicionados à Sacola" items={productRanking.mostCartAdded} render={(p) => `${p.cartAdds}x`} />
            <MiniCard title="Mais vendidos" items={productRanking.mostSold} render={(p) => `${p.orderQty} uni`} />
            <MiniCard title="Produtos abandonados" items={productRanking.abandoned} render={(p) => `${p.scans} scans`} />
            <MiniCard title="Nunca comprados" items={productRanking.neverBought} render={(p) => `${p.views} views`} />
            <MiniCard title="Maior conversão" items={productRanking.highestConv} render={(p) => `${p.conversionRate.toFixed(0)}%`} />
            <MiniCard title="Menor conversão" items={productRanking.lowestConv} render={(p) => `${p.conversionRate.toFixed(0)}%`} />
          </div>
        </Section>
      )}

      {/* Categories */}
      <Section title="Categorias">
        <div className="grid gap-4 lg:grid-cols-3">
          {categoryAnalysis.map((cat) => (
            <div key={cat.name} className="rounded-xl border bg-card p-4">
              <div className="flex items-center justify-between">
                <span className="font-medium">{cat.name}</span>
                <span className="text-xs text-muted-foreground">{cat.productCount} produtos</span>
              </div>
              <div className="mt-2 grid grid-cols-3 gap-2 text-center text-xs">
                <div>
                  <div className="font-bold text-lg">{cat.scans}</div>
                  <div className="text-muted-foreground">Scans</div>
                </div>
                <div>
                  <div className="font-bold text-lg">{cat.views}</div>
                  <div className="text-muted-foreground">Views</div>
                </div>
                <div>
                  <div className="font-bold text-lg">{cat.purchases}</div>
                  <div className="text-muted-foreground">Compras</div>
                </div>
              </div>
              <div className="mt-2 flex justify-between text-xs text-muted-foreground">
                <span>Conversão: {cat.conversionRate.toFixed(0)}%</span>
                {cat.abandoned && <span className="text-destructive">Abandonada</span>}
              </div>
            </div>
          ))}
          {categoryAnalysis.length === 0 && (
            <p className="text-sm text-muted-foreground col-span-3">Nenhuma categoria com dados no período.</p>
          )}
        </div>
      </Section>

      {/* Customer behavior */}
      <Section title="Comportamento dos clientes">
        <div className="grid gap-4 lg:grid-cols-3">
          <MiniCard title="Clientes que mais escaneiam" items={customerBehavior.mostScanners} render={(c) => `${c.scans} scans`} />
          <MiniCard title="Clientes que mais compram" items={customerBehavior.mostBuyers} render={(c) => `${c.orders} pedidos`} />
          <MiniCard title="Clientes que apenas pesquisam" items={customerBehavior.scannersOnly} render={(c) => `${c.scans} scans`} />
          <MiniCard title="Clientes que abandonam Sacola" items={customerBehavior.abandoners} render={(c) => `${c.cartAdds} adds`} />
          <MiniCard title="Clientes curiosos" items={customerBehavior.curious} render={(c) => `${c.views} views`} />
          <MiniCard title="Clientes recorrentes" items={customerBehavior.recurring} render={(c) => `${c.orders} pedidos`} />
        </div>
      </Section>

      {/* Time analysis */}
      <Section title="Análise de tempo">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard icon={Clock} label="Tempo médio entre escaneamentos" value={timeAnalysis.avgBetweenVisitsHours != null ? `${timeAnalysis.avgBetweenVisitsHours.toFixed(1)}h` : "—"} />
          <MetricCard icon={Eye} label="Tempo médio na página" value={timeAnalysis.avgViewTimeSec != null ? `${timeAnalysis.avgViewTimeSec.toFixed(0)}s` : "—"} />
          <MetricCard icon={ShoppingCart} label="Tempo até adicionar à Sacola" value={timeAnalysis.avgScanToCartMin != null ? `${Math.round(timeAnalysis.avgScanToCartMin)}min` : "—"} />
          <MetricCard icon={Package} label="Tempo até comprar" value={timeAnalysis.avgScanToBuyMin != null ? `${Math.round(timeAnalysis.avgScanToBuyMin)}min` : "—"} />
          <MetricCard icon={Users} label="Tempo médio entre visitas" value={timeAnalysis.avgBetweenVisitsHours != null ? `${timeAnalysis.avgBetweenVisitsHours.toFixed(1)}h` : "—"} />
          <MetricCard icon={TrendingUp} label="Tempo médio entre compras" value={timeAnalysis.avgBetweenPurchasesHours != null ? `${timeAnalysis.avgBetweenPurchasesHours.toFixed(1)}h` : "—"} />
        </div>
      </Section>

      {/* Hour/Day analysis */}
      <Section title="Horários e dias">
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl border bg-card p-4">
            <h3 className="mb-3 text-sm font-semibold">Escaneamentos por hora</h3>
            <div className="space-y-1">
              {Array.from({ length: 24 }, (_, h) => h).map((h) => {
                const count = timeBuckets.hourScans[h] ?? 0;
                const maxH = Math.max(...Object.values(timeBuckets.hourScans), 1);
                const pct = (count / maxH) * 100;
                return (
                  <div key={h} className="flex items-center gap-2 text-xs">
                    <span className="w-6 shrink-0 text-right text-muted-foreground">{String(h).padStart(2, "0")}h</span>
                    <div className="h-2 w-full rounded-full bg-muted">
                      <div className="h-2 rounded-full bg-primary" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="w-6 shrink-0 text-right">{count}</span>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="rounded-xl border bg-card p-4">
            <h3 className="mb-3 text-sm font-semibold">Compras por hora</h3>
            <div className="space-y-1">
              {Array.from({ length: 24 }, (_, h) => h).map((h) => {
                const count = timeBuckets.hourPurchases[h] ?? 0;
                const maxH = Math.max(...Object.values(timeBuckets.hourPurchases), 1);
                const pct = (count / maxH) * 100;
                return (
                  <div key={h} className="flex items-center gap-2 text-xs">
                    <span className="w-6 shrink-0 text-right text-muted-foreground">{String(h).padStart(2, "0")}h</span>
                    <div className="h-2 w-full rounded-full bg-muted">
                      <div className="h-2 rounded-full bg-green-500" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="w-6 shrink-0 text-right">{count}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          <div className="rounded-xl border bg-card p-4">
            <h3 className="mb-2 text-sm font-semibold">Dias mais movimentados (scans)</h3>
            <div className="space-y-1">
              {["segunda", "terça", "quarta", "quinta", "sexta", "sábado", "domingo"].map((d) => {
                const count = timeBuckets.dayScans[d] ?? 0;
                const maxD = Math.max(...Object.values(timeBuckets.dayScans), 1);
                const pct = (count / maxD) * 100;
                return (
                  <div key={d} className="flex items-center gap-2 text-xs">
                    <span className="w-10 shrink-0 capitalize text-muted-foreground">{d.slice(0, 3)}</span>
                    <div className="h-2 w-full rounded-full bg-muted">
                      <div className="h-2 rounded-full bg-primary" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="w-6 shrink-0 text-right">{count}</span>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="rounded-xl border bg-card p-4">
            <h3 className="mb-2 text-sm font-semibold">Dias com maior conversão</h3>
            <div className="space-y-1">
              {timeBuckets.bestConversionDays.map((d) => (
                <div key={d.day} className="flex items-center justify-between text-xs">
                  <span className="capitalize text-muted-foreground">{d.day}</span>
                  <span>
                    <span className="font-semibold">{d.rate.toFixed(0)}%</span>
                    <span className="text-muted-foreground ml-1">({d.scans} scans, {d.buys} compras)</span>
                  </span>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-xl border bg-card p-4">
            <h3 className="mb-2 text-sm font-semibold">Dias com menor conversão</h3>
            <div className="space-y-1">
              {[...timeBuckets.bestConversionDays].reverse().map((d) => (
                <div key={d.day} className="flex items-center justify-between text-xs">
                  <span className="capitalize text-muted-foreground">{d.day}</span>
                  <span>
                    <span className="font-semibold">{d.rate.toFixed(0)}%</span>
                    <span className="text-muted-foreground ml-1">({d.scans} scans, {d.buys} compras)</span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Section>

      {/* Context analysis */}
      <Section title="Contexto">
        <div className="grid gap-4 lg:grid-cols-2">
          {contextAnalysis.map((ctx) => (
            <div key={ctx.context} className="rounded-xl border bg-card p-4">
              <div className="flex items-center justify-between">
                <span className="font-medium capitalize">{ctx.context}</span>
                <span className="text-xs text-muted-foreground">{ctx.scanners} clientes</span>
              </div>
              <div className="mt-2 grid grid-cols-4 gap-2 text-center text-xs">
                <div><div className="font-bold text-lg">{ctx.scanners}</div><div className="text-muted-foreground">Scanners</div></div>
                <div><div className="font-bold text-lg">{ctx.buyers}</div><div className="text-muted-foreground">Compradores</div></div>
                <div><div className="font-bold text-lg">{ctx.orders}</div><div className="text-muted-foreground">Pedidos</div></div>
                <div><div className="font-bold text-lg">{formatBRL(ctx.revenue)}</div><div className="text-muted-foreground">Receita</div></div>
              </div>
              <div className="mt-2 flex justify-between text-xs text-muted-foreground">
                <span>Conversão: {ctx.conversionRate.toFixed(0)}%</span>
                <span>Premium: {ctx.premiumBuyers} clientes</span>
              </div>
            </div>
          ))}
          {contextAnalysis.length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhum dado de contexto no período.</p>
          )}
        </div>
      </Section>

      {/* Demographics */}
      <Section title="Demografia dos clientes">
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl border bg-card p-4">
            <h3 className="mb-3 text-sm font-semibold">Distribuição por sexo</h3>
            <div className="space-y-2">
              {demographicAnalysis.genderDistribution.map((g) => {
                const maxCount = Math.max(...demographicAnalysis.genderDistribution.map((x) => x.count), 1);
                const pct = (g.count / maxCount) * 100;
                return (
                  <div key={g.key}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-medium">{g.label}</span>
                      <span className="text-muted-foreground">{g.count} clientes · {formatBRL(g.avgSpend)} ticket médio</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-muted">
                      <div className="h-2 rounded-full bg-primary" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
              {demographicAnalysis.genderDistribution.length === 0 && (
                <p className="text-xs text-muted-foreground">Sem dados de sexo no período.</p>
              )}
            </div>
          </div>
          <div className="rounded-xl border bg-card p-4">
            <h3 className="mb-3 text-sm font-semibold">Distribuição por faixa etária</h3>
            <div className="space-y-2">
              {demographicAnalysis.ageRangeDistribution.map((a) => {
                const maxCount = Math.max(...demographicAnalysis.ageRangeDistribution.map((x) => x.count), 1);
                const pct = (a.count / maxCount) * 100;
                return (
                  <div key={a.key}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-medium">{a.label}</span>
                      <span className="text-muted-foreground">{a.count} clientes · {formatBRL(a.avgSpend)} ticket médio</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-muted">
                      <div className="h-2 rounded-full bg-primary" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
              {demographicAnalysis.ageRangeDistribution.length === 0 && (
                <p className="text-xs text-muted-foreground">Sem dados de faixa etária no período.</p>
              )}
            </div>
          </div>
        </div>
      </Section>

      {/* Interest map */}
      <Section title="Mapa de interesse">
        {interestMap.length > 0 ? (
          <div className="grid gap-4 lg:grid-cols-4">
            <MiniCard title="Produtos mais visualizados" items={interestMap.filter((p) => p.totalInterest > 0).sort((a, b) => b.totalInterest - a.totalInterest).slice(0, 5)} render={(p) => `${p.totalInterest} views`} />
            <MiniCard title="Produtos ignorados" items={interestMap.filter((p) => p.ignored).slice(0, 5)} render={(p) => `${p.scans} scans`} />
            <MiniCard title="Compra rápida" items={interestMap.filter((p) => p.fastBuy).slice(0, 5)} render={(p) => `${p.orderQty} vendidos`} />
            <MiniCard title="Decisão demorada" items={interestMap.filter((p) => p.slowDecision).slice(0, 5)} render={(p) => `${p.views}/${p.orderQty} v/p`} />
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Sem dados suficientes para o mapa de interesse.</p>
        )}
      </Section>

      {/* Automatic insights */}
      <Section title="Inteligência automática">
        {autoInsights.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {autoInsights.map((ins, i) => {
              const iconMap: Record<string, any> = { alert: AlertTriangle, positive: CheckCircle2, info: Lightbulb };
              const Icon = iconMap[ins.type] ?? Info;
              const colorMap: Record<string, string> = {
                alert: "border-destructive/30 bg-destructive/10",
                positive: "border-green-500/30 bg-green-500/10",
                info: "border-blue-500/30 bg-blue-500/10",
              };
              return (
                <div key={i} className={`rounded-xl border p-4 ${colorMap[ins.type] ?? ""}`}>
                  <div className="flex items-start gap-2">
                    <Icon className={`size-5 mt-0.5 shrink-0 ${ins.type === "alert" ? "text-destructive" : ins.type === "positive" ? "text-green-600" : "text-blue-600"}`} />
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
          <p className="text-sm text-muted-foreground">Nenhum insight disponível ainda. Acumule mais dados de eventos.</p>
        )}
      </Section>

      {/* CRM cross-reference */}
      <Section title="Cruzamento com CRM">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b text-muted-foreground">
                <th className="px-2 py-1 text-left font-medium">Cliente</th>
                <th className="px-2 py-1 text-right font-medium">Scans</th>
                <th className="px-2 py-1 text-right font-medium">Views</th>
                <th className="px-2 py-1 text-right font-medium">Carrinho</th>
                <th className="px-2 py-1 text-right font-medium">Pedidos</th>
                <th className="px-2 py-1 text-right font-medium">Gasto</th>
                <th className="px-2 py-1 text-left font-medium">Produtos favoritos</th>
                <th className="px-2 py-1 text-left font-medium">Categorias</th>
                <th className="px-2 py-1 text-left font-medium">Abandonados</th>
              </tr>
            </thead>
            <tbody>
              {crmCrossRef.slice(0, 20).map((c) => (
                <tr key={c.id} className="border-b hover:bg-muted/30">
                  <td className="px-2 py-1 font-medium">{c.name}</td>
                  <td className="px-2 py-1 text-right">{c.scans}</td>
                  <td className="px-2 py-1 text-right">{c.views}</td>
                  <td className="px-2 py-1 text-right">{c.cartAdds}</td>
                  <td className="px-2 py-1 text-right">{c.orders}</td>
                  <td className="px-2 py-1 text-right">{formatBRL(c.totalSpent)}</td>
                  <td className="max-w-[120px] truncate px-2 py-1">{c.favoriteProducts.map((p: any) => p?.name).filter(Boolean).join(", ")}</td>
                  <td className="max-w-[100px] truncate px-2 py-1">{c.favoriteCategories.join(", ")}</td>
                  <td className="max-w-[120px] truncate px-2 py-1">{c.abandonedProducts.map((p: any) => p?.name).filter(Boolean).join(", ") || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {crmCrossRef.length === 0 && (
            <p className="py-4 text-center text-muted-foreground">Nenhum dado de CRM disponível.</p>
          )}
        </div>
      </Section>

      {/* Opportunities / Alerts */}
      <Section title="Oportunidades">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {productRanking && productRanking.all.filter((p) => p.scans > 10 && p.orderQty === 0).length > 0 && (
            <OpportunityCard
              icon={Zap}
              title="Produto muito visualizado, pouco comprado"
              description={`${productRanking.all.filter((p) => p.scans > 10 && p.orderQty === 0).length} produtos com muitos scans mas nenhuma venda.`}
              type="alert"
            />
          )}
          {productRanking && productRanking.all.filter((p) => p.scans === 0 && p.name !== "Desconhecido").length > 0 && (
            <OpportunityCard
              icon={Eye}
              title="Produtos esquecidos"
              description={`${productRanking.all.filter((p) => p.scans === 0 && p.name !== "Desconhecido").length} produtos nunca foram escaneados.`}
              type="info"
            />
          )}
          {productRanking && productRanking.highestConv.length > 0 && productRanking.highestConv[0].conversionRate > 50 && (
            <OpportunityCard
              icon={CheckCircle2}
              title="Produto com excelente conversão"
              description={`${productRanking.highestConv[0].name} tem ${productRanking.highestConv[0].conversionRate.toFixed(0)}% de conversão.`}
              type="positive"
            />
          )}
          {categoryAnalysis.filter((c) => c.scans > 0 && c.conversionRate > 30).length > 0 && (
            <OpportunityCard
              icon={TrendingUp}
              title="Categoria em crescimento"
              description={`${categoryAnalysis.filter((c) => c.scans > 0 && c.conversionRate > 30).length} categorias com boa conversão.`}
              type="positive"
            />
          )}
          {categoryAnalysis.filter((c) => c.scans > 5 && c.conversionRate === 0).length > 0 && (
            <OpportunityCard
              icon={TrendingUp}
              title="Categoria em queda"
              description={`${categoryAnalysis.filter((c) => c.scans > 5 && c.conversionRate === 0).length} categorias com scans mas sem vendas.`}
              type="alert"
            />
          )}
          {productRanking && productRanking.all.filter((p) => p.scannedBy >= 5 && p.orderedBy === 0).length > 0 && (
            <OpportunityCard
              icon={AlertTriangle}
              title="Produto com alta taxa de abandono"
              description={`${productRanking.all.filter((p) => p.scannedBy >= 5 && p.orderedBy === 0).length} produtos com alta taxa de abandono.`}
              type="alert"
            />
          )}
          {productRanking && productRanking.all.filter((p) => p.orderQty === 0 && p.name !== "Desconhecido").length > 0 && (
            <OpportunityCard
              icon={Package}
              title="Produto sem vendas"
              description={`${productRanking.all.filter((p) => p.orderQty === 0 && p.name !== "Desconhecido").length} produtos nunca foram vendidos.`}
              type="info"
            />
          )}
          {generalMetrics.avgScanToBuyHours != null && generalMetrics.avgScanToBuyHours > 24 && (
            <OpportunityCard
              icon={Clock}
              title="Decisão de compra lenta"
              description={`Clientes levam em média ${generalMetrics.avgScanToBuyHours.toFixed(0)}h para comprar após escanear.`}
              type="info"
            />
          )}
        </div>
      </Section>
    </div>
  );
}

// ── Sub-components ──

function PeriodSelector({ current, onChange }: { current: PeriodKey; onChange: (k: PeriodKey) => void }) {
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

function MetricCard({ icon: Icon, label, value }: { icon: any; label: string; value: string | number }) {
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
      <h2 className="mb-3 text-sm font-semibold tracking-wide uppercase text-muted-foreground">{title}</h2>
      {children}
    </div>
  );
}

function MiniCard({ title, items, render }: { title: string; items: any[]; render: (item: any) => string }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <h3 className="mb-2 text-xs font-semibold text-muted-foreground uppercase">{title}</h3>
      {items.length > 0 ? (
        <div className="space-y-1">
          {items.slice(0, 5).map((item: any, i: number) => (
            <div key={item.id ?? i} className="flex justify-between text-xs">
              <span className="truncate">{item.name}</span>
              <span className="font-semibold shrink-0 ml-2">{render(item)}</span>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">Sem dados no período.</p>
      )}
    </div>
  );
}

function ArrowRightIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M5 12h14M12 5l7 7-7 7" />
    </svg>
  );
}

function OpportunityCard({ icon: Icon, title, description, type }: { icon: any; title: string; description: string; type: "alert" | "positive" | "info" }) {
  const colorMap: Record<string, string> = {
    alert: "border-destructive/30 bg-destructive/10",
    positive: "border-green-500/30 bg-green-500/10",
    info: "border-blue-500/30 bg-blue-500/10",
  };
  return (
    <div className={`rounded-xl border p-4 ${colorMap[type] ?? ""}`}>
      <div className="flex items-start gap-2">
        <Icon className={`size-5 mt-0.5 shrink-0 ${type === "alert" ? "text-destructive" : type === "positive" ? "text-green-600" : "text-blue-600"}`} />
        <div>
          <div className="text-sm font-semibold">{title}</div>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
    </div>
  );
}

export default InteligenciaPage;
