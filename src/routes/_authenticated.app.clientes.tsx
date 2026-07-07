import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { customerRepository, orderRepository, checkinRepository, crmRepository } from "@/repositories";
import type { CustomerInsights, TimelineEvent } from "@/repositories/types";
import { useState } from "react";
import { formatBRL, relativeTime } from "@/lib/format";
import { Input } from "@/components/ui/input";
import { Heart, ThumbsDown, MessageCircle, ShoppingCart, ShoppingBag, Calendar, Clock, Users, Star } from "lucide-react";

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
  const { data: insights } = useQuery({
    queryKey: ["customer-insights", id],
    queryFn: () => crmRepository.getCustomerInsights(id),
  });

  if (!c) return <div className="rounded-xl border bg-card p-6">Carregando…</div>;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="rounded-xl border bg-card p-6">
        <h2 className="text-xl font-bold">{c.name}</h2>
        <p className="text-sm text-muted-foreground">{c.whatsapp}</p>

        <div className="mt-4 grid grid-cols-4 gap-2 text-center">
          <StatBox value={insights?.totalVisits ?? c.visitCount} label="Visitas" />
          <StatBox value={insights?.totalOrders ?? 0} label="Pedidos" />
          <StatBox value={formatBRL(insights?.totalSpent ?? 0)} label="Gasto total" />
          <StatBox value={formatBRL(insights?.avgOrderValue ?? 0)} label="Ticket médio" />
        </div>
      </div>

      {insights && <CustomerInsightsPanel insights={insights} />}
    </div>
  );
}

function StatBox({ value, label }: { value: string | number; label: string }) {
  return (
    <div className="rounded-lg bg-muted p-2">
      <div className="text-sm font-bold">{value}</div>
      <div className="text-[10px] uppercase text-muted-foreground">{label}</div>
    </div>
  );
}

function CustomerInsightsPanel({ insights }: { insights: CustomerInsights }) {
  return (
    <>
      {/* Produtos comprados */}
      {insights.purchasedProducts.length > 0 && (
        <Section title="Produtos comprados" icon={ShoppingCart}>
          <ProductList products={insights.purchasedProducts} />
        </Section>
      )}

      {/* Produtos que o cliente amei */}
      {insights.lovedProducts.length > 0 && (
        <Section title="Produtos que amou" icon={Heart}>
          <ProductList products={insights.lovedProducts} />
        </Section>
      )}

      {/* Produtos que não gostou */}
      {insights.dislikedProducts.length > 0 && (
        <Section title="Produtos que não gostou" icon={ThumbsDown}>
          <ProductList products={insights.dislikedProducts} />
        </Section>
      )}

      {/* Produtos curtidos */}
      {insights.likedProducts.length > 0 && (
        <Section title="Produtos curtidos" icon={Star}>
          <ProductList products={insights.likedProducts} />
        </Section>
      )}

      {/* Contextos de visita */}
      {insights.visitContexts.length > 0 && (
        <Section title="Como costuma visitar" icon={Users}>
          <div className="flex flex-wrap gap-2">
            {insights.visitContexts.map((vc) => (
              <span key={vc.context} className="rounded-full bg-accent px-3 py-1 text-xs capitalize">
                {vc.context} ({vc.count})
              </span>
            ))}
          </div>
        </Section>
      )}

      {/* Timeline */}
      {insights.timeline.length > 0 && (
        <Section title="Linha do tempo" icon={Calendar}>
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {insights.timeline.slice(0, 50).map((ev) => (
              <TimelineItem key={ev.id} event={ev} />
            ))}
          </div>
        </Section>
      )}
    </>
  );
}

function Section({ title, icon: Icon, children }: { title: string; icon: any; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
        <Icon className="size-4 text-primary" />
        {title}
      </h3>
      {children}
    </div>
  );
}

function ProductList({ products }: { products: { name: string; count: number; price?: number }[] }) {
  return (
    <ul className="space-y-1">
      {products.map((p) => (
        <li key={p.name} className="flex justify-between text-sm">
          <span>{p.name}</span>
          <span className="text-muted-foreground">
            {p.count > 1 ? `${p.count}x` : ""}
            {p.price != null && p.price > 0 ? ` ${formatBRL(p.price)}` : ""}
          </span>
        </li>
      ))}
    </ul>
  );
}

function TimelineItem({ event }: { event: TimelineEvent }) {
  const iconMap: Record<string, any> = {
    checkin: Users,
    order: ShoppingBag,
    reaction_love: Heart,
    reaction_dislike: ThumbsDown,
    comment: MessageCircle,
    like: Star,
  };
  const Icon = iconMap[event.type] ?? Clock;

  return (
    <div className="flex items-start gap-2 text-sm">
      <div className="mt-0.5">
        <Icon className="size-3.5 text-muted-foreground" />
      </div>
      <div className="flex-1">
        <p className="text-xs">{event.description}</p>
        <p className="text-[11px] text-muted-foreground">{relativeTime(event.createdAt)}</p>
      </div>
    </div>
  );
}
