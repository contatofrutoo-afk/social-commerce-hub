import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  tableRepository,
  checkinRepository,
  orderRepository,
  customerRepository,
} from "@/repositories";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { relativeTime, formatBRL } from "@/lib/format";
import { User, Heart, Users, Home } from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/atendimento")({
  component: ServicePage,
});

const contextIcons: Record<string, any> = {
  sozinho: User,
  casal: Heart,
  amigos: Users,
  familia: Home,
};

function ServicePage() {
  const { data: companyId } = useQuery({
    queryKey: ["my-company-id"],
    queryFn: async () => {
      const { data } = await supabase.from("user_roles").select("company_id").limit(1).maybeSingle();
      return data?.company_id as string | undefined;
    },
  });

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Atendimento</h1>
      <Tabs defaultValue="mesas">
        <TabsList>
          <TabsTrigger value="mesas">Mesas</TabsTrigger>
          <TabsTrigger value="loja">Loja</TabsTrigger>
        </TabsList>
        <TabsContent value="mesas">
          {companyId && <MesasView companyId={companyId} />}
        </TabsContent>
        <TabsContent value="loja">
          {companyId && <LojaView companyId={companyId} />}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function MesasView({ companyId }: { companyId: string }) {
  const { data: tables } = useQuery({
    queryKey: ["tables", companyId],
    queryFn: () => tableRepository.listByCompany(companyId),
  });
  const { data: present } = useQuery({
    queryKey: ["present", companyId],
    queryFn: () => checkinRepository.listPresentByCompany(companyId),
    refetchInterval: 15000,
  });

  return (
    <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {tables?.map((t) => {
        const occupation = present?.find((c: any) => c.table_id === t.id);
        const Icon = occupation ? contextIcons[occupation.context] : null;
        return (
          <div
            key={t.id}
            className={`rounded-xl border p-4 ${occupation ? "bg-accent" : "bg-card"}`}
          >
            <div className="flex items-center justify-between">
              <div className="text-lg font-bold">{t.label}</div>
              {occupation && Icon && <Icon className="size-5 text-primary" />}
            </div>
            {occupation ? (
              <div className="mt-2">
                <div className="text-sm font-medium">{occupation.customer?.name}</div>
                <div className="text-xs capitalize text-muted-foreground">
                  {occupation.context} · {relativeTime(occupation.created_at)}
                </div>
              </div>
            ) : (
              <p className="mt-2 text-xs text-muted-foreground">Livre</p>
            )}
          </div>
        );
      })}
    </div>
  );
}

function LojaView({ companyId }: { companyId: string }) {
  const [selectedCustomer, setSelectedCustomer] = useState<string | null>(null);
  const { data: present } = useQuery({
    queryKey: ["present", companyId],
    queryFn: () => checkinRepository.listPresentByCompany(companyId),
    refetchInterval: 15000,
  });

  return (
    <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_1.5fr]">
      <div className="rounded-xl border bg-card divide-y">
        {present?.length === 0 && (
          <p className="p-6 text-sm text-muted-foreground">Ninguém no local agora.</p>
        )}
        {present?.map((c: any) => {
          const Icon = contextIcons[c.context];
          return (
            <button
              key={c.id}
              onClick={() => setSelectedCustomer(c.customer_id)}
              className={`flex w-full items-center gap-3 p-3 text-left hover:bg-muted ${
                selectedCustomer === c.customer_id ? "bg-accent" : ""
              }`}
            >
              <div className="grid size-10 place-items-center rounded-full bg-primary text-primary-foreground">
                <Icon className="size-4" />
              </div>
              <div className="flex-1">
                <div className="text-sm font-medium">{c.customer?.name}</div>
                <div className="text-xs text-muted-foreground">
                  {c.context} · {relativeTime(c.created_at)}
                </div>
              </div>
            </button>
          );
        })}
      </div>
      {selectedCustomer ? (
        <CustomerServicePanel id={selectedCustomer} />
      ) : (
        <div className="hidden rounded-xl border bg-card p-6 text-sm text-muted-foreground lg:block">
          Selecione um cliente presente.
        </div>
      )}
    </div>
  );
}

function CustomerServicePanel({ id }: { id: string }) {
  const { data: c } = useQuery({
    queryKey: ["customer", id],
    queryFn: () => customerRepository.findById(id),
  });
  const { data: orders } = useQuery({
    queryKey: ["orders", "customer", id],
    queryFn: () => orderRepository.listByCustomer(id),
  });

  if (!c) return <div className="rounded-xl border bg-card p-6">Carregando…</div>;

  const suggestion =
    c.visitCount === 1
      ? "Primeira visita — dê boas-vindas caprichadas."
      : c.visitCount < 5
      ? "Cliente recorrente — reconheça, ofereça algo especial."
      : "Cliente fiel — trate como VIP.";

  return (
    <div className="rounded-xl border bg-card p-6">
      <h2 className="text-xl font-bold">{c.name}</h2>
      <p className="text-sm text-muted-foreground">
        {c.visitCount} visita{c.visitCount > 1 ? "s" : ""}
      </p>
      <div className="mt-4 rounded-lg bg-accent p-3 text-sm text-accent-foreground">
        💡 {suggestion}
      </div>

      <h3 className="mt-6 mb-2 text-sm font-semibold">Últimos pedidos</h3>
      <ul className="space-y-2">
        {orders?.slice(0, 5).map((o) => (
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
        {orders?.length === 0 && <p className="text-xs text-muted-foreground">Nenhum pedido.</p>}
      </ul>
    </div>
  );
}
