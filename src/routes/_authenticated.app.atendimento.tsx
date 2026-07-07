import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  tableRepository,
  checkinRepository,
  orderRepository,
  customerRepository,
  crmRepository,
} from "@/repositories";
import type { CustomerServiceProfile } from "@/repositories/types";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { relativeTime, formatBRL } from "@/lib/format";
import {
  User, Heart, Users, Home, Clock, Calendar, ShoppingCart, Sparkles,
  TrendingUp, Star, Lightbulb, RefreshCw,
} from "lucide-react";

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
        const occupations = present?.filter((c: any) => c.table_id === t.id) ?? [];
        return (
          <div
            key={t.id}
            className={`rounded-xl border p-4 ${occupations.length > 0 ? "bg-accent" : "bg-card"}`}
          >
            <div className="flex items-center justify-between">
              <div className="text-lg font-bold">{t.label}</div>
              {occupations.length > 0 && (
                <span className="text-xs text-muted-foreground">
                  {occupations.length} pessoa{occupations.length > 1 ? "s" : ""}
                </span>
              )}
            </div>
            {occupations.length > 0 ? (
              <div className="mt-2 space-y-2">
                {occupations.map((o: any) => {
                  const Icon = contextIcons[o.context];
                  return (
                    <div key={o.id} className="flex items-center gap-2">
                      {Icon && <Icon className="size-4 shrink-0 text-primary" />}
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium truncate">{o.customer?.name}</div>
                        <div className="text-xs capitalize text-muted-foreground">
                          {o.context} · {relativeTime(o.created_at)}
                        </div>
                      </div>
                    </div>
                  );
                })}
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
  const { data: profile } = useQuery({
    queryKey: ["customer-service-profile", id],
    queryFn: () => crmRepository.getCustomerServiceProfile(id),
  });

  if (!profile) return <div className="rounded-xl border bg-card p-6">Carregando…</div>;

  return (
    <div className="rounded-xl border bg-card p-6">
      {/* Header */}
      <h2 className="text-xl font-bold">{profile.name}</h2>
      <div className="mt-1 flex flex-wrap gap-2 text-xs text-muted-foreground">
        <span className="flex items-center gap-0.5"><RefreshCw className="size-3" /> {profile.visitCount} visita{profile.visitCount > 1 ? "s" : ""}</span>
        {profile.currentContext && (
          <span className="flex items-center gap-0.5 capitalize">
            {(() => {
              const I = contextIcons[profile.currentContext!] ?? User;
              return <I className="size-3" />;
            })()}
            {profile.currentContext}
          </span>
        )}
        {profile.avgSpend > 0 && (
          <span className="flex items-center gap-0.5"><TrendingUp className="size-3" /> Ticket médio {formatBRL(profile.avgSpend)}</span>
        )}
      </div>

      {/* Suggestions */}
      <div className="mt-4 space-y-1 rounded-lg bg-accent p-3 text-sm text-accent-foreground">
        <div className="flex items-center gap-1 font-medium mb-1">
          <Lightbulb className="size-4" /> Sugestões
        </div>
        {profile.suggestions.map((s, i) => (
          <p key={i} className="text-xs">💡 {s}</p>
        ))}
      </div>

      {/* Stats grid */}
      <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-lg bg-muted p-2">
          <div className="flex items-center gap-1 text-muted-foreground"><Clock className="size-3" /> Horário preferido</div>
          <div className="font-semibold">{profile.preferredHour !== null ? `${profile.preferredHour}h` : "—"}</div>
        </div>
        <div className="rounded-lg bg-muted p-2">
          <div className="flex items-center gap-1 text-muted-foreground"><Calendar className="size-3" /> Dia preferido</div>
          <div className="font-semibold capitalize">{profile.preferredDay ?? "—"}</div>
        </div>
        <div className="rounded-lg bg-muted p-2">
          <div className="flex items-center gap-1 text-muted-foreground"><Clock className="size-3" /> Tempo entre visitas</div>
          <div className="font-semibold">{profile.avgTimeBetweenVisitsHours !== null ? `${profile.avgTimeBetweenVisitsHours.toFixed(1)}h` : "—"}</div>
        </div>
        <div className="rounded-lg bg-muted p-2">
          <div className="flex items-center gap-1 text-muted-foreground"><ShoppingCart className="size-3" /> Pedidos</div>
          <div className="font-semibold">{profile.recentOrders.length} recentes</div>
        </div>
      </div>

      {/* Favorite products */}
      {profile.favoriteProducts.length > 0 && (
        <div className="mt-4">
          <h3 className="mb-1 text-sm font-semibold flex items-center gap-1">
            <Star className="size-3 text-primary" /> Preferidos
          </h3>
          <div className="flex flex-wrap gap-1">
            {profile.favoriteProducts.map((fp) => (
              <span key={fp.id} className="rounded-full bg-muted px-2 py-0.5 text-[10px]">
                {fp.name} ({fp.count})
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Favorite categories */}
      {profile.favoriteCategories.length > 0 && (
        <div className="mt-3">
          <h3 className="mb-1 text-sm font-semibold text-muted-foreground">Categorias favoritas</h3>
          <div className="flex flex-wrap gap-1">
            {profile.favoriteCategories.map((fc) => (
              <span key={fc.category} className="rounded-full bg-muted px-2 py-0.5 text-[10px]">
                {fc.category} ({fc.count})
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Liked products (not yet ordered) */}
      {profile.likedProducts.length > 0 && (
        <div className="mt-3">
          <h3 className="mb-1 text-sm font-semibold text-muted-foreground">Curtiu mas não pediu</h3>
          <div className="flex flex-wrap gap-1">
            {profile.likedProducts.slice(0, 6).map((lp) => (
              <span key={lp.id} className="rounded-full bg-muted px-2 py-0.5 text-[10px]">{lp.name}</span>
            ))}
          </div>
        </div>
      )}

      {/* Recent orders */}
      {profile.recentOrders.length > 0 && (
        <div className="mt-4">
          <h3 className="mb-2 text-sm font-semibold">Últimos pedidos</h3>
          <ul className="space-y-2">
            {profile.recentOrders.map((o) => (
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
      )}
    </div>
  );
}
