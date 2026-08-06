// ============================================================
// CENTRAL DE PAGAMENTOS — ESTRUTURA FUTURA (INERTE)
//
// Local preparado para a futura configuração de SOM e o futuro
// QR CODE DE RETIRADA. Nada aqui é reproduzido/executado nesta
// versão. Configurações futuras devem entrar por aqui.
// ============================================================

/** Configuração futura de som de confirmação. Nesta versão permanece desligada. */
export const paymentSoundConfig = {
  enabled: false,
} as const;

/**
 * Som de confirmação (estrutura pronta, ainda não reproduzido).
 * Quando ativado no futuro, tocar apenas após a confirmação oficial
 * do Mercado Pago, nunca em recarregamentos ou re-renders.
 */
export function playPaymentReceivedSound(): void {
  if (!paymentSoundConfig.enabled) return;
}

/** Etapas futuras do QR de Retirada (apenas tipagem, não implementado). */
export type PickupStage = "awaiting" | "qr_generated" | "awaiting_pickup" | "delivered" | "closed";

/** Estado operacional futuro de retirada por QR. Não usado nesta versão. */
export const PICKUP_STAGE_LABEL: Record<PickupStage, string> = {
  awaiting: "Aguardando conferência",
  qr_generated: "QR gerado",
  awaiting_pickup: "Aguardando retirada",
  delivered: "Entregue",
  closed: "Sessão encerrada",
};
