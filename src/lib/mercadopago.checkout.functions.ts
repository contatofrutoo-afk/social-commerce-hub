// Checkout online do Mercado Pago (Etapa 4) — server functions usadas pelas
// rotas públicas /c/:companySlug/pagamento e /c/:companySlug/confirmado.
//
// Fluxo:
//   1. createPaymentPreference   — cria o pedido (awaiting_payment) e a
//      preferência no MP (items, notification_url, external_reference).
//   2. O cliente paga com Bricks (in-page, Pix ou Cartão).
//   3. confirmOnlineOrder        — verifica o pagamento no MP e aprova o pedido.
//   4. O webhook (mercadopago-webhook.server) atualiza em paralelo.
//
// Nunca expõe client_secret/access_token para o cliente.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { PaymentStatus } from "@/services/payment/types";

const MERCADO_PAGO_PREFERENCES_URL = "https://api.mercadopago.com/checkout/preferences";
const MERCADO_PAGO_PAYMENTS_URL = "https://api.mercadopago.com/v1/payments";

export interface MercadoPagoPaymentStatusResult {
  status: "approved" | "pending" | "cancelled" | "refunded" | "unknown";
  paymentStatus: PaymentStatus;
  paymentId: string;
  dateApproved: string | null;
  paymentMethodId: string | null;
  total: number | null;
}

interface MercadoPagoPayment {
  id: string;
  status?: string;
  date_approved?: string | null;
  transaction_amount?: number;
  payment_method?: { id?: string };
  external_reference?: string | null;
}

export interface MercadoPagoPreferenceResult {
  preferenceId: string;
  orderId: string;
  total: number;
}

export type MercadoPagoConfigResult =
  | { configured: true; publicKey: string }
  | { configured: false; publicKey: null };

async function loadAdmin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

async function resolveTokenForCompany(companyId: string): Promise<string> {
  const { resolveMerchantAccessToken } = await import("@/lib/mercadopago.server");
  const { token } = await resolveMerchantAccessToken(companyId);
  return token;
}

export const getMercadoPagoConfig = createServerFn({ method: "POST" }).handler(
  async (): Promise<MercadoPagoConfigResult> => {
    const { mpConfig } = await import("@/lib/mercadopago.server");
    const { publicKey } = await mpConfig();
    if (!publicKey) return { configured: false, publicKey: null };
    return { configured: true, publicKey };
  },
);

const PreferenceInput = z.object({
  companyId: z.string().uuid(),
  orderId: z.string().uuid(),
});

/**
 * Cria a preferência de pagamento no Mercado Pago para um pedido já criado
 * (status awaiting_payment). Itens são lidos do banco — o cliente nunca manda
 * valores.
 */
export const createPaymentPreference = createServerFn({ method: "POST" })
  .inputValidator((raw) => PreferenceInput.parse(raw))
  .handler(async ({ data }): Promise<MercadoPagoPreferenceResult> => {
    const { resolveWebhookUrl, logPaymentEvent } = await import("@/lib/mercadopago.server");
    const supabaseAdmin = await loadAdmin();

    const { data: order } = await supabaseAdmin
      .from("orders")
      .select("id, company_id, merchant_id, status, payment_provider, total, subtotal")
      .eq("id", data.orderId)
      .eq("company_id", data.companyId)
      .maybeSingle();
    if (!order) throw new Error("Pedido não encontrado.");

    const { data: orderItems } = await supabaseAdmin
      .from("order_items")
      .select("product_id, quantity, unit_price, product:products(name)")
      .eq("order_id", data.orderId);

    const items = (orderItems ?? []).map((i: any) => ({
      title: String(i.product?.name ?? "Item"),
      quantity: Number(i.quantity),
      unit_price: Number(i.unit_price),
      id: String(i.product_id ?? `item-${i.product_id}`),
    }));

    if (items.length === 0) throw new Error("Pedido sem itens.");

    const accessToken = await resolveTokenForCompany(data.companyId);

    const preferenceBody = {
      items,
      external_reference: data.orderId,
      notification_url: resolveWebhookUrl(),
      binary_mode: false,
      metadata: {
        order_id: data.orderId,
        company_id: data.companyId,
      },
    };

    let preference: { id?: string; init_point?: string; sandbox_init_point?: string };
    try {
      const res = await fetch(MERCADO_PAGO_PREFERENCES_URL, {
        method: "POST",
        headers: {
          accept: "application/json",
          "content-type": "application/json",
          authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(preferenceBody),
      });
      if (!res.ok) {
        const errBody = await res.text().catch(() => "");
        await logPaymentEvent(data.companyId, "Erro ao criar preferência", {
          orderId: data.orderId,
          status: res.status,
          body: errBody.slice(0, 400),
        });
        throw new Error("Não foi possível iniciar o pagamento. Tente novamente.");
      }
      preference = (await res.json()) as typeof preference;
    } catch (error) {
      if (error instanceof Error && error.message.startsWith("Não foi possível")) throw error;
      await logPaymentEvent(data.companyId, "Erro ao criar preferência", {
        orderId: data.orderId,
        reason: "network",
      });
      throw new Error("Não foi possível iniciar o pagamento. Tente novamente.");
    }

    if (!preference.id) {
      await logPaymentEvent(data.companyId, "Erro ao criar preferência", {
        orderId: data.orderId,
        missing: "id",
      });
      throw new Error("Não foi possível iniciar o pagamento. Tente novamente.");
    }

    await supabaseAdmin
      .from("orders")
      .update({
        payment_id: preference.id,
        payment_provider: "mercadopago",
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.orderId);

    await logPaymentEvent(data.companyId, "Preferência criada", {
      orderId: data.orderId,
      preferenceId: preference.id,
    });

    return {
      preferenceId: preference.id,
      orderId: data.orderId,
      total: Number(order.total ?? order.subtotal ?? 0),
    };
  });

export interface CreatePixPaymentResult {
  paymentId: string;
  qrCode: string;
  qrCodeBase64: string;
  expiration: string;
  total: number;
}

const PixPaymentInput = z.object({
  companyId: z.string().uuid(),
  orderId: z.string().uuid(),
});

/**
 * Cria um pagamento Pix direto na API do Mercado Pago (v1/payments) para um
 * pedido já criado (awaiting_payment). Retorna QR Code (base64), Pix
 * copia-e-cola e a data de expiração, sem nunca expor o access_token.
 *
 * LGPD: o cliente é anônimo — não coletamos e-mail/CPF/telefone. O MP exige
 * `payer.email` para Pix, então usamos um e-mail sintético gerado a partir do
 * id do pedido (não é dado pessoal do cliente).
 */
export const createPixPayment = createServerFn({ method: "POST" })
  .inputValidator((raw) => PixPaymentInput.parse(raw))
  .handler(async ({ data }): Promise<CreatePixPaymentResult> => {
    const { resolveWebhookUrl, logPaymentEvent } = await import("@/lib/mercadopago.server");
    const supabaseAdmin = await loadAdmin();

    const { data: order } = await supabaseAdmin
      .from("orders")
      .select("id, company_id, status, payment_status, total, subtotal")
      .eq("id", data.orderId)
      .eq("company_id", data.companyId)
      .maybeSingle();
    if (!order) throw new Error("Pedido não encontrado.");
    if (order.payment_status === "paid") throw new Error("Este pedido já foi pago.");
    if (order.status !== "awaiting_payment") {
      throw new Error("Este pedido não está mais aguardando pagamento.");
    }

    const total = Number(order.total ?? order.subtotal ?? 0);
    if (!(total > 0)) throw new Error("Pedido sem valor válido.");

    const accessToken = await resolveTokenForCompany(data.companyId);
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

    const body = {
      transaction_amount: total,
      description: `Pedido WEAZE ${data.orderId.slice(0, 8).toUpperCase()}`,
      payment_method_id: "pix",
      external_reference: data.orderId,
      notification_url: resolveWebhookUrl(),
      date_of_expiration: expiresAt.toISOString(),
      payer: {
        entity_type: "individual",
        email: `pix-${data.orderId.slice(0, 12)}@weaze.app`,
      },
    };

    let payment: {
      id?: number | string;
      status?: string;
      point_of_interaction?: {
        transaction_data?: { qr_code?: string; qr_code_base64?: string };
      };
    } = {};
    try {
      const res = await fetch(MERCADO_PAGO_PAYMENTS_URL, {
        method: "POST",
        headers: {
          accept: "application/json",
          "content-type": "application/json",
          authorization: `Bearer ${accessToken}`,
          "x-idempotency-key": globalThis.crypto.randomUUID(),
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const errBody = await res.text().catch(() => "");
        await logPaymentEvent(data.companyId, "Erro ao criar Pix", {
          orderId: data.orderId,
          status: res.status,
          body: errBody.slice(0, 400),
        });
        throw new Error("Não foi possível gerar o Pix. Tente novamente.");
      }
      payment = (await res.json()) as typeof payment;
    } catch (error) {
      if (error instanceof Error && error.message.startsWith("Não foi possível")) throw error;
      await logPaymentEvent(data.companyId, "Erro ao criar Pix", {
        orderId: data.orderId,
        reason: "network",
      });
      throw new Error("Não foi possível gerar o Pix. Tente novamente.");
    }

    const paymentId = payment.id ? String(payment.id) : "";
    const transactionData = payment.point_of_interaction?.transaction_data;
    const qrCode = transactionData?.qr_code ?? "";
    const qrCodeBase64 = transactionData?.qr_code_base64 ?? "";
    if (!paymentId || !qrCode || !qrCodeBase64) {
      await logPaymentEvent(data.companyId, "Erro ao criar Pix", {
        orderId: data.orderId,
        missing: "qr_data",
      });
      throw new Error("Não foi possível gerar o Pix. Tente novamente.");
    }

    await supabaseAdmin
      .from("orders")
      .update({
        payment_id: paymentId,
        payment_provider: "mercadopago",
        payment_status: "pending",
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.orderId);

    await logPaymentEvent(data.companyId, "Pix criado", {
      orderId: data.orderId,
      paymentId,
    });

    return {
      paymentId,
      qrCode,
      qrCodeBase64: `data:image/gif;base64,${qrCodeBase64}`,
      expiration: expiresAt.toISOString(),
      total,
    };
  });

const PaymentStatusInput = z.object({
  companyId: z.string().uuid(),
  orderId: z.string().uuid(),
  paymentId: z.string().min(1),
});

/**
 * Consulta o status do pagamento no MP (com o token do comerciante) e
 * atualiza o pedido se o pagamento foi aprovado.
 */
export const confirmOnlineOrder = createServerFn({ method: "POST" })
  .inputValidator((raw) => PaymentStatusInput.parse(raw))
  .handler(async ({ data }): Promise<{ orderId: string; status: string; paymentStatus: PaymentStatus }> => {
    const { logPaymentEvent } = await import("@/lib/mercadopago.server");
    const supabaseAdmin = await loadAdmin();

    const { data: order } = await supabaseAdmin
      .from("orders")
      .select("id, status, payment_status, payment_id")
      .eq("id", data.orderId)
      .eq("company_id", data.companyId)
      .maybeSingle();
    if (!order) throw new Error("Pedido não encontrado.");

    const paymentStatus = await fetchPayment(data.paymentId, data.companyId);

    const now = new Date().toISOString();
    let patch: Record<string, string | null> | null = null;

    if (paymentStatus.status === "approved") {
      if (order.payment_status !== "paid") {
        patch = {
          payment_status: "paid",
          status: "payment_approved",
          payment_id: data.paymentId,
          payment_approved_at: paymentStatus.dateApproved ?? now,
          updated_at: now,
        };
      }
    } else if (
      paymentStatus.status === "cancelled" ||
      paymentStatus.status === "refunded"
    ) {
      patch = {
        payment_status: paymentStatus.paymentStatus,
        updated_at: now,
      };
    }

    if (patch) {
      const { error } = await supabaseAdmin
        .from("orders")
        .update(patch as any)
        .eq("id", data.orderId);
      if (error) {
        await logPaymentEvent(data.companyId, "Erro ao confirmar pedido", {
          orderId: data.orderId,
          message: error.message,
        });
      }
    }

    const { data: updated } = await supabaseAdmin
      .from("orders")
      .select("status, payment_status")
      .eq("id", data.orderId)
      .maybeSingle();

    return {
      orderId: data.orderId,
      status: updated?.status ?? order.status,
      paymentStatus: (updated?.payment_status as PaymentStatus) ?? "pending",
    };
  });

export const getOnlinePaymentStatus = createServerFn({ method: "POST" })
  .inputValidator((raw) => PaymentStatusInput.parse(raw))
  .handler(async ({ data }): Promise<MercadoPagoPaymentStatusResult> => {
    const payment = await fetchPayment(data.paymentId, data.companyId);
    return {
      status: payment.status,
      paymentStatus: payment.paymentStatus,
      paymentId: data.paymentId,
      dateApproved: payment.dateApproved,
      paymentMethodId: payment.paymentMethodId,
      total: payment.total,
    };
  });

async function fetchPayment(
  paymentId: string,
  companyId: string,
): Promise<{
  status: MercadoPagoPaymentStatusResult["status"];
  paymentStatus: PaymentStatus;
  dateApproved: string | null;
  paymentMethodId: string | null;
  total: number | null;
}> {
  const accessToken = await resolveTokenForCompany(companyId);
  const res = await fetch(`${MERCADO_PAGO_PAYMENTS_URL}/${paymentId}`, {
    headers: { accept: "application/json", authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new Error("Não foi possível consultar o pagamento.");
  }
  const payment = (await res.json()) as MercadoPagoPayment;
  return mapPayment(payment);
}

function mapPayment(payment: MercadoPagoPayment): {
  status: MercadoPagoPaymentStatusResult["status"];
  paymentStatus: PaymentStatus;
  dateApproved: string | null;
  paymentMethodId: string | null;
  total: number | null;
} {
  switch (payment.status) {
    case "approved":
      return {
        status: "approved",
        paymentStatus: "paid",
        dateApproved: payment.date_approved ?? null,
        paymentMethodId: payment.payment_method?.id ?? null,
        total: payment.transaction_amount ?? null,
      };
    case "pending":
    case "in_process":
    case "authorized":
      return {
        status: "pending",
        paymentStatus: "pending",
        dateApproved: null,
        paymentMethodId: payment.payment_method?.id ?? null,
        total: payment.transaction_amount ?? null,
      };
    case "rejected":
    case "cancelled":
    case "expired":
      return {
        status: "cancelled",
        paymentStatus: "cancelled",
        dateApproved: null,
        paymentMethodId: payment.payment_method?.id ?? null,
        total: payment.transaction_amount ?? null,
      };
    case "refunded":
    case "charged_back":
    case "partly_refunded":
      return {
        status: "refunded",
        paymentStatus: "refunded",
        dateApproved: payment.date_approved ?? null,
        paymentMethodId: payment.payment_method?.id ?? null,
        total: payment.transaction_amount ?? null,
      };
    default:
      return {
        status: "unknown",
        paymentStatus: "pending",
        dateApproved: null,
        paymentMethodId: null,
        total: payment.transaction_amount ?? null,
      };
  }
}
