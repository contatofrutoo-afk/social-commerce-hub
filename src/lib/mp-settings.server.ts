// Configuração global do Mercado Pago — mergida de `platform_settings`
// (gravada pelo painel admin) + env vars. Apenas servidor.
//
// Prioridade: valor gravado no banco (painel) > env var. O cache em memória
// (TTL curto) evita uma consulta ao Supabase a cada request sem deixar a
// configuração defasada por muito tempo.

export interface ResolvedMpConfig {
  clientId: string | null;
  clientSecret: string | null;
  publicKey: string | null;
  accessToken: string | null;
  webhookSecret: string | null;
  redirectUri: string | null;
  encryptionKey: string | null;
}

const CACHE_TTL_MS = 15 * 1000;

let cachedAt = 0;
let cachedConfig: ResolvedMpConfig | null = null;

function pick(db: string | null | undefined, env: string | undefined): string | null {
  const value = db && db.trim() !== "" ? db : env && env.trim() !== "" ? env : null;
  return value;
}

async function loadRow(): Promise<{
  mercadopago_client_id?: string | null;
  mercadopago_client_secret?: string | null;
  mercadopago_public_key?: string | null;
  mercadopago_access_token?: string | null;
  mercadopago_webhook_secret?: string | null;
  mercadopago_redirect_uri?: string | null;
  mercadopago_encryption_key?: string | null;
} | null> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("platform_settings")
      .select(
        "mercadopago_client_id, mercadopago_client_secret, mercadopago_public_key, mercadopago_access_token, mercadopago_webhook_secret, mercadopago_redirect_uri, mercadopago_encryption_key",
      )
      .eq("id", 1)
      .maybeSingle();
    return data ?? null;
  } catch {
    return null;
  }
}

export { loadRow as loadMpRow };

function rawConfig(db: Record<string, string | null | undefined> | null): ResolvedMpConfig {
  return {
    clientId: pick(db?.mercadopago_client_id, process.env.MERCADO_PAGO_CLIENT_ID),
    clientSecret: pick(db?.mercadopago_client_secret, process.env.MERCADO_PAGO_CLIENT_SECRET),
    publicKey: pick(db?.mercadopago_public_key, process.env.MERCADO_PAGO_PUBLIC_KEY),
    accessToken: pick(db?.mercadopago_access_token, process.env.MERCADO_PAGO_ACCESS_TOKEN),
    webhookSecret: pick(db?.mercadopago_webhook_secret, process.env.MERCADO_PAGO_WEBHOOK_SECRET),
    redirectUri: pick(db?.mercadopago_redirect_uri, process.env.MERCADO_PAGO_REDIRECT_URI),
    encryptionKey: pick(db?.mercadopago_encryption_key, process.env.MERCADO_PAGO_ENCRYPTION_KEY),
  };
}

/** Config mergida (banco > env) com cache de TTL curto. */
export async function resolveMpConfig(): Promise<ResolvedMpConfig> {
  const now = Date.now();
  if (cachedConfig && now - cachedAt < CACHE_TTL_MS) return cachedConfig;

  const row = await loadRow();
  cachedConfig = rawConfig(row as Record<string, string | null | undefined> | null);
  cachedAt = now;
  return cachedConfig;
}

/** Apenas a chave de criptografia dos tokens (banco > env). */
export async function resolveEncryptionKey(): Promise<string | null> {
  const { encryptionKey } = await resolveMpConfig();
  return encryptionKey;
}

/** Invalida o cache após salvar pelo painel. */
export function invalidateMpConfigCache(): void {
  cachedConfig = null;
  cachedAt = 0;
}

/** Persiste credenciais (apenas campos não vazios são sobrescritos). */
export async function saveMpConfig(values: Record<string, string | undefined>): Promise<void> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const patch: Record<string, string> = {};
  const fieldMap: Record<string, string> = {
    clientId: "mercadopago_client_id",
    clientSecret: "mercadopago_client_secret",
    publicKey: "mercadopago_public_key",
    accessToken: "mercadopago_access_token",
    webhookSecret: "mercadopago_webhook_secret",
    redirectUri: "mercadopago_redirect_uri",
    encryptionKey: "mercadopago_encryption_key",
  };
  for (const [key, value] of Object.entries(values)) {
    const column = fieldMap[key];
    if (!column) continue;
    const trimmed = value?.trim();
    if (trimmed) patch[column] = trimmed;
  }
  if (Object.keys(patch).length > 0) {
    await supabaseAdmin
      .from("platform_settings")
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq("id", 1);
  }
  invalidateMpConfigCache();
}
