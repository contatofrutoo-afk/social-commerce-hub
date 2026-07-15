// Sacola no client — puramente UI state. Ao "Enviar Pedido", vira Order no Cloud.
import { useCallback, useEffect, useState } from "react";
import type { CartItem, Product } from "@/repositories/types";
import { productRepository } from "@/repositories/product.repository";
import { getSession } from "@/lib/session";

const KEY_PREFIX = "weaze.cart.v1.";

function read(companyId: string): CartItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY_PREFIX + companyId);
    return raw ? (JSON.parse(raw) as CartItem[]) : [];
  } catch {
    return [];
  }
}
function write(companyId: string, items: CartItem[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY_PREFIX + companyId, JSON.stringify(items));
  window.dispatchEvent(new CustomEvent("weaze:cart", { detail: companyId }));
}

export function useCart(companyId: string | undefined) {
  const [items, setItems] = useState<CartItem[]>([]);

  useEffect(() => {
    if (!companyId) return;
    setItems(read(companyId));
    const h = (e: Event) => {
      const ce = e as CustomEvent<string>;
      if (ce.detail === companyId) setItems(read(companyId));
    };
    window.addEventListener("weaze:cart", h);
    return () => window.removeEventListener("weaze:cart", h);
  }, [companyId]);

  const add = useCallback(
    (product: Product, qty = 1) => {
      if (!companyId) return;
      const list = read(companyId);
      const existing = list.find((i) => i.productId === product.id);
      if (existing) existing.quantity += qty;
      else
        list.push({
          productId: product.id,
          name: product.name,
          price: product.price,
          imageUrl: product.imageUrl,
          videoUrl: product.videoUrl ?? null,
          media: (product.media ?? []).map((m) => ({ url: m.mediaUrl, type: m.mediaType })),
          quantity: qty,
        });
      write(companyId, list);
      // Métricas: registra cart_add para a Inteligência do Catálogo, independente
      // de onde o cliente adicionou (feed, sacola, catálogo, /p/:slug).
      const session = getSession();
      const customerId = session?.companyId === companyId ? session.customerId : undefined;
      productRepository
        .recordEvent(product.id, companyId, "cart_add", customerId)
        .catch(() => {});
      productRepository.incrementCounter(product.id, "cart_additions_count").catch(() => {});
    },
    [companyId],
  );

  const setQty = useCallback(
    (productId: string, qty: number) => {
      if (!companyId) return;
      const list = read(companyId)
        .map((i) => (i.productId === productId ? { ...i, quantity: qty } : i))
        .filter((i) => i.quantity > 0);
      write(companyId, list);
    },
    [companyId],
  );

  const remove = useCallback(
    (productId: string) => {
      if (!companyId) return;
      write(
        companyId,
        read(companyId).filter((i) => i.productId !== productId),
      );
    },
    [companyId],
  );

  const clear = useCallback(() => {
    if (!companyId) return;
    write(companyId, []);
  }, [companyId]);

  const setNote = useCallback(
    (productId: string, note: string) => {
      if (!companyId) return;
      write(
        companyId,
        read(companyId).map((i) => (i.productId === productId ? { ...i, note } : i)),
      );
    },
    [companyId],
  );

  const total = items.reduce((s, i) => s + i.price * i.quantity, 0);
  const count = items.reduce((s, i) => s + i.quantity, 0);

  return { items, add, setQty, remove, clear, setNote, total, count };
}
