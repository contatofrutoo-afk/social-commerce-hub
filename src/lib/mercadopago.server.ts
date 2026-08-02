// Utilitários server-only do Mercado Pago (config + acesso ao token do
// comerciante). Nunca importar em código cliente.
import { getRequestUrl } from "@tanstack/react-start/server";
import { decryptToken } from "@/lib/token-crypto.server";
import { resolveMpConfig } from "@/lib/mp-settings.server";

export interface MercadoPagoConfig {
  clientId: string | null;
  clientSecret: string | null;
  publicKey: string | null;
  accessToken: string | null;
  webhookSecret: string | null;
}

/** Config mergida (platform_settings do painel > env vars). Sempre assíncrona. */
export async function mpConfig(): Promise<MercadoPagoConfig> {
  const config = await resolveMpConfig();
  return {
    clientId: config.clientId,
    clientSecret: config.clientSecret,
    publicKey: config.publicKey,
    accessToken: config.accessToken,
    webhookSecret: config.webhookSecret,
  };
}

export async function requireClientCredentials(): Promise<{ clientId: string; clientSecret: string }> {
  const { clientId, clientSecret } = await mpConfig();
  if (!clientId || !clientSecret) {
    throw new Error(
      "Mercado Pago não configurado: defina MERCADO_PAGO_CLIENT_ID e MERCADO_PAGO_CLIENT_SECRET.",
    );
  }
  return { clientId, clientSecret };
}

export async function resolveRedirectUri(): Promise<string> {
  const { redirectUri } = await resolveMpConfig();
  if (redirectUri) return redirectUri;
  const requestUrl = getRequestUrl({ xForwardedHost: true, xForwardedProto: true });
  return `${requestUrl.origin}/oauth/mercadopago/callback`;
}

export function resolveWebhookUrl(): string {
  if (process.env.MERCADO_PAGO_WEBHOOK_URL) return process.env.MERCADO_PAGO_WEBHOOK_URL;
  const requestUrl = getRequestUrl({ xForwardedHost: true, xForwardedProto: true });
  return `${requestUrl.origin}/api/webhooks/mercadopago`;
}

export async function loadSupabaseAdmin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

/**
 * Retorna o access_token do Mercado Pago do comerciante (descriptografado).
 * Fallback para MERCADO_PAGO_ACCESS_TOKEN apenas em ambiente de teste,
 * quando o comerciante ainda não conectou a própria conta.
 */
export async function resolveMerchantAccessToken(
  merchantId: string,
): Promise<{ token: string; source: "merchant" | "env" }> {
  const supabaseAdmin = await loadSupabaseAdmin();
  const { data: row } = await supabaseAdmin
    .from("merchant_payment_accounts")
    .select("access_token, connected")
    .eq("merchant_id", merchantId)
    .eq("provider", "mercadopago")
    .maybeSingle();

  if (row?.connected && row.access_token) {
    const token = await decryptToken(row.access_token);
    if (token) return { token, source: "merchant" };
  }

  const { accessToken } = await mpConfig();
  if (accessToken) return { token: accessToken, source: "env" };

  throw new Error(
    "Este estabelecimento ainda não conectou uma conta Mercado Pago. Conecte pelo painel em Integrações.",
  );
}

export async function logPaymentEvent(
  merchantId: string,
  event: string,
  payload?: unknown,
): Promise<void> {
  try {
    const supabaseAdmin = await loadSupabaseAdmin();
    await supabaseAdmin.from("payment_logs").insert({
      business_id: merchantId,
      event,
      payload: (payload ?? null) as never,
    });
  } catch {
    // auditoria é best-effort
  }
}
