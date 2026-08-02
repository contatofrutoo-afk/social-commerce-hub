// Arquitetura desacoplada de Provider de Pagamento.
//
// O checkout da WEAZE depende desta interface — nunca de um gateway concreto.
// Nesta fase nenhum provider está registrado: `getCheckoutPaymentProvider`
// retorna null e o fluxo segue apenas com "Pagamento no Caixa" (counter).
// Na Fase 4+, o Mercado Pago (via o serviço em ./index.ts) implementa e
// registra um provider aqui, sem tocar nas rotas de checkout.
import type { CreatePaymentInput, PaymentResult } from "./types";

export interface CheckoutPaymentProvider {
  readonly name: string;
  /** Cria uma cobrança/charge no gateway. */
  createCharge(input: CreatePaymentInput): Promise<PaymentResult>;
  /** Consulta o status de uma cobrança no gateway. */
  getPayment(gatewayTransactionId: string): Promise<PaymentResult | null>;
  /** Cancela uma cobrança ainda não paga. */
  cancelPayment(gatewayTransactionId: string): Promise<PaymentResult | null>;
}

const registry = new Map<string, CheckoutPaymentProvider>();

export function registerCheckoutPaymentProvider(provider: CheckoutPaymentProvider) {
  registry.set(provider.name, provider);
}

export function getCheckoutPaymentProvider(name: string): CheckoutPaymentProvider | null {
  return registry.get(name) ?? null;
}

export function getActiveCheckoutPaymentProvider(): CheckoutPaymentProvider | null {
  return registry.size > 0 ? (registry.values().next().value ?? null) : null;
}
