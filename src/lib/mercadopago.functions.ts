// Conexão OAuth com o Mercado Pago — roda exclusivamente no backend.
//
// O cliente nunca recebe client_secret, access_token ou refresh_token:
// cada server function valida a sessão do painel (JWT) e usa o cliente
// admin do Supabase (service_role) para persistir as credenciais.
//
// Etapa atual: apenas conectar/desconectar/status. Checkout, cobranças e
// pagamentos ficam para uma fase posterior.
import { createServerFn } from "@tanstack/react-start";
import { getRequestUrl } from "@tanstack/react-start/server";
import { z } from "zod";
import type { PaymentAccountPublic } from "@/services/payment/types";

const MERCADO_PAGO_AUTH_URL = "https://auth.mercadopago.com.br/authorization";
const MERCADO_PAGO_TOKEN_URL = "https://api.mercadopago.com/oauth/token";
const MERCADO_PAGO_USERS_ME_URL = "https://api.mercadopago.com/users/me";
const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;

export type MercadoPagoStartResult =
  | { status: "success"; url: string; redirectUri: string }
  | { status: "unauthorized" }
  | { status: "not_configured" };

export type MercadoPagoExchangeResult =
  | { status: "success"; account: PaymentAccountPublic }
  | { status: "unauthorized" | "invalid_state" | "invalid_token" | "unavailable" };

export type MercadoPagoAccountResult =
  | { status: "success"; account: PaymentAccountPublic | null }
  | { status: "unauthorized" };

export type MercadoPagoDisconnectResult = { status: "success" } | { status: "unauthorized" };

export type MercadoPagoRefreshResult =
  | { status: "success"; refreshed: boolean }
  | { status: "unauthorized" | "not_configured" | "unavailable" | "invalid_token" | "no_token" };

function mpConfig(): { clientId: string; clientSecret: string } {
  const clientId = process.env.MERCADO_PAGO_CLIENT_ID;
  const clientSecret = process.env.MERCADO_PAGO_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error(
      "Mercado Pago não configurado: defina MERCADO_PAGO_CLIENT_ID e MERCADO_PAGO_CLIENT_SECRET.",
    );
  }
  return { clientId, clientSecret };
}

function resolveRedirectUri(): string {
  if (process.env.MERCADO_PAGO_REDIRECT_URI) return process.env.MERCADO_PAGO_REDIRECT_URI;
  const requestUrl = getRequestUrl({ xForwardedHost: true, xForwardedProto: true });
  return `${requestUrl.origin}/oauth/mercadopago/callback`;
}

/** Resolve o business_id (empresa) a partir do JWT da sessão do painel. */
async function getBusinessIdFromJwt(jwt: string): Promise<string | null> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: userData, error } = await supabaseAdmin.auth.getUser(jwt);
    if (error || !userData?.user) return null;
    const { data: role } = await supabaseAdmin
      .from("user_roles")
      .select("company_id")
      .eq("user_id", userData.user.id)
      .limit(1)
      .maybeSingle();
    return role?.company_id ?? null;
  } catch {
    return null;
  }
}

/** Auditoria do módulo financeiro — nunca deve quebrar o fluxo. */
async function logPaymentEvent(businessId: string, event: string, payload?: unknown): Promise<void> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("payment_logs").insert({
      business_id: businessId,
      event,
      payload: (payload ?? null) as never,
    });
  } catch {
    // auditoria é best-effort
  }
}

function sanitizeAccount(row: {
  provider: string | null;
  status: string | null;
  account_name: string | null;
  account_id: string | null;
  provider_user_id: string | null;
  connected_at: string | null;
  last_sync_at: string | null;
  updated_at: string | null;
  expires_at: string | null;
} | null): PaymentAccountPublic | null {
  if (!row) return null;
  return {
    provider: row.provider ?? "",
    status: row.status ?? "disconnected",
    accountName: row.account_name,
    accountId: row.account_id,
    providerUserId: row.provider_user_id,
    connectedAt: row.connected_at,
    lastSyncAt: row.last_sync_at,
    updatedAt: row.updated_at,
    expiresAt: row.expires_at,
  };
}

async function insertOAuthState(businessId: string, state: string, redirectUri: string): Promise<void> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  // limpa fluxos antigos/expirados da mesma empresa antes de iniciar um novo
  await supabaseAdmin.from("payment_oauth_states").delete().eq("business_id", businessId);
  await supabaseAdmin.from("payment_oauth_states").insert({
    business_id: businessId,
    state,
    redirect_uri: redirectUri,
    expires_at: new Date(Date.now() + OAUTH_STATE_TTL_MS).toISOString(),
  });
}

const JwtInput = z.object({ jwt: z.string().min(1) });

/**
 * Inicia o fluxo OAuth: gera o state (gravado no banco com o business_id),
 * monta a URL de autorização do Mercado Pago e a devolve ao painel.
 */
export const startMercadoPagoOAuth = createServerFn({ method: "POST" })
  .inputValidator((raw) => JwtInput.parse(raw))
  .handler(async ({ data }): Promise<MercadoPagoStartResult> => {
    const businessId = await getBusinessIdFromJwt(data.jwt);
    if (!businessId) return { status: "unauthorized" };

    let clientId: string;
    let clientSecret: string;
    try {
      ({ clientId, clientSecret } = mpConfig());
    } catch {
      return { status: "not_configured" };
    }
    void clientSecret;

    const redirectUri = resolveRedirectUri();
    const state = crypto.randomUUID();
    await insertOAuthState(businessId, state, redirectUri);

    const params = new URLSearchParams({
      response_type: "code",
      client_id: clientId,
      redirect_uri: redirectUri,
      state,
      scope: "offline_access read",
    });

    return {
      status: "success",
      url: `${MERCADO_PAGO_AUTH_URL}?${params.toString()}`,
      redirectUri,
    };
  });

const ExchangeInput = z.object({
  jwt: z.string().min(1),
  code: z.string().min(1),
  state: z.string().min(1),
});

/**
 * Recebe o authorization_code de volta do Mercado Pago, troca por
 * access_token/refresh_token e salva na conta de pagamento da empresa.
 */
export const exchangeMercadoPagoCode = createServerFn({ method: "POST" })
  .inputValidator((raw) => ExchangeInput.parse(raw))
  .handler(async ({ data }): Promise<MercadoPagoExchangeResult> => {
    const businessId = await getBusinessIdFromJwt(data.jwt);
    if (!businessId) return { status: "unauthorized" };

    let clientId: string;
    let clientSecret: string;
    try {
      ({ clientId, clientSecret } = mpConfig());
    } catch {
      return { status: "invalid_token" };
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Valida o state: o fluxo precisa ter sido iniciado por um membro da
    // mesma empresa (anti-CSRF).
    const { data: stateRow } = await supabaseAdmin
      .from("payment_oauth_states")
      .select("business_id")
      .eq("state", data.state)
      .maybeSingle();
    if (!stateRow || stateRow.business_id !== businessId) {
      return { status: "invalid_state" };
    }
    await supabaseAdmin.from("payment_oauth_states").delete().eq("state", data.state);

    const redirectUri = resolveRedirectUri();

    let tokenRes: Response;
    try {
      tokenRes = await fetch(MERCADO_PAGO_TOKEN_URL, {
        method: "POST",
        headers: {
          accept: "application/json",
          "content-type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          client_id: clientId,
          client_secret: clientSecret,
          code: data.code,
          redirect_uri: redirectUri,
        }),
      });
    } catch {
      await logPaymentEvent(businessId, "Erro OAuth", { stage: "token_exchange", reason: "network" });
      return { status: "unavailable" };
    }

    if (!tokenRes.ok) {
      await logPaymentEvent(businessId, "Erro OAuth", {
        stage: "token_exchange",
        status: tokenRes.status,
      });
      return tokenRes.status >= 500 ? { status: "unavailable" } : { status: "invalid_token" };
    }

    let tokenData: { access_token?: string; refresh_token?: string; user_id?: string; expires_in?: number };
    try {
      tokenData = (await tokenRes.json()) as typeof tokenData;
    } catch {
      return { status: "invalid_token" };
    }

    if (!tokenData.access_token) {
      await logPaymentEvent(businessId, "Erro OAuth", { stage: "token_exchange", missing: "access_token" });
      return { status: "invalid_token" };
    }

    const expiresAt = tokenData.expires_in
      ? new Date(Date.now() + tokenData.expires_in * 1000).toISOString()
      : null;
    const providerUserId = tokenData.user_id ? String(tokenData.user_id) : null;

    // Best-effort: nome público da conta (nickname) via /users/me.
    let accountName: string | null = null;
    try {
      const meRes = await fetch(MERCADO_PAGO_USERS_ME_URL, {
        headers: { accept: "application/json", authorization: `Bearer ${tokenData.access_token}` },
      });
      if (meRes.ok) {
        const me = (await meRes.json()) as {
          nickname?: string;
          first_name?: string;
          last_name?: string;
        };
        accountName = me.nickname || [me.first_name, me.last_name].filter(Boolean).join(" ") || null;
      }
    } catch {
      // best-effort — não invalida a conexão
    }

    const now = new Date().toISOString();
    const { error: upsertErr } = await supabaseAdmin.from("payment_accounts").upsert(
      {
        business_id: businessId,
        provider: "mercadopago",
        status: "connected",
        account_name: accountName,
        account_id: providerUserId,
        provider_user_id: providerUserId,
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token ?? null,
        expires_at: expiresAt,
        last_sync_at: now,
        connected_at: now,
        updated_at: now,
      },
      { onConflict: "business_id,provider" },
    );

    if (upsertErr) {
      await logPaymentEvent(businessId, "Erro OAuth", { stage: "persist", message: upsertErr.message });
      return { status: "unavailable" };
    }

    await logPaymentEvent(businessId, "Conta conectada", {
      provider: "mercadopago",
      provider_user_id: providerUserId,
    });

    const { data: saved } = await supabaseAdmin
      .from("payment_accounts")
      .select(
        "provider, status, account_name, account_id, provider_user_id, connected_at, last_sync_at, updated_at, expires_at",
      )
      .eq("business_id", businessId)
      .eq("provider", "mercadopago")
      .maybeSingle();

    const account = sanitizeAccount(saved);
    if (!account) {
      return { status: "unavailable" };
    }

    return { status: "success", account };
  });

/** Status atual da conta do Mercado Pago da empresa (sem tokens). */
export const getMercadoPagoAccount = createServerFn({ method: "POST" })
  .inputValidator((raw) => JwtInput.parse(raw))
  .handler(async ({ data }): Promise<MercadoPagoAccountResult> => {
    const businessId = await getBusinessIdFromJwt(data.jwt);
    if (!businessId) return { status: "unauthorized" };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("payment_accounts")
      .select(
        "provider, status, account_name, account_id, provider_user_id, connected_at, last_sync_at, updated_at, expires_at",
      )
      .eq("business_id", businessId)
      .eq("provider", "mercadopago")
      .maybeSingle();

    return { status: "success", account: sanitizeAccount(row) };
  });

/** Desconecta a conta: limpa credenciais e marca como desconectada. */
export const disconnectMercadoPagoAccount = createServerFn({ method: "POST" })
  .inputValidator((raw) => JwtInput.parse(raw))
  .handler(async ({ data }): Promise<MercadoPagoDisconnectResult> => {
    const businessId = await getBusinessIdFromJwt(data.jwt);
    if (!businessId) return { status: "unauthorized" };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("payment_accounts")
      .update({
        status: "disconnected",
        access_token: null,
        refresh_token: null,
        provider_user_id: null,
        expires_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq("business_id", businessId)
      .eq("provider", "mercadopago");

    await logPaymentEvent(businessId, "Conta desconectada", { provider: "mercadopago" });
    return { status: "success" };
  });

/** Renova o access_token quando expirado ou próximo de expirar. */
export const refreshMercadoPagoToken = createServerFn({ method: "POST" })
  .inputValidator((raw) => JwtInput.parse(raw))
  .handler(async ({ data }): Promise<MercadoPagoRefreshResult> => {
    const businessId = await getBusinessIdFromJwt(data.jwt);
    if (!businessId) return { status: "unauthorized" };

    let clientId: string;
    let clientSecret: string;
    try {
      ({ clientId, clientSecret } = mpConfig());
    } catch {
      return { status: "not_configured" };
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("payment_accounts")
      .select("refresh_token, expires_at")
      .eq("business_id", businessId)
      .eq("provider", "mercadopago")
      .maybeSingle();

    if (!row?.refresh_token) return { status: "no_token" };

    const expiresAt = row.expires_at ? new Date(row.expires_at).getTime() : null;
    if (expiresAt && expiresAt > Date.now() + 5 * 60 * 1000) {
      return { status: "success", refreshed: false };
    }

    let tokenRes: Response;
    try {
      tokenRes = await fetch(MERCADO_PAGO_TOKEN_URL, {
        method: "POST",
        headers: {
          accept: "application/json",
          "content-type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          grant_type: "refresh_token",
          client_id: clientId,
          client_secret: clientSecret,
          refresh_token: row.refresh_token,
        }),
      });
    } catch {
      await logPaymentEvent(businessId, "Erro OAuth", { stage: "refresh", reason: "network" });
      return { status: "unavailable" };
    }

    if (!tokenRes.ok) {
      const expired = expiresAt !== null && expiresAt <= Date.now();
      await logPaymentEvent(businessId, expired ? "Token expirado" : "Erro OAuth", {
        stage: "refresh",
        status: tokenRes.status,
      });
      return tokenRes.status >= 500 ? { status: "unavailable" } : { status: "invalid_token" };
    }

    const tokenData = (await tokenRes.json()) as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
    };
    if (!tokenData.access_token) {
      return { status: "invalid_token" };
    }

    await supabaseAdmin
      .from("payment_accounts")
      .update({
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token ?? row.refresh_token,
        expires_at: tokenData.expires_in
          ? new Date(Date.now() + tokenData.expires_in * 1000).toISOString()
          : null,
        last_sync_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("business_id", businessId)
      .eq("provider", "mercadopago");

    await logPaymentEvent(businessId, "Atualização de token", { provider: "mercadopago" });
    return { status: "success", refreshed: true };
  });
