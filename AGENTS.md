<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Mercado Pago (Etapa 4)

Stack: TanStack Start 1.168.26 + React + Vite + Supabase. `createAPIFileRoute`
does **not** exist in this version; the webhook is intercepted in `src/server.ts`
fetch handler at `/api/webhooks/mercadopago` (must run before `getServerEntry()`).

### Env vars (fallback — pode configurar pelo painel)
As credenciais podem ser adicionadas na UI em **Admin → Configurações → "Mercado Pago — Credenciais"** (gravadas em `platform_settings`, service_role apenas). As env vars abaixo servem de fallback:
- `MERCADO_PAGO_CLIENT_ID` / `_CLIENT_SECRET` / `_PUBLIC_KEY` / `_ACCESS_TOKEN`
- `MERCADO_PAGO_WEBHOOK_SECRET` (HMAC de `id:{id};request-id:{rid};ts:{ts};`)
- `MERCADO_PAGO_REDIRECT_URI` (OAuth callback)
- `MERCADO_PAGO_ENCRYPTION_KEY` (AES-GCM para tokens; cai para texto puro em dev)

Prioridade: valor em `platform_settings` (painel) > env var. A resolução acontece
em `src/lib/mp-settings.server.ts` com cache de 15s (invalidado ao salvar).
`.env` guarda apenas placeholders. Não há credenciais reais ainda — nada pode ser
testado ponta a ponta até serem fornecidas.

### Admin: credenciais pela UI
- `src/routes/_authenticated.admin.configuracoes.tsx` — seções por credencial
  (Client ID, Client Secret, Public Key, Access Token, Webhook Secret,
  Redirect URI, Encryption Key). Campos vazios mantêm o valor atual.
- `src/lib/mercadopago-settings.functions.ts` — server fns `get/saveMercadoPagoSettings`
  (admin-only via `user_roles.role='admin'`; get retorna apenas status mascarado,
  nunca os valores).
- `supabase/migrations/20260802120000_platform_settings.sql` — tabela de 1 linha
  (id=1), sem policies (só service_role).

### Architecture
- PKCE OAuth flow: `src/lib/mercadopago.functions.ts` (states in
  `payment_oauth_states` with `code_verifier`/`code_challenge`, single state per
  `business_id`, TTL 10 min); account stored in `merchant_payment_accounts`
  (tokens encrypted via `src/lib/token-crypto.server.ts`).
- Server-only config: `src/lib/mercadopago.server.ts`. Server functions must
  never leak `client_secret`/`access_token`/`refresh_token` to the client.
- Checkout: `src/lib/mercadopago.checkout.functions.ts` + `src/services/payment`.
  Checkout Bricks **in-page only** (never redirect/Checkout Pro), SDK loaded at
  runtime from `https://sdk.mercadopago.com/js/v2`.
- Webhook: `src/lib/mercadopago-webhook.server.ts` — verifies HMAC + idempotency
  (`orders.payment_id` + `payment_status !== 'pending'`), fetches payment, updates
  order by `external_reference` or `merchant_id`+`payment_id`.
- Order statuses: new enum values `awaiting_payment`, `payment_approved`,
  `delivered` kept alongside legacy values. DB `payment_status` stores canonical
  values (`paid`/`pending`/`cancelled`/`refunded`/`failed`).

### Schema
Migrations in `supabase/migrations/`:
`20260802090000_merchant_payment_accounts.sql`,
`20260802100000_orders_etapa4.sql`,
`20260802110000_orders_etapa4_rpc.sql` (`create_customer_order` with
`_payment_provider`/`_session_id`).

### Dev commands
- `npm run typecheck` — pre-existing errors in `ClientSessionGuard.tsx` and
  `_authenticated.admin.tsx` are unrelated to this feature.
- `npm run lint` — run after any change.

