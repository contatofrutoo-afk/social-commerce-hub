import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { productRepository } from "@/repositories";
import type { Product } from "@/repositories/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ImageUpload } from "@/components/image-upload";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { formatBRL } from "@/lib/format";
import { toast } from "sonner";
import { Pencil, Trash2, Plus } from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/produtos")({
  component: ProductsPage,
});

const empty = { name: "", category: "", price: 0, image_url: "", description: "", available: true };

function ProductsPage() {
  const qc = useQueryClient();
  const { data: companyId } = useQuery({
    queryKey: ["my-company-id"],
    queryFn: async () => {
      const { data } = await supabase.from("user_roles").select("company_id").limit(1).maybeSingle();
      return data?.company_id as string | undefined;
    },
  });

  const { data: products } = useQuery({
    queryKey: ["products", companyId],
    queryFn: () => productRepository.listByCompany(companyId!),
    enabled: !!companyId,
  });

  const [editing, setEditing] = useState<Product | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>(empty);

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        name: form.name,
        category: form.category,
        price: Number(form.price),
        imageUrl: form.image_url || null,
        description: form.description || null,
        available: form.available,
      };
      if (editing) return productRepository.update(editing.id, payload);
      return productRepository.create(companyId!, payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["products"] });
      toast.success("Salvo");
      setOpen(false);
      setForm(empty);
      setEditing(null);
    },
  });
  const remove = useMutation({
    mutationFn: (id: string) => productRepository.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["products"] }),
  });

  function openNew() {
    setEditing(null);
    setForm(empty);
    setOpen(true);
  }
  function openEdit(p: Product) {
    setEditing(p);
    setForm({
      name: p.name,
      category: p.category ?? "",
      price: p.price,
      image_url: p.imageUrl ?? "",
      description: p.description ?? "",
      available: p.available,
    });
    setOpen(true);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Produtos</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={openNew}>
              <Plus className="mr-1 size-4" /> Novo
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing ? "Editar produto" : "Novo produto"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Nome</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div>
                <Label>Categoria</Label>
                <Input
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                />
              </div>
              <div>
                <Label>Preço</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.price}
                  onChange={(e) => setForm({ ...form, price: e.target.value })}
                />
              </div>
              <div>
                <Label>URL da imagem</Label>
                <ImageUpload value={form.image_url} onChange={(url) => setForm({ ...form, image_url: url })} folder={`products/${companyId}`} />
              </div>
              <div>
                <Label>Descrição</Label>
                <Textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label>Disponível</Label>
                <Switch
                  checked={form.available}
                  onCheckedChange={(v) => setForm({ ...form, available: v })}
                />
              </div>
              <Button onClick={() => save.mutate()} disabled={save.isPending || !form.name}>
                Salvar
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {products?.map((p) => (
          <div key={p.id} className="rounded-xl border bg-card p-3">
            {p.imageUrl && (
              <img src={p.imageUrl} alt="" className="h-32 w-full rounded-lg object-cover" />
            )}
            <div className="mt-2 flex justify-between">
              <div>
                <div className="font-medium">{p.name}</div>
                <div className="text-xs text-muted-foreground">{p.category}</div>
              </div>
              <div className="text-right">
                <div className="font-bold">{formatBRL(p.price)}</div>
                {!p.available && (
                  <span className="rounded bg-destructive/20 px-1 text-xs text-destructive">
                    Indisponível
                  </span>
                )}
              </div>
            </div>
            <div className="mt-2 flex gap-2">
              <Button size="sm" variant="outline" className="flex-1" onClick={() => openEdit(p)}>
                <Pencil className="mr-1 size-3" /> Editar
              </Button>
              <Button size="sm" variant="ghost" onClick={() => remove.mutate(p.id)}>
                <Trash2 className="size-3" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
