// Credenciais globais do Mercado Pago — apenas admin (painel WEAZE).
//
// get  → retorna apenas STATUS (configurado ou não e origem db/env), nunca os
//        valores secretos.
// save → grava em platform_settings via service_role; campos vazios são
//        ignorados (não apagam valores existentes).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const MP_FIELDS = [
  "clientId",
  "clientSecret",
  "publicKey",
  "accessToken",
  "webhookSecret",
  "redirectUri",
  "encryptionKey",
] as const;

export type MercadoPagoSettingKey = (typeof MP_FIELDS)[number];

export type MercadoPagoSettingsResult =
  | {
      status: "success";
      fields: Record<MercadoPagoSettingKey, { configured: boolean; source: "db" | "env" }>;
    }
  | { status: "unauthorized" };

export type MercadoPagoSaveResult = { status: "success" } | { status: "unauthorized" };

const JwtInput = z.object({ jwt: z.string().min(1) });

async function isPlatformAdmin(jwt: string): Promise<boolean> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: userData, error } = await supabaseAdmin.auth.getUser(jwt);
    if (error || !userData?.user) return false;
    const { data: role } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id)
      .eq("role", "admin")
      .maybeSingle();
    return Boolean(role);
  } catch {
    return false;
  }
}

export const getMercadoPagoSettings = createServerFn({ method: "POST" })
  .inputValidator((raw) => JwtInput.parse(raw))
  .handler(async ({ data }): Promise<MercadoPagoSettingsResult> => {
    if (!(await isPlatformAdmin(data.jwt))) return { status: "unauthorized" };

    const { loadMpRow } = await import("@/lib/mp-settings.server");
    const dbRow = await loadMpRow();

    const envValues: Record<MercadoPagoSettingKey, string | undefined> = {
      clientId: process.env.MERCADO_PAGO_CLIENT_ID,
      clientSecret: process.env.MERCADO_PAGO_CLIENT_SECRET,
      publicKey: process.env.MERCADO_PAGO_PUBLIC_KEY,
      accessToken: process.env.MERCADO_PAGO_ACCESS_TOKEN,
      webhookSecret: process.env.MERCADO_PAGO_WEBHOOK_SECRET,
      redirectUri: process.env.MERCADO_PAGO_REDIRECT_URI,
      encryptionKey: process.env.MERCADO_PAGO_ENCRYPTION_KEY,
    };
    const dbValues: Record<MercadoPagoSettingKey, string | null | undefined> = {
      clientId: dbRow?.mercadopago_client_id,
      clientSecret: dbRow?.mercadopago_client_secret,
      publicKey: dbRow?.mercadopago_public_key,
      accessToken: dbRow?.mercadopago_access_token,
      webhookSecret: dbRow?.mercadopago_webhook_secret,
      redirectUri: dbRow?.mercadopago_redirect_uri,
      encryptionKey: dbRow?.mercadopago_encryption_key,
    };

    const fields = {} as Record<MercadoPagoSettingKey, { configured: boolean; source: "db" | "env" }>;
    for (const key of MP_FIELDS) {
      const db = dbValues[key];
      const env = envValues[key];
      fields[key] =
        db && db.trim() !== ""
          ? { configured: true, source: "db" }
          : env && env.trim() !== ""
            ? { configured: true, source: "env" }
            : { configured: false, source: "env" };
    }

    return { status: "success", fields };
  });

const SaveInput = z.object({
  jwt: z.string().min(1),
  values: z
    .object({
      clientId: z.string().optional(),
      clientSecret: z.string().optional(),
      publicKey: z.string().optional(),
      accessToken: z.string().optional(),
      webhookSecret: z.string().optional(),
      redirectUri: z.string().optional(),
      encryptionKey: z.string().optional(),
    })
    .optional(),
});

export const saveMercadoPagoSettings = createServerFn({ method: "POST" })
  .inputValidator((raw) => SaveInput.parse(raw))
  .handler(async ({ data }): Promise<MercadoPagoSaveResult> => {
    if (!(await isPlatformAdmin(data.jwt))) return { status: "unauthorized" };

    const { saveMpConfig } = await import("@/lib/mp-settings.server");
    await saveMpConfig(data.values ?? {});
    return { status: "success" };
  });
