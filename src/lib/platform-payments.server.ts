// Financeiro da Plataforma — gravação consolidada de pagamentos online.
//
// Todas as rotas que aprovam um pagamento no Mercado Pago gravam aqui a
// partir deste único helper, idempotente por mercadopago_payment_id:
//
//   - webhook do Mercado Pago (fonte canônica — tem net_received_amount e
//     date_approved autoritativos);
//   - processCardPayment / confirmOnlineOrder (fallback: o checkout marca o
//     pedido como pago antes do webhook chegar; sem este fallback a venda
//     nunca apareceria no painel admin).
//
// Os valores vêm da API do Mercado Pago (transaction_amount /
// net_received_amount). Nada aqui é inventado.
//
// Server-only. Nunca importar em código cliente.
import { loadSupabaseAdmin, logPaymentEvent } from "@/lib/mercadopago.server";

export type PlatformPaymentMethod = "pix" | "credit_card" | "debit_card" | "cash" | "other";
export type PlatformPaymentStatus = "approved" | "cancelled" | "refunded" | "pending";

export interface UpsertPlatformPaymentInput {
  companyId: string;
  paymentId: string;
  orderId: string | null;
  grossAmount: number;
  netAmount: number;
  paymentMethodId?: string | null;
  paymentMethodType?: string | null;
  /** Status bruto do Mercado Pago (approved, pending, cancelled, ...). */
  paymentStatus: string;
  dateApproved?: string | null;
}

export async function upsertPlatformPayment(input: UpsertPlatformPaymentInput): Promise<void> {
  const supabaseAdmin = await loadSupabaseAdmin();

  const { data: company } = await supabaseAdmin
    .from("companies")
    .select("name")
    .eq("id", input.companyId)
    .maybeSingle();

  const { error } = await supabaseAdmin.from("platform_payments" as any).upsert(
    {
      company_id: input.companyId,
      company_name: company?.name ?? null,
      order_id: input.orderId,
      payment_origin: "mercado_pago",
      payment_method: mapPaymentMethod(input.paymentMethodId, input.paymentMethodType),
      payment_status: mapPaymentStatus(input.paymentStatus),
      gross_amount: input.grossAmount,
      net_amount: input.netAmount,
      mercadopago_payment_id: input.paymentId,
      paid_at:
        input.paymentStatus === "approved"
          ? (input.dateApproved ?? new Date().toISOString())
          : null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "mercadopago_payment_id" },
  );

  if (error) {
    await logPaymentEvent(input.companyId, "Erro ao registrar pagamento na plataforma", {
      paymentId: input.paymentId,
      message: error.message,
    });
  }
}

export function mapPaymentMethod(
  paymentMethodId?: string | null,
  paymentMethodType?: string | null,
): PlatformPaymentMethod {
  const id = paymentMethodId?.toLowerCase() ?? "";
  const type = paymentMethodType?.toLowerCase() ?? "";
  if (id === "pix") return "pix";
  if (type === "credit_card") return "credit_card";
  if (type === "debit_card") return "debit_card";
  if (id.startsWith("deb")) return "debit_card";
  if (/visa|master|amex|elo|hipercard|hiper|naranja|nativa|maestro/.test(id)) {
    return "credit_card";
  }
  return "other";
}

export function mapPaymentStatus(status: string): PlatformPaymentStatus {
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
