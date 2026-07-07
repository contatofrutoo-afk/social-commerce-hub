import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { customerRepository, orderRepository } from "@/repositories";
import { getSessionForCompany, clearSession } from "@/lib/session";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatBRL, relativeTime } from "@/lib/format";
import { ImageUpload } from "@/components/image-upload";
import { toast } from "sonner";

export const Route = createFileRoute("/c/$companySlug/perfil")({
  component: ProfilePage,
});

function ProfilePage() {
  const { companySlug } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const session = typeof window !== "undefined" ? getSessionForCompany(companySlug) : null;

  const { data: customer } = useQuery({
    queryKey: ["customer-self", session?.customerId],
    queryFn: () => customerRepository.findSelf(session!.customerId, session!.sessionToken),
    enabled: !!session,
  });
  const { data: orders } = useQuery({
    queryKey: ["orders", "customer", session?.customerId],
    queryFn: () => orderRepository.listByCustomer(session!.customerId, session!.sessionToken),
    enabled: !!session,
  });

  const [name, setName] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");

  useEffect(() => {
    if (customer) {
      setName(customer.name);
      setWhatsapp(customer.whatsapp);
      setAvatarUrl(customer.avatarUrl ?? "");
    }
  }, [customer]);

  const save = useMutation({
    mutationFn: () =>
      customerRepository.updateSelf(session!.customerId, session!.sessionToken, {
        name,
        whatsapp,
        avatarUrl: avatarUrl || null,
      }),
    onSuccess: () => {
      toast.success("Perfil atualizado");
      qc.invalidateQueries({ queryKey: ["customer-self"] });
    },
  });

  useEffect(() => {
    if (typeof window !== "undefined" && !session) {
      navigate({ to: "/c/$companySlug", params: { companySlug } });
    }
  }, [session, companySlug, navigate]);

  if (!session) return null;

  return (
    <div className="space-y-6 p-4">
      <div className="flex items-center gap-4">
        <div className="size-16 overflow-hidden rounded-full bg-accent">
          {avatarUrl && <img src={avatarUrl} alt="" className="size-full object-cover" />}
        </div>
        <div>
          <div className="font-semibold">{customer?.name}</div>
          <div className="text-xs text-muted-foreground">
            {customer?.visitCount} visita{(customer?.visitCount ?? 0) > 1 ? "s" : ""}
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <div>
          <Label>Nome</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
        </div>
        <div>
          <Label>WhatsApp</Label>
          <Input value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} maxLength={20} />
        </div>
        <div>
          <Label>Avatar</Label>
          <ImageUpload
            value={avatarUrl}
            onChange={(url) => setAvatarUrl(url)}
            folder={`avatars/${session.customerId}`}
          />
        </div>
        <Button onClick={() => save.mutate()} disabled={save.isPending}>
          Salvar
        </Button>
      </div>

      <div>
        <h2 className="mb-2 font-semibold">Seus últimos pedidos</h2>
        {orders?.length === 0 && (
          <p className="text-sm text-muted-foreground">Nenhum pedido ainda.</p>
        )}
        <div className="space-y-2">
          {orders?.map((o) => (
            <div key={o.id} className="rounded-xl border p-3">
              <div className="flex justify-between text-sm">
                <span>{relativeTime(o.createdAt)}</span>
                <span className="font-semibold">{formatBRL(o.total)}</span>
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                {o.items.map((i) => `${i.quantity}× ${i.productName}`).join(", ")}
              </div>
              <span
                className={`mt-2 inline-block rounded-full px-2 py-0.5 text-xs ${
                  o.status === "received" ? "bg-accent text-accent-foreground" : "bg-muted"
                }`}
              >
                {o.status === "received" ? "Recebido" : "Concluído"}
              </span>
            </div>
          ))}
        </div>
      </div>

      <Button
        variant="ghost"
        className="w-full text-destructive"
        onClick={() => {
          clearSession();
          navigate({ to: "/c/$companySlug", params: { companySlug } });
        }}
      >
        Sair
      </Button>
    </div>
  );
}
