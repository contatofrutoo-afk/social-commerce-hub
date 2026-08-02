// Conexão OAuth com o Mercado Pago — roda exclusivamente no backend.
//
// O cliente nunca recebe client_secret, access_token ou refresh_token:
// cada server function valida a sessão do painel (JWT) e usa o cliente
// admin do Supabase (service_role) para persistir as credenciais.
//
// Etapa 4:
//  - PKCE (code_verifier/code_challenge S256).
//  - Persistência em merchant_payment_accounts.
//  - Tokens criptografados em repouso (MERCADO_PAGO_ENCRYPTION_KEY).
//  - Checkout e webhook vivem em mercadopago.checkout.functions.ts.
import { createServerFn } from "@tanstack/react-start";
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
  | {
      status: "unauthorized" | "invalid_state" | "invalid_token" | "unavailable";
      reason?: string;
    };

export type MercadoPagoAccountResult =
  | { status: "success"; account: PaymentAccountPublic | null }
  | { status: "unauthorized" };

export type MercadoPagoDisconnectResult = { status: "success" } | { status: "unauthorized" };

export type MercadoPagoRefreshResult =
  | { status: "success"; refreshed: boolean }
  | { status: "unauthorized" | "not_configured" | "unavailable" | "invalid_token" | "no_token" };

function randomBase64Url(bytes: number): string {
  const arr = new Uint8Array(bytes);
  globalThis.crypto.getRandomValues(arr);
  return Buffer.from(arr).toString("base64url");
}

async function pkceChallenge(verifier: string): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(verifier),
  );
  return Buffer.from(new Uint8Array(digest)).toString("base64url");
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

function sanitizeAccount(row: {
  provider: string | null;
  connected: boolean | null;
  account_name?: string | null;
  account_id?: string | null;
  provider_user_id: string | null;
  connected_at?: string | null;
  last_sync_at: string | null;
  updated_at: string | null;
  expires_at: string | null;
} | null): PaymentAccountPublic | null {
  if (!row) return null;
  return {
    provider: row.provider ?? "mercadopago",
    status: row.connected ? "connected" : "disconnected",
    accountName: row.account_name ?? null,
    accountId: row.account_id ?? null,
    providerUserId: row.provider_user_id,
    connectedAt: row.connected_at ?? null,
    lastSyncAt: row.last_sync_at,
    updatedAt: row.updated_at,
    expiresAt: row.expires_at,
  };
}

const PUBLIC_COLUMNS =
  "provider, connected, account_name, account_id, provider_user_id, connected_at, last_sync_at, updated_at, expires_at";

async function insertOAuthState(
  businessId: string,
  state: string,
  redirectUri: string,
  codeVerifier: string,
  codeChallenge: string,
): Promise<void> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await supabaseAdmin.from("payment_oauth_states").delete().eq("business_id", businessId);
  await supabaseAdmin.from("payment_oauth_states").insert({
    business_id: businessId,
    state,
    redirect_uri: redirectUri,
    code_verifier: codeVerifier,
    code_challenge: codeChallenge,
    expires_at: new Date(Date.now() + OAUTH_STATE_TTL_MS).toISOString(),
  });
}

const JwtInput = z.object({ jwt: z.string().min(1) });

/**
 * Inicia o fluxo OAuth com PKCE: gera code_verifier/challenge, grava o state
 * (vínculo com o business_id, anti-CSRF) e devolve a URL de autorização.
 */
export const startMercadoPagoOAuth = createServerFn({ method: "POST" })
  .inputValidator((raw) => JwtInput.parse(raw))
  .handler(async ({ data }): Promise<MercadoPagoStartResult> => {
    const businessId = await getBusinessIdFromJwt(data.jwt);
    if (!businessId) return { status: "unauthorized" };

    const { requireClientCredentials, resolveRedirectUri } = await import(
      "@/lib/mercadopago.server"
    );
    let clientId: string;
    try {
      ({ clientId } = await requireClientCredentials());
    } catch {
      return { status: "not_configured" };
    }

    const redirectUri = await resolveRedirectUri();
    const state = crypto.randomUUID();
    const codeVerifier = randomBase64Url(43);
    const codeChallenge = await pkceChallenge(codeVerifier);
    await insertOAuthState(businessId, state, redirectUri, codeVerifier, codeChallenge);

    const params = new URLSearchParams({
      response_type: "code",
      client_id: clientId,
      platform_id: "mp",
      redirect_uri: redirectUri,
      state,
      scope: "offline_access read",
      code_challenge: codeChallenge,
      code_challenge_method: "S256",
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
 * Troca o authorization_code por tokens (enviando o code_verifier do PKCE) e
 * persiste em merchant_payment_accounts com os tokens criptografados.
 */
export const exchangeMercadoPagoCode = createServerFn({ method: "POST" })
  .inputValidator((raw) => ExchangeInput.parse(raw))
  .handler(async ({ data }): Promise<MercadoPagoExchangeResult> => {
    const businessId = await getBusinessIdFromJwt(data.jwt);
    if (!businessId) return { status: "unauthorized" };

    const { requireClientCredentials, resolveRedirectUri, logPaymentEvent } = await import(
      "@/lib/mercadopago.server"
    );
    const { encryptToken } = await import("@/lib/token-crypto.server");

    let clientId: string;
    let clientSecret: string;
    try {
      ({ clientId, clientSecret } = await requireClientCredentials());
    } catch {
      return { status: "invalid_token" };
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: stateRow } = await supabaseAdmin
      .from("payment_oauth_states")
      .select("business_id, code_verifier, redirect_uri")
      .eq("state", data.state)
      .maybeSingle();
    if (!stateRow || stateRow.business_id !== businessId) {
      return { status: "invalid_state" };
    }
    await supabaseAdmin.from("payment_oauth_states").delete().eq("state", data.state);

    // Reutiliza o redirect_uri gravado no início do fluxo (o MP exige que o
    // redirect_uri do token exchange seja EXATAMENTE o usado na autorização).
    const redirectUri = stateRow.redirect_uri ?? (await resolveRedirectUri());

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
          code_verifier: stateRow.code_verifier ?? "",
        }),
      });
    } catch {
      await logPaymentEvent(businessId, "Erro OAuth", { stage: "token_exchange", reason: "network" });
      return { status: "unavailable" };
    }

    if (!tokenRes.ok) {
      let message: string | null = null;
      try {
        const body = (await tokenRes.json()) as { message?: string; error_description?: string };
        message = body.message ?? body.error_description ?? null;
      } catch {
        // corpo não-JSON: ignora
      }
      await logPaymentEvent(businessId, "Erro OAuth", {
        stage: "token_exchange",
        status: tokenRes.status,
        message,
      });
      return tokenRes.status >= 500
        ? { status: "unavailable", reason: message ?? undefined }
        : { status: "invalid_token", reason: message ?? undefined };
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

    let accountName: string | null = null;
    let accountId: string | null = null;
    try {
      const meRes = await fetch(MERCADO_PAGO_USERS_ME_URL, {
        headers: { accept: "application/json", authorization: `Bearer ${tokenData.access_token}` },
      });
      if (meRes.ok) {
        const me = (await meRes.json()) as {
          nickname?: string;
          first_name?: string;
          last_name?: string;
          id?: number;
        };
        accountName = me.nickname || [me.first_name, me.last_name].filter(Boolean).join(" ") || null;
        accountId = me.id != null ? String(me.id) : null;
      }
    } catch {
      // best-effort — não invalida a conexão
    }

    const now = new Date().toISOString();
    const encryptedAccess = await encryptToken(tokenData.access_token);
    const encryptedRefresh = await encryptToken(tokenData.refresh_token ?? null);

    const { error: upsertErr } = await supabaseAdmin
      .from("merchant_payment_accounts")
      .upsert(
        {
          merchant_id: businessId,
          provider: "mercadopago",
          connected: true,
          account_name: accountName,
          account_id: accountId,
          provider_user_id: providerUserId,
          access_token: encryptedAccess,
          refresh_token: encryptedRefresh,
          expires_at: expiresAt,
          last_sync_at: now,
          connected_at: now,
          updated_at: now,
        },
        { onConflict: "merchant_id,provider" },
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
      .from("merchant_payment_accounts")
      .select(PUBLIC_COLUMNS)
      .eq("merchant_id", businessId)
      .eq("provider", "mercadopago")
      .maybeSingle();

    const account = sanitizeAccount(saved);
    if (!account) return { status: "unavailable" };
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
      .from("merchant_payment_accounts")
      .select(PUBLIC_COLUMNS)
      .eq("merchant_id", businessId)
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

    const { logPaymentEvent } = await import("@/lib/mercadopago.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("merchant_payment_accounts")
      .update({
        connected: false,
        access_token: null,
        refresh_token: null,
        provider_user_id: null,
        expires_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq("merchant_id", businessId)
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

    const { requireClientCredentials, logPaymentEvent } = await import(
      "@/lib/mercadopago.server"
    );
    const { encryptToken, decryptToken } = await import("@/lib/token-crypto.server");

    let clientId: string;
    let clientSecret: string;
    try {
      ({ clientId, clientSecret } = await requireClientCredentials());
    } catch {
      return { status: "not_configured" };
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("merchant_payment_accounts")
      .select("refresh_token, expires_at")
      .eq("merchant_id", businessId)
      .eq("provider", "mercadopago")
      .maybeSingle();

    if (!row?.refresh_token) return { status: "no_token" };

    const refreshToken = await decryptToken(row.refresh_token);
    if (!refreshToken) return { status: "invalid_token" };

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
          refresh_token: refreshToken,
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
    if (!tokenData.access_token) return { status: "invalid_token" };

    const encryptedAccess = await encryptToken(tokenData.access_token);
    const encryptedRefresh = await encryptToken(tokenData.refresh_token ?? refreshToken);

    await supabaseAdmin
      .from("merchant_payment_accounts")
      .update({
        access_token: encryptedAccess,
        refresh_token: encryptedRefresh,
        expires_at: tokenData.expires_in
          ? new Date(Date.now() + tokenData.expires_in * 1000).toISOString()
          : null,
        last_sync_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("merchant_id", businessId)
      .eq("provider", "mercadopago");

    await logPaymentEvent(businessId, "Atualização de token", { provider: "mercadopago" });
    return { status: "success", refreshed: true };
  });
