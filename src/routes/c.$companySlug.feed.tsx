import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { companyRepository, postRepository, commentRepository } from "@/repositories";
import type { Post, ReactionType } from "@/repositories/types";
import { getSessionForCompany } from "@/lib/session";
import { useCart } from "@/hooks/use-cart";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ImageUpload } from "@/components/image-upload";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Heart,
  ThumbsDown,
  MessageCircle,
  ShoppingBag,
  Store,
  User as UserIcon,
  MoreVertical,
  Pencil,
  Trash2,
  Send,
} from "lucide-react";
import { formatBRL, relativeTime } from "@/lib/format";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";

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
    staleTime: 30_000,
  });

  const {
    data: posts,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ["feed", company?.id, session?.customerId],
    queryFn: () => postRepository.listByCompany(company!.id, session?.customerId),
    enabled: !!company,
    staleTime: 15_000,
  });

  const cart = useCart(company?.id);

  useEffect(() => {
    if (!session) {
      navigate({ to: "/c/$companySlug", params: { companySlug } });
    }
  }, [session, companySlug, navigate]);

  if (!session) {
    return null;
  }

  if (isLoading) {
    return (
      <div className="space-y-4 p-4">
        <SkeletonPostCard />
        <SkeletonPostCard />
        <SkeletonPostCard />
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4 pb-8">
      {isError && (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6 text-center text-sm text-destructive">
          Erro ao carregar feed: {(error as Error)?.message ?? "Erro desconhecido"}
        </div>
      )}
      {posts?.length === 0 && (
        <div className="post-card p-10 text-center">
          <div className="mx-auto grid size-14 place-items-center rounded-2xl kpi-accent">
            <Store className="size-6" />
          </div>
          <p className="mt-4 font-display text-lg font-semibold">Ainda não há publicações</p>
          <p className="mt-1 text-sm text-muted-foreground">Seja o primeiro a compartilhar uma experiência.</p>
          <Button asChild className="mt-5 rounded-full">
            <Link to="/c/$companySlug/publicar" params={{ companySlug }}>
              Publicar experiência
            </Link>
          </Button>
        </div>
      )}
      {posts?.map((p) => (
        <PostCard
          key={p.id}
          post={p}
          customerId={session.customerId}
          sessionToken={session.sessionToken}
          companyId={session.companyId}
          cart={cart}
        />
      ))}
    </div>
  );
}

function SkeletonPostCard() {
  return (
    <article className="post-card">
      <header className="flex items-center gap-3 px-4 py-3">
        <Skeleton className="size-10 rounded-full" />
        <div className="flex-1 space-y-1.5">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-20" />
        </div>
      </header>
      <Skeleton className="h-72 w-full" />
      <div className="px-4 py-3">
        <Skeleton className="h-4 w-full" />
      </div>
      <div className="flex items-center gap-2 border-t px-4 py-3">
        <Skeleton className="h-8 w-16 rounded-full" />
        <Skeleton className="h-8 w-16 rounded-full" />
        <Skeleton className="h-8 w-20 rounded-full" />
      </div>
    </article>
  );
}

function PostCard({
  post,
  customerId,
  sessionToken,
  companyId,
  cart,
}: {
  post: Post;
  customerId: string;
  sessionToken: string;
  companyId: string;
  cart: ReturnType<typeof useCart>;
}) {
  const qc = useQueryClient();
  const [showComments, setShowComments] = useState(false);
  const [editingPost, setEditingPost] = useState(false);
  const [editText, setEditText] = useState(post.text ?? "");
  const [editImageUrl, setEditImageUrl] = useState<string | null>(post.imageUrl);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const isAuthor = post.authorType === "customer" && post.customerId === customerId;
  const isCompanyMember = post.companyId === companyId;

  const canEdit = isAuthor;
  const canDelete = isAuthor || (post.authorType === "customer" && isCompanyMember);

  const showMenu = canEdit || canDelete;

  const react = useMutation({
    mutationFn: (t: ReactionType) =>
      postRepository.setReaction(
        post.id,
        customerId,
        sessionToken,
        post.myReaction === t ? null : t,
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["feed"] }),
    onError: (err) => toast.error(`Erro ao reagir: ${(err as Error).message}`),
  });

  const editMutation = useMutation({
    mutationFn: () =>
      postRepository.updateCustomerPost(
        post.id,
        customerId,
        sessionToken,
        editText.trim(),
        editImageUrl,
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["feed"] });
      setEditingPost(false);
      toast.success("Publicação atualizada");
    },
    onError: (err) => toast.error(`Erro ao editar: ${(err as Error).message}`),
  });

  const deleteMutation = useMutation({
    mutationFn: () => postRepository.removeCustomerPost(post.id, customerId, sessionToken),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["feed"] });
      setConfirmDelete(false);
      toast.success("Publicação removida");
    },
    onError: (err) => toast.error(`Erro ao excluir: ${(err as Error).message}`),
  });

  return (
    <article className="post-card">
      <header className="flex items-center gap-3 px-4 pt-4 pb-3">
        <Avatar className="size-10 ring-2 ring-primary/10">
          {post.authorType === "business" && post.companyLogoUrl ? (
            <AvatarImage src={post.companyLogoUrl} alt={post.customerName ?? ""} />
          ) : post.authorType === "customer" && post.customerAvatarUrl ? (
            <AvatarImage src={post.customerAvatarUrl} alt={post.customerName ?? ""} />
          ) : null}
          <AvatarFallback className="bg-accent text-accent-foreground">
            {post.authorType === "business" ? (
              <Store className="size-4" />
            ) : (
              <UserIcon className="size-4" />
            )}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-sm font-semibold">
              {post.authorType === "business" ? "Estabelecimento" : (post.customerName ?? "Cliente")}
            </span>
            {post.authorType === "business" && (
              <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                Oficial
              </span>
            )}
          </div>
          <div className="text-xs text-muted-foreground">{relativeTime(post.createdAt)}</div>
        </div>
        {post.companions && (
          <span className="rounded-full bg-accent px-2.5 py-1 text-[11px] font-medium text-accent-foreground capitalize">
            {post.companions}
          </span>
        )}
        {showMenu && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="size-8 shrink-0 rounded-full">
                <MoreVertical className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {canEdit && (
                <DropdownMenuItem
                  onClick={() => {
                    setEditText(post.text ?? "");
                    setEditImageUrl(post.imageUrl);
                    setEditingPost(true);
                  }}
                >
                  <Pencil className="size-4" /> Editar
                </DropdownMenuItem>
              )}
              {canDelete && (
                <DropdownMenuItem
                  onClick={() => setConfirmDelete(true)}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="size-4" /> Excluir
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </header>

      {post.text && <p className="px-4 pb-3 text-[15px] leading-relaxed">{post.text}</p>}

      {post.videoUrl ? (
        <div className="aspect-[9/16] w-full bg-muted">
          <video src={post.videoUrl} className="size-full object-cover" controls playsInline />
        </div>
      ) : post.imageUrl ? (
        <img src={post.imageUrl} alt="" className="w-full max-h-[560px] object-cover" />
      ) : null}

      {post.authorType === "business" && post.products.length > 0 && (
        <div className="space-y-2 px-4 pt-3">
          {post.products.map((prod) => (
            <div key={prod.id} className="flex items-center gap-3 rounded-2xl border bg-muted/30 p-2.5 transition-colors hover:bg-muted/60">
              {prod.imageUrl && (
                <img src={prod.imageUrl} alt="" className="size-14 rounded-xl object-cover" />
              )}
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold">{prod.name}</div>
                <div className="text-xs font-medium text-primary">{formatBRL(prod.price)}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-2 flex items-center gap-1 px-2 py-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => react.mutate("love")}
          className={`rounded-full ${post.myReaction === "love" ? "bg-primary/10 text-primary" : ""}`}
        >
          <Heart className={`size-4 ${post.myReaction === "love" ? "fill-current" : ""}`} />
          <span className="ml-1 text-xs font-medium">{post.loveCount}</span>
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => react.mutate("dislike")}
          className={`rounded-full ${post.myReaction === "dislike" ? "bg-destructive/10 text-destructive" : ""}`}
        >
          <ThumbsDown className="size-4" />
          <span className="ml-1 text-xs font-medium">{post.dislikeCount}</span>
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setShowComments((s) => !s)} className="rounded-full">
          <MessageCircle className="size-4" />
          <span className="ml-1 text-xs font-medium">{post.commentCount}</span>
        </Button>
        {post.authorType === "business" && (
          <div className="ml-auto">
            <Button
              variant="ghost"
              size="sm"
              className={`rounded-full ${post.products.length === 0 ? "opacity-50" : "bg-primary/8 text-primary hover:bg-primary/15"}`}
              onClick={() => {
                try {
                  if (post.products.length === 0) {
                    toast.info("Nenhum produto vinculado a esta publicação");
                    return;
                  }
                  post.products.forEach((prod) => cart.add(prod));
                  toast.success(
                    post.products.length === 1
                      ? "Adicionado à sacola"
                      : `${post.products.length} itens adicionados à sacola`,
                  );
                } catch (err) {
                  toast.error(`Erro ao adicionar: ${(err as Error).message}`);
                }
              }}
              title={
                post.products.length === 0
                  ? "Sem produto marcado nesta publicação"
                  : "Adicionar à sacola"
              }
            >
              <ShoppingBag className="size-4" />
              <span className="ml-1 text-xs font-medium">Adicionar</span>
            </Button>
          </div>
        )}
      </div>


      {showComments && (
        <CommentsSection postId={post.id} customerId={customerId} sessionToken={sessionToken} />
      )}

      {/* Edit Dialog */}
      <Dialog open={editingPost} onOpenChange={setEditingPost}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Editar publicação</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Textarea
              placeholder="Texto"
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              maxLength={500}
            />
            <ImageUpload
              value={editImageUrl}
              onChange={setEditImageUrl}
              folder={`edit/${customerId}/${post.id}`}
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setEditingPost(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => editMutation.mutate()}
              disabled={editMutation.isPending || (!editText.trim() && !editImageUrl)}
            >
              Salvar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir publicação?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. A publicação será removida permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteMutation.mutate()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </article>
  );
}

function CommentsSection({
  postId,
  customerId,
  sessionToken,
}: {
  postId: string;
  customerId: string;
  sessionToken: string;
}) {
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const [commentImage, setCommentImage] = useState<string | null>(null);
  const { data: comments } = useQuery({
    queryKey: ["comments", postId],
    queryFn: () => commentRepository.listByPost(postId),
  });
  const add = useMutation({
    mutationFn: () =>
      commentRepository.create({
        postId,
        customerId,
        sessionToken,
        text: text.trim(),
        imageUrl: commentImage,
      }),
    onSuccess: () => {
      setText("");
      setCommentImage(null);
      qc.invalidateQueries({ queryKey: ["comments", postId] });
      qc.invalidateQueries({ queryKey: ["feed"] });
    },
    onError: (err) => toast.error(`Erro ao comentar: ${(err as Error).message}`),
  });

  return (
    <div className="space-y-2 border-t bg-muted/30 px-4 py-3">
      {comments?.map((c) => (
        <div key={c.id} className="text-sm">
          <span className="font-medium">{c.customerName}: </span>
          {c.text}
          {c.imageUrl && (
            <img src={c.imageUrl} alt="" className="mt-1 max-h-40 rounded-lg object-cover" />
          )}
        </div>
      ))}
      <div className="flex gap-2">
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Escreva um comentário…"
          maxLength={300}
        />
        <Button
          size="sm"
          onClick={() => add.mutate()}
          disabled={(!text.trim() && !commentImage) || add.isPending}
        >
          <Send className="size-4" />
        </Button>
      </div>
      <div>
        <ImageUpload
          value={commentImage}
          onChange={setCommentImage}
          folder={`comments/${customerId}/${postId}`}
        />
      </div>
    </div>
  );
}
