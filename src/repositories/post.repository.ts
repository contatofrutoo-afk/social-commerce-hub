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
    customerAvatarUrl: row.customer?.avatar_url ?? null,
    companyLogoUrl: row.company?.logo_url ?? null,
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
    const { data, error } = await supabase.rpc("list_public_posts" as any, {
      _company_id: companyId,
      _viewer_customer_id: myCustomerId ?? null,
    });
    if (error) throw error;
    return ((data ?? []) as any[]).map((r) => ({
      id: r.id,
      companyId: r.company_id,
      authorType: r.author_type,
      customerId: r.customer_id,
      customerName: r.customer_name,
      customerAvatarUrl: r.customer_avatar_url ?? null,
      companyLogoUrl: r.company_logo_url ?? null,
      imageUrl: r.image_url,
      videoUrl: r.video_url,
      text: r.text,
      category: r.category,
      companions: r.companions,
      createdAt: r.created_at,
      products: (r.products ?? []).map(mapProduct),
      loveCount: r.love_count ?? 0,
      dislikeCount: r.dislike_count ?? 0,
      commentCount: r.comment_count ?? 0,
      myReaction: r.my_reaction ?? null,
    }));
  },

  async createBusinessPost(input: {
    companyId: string;
    text: string;
    imageUrl?: string | null;
    videoUrl?: string | null;
    productIds?: string[];
  }): Promise<Post> {
    const { data, error } = await supabase
      .from("posts")
      .insert({
        company_id: input.companyId,
        author_type: "business",
        text: input.text,
        image_url: input.imageUrl ?? null,
        video_url: input.videoUrl ?? null,
      })
      .select("*, company:company_id(*)")
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
    sessionToken: string;
    text: string;
    imageUrl?: string | null;
    category?: string;
    companions?: VisitContext;
  }): Promise<{ id: string }> {
    const { data, error } = await supabase.rpc("create_customer_post" as any, {
      _customer_id: input.customerId,
      _token: input.sessionToken,
      _company_id: input.companyId,
      _text: input.text,
      _image_url: input.imageUrl ?? null,
      _category: input.category ?? null,
      _companions: (input.companions as string | undefined) ?? null,
    });
    if (error) throw error;
    return { id: data as string };
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

  async update(
    postId: string,
    patch: { text?: string; imageUrl?: string | null; videoUrl?: string | null },
  ) {
    const { error } = await supabase
      .from("posts")
      .update({ text: patch.text, image_url: patch.imageUrl, video_url: patch.videoUrl })
      .eq("id", postId);
    if (error) throw error;
  },

  async updateCustomerPost(
    postId: string,
    customerId: string,
    token: string,
    text: string,
    imageUrl: string | null,
  ) {
    const { error } = await supabase.rpc("update_customer_post" as any, {
      _customer_id: customerId,
      _token: token,
      _post_id: postId,
      _text: text,
      _image_url: imageUrl ?? "",
    });
    if (error) throw error;
  },

  async remove(postId: string) {
    const { error } = await supabase.from("posts").delete().eq("id", postId);
    if (error) throw error;
  },

  async removeCustomerPost(postId: string, customerId: string, token: string) {
    const { error } = await supabase.rpc("delete_customer_post" as any, {
      _customer_id: customerId,
      _token: token,
      _post_id: postId,
    });
    if (error) throw error;
  },
};

export const commentRepository = {
  async listByPost(postId: string): Promise<Comment[]> {
    const { data, error } = await supabase.rpc("list_public_comments" as any, {
      _post_id: postId,
    });
    if (error) throw error;
    return ((data ?? []) as any[]).map((r) => ({
      id: r.id,
      postId: r.post_id,
      customerId: r.customer_id,
      customerName: r.customer_name ?? "Cliente",
      text: r.text,
      imageUrl: r.image_url,
      createdAt: r.created_at,
    }));
  },

  async create(input: {
    postId: string;
    customerId: string;
    sessionToken: string;
    text: string;
    imageUrl?: string | null;
  }) {
    const { data, error } = await supabase.rpc("create_customer_comment" as any, {
      _customer_id: input.customerId,
      _token: input.sessionToken,
      _post_id: input.postId,
      _text: input.text,
      _image_url: input.imageUrl ?? null,
    });
    if (error) throw error;
    return { id: data as string };
  },
};
