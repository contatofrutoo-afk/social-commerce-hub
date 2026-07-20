import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { companyRepository, orderRepository } from "@/repositories";
import { supabase } from "@/integrations/supabase/client";
import { getSessionForCompany, clearSession, clearLastProfile } from "@/lib/session";
import { useCart } from "@/hooks/use-cart";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ProductMediaGallery } from "@/components/product-media-gallery";
import { formatBRL } from "@/lib/format";
import { Minus, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useState, useEffect } from "react";

export const Route = createFileRoute("/c/$companySlug/sacola")({
  component: BagPage,
});

function BagPage() {
  const { companySlug } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const session = typeof window !== "undefined" ? getSessionForCompany(companySlug) : null;
  const [note, setNote] = useState("");

  const { data: company } = useQuery({
    queryKey: ["company", companySlug],
    queryFn: () => companyRepository.findBySlug(companySlug),
  });
  const cart = useCart(company?.id);

  const productIds = cart.items.map((i) => i.productId);
  const { data: mediaByProduct } = useQuery({
    queryKey: ["cart-product-media", ...productIds],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("product_media")
        .select("product_id, media_url, media_type, sort_order")
        .in("product_id", productIds)
        .order("sort_order");
      if (error) throw error;
      const map = new Map<string, { url: string; type: "image" | "video" }[]>();
      for (const row of (data ?? []) as { product_id: string; media_url: string; media_type: "image" | "video" }[]) {
        const list = map.get(row.product_id) ?? [];
        list.push({ url: row.media_url, type: row.media_type });
        map.set(row.product_id, list);
      }
      return map;
    },
    enabled: productIds.length > 0,
  });

  const submit = useMutation({
    mutationFn: async () => {
      if (!company || !session) throw new Error("Sessão inválida");
      if (cart.items.length === 0) throw new Error("Sacola vazia");
      return orderRepository.create({
        companyId: company.id,
        customerId: session.customerId,
        sessionToken: session.sessionToken,
        tableId: null,
        note,
        items: cart.items,
      });
    },
    onSuccess: () => {
      toast.success("Pedido enviado! O estabelecimento foi notificado.");
      cart.clear();
      qc.invalidateQueries({ queryKey: ["orders"] });
      navigate({ to: "/c/$companySlug/feed", params: { companySlug } });
    },
    onError: (e: any) => toast.error(e.message),
  });

  useEffect(() => {
    if (typeof window !== "undefined" && !session) {
      navigate({ to: "/c/$companySlug/desconexao", params: { companySlug } });
    }
  }, [session, companySlug, navigate]);

  if (!session) return null;

  return (
    <div className="p-4">
      <h1 className="mb-4 text-xl font-bold">Sua sacola</h1>
      {cart.items.length === 0 ? (
        <p className="py-12 text-center text-muted-foreground">Nenhum item ainda.</p>
      ) : (
        <div className="space-y-3">
          {cart.items.map((i) => {
            const freshMedia = mediaByProduct?.get(i.productId);
            return (
            <div key={i.productId} className="rounded-xl border bg-card p-3">
              <div className="flex gap-3">
                <ProductMediaGallery
                  imageUrl={i.imageUrl}
                  videoUrl={i.videoUrl}
                  media={freshMedia ?? i.media}
                  size={128}
                  productId={i.productId}
                  companyId={company?.id}
                />

                <div className="flex min-w-0 flex-1 flex-col">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">{i.name}</div>
                      <div className="text-xs text-muted-foreground">{formatBRL(i.price)}</div>
                    </div>
                    <Button size="icon" variant="ghost" className="shrink-0" onClick={() => cart.remove(i.productId)}>
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                  <Input
                    value={i.note ?? ""}
                    onChange={(e) => cart.setNote(i.productId, e.target.value)}
                    placeholder="Observação"
                    className="mt-2 h-8 text-xs"
                  />
                  <div className="mt-auto flex items-center justify-between pt-2">
                    <span className="text-xs text-muted-foreground">
                      Subtotal: <span className="font-semibold text-foreground">{formatBRL(i.price * i.quantity)}</span>
                    </span>
                    <div className="flex items-center gap-1 rounded-full border">
                      <Button size="icon" variant="ghost" className="size-7 rounded-full" onClick={() => cart.setQty(i.productId, i.quantity - 1)}>
                        <Minus className="size-3" />
                      </Button>
                      <span className="w-5 text-center text-sm font-medium">{i.quantity}</span>
                      <Button size="icon" variant="ghost" className="size-7 rounded-full" onClick={() => cart.setQty(i.productId, i.quantity + 1)}>
                        <Plus className="size-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            );
          })}

          <Textarea
            placeholder="Observação do pedido (opcional)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={300}
          />

          <div className="sticky bottom-20 rounded-xl border bg-card p-4 shadow-lg">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Total</span>
              <span className="text-lg font-bold">{formatBRL(cart.total)}</span>
            </div>
            <Button
              className="mt-3 w-full"
              size="lg"
              onClick={() => submit.mutate()}
              disabled={submit.isPending}
            >
              {submit.isPending ? "Enviando…" : "Enviar pedido"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
