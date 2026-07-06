import { supabase } from "@/integrations/supabase/client";
import type { Comment, Post, PostAuthorType, ReactionType, VisitContext } from "./types";

function mapProduct(r: any) {
  return {
    id: r.id,
    companyId: r.company_id,
    name: r.name,
    category: r.category,
    price: Number(r.price),
    imageUrl: r.image_url,
    available: r.available,
    description: r.description,
  };
}

function mapPost(row: any, myCustomerId?: string | null): Post {
  const reactions = row.post_reactions ?? [];
  const loveCount = reactions.filter((r: any) => r.type === "love").length;
  const dislikeCount = reactions.filter((r: any) => r.type === "dislike").length;
  const myReaction = myCustomerId
    ? (reactions.find((r: any) => r.customer_id === myCustomerId)?.type ?? null)
    : null;
  return {
    id: row.id,
    companyId: row.company_id,
    authorType: row.author_type as PostAuthorType,
    customerId: row.customer_id,
    customerName: row.customer?.name ?? null,
    imageUrl: row.image_url,
    videoUrl: row.video_url,
    text: row.text,
    category: row.category,
    companions: row.companions as VisitContext | null,
    createdAt: row.created_at,
    products: (row.post_products ?? []).map((pp: any) => mapProduct(pp.product)),
    loveCount,
    dislikeCount,
    commentCount: row.comments?.[0]?.count ?? 0,
    myReaction,
  };
}

export const postRepository = {
  async listByCompany(companyId: string, myCustomerId?: string | null): Promise<Post[]> {
    const { data, error } = await supabase
      .from("posts")
      .select(
        `*,
         customer:customers!posts_customer_id_fkey(name),
         post_reactions(customer_id, type),
         post_products(product:products(*)),
         comments(count)`,
      )
      .eq("company_id", companyId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw error;
    return (data ?? []).map((r) => mapPost(r, myCustomerId));
  },

  async createBusinessPost(input: {
    companyId: string;
    text: string;
    imageUrl?: string | null;
    productIds?: string[];
  }): Promise<Post> {
    const { data, error } = await supabase
      .from("posts")
      .insert({
        company_id: input.companyId,
        author_type: "business",
        text: input.text,
        image_url: input.imageUrl ?? null,
      })
      .select()
      .single();
    if (error) throw error;

    if (input.productIds && input.productIds.length) {
      const rows = input.productIds.map((pid) => ({ post_id: data.id, product_id: pid }));
      const { error: e2 } = await supabase.from("post_products").insert(rows);
      if (e2) throw e2;
    }
    return mapPost({ ...data, post_reactions: [], post_products: [], comments: [{ count: 0 }] });
  },

  async createCustomerPost(input: {
    companyId: string;
    customerId: string;
    text: string;
    imageUrl?: string | null;
    category?: string;
    companions?: VisitContext;
  }): Promise<Post> {
    const { data, error } = await supabase
      .from("posts")
      .insert({
        company_id: input.companyId,
        author_type: "customer",
        customer_id: input.customerId,
        text: input.text,
        image_url: input.imageUrl ?? null,
        category: input.category ?? null,
        companions: input.companions ?? null,
      })
      .select()
      .single();
    if (error) throw error;
    return mapPost({ ...data, post_reactions: [], post_products: [], comments: [{ count: 0 }] });
  },

  async setReaction(postId: string, customerId: string, token: string, type: ReactionType | null) {
    const { error } = await supabase.rpc("set_post_reaction", {
      _customer_id: customerId,
      _token: token,
      _post_id: postId,
      _type: (type ?? null) as string,
    });
    if (error) throw error;
  },

  async remove(postId: string) {
    const { error } = await supabase.from("posts").delete().eq("id", postId);
    if (error) throw error;
  },
};

export const commentRepository = {
  async listByPost(postId: string): Promise<Comment[]> {
    const { data, error } = await supabase
      .from("comments")
      .select("*, customer:customers!comments_customer_id_fkey(name)")
      .eq("post_id", postId)
      .order("created_at", { ascending: true });
    if (error) throw error;
    return (data ?? []).map((r) => ({
      id: r.id,
      postId: r.post_id,
      customerId: r.customer_id,
      customerName: r.customer?.name ?? "Cliente",
      text: r.text,
      imageUrl: r.image_url,
      createdAt: r.created_at,
    }));
  },

  async create(input: { postId: string; customerId: string; text: string; imageUrl?: string | null }) {
    const { data, error } = await supabase
      .from("comments")
      .insert({
        post_id: input.postId,
        customer_id: input.customerId,
        text: input.text,
        image_url: input.imageUrl ?? null,
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  },
};
