import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { productRepository } from "@/repositories";
import { useCart } from "@/hooks/use-cart";
import { getSessionForCompany } from "@/lib/session";
import { Button } from "@/components/ui/button";
import { formatBRL } from "@/lib/format";
import { ArrowLeft, ShoppingCart, Package, Minus, Plus, Eye, ScanLine, Hash } from "lucide-react";

export const Route = createFileRoute("/p/$slug")({
  component: ProductPage,
  head: () => ({ meta: [{ title: "Produto — WEAZE" }] }),
});

function ProductPage() {
  const { slug } = Route.useParams();
  const [qty, setQty] = useState(1);

  const { data: product, isPending } = useQuery({
    queryKey: ["product-by-slug", slug],
    queryFn: () => productRepository.findBySlug(slug),
  });

  const cart = useCart(product?.companyId);

  useEffect(() => {
    if (product) {
      productRepository.recordEvent(product.id, product.companyId, "view").catch(() => {});
      productRepository.incrementCounter(product.id, "views_count").catch(() => {});
    }
  }, [product?.id]);

  if (isPending) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-pulse text-center text-muted-foreground">
          <Package className="mx-auto mb-4 size-12" />
          <p>Carregando...</p>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center text-muted-foreground">
          <Package className="mx-auto mb-4 size-12" />
          <p>Produto não encontrado</p>
          <Link to="/" className="mt-4 inline-block text-sm text-primary underline">
            Voltar
          </Link>
        </div>
      </div>
    );
  }

  function addToCart() {
    if (!product) return;
    cart.add(product, qty);
    const companySlug = product.companySlug ?? slug.split("-")[0];
    const session = getSessionForCompany(companySlug);
    productRepository.recordEvent(product.id, product.companyId, "cart_add", session?.customerId).catch(() => {});
    productRepository.incrementCounter(product.id, "cart_additions_count").catch(() => {});
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-20 border-b bg-background/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
          <Link to="/" className="flex items-center gap-2 text-sm text-muted-foreground">
            <ArrowLeft className="size-4" />
            Voltar
          </Link>
          <Link to={`/c/${product.companySlug ?? slug.split("-")[0]}/sacola`} className="relative">
            <ShoppingCart className="size-5" />
            {cart.count > 0 && (
              <span className="absolute -right-2 -top-2 grid size-4 place-items-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                {cart.count}
              </span>
            )}
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-6">
        {product.imageUrl && (
          <img
            src={product.imageUrl}
            alt={product.name}
            className="w-full rounded-xl object-cover aspect-square"
          />
        )}

        <div className="mt-4 space-y-3">
          <div>
            <h1 className="text-xl font-bold">{product.name}</h1>
            {product.category && (
              <span className="text-xs text-muted-foreground">{product.category}</span>
            )}
          </div>

          {(product.sku || product.internalCode) && (
            <div className="flex gap-3 text-xs text-muted-foreground">
              {product.sku && (
                <span className="flex items-center gap-1">
                  <Hash className="size-3" /> SKU: {product.sku}
                </span>
              )}
              {product.internalCode && (
                <span className="flex items-center gap-1">
                  <Hash className="size-3" /> Cód: {product.internalCode}
                </span>
              )}
            </div>
          )}

          <div className="text-3xl font-bold">{formatBRL(product.price)}</div>

          {product.description && (
            <p className="text-sm text-muted-foreground">{product.description}</p>
          )}

          {product.stockQuantity !== null && (
            <p className="text-xs text-muted-foreground">
              Estoque: {product.stockQuantity} unidades
            </p>
          )}

          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Eye className="size-3" /> {product.viewsCount + 1} visualizações
            <ScanLine className="ml-2 size-3" /> {product.scanCount} scans
          </div>

          <div className="flex items-center gap-3 pt-2">
            <div className="flex items-center rounded-lg border">
              <button
                className="px-3 py-2 hover:bg-accent"
                onClick={() => setQty(Math.max(1, qty - 1))}
              >
                <Minus className="size-4" />
              </button>
              <span className="min-w-[3rem] text-center font-medium">{qty}</span>
              <button
                className="px-3 py-2 hover:bg-accent"
                onClick={() => setQty(qty + 1)}
              >
                <Plus className="size-4" />
              </button>
            </div>
          </div>
        </div>
      </main>

      <div className="fixed bottom-0 left-0 right-0 border-t bg-background p-4">
        <div className="mx-auto flex max-w-2xl items-center gap-3">
          <div className="flex-1">
            <div className="text-sm text-muted-foreground">Total</div>
            <div className="font-bold">{formatBRL(product.price * qty)}</div>
          </div>
          <Button
            className="flex-1"
            size="lg"
            onClick={addToCart}
            disabled={!product.available}
          >
            <ShoppingCart className="mr-2 size-5" />
            {product.available ? "Adicionar à Sacola" : "Indisponível"}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default ProductPage;
