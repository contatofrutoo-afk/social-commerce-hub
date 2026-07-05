# WEAZE MVP — Reconstrução

Plataforma de Social Commerce para negócios físicos. Frontend → Repository → Lovable Cloud (única fonte de verdade). Sem localStorage para dados, sem stores paralelas, sem mocks permanentes.

## 1. Fundação (Etapa 1)

- Ativar Lovable Cloud (Supabase gerenciado).
- Design system WEAZE em `src/styles.css`: primary `#8800AA`, branco, preto; tipografia moderna; tokens semânticos (background, foreground, primary, accent, muted). Variantes shadcn customizadas (button "hero", "brand").
- Estrutura de pastas:
  ```
  src/
    repositories/        ← única porta para dados
      customer.repository.ts
      company.repository.ts
      product.repository.ts
      post.repository.ts
      comment.repository.ts
      order.repository.ts
      checkin.repository.ts
      table.repository.ts
      settings.repository.ts
      types.ts
    lib/
      session.ts         ← identidade do cliente B2C (id do customer + companyId ativo)
    components/weaze/    ← componentes de UI reutilizáveis
    routes/              ← file-based routing
  ```
- Repositories retornam tipos de domínio (não linhas cruas), assinam interfaces. Trocar Cloud por Supabase/Firebase = reescrever só o repository.

## 2. Schema Lovable Cloud (migração)

Tabelas em `public` com RLS + GRANTs explícitos:

- `companies` (id, name, slug, logo_url, primary_color, created_at)
- `tables` (id, company_id, label, slug)
- `customers` (id, company_id, name, whatsapp, avatar_url, first_visit_at, last_visit_at, visit_count)
- `checkins` (id, customer_id, company_id, table_id?, context: sozinho|casal|amigos|familia, source, created_at)
- `products` (id, company_id, name, category, price, image_url, available, description)
- `posts` (id, company_id, author_type: business|customer, customer_id?, image_url, video_url?, text, category?, companions?, created_at)
- `post_products` (post_id, product_id) — produtos marcados em posts do negócio
- `post_reactions` (post_id, customer_id, type: love|dislike)
- `comments` (id, post_id, customer_id, text, image_url?, created_at)
- `product_likes` (product_id, customer_id)
- `product_wishes` (product_id, customer_id)
- `orders` (id, company_id, customer_id, table_id?, status: received|completed, total, note?, created_at)
- `order_items` (id, order_id, product_id, quantity, note?, unit_price)
- `settings` (company_id PK, brand_color, welcome_message, etc.)

RLS: B2C escreve como `anon` limitado à sua sessão de customer (id no localStorage — apenas o ID de sessão, não dados). B2B lê/escreve tudo da sua company via `authenticated` + `has_role`. Roles em `user_roles` + `has_role()` (SECURITY DEFINER).

Seed mínimo (1 company demo + 6 produtos + 4 mesas + 3 posts) via migration, marcado como demo — não permanente na lógica da app.

## 3. Área B2C

Rotas públicas:

- `/c/$companySlug` — landing / captura (nome + WhatsApp + contexto) → cria customer + checkin, sessão salva ID.
- `/c/$companySlug/m/$tableSlug` — mesma coisa mas com mesa.
- `/c/$companySlug/feed` — feed misto (posts do negócio + posts de clientes), reações, comentários, botão "Adicionar à Sacola" só em posts do negócio.
- `/c/$companySlug/publicar` — cliente publica experiência (imagem, texto, categoria, companhia).
- `/c/$companySlug/sacola` — itens, quantidade, observação, enviar pedido.
- `/c/$companySlug/perfil` — nome, WhatsApp, avatar opcional, editar.

`lib/session.ts` guarda apenas `{ customerId, companyId }` no localStorage (identidade de sessão, não dados).

## 4. Área B2B (dashboard)

Sob `/_authenticated/app/*` (gate integrado). Auth = email/senha simples do Supabase.

- `/app` Dashboard — contadores reais via repositories (clientes cadastrados/ativos, pedidos, interações, produtos mais curtidos, presentes agora, quebra por contexto, novos vs recorrentes, últimas atividades).
- `/app/clientes` — lista + detalhe (visitas, contextos, pedidos, curtidos, desejados, sacola, publicações, comentários).
- `/app/feed` — publicar conteúdo do negócio, marcar produtos.
- `/app/produtos` — CRUD simples.
- `/app/pedidos` — kanban 2 colunas: Recebido / Concluído.
- `/app/atendimento` — abas Mesas (grid de mesas com cliente atual + contexto) e Loja (clientes presentes agora, clique abre painel com nome, contexto, últimos pedidos, favoritos, interesses, sugestão simples).
- `/app/configuracoes` — company, mesas, tema.

## 5. Repository Layer

Cada repository expõe métodos assíncronos tipados, ex.:

```ts
export const customerRepository = {
  findById(id: string): Promise<Customer | null>,
  listByCompany(companyId: string, filters?): Promise<Customer[]>,
  upsertByWhatsapp(companyId, data): Promise<Customer>,
  getFullProfile(id): Promise<CustomerProfile>, // agrega visitas, pedidos, likes
}
```

Repositories usam:
- Server publishable client (leitura pública com policies TO anon) em server functions.
- `requireSupabaseAuth` para operações B2B.
- Browser client apenas para realtime/subscriptions do feed.

TanStack Query em cima dos repositories: `queryOptions` centralizados em `src/repositories/queries.ts`.

## 6. Fora de escopo (explicitamente)

Sem ERP, sem PDV, sem financeiro, sem métricas avançadas, sem gamificação, sem push, sem notificações, sem multi-tenant UI (uma company demo inicial), sem pagamentos.

## 7. Ordem de execução

1. Ativar Cloud + migration (schema + RLS + GRANTs + seed demo).
2. Design system + rotas base + auth B2B.
3. Repositories + queries.
4. Fluxo B2C completo (checkin → feed → sacola → pedido).
5. Dashboard B2B (todas as telas listadas).
6. Atendimento (mesas + loja) com realtime.
7. Polimento visual + testes de ponta-a-ponta manual.

## Detalhes técnicos

- Stack: TanStack Start (já configurado), TanStack Query, shadcn, Tailwind v4.
- Realtime opcional via `supabase.channel()` para feed, pedidos, atendimento (adia se atrasar MVP).
- Uploads de imagem: Supabase Storage bucket `weaze-media` público read.
- Sem `pages/`, sem stores globais (Zustand/Redux) — Query cache é o estado servidor; UI state local com `useState`.

Confirma para eu começar pela Etapa 1 (Cloud + schema + design system + auth B2B)?
