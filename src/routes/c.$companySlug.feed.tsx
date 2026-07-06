import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import {
  companyRepository,
  postRepository,
  commentRepository,
  productRepository,
} from "@/repositories";
import type { Post, ReactionType } from "@/repositories/types";
import { getSessionForCompany } from "@/lib/session";
import { useCart } from "@/hooks/use-cart";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Heart, ThumbsDown, MessageCircle, Plus, Store, User as UserIcon } from "lucide-react";
import { formatBRL, relativeTime } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/c/$companySlug/feed")({
  component: FeedPage,
});

function FeedPage() {
  const { companySlug } = Route.useParams();
  const navigate = useNavigate();
  const session = typeof window !== "undefined" ? getSessionForCompany(companySlug) : null;

  const { data: company } = useQuery({
    queryKey: ["company", companySlug],
    queryFn: () => companyRepository.findBySlug(companySlug),
  });

  const { data: posts, isLoading } = useQuery({
    queryKey: ["feed", company?.id, session?.customerId],
    queryFn: () => postRepository.listByCompany(company!.id, session?.customerId),
    enabled: !!company,
  });

  useEffect(() => {
    if (typeof window !== "undefined" && !session) {
      navigate({ to: "/c/$companySlug", params: { companySlug } });
    }
  }, [session, companySlug, navigate]);

  if (!session) return null;

  return (
    <div className="divide-y">
      {isLoading && <div className="p-8 text-center text-muted-foreground">Carregando feed…</div>}
      {posts?.length === 0 && (
        <div className="p-12 text-center">
          <p className="text-muted-foreground">Ainda não há publicações. Seja o primeiro!</p>
          <Button asChild className="mt-4">
            <Link to="/c/$companySlug/publicar" params={{ companySlug }}>
              Publicar experiência
            </Link>
          </Button>
        </div>
      )}
      {posts?.map((p) => (
        <PostCard key={p.id} post={p} customerId={session.customerId} companyId={company!.id} />
      ))}
    </div>
  );
}

function PostCard({
  post,
  customerId,
  companyId,
}: {
  post: Post;
  customerId: string;
  companyId: string;
}) {
  const qc = useQueryClient();
  const [showComments, setShowComments] = useState(false);
  const cart = useCart(companyId);

  const react = useMutation({
    mutationFn: (t: ReactionType) =>
      postRepository.setReaction(post.id, customerId, post.myReaction === t ? null : t),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["feed"] }),
  });

  return (
    <article className="bg-card">
      <header className="flex items-center gap-3 px-4 py-3">
        <div className="grid size-9 place-items-center rounded-full bg-accent text-accent-foreground">
          {post.authorType === "business" ? (
            <Store className="size-4" />
          ) : (
            <UserIcon className="size-4" />
          )}
        </div>
        <div className="flex-1">
          <div className="text-sm font-semibold">
            {post.authorType === "business" ? "Estabelecimento" : (post.customerName ?? "Cliente")}
          </div>
          <div className="text-xs text-muted-foreground">{relativeTime(post.createdAt)}</div>
        </div>
        {post.companions && (
          <span className="rounded-full bg-accent px-2 py-0.5 text-xs text-accent-foreground">
            {post.companions}
          </span>
        )}
      </header>

      {post.imageUrl && (
        <img src={post.imageUrl} alt="" className="w-full max-h-[520px] object-cover" />
      )}

      {post.text && <p className="px-4 py-3 text-sm">{post.text}</p>}

      {post.products.length > 0 && (
        <div className="space-y-2 px-4 pb-3">
          {post.products.map((prod) => (
            <div
              key={prod.id}
              className="flex items-center gap-3 rounded-xl border p-3"
            >
              {prod.imageUrl && (
                <img src={prod.imageUrl} alt="" className="size-14 rounded-lg object-cover" />
              )}
              <div className="flex-1">
                <div className="text-sm font-medium">{prod.name}</div>
                <div className="text-xs text-muted-foreground">{formatBRL(prod.price)}</div>
              </div>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  cart.add(prod);
                  toast.success("Adicionado à sacola");
                }}
              >
                <Plus className="size-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center gap-1 border-t px-2 py-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => react.mutate("love")}
          className={post.myReaction === "love" ? "text-primary" : ""}
        >
          <Heart className={`size-4 ${post.myReaction === "love" ? "fill-current" : ""}`} />
          <span className="ml-1 text-xs">{post.loveCount}</span>
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => react.mutate("dislike")}
          className={post.myReaction === "dislike" ? "text-destructive" : ""}
        >
          <ThumbsDown className="size-4" />
          <span className="ml-1 text-xs">{post.dislikeCount}</span>
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setShowComments((s) => !s)}>
          <MessageCircle className="size-4" />
          <span className="ml-1 text-xs">{post.commentCount}</span>
        </Button>
      </div>

      {showComments && <CommentsSection postId={post.id} customerId={customerId} />}
    </article>
  );
}

function CommentsSection({ postId, customerId }: { postId: string; customerId: string }) {
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const { data: comments } = useQuery({
    queryKey: ["comments", postId],
    queryFn: () => commentRepository.listByPost(postId),
  });
  const add = useMutation({
    mutationFn: () => commentRepository.create({ postId, customerId, text: text.trim() }),
    onSuccess: () => {
      setText("");
      qc.invalidateQueries({ queryKey: ["comments", postId] });
      qc.invalidateQueries({ queryKey: ["feed"] });
    },
  });

  return (
    <div className="space-y-2 border-t bg-muted/30 px-4 py-3">
      {comments?.map((c) => (
        <div key={c.id} className="text-sm">
          <span className="font-medium">{c.customerName}: </span>
          {c.text}
        </div>
      ))}
      <div className="flex gap-2">
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Escreva um comentário…"
          maxLength={300}
        />
        <Button size="sm" onClick={() => add.mutate()} disabled={!text.trim() || add.isPending}>
          Enviar
        </Button>
      </div>
    </div>
  );
}
