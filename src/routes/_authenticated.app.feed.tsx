import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { postRepository, productRepository } from "@/repositories";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { relativeTime } from "@/lib/format";
import { ImageUpload } from "@/components/image-upload";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";

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
  const { data: posts } = useQuery({
    queryKey: ["feed-b2b", companyId],
    queryFn: () => postRepository.listByCompany(companyId!),
    enabled: !!companyId,
  });

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
        <ImageUpload value={imageUrl} onChange={setImageUrl} folder={`feed/${companyId}`} />
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
          <div key={p.id} className="rounded-xl border bg-card p-4">
            <div className="mb-2 flex items-center justify-between">
              <div className="text-sm">
                <span className="font-medium">
                  {p.authorType === "business" ? "Estabelecimento" : (p.customerName ?? "Cliente")}
                </span>
                <span className="ml-2 text-xs text-muted-foreground">{relativeTime(p.createdAt)}</span>
              </div>
              <Button size="icon" variant="ghost" onClick={() => remove.mutate(p.id)}>
                <Trash2 className="size-4" />
              </Button>
            </div>
            {p.imageUrl && (
              <img src={p.imageUrl} alt="" className="max-h-64 w-full rounded-lg object-cover" />
            )}
            {p.text && <p className="mt-2 text-sm">{p.text}</p>}
            <div className="mt-2 flex gap-3 text-xs text-muted-foreground">
              <span>❤️ {p.loveCount}</span>
              <span>👎 {p.dislikeCount}</span>
              <span>💬 {p.commentCount}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
