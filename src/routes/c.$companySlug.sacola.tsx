import { createFileRoute, useNavigate, Navigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { companyRepository, orderRepository, checkinRepository } from "@/repositories";
import { getSessionForCompany } from "@/lib/session";
import { useCart } from "@/hooks/use-cart";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { formatBRL } from "@/lib/format";
import { Minus, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";

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

  const submit = useMutation({
    mutationFn: async () => {
      if (!company || !session) throw new Error("Sessão inválida");
      if (cart.items.length === 0) throw new Error("Sacola vazia");
      // pega mesa do último checkin, se houver
      const recent = await checkinRepository.listRecentByCompany(company.id, 1);
      const myLatest = recent.find((c: any) => c.customer_id === session.customerId);
      return orderRepository.create({
        companyId: company.id,
        customerId: session.customerId,
        tableId: myLatest?.table_id ?? null,
        note,
        items: cart.items,
      });
    },
    onSuccess: () => {
      toast.success("Pedido enviado! O estabelecimento foi notificado.");
      cart.clear();
      qc.invalidateQueries({ queryKey: ["orders"] });
      window.location.href = `/c/${companySlug}/feed`;
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (!session) {
    return <Navigate to="/c/$companySlug" params={{ companySlug }} />;
  }

  return (
    <div className="p-4">
      <h1 className="mb-4 text-xl font-bold">Sua sacola</h1>
      {cart.items.length === 0 ? (
        <p className="py-12 text-center text-muted-foreground">Nenhum item ainda.</p>
      ) : (
        <div className="space-y-3">
          {cart.items.map((i) => (
            <div key={i.productId} className="flex items-center gap-3 rounded-xl border p-3">
              {i.imageUrl && (
                <img src={i.imageUrl} alt="" className="size-16 rounded-lg object-cover" />
              )}
              <div className="flex-1">
                <div className="text-sm font-medium">{i.name}</div>
                <div className="text-xs text-muted-foreground">{formatBRL(i.price)}</div>
                <Input
                  value={i.note ?? ""}
                  onChange={(e) => cart.setNote(i.productId, e.target.value)}
                  placeholder="Observação"
                  className="mt-2 h-8 text-xs"
                />
              </div>
              <div className="flex items-center gap-1">
                <Button size="icon" variant="ghost" onClick={() => cart.setQty(i.productId, i.quantity - 1)}>
                  <Minus className="size-3" />
                </Button>
                <span className="w-6 text-center text-sm font-medium">{i.quantity}</span>
                <Button size="icon" variant="ghost" onClick={() => cart.setQty(i.productId, i.quantity + 1)}>
                  <Plus className="size-3" />
                </Button>
                <Button size="icon" variant="ghost" onClick={() => cart.remove(i.productId)}>
                  <Trash2 className="size-3" />
                </Button>
              </div>
            </div>
          ))}

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
