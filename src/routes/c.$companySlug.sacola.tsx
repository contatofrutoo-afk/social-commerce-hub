import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { companyRepository } from "@/repositories";
import { supabase } from "@/integrations/supabase/client";
import { getSessionForCompany, type WeazeSession } from "@/lib/session";
import { onboardViaQr } from "@/lib/qr-onboard";
import { useCart } from "@/hooks/use-cart";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ProductMediaGallery } from "@/components/product-media-gallery";
import { formatBRL } from "@/lib/format";
import { saveCheckoutItems } from "@/lib/checkout-items";
import { Minus, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useState, useEffect, useCallback } from "react";

export const Route = createFileRoute("/c/$companySlug/sacola")({
  component: BagPage,
});

function BagPage() {
  const { companySlug } = Route.useParams();
  const navigate = useNavigate();
  const [session, setSession] = useState<WeazeSession | null>(() =>
    typeof window !== "undefined" ? getSessionForCompany(companySlug) : null,
  );
  const [onboarding, setOnboarding] = useState(false);

  const { data: company } = useQuery({
    queryKey: ["company", companySlug],
    queryFn: () => companyRepository.findBySlug(companySlug),
  });
  const cart = useCart(company?.id);

  const [selected, setSelected] = useState<Set<string>>(() => {
    if (typeof window === "undefined" || !company) return new Set();
    return new Set(cart.items.map((i) => i.key));
  });

  useEffect(() => {
    if (company && cart.items.length > 0) {
      setSelected((prev) => {
        const current = new Set(prev);
        for (const item of cart.items) {
          if (!current.has(item.key)) current.add(item.key);
        }
        for (const key of current) {
          if (!cart.items.some((i) => i.key === key)) current.delete(key);
        }
        return current;
      });
    }
  }, [cart.items, company]);

  const allSelected = cart.items.length > 0 && selected.size === cart.items.length;
  const toggleAll = useCallback(() => {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(cart.items.map((i) => i.key)));
    }
  }, [allSelected, cart.items]);

  const toggleItem = useCallback((key: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const selectedTotal = cart.items
    .filter((i) => selected.has(i.key))
    .reduce((s, i) => s + i.price * i.quantity, 0);

  const selectedCount = cart.items
    .filter((i) => selected.has(i.key))
    .reduce((s, i) => s + i.quantity, 0);

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

  useEffect(() => {
    if (session || !company) return;
    let cancelled = false;
    setOnboarding(true);
    onboardViaQr({ companyId: company.id, companySlug, tableId: null, source: "link" })
      .then((s) => {
        if (!cancelled) setSession(s);
      })
      .catch((e) => {
        if (cancelled) return;
        toast.error(e instanceof Error ? e.message : "Não foi possível iniciar a sessão.");
        navigate({ to: "/c/$companySlug/desconexao", params: { companySlug } });
      })
      .finally(() => {
        if (!cancelled) setOnboarding(false);
      });
    return () => {
      cancelled = true;
    };
  }, [session, company, companySlug, navigate]);

  if (!session) {
    if (onboarding) {
      return (
        <div className="flex min-h-[60vh] items-center justify-center">
          <p className="animate-pulse text-sm text-muted-foreground">Preparando sua sacola...</p>
        </div>
      );
    }
    return null;
  }

  return (
    <div className="p-4">
      <h1 className="mb-4 text-xl font-bold">Sua sacola</h1>
      {cart.items.length === 0 ? (
        <div className="py-12 text-center">
          <p className="text-muted-foreground">Nenhum item ainda.</p>
          <Button className="mt-4" variant="outline" onClick={() => navigate({ to: "/c/$companySlug/feed", params: { companySlug } })}>
            Ver catálogo
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          <button
            type="button"
            onClick={toggleAll}
            className="flex w-full items-center gap-2 rounded-lg border bg-card px-3 py-2 text-sm"
          >
            <div
              className={`flex size-5 shrink-0 items-center justify-center rounded border ${
                allSelected ? "border-primary bg-primary text-primary-foreground" : "border-border"
              }`}
            >
              {allSelected && <span className="text-xs">✓</span>}
            </div>
            {allSelected ? "Desmarcar todos" : "Selecionar todos"}
          </button>

          {cart.items.map((i) => {
            const freshMedia = mediaByProduct?.get(i.productId);
            const isChecked = selected.has(i.key);
            return (
            <div key={i.key} className={`rounded-xl border bg-card p-3 transition ${isChecked ? "ring-1 ring-primary/40" : "opacity-60"}`}>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => toggleItem(i.key)}
                  className="mt-1 shrink-0"
                >
                  <div
                    className={`flex size-5 items-center justify-center rounded border ${
                      isChecked ? "border-primary bg-primary text-primary-foreground" : "border-border"
                    }`}
                  >
                    {isChecked && <span className="text-xs">✓</span>}
                  </div>
                </button>
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
                      <div className="text-xs text-muted-foreground">
                        {formatBRL(i.basePrice ?? i.price)}
                      </div>
                      {i.options && i.options.length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {i.options.map((o, idx) => {
                            const label = o.freeText
                              ? `${o.optionName}: "${o.freeText}"`
                              : o.valueLabel
                                ? `${o.optionName}: ${o.valueLabel}`
                                : o.optionName;
                            const plus =
                              (o.priceAdjust ?? 0) * (o.quantity ?? 1) > 0
                                ? ` +${formatBRL((o.priceAdjust ?? 0) * (o.quantity ?? 1))}`
                                : "";
                            return (
                              <span
                                key={idx}
                                className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground"
                              >
                                {label}
                                {o.quantity && o.quantity > 1 ? ` ×${o.quantity}` : ""}
                                {plus}
                              </span>
                            );
                          })}
                        </div>
                      )}
                    </div>
                    <Button size="icon" variant="ghost" className="shrink-0" onClick={() => cart.remove(i.key)}>
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                  <Input
                    value={i.note ?? ""}
                    onChange={(e) => cart.setNote(i.key, e.target.value)}
                    placeholder="Observação"
                    className="mt-2 h-8 text-xs"
                  />
                  <div className="mt-auto flex items-center justify-between pt-2">
                    <span className="text-xs text-muted-foreground">
                      Subtotal: <span className="font-semibold text-foreground">{formatBRL(i.price * i.quantity)}</span>
                    </span>
                    <div className="flex items-center gap-1 rounded-full border">
                      <Button size="icon" variant="ghost" className="size-7 rounded-full" onClick={() => cart.setQty(i.key, i.quantity - 1)}>
                        <Minus className="size-3" />
                      </Button>
                      <span className="w-5 text-center text-sm font-medium">{i.quantity}</span>
                      <Button size="icon" variant="ghost" className="size-7 rounded-full" onClick={() => cart.setQty(i.key, i.quantity + 1)}>
                        <Plus className="size-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            );
          })}

          <div className="sticky bottom-20 rounded-xl border bg-card p-4 shadow-lg">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                Total {selectedCount > 0 && selectedCount < cart.items.length
                  ? `(${selectedCount} ${selectedCount === 1 ? "item" : "itens"})`
                  : ""}
              </span>
              <span className="text-lg font-bold">{formatBRL(selectedTotal)}</span>
            </div>
            <Button
              className="mt-3 w-full"
              size="lg"
              disabled={selected.size === 0}
              onClick={() => {
                if (!company) return;
                saveCheckoutItems(company.id, Array.from(selected));
                navigate({ to: "/c/$companySlug/checkout", params: { companySlug } });
              }}
            >
              {selected.size === 0
                ? "Selecione um item"
                : selectedCount === cart.items.length
                  ? "Continuar para o checkout"
                  : `Continuar com ${selectedCount} ${selectedCount === 1 ? "item" : "itens"}`}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
