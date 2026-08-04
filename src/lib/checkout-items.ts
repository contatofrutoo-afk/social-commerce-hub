const PREFIX = "weaze.checkout.items";

export function saveCheckoutItems(companyId: string, keys: string[]) {
  localStorage.setItem(`${PREFIX}.${companyId}`, JSON.stringify(keys));
}

export function readCheckoutItems(companyId: string): string[] {
  try {
    return JSON.parse(localStorage.getItem(`${PREFIX}.${companyId}`) || "[]");
  } catch {
    return [];
  }
}

export function clearCheckoutItems(companyId: string) {
  localStorage.removeItem(`${PREFIX}.${companyId}`);
}
