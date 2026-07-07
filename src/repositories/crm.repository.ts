import { supabase } from "@/integrations/supabase/client";
import type { CustomerInsights, TimelineEvent, ProductInteraction, CustomerServiceProfile, Order, PurchaseSummary, VisitHabits, EngagementSummary } from "./types";

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
  arr.forEach((x) => { counts[String(x)] = (counts[String(x)] ?? 0) + 1; });
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}

function getDayName(iso: string): string {
  return ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"][new Date(iso).getDay()];
}

function hoursBetween(a: string, b: string): number {
  return (new Date(b).getTime() - new Date(a).getTime()) / 3600000;
}

function daysSince(iso: string): number {
  return (Date.now() - new Date(iso).getTime()) / 86400000;
}

export const crmRepository = {
  async getCustomerInsights(customerId: string, companyId?: string): Promise<CustomerInsights> {
    const results = await Promise.allSettled([
      supabase.from("customers").select("*").eq("id", customerId).maybeSingle(),
      supabase.from("checkins").select("id, context, created_at, source, table_id").eq("customer_id", customerId).order("created_at", { ascending: false }),
      supabase.from("orders").select(`id, total, status, created_at, order_items(product_id, quantity, unit_price, product:products(name, category, image_url, price))`).eq("customer_id", customerId).order("created_at", { ascending: false }),
      supabase.from("post_reactions").select(`id, type, created_at, post:posts(id, post_products(product:products(id, name, category, image_url, price)))`).eq("customer_id", customerId),
      supabase.from("product_likes").select(`id, created_at, product:products(id, name, category, image_url, price)`).eq("customer_id", customerId).order("created_at", { ascending: false }),
      supabase.from("comments").select("id, text, created_at, image_url").eq("customer_id", customerId).order("created_at", { ascending: false }),
      supabase.from("posts").select("id, created_at").eq("customer_id", customerId).order("created_at", { ascending: false }),
      supabase.from("product_wishes").select(`product_id, product:products(id, name, category, image_url, price)`).eq("customer_id", customerId),
      supabase.from("tables").select("id, label").eq("company_id", companyId ?? "__none__"),
    ]);

    function settle<T>(r: PromiseSettledResult<{ data: T; error: any }>, fallback: T): T {
      if (r.status === "fulfilled" && !r.value.error) return r.value.data ?? fallback;
      console.warn("[crm.getCustomerInsights] query warning:", r.status === "rejected" ? r.reason : r.value?.error);
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

    const now = Date.now();

    // --- Timeline ---
    const timeline: TimelineEvent[] = [];

    checkins.forEach((c: any) => {
      timeline.push({ id: `ck-${c.id}`, type: "checkin", createdAt: c.created_at, description: `Check-in: ${c.context}`, metadata: { context: c.context } });
    });
    orders.forEach((o: any) => {
      const items = (o.order_items ?? []).map((i: any) => i.product?.name ?? "Produto").join(", ");
      timeline.push({ id: `ord-${o.id}`, type: "order", createdAt: o.created_at, description: `Pedido: ${items}`, metadata: { total: Number(o.total), orderId: o.id } });
    });
    reactionRows.forEach((r: any) => {
      const products = r.post?.post_products ?? [];
      const names = products.map((pp: any) => pp.product?.name).filter(Boolean).join(", ");
      timeline.push({
        id: `react-${r.id}`, type: r.type === "love" ? "reaction_love" : "reaction_dislike",
        createdAt: r.created_at,
        description: r.type === "love" ? `Amei publicação${names ? ` (${names})` : ""}` : `Não gostei${names ? ` (${names})` : ""}`,
      });
    });
    likesRows.forEach((l: any) => {
      timeline.push({ id: `lk-${l.id}`, type: "like", createdAt: l.created_at, description: `Curtiu produto: ${l.product?.name ?? ""}` });
    });
    commentsRows.forEach((cm: any) => {
      timeline.push({ id: `cm-${cm.id}`, type: "comment", createdAt: cm.created_at, description: cm.text ? `Comentou: ${cm.text.substring(0, 80)}` : "Comentou" });
    });
    postsRows.forEach((p: any) => {
      timeline.push({ id: `post-${p.id}`, type: "post", createdAt: p.created_at, description: "Nova publicação" });
    });
    wishesRows.forEach((w: any) => {
      timeline.push({ id: `wish-${w.product_id}`, type: "wish", createdAt: w.product?.created_at ?? "", description: `Desejou: ${w.product?.name ?? ""}` });
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
        if (!target.has(pid)) target.set(pid, toProductInteraction({ ...pp.product, product_id: pid, count: 1 }));
      });
    });

    const likeMap = new Map<string, ProductInteraction>();
    likesRows.forEach((l: any) => {
      if (!l.product) return;
      const pid = l.product.id;
      if (!likeMap.has(pid)) likeMap.set(pid, toProductInteraction({ ...l.product, product_id: pid, count: 1 }));
    });

    const wishMap = new Map<string, ProductInteraction>();
    wishesRows.forEach((w: any) => {
      if (!w.product) return;
      const pid = w.product_id;
      if (!wishMap.has(pid)) wishMap.set(pid, toProductInteraction({ ...w.product, product_id: pid, count: 1 }));
    });

    // --- Visit contexts ---
    const visitContexts: Record<string, number> = {};
    checkins.forEach((c: any) => { visitContexts[c.context] = (visitContexts[c.context] ?? 0) + 1; });

    const dominantContext = Object.entries(visitContexts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

    // --- Visit gaps ---
    const sortedCheckins = [...checkins].sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    const visitGaps: number[] = [];
    for (let i = 1; i < sortedCheckins.length; i++) {
      visitGaps.push(hoursBetween(sortedCheckins[i - 1].created_at, sortedCheckins[i].created_at));
    }
    const avgTimeBetweenVisitsHours = visitGaps.length > 0 ? visitGaps.reduce((s, g) => s + g, 0) / visitGaps.length : null;

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
    const avgCheckinToOrderHours = checkinToOrderDiffs.length > 0 ? checkinToOrderDiffs.reduce((s, d) => s + d, 0) / checkinToOrderDiffs.length : null;

    // --- Purchase summary ---
    const totalSpent = orders.reduce((s: number, o: any) => s + Number(o.total ?? 0), 0);
    const totalOrders = orders.length;
    const avgOrderValue = totalOrders > 0 ? totalSpent / totalOrders : 0;
    const biggestPurchase = orders.length > 0 ? Math.max(...orders.map((o: any) => Number(o.total))) : 0;
    const lastOrder = orders.length > 0 ? orders[0].created_at : null;

    // Most ordered product
    const productOrderCount: Record<string, { name: string; count: number }> = {};
    const categoryOrderCount: Record<string, number> = {};
    orders.forEach((o: any) => {
      (o.order_items ?? []).forEach((i: any) => {
        const pid = i.product_id;
        if (!productOrderCount[pid]) productOrderCount[pid] = { name: i.product?.name ?? "Produto", count: 0 };
        productOrderCount[pid].count += i.quantity;
        const cat = i.product?.category ?? "sem categoria";
        categoryOrderCount[cat] = (categoryOrderCount[cat] ?? 0) + 1;
      });
    });
    const mostOrderedProductEntry = Object.entries(productOrderCount).sort((a, b) => b[1].count - a[1].count)[0];
    const mostOrderedProduct = mostOrderedProductEntry ? { id: mostOrderedProductEntry[0], name: mostOrderedProductEntry[1].name, count: mostOrderedProductEntry[1].count } : null;
    const mostOrderedCategory = Object.entries(categoryOrderCount).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

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
    const totalInteractions = loveCount + dislikeCount + commentCount + postsCount + likesRows.length;

    let engagementLevel: "muito_ativo" | "moderado" | "pouco_ativo" | "risco_abandono";
    if (isInactive) {
      engagementLevel = "risco_abandono";
    } else if (totalInteractions > 10 || (totalOrders > 0 && checkins.length > 5)) {
      engagementLevel = "muito_ativo";
    } else if (totalInteractions > 3 || checkins.length > 2) {
      engagementLevel = "moderado";
    } else {
      engagementLevel = "pouco_ativo";
    }

    const isHighlyEngaged = engagementLevel === "muito_ativo" || engagementLevel === "moderado";

    // --- Return frequency ---
    const returnFrequency: "alta" | "media" | "baixa" = avgTimeBetweenVisitsHours === null ? "baixa"
      : avgTimeBetweenVisitsHours < 168 ? "alta"
      : avgTimeBetweenVisitsHours < 720 ? "media"
      : "baixa";

    // --- Suggestions ---
    const suggestions: string[] = [];

    if (isNew) suggestions.push("Primeira visita — dê boas-vindas caprichadas.");
    else if (isVip) suggestions.push("Cliente VIP — trate com atenção especial.");
    else if (isRepeatBuyer) suggestions.push("Cliente fiel — reconheça a preferência.");

    if (dominantContext === "casal") suggestions.push("Costuma vir em casal — sugira combos românticos.");
    else if (dominantContext === "familia") suggestions.push("Vem com a família — ofereça opções infantis.");
    else if (dominantContext === "amigos") suggestions.push("Vem com amigos — destaque petiscos.");
    else if (dominantContext === "sozinho") suggestions.push("Vem sozinho — recomende o conforto do balcão.");

    if (mostOrderedCategory) suggestions.push(`Preferência por ${mostOrderedCategory} — destaque novidades.`);

    // Liked but not ordered
    const orderedIds = new Set<string>();
    orders.forEach((o: any) => (o.order_items ?? []).forEach((i: any) => orderedIds.add(i.product_id)));
    const notOrderedLikes = likesRows.filter((l: any) => l.product && !orderedIds.has(l.product.id));
    if (notOrderedLikes.length > 0) {
      const names = notOrderedLikes.slice(0, 3).map((l: any) => l.product?.name).filter(Boolean).join(", ");
      suggestions.push(`Ainda não pediu: ${names} — ofereça uma amostra.`);
    }

    if (preferredHour !== null) {
      if (preferredHour < 12) suggestions.push("Costuma vir pela manhã — prepare ofertas de café.");
      else if (preferredHour < 18) suggestions.push("Costuma vir à tarde — destaque o menu do dia.");
      else suggestions.push("Costuma vir à noite — sugira drinks.");
    }

    if (preferredDay) {
      const dayNames: Record<string, string> = { domingo: "domingo", segunda: "segunda", terça: "terça", quarta: "quarta", quinta: "quinta", sexta: "sexta", sábado: "sábado" };
      const dayLabel = dayNames[preferredDay] ?? preferredDay;
      if (preferredDay === "sábado" || preferredDay === "domingo") {
        suggestions.push(`Costuma voltar aos ${dayLabel} — prepare ofertas de fim de semana.`);
      }
    }

    if (isHighlyEngaged && !isRepeatBuyer) {
      suggestions.push("Interage muito mas ainda não comprou — precisa de incentivo.");
    }

    if (isRepeatBuyer && checkins.length > totalOrders * 2) {
      suggestions.push("Visita mais do que compra — talvez precise de um lembrete.");
    }

    // --- Executive summary ---
    const summaryParts: string[] = [];

    if (isNew) summaryParts.push("Cliente novo.");
    else if (isVip) summaryParts.push("Cliente VIP.");
    else if (isRepeatBuyer) summaryParts.push("Cliente recorrente.");
    else summaryParts.push(`${checkins.length} visita${checkins.length > 1 ? "s" : ""}.`);

    if (dominantContext) {
      const ctxLabels: Record<string, string> = { sozinho: "sozinho", casal: "em casal", amigos: "com amigos", familia: "em família" };
      summaryParts.push(`Costuma visitar ${ctxLabels[dominantContext] ?? dominantContext}.`);
    }

    if (preferredDay) {
      if (preferredDay === "sábado" || preferredDay === "domingo") {
        summaryParts.push("Geralmente vem aos finais de semana.");
      } else {
        summaryParts.push(`Costuma vir às ${preferredDay === "sexta" ? "sextas" : `${preferredDay}-feiras`}.`);
      }
    }

    if (mostOrderedCategory) {
      summaryParts.push(`Preferência por ${mostOrderedCategory}.`);
    }

    if (isHighlyEngaged) {
      summaryParts.push("Alta interação com a plataforma.");
    }

    if (isRepeatBuyer) {
      summaryParts.push(`${totalOrders} pedido${totalOrders > 1 ? "s" : ""} realizados.`);
    } else if (totalInteractions > 0) {
      summaryParts.push("Ainda não comprou.");
    }

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
