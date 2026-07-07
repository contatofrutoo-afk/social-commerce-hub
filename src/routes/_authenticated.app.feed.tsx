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
import { toast } from "sonner";
import { Trash2, ChevronDown, ChevronUp, BarChart3, Clock, Calendar } from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/feed")({
  component: FeedAdminPage,
});

function FeedAdminPage() {
  const qc = useQueryClient();
  const { data: companyId } = useQuery({
    queryKey: ["my-company-id"],
    queryFn: async () => {
      const { data } = await supabase.from("user_roles").select("company_id").limit(1).maybeSingle();
      return data?.company_id as string | undefined;
    },
  });

  const [text, setText] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>("");
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);

  const { data: products } = useQuery({
    queryKey: ["products", companyId],
    queryFn: () => productRepository.listByCompany(companyId!),
    enabled: !!companyId,
  });
  const { data: posts, isError: postsError } = useQuery({
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
        imageUrl: imageUrl || null,
        productIds: selectedProducts,
      }),
    onSuccess: () => {
      setText("");
      setImageUrl("");
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
    onSuccess: () => qc.invalidateQueries({ queryKey: ["feed-b2b"] }),
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Feed</h1>

      <div className="space-y-3 rounded-xl border bg-card p-4">
        <h2 className="font-semibold">Nova publicação</h2>
        <ImageUpload value={imageUrl} onChange={setImageUrl} folder={`${companyId}/feed`} />
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
        <Button onClick={() => publish.mutate()} disabled={publish.isPending || (!text && !imageUrl)}>
          Publicar
        </Button>
      </div>

      <div className="space-y-3">
        <h2 className="font-semibold">Publicações</h2>
        {posts?.map((p) => (
          <PostCardWithAnalytics
            key={p.id}
            post={p}
            metric={metricById.get(p.id) ?? null}
            onRemove={() => remove.mutate(p.id)}
          />
        ))}
      </div>
    </div>
  );
}

function PostCardWithAnalytics({
  post,
  metric,
  onRemove,
}: {
  post: any;
  metric: PostMetric | null;
  onRemove: () => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-sm">
          <span className="font-medium">
            {post.authorType === "business" ? "Estabelecimento" : (post.customerName ?? "Cliente")}
          </span>
          <span className="ml-2 text-xs text-muted-foreground">{relativeTime(post.createdAt)}</span>
        </div>
        <Button size="icon" variant="ghost" onClick={onRemove}>
          <Trash2 className="size-4" />
        </Button>
      </div>
      {post.imageUrl && (
        <img src={post.imageUrl} alt="" className="max-h-64 w-full rounded-lg object-cover" />
      )}
      {post.text && <p className="mt-2 text-sm">{post.text}</p>}
      <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
        <span>❤️ {post.loveCount}</span>
        <span>👎 {post.dislikeCount}</span>
        <span>💬 {post.commentCount}</span>
        {metric && (
          <button
            onClick={() => setOpen(!open)}
            className="ml-auto flex items-center gap-1 text-primary hover:underline"
          >
            <BarChart3 className="size-3" />
            Analytics
            {open ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
          </button>
        )}
      </div>

      {open && metric && (
        <div className="mt-3 space-y-2 rounded-lg bg-muted p-3 text-xs">
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
            <span className="font-semibold text-primary">{metric.conversionRate.toFixed(1)}%</span>
          </div>

          {metric.products.length > 0 && (
            <div>
              <div className="mb-1 font-medium">Produtos pedidos</div>
              {metric.products.map((pr: any) => (
                <div key={pr.id} className="flex justify-between">
                  <span>{pr.name}</span>
                  <span>{pr.ordered} unid. · {formatBRL(pr.revenue)}</span>
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
    </div>
  );
}
