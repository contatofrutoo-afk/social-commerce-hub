// Webhook do Mercado Pago — processamento no backend.
//
// O TanStack Start 1.168.26 não expõe createAPIFileRoute, então esta função
// é chamada direto no fetch handler de src/server.ts quando o path bate
// com /api/webhooks/mercadopago.
import { createHmac, timingSafeEqual } from "node:crypto";
import { loadSupabaseAdmin, logPaymentEvent, mpConfig } from "@/lib/mercadopago.server";
import { decryptToken } from "@/lib/token-crypto.server";

const MERCADO_PAGO_PAYMENTS_URL = "https://api.mercadopago.com/v1/payments";

type MercadoPagoPaymentStatus =
  | "pending"
  | "approved"
  | "authorized"
  | "in_process"
  | "in_mediation"
  | "rejected"
  | "cancelled"
  | "expired"
  | "refunded"
  | "charged_back"
  | "partly_refunded";

interface MercadoPagoPayment {
  id: string;
  status: MercadoPagoPaymentStatus;
  status_detail?: string;
  external_reference?: string | null;
  date_approved?: string | null;
  transaction_amount?: number | null;
  net_received_amount?: number | null;
  payment_method?: { id?: string; type?: string } | null;
  collector?: { id: number } | null;
}

type PlatformPaymentMethod = "pix" | "credit_card" | "debit_card" | "cash" | "other";
type PlatformPaymentStatus = "approved" | "cancelled" | "refunded" | "pending";

export async function handleMercadoPagoWebhook(request: Request): Promise<Response> {
  if (request.method !== "POST") {
    return json({ error: "method_not_allowed" }, 405);
  }

  const rawBody = await request.text();
  const { webhookSecret } = await mpConfig();

  const { data, id, type } = parseWebhookPayload(rawBody, request.url);

  if (!id) {
    return json({ error: "missing_payment_id" }, 400);
  }

  if (webhookSecret && !verifySignature(rawBody, request, id, webhookSecret)) {
    await logPaymentEvent("webhook", "Assinatura inválida", { id, type });
    return json({ error: "invalid_signature" }, 401);
  }

  const supabaseAdmin = await loadSupabaseAdmin();

  // Idempotência: se o pedido já foi processado para este payment, responde 200.
  const { data: existing } = await supabaseAdmin
    .from("orders")
    .select("id, payment_status")
    .eq("payment_id", String(id))
    .maybeSingle();

  if (existing && existing.payment_status !== "pending") {
    return json({ ok: true, ignored: "already_processed" }, 200);
  }

  // 1) Tenta com o token da plataforma (MERCADO_PAGO_ACCESS_TOKEN).
  const { accessToken } = await mpConfig();
  let payment: MercadoPagoPayment | null = null;
  let fetchError: string | null = null;

  if (accessToken) {
    const res = await fetchMercadoPagoPayment(String(id), accessToken);
    payment = res.payment;
    fetchError = res.error;
  }

  // 2) Sem acesso à plataforma, procura um pedido já vinculado a esse payment.
  let merchantId: string | null = existing?.id ? await getMerchantIdForOrder(existing.id as string) : null;

  // 3) Se conhecemos o collector, resolve o token do comerciante e refaz a
  //    busca de forma autoritativa com a própria conta.
  if (payment?.collector?.id) {
    const { data: account } = await supabaseAdmin
      .from("merchant_payment_accounts")
      .select("merchant_id, access_token")
      .eq("provider_user_id", String(payment.collector.id))
      .eq("provider", "mercadopago")
      .maybeSingle();
    if (account?.merchant_id && account.access_token) {
      merchantId = account.merchant_id as string;
      const token = await decryptToken(account.access_token);
      if (token) {
        const res = await fetchMercadoPagoPayment(String(id), token);
        if (res.payment) payment = res.payment;
      }
    }
  }

  if (!payment) {
    await logPaymentEvent("webhook", "Falha ao buscar payment", { id, fetchError, type });
    return json({ ok: true, deferred: "payment_unreachable" }, 200);
  }

  const orderId = payment.external_reference ?? null;

  if (orderId) {
    const order = await getOrderById(orderId);
    if (order) merchantId = order.merchant_id ?? merchantId;
  }

  if (!orderId && !merchantId) {
    await logPaymentEvent("webhook", "Payment sem vínculo com pedido", {
      id: payment.id,
      status: payment.status,
    });
    return json({ ok: true, ignored: "no_order_link" }, 200);
  }

  const result = await updateOrderFromPayment({
    payment,
    orderId,
    merchantId,
    data,
    type,
  });

  return json({ ok: true, ...result }, 200);
}

interface UpdateOrderInput {
  payment: MercadoPagoPayment;
  orderId: string | null;
  merchantId: string | null;
  data?: unknown;
  type?: string;
}

async function updateOrderFromPayment({ payment, orderId, merchantId, data, type }: UpdateOrderInput) {
  const supabaseAdmin = await loadSupabaseAdmin();
  const now = new Date().toISOString();

  const patch: Record<string, string | null> = { payment_id: String(payment.id) };

  switch (payment.status) {
    case "approved": {
      patch.payment_status = "paid";
      patch.status = "payment_approved";
      patch.payment_approved_at = payment.date_approved ?? now;
      break;
    }
    case "pending":
    case "in_process":
    case "authorized": {
      patch.payment_status = "pending";
      if (orderId) patch.status = "awaiting_payment";
      break;
    }
    case "rejected":
    case "cancelled":
    case "expired": {
      patch.payment_status = "cancelled";
      if (orderId) patch.status = "cancelled";
      break;
    }
    case "refunded":
    case "charged_back":
    case "partly_refunded": {
      patch.payment_status = "refunded";
      break;
    }
    default: {
      patch.payment_status = "pending";
    }
  }

  patch.updated_at = now;

  let updated = 0;
  if (orderId) {
    const { data: rows, error } = await supabaseAdmin
      .from("orders")
      .update(patch as any)
      .eq("id", orderId)
      .select("id");
    updated = rows?.length ?? 0;
    if (error) {
      await logPaymentEvent(merchantId ?? "webhook", "Erro ao atualizar pedido", {
        orderId,
        paymentId: payment.id,
        message: error.message,
      });
    }
  } else if (merchantId) {
    const { error } = await supabaseAdmin
      .from("orders")
      .update(patch as any)
      .eq("merchant_id", merchantId)
      .eq("payment_id", String(payment.id));
    updated = error ? 0 : 1;
  }

  // Financeiro da Plataforma: consolidação idempotente por payment do MP.
  const order = orderId ? await getOrderById(orderId) : null;
  const companyId = order?.company_id ?? merchantId;
  if (companyId) {
    await upsertPlatformPayment({ payment, companyId });
  }

  await logPaymentEvent(merchantId ?? "webhook", "Payment processado", {
    paymentId: payment.id,
    orderId,
    status: payment.status,
    paymentStatus: patch.payment_status,
    data,
    type,
  });

  return { paymentId: payment.id, orderId, status: payment.status, updated };
}

async function upsertPlatformPayment({
  payment,
  companyId,
}: {
  payment: MercadoPagoPayment;
  companyId: string;
}) {
  const supabaseAdmin = await loadSupabaseAdmin();

  const { data: company } = await supabaseAdmin
    .from("companies")
    .select("name")
    .eq("id", companyId)
    .maybeSingle();

  const gross = payment.transaction_amount ?? 0;
  const net = payment.net_received_amount ?? gross;

  const { error } = await supabaseAdmin
    .from("platform_payments" as any)
    .upsert(
      {
        company_id: companyId,
        company_name: company?.name ?? null,
        order_id: payment.external_reference ?? null,
        payment_origin: "mercado_pago",
        payment_method: mapPaymentMethod(payment),
        payment_status: mapPaymentStatus(payment.status),
        gross_amount: gross,
        net_amount: net,
        mercadopago_payment_id: String(payment.id),
        paid_at:
          payment.status === "approved"
            ? payment.date_approved ?? new Date().toISOString()
            : null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "mercadopago_payment_id" },
    );

  if (error) {
    await logPaymentEvent(companyId, "Erro ao registrar pagamento na plataforma", {
      paymentId: payment.id,
      message: error.message,
    });
  }
}

function mapPaymentMethod(payment: MercadoPagoPayment): PlatformPaymentMethod {
  const id = payment.payment_method?.id?.toLowerCase() ?? "";
  const type = payment.payment_method?.type?.toLowerCase() ?? "";
  if (id === "pix") return "pix";
  if (type === "credit_card") return "credit_card";
  if (type === "debit_card") return "debit_card";
  if (id.startsWith("deb")) return "debit_card";
  if (/visa|master|amex|elo|hipercard|hiper|naranja|nativa|maestro/.test(id)) {
    return "credit_card";
  }
  return "other";
}

function mapPaymentStatus(status: MercadoPagoPaymentStatus): PlatformPaymentStatus {
  switch (status) {
    case "approved":
      return "approved";
    case "pending":
    case "in_process":
    case "authorized":
    case "in_mediation":
      return "pending";
    case "rejected":
    case "cancelled":
    case "expired":
      return "cancelled";
    case "refunded":
    case "charged_back":
    case "partly_refunded":
      return "refunded";
    default:
      return "pending";
  }
}

async function fetchMercadoPagoPayment(
  paymentId: string,
  accessToken: string,
): Promise<{ payment: MercadoPagoPayment | null; error: string | null }> {
  try {
    const res = await fetch(`${MERCADO_PAGO_PAYMENTS_URL}/${paymentId}`, {
      headers: { accept: "application/json", authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) {
      return { payment: null, error: `http_${res.status}` };
    }
    const payment = (await res.json()) as MercadoPagoPayment;
    return { payment, error: null };
  } catch (error) {
    return { payment: null, error: error instanceof Error ? error.message : "network" };
  }
}

async function getOrderById(orderId: string) {
  const supabaseAdmin = await loadSupabaseAdmin();
  const { data } = await supabaseAdmin
    .from("orders")
    .select("id, merchant_id, company_id, payment_status")
    .eq("id", orderId)
    .maybeSingle();
  return data as
    | {
        id: string;
        merchant_id: string | null;
        company_id: string | null;
        payment_status: string | null;
      }
    | null;
}

async function getMerchantIdForOrder(orderId: string): Promise<string | null> {
  const order = await getOrderById(orderId);
  return order?.merchant_id ?? null;
}

function parseWebhookPayload(
  rawBody: string,
  requestUrl: string,
): { data?: unknown; id?: string; type?: string } {
  const url = new URL(requestUrl);
  const queryId = url.searchParams.get("data.id");
  const queryType = url.searchParams.get("type");

  let body: { data?: { id?: unknown }; type?: unknown } | null = null;
  try {
    body = rawBody ? (JSON.parse(rawBody) as { data?: { id?: unknown }; type?: unknown }) : null;
  } catch {
    body = null;
  }

  const id = (queryId ?? (body?.data?.id as unknown))?.toString();

  return {
    data: body?.data,
    id,
    type: queryType ?? (body?.type as string | undefined),
  };
}

function verifySignature(
  rawBody: string,
  request: Request,
  paymentId: string,
  webhookSecret: string,
): boolean {
  const xSignature = request.headers.get("x-signature") ?? "";
  const xRequestId = request.headers.get("x-request-id") ?? "";

  const tsMatch = /(?:^|,)ts=([^,]+)/.exec(xSignature);
  const v1Match = /(?:^|,)v1=([^,]+)/.exec(xSignature);
  if (!tsMatch || !v1Match) return false;

  const ts = tsMatch[1];
  const v1 = v1Match[1];
  const manifest = `id:${paymentId};request-id:${xRequestId};ts:${ts};`;

  const expected = createHmac("sha256", webhookSecret).update(manifest).digest("hex");

  const a = Buffer.from(v1.toLowerCase());
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

function json(payload: unknown, status: number): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}
