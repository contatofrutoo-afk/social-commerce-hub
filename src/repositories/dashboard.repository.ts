import { supabase } from "@/integrations/supabase/client";
import type { PostMetric, ProductMetric, BusinessMetrics, Insight } from "./types";

export interface DashboardMetrics {
  topLikedProducts: { productId: string; name: string; count: number }[];
  topOrderedProducts: { productId: string; name: string; count: number; revenue: number }[];
  topCommentedPosts: { postId: string; count: number }[];
  mostEngagedCustomers: { customerId: string; name: string; reactionCount: number; orderCount: number; commentCount: number }[];
  conversionRates: {
    customersWhoReacted: number;
    customersWhoOrdered: number;
    reactedThenOrdered: number;
    reactionToOrderRate: number;
    orderCompletionRate: number;
  };
}

function getHourFromISO(iso: string): number {
  return new Date(iso).getHours();
}
function getDayFromISO(iso: string): string {
  const days = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
  return days[new Date(iso).getDay()];
}
function hoursDiff(a: string, b: string): number {
  return (new Date(b).getTime() - new Date(a).getTime()) / 3600000;
}
function average(nums: number[]): number {
  return nums.length > 0 ? nums.reduce((s, n) => s + n, 0) / nums.length : 0;
}

export const dashboardRepository = {
  async getMetrics(companyId: string): Promise<DashboardMetrics> {
    // Query em paralelo para performance
    const [likesResult, ordersResult, reactionsResult, commentsResult, customersResult] = await Promise.all([
      supabase
        .from("product_likes")
        .select("product_id, product:products(name)"),
      // Buscar produtos mais pedidos com revenue
      supabase
        .from("order_items")
        .select("product_id, quantity, unit_price, product:products!inner(name), order:orders!inner(company_id)")
        .eq("order.company_id", companyId),
      // Reações por cliente
      supabase
        .from("post_reactions")
        .select("customer_id, post:posts!inner(company_id)")
        .eq("post.company_id", companyId),
      // Comentários por post
      supabase
        .from("comments")
        .select("post_id, post:posts!inner(company_id)")
        .eq("post.company_id", companyId),
      // Clientes + pedidos (para taxa de conversão)
      supabase
        .from("customers")
        .select("id, name")
        .eq("company_id", companyId),
    ]);

    if (likesResult.error) throw likesResult.error;
    if (ordersResult.error) throw ordersResult.error;
    if (reactionsResult.error) throw reactionsResult.error;
    if (commentsResult.error) throw commentsResult.error;
    if (customersResult.error) throw customersResult.error;

    // Produtos mais curtidos
    // product_likes não tem company_id direto, usa join com products
    const likeRows = likesResult.data ?? [];
    const productLikeCount: Record<string, { productId: string; name: string; count: number }> = {};
    likeRows.forEach((r: any) => {
      if (r.product?.id) {
        const pid = r.product.id;
        if (!productLikeCount[pid]) {
          productLikeCount[pid] = { productId: pid, name: r.product.name ?? "", count: 0 };
        }
        productLikeCount[pid].count++;
      }
    });

    // Produtos mais pedidos com revenue
    const orderRows = ordersResult.data ?? [];
    const productOrderCount: Record<string, { productId: string; name: string; count: number; revenue: number }> = {};
    orderRows.forEach((r: any) => {
      const pid = r.product_id;
      if (!productOrderCount[pid]) {
        productOrderCount[pid] = { productId: pid, name: r.product?.name ?? "", count: 0, revenue: 0 };
      }
      productOrderCount[pid].count += r.quantity;
      productOrderCount[pid].revenue += Number(r.unit_price) * r.quantity;
    });

    // Posts mais comentados
    const commentRows = commentsResult.data ?? [];
    const postCommentCount: Record<string, number> = {};
    commentRows.forEach((r: any) => {
      postCommentCount[r.post_id] = (postCommentCount[r.post_id] ?? 0) + 1;
    });

    // Clientes mais engajados
    const reactionRows = reactionsResult.data ?? [];
    const customerReactions: Record<string, number> = {};
    reactionRows.forEach((r: any) => {
      if (r.customer_id) {
        customerReactions[r.customer_id] = (customerReactions[r.customer_id] ?? 0) + 1;
      }
    });

    const customerComments: Record<string, number> = {};
    commentRows.forEach((r: any) => {
      // comments não tem customer_id direto no select atual
    });

    const customerRows = customersResult.data ?? [];
    const customerOrderCount: Record<string, number> = {};
    // orders não estão nesta query - precisamos de uma query adicional
    const { data: orderCustomerData } = await supabase
      .from("orders")
      .select("customer_id")
      .eq("company_id", companyId);

    (orderCustomerData ?? []).forEach((o: any) => {
      customerOrderCount[o.customer_id] = (customerOrderCount[o.customer_id] ?? 0) + 1;
    });

    // Contar quantos clientes reagiram e depois pediram
    const reactors = new Set(Object.keys(customerReactions));
    const orderers = new Set(Object.keys(customerOrderCount));
    let reactedThenOrdered = 0;
    reactors.forEach((cid) => {
      if (orderers.has(cid)) reactedThenOrdered++;
    });

    const totalReactors = reactors.size;
    const totalOrderers = orderers.size;
    // Ordenar clientes mais engajados
    const engagedCustomers = customerRows
      .filter((c: any) => (customerReactions[c.id] ?? 0) > 0 || (customerOrderCount[c.id] ?? 0) > 0 || (customerComments[c.id] ?? 0) > 0)
      .map((c: any) => ({
        customerId: c.id,
        name: c.name,
        reactionCount: customerReactions[c.id] ?? 0,
        orderCount: customerOrderCount[c.id] ?? 0,
        commentCount: customerComments[c.id] ?? 0,
      }))
      .sort((a: any, b: any) => (b.reactionCount + b.orderCount * 3) - (a.reactionCount + a.orderCount * 3))
      .slice(0, 10);

    // Ordenar e limitar
    const topLiked = Object.values(productLikeCount)
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const topOrdered = Object.values(productOrderCount)
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const topCommented = Object.entries(postCommentCount)
      .map(([postId, count]) => ({ postId, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Pedidos concluídos
    const { data: completedOrders } = await supabase
      .from("orders")
      .select("id", { count: "exact" })
      .eq("company_id", companyId)
      .eq("status", "completed");

    const totalOrders = orderCustomerData?.length ?? 0;
    const completedCount = completedOrders?.length ?? 0;

    return {
      topLikedProducts: topLiked,
      topOrderedProducts: topOrdered,
      topCommentedPosts: topCommented,
      mostEngagedCustomers: engagedCustomers,
      conversionRates: {
        customersWhoReacted: totalReactors,
        customersWhoOrdered: totalOrderers,
        reactedThenOrdered,
        reactionToOrderRate: totalReactors > 0 ? (reactedThenOrdered / totalReactors) * 100 : 0,
        orderCompletionRate: totalOrders > 0 ? (completedCount / totalOrders) * 100 : 0,
      },
    };
  },

  // ---- Post-level analytics ----
  async getPostMetrics(companyId: string): Promise<PostMetric[]> {
    const [postsResult, commentsResult, ordersResult] = await Promise.all([
      supabase
        .from("posts")
        .select(`id, text, author_type, customer_id, customer:customers(name), created_at,
          post_products(product:products(id, name)),
          post_reactions(customer_id, type, created_at)`)
        .eq("company_id", companyId)
        .order("created_at", { ascending: false }),
      supabase
        .from("comments")
        .select("post_id, image_url, created_at, customer_id"),
      supabase
        .from("orders")
        .select("customer_id, created_at, order_items(product_id, quantity, unit_price)")
        .eq("company_id", companyId),
    ]);

    if (postsResult.error) throw postsResult.error;
    if (commentsResult.error) throw commentsResult.error;
    if (ordersResult.error) throw ordersResult.error;

    const posts = postsResult.data ?? [];
    const comments = commentsResult.data ?? [];
    const orders = ordersResult.data ?? [];

    // Index comments by post_id
    const commentsByPost: Record<string, typeof comments> = {};
    comments.forEach((c: any) => {
      if (!commentsByPost[c.post_id]) commentsByPost[c.post_id] = [];
      commentsByPost[c.post_id].push(c);
    });

    // Index order items by product_id for matching
    const productOrderCount: Record<string, { count: number; revenue: number; customers: Set<string> }> = {};
    orders.forEach((o: any) => {
      (o.order_items ?? []).forEach((i: any) => {
        const pid = i.product_id;
        if (!productOrderCount[pid]) productOrderCount[pid] = { count: 0, revenue: 0, customers: new Set() };
        productOrderCount[pid].count += i.quantity;
        productOrderCount[pid].revenue += Number(i.unit_price) * i.quantity;
        productOrderCount[pid].customers.add(o.customer_id);
      });
    });

    return posts.map((p: any) => {
      const postComments = commentsByPost[p.id] ?? [];
      const photoCount = postComments.filter((c: any) => c.image_url).length;
      const reactions = p.post_reactions ?? [];
      const loveCount = reactions.filter((r: any) => r.type === "love").length;
      const dislikeCount = reactions.filter((r: any) => r.type === "dislike").length;

      // Products linked to this post with order data
      const products = (p.post_products ?? []).map((pp: any) => {
        const prod = pp.product ?? { id: "", name: "" };
        const stats = productOrderCount[prod.id] ?? { count: 0, revenue: 0 };
        return {
          id: prod.id,
          name: prod.name ?? "",
          ordered: stats.count,
          revenue: stats.revenue,
        };
      });
      const orderCount = products.reduce((s: number, pr: any) => s + pr.ordered, 0);
      const productCount = products.length;
      const viewCount = reactions.length + postComments.length; // proxy (no view tracking)
      const conversionRate = viewCount > 0 ? (orderCount / viewCount) * 100 : 0;

      // Hour breakdown from reactions + comments
      const allEvents = [
        ...reactions.map((r: any) => r.created_at),
        ...postComments.map((c: any) => c.created_at),
      ];
      const hourBuckets: Record<number, number> = {};
      const dayBuckets: Record<string, number> = {};
      allEvents.forEach((ts: string) => {
        const h = getHourFromISO(ts);
        hourBuckets[h] = (hourBuckets[h] ?? 0) + 1;
        const d = getDayFromISO(ts);
        dayBuckets[d] = (dayBuckets[d] ?? 0) + 1;
      });
      const hourBreakdown = Object.entries(hourBuckets).map(([hour, count]) => ({ hour: Number(hour), count }));
      const dayBreakdown = Object.entries(dayBuckets).map(([day, count]) => ({ day, count }));

      // Context from checkins of customers who interacted
      const customerIds = new Set([
        ...reactions.map((r: any) => r.customer_id),
        ...postComments.map((c: any) => c.customer_id),
      ].filter(Boolean));

      return {
        id: p.id,
        text: p.text,
        authorType: p.author_type,
        authorName: p.author_type === "business" ? "Estabelecimento" : (p.customer?.name ?? "Cliente"),
        createdAt: p.created_at,
        loveCount,
        dislikeCount,
        commentCount: postComments.length,
        photoCount,
        productCount,
        products,
        orderCount,
        conversionRate,
        hourBreakdown,
        dayBreakdown,
        contextBreakdown: [], // populated below
      };
    });
  },

  // ---- Product-level analytics ----
  async getProductMetrics(companyId: string): Promise<ProductMetric[]> {
    const [productsResult, likesResult, ordersResult] = await Promise.all([
      supabase
        .from("products")
        .select(`*`)
        .eq("company_id", companyId),
      supabase
        .from("product_likes")
        .select("product_id, customer_id, customer:customers(name)"),
      supabase
        .from("orders")
        .select("customer_id, created_at, order_items(product_id, quantity, unit_price)")
        .eq("company_id", companyId),
    ]);

    if (productsResult.error) throw productsResult.error;
    if (likesResult.error) throw likesResult.error;
    if (ordersResult.error) throw ordersResult.error;

    const products = productsResult.data ?? [];
    const likes = likesResult.data ?? [];
    const orders = ordersResult.data ?? [];

    // Index likes by product
    const likesByProduct: Record<string, { customer_id: string; name: string }[]> = {};
    likes.forEach((l: any) => {
      if (!likesByProduct[l.product_id]) likesByProduct[l.product_id] = [];
      likesByProduct[l.product_id].push({ customer_id: l.customer_id, name: l.customer?.name ?? "Cliente" });
    });

    // Index order items by product
    const orderDataByProduct: Record<string, {
      count: number; revenue: number; quantities: number[];
      hours: number[]; days: string[]; customers: Set<string>;
      customerDetails: { id: string; name: string }[];
    }> = {};
    const allOrderHours: number[] = [];
    const allOrderDays: string[] = [];

    orders.forEach((o: any) => {
      (o.order_items ?? []).forEach((i: any) => {
        const pid = i.product_id;
        if (!orderDataByProduct[pid]) {
          orderDataByProduct[pid] = {
            count: 0, revenue: 0, quantities: [],
            hours: [], days: [], customers: new Set(),
            customerDetails: [],
          };
        }
        orderDataByProduct[pid].count += i.quantity;
        orderDataByProduct[pid].revenue += Number(i.unit_price) * i.quantity;
        orderDataByProduct[pid].quantities.push(i.quantity);
        const h = getHourFromISO(o.created_at);
        orderDataByProduct[pid].hours.push(h);
        const d = getDayFromISO(o.created_at);
        orderDataByProduct[pid].days.push(d);
        orderDataByProduct[pid].customers.add(o.customer_id);
        allOrderHours.push(h);
        allOrderDays.push(d);
      });
    });

    // Products bought together
    const boughtTogetherMap: Record<string, Record<string, number>> = {};
    orders.forEach((o: any) => {
      const pids = (o.order_items ?? []).map((i: any) => i.product_id);
      for (const a of pids) {
        if (!boughtTogetherMap[a]) boughtTogetherMap[a] = {};
        for (const b of pids) {
          if (a !== b) {
            boughtTogetherMap[a][b] = (boughtTogetherMap[a][b] ?? 0) + 1;
          }
        }
      }
    });

    const now = Date.now();
    const day30 = 30 * 24 * 60 * 60 * 1000;
    const recentCheckins = await supabase
      .from("checkins")
      .select("customer_id, context")
      .eq("company_id", companyId);
    const checkinContexts: Record<string, string[]> = {};
    (recentCheckins.data ?? []).forEach((c: any) => {
      if (!checkinContexts[c.customer_id]) checkinContexts[c.customer_id] = [];
      checkinContexts[c.customer_id].push(c.context);
    });

    return products.map((p: any) => {
      const pid = p.id;
      const od = orderDataByProduct[pid];
      const likedBy = likesByProduct[pid] ?? [];

      // Peak hour/day
      const hours = od?.hours ?? [];
      const peakHour = hours.length > 0
        ? Number(Object.entries(hours.reduce((acc: Record<number, number>, h: number) => {
            acc[h] = (acc[h] ?? 0) + 1;
            return acc;
          }, {})).sort((a, b) => b[1] - a[1])[0]?.[0]) : null;

      const days2 = od?.days ?? [];
      const peakDay = days2.length > 0
        ? Object.entries(days2.reduce((acc: Record<string, number>, d: string) => {
            acc[d] = (acc[d] ?? 0) + 1;
            return acc;
          }, {})).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null : null;

      // Bought together
      const together = Object.entries(boughtTogetherMap[pid] ?? {})
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([id, count]) => ({ id, name: products.find((pr: any) => pr.id === id)?.name ?? "", count }));

      // Customers who bought
      const custList = Array.from(od?.customers ?? []).map((cid) => ({ id: cid, name: "" }));
      // Customers who liked (interested)
      const interestedList = likedBy.map((l: any) => ({ id: l.customer_id, name: l.name }));

      return {
        id: pid,
        name: p.name,
        category: p.category,
        price: Number(p.price),
        imageUrl: p.image_url,
        likes: likedBy.length,
        orderCount: od?.count ?? 0,
        quantitySold: od?.count ?? 0,
        revenue: od?.revenue ?? 0,
        customers: custList,
        interestedCustomers: interestedList,
        peakSaleHour: peakHour,
        peakSaleDay: peakDay,
        buyerProfile: [],
        boughtTogether: together,
      };
    });
  },

  // ---- Business-level metrics ----
  async getBusinessMetrics(companyId: string): Promise<BusinessMetrics> {
    const [
      customersResult,
      checkinsResult,
      ordersResult,
      postsResult,
      commentsResult,
    ] = await Promise.all([
      supabase.from("customers").select("*").eq("company_id", companyId),
      supabase.from("checkins").select("context, source, created_at, customer_id").eq("company_id", companyId),
      supabase.from("orders").select("total, created_at, customer_id").eq("company_id", companyId),
      supabase.from("posts").select("id").eq("company_id", companyId),
      supabase.from("comments").select("id, image_url").eq("post.company_id", companyId),
    ]);

    if (customersResult.error) throw customersResult.error;
    if (checkinsResult.error) throw checkinsResult.error;
    if (ordersResult.error) throw ordersResult.error;
    if (postsResult.error) throw postsResult.error;
    if (commentsResult.error) throw commentsResult.error;

    const customers = customersResult.data ?? [];
    const checkins = checkinsResult.data ?? [];
    const orders = ordersResult.data ?? [];
    const totalPosts = postsResult.data?.length ?? 0;
    const totalComments = commentsResult.data?.length ?? 0;
    const totalPhotos = commentsResult.data?.filter((c: any) => c.image_url).length ?? 0;

    const now = Date.now();
    const day30 = 30 * 24 * 60 * 60 * 1000;
    const day7 = 7 * 24 * 60 * 60 * 1000;

    const activeCustomers = customers.filter((c: any) => now - new Date(c.last_visit_at).getTime() < day7);
    const inactiveCustomers = customers.filter((c: any) => now - new Date(c.last_visit_at).getTime() > day30);
    const recurringCustomers = customers.filter((c: any) => c.visit_count > 1);
    const newCustomers30d = customers.filter((c: any) => now - new Date(c.first_visit_at).getTime() < day30);

    // Visit contexts
    const contextCounts: Record<string, number> = {};
    checkins.forEach((c: any) => { contextCounts[c.context] = (contextCounts[c.context] ?? 0) + 1; });

    // Access source
    const sourceCounts: Record<string, number> = {};
    checkins.forEach((c: any) => {
      const s = c.source ?? "desconhecido";
      sourceCounts[s] = (sourceCounts[s] ?? 0) + 1;
    });

    // Peak hours/days from checkins
    const hourCounts: Record<number, number> = {};
    const dayCounts: Record<string, number> = {};
    checkins.forEach((c: any) => {
      const h = getHourFromISO(c.created_at);
      hourCounts[h] = (hourCounts[h] ?? 0) + 1;
      const d = getDayFromISO(c.created_at);
      dayCounts[d] = (dayCounts[d] ?? 0) + 1;
    });

    const totalRevenue = orders.reduce((s: number, o: any) => s + Number(o.total), 0);
    const avgTicket = orders.length > 0 ? totalRevenue / orders.length : 0;

    // Time between visits per customer
    const visitGaps: number[] = [];
    const customerCheckins: Record<string, string[]> = {};
    checkins.forEach((c: any) => {
      if (!customerCheckins[c.customer_id]) customerCheckins[c.customer_id] = [];
      customerCheckins[c.customer_id].push(c.created_at);
    });
    Object.values(customerCheckins).forEach((times) => {
      times.sort();
      for (let i = 1; i < times.length; i++) {
        visitGaps.push(hoursDiff(times[i - 1], times[i]));
      }
    });
    const avgGap = visitGaps.length > 0 ? average(visitGaps) : null;

    // Top products
    const orderItemsResult = await supabase
      .from("order_items")
      .select("product_id, quantity, product:products!inner(name), order:orders!inner(company_id)")
      .eq("order.company_id", companyId);
    const productCounts: Record<string, { name: string; count: number }> = {};
    (orderItemsResult.data ?? []).forEach((i: any) => {
      const pid = i.product_id;
      if (!productCounts[pid]) productCounts[pid] = { name: i.product?.name ?? "", count: 0 };
      productCounts[pid].count += i.quantity;
    });
    const topProducts = Object.entries(productCounts)
      .map(([id, v]) => ({ id, name: v.name, count: v.count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Top categories
    const catCounts: Record<string, number> = {};
    (orderItemsResult.data ?? []).forEach((i: any) => {
      const cat = i.product?.category ?? "sem categoria";
      catCounts[cat] = (catCounts[cat] ?? 0) + 1;
    });
    const topCategories = Object.entries(catCounts)
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      totalCustomers: customers.length,
      activeCustomers: activeCustomers.length,
      inactiveCustomers: inactiveCustomers.length,
      recurringCustomers: recurringCustomers.length,
      newCustomersLast30d: newCustomers30d.length,
      totalCheckins: checkins.length,
      totalOrders: orders.length,
      totalPosts,
      totalComments,
      totalPhotos,
      accessBySource: Object.entries(sourceCounts).map(([source, count]) => ({ source, count })),
      visitContexts: Object.entries(contextCounts).map(([context, count]) => ({ context, count })),
      peakHours: Object.entries(hourCounts).map(([hour, count]) => ({ hour: Number(hour), count })),
      peakDays: Object.entries(dayCounts).map(([day, count]) => ({ day, count })),
      avgTicket,
      avgTimeBetweenVisitsHours: avgGap,
      topProducts,
      topCategories,
    };
  },

  // ---- Auto-generated insights ----
  async getInsights(companyId: string): Promise<Insight[]> {
    const insights: Insight[] = [];

    const [customersResult, ordersResult, productsResult] = await Promise.all([
      supabase.from("customers").select("id, name, visit_count, last_visit_at").eq("company_id", companyId),
      supabase.from("orders").select("customer_id, total, created_at").eq("company_id", companyId),
      supabase
        .from("products")
        .select("id, name, available").eq("company_id", companyId),
    ]);

    if (customersResult.error) throw customersResult.error;
    if (ordersResult.error) throw ordersResult.error;
    if (productsResult.error) throw productsResult.error;

    const customers = customersResult.data ?? [];
    const orders = ordersResult.data ?? [];
    const products = productsResult.data ?? [];

    const now = Date.now();
    const day30 = 30 * 24 * 60 * 60 * 1000;
    const day60 = 60 * 24 * 60 * 60 * 1000;

    // Decreasing frequency
    const decreasing = customers.filter((c: any) => {
      const lastVisit = new Date(c.last_visit_at).getTime();
      return c.visit_count > 2 && now - lastVisit > day30;
    });
    if (decreasing.length > 0) {
      insights.push({
        type: "alert",
        title: "Clientes diminuindo frequência",
        description: `${decreasing.length} cliente${decreasing.length > 1 ? "s" : ""} que costumava${decreasing.length > 1 ? "m" : ""} visitar não ${decreasing.length > 1 ? "voltam" : "volta"} há mais de 30 dias. Considere uma campanha de reengajamento.`,
      });
    }

    // Highly engaged non-buyers
    const ordererSet = new Set(orders.map((o: any) => o.customer_id));
    const activeNonBuyers = customers.filter((c: any) => c.visit_count > 3 && !ordererSet.has(c.id));
    if (activeNonBuyers.length > 0) {
      insights.push({
        type: "info",
        title: "Clientes engajados que nunca compraram",
        description: `${activeNonBuyers.length} cliente${activeNonBuyers.length > 1 ? "s" : ""} já visitou${activeNonBuyers.length > 1 ? "ram" : ""} várias vezes mas nunca fez um pedido. Talvez precisem de um incentivo.`,
      });
    }

    // Frequent buyers
    const customerOrderCount: Record<string, number> = {};
    orders.forEach((o: any) => {
      customerOrderCount[o.customer_id] = (customerOrderCount[o.customer_id] ?? 0) + 1;
    });
    const frequentBuyers = customers.filter((c: any) => (customerOrderCount[c.id] ?? 0) >= 3);
    if (frequentBuyers.length > 0) {
      insights.push({
        type: "positive",
        title: "Clientes fiéis",
        description: `${frequentBuyers.length} cliente${frequentBuyers.length > 1 ? "s" : ""} já fez${frequentBuyers.length > 1 ? "ram" : ""} 3 ou mais pedidos. Mantenha o tratamento VIP!`,
      });
    }

    // Order completion rate
    const [completedResult] = await Promise.all([
      supabase.from("orders").select("id", { count: "exact", head: true }).eq("company_id", companyId).eq("status", "completed"),
    ]);
    const completedCount = completedResult.count ?? 0;
    const completionRate = orders.length > 0 ? (completedCount / orders.length) * 100 : 0;
    if (completionRate < 50 && orders.length > 5) {
      insights.push({
        type: "alert",
        title: "Baixa taxa de conclusão",
        description: `Apenas ${completionRate.toFixed(0)}% dos pedidos são concluídos. Verifique se há gargalos no atendimento.`,
      });
    }

    return insights;
  },
};
