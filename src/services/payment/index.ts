import type { CreatePaymentInput, PaymentGateway, PaymentProvider, PaymentResult } from "./types";

const unavailableGateway = {
  provider: null,
  async createPayment(input: CreatePaymentInput): Promise<PaymentResult> {
    void input;
    return { id: null, status: "failed", gatewayTransactionId: null };
  },
  async getPayment(gatewayTransactionId: string): Promise<PaymentResult | null> {
    void gatewayTransactionId;
    return null;
  },
  async cancelPayment(gatewayTransactionId: string): Promise<PaymentResult | null> {
    void gatewayTransactionId;
    return null;
  },
} satisfies PaymentGateway;

export const paymentService = {
  async connect(provider: PaymentProvider) {
    void provider;
  },
  async disconnect() {},
  gateway(): PaymentGateway {
    return unavailableGateway;
  },
};
