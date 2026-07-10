import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { productRepository } from "@/repositories";
import type { Product, ProductStatus } from "@/repositories/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ImageUpload } from "@/components/image-upload";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatBRL } from "@/lib/format";
import { toast } from "sonner";
import {
  Pencil,
  Trash2,
  Plus,
  QrCode,
  Download,
  Eye,
  ScanLine,
  ShoppingCart,
  Package,
  TrendingUp,
  Users,
  Hash,
} from "lucide-react";
import QRCode from "qrcode";

export const Route = createFileRoute("/_authenticated/app/catalogo")({
  component: CatalogoPage,
  head: () => ({ meta: [{ title: "Catálogo Inteligente — WEAZE" }] }),
});

const empty = {
  name: "",
  slug: "",
  category: "",
  price: 0,
  imageUrl: "",
  description: "",
  available: true,
  status: "active" as ProductStatus,
  stockQuantity: 0,
  sku: "",
  internalCode: "",
};

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function CatalogoPage() {
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

  const { data: company } = useQuery({
    queryKey: ["my-company"],
    queryFn: async () => {
      const { data } = await supabase
        .from("companies")
        .select("slug")
        .eq("id", companyId!)
        .single();
      return data;
    },
    enabled: !!companyId,
  });

  const { data: products } = useQuery({
    queryKey: ["catalogo", companyId],
    queryFn: () => productRepository.listByCompany(companyId!),
    enabled: !!companyId,
  });

  const [editing, setEditing] = useState<Product | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(empty);
  const [qrOpenId, setQrOpenId] = useState<string | null>(null);
  const qrCanvasRef = useRef<HTMLCanvasElement>(null);

  function buildQrUrl(slug: string) {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    return `${origin}/p/${slug}`;
  }

  function openNew() {
    setEditing(null);
    setForm(empty);
    setOpen(true);
  }

  function openEdit(p: Product) {
    setEditing(p);
    setForm({
      name: p.name,
      slug: p.slug,
      category: p.category ?? "",
      price: p.price,
      imageUrl: p.imageUrl ?? "",
      description: p.description ?? "",
      available: p.available,
      status: p.status,
      stockQuantity: p.stockQuantity ?? 0,
      sku: p.sku ?? "",
      internalCode: p.internalCode ?? "",
    });
    setOpen(true);
  }

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        name: form.name,
        slug: form.slug || generateSlug(form.name),
        category: form.category || null,
        price: Number(form.price),
        imageUrl: form.imageUrl || null,
        description: form.description || null,
        available: form.available,
        status: form.status,
        stockQuantity: form.stockQuantity || null,
        sku: form.sku || null,
        internalCode: form.internalCode || null,
      };
      if (editing) return productRepository.update(editing.id, payload);
      return productRepository.create(companyId!, payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["catalogo"] });
      toast.success("Salvo");
      setOpen(false);
      setForm(empty);
      setEditing(null);
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) => productRepository.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["catalogo"] }),
  });

  async function downloadQr(product: Product) {
    const url = buildQrUrl(product.slug);
    const canvas = document.createElement("canvas");
    await QRCode.toCanvas(canvas, url, { width: 400, margin: 2 });
    const link = document.createElement("a");
    link.download = `qr-${product.slug}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  }

  async function downloadAllQr() {
    if (!products) return;
    for (const p of products) {
      await downloadQr(p);
    }
    toast.success("QR codes baixados");
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Catálogo Inteligente</h1>
        <div className="flex gap-2">
          {products && products.length > 0 && (
            <Button variant="outline" onClick={downloadAllQr}>
              <Download className="mr-1 size-4" /> QR Codes
            </Button>
          )}
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button onClick={openNew}>
                <Plus className="mr-1 size-4" /> Novo
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {editing ? "Editar produto" : "Novo produto"}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label>Nome</Label>
                  <Input
                    value={form.name}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        name: e.target.value,
                        slug: editing ? form.slug : generateSlug(e.target.value),
                      })
                    }
                  />
                </div>
                <div>
                  <Label>Slug (URL amigável)</Label>
                  <Input
                    value={form.slug}
                    onChange={(e) =>
                      setForm({ ...form, slug: e.target.value })
                    }
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Categoria</Label>
                    <Input
                      value={form.category}
                      onChange={(e) =>
                        setForm({ ...form, category: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <Label>Preço</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={form.price}
                      onChange={(e) =>
                        setForm({ ...form, price: Number(e.target.value) })
                      }
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>SKU</Label>
                    <Input
                      value={form.sku}
                      onChange={(e) =>
                        setForm({ ...form, sku: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <Label>Código interno</Label>
                    <Input
                      value={form.internalCode}
                      onChange={(e) =>
                        setForm({ ...form, internalCode: e.target.value })
                      }
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Estoque</Label>
                    <Input
                      type="number"
                      value={form.stockQuantity}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          stockQuantity: Number(e.target.value),
                        })
                      }
                    />
                  </div>
                  <div>
                    <Label>Status</Label>
                    <Select
                      value={form.status}
                      onValueChange={(v) =>
                        setForm({ ...form, status: v as ProductStatus })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Ativo</SelectItem>
                        <SelectItem value="inactive">Inativo</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label>Imagem</Label>
                  <ImageUpload
                    value={form.imageUrl}
                    onChange={(url) => setForm({ ...form, imageUrl: url ?? "" })}
                    folder={`${companyId}/catalogo`}
                  />
                </div>
                <div>
                  <Label>Descrição</Label>
                  <Textarea
                    value={form.description}
                    onChange={(e) =>
                      setForm({ ...form, description: e.target.value })
                    }
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label>Disponível</Label>
                  <Switch
                    checked={form.available}
                    onCheckedChange={(v) => setForm({ ...form, available: v })}
                  />
                </div>
                <Button
                  onClick={() => save.mutate()}
                  disabled={save.isPending || !form.name}
                >
                  Salvar
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {products?.map((p) => (
          <ProductCard
            key={p.id}
            product={p}
            qrUrl={buildQrUrl(p.slug)}
            onEdit={() => openEdit(p)}
            onRemove={() => {
              if (window.confirm(`Remover ${p.name}?`)) remove.mutate(p.id);
            }}
            onDownloadQr={() => downloadQr(p)}
          />
        ))}
      </div>

      {(!products || products.length === 0) && (
        <div className="py-16 text-center text-muted-foreground">
          <QrCode className="mx-auto mb-4 size-12 opacity-40" />
          <p>Nenhum produto cadastrado.</p>
          <p className="text-sm">
            Crie produtos com QR code para seu catálogo inteligente.
          </p>
        </div>
      )}
    </div>
  );
}

function ProductCard({
  product,
  qrUrl,
  onEdit,
  onRemove,
  onDownloadQr,
}: {
  product: Product;
  qrUrl: string;
  onEdit: () => void;
  onRemove: () => void;
  onDownloadQr: () => void;
}) {
  const [showQr, setShowQr] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  function renderQr() {
    if (canvasRef.current) {
      QRCode.toCanvas(canvasRef.current, qrUrl, { width: 200, margin: 2 });
    }
  }

  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex gap-4">
        {product.imageUrl ? (
          <img
            src={product.imageUrl}
            alt=""
            className="size-20 shrink-0 rounded-lg object-cover"
          />
        ) : (
          <div className="grid size-20 shrink-0 place-items-center rounded-lg bg-muted">
            <Package className="size-8 text-muted-foreground" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="font-medium truncate">{product.name}</div>
          <div className="text-xs text-muted-foreground truncate">
            {product.category}
            {product.sku && ` • SKU: ${product.sku}`}
          </div>
          <div className="mt-1 font-bold">{formatBRL(product.price)}</div>
          <div className="mt-0.5 flex flex-wrap gap-1">
            {product.status === "inactive" && (
              <span className="rounded bg-muted px-1.5 text-[10px] text-muted-foreground">
                Inativo
              </span>
            )}
            {!product.available && (
              <span className="rounded bg-destructive/20 px-1.5 text-[10px] text-destructive">
                Indisponível
              </span>
            )}
            {product.stockQuantity !== null && (
              <span className="rounded bg-muted px-1.5 text-[10px] text-muted-foreground">
                Estoque: {product.stockQuantity}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-5 gap-1 rounded-lg bg-muted/50 p-2 text-[10px] text-muted-foreground">
        <div className="flex flex-col items-center gap-0.5">
          <Eye className="size-3" />
          <span>{product.viewsCount}</span>
        </div>
        <div className="flex flex-col items-center gap-0.5">
          <ScanLine className="size-3" />
          <span>{product.scanCount}</span>
        </div>
        <div className="flex flex-col items-center gap-0.5">
          <ShoppingCart className="size-3" />
          <span>{product.cartAdditionsCount}</span>
        </div>
        <div className="flex flex-col items-center gap-0.5">
          <Package className="size-3" />
          <span>{product.orderCount}</span>
        </div>
        <div className="flex flex-col items-center gap-0.5">
          <TrendingUp className="size-3" />
          <span>{formatBRL(product.revenue)}</span>
        </div>
      </div>

      <div className="mt-2 flex items-center gap-1 text-[10px] text-muted-foreground">
        <Users className="size-3" />
        <span>{product.uniqueCustomers} clientes únicos</span>
        {product.internalCode && (
          <>
            <span className="mx-1">•</span>
            <Hash className="size-3" />
            <span>{product.internalCode}</span>
          </>
        )}
      </div>

      <div className="mt-3 flex gap-2">
        <Button size="sm" variant="outline" className="flex-1" onClick={onEdit}>
          <Pencil className="mr-1 size-3" /> Editar
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            setShowQr(!showQr);
            if (!showQr) setTimeout(renderQr, 50);
          }}
        >
          <QrCode className="size-3" />
        </Button>
        <Button size="sm" variant="outline" onClick={onDownloadQr}>
          <Download className="size-3" />
        </Button>
        <Button size="sm" variant="ghost" onClick={onRemove}>
          <Trash2 className="size-3" />
        </Button>
      </div>

      {showQr && (
        <div className="mt-3 flex justify-center rounded-lg bg-white p-3">
          <canvas ref={canvasRef} />
        </div>
      )}
    </div>
  );
}

export default CatalogoPage;
