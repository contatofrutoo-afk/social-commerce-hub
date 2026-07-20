import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { tableRepository, checkinRepository, crmRepository } from "@/repositories";
import { relativeTime, formatBRL } from "@/lib/format";
import { optimizedImageUrl } from "@/lib/image-url";
import {
  User,
  Heart,
  Users,
  Home,
  Clock,
  ShoppingCart,
  Sparkles,
  TrendingUp,
  Star,
  Gift,
  Lightbulb,
  Target,
  ShoppingBag,
  ChevronRight,
  LogOut,
  Trash2,
  Flame,
} from "lucide-react";

const PRESENCE_WINDOW_MS = 8 * 60 * 60 * 1000;

function isPresent(createdAt: string): boolean {
  return Date.now() - new Date(createdAt).getTime() < PRESENCE_WINDOW_MS;
}

const contextIcons: Record<string, any> = {
  sozinho: User,
  casal: Heart,
  amigos: Users,
  familia: Home,
};

const contextLabels: Record<string, string> = {
  sozinho: "Está sozinho",
  casal: "Está em casal",
  amigos: "Está com amigos",
  familia: "Está acompanhado da família",
};

const contextEmojis: Record<string, string> = {
  sozinho: "🙋",
  casal: "❤️",
  amigos: "👥",
  familia: "👨‍👩‍👧",
};

const classificationConfig: Record<string, { label: string; class: string; dot: string }> = {
  new: {
    label: "Novo Cliente",
    class: "bg-blue-500/10 text-blue-600 border-blue-500/30",
    dot: "🟢",
  },
  frequent: {
    label: "Cliente Frequente",
    class: "bg-green-500/10 text-green-600 border-green-500/30",
    dot: "🔵",
  },
  vip: {
    label: "Cliente VIP",
    class: "bg-amber-500/10 text-amber-600 border-amber-500/30",
    dot: "🟣",
  },
  at_risk: {
    label: "Risco",
    class: "bg-yellow-500/10 text-yellow-600 border-yellow-500/30",
    dot: "🟡",
  },
  inactive: { label: "Inativo", class: "bg-red-500/10 text-red-600 border-red-500/30", dot: "🔴" },
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

// Assina mudanças em tempo real nas tabelas relevantes e invalida os caches
// usados pelas views. Compartilhado por Mesas e Loja para que /vendas espelhe
// /app/atendimento instantaneamente.
function useRealtimeService(companyId: string) {
  const qc = useQueryClient();
  useEffect(() => {
    if (!companyId) return;
    const channel = supabase
      .channel(`service-${companyId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "checkins", filter: `company_id=eq.${companyId}` },
        () => {
          qc.invalidateQueries({ queryKey: ["present", companyId] });
          qc.invalidateQueries({ queryKey: ["checkins-all", companyId] });
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tables", filter: `company_id=eq.${companyId}` },
        () => qc.invalidateQueries({ queryKey: ["tables", companyId] }),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders", filter: `company_id=eq.${companyId}` },
        () => qc.invalidateQueries({ queryKey: ["orders", companyId] }),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "customers", filter: `company_id=eq.${companyId}` },
        () => {
          qc.invalidateQueries({ queryKey: ["customers", companyId] });
          qc.invalidateQueries({ queryKey: ["present", companyId] });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [companyId, qc]);
}

// ======= MESAS VIEW =======

export function MesasView({ companyId }: { companyId: string }) {
  const qc = useQueryClient();
  const [selectedCheckin, setSelectedCheckin] = useState<any>(null);
  useRealtimeService(companyId);

  const { data: tables } = useQuery({
    queryKey: ["tables", companyId],
    queryFn: () => tableRepository.listByCompany(companyId),
  });
  const { data: present } = useQuery({
    queryKey: ["present", companyId],
    queryFn: () => checkinRepository.listPresentByCompany(companyId),
    refetchInterval: 15000,
  });

  const mesaCheckins = (present ?? []).filter((c: any) => c.table_id);

  const clearTable = useMutation({
    mutationFn: (ids: string[]) => checkinRepository.deleteByIds(ids),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["present", companyId] });
    },
  });

  if (selectedCheckin) {
    return (
      <div className="mt-4">
        <button
          onClick={() => setSelectedCheckin(null)}
          className="mb-2 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ChevronRight className="size-3 rotate-180" /> Voltar para mesas
        </button>
        <CustomerPanel
          customerId={selectedCheckin.customer_id}
          checkinAt={selectedCheckin.created_at}
          tableLabel={selectedCheckin.table?.label}
          context={selectedCheckin.context}
          mode="mesas"
        />
      </div>
    );
  }

  return (
    <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {tables?.map((t) => {
        const occupations = mesaCheckins.filter((c: any) => c.table_id === t.id);
        return (
          <div
            key={t.id}
            className={`rounded-xl border p-4 ${occupations.length > 0 ? "bg-accent" : "bg-card"}`}
          >
            <div className="flex items-center justify-between">
              <div className="text-lg font-bold">{t.label}</div>
              <div className="flex items-center gap-2">
                {occupations.length > 0 && (
                  <span className="text-xs text-muted-foreground">
                    {occupations.length} {occupations.length === 1 ? "pessoa" : "pessoas"}
                  </span>
                )}
                {occupations.length > 0 && (
                  <button
                    onClick={() => {
                      if (window.confirm(`Liberar ${t.label}? Todas as pessoas serão removidas.`)) {
                        clearTable.mutate(occupations.map((o: any) => o.id));
                      }
                    }}
                    disabled={clearTable.isPending}
                    className="rounded-lg p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors disabled:opacity-50"
                    title="Liberar mesa"
                  >
                    <LogOut className="size-4" />
                  </button>
                )}
              </div>
            </div>
            {occupations.length > 0 ? (
              <div className="mt-2 space-y-1.5">
                {occupations.map((o: any) => {
                  const avatar = o.customer?.avatar_url;
                  const name = o.customer?.name ?? "";
                  return (
                    <button
                      key={o.id}
                      onClick={() => setSelectedCheckin(o)}
                      className="flex w-full items-center gap-2 rounded-lg p-2 text-left hover:bg-card transition-colors"
                    >
                      <div className="relative shrink-0">
                        {avatar ? (
                          <img src={optimizedImageUrl(avatar, 32)} alt="" loading="lazy" decoding="async" className="size-8 rounded-full object-cover" />
                        ) : (
                          <div className="grid size-8 place-items-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
                            {name.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <span
                          className={`absolute -bottom-0.5 -right-0.5 size-3 rounded-full border-2 border-background ${
                            isPresent(o.created_at) ? "bg-green-500" : "bg-gray-400"
                          }`}
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium truncate">{name}</div>
                        <div className="text-xs text-muted-foreground">
                          {relativeTime(o.created_at)}
                        </div>
                      </div>
                    </button>
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

// ======= LOJA VIEW =======

export function LojaView({ companyId }: { companyId: string }) {
  const qc = useQueryClient();
  const [selectedCheckin, setSelectedCheckin] = useState<any>(null);
  useRealtimeService(companyId);


  const { data: present } = useQuery({
    queryKey: ["present", companyId],
    queryFn: () => checkinRepository.listPresentByCompany(companyId),
    refetchInterval: 15000,
  });

  const lojaCustomers = (present ?? []).filter((c: any) => !c.table_id);

  const removeCheckin = useMutation({
    mutationFn: (id: string) => checkinRepository.deleteByIds([id]),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["present", companyId] });
      setSelectedCheckin(null);
    },
  });

  if (selectedCheckin) {
    return (
      <div className="mt-4">
        <button
          onClick={() => setSelectedCheckin(null)}
          className="mb-2 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ChevronRight className="size-3 rotate-180" /> Voltar
        </button>
        <CustomerPanel
          customerId={selectedCheckin.customer_id}
          checkinAt={selectedCheckin.created_at}
          context={selectedCheckin.context}
          mode="loja"
        />
      </div>
    );
  }

  return (
    <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_1.5fr]">
      <div className="rounded-xl border bg-card divide-y">
        {lojaCustomers.length === 0 && (
          <p className="p-6 text-sm text-muted-foreground">Ninguém na loja agora.</p>
        )}
        {lojaCustomers.map((c: any) => {
          const avatar = c.customer?.avatar_url;
          const name = c.customer?.name ?? "";
          return (
            <div
              key={c.id}
              className="group relative flex items-center gap-3 p-3 text-left transition-colors"
            >
              <button
                onClick={() => setSelectedCheckin(c)}
                className="flex flex-1 items-center gap-3 min-w-0"
              >
                <div className="relative shrink-0">
                  {avatar ? (
                    <img src={optimizedImageUrl(avatar, 40)} alt="" loading="lazy" decoding="async" className="size-10 rounded-full object-cover" />
                  ) : (
                    <div className="grid size-10 place-items-center rounded-full bg-primary text-primary-foreground text-sm font-bold">
                      {name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <span
                    className={`absolute -bottom-0.5 -right-0.5 size-3 rounded-full border-2 border-background ${
                      isPresent(c.created_at) ? "bg-green-500" : "bg-gray-400"
                    }`}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{name}</div>
                  <div className="text-xs text-muted-foreground">
                    {c.context} · {relativeTime(c.created_at)}
                  </div>
                </div>
              </button>
              <button
                onClick={() => {
                  if (window.confirm(`Remover ${name} da loja?`)) removeCheckin.mutate(c.id);
                }}
                disabled={removeCheckin.isPending}
                className="shrink-0 rounded-lg p-1.5 text-muted-foreground opacity-0 transition-all hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100 disabled:opacity-50"
                title="Remover da loja"
              >
                <Trash2 className="size-4" />
              </button>
            </div>
          );
        })}
      </div>
      <div className="hidden rounded-xl border bg-card p-6 text-sm text-muted-foreground lg:block">
        Toque em um cliente ao lado para ver o perfil completo e histórico.
      </div>
    </div>
  );
}

// ======= CUSTOMER PANEL =======

export function CustomerPanel({
  customerId,
  checkinAt,
  tableLabel,
  context,
  mode,
}: {
  customerId: string;
  checkinAt?: string;
  tableLabel?: string;
  context?: string;
  mode: "mesas" | "loja";
}) {
  const { data: p, isError } = useQuery({
    queryKey: ["customer-service-profile", customerId],
    queryFn: () => crmRepository.getCustomerServiceProfile(customerId),
  });

  if (isError)
    return (
      <div className="rounded-xl border bg-card p-6 text-sm text-muted-foreground">
        Erro ao carregar perfil.
      </div>
    );
  if (!p) return <div className="rounded-xl border bg-card p-6">Carregando...</div>;

  const cc = classificationConfig[p.classification] ?? classificationConfig.frequent;
  const ContextIcon = p.currentContext ? contextIcons[p.currentContext] : null;
  const checkinMinutes = checkinAt
    ? Math.floor((Date.now() - new Date(checkinAt).getTime()) / 60000)
    : null;

  return (
    <div className="space-y-3">
      <div className="rounded-xl border bg-card p-4">
        <div className="flex items-start gap-3">
          {p.avatarUrl ? (
            <img src={optimizedImageUrl(p.avatarUrl, 48)} alt="" loading="lazy" decoding="async" className="size-12 rounded-full object-cover shrink-0" />
          ) : (
            <div className="grid size-12 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground text-lg font-bold">
              {p.name.charAt(0).toUpperCase()}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg font-bold">{p.name}</h2>
              <span
                className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${cc.class}`}
              >
                {cc.dot} {cc.label}
              </span>
              {p.interestFunnel.level !== "nenhum" && (
                <span
                  className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${interestConfig[p.interestFunnel.level]?.class ?? interestConfig.nenhum.class}`}
                >
                  <Flame className="inline size-2.5 mr-0.5 -mt-0.5" /> {p.interestFunnel.label}
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Cliente desde {new Date(p.customerSince).toLocaleDateString("pt-BR")}
            </p>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {p.currentContext && ContextIcon && (
            <span className="flex items-center gap-1">
              <ContextIcon className="size-3.5" />
              {contextEmojis[p.currentContext] ?? ""}{" "}
              {contextLabels[p.currentContext] ?? p.currentContext}
            </span>
          )}
          {mode === "mesas" && tableLabel && (
            <span className="flex items-center gap-1">
              <Home className="size-3.5" /> Mesa {tableLabel}
            </span>
          )}
          {checkinMinutes !== null && checkinMinutes >= 0 && (
            <span className="flex items-center gap-1">
              <Clock className="size-3.5" />
              {checkinMinutes < 1 ? "Chegou agora" : `${checkinMinutes}min`}
            </span>
          )}
        </div>
      </div>

      <Section title="Relacionamento" icon={Heart}>
        <div className="grid grid-cols-2 gap-1.5 text-xs">
          <div className="rounded-lg bg-muted p-2">
            <div className="text-muted-foreground">Visitas</div>
            <div className="font-semibold">{p.totalVisits}</div>
          </div>
          <div className="rounded-lg bg-muted p-2">
            <div className="text-muted-foreground">Última visita</div>
            <div className="font-semibold">{p.lastVisit ? relativeTime(p.lastVisit) : "—"}</div>
          </div>
          <div className="rounded-lg bg-muted p-2">
            <div className="text-muted-foreground">Último pedido</div>
            <div className="font-semibold">
              {p.lastOrder ? relativeTime(p.lastOrder) : "Nenhum"}
            </div>
          </div>
          <div className="rounded-lg bg-muted p-2">
            <div className="text-muted-foreground">Ticket médio</div>
            <div className="font-semibold">
              {p.avgOrderValue > 0 ? formatBRL(p.avgOrderValue) : "—"}
            </div>
          </div>
        </div>
      </Section>

      <Section title="Preferências" icon={Star}>
        {p.totalOrders === 0 && p.likedProducts.length === 0 && p.wishedProducts.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Ainda estamos conhecendo as preferências deste cliente.
          </p>
        ) : (
          <div className="space-y-2">
            {p.mostOrderedProduct && (
              <div className="rounded-lg bg-accent p-2 text-sm">
                <span className="text-muted-foreground text-xs">Produto favorito: </span>
                <strong>{p.mostOrderedProduct.name}</strong>
                <span className="text-muted-foreground"> ({p.mostOrderedProduct.count}x)</span>
              </div>
            )}
            {p.mostOrderedCategory && (
              <p className="text-xs text-muted-foreground">
                Categoria favorita: <strong className="capitalize">{p.mostOrderedCategory}</strong>
              </p>
            )}
            {p.favoriteCategories.length === 0 && p.totalOrders > 0 && (
              <p className="text-xs text-muted-foreground">
                Ainda estamos conhecendo as preferências deste cliente.
              </p>
            )}
            <div className="flex flex-wrap gap-1">
              {p.recentlyLikedProducts.length > 0 && (
                <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] flex items-center gap-1">
                  <Heart className="size-2.5 text-red-400" />
                  Curtiu recentemente:{" "}
                  {p.recentlyLikedProducts
                    .slice(0, 3)
                    .map((l) => l.name)
                    .join(", ")}
                </span>
              )}
              {p.wishedProducts.length > 0 && (
                <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] flex items-center gap-1">
                  <Gift className="size-2.5 text-amber-400" />
                  Desejou:{" "}
                  {p.wishedProducts
                    .slice(0, 3)
                    .map((w) => w.name)
                    .join(", ")}
                </span>
              )}
            </div>
          </div>
        )}
      </Section>

      <Section title="Interesse atual" icon={Target}>
        {p.recentlyLikedProducts.length === 0 &&
        p.likedButNotOrdered.length === 0 &&
        p.wishedProducts.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum interesse recente registrado.</p>
        ) : (
          <div className="space-y-1.5 text-sm">
            {p.recentlyLikedProducts.length > 0 && (
              <div className="flex items-start gap-2">
                <Heart className="mt-0.5 size-3.5 shrink-0 text-red-400" />
                <div>
                  <span className="text-muted-foreground text-xs">Curtiu:</span>
                  <div className="font-medium">
                    {p.recentlyLikedProducts.map((l) => l.name).join(", ")}
                  </div>
                </div>
              </div>
            )}
            {p.likedButNotOrdered.length > 0 && p.recentlyLikedProducts.length === 0 && (
              <div className="flex items-start gap-2">
                <Heart className="mt-0.5 size-3.5 shrink-0 text-red-400" />
                <div>
                  <span className="text-muted-foreground text-xs">Já curtiu:</span>
                  <div className="font-medium">
                    {p.likedButNotOrdered
                      .slice(0, 3)
                      .map((l) => l.name)
                      .join(", ")}
                  </div>
                </div>
              </div>
            )}
            {p.wishedProducts.length > 0 && (
              <div className="flex items-start gap-2">
                <Gift className="mt-0.5 size-3.5 shrink-0 text-amber-400" />
                <div>
                  <span className="text-muted-foreground text-xs">Desejou:</span>
                  <div className="font-medium">
                    {p.wishedProducts
                      .slice(0, 3)
                      .map((w) => w.name)
                      .join(", ")}
                  </div>
                </div>
              </div>
            )}
            {p.likedButNotOrdered.length > 0 && (
              <div className="flex items-start gap-2">
                <ShoppingBag className="mt-0.5 size-3.5 shrink-0 text-blue-400" />
                <div>
                  <span className="text-muted-foreground text-xs">Nunca comprou:</span>
                  <div className="font-medium">
                    {p.likedButNotOrdered
                      .slice(0, 3)
                      .map((l) => l.name)
                      .join(", ")}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </Section>

      <Section title="Funil de interesse" icon={Flame}>
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span
              className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${interestConfig[p.interestFunnel.level]?.class ?? interestConfig.nenhum.class}`}
            >
              {p.interestFunnel.label}
            </span>
            <span className="text-xs text-muted-foreground">
              {p.interestFunnel.cartAdds > 0 &&
                `${p.interestFunnel.cartAdds} ${p.interestFunnel.cartAdds === 1 ? "item adicionado" : "itens adicionados"}`}
              {p.interestFunnel.cartAdds > 0 && p.interestFunnel.purchases > 0 && " · "}
              {p.interestFunnel.purchases > 0 &&
                `${p.interestFunnel.purchases} ${p.interestFunnel.purchases === 1 ? "compra" : "compras"}`}
              {p.interestFunnel.cartAdds === 0 &&
                p.interestFunnel.purchases === 0 &&
                "Nenhuma interação"}
            </span>
          </div>
          {p.interestFunnel.productsInCart.length > 0 && (
            <div className="text-xs">
              <span className="text-muted-foreground">Adicionou:</span>{" "}
              <span className="font-medium">
                {p.interestFunnel.productsInCart.map((p) => p.name).join(", ")}
              </span>
            </div>
          )}
          {p.interestFunnel.productsPurchased.length > 0 && (
            <div className="text-xs">
              <span className="text-muted-foreground">Comprou:</span>{" "}
              <span className="font-medium">
                {p.interestFunnel.productsPurchased.map((p) => p.name).join(", ")}
              </span>
            </div>
          )}
        </div>
      </Section>

      {p.recentOrders.length > 0 && (
        <Section title="Últimos pedidos" icon={ShoppingCart}>
          <ul className="space-y-2">
            {p.recentOrders.slice(0, 3).map((o) => (
              <li key={o.id} className="rounded-lg border p-2 text-xs">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold">{formatBRL(o.total)}</span>
                  <span className="text-muted-foreground">{relativeTime(o.createdAt)}</span>
                </div>
                <div className="space-y-0.5">
                  {o.items.map((item) => {
                    const lineTotal = item.quantity * item.unitPrice;
                    return (
                      <div
                        key={item.id}
                        className="flex items-center justify-between bg-muted/50 rounded px-1.5 py-0.5"
                      >
                        <span className="truncate font-medium">{item.productName}</span>
                        <span className="shrink-0 ml-2 text-muted-foreground">
                          {item.quantity}× {formatBRL(item.unitPrice)} = {formatBRL(lineTotal)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {p.opportunities.length > 0 && (
        <Section title="Oportunidades" icon={TrendingUp}>
          <ul className="space-y-1">
            {p.opportunities.map((o, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <Sparkles className="mt-0.5 size-3.5 shrink-0 text-primary" />
                <span>{o}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <div className="rounded-xl border-2 border-primary/20 bg-primary/5 p-4">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="size-5 text-primary" />
          <h3 className="text-sm font-bold text-primary">Sugestão WEAZE</h3>
        </div>
        <ul className="space-y-2">
          {p.weazeSuggestions.map((s, i) => (
            <li key={i} className="flex items-start gap-2 text-sm">
              <Lightbulb className="mt-0.5 size-4 shrink-0 text-amber-500" />
              <span>{s}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

// ======= SECTION COMPONENT =======

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
