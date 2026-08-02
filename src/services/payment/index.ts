import { supabase } from "@/integrations/supabase/client";
import {
  disconnectMercadoPagoAccount,
  exchangeMercadoPagoCode,
  getMercadoPagoAccount,
  refreshMercadoPagoToken,
  startMercadoPagoOAuth,
} from "@/lib/mercadopago.functions";
import type {
  CreatePaymentInput,
  PaymentAccountPublic,
  PaymentGateway,
  PaymentProvider,
  PaymentResult,
} from "./types";

export type { PaymentAccountPublic } from "./types";
export type {
  MercadoPagoAccountResult,
  MercadoPagoDisconnectResult,
  MercadoPagoExchangeResult,
  MercadoPagoRefreshResult,
  MercadoPagoStartResult,
} from "@/lib/mercadopago.functions";

async function getPanelJwt(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Sessão expirada. Faça login novamente.");
  return token;
}

// Checkout/cobranças/pagamentos ainda não fazem parte desta etapa.
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
    return unavailableGateway;
  },
};
