// Sessão do cliente B2C. Guarda APENAS identificadores (não dados de domínio).
// Dados vivem no Cloud; localStorage aqui é apenas a "chave" para reencontrar o customer.
const KEY = "weaze.session.v1";

export type WeazeSession = {
  customerId: string;
  companyId: string;
  companySlug: string;
};

export function getSession(): WeazeSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as WeazeSession) : null;
  } catch {
    return null;
  }
}

export function setSession(s: WeazeSession) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(s));
}

export function clearSession() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(KEY);
}

export function getSessionForCompany(companySlug: string): WeazeSession | null {
  const s = getSession();
  return s && s.companySlug === companySlug ? s : null;
}
