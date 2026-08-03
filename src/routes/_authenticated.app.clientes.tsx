import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { customerRepository, crmRepository, checkinRepository } from "@/repositories";
import type { CustomerInsights, TimelineEvent, ProductInteraction } from "@/repositories/types";
import { useEffect, useState } from "react";
import { formatBRL, relativeTime } from "@/lib/format";
import { optimizedImageUrl } from "@/lib/image-url";
import { Input } from "@/components/ui/input";
import {
  User,
  Heart,
  ThumbsDown,
  MessageCircle,
  ShoppingCart,
  ShoppingBag,
  Calendar,
  Clock,
  Users,
  Star,
  Activity,
  TrendingUp,
  Lightbulb,
  Eye,
  Hourglass,
  Crown,
  MousePointerClick,
  CheckCircle2,
  BadgeCheck,
  Edit3,
  Gift,
  LogOut,
  Trash2,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/clientes")({
  component: CustomersPage,
  head: () => ({ meta: [{ title: "Clientes — WEAZE" }] }),
});

const PRESENCE_WINDOW_MS = 8 * 60 * 60 * 1000;

function isPresent(lastVisitAt: string): boolean {
  return Date.now() - new Date(lastVisitAt).getTime() < PRESENCE_WINDOW_MS;
}

const statusConfig: Record<string, { label: string; class: string }> = {
  new: { label: "Novo", class: "bg-blue-500/10 text-blue-600 border-blue-500/30" },
  frequent: { label: "Recorrente", class: "bg-green-500/10 text-green-600 border-green-500/30" },
  vip: { label: "VIP", class: "bg-amber-500/10 text-amber-600 border-amber-500/30" },
  at_risk: { label: "Inativo", class: "bg-yellow-500/10 text-yellow-600 border-yellow-500/30" },
  inactive: { label: "Inativo", class: "bg-red-500/10 text-red-600 border-red-500/30" },
};

const ANON_CONTACT_PREFIXES = ["anon-", "verif-", "removido-"];

/** WhatsApp real (informado pelo cliente no checkout/perfil) vs. identificador
 *  anônimo gerado pela plataforma na entrada silenciosa via QR/link. */
function isInformedContact(whatsapp: string): boolean {
  return !!whatsapp && !ANON_CONTACT_PREFIXES.some((p) => whatsapp.toLowerCase().startsWith(p));
}

function cap(s: string | null | undefined): string {
  if (!s) return "—";
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function fmtDuration(min: number | null): string {
  if (min == null) return "—";
  if (min < 60) return `${min}min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h}h${m}min` : `${h}h`;
}

// ======= MAIN PAGE =======

function CustomersPage() {
  const queryClient = useQueryClient();
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
  const [q, setQ] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const { data: customers } = useQuery({
    queryKey: ["customers", companyId],
    queryFn: () => customerRepository.listByCompany(companyId!),
    enabled: !!companyId,
  });

  const { data: present } = useQuery({
    queryKey: ["present", companyId],
    queryFn: () => checkinRepository.listPresentByCompany(companyId!),
    enabled: !!companyId,
    refetchInterval: 15000,
  });

  // Realtime: quando o cliente edita o próprio perfil (nome/avatar) no app B2C,
  // atualiza a lista de clientes e a presença automaticamente.
  useEffect(() => {
    if (!companyId) return;
    const channel = supabase
      .channel(`clientes-customers-${companyId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "customers", filter: `company_id=eq.${companyId}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ["customers", companyId] });
          queryClient.invalidateQueries({ queryKey: ["present", companyId] });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [companyId, queryClient]);

  const presentCustomerIds = new Set((present ?? []).map((p: any) => p.customer_id));

  const deleteMutation = useMutation({
    mutationFn: (id: string) => customerRepository.delete(id),
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: ["customers", companyId] });
      setSelectedId((prev) => (prev === id ? null : prev));
      setDeletingId(null);
    },
    onError: () => {
      setDeletingId(null);
    },
  });

  const checkoutMutation = useMutation({
    mutationFn: (customerId: string) => checkinRepository.checkout(customerId, companyId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["present", companyId] });
      queryClient.invalidateQueries({ queryKey: ["customers", companyId] });
    },
    onError: (err: any) => {
      console.error("[checkout]", err);
      alert("Erro ao fazer checkout: " + (err?.message ?? "tente novamente"));
    },
  });

  const handleDelete = (e: React.MouseEvent, id: string, name: string) => {
    e.stopPropagation();
    if (window.confirm(`Excluir cliente "${name}"? Esta ação não pode ser desfeita.`)) {
      setDeletingId(id);
      deleteMutation.mutate(id);
    }
  };

  const filtered = customers?.filter(
    (c) => c.name.toLowerCase().includes(q.toLowerCase()) || c.whatsapp.includes(q),
  );

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Clientes</h1>
      <Input
        placeholder="Buscar por nome ou WhatsApp"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_1.5fr]">
        <div className="rounded-xl border bg-card divide-y">
          {filtered?.length === 0 && (
            <p className="p-6 text-sm text-muted-foreground">Nenhum cliente ainda.</p>
          )}
          {filtered?.map((c) => (
            <div
              key={c.id}
              className={`group relative flex items-center justify-between p-3 text-left transition-colors ${
                selectedId === c.id ? "bg-accent" : ""
              }`}
            >
              <button
                onClick={() => setSelectedId(c.id)}
                className="flex flex-1 items-center gap-2 min-w-0"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div className="relative shrink-0">
                    {c.avatarUrl ? (
                      <img src={optimizedImageUrl(c.avatarUrl, 32)} alt="" loading="lazy" decoding="async" className="size-8 rounded-full object-cover" />
                    ) : (
                      <div className="grid size-8 place-items-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
                        {c.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <span
                      className={`absolute -bottom-0.5 -right-0.5 size-3 rounded-full border-2 border-background ${
                        presentCustomerIds.has(c.id) ? "bg-green-500" : "bg-gray-400"
                      }`}
                    />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{c.name}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {isInformedContact(c.whatsapp) ? c.whatsapp : "WhatsApp não informado"}
                    </div>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-xs text-muted-foreground">{c.visitCount} visitas</div>
                  <div className="text-[11px] text-muted-foreground">
                    {relativeTime(c.lastVisitAt)}
                  </div>
                </div>
              </button>
              {presentCustomerIds.has(c.id) && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (window.confirm(`Fazer checkout de "${c.name}"? O cliente será desconectado.`)) {
                      checkoutMutation.mutate(c.id);
                    }
                  }}
                  disabled={checkoutMutation.isPending}
                  className="ml-1 rounded-lg p-1.5 text-muted-foreground opacity-0 transition-all hover:bg-primary/10 hover:text-primary group-hover:opacity-100 disabled:opacity-50"
                  title="Checkout — desconectar cliente"
                >
                  <LogOut className="size-4" />
                </button>
              )}
              <button
                onClick={(e) => handleDelete(e, c.id, c.name)}
                disabled={deletingId === c.id}
                className="ml-2 rounded-lg p-1.5 text-muted-foreground opacity-0 transition-all hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100 disabled:opacity-50"
                title="Excluir cliente"
              >
                <Trash2 className="size-4" />
              </button>
            </div>
          ))}
        </div>

        {selectedId ? (
          <CustomerDetail
            id={selectedId}
            companyId={companyId}
            isPresent={presentCustomerIds.has(selectedId)}
          />
        ) : (
          <div className="hidden rounded-xl border bg-card p-6 text-sm text-muted-foreground lg:block">
            Selecione um cliente para ver o perfil completo.
          </div>
        )}
      </div>
    </div>
  );
}

// ======= CUSTOMER DETAIL =======

function CustomerDetail({
  id,
  companyId,
  isPresent,
}: {
  id: string;
  companyId?: string;
  isPresent?: boolean;
}) {
  const { data: insights, isError } = useQuery({
    queryKey: ["customer-insights", id],
    queryFn: () => crmRepository.getCustomerInsights(id, companyId),
  });

  if (isError)
    return (
      <div className="rounded-xl border bg-card p-6 text-sm text-muted-foreground">
        Erro ao carregar perfil. Tente novamente.
      </div>
    );
  if (!insights) return <div className="rounded-xl border bg-card p-6">Carregando…</div>;

  return (
    <div className="space-y-4">
      {/* PERFIL */}
      <PerfilBlock insights={insights} isPresent={!!isPresent} />

      {/* RESUMO */}
      <ResumoBlock insights={insights} />

      {/* COMPORTAMENTO */}
      <ComportamentoBlock insights={insights} />

      {/* SUGESTÃO INTELIGENTE (apenas dados realmente coletados) */}
      <SugestaoInteligente insights={insights} />

      {/* HISTÓRICO DE ENTRADA E SAÍDA */}
      {insights.visitHistory.length > 0 && (
        <Section title="Histórico de entrada e saída" icon={Clock}>
          <VisitHistoryList entries={insights.visitHistory} />
        </Section>
      )}

      {/* LINHA DO TEMPO */}
      {insights.timeline.length > 0 && (
        <Section title="Linha do tempo" icon={Calendar}>
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {insights.timeline.slice(0, 50).map((ev) => (
              <TimelineItem key={ev.id} event={ev} />
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}

// ======= BLOCOS =======

function PerfilBlock({
  insights,
  isPresent,
}: {
  insights: CustomerInsights;
  isPresent: boolean;
}) {
  const status = statusConfig[insights.classification] ?? statusConfig.new;

  return (
    <div className="rounded-xl border bg-card p-5">
      <div className="flex items-start gap-4">
        {insights.avatarUrl ? (
          <img
            src={optimizedImageUrl(insights.avatarUrl, 56)}
            alt=""
            loading="lazy"
            decoding="async"
            className="size-14 rounded-full object-cover"
          />
        ) : (
          <div className="grid size-14 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground text-xl font-bold">
            {(insights.name || "V").charAt(0).toUpperCase()}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-xl font-bold">{insights.name || "Visitante"}</h2>
            <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${status.class}`}>
              {status.label}
            </span>
            {isPresent && (
              <span className="flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-600">
                <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Presente agora
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            {isInformedContact(insights.whatsapp)
              ? insights.whatsapp
              : "WhatsApp não informado"}
          </p>
          <p className="text-[11px] text-muted-foreground">
            Cliente desde {new Date(insights.customerSince).toLocaleDateString("pt-BR")}
          </p>
        </div>
      </div>
    </div>
  );
}

function ResumoBlock({ insights }: { insights: CustomerInsights }) {
  return (
    <Section title="Resumo" icon={Star}>
      <div className="grid grid-cols-2 gap-1.5 text-xs sm:grid-cols-3">
        <InfoTile icon={Users} label="Visitas" value={String(insights.totalVisits)} />
        <InfoTile icon={ShoppingBag} label="Pedidos" value={String(insights.totalOrders)} />
        <InfoTile icon={TrendingUp} label="Total gasto" value={formatBRL(insights.totalSpent)} />
        <InfoTile icon={Star} label="Ticket médio" value={formatBRL(insights.avgOrderValue)} />
        <InfoTile
          icon={Calendar}
          label="Última compra"
          value={insights.lastOrder ? relativeTime(insights.lastOrder) : "—"}
        />
        <InfoTile
          icon={Crown}
          label="Maior compra"
          value={formatBRL(insights.purchases.biggestPurchase)}
        />
      </div>
    </Section>
  );
}

function ComportamentoBlock({ insights }: { insights: CustomerInsights }) {
  return (
    <Section title="Comportamento" icon={Activity}>
      <div className="grid grid-cols-2 gap-1.5 text-xs sm:grid-cols-3">
        <InfoTile
          icon={Clock}
          label="Horário de maior uso"
          value={
            insights.habits.preferredHour !== null
              ? `${String(insights.habits.preferredHour).padStart(2, "0")}h`
              : "—"
          }
        />
        <InfoTile
          icon={Calendar}
          label="Dia com maior frequência"
          value={cap(insights.habits.preferredDay)}
        />
        <InfoTile
          icon={Hourglass}
          label="Tempo médio de permanência"
          value={fmtDuration(insights.avgSessionDurationMinutes)}
        />
        <InfoTile
          icon={MousePointerClick}
          label="Quantidade de acessos"
          value={String(insights.totalAccesses)}
        />
        <InfoTile icon={Heart} label="Publicações curtidas" value={String(insights.loveCount)} />
        <InfoTile
          icon={MessageCircle}
          label="Publicações comentadas"
          value={String(insights.commentCount)}
        />
      </div>

      {insights.mostViewedProducts.length > 0 && (
        <div className="mt-3">
          <p className="mb-1 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
            Produtos mais visualizados
          </p>
          <ProductList products={insights.mostViewedProducts.slice(0, 5)} />
        </div>
      )}

      {insights.likedProducts.length > 0 && (
        <div className="mt-3">
          <p className="mb-1 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
            Produtos mais curtidos
          </p>
          <ProductList products={insights.likedProducts.slice(0, 5)} />
        </div>
      )}

      {insights.cartAddedProducts.length > 0 && (
        <div className="mt-3">
          <p className="mb-1 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
            Produtos adicionados à sacola
          </p>
          <ProductList products={insights.cartAddedProducts.slice(0, 5)} />
        </div>
      )}

      {insights.purchasedProducts.length > 0 && (
        <div className="mt-3">
          <p className="mb-1 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
            Produtos comprados
          </p>
          <ProductList products={insights.purchasedProducts.slice(0, 5)} />
          {insights.purchasedProducts.length > 5 && (
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              +{insights.purchasedProducts.length - 5} outros
            </p>
          )}
        </div>
      )}

      {insights.accessedCategories.length > 0 && (
        <div className="mt-3">
          <p className="mb-1 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
            Categorias mais acessadas
          </p>
          <div className="space-y-0.5">
            {insights.accessedCategories.slice(0, 4).map((fc) => (
              <div key={fc.category} className="flex justify-between text-sm">
                <span className="capitalize">{fc.category}</span>
                <span className="font-semibold text-muted-foreground">{fc.count}x</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </Section>
  );
}

function SugestaoInteligente({ insights }: { insights: CustomerInsights }) {
  const tips: string[] = [];

  if (insights.classification === "new") {
    tips.push("Cliente novo que acabou de conhecer o estabelecimento.");
  } else if (insights.classification === "vip") {
    tips.push(
      `Cliente VIP — ${insights.totalOrders} pedidos e ${formatBRL(insights.totalSpent)} em gastos.`,
    );
  } else if (insights.classification === "inactive" || insights.classification === "at_risk") {
    const days = Math.round(insights.habits.daysSinceLastVisit ?? 0);
    tips.push(`Cliente sem acessos há ${days} dias — possível oportunidade de reativação.`);
  } else if (insights.totalOrders > 0) {
    tips.push(
      `Cliente recorrente — ${insights.totalAccesses} acessos e ${insights.totalOrders} pedidos.`,
    );
  } else if (insights.totalVisits > 1) {
    tips.push("Cliente que retorna com frequência à plataforma.");
  }

  if (insights.mostViewedProducts.length > 0) {
    tips.push(`Produto de maior interesse: ${insights.mostViewedProducts[0].name}.`);
  }

  if (insights.accessedCategories.length > 0) {
    tips.push(`Categoria mais acessada: ${cap(insights.accessedCategories[0].category)}.`);
  }

  const viewedNotPurchased = insights.mostViewedProducts.filter(
    (p) => !insights.purchasedProducts.some((pp) => pp.productId === p.productId),
  );
  if (viewedNotPurchased.length > 0) {
    const names = viewedNotPurchased
      .slice(0, 2)
      .map((p) => p.name)
      .join(" e ");
    tips.push(
      `Visualizou ${names} mas ainda não comprou — possível oportunidade de conversão.`,
    );
  }

  if (insights.purchases.mostOrderedProduct) {
    tips.push(`Costuma comprar ${insights.purchases.mostOrderedProduct.name}.`);
  }

  if (insights.habits.preferredHour !== null) {
    const h = insights.habits.preferredHour;
    const period = h < 12 ? "pela manhã" : h < 18 ? "à tarde" : "à noite";
    tips.push(`Costuma acessar a plataforma ${period}, por volta das ${String(h).padStart(2, "0")}h.`);
  }

  if (insights.totalOrders > 0 && insights.lastOrder) {
    const daysSince = (Date.now() - new Date(insights.lastOrder).getTime()) / 86400000;
    if (daysSince >= 15) {
      tips.push("Última compra foi há mais de 15 dias — boa oportunidade de recompra.");
    }
  }

  if (tips.length === 0) {
    return (
      <Section title="Sugestão Inteligente" icon={Lightbulb}>
        <p className="text-sm text-muted-foreground">
          Ainda não há dados suficientes para sugestões.
        </p>
      </Section>
    );
  }

  return (
    <Section title="Sugestão Inteligente" icon={Lightbulb}>
      <ul className="space-y-1.5">
        {tips.map((t, i) => (
          <li key={i} className="flex items-start gap-2 text-sm">
            <Lightbulb className="mt-0.5 size-3.5 shrink-0 text-primary" />
            <span>{t}</span>
          </li>
        ))}
      </ul>
    </Section>
  );
}

// ======= HELPERS =======

function InfoTile({ icon: Icon, label, value }: { icon?: any; label: string; value: string }) {
  return (
    <div className="rounded-lg bg-muted p-2">
      {Icon && (
        <div className="flex items-center gap-1 text-muted-foreground">
          <Icon className="size-3" /> {label}
        </div>
      )}
      {!Icon && <div className="text-muted-foreground">{label}</div>}
      <div className="font-semibold">{value}</div>
    </div>
  );
}

function Section({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: any;
  children: React.ReactNode;
}) {
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

function ProductList({ products }: { products: ProductInteraction[] }) {
  return (
    <ul className="space-y-0.5">
      {products.map((p) => (
        <li key={p.productId} className="flex justify-between text-sm">
          <span className="truncate">{p.name}</span>
          <span className="shrink-0 text-muted-foreground">
            {p.count > 1 ? `${p.count}x` : ""}
            {p.price > 0 ? ` ${formatBRL(p.price)}` : ""}
          </span>
        </li>
      ))}
    </ul>
  );
}

function TimelineItem({ event }: { event: TimelineEvent }) {
  const iconMap: Record<string, any> = {
    checkin: User,
    logout: LogOut,
    order: ShoppingBag,
    payment_approved: CheckCircle2,
    order_done: BadgeCheck,
    view: Eye,
    cart_add: ShoppingCart,
    reaction_love: Heart,
    reaction_dislike: ThumbsDown,
    comment: MessageCircle,
    like: Star,
    wish: Gift,
    post: Edit3,
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

function VisitHistoryList({
  entries,
}: {
  entries: import("@/repositories/types").VisitHistoryEntry[];
}) {
  // Group by date (YYYY-MM-DD)
  const groups = new Map<string, typeof entries>();
  for (const e of entries) {
    const d = new Date(e.checkinAt);
    const key = d.toISOString().slice(0, 10);
    const arr = groups.get(key) ?? [];
    arr.push(e);
    groups.set(key, arr);
  }
  const sortedKeys = Array.from(groups.keys()).sort((a, b) => (a < b ? 1 : -1));
  const fmtDate = (iso: string) =>
    new Date(iso + "T00:00:00").toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      weekday: "short",
    });
  const fmtTime = (iso: string) =>
    new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const fmtDur = (min: number | null) => {
    if (min == null) return "—";
    if (min < 60) return `${min}min`;
    const h = Math.floor(min / 60);
    const m = min % 60;
    return m ? `${h}h${m}min` : `${h}h`;
  };
  return (
    <div className="space-y-3 max-h-96 overflow-y-auto">
      {sortedKeys.map((k) => {
        const dayEntries = (groups.get(k) ?? []).slice().sort(
          (a, b) => new Date(b.checkinAt).getTime() - new Date(a.checkinAt).getTime(),
        );
        return (
          <div key={k}>
            <div className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              {fmtDate(k)}
            </div>
            <div className="space-y-1.5">
              {dayEntries.map((e) => (
                <div
                  key={e.id}
                  className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border bg-muted/40 px-3 py-2 text-xs"
                >
                  <span className="flex items-center gap-1 font-medium">
                    <span className="inline-block size-1.5 rounded-full bg-emerald-500" />
                    Entrada {fmtTime(e.checkinAt)}
                  </span>
                  <span className="flex items-center gap-1 font-medium">
                    <span
                      className={`inline-block size-1.5 rounded-full ${e.checkoutAt ? "bg-rose-500" : "bg-amber-500"}`}
                    />
                    {e.checkoutAt ? `Saída ${fmtTime(e.checkoutAt)}` : "Em andamento"}
                  </span>
                  <span className="text-muted-foreground">Duração: {fmtDur(e.durationMinutes)}</span>
                  {e.tableLabel && (
                    <span className="text-muted-foreground">Mesa {e.tableLabel}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
