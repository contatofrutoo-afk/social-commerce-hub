import { supabase } from "@/integrations/supabase/client";
import type { CustomerInsights, TimelineEvent, ProductInteraction, CustomerServiceProfile, Order } from "./types";

function mapOrder(r: any): Order {
  return {
    id: r.id,
    companyId: r.company_id ?? r.companyId,
    customerId: r.customer_id ?? r.customerId,
    customerName: r.customer?.name,
    tableId: r.table_id ?? null,
    tableLabel: r.table?.label ?? null,
    status: r.status,
    total: Number(r.total),
    note: r.note,
    createdAt: r.created_at,
    items: (r.order_items ?? []).map((i: any) => ({
      id: i.id,
      orderId: i.order_id,
      productId: i.product_id,
      productName: i.product?.name ?? "",
      quantity: i.quantity,
      note: i.note,
      unitPrice: Number(i.unit_price),
    })),
  };
}

function toProductInteraction(r: any): ProductInteraction {
  return {
    productId: r.product_id ?? r.id,
    name: r.products?.name ?? r.name ?? "",
    category: r.products?.category ?? r.category ?? null,
    imageUrl: r.products?.image_url ?? r.image_url ?? null,
    price: Number(r.products?.price ?? r.price ?? 0),
    count: r.count ?? r.quantity ?? 1,
  };
}

export const crmRepository = {
  async getCustomerInsights(customerId: string): Promise<CustomerInsights> {
    const [
      checkins,
      ordersData,
      reactions,
      likes,
      comments,
    ] = await Promise.all([
      supabase
        .from("checkins")
        .select("id, context, created_at")
        .eq("customer_id", customerId)
        .order("created_at", { ascending: false }),
      supabase
        .from("orders")
        .select(`id, total, created_at, order_items(product_id, quantity, product:products(name, category, image_url, price))`)
        .eq("customer_id", customerId)
        .order("created_at", { ascending: false }),
      supabase
        .from("post_reactions")
        .select(`id, type, created_at, post:posts(id, post_products(product:products(id, name, category, image_url, price)))`)
        .eq("customer_id", customerId)
        .order("created_at", { ascending: false }),
      supabase
        .from("product_likes")
        .select(`id, created_at, product:products(id, name, category, image_url, price)`)
        .eq("customer_id", customerId)
        .order("created_at", { ascending: false }),
      supabase
        .from("comments")
        .select("id, text, created_at")
        .eq("customer_id", customerId)
        .order("created_at", { ascending: false }),
    ]);

    if (checkins.error) throw checkins.error;
    if (ordersData.error) throw ordersData.error;
    if (reactions.error) throw reactions.error;
    if (likes.error) throw likes.error;
    if (comments.error) throw comments.error;

    const rows = checkins.data ?? [];
    const orders = ordersData.data ?? [];
    const reactionRows = reactions.data ?? [];
    const likesRows = likes.data ?? [];
    const commentsRows = comments.data ?? [];

    const timeline: TimelineEvent[] = [];

    rows.forEach((c: any) => {
      timeline.push({
        id: `ck-${c.id}`,
        type: "checkin",
        createdAt: c.created_at,
        description: `Check-in: ${c.context}`,
        metadata: { context: c.context },
      });
    });

    orders.forEach((o: any) => {
      const items = (o.order_items ?? []).map((i: any) => i.product?.name ?? "Produto").join(", ");
      timeline.push({
        id: `ord-${o.id}`,
        type: "order",
        createdAt: o.created_at,
        description: `Pedido: ${items}`,
        metadata: { total: Number(o.total), orderId: o.id },
      });
    });

    reactionRows.forEach((r: any) => {
      const products = r.post?.post_products ?? [];
      const names = products.map((pp: any) => pp.product?.name).filter(Boolean).join(", ");
      timeline.push({
        id: `react-${r.id}`,
        type: r.type === "love" ? "reaction_love" : "reaction_dislike",
        createdAt: r.created_at,
        description: r.type === "love"
          ? `Amei publicação${names ? ` (${names})` : ""}`
          : `Não gostei${names ? ` (${names})` : ""}`,
      });
    });

    likesRows.forEach((l: any) => {
      timeline.push({
        id: `lk-${l.id}`,
        type: "like",
        createdAt: l.created_at,
        description: `Curtiu produto: ${l.product?.name ?? ""}`,
      });
    });

    commentsRows.forEach((cm: any) => {
      timeline.push({
        id: `cm-${cm.id}`,
        type: "comment",
        createdAt: cm.created_at,
        description: cm.text ? `Comentou: ${cm.text.substring(0, 80)}` : "Comentou",
      });
    });

    timeline.sort((a, b) => (b.createdAt > a.createdAt ? 1 : -1));

    const totalOrders = orders.length;
    const totalSpent = orders.reduce((s: number, o: any) => s + Number(o.total ?? 0), 0);

    const purchasedMap = new Map<string, ProductInteraction>();
    orders.forEach((o: any) => {
      (o.order_items ?? []).forEach((i: any) => {
        const pid = i.product_id;
        const existing = purchasedMap.get(pid);
        const prod = toProductInteraction({ ...i, product_id: pid });
        if (existing) {
          existing.count += i.quantity;
        } else {
          purchasedMap.set(pid, prod);
        }
      });
    });

    const loveMap = new Map<string, ProductInteraction>();
    const dislikeMap = new Map<string, ProductInteraction>();
    reactionRows.forEach((r: any) => {
      const products = r.post?.post_products ?? [];
      products.forEach((pp: any) => {
        if (!pp.product) return;
        const pid = pp.product.id;
        const target = r.type === "love" ? loveMap : dislikeMap;
        if (!target.has(pid)) {
          target.set(pid, toProductInteraction({ ...pp.product, product_id: pid, count: 1 }));
        }
      });
    });

    const likeMap = new Map<string, ProductInteraction>();
    likesRows.forEach((l: any) => {
      if (!l.product) return;
      const pid = l.product.id;
      if (!likeMap.has(pid)) {
        likeMap.set(pid, toProductInteraction({ ...l.product, product_id: pid, count: 1 }));
      }
    });

    const visitContexts: Record<string, number> = {};
    rows.forEach((c: any) => {
      visitContexts[c.context] = (visitContexts[c.context] ?? 0) + 1;
    });

    return {
      totalVisits: rows.length,
      firstVisit: rows.length > 0 ? rows[rows.length - 1].created_at : null,
      lastVisit: rows.length > 0 ? rows[0].created_at : null,
      totalOrders,
      totalSpent,
      avgOrderValue: totalOrders > 0 ? totalSpent / totalOrders : 0,
      lastOrder: orders.length > 0 ? orders[0].created_at : null,
      purchasedProducts: Array.from(purchasedMap.values()),
      lovedProducts: Array.from(loveMap.values()),
      dislikedProducts: Array.from(dislikeMap.values()),
      likedProducts: Array.from(likeMap.values()),
      commentCount: commentsRows.length,
      lastComment: commentsRows.length > 0 ? commentsRows[0].created_at : null,
      visitContexts: Object.entries(visitContexts).map(([context, count]) => ({ context, count })),
      timeline,
    };
  },

  async getCustomerServiceProfile(customerId: string): Promise<CustomerServiceProfile> {
    const [customerResult, checkinsResult, ordersResult, likesResult, wishesResult, commentsResult] = await Promise.all([
      supabase.from("customers").select("*").eq("id", customerId).single(),
      supabase.from("checkins").select("id, context, created_at").eq("customer_id", customerId).order("created_at", { ascending: false }),
      supabase.from("orders").select(`*, table:tables(label), order_items(*, product:products(name))`).eq("customer_id", customerId).order("created_at", { ascending: false }),
      supabase.from("product_likes").select("product_id, product:products(name)").eq("customer_id", customerId),
      supabase.from("product_wishes").select("product_id, product:products(name)").eq("customer_id", customerId),
      supabase.from("comments").select("id, text, created_at").eq("customer_id", customerId).order("created_at", { ascending: false }),
    ]);

    if (customerResult.error) throw customerResult.error;
    if (checkinsResult.error) throw checkinsResult.error;
    if (ordersResult.error) throw ordersResult.error;
    if (likesResult.error) throw likesResult.error;
    if (wishesResult.error) throw wishesResult.error;
    if (commentsResult.error) throw commentsResult.error;

    const customer = customerResult.data;
    if (!customer) throw new Error("Cliente não encontrado");

    const checkins = checkinsResult.data ?? [];
    const orders = ordersResult.data ?? [];
    const likes = likesResult.data ?? [];
    const wishes = wishesResult.data ?? [];
    const comments = commentsResult.data ?? [];

    const now = Date.now();

    // Favorite products (most ordered)
    const productCount: Record<string, { name: string; count: number }> = {};
    const categoryCount: Record<string, number> = {};
    const orderHours: number[] = [];
    const orderDays: string[] = [];
    const visitGaps: number[] = [];
    let totalSpend = 0;

    orders.forEach((o: any) => {
      totalSpend += Number(o.total);
      const h = new Date(o.created_at).getHours();
      orderHours.push(h);
      const days = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
      orderDays.push(days[new Date(o.created_at).getDay()]);
      (o.order_items ?? []).forEach((i: any) => {
        if (!productCount[i.product_id]) productCount[i.product_id] = { name: i.product?.name ?? "Produto", count: 0 };
        productCount[i.product_id].count += i.quantity;
        const cat = i.product?.category ?? "sem categoria";
        categoryCount[cat] = (categoryCount[cat] ?? 0) + 1;
      });
    });

    // Time between visits
    const sortedCheckins = [...checkins].sort((a: any, b: any) =>
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
    for (let i = 1; i < sortedCheckins.length; i++) {
      const diff = (new Date(sortedCheckins[i].created_at).getTime() - new Date(sortedCheckins[i - 1].created_at).getTime()) / 3600000;
      visitGaps.push(diff);
    }
    const avgGap = visitGaps.length > 0 ? visitGaps.reduce((s, g) => s + g, 0) / visitGaps.length : null;

    const avgSpend = orders.length > 0 ? totalSpend / orders.length : 0;

    // Peak hour/day
    const peakHour = orderHours.length > 0
      ? Number(Object.entries(orderHours.reduce((acc: Record<number, number>, h: number) => {
          acc[h] = (acc[h] ?? 0) + 1; return acc;
        }, {})).sort((a, b) => b[1] - a[1])[0]?.[0]) : null;

    const peakDay = orderDays.length > 0
      ? Object.entries(orderDays.reduce((acc: Record<string, number>, d: string) => {
          acc[d] = (acc[d] ?? 0) + 1; return acc;
        }, {})).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null : null;

    const recentOrders = orders.slice(0, 5).map(mapOrder);

    // Suggestions
    const suggestions: string[] = [];

    if (checkins.length <= 1) {
      suggestions.push("Primeira visita — dê boas-vindas caprichadas e ofereça um tour pelo espaço.");
    } else if (checkins.length < 5) {
      suggestions.push("Cliente recorrente — pergunte como foi a experiência anterior e ofereça algo novo.");
    } else {
      suggestions.push("Cliente fiel — trate como VIP, reconheça a preferência.");
    }

    // Category-based suggestion
    const topCat = Object.entries(categoryCount).sort((a, b) => b[1] - a[1])[0];
    if (topCat) {
      suggestions.push(`Costuma consumir ${topCat[0]} — destaque novidades desta categoria.`);
    }

    // Context-based
    const latestContext = checkins[0]?.context;
    if (latestContext === "casal") {
      suggestions.push("Geralmente está em casal — sugira combos românticos ou pratos para dividir.");
    } else if (latestContext === "familia") {
      suggestions.push("Vem com a família — ofereça opções infantis ou porções familiares.");
    } else if (latestContext === "amigos") {
      suggestions.push("Vem com amigos — destaque petiscos e bebidas para compartilhar.");
    }

    // Liked but not ordered
    const likedNames = likes.map((l: any) => l.product?.name).filter(Boolean);
    const orderedIds = new Set<string>();
    orders.forEach((o: any) => (o.order_items ?? []).forEach((i: any) => orderedIds.add(i.product_id)));
    const notOrderedLikes = likes.filter((l: any) => !orderedIds.has(l.product_id));
    if (notOrderedLikes.length > 0) {
      const names = notOrderedLikes.slice(0, 3).map((l: any) => l.product?.name).filter(Boolean).join(", ");
      suggestions.push(`Ainda não pediu: ${names} — ofereça uma amostra.`);
    }

    // Preferred time
    if (peakHour !== null) {
      if (peakHour < 12) suggestions.push("Costuma vir pela manhã — prepare ofertas de café da manhã.");
      else if (peakHour < 18) suggestions.push("Costuma vir à tarde — destaque o menu do dia.");
      else suggestions.push("Costuma vir à noite — sugira drinks e jantar.");
    }

    const favoriteProducts = Object.entries(productCount)
      .map(([id, v]) => ({ id, name: v.name, count: v.count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const favoriteCategories = Object.entries(categoryCount)
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count);

    return {
      id: customer.id,
      name: customer.name,
      avatarUrl: customer.avatar_url,
      customerSince: customer.created_at,
      visitCount: customer.visit_count,
      currentContext: checkins[0]?.context ?? null,
      recentOrders,
      favoriteProducts,
      likedProducts: likes.map((l: any) => ({ id: l.product_id, name: l.product?.name ?? "" })),
      wishedProducts: wishes.map((w: any) => ({ id: w.product_id, name: w.product?.name ?? "" })),
      favoriteCategories,
      preferredHour: peakHour,
      preferredDay: peakDay,
      avgTimeBetweenVisitsHours: avgGap,
      avgSpend,
      suggestions,
    };
  },
};
