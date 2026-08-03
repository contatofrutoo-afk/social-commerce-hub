import { supabase } from "@/integrations/supabase/client";
import {
  disconnectMercadoPagoAccount,
  exchangeMercadoPagoCode,
  getMercadoPagoAccount,
  refreshMercadoPagoToken,
  startMercadoPagoOAuth,
} from "@/lib/mercadopago.functions";
import {
  confirmOnlineOrder,
  createPaymentPreference,
  createPixPayment,
  getMercadoPagoConfig,
  getOnlinePaymentStatus,
  processCardPayment,
} from "@/lib/mercadopago.checkout.functions";
import type {
  CreatePaymentInput,
  PaymentAccountPublic,
  PaymentGateway,
  PaymentProvider,
  PaymentResult,
} from "./types";
import { registerCheckoutPaymentProvider, type CheckoutPaymentProvider } from "./provider";

export type { PaymentAccountPublic } from "./types";
export type {
  MercadoPagoAccountResult,
  MercadoPagoDisconnectResult,
  MercadoPagoExchangeResult,
  MercadoPagoRefreshResult,
  MercadoPagoStartResult,
} from "@/lib/mercadopago.functions";
export type {
  MercadoPagoConfigResult,
  MercadoPagoPreferenceResult,
} from "@/lib/mercadopago.checkout.functions";
export type {
  CardPaymentResult,
  CreatePixPaymentResult,
} from "@/lib/mercadopago.checkout.functions";

async function getPanelJwt(): Promise<string> {
  // Garante um token fresco: o fluxo OAuth leva o usuário ao Mercado Pago,
  // então o access_token pode ter expirado ao voltar ao callback.
  try {
    const { data: session } = await supabase.auth.getSession();
    const now = Date.now();
    const expiresAt = session.session?.expires_at ? session.session.expires_at * 1000 : 0;
    if (!session.session || (expiresAt && expiresAt <= now + 30_000)) {
      const { data: refreshed } = await supabase.auth.refreshSession();
      const token = refreshed.session?.access_token;
      if (token) return token;
    }
  } catch {
    // segue para o caminho normal abaixo
  }
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Sessão expirada. Faça login novamente.");
  return token;
}

// Gateway real de checkout via Mercado Pago (Etapa 4).
const mercadopagoGateway: PaymentGateway = {
  provider: "mercadopago",
  async createPayment(input: CreatePaymentInput): Promise<PaymentResult> {
    if (!input.orderId) {
      return { id: null, status: "failed", gatewayTransactionId: null };
    }
    const pref = await createPaymentPreference({
      data: { companyId: input.businessId, orderId: input.orderId },
    });
    return {
      id: pref.orderId,
      status: "pending",
      gatewayTransactionId: pref.preferenceId,
    };
  },
  async getPayment(gatewayTransactionId: string): Promise<PaymentResult | null> {
    // Consulta isolada por paymentId não sabe o comerciante; usar via checkout.
    return { id: null, status: "pending", gatewayTransactionId };
  },
  async cancelPayment(gatewayTransactionId: string): Promise<PaymentResult | null> {
    void gatewayTransactionId;
    return null;
  },
};

const mercadopagoCheckoutProvider: CheckoutPaymentProvider = {
  name: "mercadopago",
  async createCharge(input: CreatePaymentInput): Promise<PaymentResult> {
    return mercadopagoGateway.createPayment(input);
  },
  async getPayment(gatewayTransactionId: string): Promise<PaymentResult | null> {
    return mercadopagoGateway.getPayment(gatewayTransactionId);
  },
  async cancelPayment(gatewayTransactionId: string): Promise<PaymentResult | null> {
    return mercadopagoGateway.cancelPayment(gatewayTransactionId);
  },
};

registerCheckoutPaymentProvider(mercadopagoCheckoutProvider);

export const paymentService = {
  /**
   * Inicia o fluxo OAuth de conexão da conta do Mercado Pago.
   * Retorna a URL de autorização; o painel redireciona o usuário.
   */
  async connect(provider: PaymentProvider) {
    if (provider !== "mercadopago") {
      throw new Error("Gateway ainda não suportado nesta etapa.");
    }
    const jwt = await getPanelJwt();
    return startMercadoPagoOAuth({ data: { jwt } });
  },

  /** Troca o authorization_code recebido no callback por tokens. */
  async exchangeCode(code: string, state: string) {
    const jwt = await getPanelJwt();
    return exchangeMercadoPagoCode({ data: { jwt, code, state } });
  },

  /** Status atual da conta (sem tokens). */
  async getAccount() {
    const jwt = await getPanelJwt();
    return getMercadoPagoAccount({ data: { jwt } });
  },

  /** Desconecta a conta mantendo o histórico financeiro. */
  async disconnect() {
    const jwt = await getPanelJwt();
    return disconnectMercadoPagoAccount({ data: { jwt } });
  },

  /** Renova o access_token quando expirado/próximo de expirar. */
  async refreshToken() {
    const jwt = await getPanelJwt();
    return refreshMercadoPagoToken({ data: { jwt } });
  },

  gateway(): PaymentGateway {
    return mercadopagoGateway;
  },

  /** Checkout online (rota pública /c/:companySlug/pagamento). */
  checkout: {
    async config() {
      return getMercadoPagoConfig();
    },
    async createPreference(companyId: string, orderId: string) {
      return createPaymentPreference({ data: { companyId, orderId } });
    },
    async createPix(companyId: string, orderId: string) {
      return createPixPayment({ data: { companyId, orderId } });
    },
    async processCard(
      companyId: string,
      orderId: string,
      card: {
        token: string;
        installments?: number;
        paymentMethodId: string;
        payer?: { email?: string; identification?: { type?: string; number?: string } };
      },
    ) {
      return processCardPayment({ data: { companyId, orderId, ...card } });
    },
    async confirmOrder(companyId: string, orderId: string, paymentId: string) {
      return confirmOnlineOrder({ data: { companyId, orderId, paymentId } });
    },
    async getStatus(companyId: string, orderId: string, paymentId: string) {
      return getOnlinePaymentStatus({ data: { companyId, orderId, paymentId } });
    },
  },
};

export { getCheckoutPaymentProvider as getMercadoPagoCheckoutProvider } from "./provider";
export type { CheckoutPaymentProvider } from "./provider";
