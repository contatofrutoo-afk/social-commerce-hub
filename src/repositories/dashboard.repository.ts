import { supabase } from "@/integrations/supabase/client";

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
};
