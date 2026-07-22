import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { customerRepository, crmRepository, checkinRepository } from "@/repositories";
import type { CustomerInsights, TimelineEvent, ProductInteraction } from "@/repositories/types";
import { useState } from "react";
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
  Home,
  Sparkles,
  TrendingUp,
  RefreshCw,
  Lightbulb,
  Camera,
  Edit3,
  Target,
  Gift,
  Sun,
  Moon,
  Sunrise,
  Sunset,
  Activity,
  ArrowUp,
  ArrowDown,
  Minus,
  Trash2,
  Flame,
  LogOut,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/clientes")({
  component: CustomersPage,
  head: () => ({ meta: [{ title: "Clientes — WEAZE" }] }),
});

const PRESENCE_WINDOW_MS = 8 * 60 * 60 * 1000;

function isPresent(lastVisitAt: string): boolean {
  return Date.now() - new Date(lastVisitAt).getTime() < PRESENCE_WINDOW_MS;
}

const contextIcons: Record<string, any> = {
  sozinho: User,
  casal: Heart,
  amigos: Users,
  familia: Home,
};

const classificationConfig = {
  new: { label: "Novo", class: "bg-blue-500/10 text-blue-600 border-blue-500/30" },
  frequent: { label: "Frequente", class: "bg-green-500/10 text-green-600 border-green-500/30" },
  vip: { label: "VIP", class: "bg-amber-500/10 text-amber-600 border-amber-500/30" },
  at_risk: { label: "Risco", class: "bg-yellow-500/10 text-yellow-600 border-yellow-500/30" },
  inactive: { label: "Inativo", class: "bg-red-500/10 text-red-600 border-red-500/30" },
};

const interestConfig: Record<string, { label: string; class: string }> = {
  nenhum: { label: "Sem interação", class: "bg-muted text-muted-foreground border-border" },
  curioso: { label: "Curioso", class: "bg-blue-500/10 text-blue-600 border-blue-500/30" },
  interessado: {
    label: "Interessado",
    class: "bg-orange-500/10 text-orange-600 border-orange-500/30",
  },
  intencao: {
    label: "Intenção de compra",
    class: "bg-purple-500/10 text-purple-600 border-purple-500/30",
  },
  quente: { label: "Cliente quente", class: "bg-red-500/10 text-red-600 border-red-500/30" },
};

const classificationExplanations: Record<string, string> = {
  new: "Primeira visita, ainda sem histórico de compras.",
  frequent: "Cliente que retorna com frequência.",
  vip: "Maior gasto e recorrência — tratamento especial.",
  at_risk: "Pode estar perdendo o interesse — atenção necessária.",
  inactive: "Não visita há mais de 60 dias.",
};

const engLevelConfig = {
  muito_ativo: { label: "Muito ativo", barClass: "bg-green-500", width: "100%" },
  ativo: { label: "Ativo", barClass: "bg-blue-500", width: "70%" },
  pouco_ativo: { label: "Pouco ativo", barClass: "bg-yellow-500", width: "40%" },
  baixo_engajamento: { label: "Baixo engajamento", barClass: "bg-red-500", width: "20%" },
};

const trendConfig = {
  increasing: { icon: ArrowUp, color: "text-green-600", label: "Aumentando" },
  decreasing: { icon: ArrowDown, color: "text-orange-600", label: "Diminuindo" },
  stable: { icon: Minus, color: "text-muted-foreground", label: "Estável" },
  inactive: { icon: Minus, color: "text-red-600", label: "Inativo" },
};

const trendExplanations: Record<string, string> = {
  increasing: "Ótimo sinal! O cliente está visitando com mais frequência.",
  decreasing: "O cliente está reduzindo a frequência de visitas.",
  stable: "O cliente mantém uma frequência regular de visitas.",
  inactive: "Cliente não visita há mais de 60 dias.",
};

const trendDescriptions: Record<string, string> = {
  increasing: "A frequência de visitas está aumentando",
  decreasing: "A frequência de visitas está diminuindo",
  stable: "A frequência de visitas está estável",
  inactive: "Cliente inativo — sem visitas recentes",
};

const genderLabels: Record<string, string> = {
  mulher: "Mulher",
  homem: "Homem",
  prefiro_nao_informar: "Prefiro não informar",
};

const ageRangeLabels: Record<string, string> = {
  ate_17: "Até 17 anos",
  "18-24": "18–24 anos",
  "25-34": "25–34 anos",
  "35-44": "35–44 anos",
  "45-54": "45–54 anos",
  "55_mais": "55 anos ou mais",
};

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
                    <div className="text-xs text-muted-foreground truncate">{c.whatsapp}</div>
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
          <CustomerDetail id={selectedId} companyId={companyId} />
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

function CustomerDetail({ id, companyId }: { id: string; companyId?: string }) {
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

  const cc = classificationConfig[insights.classification];
  const ContextIcon = insights.dominantContext ? contextIcons[insights.dominantContext] : null;
  const HourIcon =
    insights.habits.preferredHour !== null
      ? insights.habits.preferredHour < 12
        ? Sunrise
        : insights.habits.preferredHour < 18
          ? Sun
          : Moon
      : Clock;

  return (
    <div className="space-y-4">
      {/* BLOCO 1: IDENTIFICAÇÃO */}
      <Bloco1 insights={insights} cc={cc} />

      <div className="grid gap-4 lg:grid-cols-2">
        {/* BLOCO 2: RELACIONAMENTO */}
        <Bloco2 insights={insights} cc={cc} />
        {/* BLOCO 3: PREFERÊNCIAS */}
        <Bloco3 insights={insights} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* BLOCO 4: COMPORTAMENTO */}
        <Bloco4 insights={insights} HourIcon={HourIcon} ContextIcon={ContextIcon} />
        {/* BLOCO 5: COMPRAS */}
        <Bloco5 insights={insights} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* BLOCO 6: ENGAJAMENTO */}
        <Bloco6 insights={insights} />
        {/* BLOCO 7: OPORTUNIDADES */}
        <Bloco7 insights={insights} />
      </div>

      {/* BLOCO 8: TENDÊNCIA */}
      <Bloco8 insights={insights} />

      {/* BLOCO 9: RESUMO INTELIGENTE */}
      <Bloco9 insights={insights} />

      {/* SUGESTÕES AUTOMÁTICAS */}
      {insights.suggestions.length > 0 && (
        <Section title="Sugestões automáticas" icon={Lightbulb}>
          <ul className="space-y-1.5">
            {insights.suggestions.map((s, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <Lightbulb className="mt-0.5 size-3.5 shrink-0 text-primary" />
                <span>{s}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {/* HISTÓRICO DE VISITAS (check-in / check-out) */}
      {insights.visitHistory.length > 0 && (
        <Section title="Histórico de visitas" icon={Clock}>
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

function Bloco1({
  insights,
  cc,
}: {
  insights: CustomerInsights;
  cc: typeof classificationConfig.new;
}) {
  return (
    <div className="rounded-xl border bg-card p-5">
      <div className="flex items-start gap-4">
        {insights.avatarUrl ? (
          <img src={optimizedImageUrl(insights.avatarUrl, 56)} alt="" loading="lazy" decoding="async" className="size-14 rounded-full object-cover" />
        ) : (
          <div className="grid size-14 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground text-xl font-bold">
            {insights.name.charAt(0).toUpperCase()}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-xl font-bold">{insights.name}</h2>
            <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${cc.class}`}>
              {cc.label}
            </span>
            {insights.interestFunnel.level !== "nenhum" && (
              <span
                className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${interestConfig[insights.interestFunnel.level]?.class ?? interestConfig.nenhum.class}`}
              >
                <Flame className="inline size-2.5 mr-0.5 -mt-0.5" /> {insights.interestFunnel.label}
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground">{insights.whatsapp}</p>
          <p className="text-[11px] text-muted-foreground">
            Cliente desde {new Date(insights.customerSince).toLocaleDateString("pt-BR")}
          </p>
          {(insights.gender || insights.ageRange) && (
            <div className="flex items-center gap-2 mt-1">
              {insights.gender && insights.gender !== "prefiro_nao_informar" && (
                <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-medium">
                  {genderLabels[insights.gender] ?? insights.gender}
                </span>
              )}
              {insights.ageRange && (
                <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-medium">
                  {ageRangeLabels[insights.ageRange] ?? insights.ageRange}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="mt-4 rounded-lg bg-accent p-3 text-sm text-accent-foreground">
        <p>{insights.executiveSummary}</p>
      </div>

      <div className="mt-4 grid grid-cols-4 gap-2 text-center">
        <StatBox icon={RefreshCw} value={insights.totalVisits} label="Visitas" />
        <StatBox icon={ShoppingCart} value={insights.totalOrders} label="Pedidos" />
        <StatBox icon={TrendingUp} value={formatBRL(insights.totalSpent)} label="Gasto total" />
        <StatBox icon={Star} value={formatBRL(insights.avgOrderValue)} label="Ticket médio" />
      </div>
    </div>
  );
}

function Bloco2({
  insights,
  cc,
}: {
  insights: CustomerInsights;
  cc: typeof classificationConfig.new;
}) {
  return (
    <Section title="Relacionamento" icon={Heart}>
      <div className="mb-3 rounded-lg bg-accent p-3 text-sm text-accent-foreground">
        {insights.habits.returnFrequencyText}
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <InfoTile
          label="Primeira visita"
          value={
            insights.firstVisit ? new Date(insights.firstVisit).toLocaleDateString("pt-BR") : "—"
          }
        />
        <InfoTile
          label="Última visita"
          value={insights.lastVisit ? relativeTime(insights.lastVisit) : "—"}
        />
        <InfoTile label="Total de visitas" value={String(insights.totalVisits)} />
        <InfoTile
          label="Última visita há"
          value={
            insights.habits.daysSinceLastVisit !== null
              ? `${Math.round(insights.habits.daysSinceLastVisit)} dias`
              : "—"
          }
        />
      </div>
      <div className="mt-2 text-[11px] text-muted-foreground">
        <span className="font-medium">{cc.label}:</span>{" "}
        {classificationExplanations[insights.classification]}
      </div>
    </Section>
  );
}

function Bloco3({ insights }: { insights: CustomerInsights }) {
  const hasData =
    insights.purchasedProducts.length > 0 ||
    insights.favoriteCategories.length > 0 ||
    insights.likedProducts.length > 0 ||
    insights.wishedProducts.length > 0 ||
    insights.lovedProducts.length > 0;

  if (!hasData) {
    return (
      <Section title="Preferências" icon={Star}>
        <p className="text-sm text-muted-foreground">
          Ainda não há dados suficientes sobre as preferências deste cliente.
        </p>
      </Section>
    );
  }

  return (
    <Section title="Preferências" icon={Star}>
      <div className="space-y-3 max-h-64 overflow-y-auto">
        {insights.purchasedProducts.length > 0 && (
          <div>
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
        {insights.favoriteCategories.length > 0 && (
          <div>
            <p className="mb-1 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
              Categorias favoritas
            </p>
            <div className="space-y-0.5">
              {insights.favoriteCategories.slice(0, 4).map((fc) => (
                <div key={fc.category} className="flex justify-between text-sm">
                  <span className="capitalize">{fc.category}</span>
                  <span className="font-semibold text-muted-foreground">{fc.count}x</span>
                </div>
              ))}
            </div>
          </div>
        )}
        {insights.likedProducts.length > 0 && (
          <div>
            <p className="mb-1 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
              Produtos curtidos
            </p>
            <ProductList products={insights.likedProducts.slice(0, 5)} />
          </div>
        )}
        {insights.wishedProducts.length > 0 && (
          <div>
            <p className="mb-1 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
              Produtos desejados
            </p>
            <ProductList products={insights.wishedProducts.slice(0, 5)} />
          </div>
        )}
        {insights.lovedProducts.length > 0 && (
          <div>
            <p className="mb-1 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
              Produtos que amou
            </p>
            <ProductList products={insights.lovedProducts} />
          </div>
        )}
        {insights.dislikedProducts.length > 0 && (
          <div>
            <p className="mb-1 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
              Produtos que não gostou
            </p>
            <ProductList products={insights.dislikedProducts} />
          </div>
        )}
      </div>
    </Section>
  );
}

function Bloco4({
  insights,
  HourIcon,
  ContextIcon,
}: {
  insights: CustomerInsights;
  HourIcon: any;
  ContextIcon: any;
}) {
  return (
    <Section title="Comportamento" icon={Activity}>
      {insights.visitContexts.length > 0 && (
        <div className="mb-3">
          <p className="mb-1.5 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
            Contexto das visitas
          </p>
          <div className="grid grid-cols-4 gap-1.5">
            {["sozinho", "casal", "amigos", "familia"].map((ctx) => {
              const found = insights.visitContexts.find((v) => v.context === ctx);
              const Icon = contextIcons[ctx] ?? User;
              return (
                <div
                  key={ctx}
                  className={`rounded-lg p-1.5 text-center ${insights.dominantContext === ctx ? "bg-accent ring-1 ring-primary" : "bg-muted"}`}
                >
                  <Icon className="mx-auto size-3.5 text-primary" />
                  <div className="text-xs font-bold">{found?.count ?? 0}</div>
                  <div className="text-[9px] uppercase text-muted-foreground">{ctx}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-1.5 text-xs">
        <InfoTile
          icon={HourIcon}
          label="Horário preferido"
          value={
            insights.habits.preferredHour !== null
              ? `${String(insights.habits.preferredHour).padStart(2, "0")}h`
              : "—"
          }
        />
        <InfoTile
          icon={Calendar}
          label="Dia preferido"
          value={
            insights.habits.preferredDay
              ? insights.habits.preferredDay.charAt(0).toUpperCase() +
                insights.habits.preferredDay.slice(1)
              : "—"
          }
        />
        <InfoTile
          label="Tempo entre visitas"
          value={
            insights.habits.avgTimeBetweenVisitsHours !== null
              ? `${(insights.habits.avgTimeBetweenVisitsHours / 24).toFixed(1)} dias`
              : "—"
          }
        />
        <InfoTile
          label="Check-in → Pedido"
          value={
            insights.habits.avgCheckinToOrderHours !== null
              ? `${insights.habits.avgCheckinToOrderHours.toFixed(1)}h`
              : "—"
          }
        />
        {insights.habits.mostUsedTable && (
          <InfoTile label="Mesa preferida" value={insights.habits.mostUsedTable.label} />
        )}
        <InfoTile
          label="Origem mais comum"
          value={
            insights.habits.mostCommonSource === "qr"
              ? "Link Geral"
              : insights.habits.mostCommonSource === "table"
                ? "Mesa"
                : (insights.habits.mostCommonSource ?? "—")
          }
        />
      </div>
    </Section>
  );
}

function Bloco5({ insights }: { insights: CustomerInsights }) {
  if (insights.purchases.totalOrders === 0) return null;

  return (
    <Section title="Compras" icon={ShoppingCart}>
      <div className="grid grid-cols-2 gap-1.5 text-xs">
        <InfoTile label="Total de pedidos" value={String(insights.purchases.totalOrders)} />
        <InfoTile label="Valor gasto" value={formatBRL(insights.purchases.totalSpent)} />
        <InfoTile label="Ticket médio" value={formatBRL(insights.purchases.avgOrderValue)} />
        <InfoTile label="Maior compra" value={formatBRL(insights.purchases.biggestPurchase)} />
        <InfoTile
          label="Última compra"
          value={insights.purchases.lastOrder ? relativeTime(insights.purchases.lastOrder) : "—"}
        />
      </div>

      {insights.purchases.mostOrderedProduct && (
        <div className="mt-2 rounded-lg bg-accent p-2 text-xs">
          <span className="text-muted-foreground">Produto mais comprado: </span>
          <strong>{insights.purchases.mostOrderedProduct.name}</strong>
          <span className="text-muted-foreground">
            {" "}
            ({insights.purchases.mostOrderedProduct.count}x)
          </span>
        </div>
      )}

      {insights.purchases.mostOrderedCategory && (
        <p className="mt-1 text-xs text-muted-foreground">
          Categoria favorita:{" "}
          <strong className="capitalize">{insights.purchases.mostOrderedCategory}</strong>
        </p>
      )}

      {insights.purchasedProducts.length > 0 && (
        <div className="mt-3">
          <p className="mb-1 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
            Produtos comprados
          </p>
          <div className="space-y-0.5 max-h-40 overflow-y-auto">
            {insights.purchasedProducts.map((p) => (
              <div
                key={p.productId}
                className="flex items-center justify-between rounded-md bg-muted/50 px-2 py-1 text-xs"
              >
                <div className="flex-1 min-w-0">
                  <span className="font-medium truncate block">{p.name}</span>
                  {p.category && (
                    <span className="text-[10px] text-muted-foreground capitalize">
                      {p.category}
                    </span>
                  )}
                </div>
                <div className="text-right shrink-0 ml-2">
                  <div className="text-muted-foreground">{p.count}×</div>
                  {p.price > 0 && <div className="font-medium">{formatBRL(p.price * p.count)}</div>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {insights.purchases.boughtTogether.length > 0 && (
        <div className="mt-2">
          <p className="mb-1 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
            Comprados juntos
          </p>
          <div className="flex flex-wrap gap-1">
            {insights.purchases.boughtTogether.map((bt) => (
              <span key={bt.id} className="rounded-full bg-accent px-2 py-0.5 text-[10px]">
                {bt.name} ({bt.count})
              </span>
            ))}
          </div>
        </div>
      )}
    </Section>
  );
}

function Bloco6({ insights }: { insights: CustomerInsights }) {
  const levelInfo = engLevelConfig[insights.engagement.level];

  return (
    <Section title="Engajamento" icon={TrendingUp}>
      <div className="grid grid-cols-4 gap-1.5 text-xs mb-3">
        <Tile icon={Heart} value={insights.loveCount} label="Amou" />
        <Tile icon={ThumbsDown} value={insights.dislikeCount} label="Não gostou" />
        <Tile icon={MessageCircle} value={insights.commentCount} label="Comentários" />
        <Tile icon={Edit3} value={insights.postsCount} label="Posts" />
      </div>

      <div className="mb-2">
        <div className="flex items-center justify-between text-xs mb-1">
          <span className="font-medium">{levelInfo.label}</span>
          <span className="text-muted-foreground">
            {insights.engagement.isHighlyEngaged ? "Alto" : "Baixo"} engajamento
          </span>
        </div>
        <div className="h-2 rounded-full bg-muted overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${levelInfo.barClass}`}
            style={{ width: levelInfo.width }}
          />
        </div>
      </div>

      <div className="space-y-1 text-xs">
        {insights.lastInteractionAt && (
          <p className="text-muted-foreground">
            Última interação: <strong>{relativeTime(insights.lastInteractionAt)}</strong>
          </p>
        )}
        <EngDetail label="Comprador recorrente" active={insights.engagement.isRepeatBuyer} />
        <EngDetail label="Cliente VIP" active={insights.engagement.isVip} />
      </div>
    </Section>
  );
}

function Bloco7({ insights }: { insights: CustomerInsights }) {
  const hasOpportunities =
    insights.likedButNotOrdered.length > 0 || insights.wishedProducts.length > 0;

  if (!hasOpportunities) {
    return (
      <Section title="Oportunidades" icon={Target}>
        <p className="text-sm text-muted-foreground">
          Nenhuma oportunidade identificada no momento.
        </p>
      </Section>
    );
  }

  return (
    <Section title="Oportunidades" icon={Target}>
      <div className="space-y-3">
        {insights.likedButNotOrdered.length > 0 && (
          <div>
            <div className="flex items-center gap-1.5 mb-1">
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                Curtiu mas não comprou
              </p>
              <span className="rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-medium">
                {insights.likedButNotOrdered.length}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mb-1">
              Cliente demonstrou interesse e ainda não pediu.
            </p>
            <ProductList products={insights.likedButNotOrdered.slice(0, 4)} />
            {insights.likedButNotOrdered.length > 4 && (
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                +{insights.likedButNotOrdered.length - 4} outros
              </p>
            )}
          </div>
        )}
        {insights.wishedProducts.length > 0 && (
          <div>
            <div className="flex items-center gap-1.5 mb-1">
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                Na lista de desejos
              </p>
              <span className="rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-medium">
                {insights.wishedProducts.length}
              </span>
            </div>
            <ProductList products={insights.wishedProducts.slice(0, 4)} />
          </div>
        )}
      </div>
    </Section>
  );
}

function Bloco8({ insights }: { insights: CustomerInsights }) {
  const tInfo = trendConfig[insights.trend];
  const TrendIcon = tInfo.icon;

  return (
    <Section title="Tendência" icon={TrendingUp}>
      <div className="flex items-center gap-4">
        <div
          className={`flex items-center justify-center size-12 rounded-full bg-accent ${tInfo.color}`}
        >
          <TrendIcon className="size-6" />
        </div>
        <div>
          <p className="text-sm font-semibold">{trendDescriptions[insights.trend]}</p>
          <p className="text-xs text-muted-foreground">{trendExplanations[insights.trend]}</p>
        </div>
      </div>
    </Section>
  );
}

function Bloco9({ insights }: { insights: CustomerInsights }) {
  const parts: string[] = [];

  parts.push(`${insights.name}`);

  if (insights.classification === "new")
    parts.push("é um cliente novo que acabou de conhecer o estabelecimento.");
  else if (insights.classification === "vip")
    parts.push(
      `é um cliente VIP com ${insights.totalOrders} pedidos e ${formatBRL(insights.totalSpent)} em gastos.`,
    );
  else if (insights.classification === "inactive")
    parts.push(
      `é um cliente inativo — não visita há ${Math.round(insights.habits.daysSinceLastVisit ?? 0)} dias.`,
    );
  else if (insights.classification === "at_risk")
    parts.push(
      `está em risco de abandono — última visita foi há ${Math.round(insights.habits.daysSinceLastVisit ?? 0)} dias.`,
    );
  else
    parts.push(
      `é um cliente frequente com ${insights.totalVisits} visitas e ${insights.totalOrders} pedidos.`,
    );

  if (insights.dominantContext) {
    const ctxMap: Record<string, string> = {
      sozinho: "sozinho(a)",
      casal: "em casal",
      amigos: "com amigos",
      familia: "em família",
    };
    parts.push(`Costuma visitar ${ctxMap[insights.dominantContext] ?? insights.dominantContext}.`);
  }

  if (insights.habits.preferredDay && insights.habits.preferredHour !== null) {
    const period =
      insights.habits.preferredHour < 12
        ? "pela manhã"
        : insights.habits.preferredHour < 18
          ? "à tarde"
          : "à noite";
    parts.push(`Geralmente vem às ${insights.habits.preferredDay}s ${period}.`);
  }

  if (insights.purchases.mostOrderedProduct) {
    parts.push(`Seu produto favorito é ${insights.purchases.mostOrderedProduct.name}.`);
  }

  if (insights.purchases.mostOrderedCategory) {
    parts.push(`Preferência por ${insights.purchases.mostOrderedCategory}.`);
  }

  const engLabel =
    insights.engagement.level === "muito_ativo"
      ? "alto"
      : insights.engagement.level === "ativo"
        ? "moderado"
        : "baixo";
  parts.push(`Engajamento ${engLabel} com a plataforma.`);

  if (insights.likedButNotOrdered.length > 0) {
    const names = insights.likedButNotOrdered
      .slice(0, 2)
      .map((p) => p.name)
      .join(" e ");
    parts.push(`Tem interesse em ${names} — oportunidade de conversão.`);
  }

  if (insights.trend === "increasing")
    parts.push("A frequência de visitas está aumentando — ótimo sinal!");
  else if (insights.trend === "decreasing")
    parts.push("A frequência de visitas está diminuindo — vale atenção.");

  return (
    <Section title="Resumo Inteligente" icon={Sparkles}>
      <div className="rounded-lg bg-accent p-4 text-sm text-accent-foreground leading-relaxed">
        {parts.join(" ")}
      </div>
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

function EngDetail({ label, active }: { label: string; active: boolean }) {
  return (
    <div className="flex items-center justify-between rounded-lg bg-muted px-2 py-1">
      <span className="text-muted-foreground">{label}</span>
      <span className={`font-medium ${active ? "text-green-600" : "text-muted-foreground"}`}>
        {active ? "Sim" : "Não"}
      </span>
    </div>
  );
}

function StatBox({
  icon: Icon,
  value,
  label,
}: {
  icon: any;
  value: string | number;
  label: string;
}) {
  return (
    <div className="rounded-lg bg-muted p-2">
      <Icon className="mx-auto size-4 text-primary" />
      <div className="mt-0.5 text-sm font-bold">{value}</div>
      <div className="text-[10px] uppercase text-muted-foreground">{label}</div>
    </div>
  );
}

function Tile({ icon: Icon, value, label }: { icon: any; value: string | number; label: string }) {
  return (
    <div className="rounded-lg bg-muted p-2 text-center">
      <Icon className="mx-auto size-4 text-primary" />
      <div className="mt-0.5 text-sm font-bold">{value}</div>
      <div className="text-[10px] text-muted-foreground truncate">{label}</div>
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
    checkin: Users,
    order: ShoppingBag,
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
                  {e.context && (
                    <span className="capitalize text-muted-foreground">{e.context}</span>
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
