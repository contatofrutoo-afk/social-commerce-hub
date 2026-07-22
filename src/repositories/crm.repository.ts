import { supabase } from "@/integrations/supabase/client";
import type {
  CustomerInsights,
  TimelineEvent,
  ProductInteraction,
  CustomerServiceProfile,
  Order,
  PurchaseSummary,
  VisitHabits,
  EngagementSummary,
  InterestFunnel,
} from "./types";

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

function mode(arr: any[]): any | null {
  if (arr.length === 0) return null;
  const counts: Record<string, number> = {};
  arr.forEach((x) => {
    counts[String(x)] = (counts[String(x)] ?? 0) + 1;
  });
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}

function getDayName(iso: string): string {
  return ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"][
    new Date(iso).getDay()
  ];
}

function hoursBetween(a: string, b: string): number {
  return (new Date(b).getTime() - new Date(a).getTime()) / 3600000;
}

function daysSince(iso: string): number {
  return (Date.now() - new Date(iso).getTime()) / 86400000;
}

function computeInterestFunnel(
  cartAddEvents: any[],
  purchaseEvents: any[],
  productNames: Map<string, string>,
): InterestFunnel {
  const cartAdds = cartAddEvents.length;
  const purchases = purchaseEvents.length;

  const productsInCart = cartAddEvents
    .map((e: any) => ({ id: e.product_id, name: productNames.get(e.product_id) ?? "Produto" }))
    .filter((p, i, arr) => arr.findIndex((x) => x.id === p.id) === i);

  const productsPurchased = purchaseEvents
    .map((e: any) => ({ id: e.product_id, name: productNames.get(e.product_id) ?? "Produto" }))
    .filter((p, i, arr) => arr.findIndex((x) => x.id === p.id) === i);

  const lastCartAddAt = cartAddEvents.length > 0 ? cartAddEvents[0].created_at : null;
  const lastPurchaseAt = purchaseEvents.length > 0 ? purchaseEvents[0].created_at : null;

  let level: InterestFunnel["level"];
  let label: string;

  if (purchases > 0 && cartAdds > 0) {
    level = "quente";
    label = "Cliente quente";
  } else if (purchases > 0) {
    level = "intencao";
    label = "Intenção de compra";
  } else if (cartAdds > 0) {
    level = "interessado";
    label = "Interessado";
  } else {
    level = "nenhum";
    label = "Sem interação";
  }

  return {
    level,
    label,
    cartAdds,
    purchases,
    productsInCart,
    productsPurchased,
    lastCartAddAt,
    lastPurchaseAt,
  };
}

export const crmRepository = {
  async getCustomerInsights(customerId: string, companyId?: string): Promise<CustomerInsights> {
    const results = await Promise.allSettled([
      supabase
        .from("customers")
        .select(
          "id, company_id, name, whatsapp, avatar_url, first_visit_at, last_visit_at, visit_count, created_at",
        )
        .eq("id", customerId)
        .maybeSingle(),
      supabase
        .from("checkins")
        .select("id, context, created_at, checked_out_at, source, table_id, table:tables(label)")
        .eq("customer_id", customerId)
        .order("created_at", { ascending: false }),
      supabase
        .from("orders")
        .select(
          `id, total, status, created_at, order_items(product_id, quantity, unit_price, product:products(name, category, image_url, price))`,
        )
        .eq("customer_id", customerId)
        .order("created_at", { ascending: false }),
      supabase
        .from("post_reactions")
        .select(
          `id, type, created_at, post:posts(id, post_products(product:products(id, name, category, image_url, price)))`,
        )
        .eq("customer_id", customerId),
      supabase
        .from("product_likes")
        .select(`id, created_at, product:products(id, name, category, image_url, price)`)
        .eq("customer_id", customerId)
        .order("created_at", { ascending: false }),
      supabase
        .from("comments")
        .select("id, text, created_at, image_url")
        .eq("customer_id", customerId)
        .order("created_at", { ascending: false }),
      supabase
        .from("posts")
        .select("id, created_at")
        .eq("customer_id", customerId)
        .order("created_at", { ascending: false }),
      supabase
        .from("product_wishes")
        .select(`product_id, product:products(id, name, category, image_url, price)`)
        .eq("customer_id", customerId),
      supabase
        .from("tables")
        .select("id, label")
        .eq("company_id", companyId ?? "__none__"),
      supabase
        .from("product_events")
        .select("id, event_type, product_id, created_at")
        .eq("customer_id", customerId)
        .in("event_type", ["cart_add", "purchase"])
        .order("created_at", { ascending: false }),
    ]);

    function settle<T>(r: PromiseSettledResult<{ data: T; error: any }>, fallback: T): T {
      if (r.status === "fulfilled" && !r.value.error) return r.value.data ?? fallback;
      console.warn(
        "[crm.getCustomerInsights] query warning:",
        r.status === "rejected" ? r.reason : r.value?.error,
      );
      return fallback;
    }

    const customer = settle<Record<string, any> | null>(results[0] as any, null);
    if (!customer) throw new Error("Cliente não encontrado");

    const checkins = settle<any[]>(results[1] as any, []);
    const orders = settle<any[]>(results[2] as any, []);
    const reactionRows = settle<any[]>(results[3] as any, []);
    const likesRows = settle<any[]>(results[4] as any, []);
    const commentsRows = settle<any[]>(results[5] as any, []);
    const postsRows = settle<any[]>(results[6] as any, []);
    const wishesRows = settle<any[]>(results[7] as any, []);
    const allTables = settle<any[]>(results[8] as any, []);
    const productEvents = settle<any[]>(results[9] as any, []);

    const eventProductIds = [
      ...new Set(productEvents.map((e: any) => e.product_id).filter(Boolean)),
    ];
    let productNameMap = new Map<string, string>();
    if (eventProductIds.length > 0) {
      const { data: eventProducts } = await supabase
        .from("products")
        .select("id, name")
        .in("id", eventProductIds);
      if (eventProducts) {
        productNameMap = new Map(eventProducts.map((p: any) => [p.id, p.name]));
      }
    }

    const now = Date.now();

    // --- Timeline ---
    const timeline: TimelineEvent[] = [];

    checkins.forEach((c: any) => {
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
      const names = products
        .map((pp: any) => pp.product?.name)
        .filter(Boolean)
        .join(", ");
      timeline.push({
        id: `react-${r.id}`,
        type: r.type === "love" ? "reaction_love" : "reaction_dislike",
        createdAt: r.created_at,
        description:
          r.type === "love"
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
    postsRows.forEach((p: any) => {
      timeline.push({
        id: `post-${p.id}`,
        type: "post",
        createdAt: p.created_at,
        description: "Nova publicação",
      });
    });
    wishesRows.forEach((w: any) => {
      timeline.push({
        id: `wish-${w.product_id}`,
        type: "wish",
        createdAt: w.product?.created_at ?? "",
        description: `Desejou: ${w.product?.name ?? ""}`,
      });
    });
    timeline.sort((a, b) => (b.createdAt > a.createdAt ? 1 : -1));

    // --- Products maps ---
    const purchasedMap = new Map<string, ProductInteraction>();
    orders.forEach((o: any) => {
      (o.order_items ?? []).forEach((i: any) => {
        const pid = i.product_id;
        const existing = purchasedMap.get(pid);
        if (existing) {
          existing.count += i.quantity;
        } else {
          purchasedMap.set(pid, toProductInteraction({ ...i, product_id: pid }));
        }
      });
    });

    const loveCount = reactionRows.filter((r: any) => r.type === "love").length;
    const dislikeCount = reactionRows.filter((r: any) => r.type === "dislike").length;

    const loveMap = new Map<string, ProductInteraction>();
    const dislikeMap = new Map<string, ProductInteraction>();
    reactionRows.forEach((r: any) => {
      const products = r.post?.post_products ?? [];
      products.forEach((pp: any) => {
        if (!pp.product) return;
        const pid = pp.product.id;
        const target = r.type === "love" ? loveMap : dislikeMap;
        if (!target.has(pid))
          target.set(pid, toProductInteraction({ ...pp.product, product_id: pid, count: 1 }));
      });
    });

    const likeMap = new Map<string, ProductInteraction>();
    likesRows.forEach((l: any) => {
      if (!l.product) return;
      const pid = l.product.id;
      if (!likeMap.has(pid))
        likeMap.set(pid, toProductInteraction({ ...l.product, product_id: pid, count: 1 }));
    });

    const wishMap = new Map<string, ProductInteraction>();
    wishesRows.forEach((w: any) => {
      if (!w.product) return;
      const pid = w.product_id;
      if (!wishMap.has(pid))
        wishMap.set(pid, toProductInteraction({ ...w.product, product_id: pid, count: 1 }));
    });

    // --- Visit contexts ---
    const visitContexts: Record<string, number> = {};
    checkins.forEach((c: any) => {
      visitContexts[c.context] = (visitContexts[c.context] ?? 0) + 1;
    });

    const dominantContext =
      Object.entries(visitContexts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

    // --- Visit gaps ---
    const sortedCheckins = [...checkins].sort(
      (a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    );
    const visitGaps: number[] = [];
    for (let i = 1; i < sortedCheckins.length; i++) {
      visitGaps.push(hoursBetween(sortedCheckins[i - 1].created_at, sortedCheckins[i].created_at));
    }
    const avgTimeBetweenVisitsHours =
      visitGaps.length > 0 ? visitGaps.reduce((s, g) => s + g, 0) / visitGaps.length : null;

    // --- Checkin source ---
    const sources: string[] = checkins.map((c: any) => c.source ?? "qr");
    const mostCommonSource = mode(sources);

    // --- Most used table ---
    const tableCounts: Record<string, number> = {};
    checkins.forEach((c: any) => {
      if (c.table_id) tableCounts[c.table_id] = (tableCounts[c.table_id] ?? 0) + 1;
    });
    const topTableId = Object.entries(tableCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
    const topTable = allTables.find((t: any) => t.id === topTableId);
    const mostUsedTable = topTable ? { id: topTable.id, label: topTable.label } : null;

    // --- Habits (peak hour/day from checkins) ---
    const checkinHours: number[] = [];
    const checkinDays: string[] = [];
    checkins.forEach((c: any) => {
      checkinHours.push(new Date(c.created_at).getHours());
      checkinDays.push(getDayName(c.created_at));
    });
    const preferredHour = checkinHours.length > 0 ? Number(mode(checkinHours.map(String))) : null;
    const preferredDay = checkinDays.length > 0 ? mode(checkinDays) : null;

    // --- Checkin to order time ---
    const orderTimes = orders.map((o: any) => new Date(o.created_at).getTime());
    const checkinToOrderDiffs: number[] = [];
    sortedCheckins.forEach((c: any) => {
      const ct = new Date(c.created_at).getTime();
      const nextOrder = orderTimes.find((ot: number) => ot >= ct);
      if (nextOrder) checkinToOrderDiffs.push((nextOrder - ct) / 3600000);
    });
    const avgCheckinToOrderHours =
      checkinToOrderDiffs.length > 0
        ? checkinToOrderDiffs.reduce((s, d) => s + d, 0) / checkinToOrderDiffs.length
        : null;

    // --- Purchase summary ---
    const totalSpent = orders.reduce((s: number, o: any) => s + Number(o.total ?? 0), 0);
    const totalOrders = orders.length;
    const avgOrderValue = totalOrders > 0 ? totalSpent / totalOrders : 0;
    const biggestPurchase =
      orders.length > 0 ? Math.max(...orders.map((o: any) => Number(o.total))) : 0;
    const lastOrder = orders.length > 0 ? orders[0].created_at : null;

    // Most ordered product
    const productOrderCount: Record<string, { name: string; count: number }> = {};
    const categoryOrderCount: Record<string, number> = {};
    orders.forEach((o: any) => {
      (o.order_items ?? []).forEach((i: any) => {
        const pid = i.product_id;
        if (!productOrderCount[pid])
          productOrderCount[pid] = { name: i.product?.name ?? "Produto", count: 0 };
        productOrderCount[pid].count += i.quantity;
        const cat = i.product?.category ?? "sem categoria";
        categoryOrderCount[cat] = (categoryOrderCount[cat] ?? 0) + 1;
      });
    });
    const mostOrderedProductEntry = Object.entries(productOrderCount).sort(
      (a, b) => b[1].count - a[1].count,
    )[0];
    const mostOrderedProduct = mostOrderedProductEntry
      ? {
          id: mostOrderedProductEntry[0],
          name: mostOrderedProductEntry[1].name,
          count: mostOrderedProductEntry[1].count,
        }
      : null;
    const mostOrderedCategory =
      Object.entries(categoryOrderCount).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

    // Bought together
    const boughtTogetherMap: Record<string, Record<string, number>> = {};
    orders.forEach((o: any) => {
      const pids = (o.order_items ?? []).map((i: any) => i.product_id);
      for (const a of pids) {
        if (!boughtTogetherMap[a]) boughtTogetherMap[a] = {};
        for (const b of pids) {
          if (a !== b) boughtTogetherMap[a][b] = (boughtTogetherMap[a][b] ?? 0) + 1;
        }
      }
    });
    const boughtTogether: { id: string; name: string; count: number }[] = mostOrderedProduct
      ? Object.entries(boughtTogetherMap[mostOrderedProduct.id] ?? {})
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([id, count]) => ({ id, name: productOrderCount[id]?.name ?? "Produto", count }))
      : [];

    const favoriteCategories = Object.entries(categoryOrderCount)
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count);

    // --- Engagement ---
    const daysSinceLastVisit = checkins.length > 0 ? daysSince(checkins[0].created_at) : null;
    const photoCount = commentsRows.filter((c: any) => c.image_url).length;
    const postsCount = postsRows.length;
    const commentCount = commentsRows.length;

    const isNew = checkins.length <= 1 && totalOrders === 0;
    const isInactive = daysSinceLastVisit !== null && daysSinceLastVisit > 30;
    const isVip = totalOrders >= 5 || totalSpent > 1000;
    const isRepeatBuyer = totalOrders >= 2;
    const totalInteractions =
      loveCount + dislikeCount + commentCount + postsCount + likesRows.length;

    let engagementLevel: "muito_ativo" | "ativo" | "pouco_ativo" | "baixo_engajamento";
    if (isInactive) {
      engagementLevel = "baixo_engajamento";
    } else if (totalInteractions > 10 || (totalOrders > 0 && checkins.length > 5)) {
      engagementLevel = "muito_ativo";
    } else if (totalInteractions > 3 || checkins.length > 2) {
      engagementLevel = "ativo";
    } else {
      engagementLevel = "pouco_ativo";
    }

    const isHighlyEngaged = engagementLevel === "muito_ativo" || engagementLevel === "ativo";

    // --- Return frequency ---
    const returnFrequency: "alta" | "media" | "baixa" =
      avgTimeBetweenVisitsHours === null
        ? "baixa"
        : avgTimeBetweenVisitsHours < 168
          ? "alta"
          : avgTimeBetweenVisitsHours < 720
            ? "media"
            : "baixa";

    // --- Classification ---
    let classification: "new" | "frequent" | "vip" | "at_risk" | "inactive";
    if (checkins.length <= 1 && totalOrders === 0) {
      classification = "new";
    } else if (daysSinceLastVisit !== null && daysSinceLastVisit > 60) {
      classification = "inactive";
    } else if (daysSinceLastVisit !== null && daysSinceLastVisit >= 30) {
      classification = "at_risk";
    } else if (isVip) {
      classification = "vip";
    } else {
      classification = "frequent";
    }

    // --- Trend ---
    let trend: "increasing" | "stable" | "decreasing" | "inactive";
    if (daysSinceLastVisit !== null && daysSinceLastVisit > 60) {
      trend = "inactive";
    } else if (sortedCheckins.length < 4) {
      trend = "stable";
    } else {
      const mid = Math.floor(sortedCheckins.length / 2);
      const t0 = new Date(sortedCheckins[0].created_at).getTime();
      const t1 = new Date(sortedCheckins[mid - 1].created_at).getTime();
      const t2 = new Date(sortedCheckins[mid].created_at).getTime();
      const t3 = new Date(sortedCheckins[sortedCheckins.length - 1].created_at).getTime();
      const firstDays = (t1 - t0) / 86400000 || 1;
      const secondDays = (t3 - t2) / 86400000 || 1;
      const firstDensity = mid / firstDays;
      const secondDensity = (sortedCheckins.length - mid) / secondDays;
      if (secondDensity > firstDensity * 1.3) trend = "increasing";
      else if (secondDensity < firstDensity * 0.7) trend = "decreasing";
      else trend = "stable";
    }

    // --- Return frequency text ---
    const returnFrequencyText: string =
      avgTimeBetweenVisitsHours === null
        ? checkins.length <= 1
          ? "Primeira visita — ainda sem padrão de retorno definido."
          : "Ainda sem padrão de retorno definido — poucas visitas registradas."
        : avgTimeBetweenVisitsHours < 24
          ? `Costuma retornar aproximadamente a cada ${Math.round(avgTimeBetweenVisitsHours)} horas.`
          : `Costuma retornar aproximadamente a cada ${Math.round((avgTimeBetweenVisitsHours / 24) * 10) / 10} dias.`;

    // --- Last interaction timestamps ---
    const allTimestamps: string[] = [
      ...checkins.map((c: any) => c.created_at),
      ...orders.map((o: any) => o.created_at),
      ...reactionRows.map((r: any) => r.created_at),
      ...likesRows.map((l: any) => l.created_at),
      ...commentsRows.map((cm: any) => cm.created_at),
      ...postsRows.map((p: any) => p.created_at),
    ].filter(Boolean);
    const lastInteractionAt =
      allTimestamps.length > 0
        ? allTimestamps.sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0]
        : null;
    const lastLoveAt =
      reactionRows
        .filter((r: any) => r.type === "love")
        .map((r: any) => r.created_at)
        .sort()
        .reverse()[0] ?? null;
    const lastDislikeAt =
      reactionRows
        .filter((r: any) => r.type === "dislike")
        .map((r: any) => r.created_at)
        .sort()
        .reverse()[0] ?? null;
    const lastCommentAt = commentsRows.length > 0 ? commentsRows[0].created_at : null;
    const lastPostAt = postsRows.length > 0 ? postsRows[0].created_at : null;
    const lastLikeAt = likesRows.length > 0 ? likesRows[0].created_at : null;

    // --- Liked but not ordered ---
    const likedButNotOrdered: ProductInteraction[] = [];
    const orderedIds = new Set<string>();
    orders.forEach((o: any) =>
      (o.order_items ?? []).forEach((i: any) => orderedIds.add(i.product_id)),
    );
    const notOrderedLikes = likesRows.filter(
      (l: any) => l.product && !orderedIds.has(l.product.id),
    );
    notOrderedLikes.forEach((l: any) => {
      const pid = l.product.id;
      if (!likedButNotOrdered.some((p) => p.productId === pid)) {
        likedButNotOrdered.push(toProductInteraction({ ...l.product, product_id: pid, count: 1 }));
      }
    });

    // --- Suggestions ---
    const suggestions: string[] = [];

    if (classification === "new") {
      suggestions.push(
        "Primeira visita! Cliente acabou de conhecer o estabelecimento. Capriche no acolhimento.",
      );
    } else if (classification === "vip") {
      suggestions.push(
        `Cliente VIP com ${totalOrders} pedidos e R$ ${totalSpent.toFixed(2)} em gastos. Trate com atenção exclusiva.`,
      );
    } else if (classification === "inactive") {
      suggestions.push(
        `Cliente inativo há ${Math.round(daysSinceLastVisit!)} dias. Considere enviar uma oferta personalizada.`,
      );
    } else if (classification === "at_risk") {
      suggestions.push(
        `Cliente em risco! Última visita foi há ${Math.round(daysSinceLastVisit!)} dias. Vale um contato estratégico.`,
      );
    } else if (classification === "frequent") {
      suggestions.push(
        `Cliente frequente! Já visitou ${checkins.length}x e fez ${totalOrders} pedidos. Mantenha a qualidade.`,
      );
    }

    if (dominantContext === "casal") {
      suggestions.push(
        "Costuma vir em casal — sugira combos românticos ou pratos para compartilhar.",
      );
    } else if (dominantContext === "familia") {
      suggestions.push("Vem com a família — ofereça opções infantis e porções familiares.");
    } else if (dominantContext === "amigos") {
      suggestions.push("Vem com amigos — destaque petiscos e bebidas para compartilhar.");
    } else if (dominantContext === "sozinho") {
      suggestions.push(
        "Vem sozinho — recomende um ambiente tranquilo e atendimento personalizado.",
      );
    }

    if (mostOrderedCategory) {
      suggestions.push(
        `Preferência por ${mostOrderedCategory} — destaque novidades desta categoria.`,
      );
    }

    if (likedButNotOrdered.length > 0) {
      const names = likedButNotOrdered
        .slice(0, 3)
        .map((p) => p.name)
        .filter(Boolean)
        .join(", ");
      suggestions.push(`Ainda não pediu: ${names} — ofereça uma amostra ou desconto especial.`);
    }

    if (preferredHour !== null) {
      if (preferredHour < 12)
        suggestions.push("Costuma vir pela manhã — prepare ofertas de café da manhã.");
      else if (preferredHour < 18)
        suggestions.push("Costuma vir à tarde — destaque o menu executivo.");
      else suggestions.push("Costuma vir à noite — sugira drinks e petiscos.");
    }

    if (preferredDay && (preferredDay === "sábado" || preferredDay === "domingo")) {
      suggestions.push(
        "Costuma vir aos finais de semana — prepare experiências especiais para esses dias.",
      );
    }

    if (isHighlyEngaged && !isRepeatBuyer) {
      suggestions.push(
        "Interage muito mas ainda não comprou — talvez precise de um incentivo para converter.",
      );
    }

    if (isRepeatBuyer && checkins.length > totalOrders * 2) {
      suggestions.push(
        "Visita mais do que compra — talvez precise de um lembrete sobre o cardápio.",
      );
    }

    // --- Executive summary ---
    const summaryParts: string[] = [];

    if (classification === "new") {
      summaryParts.push("Cliente novo que acabou de conhecer o estabelecimento.");
    } else if (classification === "vip") {
      summaryParts.push(`Cliente VIP com ${totalOrders} pedidos realizados.`);
    } else if (classification === "inactive") {
      summaryParts.push(`Cliente inativo há ${Math.round(daysSinceLastVisit!)} dias.`);
    } else if (classification === "at_risk") {
      summaryParts.push(
        `Cliente que não visita há ${Math.round(daysSinceLastVisit!)} dias — precisa de atenção.`,
      );
    } else {
      summaryParts.push(
        `Cliente frequente com ${checkins.length} visitas e ${totalOrders} pedidos.`,
      );
    }

    if (dominantContext) {
      const ctxLabels: Record<string, string> = {
        sozinho: "sozinho(a)",
        casal: "em casal",
        amigos: "com amigos",
        familia: "em família",
      };
      summaryParts.push(`Costuma visitar ${ctxLabels[dominantContext] ?? dominantContext}.`);
    }

    if (avgTimeBetweenVisitsHours !== null) {
      const days = avgTimeBetweenVisitsHours / 24;
      if (days < 30) {
        summaryParts.push(
          days < 1
            ? `Retorna a cada ${Math.round(avgTimeBetweenVisitsHours)} horas.`
            : `Retorna a cada ${Math.round(days)} dias.`,
        );
      }
    }

    if (isRepeatBuyer) {
      if (mostOrderedCategory) summaryParts.push(`Preferência por ${mostOrderedCategory}.`);
      if (mostOrderedProduct) summaryParts.push(`Produto favorito: ${mostOrderedProduct.name}.`);
    }

    const engLabels: Record<string, string> = {
      muito_ativo: "Alto engajamento com a plataforma.",
      ativo: "Engajamento moderado com a plataforma.",
      pouco_ativo: "Baixo engajamento com a plataforma.",
      baixo_engajamento: "Quase sem interação com a plataforma.",
    };
    summaryParts.push(engLabels[engagementLevel] ?? "");

    // --- Interest funnel ---
    const cartAddEvents = productEvents.filter((e: any) => e.event_type === "cart_add");
    const purchaseEvents = productEvents.filter((e: any) => e.event_type === "purchase");
    const interestFunnel = computeInterestFunnel(cartAddEvents, purchaseEvents, productNameMap);

    return {
      // Original fields (kept for reference)
      totalVisits: checkins.length,
      firstVisit: sortedCheckins.length > 0 ? sortedCheckins[0].created_at : null,
      lastVisit: checkins.length > 0 ? checkins[0].created_at : null,
      totalOrders,
      totalSpent,
      avgOrderValue,
      lastOrder,
      purchasedProducts: Array.from(purchasedMap.values()),
      lovedProducts: Array.from(loveMap.values()),
      dislikedProducts: Array.from(dislikeMap.values()),
      likedProducts: Array.from(likeMap.values()),
      lastComment: commentsRows.length > 0 ? commentsRows[0].created_at : null,
      visitContexts: Object.entries(visitContexts).map(([context, count]) => ({ context, count })),
      timeline,

      // New fields
      name: customer.name,
      whatsapp: customer.whatsapp,
      avatarUrl: customer.avatar_url,
      gender: customer.gender ?? null,
      ageRange: customer.age_range ?? null,
      customerSince: customer.created_at,

      dislikeCount,
      loveCount,
      postsCount,
      photoCount,
      commentCount,
      wishedProducts: Array.from(wishMap.values()),
      favoriteCategories,

      habits: {
        preferredHour,
        preferredDay,
        avgTimeBetweenVisitsHours,
        avgCheckinToOrderHours,
        mostUsedTable,
        mostCommonSource,
        daysSinceLastVisit,
        returnFrequency,
        returnFrequencyText,
      },

      purchases: {
        totalOrders,
        totalSpent,
        avgOrderValue,
        biggestPurchase,
        lastOrder,
        mostOrderedProduct,
        mostOrderedCategory,
        boughtTogether,
      },

      engagement: {
        level: engagementLevel,
        isHighlyEngaged,
        isRepeatBuyer,
        isVip,
        isInactive,
        isNew,
      },

      dominantContext,
      suggestions,
      executiveSummary: summaryParts.join(" "),
      classification,
      trend,
      lastInteractionAt,
      lastLoveAt,
      lastDislikeAt,
      lastCommentAt,
      lastPostAt,
      lastLikeAt,
      likedButNotOrdered,
      interestFunnel,
    };
  },

  async getCustomerServiceProfile(customerId: string): Promise<CustomerServiceProfile> {
    const [customerResult, checkinsResult, ordersResult, likesResult, wishesResult, eventsResult] =
      await Promise.all([
        supabase
          .from("customers")
          .select(
            "id, company_id, name, whatsapp, avatar_url, first_visit_at, last_visit_at, visit_count, created_at",
          )
          .eq("id", customerId)
          .single(),
        supabase
          .from("checkins")
          .select("id, context, created_at, checked_out_at, source, table_id, table:tables(label)")
          .eq("customer_id", customerId)
          .order("created_at", { ascending: false }),
        supabase
          .from("orders")
          .select(`*, table:tables(label), order_items(*, product:products(name, category))`)
          .eq("customer_id", customerId)
          .order("created_at", { ascending: false }),
        supabase
          .from("product_likes")
          .select("product_id, created_at, product:products(name, category, image_url, price)")
          .eq("customer_id", customerId)
          .order("created_at", { ascending: false }),
        supabase
          .from("product_wishes")
          .select("product_id, product:products(name, category, image_url, price)")
          .eq("customer_id", customerId),
        supabase
          .from("product_events")
          .select("id, event_type, product_id, created_at")
          .eq("customer_id", customerId)
          .in("event_type", ["cart_add", "purchase"])
          .order("created_at", { ascending: false }),
      ]);

    if (customerResult.error) throw customerResult.error;
    if (checkinsResult.error) throw checkinsResult.error;
    if (ordersResult.error) throw ordersResult.error;
    if (likesResult.error) throw likesResult.error;
    if (wishesResult.error) throw wishesResult.error;

    const customer = customerResult.data;
    if (!customer) throw new Error("Cliente não encontrado");

    const checkins = checkinsResult.data ?? [];
    const orders = ordersResult.data ?? [];
    const likes = likesResult.data ?? [];
    const wishes = wishesResult.data ?? [];
    const productEvents = eventsResult.data ?? [];

    const eventProductIds = [
      ...new Set(productEvents.map((e: any) => e.product_id).filter(Boolean)),
    ];
    let productNameMap = new Map<string, string>();
    if (eventProductIds.length > 0) {
      const { data: eventProducts } = await supabase
        .from("products")
        .select("id, name")
        .in("id", eventProductIds);
      if (eventProducts) {
        productNameMap = new Map(eventProducts.map((p: any) => [p.id, p.name]));
      }
    }

    const sortedCheckins = [...checkins].sort(
      (a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    );

    // --- Counts & spends ---
    const totalSpend = orders.reduce((s: number, o: any) => s + Number(o.total ?? 0), 0);
    const totalOrders = orders.length;
    const avgOrderValue = totalOrders > 0 ? totalSpend / totalOrders : 0;
    const lastOrder = orders.length > 0 ? orders[0].created_at : null;
    const lastOrderValue = orders.length > 0 ? Number(orders[0].total) : 0;

    // --- Favorite products & categories ---
    const productCount: Record<string, { name: string; count: number }> = {};
    const categoryCount: Record<string, number> = {};
    orders.forEach((o: any) => {
      (o.order_items ?? []).forEach((i: any) => {
        const pid = i.product_id;
        if (!productCount[pid])
          productCount[pid] = { name: i.product?.name ?? "Produto", count: 0 };
        productCount[pid].count += i.quantity;
        const cat = i.product?.category;
        if (cat) categoryCount[cat] = (categoryCount[cat] ?? 0) + 1;
      });
    });

    const favoriteProducts = Object.entries(productCount)
      .map(([id, v]) => ({ id, name: v.name, count: v.count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const favoriteCategories = Object.entries(categoryCount)
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count)
      .filter((fc) => fc.category !== "sem categoria");

    const mostOrderedProductEntry = Object.entries(productCount).sort(
      (a, b) => b[1].count - a[1].count,
    )[0];
    const mostOrderedProduct = mostOrderedProductEntry
      ? {
          id: mostOrderedProductEntry[0],
          name: mostOrderedProductEntry[1].name,
          count: mostOrderedProductEntry[1].count,
        }
      : null;
    const mostOrderedCategory = favoriteCategories[0]?.category ?? null;

    const recentOrders = orders.slice(0, 3).map(mapOrder);

    // --- Visit context ---
    const visitContexts: Record<string, number> = {};
    checkins.forEach((c: any) => {
      visitContexts[c.context] = (visitContexts[c.context] ?? 0) + 1;
    });
    const dominantContext =
      Object.entries(visitContexts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

    // --- Classification ---
    const daysSinceLastVisit =
      checkins.length > 0
        ? (Date.now() - new Date(checkins[0].created_at).getTime()) / 86400000
        : null;
    const isNew = checkins.length <= 1 && totalOrders === 0;
    const isVip = totalOrders >= 5 || totalSpend > 1000;
    const isRepeatBuyer = totalOrders >= 2;
    const isInactive = daysSinceLastVisit !== null && daysSinceLastVisit > 60;

    let classification: "new" | "frequent" | "vip" | "at_risk" | "inactive";
    if (isNew) classification = "new";
    else if (isInactive) classification = "inactive";
    else if (daysSinceLastVisit !== null && daysSinceLastVisit >= 30) classification = "at_risk";
    else if (isVip) classification = "vip";
    else classification = "frequent";

    // --- Recently liked products (last 30 days) ---
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();
    const recentlyLikedProducts = likes
      .filter((l: any) => l.created_at >= thirtyDaysAgo && l.product)
      .map((l: any) => ({ id: l.product_id, name: l.product.name ?? "" }));

    // --- Liked but not ordered ---
    const orderedIds = new Set<string>();
    orders.forEach((o: any) =>
      (o.order_items ?? []).forEach((i: any) => orderedIds.add(i.product_id)),
    );
    const likedButNotOrdered = likes
      .filter((l: any) => l.product && !orderedIds.has(l.product_id))
      .map((l: any) => ({ id: l.product_id, name: l.product.name ?? "" }));

    // --- Avg spend ---
    const avgSpend = totalOrders > 0 ? totalSpend / totalOrders : 0;

    // --- Opportunities ---
    const opportunities: string[] = [];

    if (mostOrderedCategory) {
      opportunities.push(`Costuma consumir ${mostOrderedCategory}.`);
    }
    const hasCombos = orders.some((o: any) =>
      (o.order_items ?? []).some((i: any) => {
        const n = i.product?.name?.toLowerCase() ?? "";
        return n.includes("combo") || n.includes("kit");
      }),
    );
    if (hasCombos) opportunities.push("Costuma comprar combos.");
    const hasDrinks = Object.keys(categoryCount).some((c) =>
      ["bebida", "drink", "refrigerante", "suco", "água"].some((k) => c.toLowerCase().includes(k)),
    );
    if (hasDrinks) opportunities.push("Costuma pedir bebidas.");
    const hasDessert = Object.keys(categoryCount).some((c) =>
      ["sobremesa", "doce", "sorvete", "torta"].some((k) => c.toLowerCase().includes(k)),
    );
    if (hasDessert) opportunities.push("Costuma comprar sobremesa.");
    if (avgOrderValue > 100) opportunities.push("Costuma consumir produtos premium.");
    if (dominantContext === "amigos" || dominantContext === "familia") {
      opportunities.push("Costuma compartilhar pratos.");
    }
    if (likedButNotOrdered.length > 0) {
      const names = likedButNotOrdered
        .slice(0, 3)
        .map((l) => l.name)
        .filter(Boolean)
        .join(", ");
      opportunities.push(`Ainda não experimentou: ${names}.`);
    }

    // --- Weaze suggestions ---
    const weazeSuggestions: string[] = [];

    if (isNew) {
      weazeSuggestions.push(
        "Cliente está conhecendo o estabelecimento agora. Seja acolhedor e explique o cardápio.",
      );
    } else {
      weazeSuggestions.push(
        "Cliente já conhece o estabelecimento. Apresente novidades e promoções.",
      );
    }

    const latestContext = checkins[0]?.context;
    if (latestContext === "familia") {
      weazeSuggestions.push(
        "Está acompanhado da família. Ofereça pratos para compartilhar e opções infantis.",
      );
    } else if (latestContext === "casal") {
      weazeSuggestions.push(
        "Está em casal. Sugira combos românticos ou pratos especiais para dois.",
      );
    } else if (latestContext === "amigos") {
      weazeSuggestions.push(
        "Está com amigos. Destaque petiscos, porções e bebidas para compartilhar.",
      );
    } else if (latestContext === "sozinho") {
      weazeSuggestions.push(
        "Está sozinho. Recomende um atendimento personalizado e um ambiente tranquilo.",
      );
    }

    if (likedButNotOrdered.length > 0) {
      const names = likedButNotOrdered
        .slice(0, 2)
        .map((l) => l.name)
        .filter(Boolean)
        .join(" ou ");
      weazeSuggestions.push(
        `Cliente demonstrou interesse em ${names}. Pergunte se deseja experimentar hoje.`,
      );
    }
    if (mostOrderedCategory) {
      weazeSuggestions.push(
        `Cliente costuma pedir ${mostOrderedCategory}. Ofereça novidades desta categoria.`,
      );
    }
    if (hasCombos || avgOrderValue > 80) {
      weazeSuggestions.push("Alta probabilidade de aceitar um combo ou upgrade.");
    }
    if (recentlyLikedProducts.length > 0) {
      const names = recentlyLikedProducts
        .slice(0, 2)
        .map((l) => l.name)
        .filter(Boolean)
        .join(" e ");
      weazeSuggestions.push(`Cliente curtiu recentemente ${names}. Aproveite o interesse!`);
    }

    // --- Legacy suggestions (kept for backward compatibility) ---
    const suggestions: string[] = [];

    if (isNew) {
      suggestions.push("Primeira visita — dê boas-vindas caprichadas.");
    } else if (isVip) {
      suggestions.push("Cliente VIP — trate com atenção especial.");
    } else if (isRepeatBuyer) {
      suggestions.push("Cliente fiel — reconheça a preferência.");
    }

    if (latestContext === "casal")
      suggestions.push("Geralmente está em casal — sugira combos românticos.");
    else if (latestContext === "familia")
      suggestions.push("Vem com a família — ofereça opções infantis.");
    else if (latestContext === "amigos") suggestions.push("Vem com amigos — destaque petiscos.");

    if (mostOrderedCategory)
      suggestions.push(`Preferência por ${mostOrderedCategory} — destaque novidades.`);

    if (likedButNotOrdered.length > 0) {
      const names = likedButNotOrdered
        .slice(0, 3)
        .map((l) => l.name)
        .filter(Boolean)
        .join(", ");
      suggestions.push(`Ainda não pediu: ${names} — ofereça uma amostra.`);
    }

    // --- Interest funnel ---
    const cartAddEvents = productEvents.filter((e: any) => e.event_type === "cart_add");
    const purchaseEvents = productEvents.filter((e: any) => e.event_type === "purchase");
    const interestFunnel = computeInterestFunnel(cartAddEvents, purchaseEvents, productNameMap);

    return {
      id: customer.id,
      name: customer.name,
      whatsapp: customer.whatsapp,
      avatarUrl: customer.avatar_url,
      customerSince: customer.created_at,
      totalVisits: checkins.length,
      firstVisit: sortedCheckins.length > 0 ? sortedCheckins[0].created_at : null,
      lastVisit: checkins.length > 0 ? checkins[0].created_at : null,
      currentContext: checkins[0]?.context ?? null,
      recentOrders,
      favoriteProducts,
      likedProducts: likes.map((l: any) => ({ id: l.product_id, name: l.product?.name ?? "" })),
      wishedProducts: wishes.map((w: any) => ({ id: w.product_id, name: w.product?.name ?? "" })),
      favoriteCategories,
      avgSpend,
      suggestions,
      classification,
      totalOrders,
      lastOrder,
      lastOrderValue,
      avgOrderValue,
      mostOrderedProduct,
      mostOrderedCategory,
      recentlyLikedProducts,
      likedButNotOrdered,
      opportunities,
      weazeSuggestions,
      interestFunnel,
    };
  },
};
