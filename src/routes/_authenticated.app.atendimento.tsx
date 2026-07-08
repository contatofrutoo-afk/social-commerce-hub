import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { tableRepository, checkinRepository, crmRepository } from "@/repositories";
import type { CustomerServiceProfile } from "@/repositories/types";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { relativeTime, formatBRL } from "@/lib/format";
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
  RefreshCw,
  Target,
  ShoppingBag,
  ChevronRight,
  LogOut,
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

// ======= MAIN PAGE =======

function ServicePage() {
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

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Atendimento</h1>
      <Tabs defaultValue="mesas">
        <TabsList>
          <TabsTrigger value="mesas">Mesas</TabsTrigger>
          <TabsTrigger value="loja">Loja</TabsTrigger>
        </TabsList>
        <TabsContent value="mesas">{companyId && <MesasView companyId={companyId} />}</TabsContent>
        <TabsContent value="loja">{companyId && <LojaView companyId={companyId} />}</TabsContent>
      </Tabs>
    </div>
  );
}

// ======= MESAS VIEW =======

function MesasView({ companyId }: { companyId: string }) {
  const qc = useQueryClient();
  const [selectedCheckin, setSelectedCheckin] = useState<any>(null);

  const { data: tables } = useQuery({
    queryKey: ["tables", companyId],
    queryFn: () => tableRepository.listByCompany(companyId),
  });
  const { data: present } = useQuery({
    queryKey: ["present", companyId],
    queryFn: () => checkinRepository.listPresentByCompany(companyId),
    refetchInterval: 15000,
  });

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
        const occupations = present?.filter((c: any) => c.table_id === t.id) ?? [];
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
                      {avatar ? (
                        <img
                          src={avatar}
                          alt=""
                          className="size-8 shrink-0 rounded-full object-cover"
                        />
                      ) : (
                        <div className="grid size-8 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
                          {name.charAt(0).toUpperCase()}
                        </div>
                      )}
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

function LojaView({ companyId }: { companyId: string }) {
  const [selectedCheckin, setSelectedCheckin] = useState<any>(null);

  const { data: present } = useQuery({
    queryKey: ["present", companyId],
    queryFn: () => checkinRepository.listPresentByCompany(companyId),
    refetchInterval: 15000,
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
        {present?.length === 0 && (
          <p className="p-6 text-sm text-muted-foreground">Ninguém no local agora.</p>
        )}
        {present?.map((c: any) => {
          const avatar = c.customer?.avatar_url;
          const name = c.customer?.name ?? "";
          return (
            <button
              key={c.id}
              onClick={() => setSelectedCheckin(c)}
              className="flex w-full items-center gap-3 p-3 text-left hover:bg-muted transition-colors"
            >
              {avatar ? (
                <img src={avatar} alt="" className="size-10 shrink-0 rounded-full object-cover" />
              ) : (
                <div className="grid size-10 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground text-sm font-bold">
                  {name.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium">{name}</div>
                <div className="text-xs text-muted-foreground">
                  {c.context} · {relativeTime(c.created_at)}
                </div>
              </div>
            </button>
          );
        })}
      </div>
      <div className="hidden rounded-xl border bg-card p-6 text-sm text-muted-foreground lg:block">
        Selecione um cliente presente.
      </div>
    </div>
  );
}

// ======= CUSTOMER PANEL =======

function CustomerPanel({
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
      {/* ===== BLOCO 1: IDENTIFICAÇÃO ===== */}
      <div className="rounded-xl border bg-card p-4">
        <div className="flex items-start gap-3">
          {p.avatarUrl ? (
            <img src={p.avatarUrl} alt="" className="size-12 rounded-full object-cover shrink-0" />
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
              <Home className="size-3.5" />
              Mesa {tableLabel}
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

      {/* ===== BLOCO 2: RELACIONAMENTO ===== */}
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

      {/* ===== BLOCO 3: PREFERÊNCIAS ===== */}
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

      {/* ===== BLOCO 4: INTERESSE ATUAL ===== */}
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

      {/* ===== BLOCO 5: ÚLTIMOS PEDIDOS ===== */}
      {p.recentOrders.length > 0 && (
        <Section title="Últimos pedidos" icon={ShoppingCart}>
          <ul className="space-y-1.5">
            {p.recentOrders.slice(0, 3).map((o) => (
              <li key={o.id} className="rounded-lg border p-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-semibold">{formatBRL(o.total)}</span>
                  <span className="text-muted-foreground">{relativeTime(o.createdAt)}</span>
                </div>
                <div className="text-muted-foreground mt-0.5">
                  {o.items.map((i) => `${i.quantity}x ${i.productName}`).join(", ")}
                </div>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {/* ===== BLOCO 6: OPORTUNIDADES ===== */}
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

      {/* ===== BLOCO 7: SUGESTÃO WEAZE ===== */}
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
