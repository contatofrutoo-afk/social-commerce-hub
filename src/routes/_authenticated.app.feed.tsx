import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { postRepository, productRepository, dashboardRepository } from "@/repositories";
import type { PostMetric } from "@/repositories/types";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { relativeTime, formatBRL } from "@/lib/format";
import { ImageUpload } from "@/components/image-upload";
import { VideoUpload } from "@/components/video-upload";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { optimizedImageUrl } from "@/lib/image-url";
import {
  Trash2,
  Heart,
  MessageCircle,
  ThumbsDown,
  BarChart3,
  Clock,
  Calendar,
  Store,
  User as UserIcon,
  Play,
  MoreVertical,
  Pencil,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/feed")({
  component: FeedAdminPage,
  head: () => ({ meta: [{ title: "Feed — WEAZE" }] }),
});

function FeedAdminPage() {
  const qc = useQueryClient();
  const { data: companyId } = useQuery({
    queryKey: ["my-company-id"],
    queryFn: async () => {
      const { data } = await supabase
        .from("user_roles")
        .select("company_id")
        .limit(1)
        .maybeSingle();
      return data?.company_id as string | undefined;
    },
  });

  const [text, setText] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>("");
  const [videoUrl, setVideoUrl] = useState<string | null>("");
  const [mediaType, setMediaType] = useState<"image" | "video">("image");
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [selectedPost, setSelectedPost] = useState<any | null>(null);

  const { data: products } = useQuery({
    queryKey: ["products", companyId],
    queryFn: () => productRepository.listByCompany(companyId!),
    enabled: !!companyId,
  });
  const { data: posts } = useQuery({
    queryKey: ["feed-b2b", companyId],
    queryFn: () => postRepository.listByCompany(companyId!),
    enabled: !!companyId,
  });
  const { data: postMetrics } = useQuery({
    queryKey: ["post-metrics", companyId],
    queryFn: () => dashboardRepository.getPostMetrics(companyId!),
    enabled: !!companyId,
  });

  const metricById = new Map((postMetrics ?? []).map((m: PostMetric) => [m.id, m]));

  const publish = useMutation({
    mutationFn: () =>
      postRepository.createBusinessPost({
        companyId: companyId!,
        text,
        imageUrl: mediaType === "image" ? imageUrl || null : null,
        videoUrl: mediaType === "video" ? videoUrl || null : null,
        productIds: selectedProducts,
      }),
    onSuccess: () => {
      setText("");
      setImageUrl("");
      setVideoUrl("");
      setMediaType("image");
      setSelectedProducts([]);
      qc.invalidateQueries({ queryKey: ["feed-b2b"] });
      toast.success("Publicado");
    },
    onError: (err) => {
      toast.error(`Erro ao publicar: ${(err as Error).message}`);
    },
  });
  const remove = useMutation({
    mutationFn: (id: string) => postRepository.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["feed-b2b"] });
      setSelectedPost(null);
      toast.success("Publicação removida");
    },
    onError: (err) => toast.error(`Erro ao excluir: ${(err as Error).message}`),
  });

  const editPost = useMutation({
    mutationFn: ({
      id,
      text,
      imageUrl,
      videoUrl,
    }: {
      id: string;
      text: string;
      imageUrl: string | null;
      videoUrl: string | null;
    }) => postRepository.update(id, { text, imageUrl, videoUrl }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["feed-b2b"] });
      setEditingPost(null);
      toast.success("Publicação atualizada");
    },
    onError: (err) => toast.error(`Erro ao editar: ${(err as Error).message}`),
  });

  const [editingPost, setEditingPost] = useState<any | null>(null);
  const [editText, setEditText] = useState("");
  const [editImageUrl, setEditImageUrl] = useState<string | null>(null);
  const [editVideoUrl, setEditVideoUrl] = useState<string | null>(null);
  const [editMediaType, setEditMediaType] = useState<"image" | "video">("image");
  const [confirmDelete, setConfirmDelete] = useState<any | null>(null);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Publicações</h1>

      <div className="space-y-3 rounded-xl border bg-card p-4">
        <h2 className="font-semibold">Nova publicação</h2>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setMediaType("image")}
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              mediaType === "image" ? "bg-primary text-primary-foreground" : "bg-muted"
            }`}
          >
            Imagem
          </button>
          <button
            type="button"
            onClick={() => setMediaType("video")}
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              mediaType === "video" ? "bg-primary text-primary-foreground" : "bg-muted"
            }`}
          >
            Vídeo 9:16
          </button>
        </div>
        {mediaType === "image" ? (
          <ImageUpload value={imageUrl} onChange={setImageUrl} folder={`${companyId}/feed`} />
        ) : (
          <VideoUpload value={videoUrl} onChange={setVideoUrl} folder={`${companyId}/feed`} />
        )}
        <Textarea
          placeholder="Texto"
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={500}
        />
        <div>
          <div className="mb-2 text-sm font-medium">Marcar produtos</div>
          <div className="flex flex-wrap gap-2">
            {products?.map((p) => {
              const active = selectedProducts.includes(p.id);
              return (
                <button
                  key={p.id}
                  onClick={() =>
                    setSelectedProducts((s) =>
                      active ? s.filter((x) => x !== p.id) : [...s, p.id],
                    )
                  }
                  className={`rounded-full border px-3 py-1 text-xs ${
                    active ? "border-primary bg-accent" : ""
                  }`}
                >
                  {p.name}
                </button>
              );
            })}
          </div>
        </div>
        <Button
          onClick={() => publish.mutate()}
          disabled={publish.isPending || (!text && !imageUrl && !videoUrl)}
        >
          Publicar
        </Button>
      </div>

      {/* Grid estilo Instagram */}
      <div>
        <h2 className="mb-3 font-semibold">Publicações</h2>
        {(!posts || posts.length === 0) && (
          <p className="text-sm text-muted-foreground">Nenhuma publicação ainda.</p>
        )}
        <div className="grid grid-cols-3 gap-1">
          {posts?.map((p) => {
            const m = metricById.get(p.id) ?? null;
            return (
              <button
                key={p.id}
                onClick={() => setSelectedPost({ post: p, metric: m })}
                className="group relative aspect-square overflow-hidden bg-muted"
              >
                {p.videoUrl ? (
                  <div className="relative size-full">
                    <video src={p.videoUrl} className="size-full object-cover" muted playsInline />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="flex size-12 items-center justify-center rounded-full bg-black/60">
                        <Play className="size-6 fill-white text-white" />
                      </div>
                    </div>
                  </div>
                ) : p.imageUrl ? (
                  <img src={p.imageUrl} alt="" className="size-full object-cover" />
                ) : (
                  <div className="flex size-full items-center justify-center p-2 text-center text-xs text-muted-foreground">
                    {p.text}
                  </div>
                )}
                <div className="absolute inset-0 flex items-center justify-center gap-4 bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
                  <span className="flex items-center gap-1 text-sm font-bold text-white">
                    <Heart className="size-4 fill-white" /> {p.loveCount}
                  </span>
                  <span className="flex items-center gap-1 text-sm font-bold text-white">
                    <MessageCircle className="size-4 fill-white" /> {p.commentCount}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Dialog de detalhes */}
      <Dialog open={!!selectedPost} onOpenChange={(o) => !o && setSelectedPost(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          {selectedPost && (
            <PostDetail
              post={selectedPost.post}
              metric={selectedPost.metric}
              onEdit={() => {
                setEditText(selectedPost.post.text ?? "");
                setEditImageUrl(selectedPost.post.imageUrl);
                setEditVideoUrl(selectedPost.post.videoUrl);
                setEditMediaType(selectedPost.post.videoUrl ? "video" : "image");
                setEditingPost(selectedPost.post);
                setSelectedPost(null);
              }}
              onDelete={() => setConfirmDelete(selectedPost.post)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editingPost} onOpenChange={(o) => !o && setEditingPost(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar publicação</DialogTitle>
          </DialogHeader>
          {editingPost && (
            <div className="space-y-3">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setEditMediaType("image")}
                  className={`rounded-full px-3 py-1 text-xs font-medium ${
                    editMediaType === "image" ? "bg-primary text-primary-foreground" : "bg-muted"
                  }`}
                >
                  Imagem
                </button>
                <button
                  type="button"
                  onClick={() => setEditMediaType("video")}
                  className={`rounded-full px-3 py-1 text-xs font-medium ${
                    editMediaType === "video" ? "bg-primary text-primary-foreground" : "bg-muted"
                  }`}
                >
                  Vídeo 9:16
                </button>
              </div>
              {editMediaType === "image" ? (
                <ImageUpload
                  value={editImageUrl}
                  onChange={setEditImageUrl}
                  folder={`${editingPost.companyId}/feed`}
                />
              ) : (
                <VideoUpload
                  value={editVideoUrl}
                  onChange={setEditVideoUrl}
                  folder={`${editingPost.companyId}/feed`}
                />
              )}
              <Textarea
                placeholder="Texto"
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                maxLength={500}
              />
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setEditingPost(null)}>
                  Cancelar
                </Button>
                <Button
                  onClick={() =>
                    editPost.mutate({
                      id: editingPost.id,
                      text: editText.trim(),
                      imageUrl: editMediaType === "image" ? editImageUrl : null,
                      videoUrl: editMediaType === "video" ? editVideoUrl : null,
                    })
                  }
                  disabled={
                    editPost.isPending || (!editText.trim() && !editImageUrl && !editVideoUrl)
                  }
                >
                  Salvar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
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
              onClick={() => {
                if (confirmDelete) remove.mutate(confirmDelete.id);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function PostDetail({
  post,
  metric,
  onEdit,
  onDelete,
}: {
  post: any;
  metric: PostMetric | null;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [showAnalytics, setShowAnalytics] = useState(false);

  return (
    <div>
      <DialogHeader>
        <DialogTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Avatar className="size-7">
              {post.authorType === "business" && post.companyLogoUrl ? (
                <AvatarImage src={post.companyLogoUrl} alt="" />
              ) : post.authorType === "customer" && post.customerAvatarUrl ? (
                <AvatarImage src={post.customerAvatarUrl} alt="" />
              ) : null}
              <AvatarFallback>
                {post.authorType === "business" ? (
                  <Store className="size-3" />
                ) : (
                  <UserIcon className="size-3" />
                )}
              </AvatarFallback>
            </Avatar>
            <span>
              {post.authorType === "business"
                ? "Estabelecimento"
                : (post.customerName ?? "Cliente")}
            </span>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="icon" variant="ghost">
                <MoreVertical className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onEdit}>
                <Pencil className="size-4" /> Editar
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={onDelete}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="size-4" /> Excluir
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </DialogTitle>
      </DialogHeader>
      <div className="mt-2 text-xs text-muted-foreground">{relativeTime(post.createdAt)}</div>
      {post.videoUrl ? (
        <div className="mt-3 aspect-[9/16] w-full overflow-hidden rounded-lg">
          <video src={post.videoUrl} className="size-full object-cover" controls playsInline />
        </div>
      ) : post.imageUrl ? (
        <img src={post.imageUrl} alt="" className="mt-3 max-h-80 w-full rounded-lg object-cover" />
      ) : null}
      {post.text && <p className="mt-3 text-sm">{post.text}</p>}
      <div className="mt-3 flex items-center gap-4 text-sm text-muted-foreground">
        <span className="flex items-center gap-1">
          <Heart className="size-4" /> {post.loveCount}
        </span>
        <span className="flex items-center gap-1">
          <ThumbsDown className="size-4" /> {post.dislikeCount}
        </span>
        <span className="flex items-center gap-1">
          <MessageCircle className="size-4" /> {post.commentCount}
        </span>
      </div>

      {metric && (
        <>
          <button
            onClick={() => setShowAnalytics(!showAnalytics)}
            className="mt-3 flex items-center gap-1 text-xs text-primary hover:underline"
          >
            <BarChart3 className="size-3" /> Analytics
          </button>
          {showAnalytics && (
            <div className="mt-2 space-y-2 rounded-lg bg-muted p-3 text-xs">
              <div className="flex justify-between">
                <span>Produtos vinculados</span>
                <span className="font-semibold">{metric.productCount}</span>
              </div>
              <div className="flex justify-between">
                <span>Pedidos gerados</span>
                <span className="font-semibold">{metric.orderCount}</span>
              </div>
              <div className="flex justify-between border-b pb-1">
                <span>Taxa de conversão</span>
                <span className="font-semibold text-primary">
                  {metric.conversionRate.toFixed(1)}%
                </span>
              </div>

              {metric.products.length > 0 && (
                <div>
                  <div className="mb-1 font-medium">Produtos pedidos</div>
                  {metric.products.map((pr: any) => (
                    <div key={pr.id} className="flex justify-between">
                      <span>{pr.name}</span>
                      <span>
                        {pr.ordered} unid. · {formatBRL(pr.revenue)}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              <div className="grid grid-cols-2 gap-2 pt-1">
                <div>
                  <div className="mb-1 flex items-center gap-1 font-medium">
                    <Clock className="size-3" /> Horário
                  </div>
                  {metric.hourBreakdown.slice(0, 3).map((h: any) => (
                    <div key={h.hour} className="flex justify-between">
                      <span>{h.hour}h</span>
                      <span>{h.count} interações</span>
                    </div>
                  ))}
                </div>
                <div>
                  <div className="mb-1 flex items-center gap-1 font-medium">
                    <Calendar className="size-3" /> Dia
                  </div>
                  {metric.dayBreakdown.slice(0, 3).map((d: any) => (
                    <div key={d.day} className="flex justify-between">
                      <span className="capitalize">{d.day}</span>
                      <span>{d.count} interações</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
