// Rascunho do checkout (estado de UI entre a rota /checkout e /pagamento).
// Persistido em localStorage por empresa — o mesmo cliente segue o fluxo
// Resumo → Forma de pagamento sem perder a observação do pedido.
const KEY_PREFIX = "weaze.checkout.v1.";

export interface CheckoutDraft {
  note?: string;
}

export function readCheckoutDraft(companyId: string): CheckoutDraft {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(KEY_PREFIX + companyId);
    return raw ? (JSON.parse(raw) as CheckoutDraft) : {};
  } catch {
    return {};
  }
}

export function saveCheckoutDraft(companyId: string, draft: CheckoutDraft) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY_PREFIX + companyId, JSON.stringify(draft));
}

export function clearCheckoutDraft(companyId: string) {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(KEY_PREFIX + companyId);
}
