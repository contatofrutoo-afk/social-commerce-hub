import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  customerRepository,
  productRepository,
  orderRepository,
  checkinRepository,
  postRepository,
  dashboardRepository,
} from "@/repositories";
import { relativeTime, formatBRL } from "@/lib/format";
import { Users, ShoppingCart, Heart, Sparkles, Store, User, Home, ThumbsDown, MessageCircle, TrendingUp } from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/")({
  component: DashboardPage,
});

function useCompanyId() {
  const { data: role } = useQuery({
    queryKey: ["my-role"],
    queryFn: async () => {
      const { data } = await supabase
        .from("user_roles")
        .select("*, company:companies(*)")
        .limit(1)
        .maybeSingle();
      return data;
    },
  });
  return role?.company_id as string | undefined;
}

function DashboardPage() {
  const companyId = useCompanyId();

  const { data: customers } = useQuery({
    queryKey: ["customers", companyId],
    queryFn: () => customerRepository.listByCompany(companyId!),
    enabled: !!companyId,
  });
  const { data: orders } = useQuery({
    queryKey: ["orders", companyId],
    queryFn: () => orderRepository.listByCompany(companyId!),
    enabled: !!companyId,
  });
  const { data: present } = useQuery({
    queryKey: ["present", companyId],
    queryFn: () => checkinRepository.listPresentByCompany(companyId!),
    enabled: !!companyId,
  });
  const { data: posts } = useQuery({
    queryKey: ["feed-b2b", companyId],
    queryFn: () => postRepository.listByCompany(companyId!),
    enabled: !!companyId,
  });
  const { data: metrics } = useQuery({
    queryKey: ["dashboard-metrics", companyId],
    queryFn: () => dashboardRepository.getMetrics(companyId!),
    enabled: !!companyId,
  });

  if (!companyId) return <div>Carregando…</div>;

  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  const activeCustomers = customers?.filter((c) => now - new Date(c.lastVisitAt).getTime() < 7 * day) ?? [];
  const newCustomers = customers?.filter((c) => now - new Date(c.firstVisitAt).getTime() < 7 * day) ?? [];
  const recurringCustomers = customers?.filter((c) => c.visitCount > 1) ?? [];

  const contextCounts = (present ?? []).reduce(
    (acc: Record<string, number>, c: any) => {
      acc[c.context] = (acc[c.context] ?? 0) + 1;
      return acc;
    },
    { sozinho: 0, casal: 0, amigos: 0, familia: 0 },
  );

  const totalRevenue = orders?.reduce((s, o) => s + o.total, 0) ?? 0;

  // Últimas atividades
  const activities: { text: string; ts: string }[] = [];
  present?.slice(0, 5).forEach((c: any) =>
    activities.push({ text: `${c.customer?.name ?? "Cliente"} fez check-in (${c.context})`, ts: c.created_at }),
  );
  orders?.slice(0, 5).forEach((o) =>
    activities.push({ text: `Pedido ${formatBRL(o.total)} de ${o.customerName ?? "Cliente"}`, ts: o.createdAt }),
  );
  posts?.slice(0, 5).forEach((p) =>
    activities.push({
      text: `Nova publicação de ${p.authorType === "business" ? "estabelecimento" : (p.customerName ?? "cliente")}`,
      ts: p.createdAt,
    }),
  );
  activities.sort((a, b) => (b.ts > a.ts ? 1 : -1));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Users} label="Clientes" value={customers?.length ?? 0} />
        <StatCard icon={Sparkles} label="Ativos (7d)" value={activeCustomers.length} />
        <StatCard icon={ShoppingCart} label="Pedidos" value={orders?.length ?? 0} />
        <StatCard icon={Store} label="Presentes agora" value={present?.length ?? 0} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={TrendingUp} label="Receita total" value={formatBRL(totalRevenue)} />
        <StatCard icon={Heart} label="Curtiram" value={metrics?.topLikedProducts.reduce((s, p) => s + p.count, 0) ?? 0} />
        <StatCard icon={MessageCircle} label="Comentários" value={metrics?.topCommentedPosts.reduce((s, p) => s + p.count, 0) ?? 0} />
        <StatCard icon={Users} label="Converteram" value={`${metrics?.conversionRates.reactionToOrderRate.toFixed(0) ?? 0}%`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Presentes agora">
          <div className="grid grid-cols-4 gap-2">
            <ContextTile icon={User} label="Sozinho" value={contextCounts.sozinho} />
            <ContextTile icon={Heart} label="Casal" value={contextCounts.casal} />
            <ContextTile icon={Users} label="Amigos" value={contextCounts.amigos} />
            <ContextTile icon={Home} label="Família" value={contextCounts.familia} />
          </div>
        </Card>
        <Card title="Clientes">
          <div className="grid grid-cols-2 gap-2">
            <ContextTile icon={Sparkles} label="Novos (7d)" value={newCustomers.length} />
            <ContextTile icon={Users} label="Recorrentes" value={recurringCustomers.length} />
          </div>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {metrics && (
          <>
            <Card title="Conversão">
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span>Clientes que reagiram</span>
                  <span className="font-semibold">{metrics.conversionRates.customersWhoReacted}</span>
                </div>
                <div className="flex justify-between">
                  <span>Clientes que pediram</span>
                  <span className="font-semibold">{metrics.conversionRates.customersWhoOrdered}</span>
                </div>
                <div className="flex justify-between">
                  <span>Reagiram e pediram</span>
                  <span className="font-semibold">{metrics.conversionRates.reactedThenOrdered}</span>
                </div>
                <div className="flex justify-between border-t pt-2">
                  <span>Taxa reação → pedido</span>
                  <span className="font-semibold text-primary">{metrics.conversionRates.reactionToOrderRate.toFixed(1)}%</span>
                </div>
                <div className="flex justify-between">
                  <span>Taxa de conclusão</span>
                  <span className="font-semibold text-primary">{metrics.conversionRates.orderCompletionRate.toFixed(1)}%</span>
                </div>
              </div>
            </Card>

            <Card title="Clientes mais engajados">
              {metrics.mostEngagedCustomers.length === 0 && (
                <p className="text-sm text-muted-foreground">Sem dados ainda.</p>
              )}
              <ul className="space-y-2">
                {metrics.mostEngagedCustomers.slice(0, 5).map((c) => (
                  <li key={c.customerId} className="flex justify-between text-sm">
                    <span className="truncate">{c.name}</span>
                    <span className="text-muted-foreground">
                      {c.reactionCount > 0 && `${c.reactionCount} reações`}
                      {c.orderCount > 0 && (c.reactionCount > 0 ? " · " : "") + `${c.orderCount} pedidos`}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          </>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {metrics && (
          <>
            <Card title="Produtos mais curtidos">
              {metrics.topLikedProducts.length === 0 && <p className="text-sm text-muted-foreground">Sem dados ainda.</p>}
              <ul className="space-y-1">
                {metrics.topLikedProducts.slice(0, 5).map((p) => (
                  <li key={p.productId} className="flex justify-between text-sm">
                    <span>{p.name}</span>
                    <span className="font-semibold">{p.count}</span>
                  </li>
                ))}
              </ul>
            </Card>

            <Card title="Produtos mais pedidos">
              {metrics.topOrderedProducts.length === 0 && <p className="text-sm text-muted-foreground">Sem dados ainda.</p>}
              <ul className="space-y-1">
                {metrics.topOrderedProducts.slice(0, 5).map((p) => (
                  <li key={p.productId} className="flex justify-between text-sm">
                    <span>{p.name}</span>
                    <span className="font-semibold">{p.count} ({formatBRL(p.revenue)})</span>
                  </li>
                ))}
              </ul>
            </Card>

            <Card title="Posts mais comentados">
              {metrics.topCommentedPosts.length === 0 && <p className="text-sm text-muted-foreground">Sem dados ainda.</p>}
              <ul className="space-y-1">
                {metrics.topCommentedPosts.slice(0, 5).map((p) => (
                  <li key={p.postId} className="flex justify-between text-sm">
                    <span className="truncate">Post</span>
                    <span className="font-semibold">{p.count}</span>
                  </li>
                ))}
              </ul>
            </Card>
          </>
        )}
      </div>

      <Card title="Últimas atividades">
        <ul className="space-y-2">
          {activities.slice(0, 8).map((a, i) => (
            <li key={i} className="flex justify-between gap-2 text-sm">
              <span className="truncate">{a.text}</span>
              <span className="whitespace-nowrap text-xs text-muted-foreground">{relativeTime(a.ts)}</span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

function StatCard({ icon: Icon, label, value }: { icon: any; label: string; value: string | number }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{label}</span>
        <Icon className="size-4 text-primary" />
      </div>
      <div className="mt-2 text-2xl font-bold">{value}</div>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <h3 className="mb-3 text-sm font-semibold">{title}</h3>
      {children}
    </div>
  );
}

function ContextTile({ icon: Icon, label, value }: { icon: any; label: string; value: number }) {
  return (
    <div className="rounded-lg bg-muted p-3 text-center">
      <Icon className="mx-auto size-4 text-primary" />
      <div className="mt-1 text-lg font-bold">{value}</div>
      <div className="text-[10px] uppercase text-muted-foreground">{label}</div>
    </div>
  );
}
