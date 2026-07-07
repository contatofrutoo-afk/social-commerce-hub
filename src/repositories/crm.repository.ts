import { supabase } from "@/integrations/supabase/client";
import type { CustomerInsights, TimelineEvent, ProductInteraction } from "./types";

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
};
