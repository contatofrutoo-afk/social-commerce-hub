export type PaymentProvider = "mercadopago" | "asaas" | "efi" | "stripe";

export type PaymentMethod = "pix" | "card" | "cash" | "counter";

export type PaymentStatus = "pending" | "paid" | "failed" | "cancelled" | "refunded";

export interface CreatePaymentInput {
  businessId: string;
  orderId: string | null;
  amount: number;
  method: PaymentMethod;
  description?: string;
}

export interface PaymentResult {
  id: string | null;
  status: PaymentStatus;
  gatewayTransactionId: string | null;
}

/**
 * Dados públicos de uma conta de pagamento (nunca inclui
 * access_token/refresh_token/client_secret — só o backend os vê).
 */
export interface PaymentAccountPublic {
  provider: string;
  status: string;
  accountName: string | null;
  accountId: string | null;
  providerUserId: string | null;
  connectedAt: string | null;
  lastSyncAt: string | null;
  updatedAt: string | null;
  expiresAt: string | null;
}

export interface PaymentGateway {
  readonly provider: PaymentProvider | null;
  createPayment(input: CreatePaymentInput): Promise<PaymentResult>;
  getPayment(gatewayTransactionId: string): Promise<PaymentResult | null>;
  cancelPayment(gatewayTransactionId: string): Promise<PaymentResult | null>;
}
