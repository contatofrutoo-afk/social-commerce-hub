// Sacola no client — puramente UI state. Ao "Enviar Pedido", vira Order no Cloud.
import { useCallback, useEffect, useState } from "react";
import type { CartItem, Product, SelectedOption } from "@/repositories/types";
import { productRepository } from "@/repositories/product.repository";
import { getSession } from "@/lib/session";

const KEY_PREFIX = "weaze.cart.v1.";

function normalizeItem(raw: any): CartItem {
  return {
    key: raw.key ?? raw.productId,
    productId: raw.productId,
    name: raw.name,
    price: Number(raw.price),
    basePrice: raw.basePrice != null ? Number(raw.basePrice) : undefined,
    imageUrl: raw.imageUrl ?? null,
    videoUrl: raw.videoUrl ?? null,
    media: raw.media ?? undefined,
    quantity: raw.quantity ?? 1,
    note: raw.note ?? undefined,
    options: raw.options ?? undefined,
  };
}

function read(companyId: string): CartItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY_PREFIX + companyId);
    return raw ? (JSON.parse(raw) as CartItem[]).map(normalizeItem) : [];
  } catch {
    return [];
  }
}
function write(companyId: string, items: CartItem[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY_PREFIX + companyId, JSON.stringify(items));
  window.dispatchEvent(new CustomEvent("weaze:cart", { detail: companyId }));
}

/** Identidade da linha: mesmo produto + mesma combinação de opções. */
function buildKey(productId: string, options: SelectedOption[]): string {
  if (!options || options.length === 0) return productId;
  const norm = [...options]
    .map((o) => ({
      optionId: o.optionId ?? o.optionName,
      valueId: o.valueId ?? null,
      freeText: o.freeText ?? "",
      quantity: o.quantity ?? 1,
    }))
    .sort((a, b) => String(a.optionId).localeCompare(String(b.optionId)))
    .map((o) => `${o.optionId}::${o.valueId ?? ""}::${o.freeText ?? ""}::${o.quantity ?? 1}`);
  return `${productId}::${JSON.stringify(norm)}`;
}

/** Preço unitário com as opções selecionadas (produto + ajustes). */
export function unitPriceFor(product: Pick<Product, "price">, options: SelectedOption[]): number {
  let price = product.price;
  for (const o of options ?? []) {
    price += (o.priceAdjust ?? 0) * (o.quantity ?? 1);
  }
  return price;
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
    (product: Product, qty = 1, options: SelectedOption[] = []) => {
      if (!companyId) return;
      const list = read(companyId);
      const key = buildKey(product.id, options);
      const existing = list.find((i) => i.key === key);
      const item: CartItem = {
        key,
        productId: product.id,
        name: product.name,
        price: unitPriceFor(product, options),
        basePrice: product.price,
        imageUrl: product.imageUrl,
        videoUrl: product.videoUrl ?? null,
        media: (product.media ?? []).map((m) => ({ url: m.mediaUrl, type: m.mediaType })),
        quantity: qty,
        options: options.length > 0 ? options : undefined,
      };
      if (existing) existing.quantity += qty;
      else list.push(item);
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
    (key: string, qty: number) => {
      if (!companyId) return;
      const list = read(companyId)
        .map((i) => (i.key === key ? { ...i, quantity: qty } : i))
        .filter((i) => i.quantity > 0);
      write(companyId, list);
    },
    [companyId],
  );

  const remove = useCallback(
    (key: string) => {
      if (!companyId) return;
      write(
        companyId,
        read(companyId).filter((i) => i.key !== key),
      );
    },
    [companyId],
  );

  const clear = useCallback(() => {
    if (!companyId) return;
    write(companyId, []);
  }, [companyId]);

  const setNote = useCallback(
    (key: string, note: string) => {
      if (!companyId) return;
      write(
        companyId,
        read(companyId).map((i) => (i.key === key ? { ...i, note } : i)),
      );
    },
    [companyId],
  );

  const total = items.reduce((s, i) => s + i.price * i.quantity, 0);
  const count = items.reduce((s, i) => s + i.quantity, 0);

  return { items, add, setQty, remove, clear, setNote, total, count };
}
