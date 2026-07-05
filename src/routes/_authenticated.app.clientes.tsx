import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { customerRepository, orderRepository, checkinRepository } from "@/repositories";
import { useState } from "react";
import { formatBRL, relativeTime } from "@/lib/format";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/app/clientes")({
  component: CustomersPage,
});

function CustomersPage() {
  const { data: companyId } = useQuery({
    queryKey: ["my-company-id"],
    queryFn: async () => {
      const { data } = await supabase.from("user_roles").select("company_id").limit(1).maybeSingle();
      return data?.company_id as string | undefined;
    },
  });
  const [q, setQ] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data: customers } = useQuery({
    queryKey: ["customers", companyId],
    queryFn: () => customerRepository.listByCompany(companyId!),
    enabled: !!companyId,
  });

  const filtered = customers?.filter(
    (c) => c.name.toLowerCase().includes(q.toLowerCase()) || c.whatsapp.includes(q),
  );

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Clientes</h1>
      <Input placeholder="Buscar por nome ou WhatsApp" value={q} onChange={(e) => setQ(e.target.value)} />

      <div className="grid gap-4 lg:grid-cols-[1fr_1.5fr]">
        <div className="rounded-xl border bg-card divide-y">
          {filtered?.length === 0 && (
            <p className="p-6 text-sm text-muted-foreground">Nenhum cliente ainda.</p>
          )}
          {filtered?.map((c) => (
            <button
              key={c.id}
              onClick={() => setSelectedId(c.id)}
              className={`flex w-full items-center justify-between p-3 text-left hover:bg-muted ${
                selectedId === c.id ? "bg-accent" : ""
              }`}
            >
              <div>
                <div className="text-sm font-medium">{c.name}</div>
                <div className="text-xs text-muted-foreground">{c.whatsapp}</div>
              </div>
              <div className="text-right">
                <div className="text-xs text-muted-foreground">{c.visitCount} visitas</div>
                <div className="text-[11px] text-muted-foreground">
                  {relativeTime(c.lastVisitAt)}
                </div>
              </div>
            </button>
          ))}
        </div>

        {selectedId ? (
          <CustomerDetail id={selectedId} />
        ) : (
          <div className="hidden rounded-xl border bg-card p-6 text-sm text-muted-foreground lg:block">
            Selecione um cliente para ver o perfil.
          </div>
        )}
      </div>
    </div>
  );
}

function CustomerDetail({ id }: { id: string }) {
  const { data: c } = useQuery({
    queryKey: ["customer", id],
    queryFn: () => customerRepository.findById(id),
  });
  const { data: orders } = useQuery({
    queryKey: ["orders", "customer", id],
    queryFn: () => orderRepository.listByCustomer(id),
  });
  const { data: checkins } = useQuery({
    queryKey: ["checkins", "customer", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("checkins")
        .select("*")
        .eq("customer_id", id)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  if (!c) return <div className="rounded-xl border bg-card p-6">Carregando…</div>;

  return (
    <div className="rounded-xl border bg-card p-6">
      <h2 className="text-xl font-bold">{c.name}</h2>
      <p className="text-sm text-muted-foreground">{c.whatsapp}</p>

      <div className="mt-4 grid grid-cols-3 gap-3 text-center">
        <div className="rounded-lg bg-muted p-3">
          <div className="text-2xl font-bold">{c.visitCount}</div>
          <div className="text-[10px] uppercase text-muted-foreground">Visitas</div>
        </div>
        <div className="rounded-lg bg-muted p-3">
          <div className="text-2xl font-bold">{orders?.length ?? 0}</div>
          <div className="text-[10px] uppercase text-muted-foreground">Pedidos</div>
        </div>
        <div className="rounded-lg bg-muted p-3">
          <div className="text-xs font-medium">{relativeTime(c.lastVisitAt)}</div>
          <div className="text-[10px] uppercase text-muted-foreground">Última visita</div>
        </div>
      </div>

      <div className="mt-6">
        <h3 className="mb-2 text-sm font-semibold">Últimos check-ins</h3>
        <ul className="space-y-1 text-sm">
          {checkins?.slice(0, 8).map((k: any) => (
            <li key={k.id} className="flex justify-between">
              <span className="capitalize">{k.context}</span>
              <span className="text-muted-foreground">{relativeTime(k.created_at)}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-6">
        <h3 className="mb-2 text-sm font-semibold">Pedidos</h3>
        <ul className="space-y-2">
          {orders?.map((o) => (
            <li key={o.id} className="rounded-lg border p-2 text-sm">
              <div className="flex justify-between">
                <span className="font-medium">{formatBRL(o.total)}</span>
                <span className="text-xs text-muted-foreground">{relativeTime(o.createdAt)}</span>
              </div>
              <div className="text-xs text-muted-foreground">
                {o.items.map((i) => `${i.quantity}× ${i.productName}`).join(", ")}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
