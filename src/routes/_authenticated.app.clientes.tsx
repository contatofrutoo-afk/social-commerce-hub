import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { customerRepository, crmRepository } from "@/repositories";
import type { CustomerInsights, TimelineEvent, ProductInteraction } from "@/repositories/types";
import { useState } from "react";
import { formatBRL, relativeTime } from "@/lib/format";
import { Input } from "@/components/ui/input";
import {
  User, Heart, ThumbsDown, MessageCircle, ShoppingCart, ShoppingBag, Calendar, Clock, Users, Star,
  Home, Sparkles, TrendingUp, RefreshCw, Lightbulb,
  Camera, Edit3, Target, Gift, Sun, Moon, Sunrise, Sunset, Activity,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/clientes")({
  component: CustomersPage,
});

const contextIcons: Record<string, any> = { sozinho: User, casal: Heart, amigos: Users, familia: Home };

function statusConfig(insights: CustomerInsights) {
  if (insights.engagement.isNew) return { label: "Novo", class: "bg-blue-500/10 text-blue-600 border-blue-500/30" };
  if (insights.engagement.isVip) return { label: "VIP", class: "bg-amber-500/10 text-amber-600 border-amber-500/30" };
  if (insights.engagement.isInactive) return { label: "Inativo", class: "bg-red-500/10 text-red-600 border-red-500/30" };
  if (insights.engagement.isRepeatBuyer) return { label: "Frequente", class: "bg-green-500/10 text-green-600 border-green-500/30" };
  return { label: "Regular", class: "bg-muted text-muted-foreground border-border" };
}

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
              <div className="flex items-center gap-2 min-w-0">
                {c.avatarUrl ? (
                  <img src={c.avatarUrl} alt="" className="size-8 rounded-full object-cover shrink-0" />
                ) : (
                  <div className="grid size-8 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
                    {c.name.charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{c.name}</div>
                  <div className="text-xs text-muted-foreground truncate">{c.whatsapp}</div>
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-xs text-muted-foreground">{c.visitCount} visitas</div>
                <div className="text-[11px] text-muted-foreground">{relativeTime(c.lastVisitAt)}</div>
              </div>
            </button>
          ))}
        </div>

        {selectedId ? (
          <CustomerDetail id={selectedId} />
        ) : (
          <div className="hidden rounded-xl border bg-card p-6 text-sm text-muted-foreground lg:block">
            Selecione um cliente para ver o perfil completo.
          </div>
        )}
      </div>
    </div>
  );
}

function CustomerDetail({ id }: { id: string }) {
  const { data: insights } = useQuery({
    queryKey: ["customer-insights", id],
    queryFn: () => crmRepository.getCustomerInsights(id),
  });

  if (!insights) return <div className="rounded-xl border bg-card p-6">Carregando…</div>;

  const status = statusConfig(insights);
  const ContextIcon = insights.dominantContext ? contextIcons[insights.dominantContext] : null;

  const hourIcon = insights.habits.preferredHour !== null
    ? insights.habits.preferredHour < 12 ? Sunrise
      : insights.habits.preferredHour < 18 ? Sun
      : Moon
    : Clock;

  return (
    <div className="space-y-4">
      {/* === IDENTIFICAÇÃO === */}
      <div className="rounded-xl border bg-card p-5">
        <div className="flex items-start gap-4">
          {insights.avatarUrl ? (
            <img src={insights.avatarUrl} alt="" className="size-14 rounded-full object-cover" />
          ) : (
            <div className="grid size-14 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground text-xl font-bold">
              {insights.name.charAt(0).toUpperCase()}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xl font-bold">{insights.name}</h2>
              <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${status.class}`}>{status.label}</span>
            </div>
            <p className="text-sm text-muted-foreground">{insights.whatsapp}</p>
            <p className="text-[11px] text-muted-foreground">Cliente desde {new Date(insights.customerSince).toLocaleDateString("pt-BR")}</p>
          </div>
        </div>

        {/* Executive summary */}
        <div className="mt-4 rounded-lg bg-accent p-3 text-sm text-accent-foreground">
          <p>{insights.executiveSummary}</p>
        </div>

        {/* Quick stats */}
        <div className="mt-4 grid grid-cols-4 gap-2 text-center">
          <StatBox icon={RefreshCw} value={insights.totalVisits} label="Visitas" />
          <StatBox icon={ShoppingCart} value={insights.totalOrders} label="Pedidos" />
          <StatBox icon={TrendingUp} value={formatBRL(insights.totalSpent)} label="Gasto total" />
          <StatBox icon={Star} value={formatBRL(insights.avgOrderValue)} label="Ticket médio" />
        </div>
      </div>

      {/* === RELACIONAMENTO === */}
      <Section title="Relacionamento" icon={Heart}>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="rounded-lg bg-muted p-2">
            <span className="text-muted-foreground">Primeira visita</span>
            <div className="font-semibold">{insights.firstVisit ? new Date(insights.firstVisit).toLocaleDateString("pt-BR") : "—"}</div>
          </div>
          <div className="rounded-lg bg-muted p-2">
            <span className="text-muted-foreground">Última visita</span>
            <div className="font-semibold">{insights.lastVisit ? relativeTime(insights.lastVisit) : "—"}</div>
          </div>
          <div className="rounded-lg bg-muted p-2">
            <span className="text-muted-foreground">Total de visitas</span>
            <div className="font-semibold">{insights.totalVisits}</div>
          </div>
          <div className="rounded-lg bg-muted p-2">
            <span className="text-muted-foreground">Dias desde última visita</span>
            <div className="font-semibold">{insights.habits.daysSinceLastVisit !== null ? `${Math.round(insights.habits.daysSinceLastVisit)} dias` : "—"}</div>
          </div>
          <div className="rounded-lg bg-muted p-2">
            <span className="text-muted-foreground">Tempo médio entre visitas</span>
            <div className="font-semibold">{insights.habits.avgTimeBetweenVisitsHours !== null ? `${insights.habits.avgTimeBetweenVisitsHours.toFixed(1)}h` : "—"}</div>
          </div>
          <div className="rounded-lg bg-muted p-2">
            <span className="text-muted-foreground">Frequência de retorno</span>
            <div className="font-semibold capitalize">{insights.habits.returnFrequency === "alta" ? "Alta" : insights.habits.returnFrequency === "media" ? "Média" : "Baixa"}</div>
          </div>
        </div>
      </Section>

      {/* === CONTEXTO DAS VISITAS === */}
      {insights.visitContexts.length > 0 && (
        <Section title="Contexto das visitas" icon={Users}>
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              {["sozinho", "casal", "amigos", "familia"].map((ctx) => {
                const found = insights.visitContexts.find((v) => v.context === ctx);
                const Icon = contextIcons[ctx] ?? User;
                return (
                  <div key={ctx} className={`rounded-lg p-2 text-center ${insights.dominantContext === ctx ? "bg-accent ring-1 ring-primary" : "bg-muted"}`}>
                    <Icon className="mx-auto size-4 text-primary" />
                    <div className="mt-0.5 text-lg font-bold">{found?.count ?? 0}</div>
                    <div className="text-[10px] uppercase text-muted-foreground capitalize">{ctx}</div>
                  </div>
                );
              })}
            </div>
            {insights.dominantContext && ContextIcon && (
              <p className="flex items-center gap-1 text-xs text-muted-foreground">
                <ContextIcon className="size-3" />
                Costuma visitar o estabelecimento <strong className="capitalize">{insights.dominantContext === "sozinho" ? "sozinho" : insights.dominantContext === "casal" ? "em casal" : insights.dominantContext === "amigos" ? "com amigos" : "em família"}</strong>.
              </p>
            )}
          </div>
        </Section>
      )}

      {/* === COMPORTAMENTO === */}
      <Section title="Comportamento" icon={Activity}>
        <div className="grid grid-cols-3 gap-2 text-xs sm:grid-cols-4">
          <Tile icon={Heart} value={insights.loveCount} label="Curtidas" />
          <Tile icon={ThumbsDown} value={insights.dislikeCount} label="Não gostei" />
          <Tile icon={MessageCircle} value={insights.commentCount} label="Comentários" />
          <Tile icon={Edit3} value={insights.postsCount} label="Publicações" />
          <Tile icon={Camera} value={insights.photoCount} label="Fotos" />
          <Tile icon={ShoppingCart} value={insights.purchases.totalOrders} label="Pedidos" />
          <Tile icon={Star} value={insights.likedProducts.length} label="Curtidos" />
          <Tile icon={Gift} value={insights.wishedProducts.length} label="Desejados" />
        </div>
      </Section>

      {/* === INTERESSES === */}
      <div className="grid gap-4 sm:grid-cols-2">
        {insights.purchasedProducts.length > 0 && (
          <Section title="Produtos comprados" icon={ShoppingBag}>
            <ProductList products={insights.purchasedProducts} />
          </Section>
        )}
        {insights.favoriteCategories.length > 0 && (
          <Section title="Categorias favoritas" icon={Target}>
            <div className="space-y-1">
              {insights.favoriteCategories.map((fc) => (
                <div key={fc.category} className="flex justify-between text-sm">
                  <span className="capitalize">{fc.category}</span>
                  <span className="font-semibold">{fc.count}</span>
                </div>
              ))}
            </div>
          </Section>
        )}
        {insights.likedProducts.length > 0 && (
          <Section title="Produtos curtidos" icon={Heart}>
            <ProductList products={insights.likedProducts} />
          </Section>
        )}
        {insights.wishedProducts.length > 0 && (
          <Section title="Produtos desejados" icon={Gift}>
            <ProductList products={insights.wishedProducts} />
          </Section>
        )}
        {insights.lovedProducts.length > 0 && (
          <Section title="Produtos que amou" icon={Heart}>
            <ProductList products={insights.lovedProducts} />
          </Section>
        )}
        {insights.dislikedProducts.length > 0 && (
          <Section title="Produtos que não gostou" icon={ThumbsDown}>
            <ProductList products={insights.dislikedProducts} />
          </Section>
        )}
      </div>

      {/* === HÁBITOS === */}
      <Section title="Hábitos" icon={Clock}>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="rounded-lg bg-muted p-2">
            <div className="flex items-center gap-1 text-muted-foreground"><hourIcon className="size-3" /> Horário preferido</div>
            <div className="font-semibold">{insights.habits.preferredHour !== null ? `${String(insights.habits.preferredHour).padStart(2, "0")}h` : "—"}</div>
          </div>
          <div className="rounded-lg bg-muted p-2">
            <div className="flex items-center gap-1 text-muted-foreground"><Calendar className="size-3" /> Dia preferido</div>
            <div className="font-semibold capitalize">{insights.habits.preferredDay ?? "—"}</div>
          </div>
          <div className="rounded-lg bg-muted p-2">
            <div className="text-muted-foreground">Check-in → Pedido</div>
            <div className="font-semibold">{insights.habits.avgCheckinToOrderHours !== null ? `${insights.habits.avgCheckinToOrderHours.toFixed(1)}h` : "—"}</div>
          </div>
          <div className="rounded-lg bg-muted p-2">
            <div className="text-muted-foreground">Origem mais comum</div>
            <div className="font-semibold capitalize">{insights.habits.mostCommonSource === "qr" ? "Link Geral" : insights.habits.mostCommonSource === "table" ? "Mesa" : insights.habits.mostCommonSource ?? "—"}</div>
          </div>
          {insights.habits.mostUsedTable && (
            <div className="rounded-lg bg-muted p-2">
              <div className="text-muted-foreground">Mesa mais usada</div>
              <div className="font-semibold">{insights.habits.mostUsedTable.label}</div>
            </div>
          )}
        </div>
      </Section>

      {/* === COMPRAS === */}
      {insights.purchases.totalOrders > 0 && (
        <Section title="Compras" icon={ShoppingCart}>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-lg bg-muted p-2">
              <span className="text-muted-foreground">Total de pedidos</span>
              <div className="font-semibold">{insights.purchases.totalOrders}</div>
            </div>
            <div className="rounded-lg bg-muted p-2">
              <span className="text-muted-foreground">Valor gasto</span>
              <div className="font-semibold">{formatBRL(insights.purchases.totalSpent)}</div>
            </div>
            <div className="rounded-lg bg-muted p-2">
              <span className="text-muted-foreground">Ticket médio</span>
              <div className="font-semibold">{formatBRL(insights.purchases.avgOrderValue)}</div>
            </div>
            <div className="rounded-lg bg-muted p-2">
              <span className="text-muted-foreground">Maior compra</span>
              <div className="font-semibold">{formatBRL(insights.purchases.biggestPurchase)}</div>
            </div>
            <div className="rounded-lg bg-muted p-2">
              <span className="text-muted-foreground">Última compra</span>
              <div className="font-semibold">{insights.purchases.lastOrder ? relativeTime(insights.purchases.lastOrder) : "—"}</div>
            </div>
          </div>

          {insights.purchases.mostOrderedProduct && (
            <div className="mt-2">
              <p className="text-xs text-muted-foreground">Produto mais comprado: <strong>{insights.purchases.mostOrderedProduct.name}</strong> ({insights.purchases.mostOrderedProduct.count}x)</p>
            </div>
          )}
          {insights.purchases.mostOrderedCategory && (
            <p className="text-xs text-muted-foreground">Categoria mais comprada: <strong className="capitalize">{insights.purchases.mostOrderedCategory}</strong></p>
          )}

          {insights.purchases.boughtTogether.length > 0 && (
            <div className="mt-2">
              <p className="mb-1 text-xs font-medium text-muted-foreground">Comprados juntos com mais frequência</p>
              <div className="flex flex-wrap gap-1">
                {insights.purchases.boughtTogether.map((bt) => (
                  <span key={bt.id} className="rounded-full bg-accent px-2 py-0.5 text-[10px]">{bt.name} ({bt.count})</span>
                ))}
              </div>
            </div>
          )}
        </Section>
      )}

      {/* === ENGAJAMENTO === */}
      <Section title="Engajamento" icon={TrendingUp}>
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className={`h-2 flex-1 rounded-full ${insights.engagement.level === "muito_ativo" ? "bg-green-500" : insights.engagement.level === "moderado" ? "bg-blue-500" : insights.engagement.level === "pouco_ativo" ? "bg-yellow-500" : "bg-red-500"}`} style={{ width: `${insights.engagement.level === "muito_ativo" ? 100 : insights.engagement.level === "moderado" ? 65 : insights.engagement.level === "pouco_ativo" ? 35 : 15}%` }} />
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <StatusTile label="Nível" value={insights.engagement.level === "muito_ativo" ? "Muito ativo" : insights.engagement.level === "moderado" ? "Moderado" : insights.engagement.level === "pouco_ativo" ? "Pouco ativo" : "Risco de abandono"} color={insights.engagement.level === "muito_ativo" ? "text-green-600" : insights.engagement.level === "moderado" ? "text-blue-600" : insights.engagement.level === "pouco_ativo" ? "text-yellow-600" : "text-red-600"} />
            <StatusTile label="Alto engajamento" value={insights.engagement.isHighlyEngaged ? "Sim" : "Não"} color={insights.engagement.isHighlyEngaged ? "text-green-600" : "text-muted-foreground"} />
            <StatusTile label="Comprador recorrente" value={insights.engagement.isRepeatBuyer ? "Sim" : "Não"} color={insights.engagement.isRepeatBuyer ? "text-green-600" : "text-muted-foreground"} />
            <StatusTile label="Cliente VIP" value={insights.engagement.isVip ? "Sim" : "Não"} color={insights.engagement.isVip ? "text-amber-600" : "text-muted-foreground"} />
          </div>
        </div>
      </Section>

      {/* === SUGESTÕES === */}
      {insights.suggestions.length > 0 && (
        <Section title="Sugestões automáticas" icon={Lightbulb}>
          <ul className="space-y-1">
            {insights.suggestions.map((s, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <Lightbulb className="mt-0.5 size-3.5 shrink-0 text-primary" />
                <span>{s}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {/* === LINHA DO TEMPO === */}
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

// --- Helper components ---

function StatBox({ icon: Icon, value, label }: { icon: any; value: string | number; label: string }) {
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

function StatusTile({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="rounded-lg bg-muted p-2">
      <div className="text-[10px] text-muted-foreground">{label}</div>
      <div className={`text-xs font-semibold ${color}`}>{value}</div>
    </div>
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

function ProductList({ products }: { products: ProductInteraction[] }) {
  return (
    <ul className="space-y-1">
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


